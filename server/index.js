import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './lib/supabase.js';
import { hardResetDatabase } from './dbReset.js';
import { processAttackQueue } from './engine/attackQueue.js';
import { processWarTick } from './engine/war.js';
import { processEnemyAttackCheck } from './engine/enemyAttack.js';
import { processNemesisTick } from './engine/nemesis.js';
import { simulateCombat } from './engine/combat.js';
import { startScheduler } from './scheduler.js';
import { startProductionLoop } from './engine/productionLoop.js';
import { addResources, getOrCreatePlayerResources, validateResourceDeduction } from './engine/resourceValidator.js';
import { BuildingType, ResourceType, TechType, UnitType } from './engine/enums.js';
import { COMMAND_TYPES, PATCH_ALLOW_LIST, validateCommandPayload } from './commandValidation.js';
import { buildAuthoritativeCommandResult, normalizeLifecycleState, resolveLifecycleCompletions } from './engine/authoritativeLifecycle.js';
import { buildAuthoritativeTutorialCommandResult } from './engine/authoritativeTutorial.js';
import { createUserStateRealtime } from './socket/userStateRealtime.js';
import { createGlobalPresence } from './socket/globalPresence.js';
import { registerCommandRoutes } from './routes/commandRoutes.js';
import { registerBootstrapRoutes } from './routes/bootstrapRoutes.js';
import { registerProfileRoutes } from './routes/profileRoutes.js';
import { registerResourceRoutes } from './routes/resourceRoutes.js';
import { registerDevToolsRoutes } from './routes/devToolsRoutes.js';
import { makeTraceId, normalizeServerError, shortId } from './lib/trace.js';
import { buildServerStatePatch, isNonNullObject, parseRevision, sanitizeStatePatch } from './lib/statePatch.js';
import { calculateEmpirePointsBreakdown } from './lib/empirePoints.js';
import { createRequireAuthUser } from './middleware/auth.js';
import { logWithSchema } from './lib/logSchema.js';

const DEFAULT_ROLE = 'Usuario';
const ROLE_PRIORITY = ['Dev', 'Admin', 'Moderador', 'Premium', 'Usuario'];
const PROFILE_SYNC_INTERVAL_MS = Number(process.env.PROFILE_SYNC_INTERVAL_MS || 60 * 60 * 1000);
const SCHEMA_CACHE_ERROR = "schema cache";
const SERVER_MANAGED_FIELDS = ['resources', 'maxResources', 'bankBalance', 'currentInterestRate', 'nextRateChangeTime', 'lastInterestPayoutTime'];
const FROZEN_BLOB_CRITICAL_FIELDS = ['buildings', 'units', 'techLevels', 'researchedTechs', 'activeConstructions', 'activeRecruitments', 'activeResearch', 'campaignProgress', 'empirePoints'];
const NORMALIZED_DUAL_WRITE_ENABLED = true;
const NORMALIZED_READS_ENABLED = true;
const NORMALIZED_DUAL_WRITE_STRICT = false;
const DISABLE_LEGACY_SAVE_BLOB = true;
const FREEZE_LEGACY_BLOB_CRITICAL_FIELDS = false;
const MAX_QUEUE_TIMESTAMP_MS = Date.parse('3000-01-01T00:00:00.000Z');
const AUTHORITATIVE_QUEUE_COMMANDS = new Set(['BUILD_START', 'RECRUIT_START', 'RESEARCH_START']);
const AUTHORITATIVE_SPEEDUP_TYPES = new Set(['BUILD', 'RECRUIT', 'RESEARCH']);
const INVALID_QUEUE_TARGETS = new Set(['UNKNOWN', 'UNKNOW']);
const VALID_BUILDING_TYPES = new Set(Object.values(BuildingType));
const VALID_UNIT_TYPES = new Set(Object.values(UnitType));
const VALID_TECH_TYPES = new Set(Object.values(TechType));
const COMMAND_RATE_WINDOW_MS = Number(process.env.COMMAND_RATE_WINDOW_MS || 60_000);
const COMMAND_RATE_MAX_REQUESTS = Number(process.env.COMMAND_RATE_MAX_REQUESTS || 120);
const COMMAND_METRICS_LOG_INTERVAL_MS = Number(process.env.COMMAND_METRICS_LOG_INTERVAL_MS || 60_000);
const COMMAND_METRICS_RETENTION_MS = Number(process.env.COMMAND_METRICS_RETENTION_MS || 15 * 60_000);
const COMMAND_ALERT_CONFLICTS_PER_MIN_THRESHOLD = Number(process.env.COMMAND_ALERT_CONFLICTS_PER_MIN_THRESHOLD || 5);
const COMMAND_ALERT_ERROR_RATE_THRESHOLD = Number(process.env.COMMAND_ALERT_ERROR_RATE_THRESHOLD || 0.05);
const COMMAND_ALERT_P95_LATENCY_MS_THRESHOLD = Number(process.env.COMMAND_ALERT_P95_LATENCY_MS_THRESHOLD || 750);
const COMMAND_ALERT_RETRY_RATIO_THRESHOLD = Number(process.env.COMMAND_ALERT_RETRY_RATIO_THRESHOLD || 0.2);
const OPS_ALERT_WEBHOOK_URL = process.env.OPS_ALERT_WEBHOOK_URL || '';
const OPS_ALERT_MIN_INTERVAL_MS = Number(process.env.OPS_ALERT_MIN_INTERVAL_MS || 60_000);
const commandMetrics = {
  startedAt: Date.now(),
  totals: {
    requests: 0,
    success: 0,
    conflicts: 0,
    badRequest: 0,
    rateLimited: 0,
    failed: 0,
    idempotentReplays: 0,
    inProgressCollisions: 0,
    revisionMismatches: 0,
  },
  byType: {},
  byErrorCode: {},
  latencyMs: {
    count: 0,
    min: null,
    max: 0,
    avg: 0,
    p50: 0,
    p95: 0,
    p99: 0,
  },
  recentLatencies: [],
};
const alertState = {
  lastSignature: null,
  lastSentAt: 0,
};

dotenv.config();

const SERVER_LOGS_ENABLED = process.env.SERVER_LOGS_ENABLED !== 'false';
if (!SERVER_LOGS_ENABLED) {
  console.log = () => {};
  console.warn = () => {};
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  const inboundTraceId = typeof req.headers['x-trace-id'] === 'string' ? req.headers['x-trace-id'].trim() : '';
  const traceId = inboundTraceId || makeTraceId('req');
  req.traceId = traceId;
  res.setHeader('x-trace-id', traceId);
  next();
});

const isLikelyUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);


const getTypeMetrics = (type) => {
  if (!commandMetrics.byType[type]) {
    commandMetrics.byType[type] = {
      requests: 0,
      success: 0,
      conflicts: 0,
      badRequest: 0,
      failed: 0,
      rateLimited: 0,
      idempotentReplays: 0,
      revisionMismatches: 0,
    };
  }
  return commandMetrics.byType[type];
};

const observeCommandLatency = (durationMs) => {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  const rounded = Math.round(durationMs);
  commandMetrics.recentLatencies.push({
    at: Date.now(),
    value: rounded,
  });

  const cutoff = Date.now() - COMMAND_METRICS_RETENTION_MS;
  commandMetrics.recentLatencies = commandMetrics.recentLatencies.filter((entry) => entry.at >= cutoff);

  if (commandMetrics.recentLatencies.length === 0) {
    commandMetrics.latencyMs = {
      count: 0,
      min: null,
      max: 0,
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    };
    return;
  }

  const values = commandMetrics.recentLatencies.map((entry) => entry.value).sort((a, b) => a - b);
  const percentile = (p) => values[Math.min(values.length - 1, Math.floor((p / 100) * values.length))] || 0;
  const sum = values.reduce((acc, value) => acc + value, 0);
  commandMetrics.latencyMs = {
    count: values.length,
    min: values[0],
    max: values[values.length - 1],
    avg: Math.round(sum / values.length),
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
  };
};

const observeCommandEvent = ({
  type,
  result,
  errorCode,
  durationMs,
  idempotentReplay = false,
  inProgressCollision = false,
  revisionMismatch = false,
}) => {
  const safeType = typeof type === 'string' && type ? type : 'UNKNOWN';
  const safeResult = typeof result === 'string' ? result : 'failed';
  commandMetrics.totals.requests += 1;

  const typeMetrics = getTypeMetrics(safeType);
  typeMetrics.requests += 1;

  if (safeResult === 'success') {
    commandMetrics.totals.success += 1;
    typeMetrics.success += 1;
  } else if (safeResult === 'conflict') {
    commandMetrics.totals.conflicts += 1;
    typeMetrics.conflicts += 1;
  } else if (safeResult === 'bad_request') {
    commandMetrics.totals.badRequest += 1;
    typeMetrics.badRequest += 1;
  } else if (safeResult === 'rate_limited') {
    commandMetrics.totals.rateLimited += 1;
    typeMetrics.rateLimited += 1;
  } else {
    commandMetrics.totals.failed += 1;
    typeMetrics.failed += 1;
  }

  if (idempotentReplay) {
    commandMetrics.totals.idempotentReplays += 1;
    typeMetrics.idempotentReplays += 1;
  }
  if (inProgressCollision) {
    commandMetrics.totals.inProgressCollisions += 1;
  }
  if (revisionMismatch) {
    commandMetrics.totals.revisionMismatches += 1;
    typeMetrics.revisionMismatches += 1;
  }

  if (typeof errorCode === 'string' && errorCode) {
    commandMetrics.byErrorCode[errorCode] = (commandMetrics.byErrorCode[errorCode] || 0) + 1;
  }

  if (Number.isFinite(durationMs)) {
    observeCommandLatency(durationMs);
  }
};

const getCommandMetricsSnapshot = () => {
  const uptimeMs = Date.now() - commandMetrics.startedAt;
  const uptimeMinutes = Math.max(1, uptimeMs / 60_000);
  const totals = commandMetrics.totals;
  const totalRequests = Math.max(1, totals.requests);

  const rates = {
    conflictsPerMin: Number((totals.conflicts / uptimeMinutes).toFixed(3)),
    failedPerMin: Number((totals.failed / uptimeMinutes).toFixed(3)),
    rateLimitedPerMin: Number((totals.rateLimited / uptimeMinutes).toFixed(3)),
    revisionMismatchesPerMin: Number((totals.revisionMismatches / uptimeMinutes).toFixed(3)),
    errorRate: Number(((totals.failed + totals.badRequest + totals.rateLimited) / totalRequests).toFixed(4)),
    retryRatio: Number((totals.idempotentReplays / totalRequests).toFixed(4)),
    successRatio: Number((totals.success / totalRequests).toFixed(4)),
  };

  const alerts = {
    highConflicts: rates.conflictsPerMin >= COMMAND_ALERT_CONFLICTS_PER_MIN_THRESHOLD,
    highErrorRate: rates.errorRate >= COMMAND_ALERT_ERROR_RATE_THRESHOLD,
    highP95Latency: commandMetrics.latencyMs.p95 >= COMMAND_ALERT_P95_LATENCY_MS_THRESHOLD,
    highRetryRatio: rates.retryRatio >= COMMAND_ALERT_RETRY_RATIO_THRESHOLD,
  };

  return {
    uptimeMs,
    windowMs: COMMAND_METRICS_RETENTION_MS,
    totals,
    byType: commandMetrics.byType,
    byErrorCode: commandMetrics.byErrorCode,
    latencyMs: commandMetrics.latencyMs,
    rates,
    thresholds: {
      conflictsPerMin: COMMAND_ALERT_CONFLICTS_PER_MIN_THRESHOLD,
      errorRate: COMMAND_ALERT_ERROR_RATE_THRESHOLD,
      p95LatencyMs: COMMAND_ALERT_P95_LATENCY_MS_THRESHOLD,
      retryRatio: COMMAND_ALERT_RETRY_RATIO_THRESHOLD,
    },
    alerts,
  };
};

const isObservabilityAuthorized = (req) => {
  const expectedKey = process.env.OPS_METRICS_KEY;
  if (!expectedKey) return false;
  const provided = req.headers['x-ops-key'];
  return typeof provided === 'string' && provided === expectedKey;
};

const maybeSendOperationalAlerts = async () => {
  if (!OPS_ALERT_WEBHOOK_URL) return;

  const snapshot = getCommandMetricsSnapshot();
  const activeAlerts = Object.entries(snapshot.alerts)
    .filter(([, isActive]) => Boolean(isActive))
    .map(([key]) => key)
    .sort();

  if (activeAlerts.length === 0) {
    alertState.lastSignature = null;
    return;
  }

  const signature = activeAlerts.join('|');
  const now = Date.now();
  if (alertState.lastSignature === signature && now - alertState.lastSentAt < OPS_ALERT_MIN_INTERVAL_MS) {
    return;
  }

  const payload = {
    source: 'iron-dune-server',
    serverTime: now,
    activeAlerts,
    rates: snapshot.rates,
    latencyMs: snapshot.latencyMs,
    thresholds: snapshot.thresholds,
    totals: snapshot.totals,
  };

  try {
    const response = await fetch(OPS_ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logWithSchema('warn', '[CommandMetrics] Failed to deliver operational alert', {
        traceId: makeTraceId('ops-alert'),
        errorCode: 'ALERT_WEBHOOK_FAILED',
        extra: {
          status: response.status,
          activeAlerts,
        },
      });
      return;
    }

    alertState.lastSignature = signature;
    alertState.lastSentAt = now;
    logWithSchema('info', '[CommandMetrics] Operational alert delivered', {
      traceId: makeTraceId('ops-alert'),
      extra: {
        activeAlerts,
      },
    });
  } catch (error) {
    logWithSchema('error', '[CommandMetrics] Operational alert delivery failed', {
      traceId: makeTraceId('ops-alert'),
      errorCode: 'ALERT_WEBHOOK_FAILED',
      extra: {
        error: normalizeServerError(error),
        activeAlerts,
      },
    });
  }
};

const requireAuthUser = createRequireAuthUser({
  supabase,
  makeTraceId,
  shortId,
  normalizeServerError,
  logWithSchema,
  calculateEmpirePointsBreakdown,
});

const getOrCreateProfileState = async (user) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('game_state, updated_at')
    .eq('id', user.id)
    .single();

  if (!error && data) {
    return {
      gameState: isNonNullObject(data.game_state) ? data.game_state : {},
      updatedAt: data.updated_at || null,
    };
  }

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const nowIso = new Date().toISOString();
  const initialState = {
    playerName: user.user_metadata?.username || 'Commander',
    playerFlag: user.user_metadata?.flag || 'US',
    revision: 0,
    lastSaveTime: Date.now(),
  };

  const { error: insertError } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      game_state: initialState,
      updated_at: nowIso,
    });

  if (insertError) throw insertError;

  return {
    gameState: initialState,
    updatedAt: nowIso,
  };
};

const loadCommandById = async (playerId, commandId) => {
  const { data, error } = await supabase
    .from('player_commands')
    .select('response_payload')
    .eq('player_id', playerId)
    .eq('command_id', commandId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data?.response_payload) return null;
  return data.response_payload;
};

const toEpochMillis = (value) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const stripCriticalDomainFromBlob = (state) => {
  if (!FREEZE_LEGACY_BLOB_CRITICAL_FIELDS || !isNonNullObject(state)) {
    return state;
  }
  const sanitized = { ...state };
  for (const key of FROZEN_BLOB_CRITICAL_FIELDS) {
    if (key in sanitized) {
      delete sanitized[key];
    }
  }
  return sanitized;
};

const isValidQueueTarget = (queueType, rawTargetType) => {
  const targetType = String(rawTargetType || '').trim();
  if (!targetType || INVALID_QUEUE_TARGETS.has(targetType.toUpperCase())) {
    return false;
  }

  if (queueType === 'BUILD') return VALID_BUILDING_TYPES.has(targetType);
  if (queueType === 'RECRUIT') return VALID_UNIT_TYPES.has(targetType);
  if (queueType === 'RESEARCH') return VALID_TECH_TYPES.has(targetType);
  return false;
};

const sanitizeStateForNormalizedSync = (state) => {
  if (!isNonNullObject(state)) return state;

  const nextState = { ...state };

  const constructions = Array.isArray(nextState.activeConstructions)
    ? nextState.activeConstructions.filter((item) => isValidQueueTarget('BUILD', item?.buildingType))
    : [];
  nextState.activeConstructions = constructions;

  const recruitments = Array.isArray(nextState.activeRecruitments)
    ? nextState.activeRecruitments.filter((item) => isValidQueueTarget('RECRUIT', item?.unitType))
    : [];
  nextState.activeRecruitments = recruitments;

  const researchTechId = typeof nextState.activeResearch?.techId === 'string'
    ? nextState.activeResearch.techId.trim()
    : '';
  if (!isValidQueueTarget('RESEARCH', researchTechId)) {
    nextState.activeResearch = null;
  } else {
    nextState.activeResearch = {
      ...nextState.activeResearch,
      techId: researchTechId,
    };
  }

  return nextState;
};

const syncNormalizedDomain = async (playerId, state, traceId) => {
  if (!NORMALIZED_DUAL_WRITE_ENABLED) {
    return { ok: true, skipped: true };
  }

  try {
    const sanitizedState = sanitizeStateForNormalizedSync(state);

    const { error } = await supabase.rpc('sync_player_domain_from_state', {
      p_player_id: playerId,
      p_state: sanitizedState,
    });

    if (error) throw error;

    return { ok: true, skipped: false };
  } catch (error) {
    logWithSchema('error', '[NormalizedDomain] Dual-write failed', {
      traceId,
      userId: shortId(playerId),
      errorCode: 'NORMALIZED_DUAL_WRITE_FAILED',
      extra: {
        error: normalizeServerError(error),
      },
    });

    if (NORMALIZED_DUAL_WRITE_STRICT) {
      throw error;
    }

    return {
      ok: false,
      skipped: false,
      warning: 'normalized_dual_write_failed',
    };
  }
};

const loadNormalizedStatePatch = async (playerId) => {
  const [buildingsRes, unitsRes, techRes, queuesRes, progressRes] = await Promise.all([
    supabase.from('player_buildings').select('building_type, level, is_damaged').eq('player_id', playerId),
    supabase.from('player_units').select('unit_type, count').eq('player_id', playerId),
    supabase.from('player_tech').select('tech_type, level').eq('player_id', playerId),
    supabase.from('player_queues').select('id, queue_type, target_type, target_id, count, start_time, end_time, status').eq('player_id', playerId).eq('status', 'ACTIVE').order('end_time', { ascending: true }),
    supabase.from('player_progress').select('campaign_progress, empire_points, last_save_time').eq('player_id', playerId).maybeSingle(),
  ]);

  const failures = [buildingsRes, unitsRes, techRes, queuesRes, progressRes].filter((result) => result.error);
  if (failures.length > 0) {
    throw failures[0].error;
  }

  const hasAnyNormalizedData =
    (buildingsRes.data?.length || 0) > 0
    || (unitsRes.data?.length || 0) > 0
    || (techRes.data?.length || 0) > 0
    || (queuesRes.data?.length || 0) > 0
    || Boolean(progressRes.data);

  if (!hasAnyNormalizedData) {
    return null;
  }

  const buildings = {};
  for (const row of buildingsRes.data || []) {
    buildings[row.building_type] = {
      level: Number(row.level || 0),
      isDamaged: Boolean(row.is_damaged),
    };
  }

  const units = {};
  for (const row of unitsRes.data || []) {
    units[row.unit_type] = Number(row.count || 0);
  }

  const techLevels = {};
  const researchedTechs = [];
  for (const row of techRes.data || []) {
    techLevels[row.tech_type] = Number(row.level || 1);
    researchedTechs.push(row.tech_type);
  }

  const activeConstructions = [];
  const activeRecruitments = [];
  let activeResearch = null;

  for (const row of queuesRes.data || []) {
    const targetType = String(row.target_type || '').trim();
    if (!isValidQueueTarget(row.queue_type, targetType)) {
      continue;
    }

    const startTime = toEpochMillis(row.start_time);
    const endTime = toEpochMillis(row.end_time);
    if (
      !Number.isFinite(startTime)
      || !Number.isFinite(endTime)
      || startTime >= MAX_QUEUE_TIMESTAMP_MS
      || endTime >= MAX_QUEUE_TIMESTAMP_MS
      || endTime < startTime
    ) {
      throw new Error('NORMALIZED_QUEUE_TIME_INVALID');
    }

    if (row.queue_type === 'BUILD') {
      activeConstructions.push({
        id: row.id,
        buildingType: targetType,
        count: Number(row.count || 1),
        startTime,
        endTime,
      });
      continue;
    }

    if (row.queue_type === 'RECRUIT') {
      activeRecruitments.push({
        id: row.id,
        unitType: targetType,
        count: Number(row.count || 1),
        startTime,
        endTime,
      });
      continue;
    }

    if (row.queue_type === 'RESEARCH') {
      activeResearch = {
        techId: targetType,
        startTime,
        endTime,
      };
    }
  }

  return {
    buildings,
    units,
    techLevels,
    researchedTechs,
    activeConstructions,
    activeRecruitments,
    activeResearch,
    campaignProgress: Number(progressRes.data?.campaign_progress || 1),
    empirePoints: Number(progressRes.data?.empire_points || 0),
    lastSaveTime: Number(progressRes.data?.last_save_time || 0),
  };
};

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 25000,
  pingTimeout: 20000,
});

const userStateRealtime = createUserStateRealtime({
  io,
  supabase,
  makeTraceId,
  normalizeServerError,
});
const globalPresence = createGlobalPresence({
  io,
  supabase,
  makeTraceId,
  normalizeServerError,
});
const { emitUserStateChanged } = userStateRealtime;

// --- API ENDPOINTS ---

app.get('/health', (_req, res) => {
  try {
    const rooms = io.sockets.adapter.rooms;
    const playerCount = io.sockets.sockets.size;
    res.json({ status: 'ok', players: playerCount, rooms: rooms.size });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.get('/api/time', (_req, res) => {
  res.json({ serverTime: Date.now() });
});

registerCommandRoutes(app, {
  requireAuthUser,
  makeTraceId,
  shortId,
  observeCommandEvent,
  COMMAND_RATE_WINDOW_MS,
  COMMAND_RATE_MAX_REQUESTS,
  logWithSchema,
  isObservabilityAuthorized,
  getCommandMetricsSnapshot,
  isLikelyUuid,
  COMMAND_TYPES,
  validateCommandPayload,
  isNonNullObject,
  loadCommandById,
  supabase,
  parseRevision,
  getOrCreateProfileState,
  sanitizeStatePatch,
  patchAllowList: PATCH_ALLOW_LIST,
  normalizedReadsEnabled: NORMALIZED_READS_ENABLED,
  loadNormalizedStatePatch,
  stripCriticalDomainFromBlob,
  normalizeLifecycleState,
  resolveLifecycleCompletions,
  AUTHORITATIVE_QUEUE_COMMANDS,
  AUTHORITATIVE_SPEEDUP_TYPES,
  buildAuthoritativeCommandResult,
  buildAuthoritativeTutorialCommandResult,
  validateResourceDeduction,
  addResources,
  getOrCreatePlayerResources,
  ResourceType,
  syncNormalizedDomain,
  buildServerStatePatch,
  emitUserStateChanged,
  normalizeServerError,
  logWithSchema,
  calculateEmpirePointsBreakdown,
});

registerBootstrapRoutes(app, {
  requireAuthUser,
  makeTraceId,
  supabase,
  getOrCreatePlayerResources,
  isNonNullObject,
  parseRevision,
  ResourceType,
  resolveLifecycleCompletions,
  syncNormalizedDomain,
  emitUserStateChanged,
  normalizedReadsEnabled: NORMALIZED_READS_ENABLED,
  loadNormalizedStatePatch,
  shortId,
  normalizeServerError,
  logWithSchema,
  calculateEmpirePointsBreakdown,
});

registerProfileRoutes(app, {
  requireAuthUser,
  makeTraceId,
  shortId,
  supabase,
  getOrCreatePlayerResources,
  NORMALIZED_READS_ENABLED,
  isNonNullObject,
  loadNormalizedStatePatch,
  normalizeServerError,
});

registerResourceRoutes(app, {
  requireAuthUser,
  makeTraceId,
  DISABLE_LEGACY_SAVE_BLOB,
  validateResourceDeduction,
  addResources,
  emitUserStateChanged,
});

registerDevToolsRoutes(app, {
  requireAuthUser,
  makeTraceId,
  supabase,
  getOrCreatePlayerResources,
  parseRevision,
  resolveLifecycleCompletions,
  syncNormalizedDomain,
  emitUserStateChanged,
  getCommandMetricsSnapshot,
  io,
  normalizeRole,
});

app.post('/api/battle/simulate-combat', requireAuthUser, (req, res) => {
    try {
        const { attackerUnits, defenderUnits, terrainModifier } = req.body;
        const result = simulateCombat(attackerUnits, defenderUnits, terrainModifier || 1.0);
        res.json(result);
    } catch (error) {
        console.error('[BattleServer] Simulation error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/battle/process-queue', requireAuthUser, (req, res) => {
    try {
        const { state, now } = req.body;
        if (!state) return res.status(400).json({ error: 'Missing state' });
        const result = processAttackQueue(state, now || Date.now());
        res.json(result);
    } catch (error) {
        console.error('[BattleServer] Error processing queue:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/battle/war-tick', requireAuthUser, (req, res) => {
    try {
        const { state, now } = req.body;
        if (!state) return res.status(400).json({ error: 'Missing state' });
        const result = processWarTick(state, now || Date.now());
        res.json(result);
    } catch (error) {
        console.error('[BattleServer] Error processing war tick:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/battle/enemy-attack-check', requireAuthUser, (req, res) => {
    try {
        const { state, now } = req.body;
        if (!state) return res.status(400).json({ error: 'Missing state' });
        const result = processEnemyAttackCheck(state, now || Date.now());
        res.json(result);
    } catch (error) {
        console.error('[BattleServer] Error processing enemy attack check:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/battle/nemesis-tick', requireAuthUser, (req, res) => {
    try {
        const { state, now } = req.body;
        if (!state) return res.status(400).json({ error: 'Missing state' });
        
        const result = processNemesisTick(state, now || Date.now());
        res.json(result);
    } catch (error) {
        console.error('[BattleServer] Error processing nemesis tick:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/salvage/global', async (req, res) => {
    try {
        const { data: loot, error } = await supabase
            .from('logistic_loot')
            .select('*')
            .gt('expires_at', new Date().toISOString())
            .gt('total_value', 0)
            .order('expires_at', { ascending: true });
            
        if (error) throw error;

        const mappedLoot = loot.map(l => ({
            id: l.id,
            battleId: l.battle_id,
            origin: l.origin,
            resources: l.resources,
            attackerName: l.attacker_name,
            defenderName: l.defender_name,
            expiresAt: new Date(l.expires_at).getTime(),
            isPartiallyHarvested: l.is_partially_harvested,
            totalValue: l.total_value,
            harvestCount: l.harvest_count
        }));

        res.json(mappedLoot);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/bots/global', async (req, res) => {
    try {
        const { data: bots, error } = await supabase
            .from('game_bots')
            .select('*');
        
        if (error) throw error;
        res.json(bots);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/rankings/players', async (req, res) => {
    try {
        const [
            { data: progressRows, error: progressError },
            { data: buildingRows, error: buildingError },
            { data: unitRows, error: unitError },
            { data: techRows, error: techError }
        ] = await Promise.all([
            supabase.from('player_progress').select('player_id, campaign_progress'),
            supabase.from('player_buildings').select('player_id, level'),
            supabase.from('player_units').select('player_id, count'),
            supabase.from('player_tech').select('player_id, level')
        ]);

        if (progressError) throw progressError;
        if (buildingError) throw buildingError;
        if (unitError) throw unitError;
        if (techError) throw techError;

        const campaignMap = new Map((progressRows || []).map(row => [row.player_id, Number(row.campaign_progress || 1)]));
        const economyMap = new Map();
        const militaryMap = new Map();
        const techMap = new Map();

        for (const row of buildingRows || []) {
            const current = economyMap.get(row.player_id) || 0;
            economyMap.set(row.player_id, current + (Number(row.level || 0) * 120));
        }

        for (const row of unitRows || []) {
            const current = militaryMap.get(row.player_id) || 0;
            militaryMap.set(row.player_id, current + Number(row.count || 0));
        }

        for (const row of techRows || []) {
            const current = techMap.get(row.player_id) || 0;
            techMap.set(row.player_id, current + (Math.max(0, Number(row.level || 1) - 1) * 200));
        }

        const playerIds = new Set();
        for (const row of progressRows || []) playerIds.add(row.player_id);
        for (const row of buildingRows || []) playerIds.add(row.player_id);
        for (const row of unitRows || []) playerIds.add(row.player_id);
        for (const row of techRows || []) playerIds.add(row.player_id);

        const displayMeta = await loadRankingDisplayMeta([...playerIds]);

        const results = [...playerIds].map((playerId) => {
            const campaignProgress = Math.max(1, Number(campaignMap.get(playerId) || 1));
            const campaignScore = Math.max(0, (campaignProgress - 1) * 500);
            const economyScore = Math.max(0, Math.floor(Number(economyMap.get(playerId) || 0)));
            const militaryScore = Math.max(0, Math.floor(Number(militaryMap.get(playerId) || 0)));
            const techScore = Math.max(0, Math.floor(Number(techMap.get(playerId) || 0)));
            const empirePoints = economyScore + militaryScore + techScore + campaignScore;
            const publicMeta = displayMeta.get(playerId) || {};

            return {
                id: playerId,
                name: publicMeta.playerName || 'Commander',
                flag: publicMeta.playerFlag || 'US',
                score: empirePoints,
                stats: {
                    DOMINION: empirePoints,
                    MILITARY: militaryScore,
                    ECONOMY: economyScore,
                    CAMPAIGN: campaignScore,
                },
                role: normalizeRole(publicMeta.role),
            };
        });

        results.sort((a, b) => b.score - a.score);

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SOCKET.IO LOGIC ---

io.on('connection', (socket) => {
  const connectionState = {
    playerId: null,
    authUserId: null,
  };

  userStateRealtime.registerSocketHandlers(socket, connectionState);
  globalPresence.registerSocketHandlers(socket, connectionState);
});

const PORT = process.env.PORT || 10000;

// Run hard reset if requested via environment variable
await hardResetDatabase();
await ensureProfilesForAuthUsers();
setInterval(ensureProfilesForAuthUsers, PROFILE_SYNC_INTERVAL_MS);
setInterval(() => {
  console.log('[CommandMetrics] Snapshot', getCommandMetricsSnapshot());
  void maybeSendOperationalAlerts();
}, COMMAND_METRICS_LOG_INTERVAL_MS);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[BattleServer] Running on port ${PORT}`);
  console.log(`[BattleServer] Health check: http://localhost:${PORT}/health`);
  console.log('[BattleServer] Feature flags', {
    FF_DUAL_WRITE_NORMALIZED: NORMALIZED_DUAL_WRITE_ENABLED,
    FF_NORMALIZED_READS: NORMALIZED_READS_ENABLED,
    FF_DUAL_WRITE_STRICT: NORMALIZED_DUAL_WRITE_STRICT,
    FF_DISABLE_LEGACY_SAVE_BLOB: DISABLE_LEGACY_SAVE_BLOB,
    FF_FREEZE_LEGACY_BLOB_FIELDS: FREEZE_LEGACY_BLOB_CRITICAL_FIELDS,
    OPS_ALERT_WEBHOOK_CONFIGURED: Boolean(OPS_ALERT_WEBHOOK_URL),
  });
    if (process.env.DISABLE_SCHEDULER !== 'true') {
        startScheduler();
        startProductionLoop();
    } else {
        console.log('[BattleServer] Scheduler disabled via DISABLE_SCHEDULER=true');
    }
});

function normalizeRole(role) {
  if (!role || typeof role !== 'string') return DEFAULT_ROLE;
  const normalized = role.trim();
  if (!normalized) return DEFAULT_ROLE;
  const match = ROLE_PRIORITY.find(r => r.toLowerCase() === normalized.toLowerCase());
  return match || DEFAULT_ROLE;
}

async function loadRankingDisplayMeta(playerIds) {
  const result = new Map();
  const pending = new Set((playerIds || []).filter((id) => typeof id === 'string' && id));

  if (pending.size === 0) return result;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return result;
  }

  let page = 1;
  let hasMore = true;

  while (hasMore && pending.size > 0) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.warn('[Rankings] Failed to load auth user metadata:', error.message);
      return result;
    }

    const users = data?.users || [];
    if (users.length === 0) {
      hasMore = false;
      continue;
    }

    for (const user of users) {
      if (!pending.has(user.id)) continue;
      result.set(user.id, {
        playerName: user.user_metadata?.username || 'Commander',
        playerFlag: user.user_metadata?.flag || 'US',
        role: user.app_metadata?.role || user.user_metadata?.role || DEFAULT_ROLE,
      });
      pending.delete(user.id);
    }

    page += 1;
  }

  return result;
}

async function ensureProfilesForAuthUsers() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[Profile Sync] SUPABASE_SERVICE_ROLE_KEY missing. Skipping profile sync.');
    return;
  }

  console.log('[Profile Sync] Ensuring profiles for all auth users...');

  let page = 1;
  let hasMore = true;

  const { data: metaData, error: metaError } = await supabase
    .from('server_metadata')
    .select('value')
    .eq('key', 'last_reset_id')
    .single();

  if (metaError) {
    console.warn('[Profile Sync] Failed to load last_reset_id:', metaError.message);
  }

  const lastResetId = metaData?.value;

  while (hasMore) {
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000
    });

    if (listError) {
      console.error('[Profile Sync] Failed to list auth users:', listError.message);
      return;
    }

    if (!users || users.length === 0) {
      hasMore = false;
      continue;
    }

    const ids = users.map(user => user.id);
    const { data: existingProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', ids);

    if (profilesError) {
      console.error('[Profile Sync] Failed to load profiles:', profilesError.message);
      return;
    }

    const existingMap = new Map((existingProfiles || []).map(p => [p.id, p]));
    const now = new Date().toISOString();

    const inserts = [];
    const resourceInserts = [];
    const roleUpdates = [];

    for (const user of users) {
      const existing = existingMap.get(user.id);
      const roleFromUser = normalizeRole(user.app_metadata?.role || user.user_metadata?.role);

      if (!existing) {
        const username = user.user_metadata?.username || 'Commander';
        const flag = user.user_metadata?.flag || 'US';
        inserts.push({
          id: user.id,
          role: roleFromUser,
          game_state: {
            playerName: username,
            playerFlag: flag,
            lastResetId,
            lastSaveTime: Date.now()
          },
          updated_at: now
        });
        resourceInserts.push({
          player_id: user.id,
          money: 5000,
          oil: 2500,
          ammo: 1500,
          gold: 500,
          diamond: 5,
          bank_balance: 0,
          interest_rate: 0.15,
          next_rate_change: Date.now() + (24 * 60 * 60 * 1000),
          last_tick_at: now,
          updated_at: now,
        });
      } else if (!existing.role) {
        roleUpdates.push({ id: user.id, role: roleFromUser });
      }
    }

    if (inserts.length > 0) {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert(inserts);
      if (insertError) {
        if (insertError.message?.toLowerCase().includes(SCHEMA_CACHE_ERROR)) {
          await insertProfilesViaSql(inserts);
        } else {
          console.error('[Profile Sync] Failed to insert profiles:', insertError.message);
        }
      }
    }

    if (resourceInserts.length > 0) {
      const { error: resourceInsertError } = await supabase
        .from('player_resources')
        .upsert(resourceInserts, { onConflict: 'player_id' });

      if (resourceInsertError) {
        console.error('[Profile Sync] Failed to create player resources:', resourceInsertError.message);
      }
    }

    if (roleUpdates.length > 0) {
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(roleUpdates, { onConflict: 'id' });
      if (updateError) {
        if (updateError.message?.toLowerCase().includes(SCHEMA_CACHE_ERROR)) {
          await updateRolesViaSql(roleUpdates);
        } else {
          console.error('[Profile Sync] Failed to update roles:', updateError.message);
        }
      }
    }

    page += 1;
  }
}

const escapeSql = (value) => String(value).replace(/'/g, "''");

async function insertProfilesViaSql(profiles) {
  try {
    const values = profiles.map(profile => {
      const gameStateJson = JSON.stringify(profile.game_state || {}).replace(/'/g, "''");
      return `('${escapeSql(profile.id)}', '${escapeSql(profile.role || DEFAULT_ROLE)}', '${gameStateJson}'::jsonb, '${escapeSql(profile.updated_at)}')`;
    });

    if (values.length === 0) return;

    const sql = `
      INSERT INTO public.profiles (id, role, game_state, updated_at)
      VALUES ${values.join(',')}
      ON CONFLICT (id)
      DO UPDATE SET role = EXCLUDED.role, game_state = EXCLUDED.game_state, updated_at = EXCLUDED.updated_at;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error('[Profile Sync] Failed SQL insert:', error.message);
    }
  } catch (error) {
    console.error('[Profile Sync] Failed SQL insert:', error.message);
  }
}

async function updateRolesViaSql(roleUpdates) {
  try {
    if (roleUpdates.length === 0) return;

    const ids = roleUpdates.map(row => `'${escapeSql(row.id)}'`).join(',');
    const cases = roleUpdates
      .map(row => `WHEN '${escapeSql(row.id)}' THEN '${escapeSql(row.role || DEFAULT_ROLE)}'`)
      .join(' ');

    const sql = `
      UPDATE public.profiles
      SET role = CASE id ${cases} ELSE role END
      WHERE id IN (${ids});
    `;

    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error('[Profile Sync] Failed SQL role update:', error.message);
    }
  } catch (error) {
    console.error('[Profile Sync] Failed SQL role update:', error.message);
  }
}
