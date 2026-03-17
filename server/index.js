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
import { ResourceType } from './engine/enums.js';

const DEFAULT_ROLE = 'Usuario';
const ROLE_PRIORITY = ['Dev', 'Admin', 'Moderador', 'Premium', 'Usuario'];
const PROFILE_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const SCHEMA_CACHE_ERROR = "schema cache";
const SERVER_MANAGED_FIELDS = ['resources', 'maxResources', 'bankBalance', 'currentInterestRate', 'nextRateChangeTime', 'lastInterestPayoutTime'];
const NORMALIZED_DUAL_WRITE_ENABLED = process.env.FF_DUAL_WRITE_NORMALIZED !== 'false';
const NORMALIZED_READS_ENABLED = process.env.FF_NORMALIZED_READS === 'true';
const NORMALIZED_DUAL_WRITE_STRICT = process.env.FF_DUAL_WRITE_STRICT === 'true';
const COMMAND_TYPES = new Set([
  'BUILD_START',
  'BUILD_REPAIR',
  'RECRUIT_START',
  'RESEARCH_START',
  'SPEEDUP',
  'TRADE_EXECUTE',
  'DIAMOND_EXCHANGE',
  'ESPIONAGE_START',
  'BANK_DEPOSIT',
  'BANK_WITHDRAW',
  'TUTORIAL_CLAIM_REWARD',
  'GIFT_CODE_REDEEM',
  'DIPLOMACY_GIFT',
  'DIPLOMACY_PROPOSE_ALLIANCE',
  'DIPLOMACY_PROPOSE_PEACE',
]);
const RESOURCE_KEYS = new Set(Object.values(ResourceType));
const PATCH_ALLOW_LIST = new Set([
  'buildings',
  'units',
  'activeConstructions',
  'activeRecruitments',
  'activeResearch',
  'techLevels',
  'researchedTechs',
  'marketOffers',
  'marketNextRefreshTime',
  'activeMarketEvent',
  'spyReports',
  'empirePoints',
  'logs',
  'rankingData',
  'diplomaticActions',
  'redeemedGiftCodes',
  'giftCodeCooldowns',
  'completedTutorials',
  'currentTutorialId',
  'tutorialClaimable',
  'tutorialAccepted',
  'isTutorialMinimized',
]);
const COMMAND_RATE_WINDOW_MS = Number(process.env.COMMAND_RATE_WINDOW_MS || 60_000);
const COMMAND_RATE_MAX_REQUESTS = Number(process.env.COMMAND_RATE_MAX_REQUESTS || 120);
const COMMAND_METRICS_LOG_INTERVAL_MS = Number(process.env.COMMAND_METRICS_LOG_INTERVAL_MS || 60_000);
const COMMAND_METRICS_RETENTION_MS = Number(process.env.COMMAND_METRICS_RETENTION_MS || 15 * 60_000);
const COMMAND_ALERT_CONFLICTS_PER_MIN_THRESHOLD = Number(process.env.COMMAND_ALERT_CONFLICTS_PER_MIN_THRESHOLD || 5);
const COMMAND_ALERT_ERROR_RATE_THRESHOLD = Number(process.env.COMMAND_ALERT_ERROR_RATE_THRESHOLD || 0.05);
const COMMAND_ALERT_P95_LATENCY_MS_THRESHOLD = Number(process.env.COMMAND_ALERT_P95_LATENCY_MS_THRESHOLD || 750);
const COMMAND_ALERT_RETRY_RATIO_THRESHOLD = Number(process.env.COMMAND_ALERT_RETRY_RATIO_THRESHOLD || 0.2);
const commandRateTracker = new Map();
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

dotenv.config();

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

const makeTraceId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const shortId = (value) => {
  if (!value || typeof value !== 'string') return null;
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};
const normalizeServerError = (error) => {
  if (!error) return { message: 'Unknown error' };
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      status: error.status,
    };
  }
  if (typeof error === 'object') return error;
  return { message: String(error) };
};

const isNonNullObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseRevision = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric);
};

const isLikelyUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const sanitizeStatePatch = (patch) => {
  if (!isNonNullObject(patch)) return {};
  const sanitized = {};

  Object.entries(patch).forEach(([key, value]) => {
    if (!PATCH_ALLOW_LIST.has(key)) return;
    sanitized[key] = value;
  });

  return sanitized;
};

const validateNumericMap = (value) => {
  if (!isNonNullObject(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > RESOURCE_KEYS.size) return false;
  for (const [key, amount] of entries) {
    if (!RESOURCE_KEYS.has(key)) return false;
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric < 0) return false;
  }
  return true;
};

const hasNonEmptyObject = (value) => isNonNullObject(value) && Object.keys(value).length > 0;

const hasAnyStatePatchKeys = (payload, requiredKeys) => {
  if (!isNonNullObject(payload.statePatch)) return false;
  return requiredKeys.some((key) => Object.prototype.hasOwnProperty.call(payload.statePatch, key));
};

const commandSemanticValidators = {
  BUILD_START: (payload) => hasAnyStatePatchKeys(payload, ['activeConstructions', 'buildings']),
  BUILD_REPAIR: (payload) => hasAnyStatePatchKeys(payload, ['buildings']),
  RECRUIT_START: (payload) => hasAnyStatePatchKeys(payload, ['activeRecruitments', 'units']),
  RESEARCH_START: (payload) => hasAnyStatePatchKeys(payload, ['activeResearch', 'techLevels', 'researchedTechs']),
  SPEEDUP: (payload) => hasAnyStatePatchKeys(payload, ['activeConstructions', 'activeRecruitments', 'activeResearch']),
  TRADE_EXECUTE: (payload) => hasAnyStatePatchKeys(payload, ['marketOffers', 'marketNextRefreshTime', 'activeMarketEvent', 'logs']),
  DIAMOND_EXCHANGE: (payload) => hasNonEmptyObject(payload.costs) && hasNonEmptyObject(payload.gains),
  ESPIONAGE_START: (payload) => hasAnyStatePatchKeys(payload, ['spyReports']),
  BANK_DEPOSIT: (payload) => hasNonEmptyObject(payload.costs) && !hasNonEmptyObject(payload.gains),
  BANK_WITHDRAW: (payload) => hasNonEmptyObject(payload.gains) && !hasNonEmptyObject(payload.costs),
  TUTORIAL_CLAIM_REWARD: (payload) => hasAnyStatePatchKeys(payload, ['completedTutorials', 'tutorialClaimable', 'currentTutorialId']),
  GIFT_CODE_REDEEM: (payload) => hasAnyStatePatchKeys(payload, ['redeemedGiftCodes', 'giftCodeCooldowns']),
  DIPLOMACY_GIFT: (payload) => hasAnyStatePatchKeys(payload, ['diplomaticActions', 'rankingData']),
  DIPLOMACY_PROPOSE_ALLIANCE: (payload) => hasAnyStatePatchKeys(payload, ['diplomaticActions', 'rankingData']),
  DIPLOMACY_PROPOSE_PEACE: (payload) => hasAnyStatePatchKeys(payload, ['diplomaticActions', 'rankingData']),
};

const validateCommandPayload = (type, payload) => {
  if (!isNonNullObject(payload)) {
    return { ok: false, errorCode: 'INVALID_PAYLOAD', message: 'Payload must be an object' };
  }

  const keys = Object.keys(payload);
  if (keys.length > 8) {
    return { ok: false, errorCode: 'INVALID_PAYLOAD', message: 'Payload has too many keys' };
  }

  const allowedKeys = new Set(['costs', 'gains', 'statePatch']);
  for (const key of keys) {
    if (!allowedKeys.has(key)) {
      return { ok: false, errorCode: 'INVALID_PAYLOAD_KEY', message: `Unsupported payload key: ${key}` };
    }
  }

  if (payload.costs !== undefined && !validateNumericMap(payload.costs)) {
    return { ok: false, errorCode: 'INVALID_PAYLOAD_COSTS', message: 'Payload costs are invalid' };
  }

  if (payload.gains !== undefined && !validateNumericMap(payload.gains)) {
    return { ok: false, errorCode: 'INVALID_PAYLOAD_GAINS', message: 'Payload gains are invalid' };
  }

  if (payload.statePatch !== undefined && !isNonNullObject(payload.statePatch)) {
    return { ok: false, errorCode: 'INVALID_STATE_PATCH', message: 'statePatch must be an object' };
  }

  if (isNonNullObject(payload.statePatch)) {
    const patchKeys = Object.keys(payload.statePatch);
    if (patchKeys.length > PATCH_ALLOW_LIST.size) {
      return { ok: false, errorCode: 'INVALID_STATE_PATCH', message: 'statePatch has too many keys' };
    }
    for (const key of patchKeys) {
      if (!PATCH_ALLOW_LIST.has(key)) {
        return { ok: false, errorCode: 'INVALID_STATE_PATCH_KEY', message: `Unsupported statePatch key: ${key}` };
      }
    }
  }

  if (!hasNonEmptyObject(payload.costs) && !hasNonEmptyObject(payload.gains) && !hasNonEmptyObject(payload.statePatch)) {
    return { ok: false, errorCode: 'EMPTY_COMMAND_PAYLOAD', message: 'Command payload is empty' };
  }

  if ((type === 'BANK_DEPOSIT' || type === 'BANK_WITHDRAW') && !hasNonEmptyObject(payload.costs) && !hasNonEmptyObject(payload.gains)) {
    return { ok: false, errorCode: 'INVALID_BANK_PAYLOAD', message: 'Bank commands must include costs or gains' };
  }

  const semanticValidator = commandSemanticValidators[type];
  if (typeof semanticValidator === 'function' && !semanticValidator(payload)) {
    return {
      ok: false,
      errorCode: 'INVALID_COMMAND_SEMANTICS',
      message: `Payload does not satisfy semantic rules for ${type}`,
    };
  }

  return { ok: true };
};

const classifyBootstrapError = (error) => {
  const code = error?.code || '';
  const message = String(error?.message || '').toLowerCase();

  if (code === 'PGRST301' || message.includes('timeout') || message.includes('econnreset') || message.includes('network')) {
    return {
      status: 503,
      errorCode: 'BOOTSTRAP_TRANSIENT_ERROR',
      retryable: true,
    };
  }

  return {
    status: 500,
    errorCode: 'BOOTSTRAP_TERMINAL_ERROR',
    retryable: false,
  };
};

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

const enforceCommandRateLimit = (req, res, next) => {
  const traceId = req.traceId || makeTraceId('rate-limit');
  const userKey = req.user?.id || 'anonymous';
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const bucketKey = `${userKey}:${ip}`;
  const now = Date.now();
  const current = commandRateTracker.get(bucketKey);

  if (!current || now - current.windowStart > COMMAND_RATE_WINDOW_MS) {
    commandRateTracker.set(bucketKey, { count: 1, windowStart: now });
    return next();
  }

  current.count += 1;
  if (current.count > COMMAND_RATE_MAX_REQUESTS) {
    observeCommandEvent({
      type: req.body?.type,
      result: 'rate_limited',
      errorCode: 'RATE_LIMITED',
      durationMs: 0,
    });
    console.warn('[CommandGateway] Rate limit exceeded', {
      traceId,
      userId: shortId(req.user?.id),
      ip,
      count: current.count,
      windowMs: COMMAND_RATE_WINDOW_MS,
    });
    return res.status(429).json({
      ok: false,
      error: 'Too many commands',
      errorCode: 'RATE_LIMITED',
      retryAfterMs: Math.max(0, COMMAND_RATE_WINDOW_MS - (now - current.windowStart)),
      traceId,
    });
  }

  return next();
};

const requireAuthUser = async (req, res, next) => {
  const traceId = req.traceId || makeTraceId('auth-mw');
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      console.warn('[AuthMiddleware] Missing bearer token', { traceId });
      return res.status(401).json({ error: 'Missing auth token', traceId });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      console.warn('[AuthMiddleware] Empty bearer token', { traceId });
      return res.status(401).json({ error: 'Missing auth token', traceId });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      console.warn('[AuthMiddleware] Invalid auth token', {
        traceId,
        error: normalizeServerError(error),
      });
      return res.status(401).json({ error: 'Invalid auth token', traceId });
    }

    console.log('[AuthMiddleware] Authenticated request', {
      traceId,
      userId: shortId(data.user.id),
      email: data.user.email || null,
      path: req.path,
    });
    req.user = data.user;
    return next();
  } catch (error) {
    console.error('[AuthMiddleware] Auth validation exception', {
      traceId,
      error: normalizeServerError(error),
    });
    return res.status(500).json({ error: 'Auth validation failed', traceId });
  }
};

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
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const syncNormalizedDomain = async (playerId, state, traceId) => {
  if (!NORMALIZED_DUAL_WRITE_ENABLED) {
    return { ok: true, skipped: true };
  }

  try {
    const { error } = await supabase.rpc('sync_player_domain_from_state', {
      p_player_id: playerId,
      p_state: state,
    });

    if (error) throw error;

    const normalizedSync = await syncNormalizedDomain(req.user.id, stateToSave, traceId);
    const diagnostics = [];
    if (!normalizedSync.ok && normalizedSync.warning) {
      diagnostics.push(normalizedSync.warning);
    }
    return { ok: true, skipped: false };
  } catch (error) {
    console.error('[NormalizedDomain] Dual-write failed', {
      traceId,
      playerId: shortId(playerId),
      error: normalizeServerError(error),
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
    if (row.queue_type === 'BUILD') {
      activeConstructions.push({
        id: row.id,
        buildingType: row.target_type,
        count: Number(row.count || 1),
        startTime: toEpochMillis(row.start_time),
        endTime: toEpochMillis(row.end_time),
      });
      continue;
    }

    if (row.queue_type === 'RECRUIT') {
      activeRecruitments.push({
        id: row.id,
        unitType: row.target_type,
        count: Number(row.count || 1),
        startTime: toEpochMillis(row.start_time),
        endTime: toEpochMillis(row.end_time),
      });
      continue;
    }

    if (row.queue_type === 'RESEARCH') {
      activeResearch = {
        techId: row.target_type,
        startTime: toEpochMillis(row.start_time),
        endTime: toEpochMillis(row.end_time),
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

app.get('/api/ops/command-metrics', (req, res) => {
  if (!isObservabilityAuthorized(req)) {
    return res.status(404).json({ error: 'Not found' });
  }

  return res.json({
    ok: true,
    serverTime: Date.now(),
    metrics: getCommandMetricsSnapshot(),
  });
});

app.get('/api/bootstrap', requireAuthUser, async (req, res) => {
  const traceId = req.traceId || makeTraceId('bootstrap');
  const serverTime = Date.now();

  try {
    const [metaResult, profileResult, authoritativeResources] = await Promise.all([
      supabase.from('server_metadata').select('value').eq('key', 'last_reset_id').maybeSingle(),
      supabase.from('profiles').select('game_state, updated_at').eq('id', req.user.id).maybeSingle(),
      getOrCreatePlayerResources(req.user.id),
    ]);

    if (metaResult.error) throw metaResult.error;
    if (profileResult.error && profileResult.error.code !== 'PGRST116') throw profileResult.error;

    const metaData = metaResult.data;

    const resetId = metaData?.value || null;
    const baseState = isNonNullObject(profileResult.data?.game_state) ? profileResult.data.game_state : {};
    const stateWithDefaults = {
      ...baseState,
      playerName: baseState.playerName || req.user.user_metadata?.username || 'Commander',
      playerFlag: baseState.playerFlag || req.user.user_metadata?.flag || 'US',
      revision: parseRevision(baseState.revision),
      lastSaveTime: Number(baseState.lastSaveTime || serverTime),
      lastResetId: baseState.lastResetId || resetId,
      resources: {
        [ResourceType.MONEY]: authoritativeResources.money,
        [ResourceType.OIL]: authoritativeResources.oil,
        [ResourceType.AMMO]: authoritativeResources.ammo,
        [ResourceType.GOLD]: authoritativeResources.gold,
        [ResourceType.DIAMOND]: authoritativeResources.diamond,
      },
      maxResources: {
        [ResourceType.MONEY]: authoritativeResources.money_max,
        [ResourceType.OIL]: authoritativeResources.oil_max,
        [ResourceType.AMMO]: authoritativeResources.ammo_max,
        [ResourceType.GOLD]: authoritativeResources.gold_max,
        [ResourceType.DIAMOND]: authoritativeResources.diamond_max,
      },
      bankBalance: authoritativeResources.bank_balance,
      currentInterestRate: authoritativeResources.interest_rate,
      nextRateChangeTime: authoritativeResources.next_rate_change,
    };

    const gameState = NORMALIZED_READS_ENABLED
      ? { ...stateWithDefaults, ...(await loadNormalizedStatePatch(req.user.id)) }
      : stateWithDefaults;

    return res.json({
      profile: {
        id: req.user.id,
        playerName: gameState.playerName,
        playerFlag: gameState.playerFlag,
      },
      resources: gameState.resources,
      rates: {
        moneyRate: authoritativeResources.money_rate,
        oilRate: authoritativeResources.oil_rate,
        ammoRate: authoritativeResources.ammo_rate,
        goldRate: authoritativeResources.gold_rate,
        diamondRate: authoritativeResources.diamond_rate,
      },
      buildings: gameState.buildings || {},
      units: gameState.units || {},
      tech: {
        levels: gameState.techLevels || {},
        researched: Array.isArray(gameState.researchedTechs) ? gameState.researchedTechs : [],
      },
      progress: {
        campaignProgress: Number(gameState.campaignProgress || 1),
        empirePoints: Number(gameState.empirePoints || 0),
        lastSaveTime: Number(gameState.lastSaveTime || serverTime),
      },
      queues: {
        activeConstructions: Array.isArray(gameState.activeConstructions) ? gameState.activeConstructions : [],
        activeRecruitments: Array.isArray(gameState.activeRecruitments) ? gameState.activeRecruitments : [],
        activeResearch: gameState.activeResearch || null,
      },
      metadata: {
        revision: parseRevision(gameState.revision),
        serverTime,
        resetId: gameState.lastResetId || resetId,
      },
      game_state: gameState,
      updated_at: profileResult.data?.updated_at || null,
      traceId,
    });
  } catch (error) {
    const classified = classifyBootstrapError(error);
    console.error('[BootstrapAPI] Bootstrap failed', {
      traceId,
      userId: shortId(req.user?.id),
      retryable: classified.retryable,
      errorCode: classified.errorCode,
      error: normalizeServerError(error),
    });
    return res.status(classified.status).json({
      error: error.message || 'Failed to bootstrap',
      errorCode: classified.errorCode,
      retryable: classified.retryable,
      traceId,
    });
  }
});

app.get('/api/profile', requireAuthUser, async (req, res) => {
  const traceId = req.traceId || makeTraceId('profile-load');
  try {
    console.log('[ProfileAPI] Load started', {
      traceId,
      userId: shortId(req.user.id),
    });

    const { data, error } = await supabase
      .from('profiles')
      .select('game_state, updated_at')
      .eq('id', req.user.id)
      .single();

    await getOrCreatePlayerResources(req.user.id);

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('[ProfileAPI] Load no profile found', {
          traceId,
          userId: shortId(req.user.id),
        });
        return res.status(404).json({ game_state: null, traceId });
      }
      throw error;
    }

    let responseState = data?.game_state || null;

    if (NORMALIZED_READS_ENABLED && isNonNullObject(responseState)) {
      const normalizedPatch = await loadNormalizedStatePatch(req.user.id);
      responseState = {
        ...responseState,
        ...normalizedPatch,
      };
    }

    console.log('[ProfileAPI] Load succeeded', {
      traceId,
      userId: shortId(req.user.id),
      hasState: Boolean(data?.game_state),
      updatedAt: data?.updated_at || null,
      stateKeys: data?.game_state ? Object.keys(data.game_state).length : 0,
      normalizedReads: NORMALIZED_READS_ENABLED,
    });
    return res.json({ game_state: responseState, updated_at: data?.updated_at || null, traceId });
  } catch (error) {
    console.error('[ProfileAPI] Load failed', {
      traceId,
      userId: shortId(req.user?.id),
      error: normalizeServerError(error),
    });
    return res.status(500).json({ error: error.message || 'Failed to load profile', traceId });
  }
});

app.post('/api/profile/save', requireAuthUser, async (req, res) => {
  const traceId = req.traceId || makeTraceId('profile-save');
  try {
    const gameState = req.body?.game_state;
    const expectedUpdatedAt = req.body?.expected_updated_at || null;

    console.log('[ProfileAPI] Save started', {
      traceId,
      userId: shortId(req.user.id),
      expectedUpdatedAt,
      hasGameState: Boolean(gameState),
      stateKeys: gameState ? Object.keys(gameState).length : 0,
    });

    if (!gameState) {
      return res.status(400).json({ error: 'Missing game_state', traceId });
    }

    if (expectedUpdatedAt) {
      const { data: existing, error: existingError } = await supabase
        .from('profiles')
        .select('updated_at')
        .eq('id', req.user.id)
        .single();

      if (existingError && existingError.code !== 'PGRST116') {
        throw existingError;
      }

      if (existing?.updated_at && existing.updated_at !== expectedUpdatedAt) {
        console.warn('[ProfileAPI] Save conflict', {
          traceId,
          userId: shortId(req.user.id),
          expectedUpdatedAt,
          existingUpdatedAt: existing.updated_at,
        });
        return res.status(409).json({ error: 'Profile out of date', updated_at: existing.updated_at, traceId });
      }
    }

    const serverTime = Date.now();
    const stateToSave = { ...gameState, lastSaveTime: serverTime };

    for (const field of SERVER_MANAGED_FIELDS) {
      if (field in stateToSave) {
        delete stateToSave[field];
      }
    }

    const authoritativeResources = await getOrCreatePlayerResources(req.user.id);

    if (authoritativeResources) {
      stateToSave.resources = {
        [ResourceType.MONEY]: authoritativeResources.money,
        [ResourceType.OIL]: authoritativeResources.oil,
        [ResourceType.AMMO]: authoritativeResources.ammo,
        [ResourceType.GOLD]: authoritativeResources.gold,
        [ResourceType.DIAMOND]: authoritativeResources.diamond,
      };
      stateToSave.maxResources = {
        [ResourceType.MONEY]: authoritativeResources.money_max,
        [ResourceType.OIL]: authoritativeResources.oil_max,
        [ResourceType.AMMO]: authoritativeResources.ammo_max,
        [ResourceType.GOLD]: authoritativeResources.gold_max,
        [ResourceType.DIAMOND]: authoritativeResources.diamond_max,
      };
      stateToSave.bankBalance = authoritativeResources.bank_balance;
      stateToSave.currentInterestRate = authoritativeResources.interest_rate;
      stateToSave.nextRateChangeTime = authoritativeResources.next_rate_change;
    }
    const updatedAt = new Date().toISOString();

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: req.user.id,
        game_state: stateToSave,
        updated_at: updatedAt
      });

    if (error) throw error;

    const diagnostics = [];
    const normalizedSync = await syncNormalizedDomain(req.user.id, stateToSave, traceId);
    if (!normalizedSync.ok && normalizedSync.warning) {
      diagnostics.push(normalizedSync.warning);
    }

    console.log('[ProfileAPI] Save succeeded', {
      traceId,
      userId: shortId(req.user.id),
      updatedAt,
      serverTime,
      savedStateKeys: Object.keys(stateToSave).length,
    });

    return res.json({ ok: true, serverTime, updated_at: updatedAt, diagnostics, traceId });
  } catch (error) {
    console.error('[ProfileAPI] Save failed', {
      traceId,
      userId: shortId(req.user?.id),
      error: normalizeServerError(error),
    });
    return res.status(500).json({ error: error.message || 'Failed to save profile', traceId });
  }
});

app.post('/api/resources/deduct', requireAuthUser, async (req, res) => {
  const traceId = req.traceId || makeTraceId('resource-deduct');
  try {
    const costs = req.body?.costs || {};
    const result = await validateResourceDeduction(req.user.id, costs);
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.reason || 'insufficient_funds', resource: result.resource, traceId });
    }
    return res.json({ ok: true, resources: result.resources, traceId });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Failed to deduct resources', traceId });
  }
});

app.post('/api/resources/add', requireAuthUser, async (req, res) => {
  const traceId = req.traceId || makeTraceId('resource-add');
  try {
    const gains = req.body?.gains || {};
    const result = await addResources(req.user.id, gains);
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.reason || 'add_failed', traceId });
    }
    return res.json({ ok: true, resources: result.resources, traceId });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Failed to add resources', traceId });
  }
});

app.post('/api/command', requireAuthUser, enforceCommandRateLimit, async (req, res) => {
  const traceId = req.traceId || makeTraceId('command');
  const serverTime = Date.now();
  const commandStartedAt = Date.now();

  try {
    const commandId = req.body?.commandId;
    const type = req.body?.type;
    const payload = isNonNullObject(req.body?.payload) ? req.body.payload : {};
    const expectedRevision = req.body?.expectedRevision;

    if (!isLikelyUuid(commandId)) {
      observeCommandEvent({ type, result: 'bad_request', errorCode: 'INVALID_COMMAND_ID', durationMs: Date.now() - commandStartedAt });
      return res.status(400).json({
        ok: false,
        error: 'Invalid commandId',
        errorCode: 'INVALID_COMMAND_ID',
        traceId,
      });
    }

    if (!COMMAND_TYPES.has(type)) {
      observeCommandEvent({ type, result: 'bad_request', errorCode: 'UNSUPPORTED_COMMAND_TYPE', durationMs: Date.now() - commandStartedAt });
      return res.status(400).json({
        ok: false,
        error: 'Unsupported command type',
        errorCode: 'UNSUPPORTED_COMMAND_TYPE',
        traceId,
      });
    }

    if (!Number.isFinite(Number(expectedRevision))) {
      observeCommandEvent({ type, result: 'bad_request', errorCode: 'INVALID_EXPECTED_REVISION', durationMs: Date.now() - commandStartedAt });
      return res.status(400).json({
        ok: false,
        error: 'Invalid expectedRevision',
        errorCode: 'INVALID_EXPECTED_REVISION',
        traceId,
      });
    }

    const payloadValidation = validateCommandPayload(type, payload);
    if (!payloadValidation.ok) {
      observeCommandEvent({ type, result: 'bad_request', errorCode: payloadValidation.errorCode, durationMs: Date.now() - commandStartedAt });
      return res.status(400).json({
        ok: false,
        error: payloadValidation.message,
        errorCode: payloadValidation.errorCode,
        traceId,
      });
    }

    const previousResponse = await loadCommandById(req.user.id, commandId);
    if (previousResponse && Object.keys(previousResponse).length > 0) {
      observeCommandEvent({
        type,
        result: previousResponse.ok ? 'success' : 'failed',
        errorCode: previousResponse.errorCode || null,
        durationMs: Date.now() - commandStartedAt,
        idempotentReplay: true,
      });
      return res.json(previousResponse);
    }

    const { error: commandReservationError } = await supabase
      .from('player_commands')
      .insert({
        player_id: req.user.id,
        command_id: commandId,
        command_type: type,
        expected_revision: parseRevision(expectedRevision),
        payload,
        response_payload: {},
      });

    if (commandReservationError) {
      if (commandReservationError.code === '23505') {
        const racedResponse = await loadCommandById(req.user.id, commandId);
        if (racedResponse && Object.keys(racedResponse).length > 0) {
          observeCommandEvent({
            type,
            result: racedResponse.ok ? 'success' : 'failed',
            errorCode: racedResponse.errorCode || null,
            durationMs: Date.now() - commandStartedAt,
            idempotentReplay: true,
          });
          return res.json(racedResponse);
        }
        observeCommandEvent({
          type,
          result: 'conflict',
          errorCode: 'COMMAND_IN_PROGRESS',
          durationMs: Date.now() - commandStartedAt,
          inProgressCollision: true,
        });
        return res.status(409).json({
          ok: false,
          error: 'Command already in progress',
          errorCode: 'COMMAND_IN_PROGRESS',
          traceId,
        });
      }
      throw commandReservationError;
    }

    const profile = await getOrCreateProfileState(req.user);
    const currentRevision = parseRevision(profile.gameState?.revision);
    const nextRevision = currentRevision + 1;

    if (currentRevision !== parseRevision(expectedRevision)) {
      console.warn('[CommandGateway] Revision mismatch', {
        traceId,
        userId: shortId(req.user.id),
        commandId,
        commandType: type,
        expectedRevision,
        currentRevision,
      });
      observeCommandEvent({
        type,
        result: 'conflict',
        errorCode: 'REVISION_MISMATCH',
        durationMs: Date.now() - commandStartedAt,
        revisionMismatch: true,
      });
      return res.status(409).json({
        ok: false,
        error: 'Revision mismatch',
        errorCode: 'REVISION_MISMATCH',
        expectedRevision: parseRevision(expectedRevision),
        currentRevision,
        traceId,
      });
    }

    const costs = isNonNullObject(payload.costs) ? payload.costs : {};
    const gains = isNonNullObject(payload.gains) ? payload.gains : {};
    const statePatch = sanitizeStatePatch(payload.statePatch);
    const diagnostics = [];

    if (Object.keys(costs).length > 0) {
      const deduction = await validateResourceDeduction(req.user.id, costs);
      if (!deduction.ok) {
        observeCommandEvent({
          type,
          result: 'bad_request',
          errorCode: 'INSUFFICIENT_FUNDS',
          durationMs: Date.now() - commandStartedAt,
        });
        return res.status(400).json({
          ok: false,
          error: deduction.reason || 'insufficient_funds',
          errorCode: 'INSUFFICIENT_FUNDS',
          resource: deduction.resource || null,
          traceId,
        });
      }
    }

    if (Object.keys(gains).length > 0) {
      const addition = await addResources(req.user.id, gains);
      if (!addition.ok) {
        observeCommandEvent({
          type,
          result: 'bad_request',
          errorCode: 'RESOURCE_ADD_FAILED',
          durationMs: Date.now() - commandStartedAt,
        });
        return res.status(400).json({
          ok: false,
          error: addition.reason || 'add_failed',
          errorCode: 'RESOURCE_ADD_FAILED',
          traceId,
        });
      }
    }

    const authoritativeResources = await getOrCreatePlayerResources(req.user.id);
    const nextState = {
      ...profile.gameState,
      ...statePatch,
      revision: nextRevision,
      lastSaveTime: serverTime,
      resources: {
        [ResourceType.MONEY]: authoritativeResources.money,
        [ResourceType.OIL]: authoritativeResources.oil,
        [ResourceType.AMMO]: authoritativeResources.ammo,
        [ResourceType.GOLD]: authoritativeResources.gold,
        [ResourceType.DIAMOND]: authoritativeResources.diamond,
      },
      maxResources: {
        [ResourceType.MONEY]: authoritativeResources.money_max,
        [ResourceType.OIL]: authoritativeResources.oil_max,
        [ResourceType.AMMO]: authoritativeResources.ammo_max,
        [ResourceType.GOLD]: authoritativeResources.gold_max,
        [ResourceType.DIAMOND]: authoritativeResources.diamond_max,
      },
      bankBalance: authoritativeResources.bank_balance,
      currentInterestRate: authoritativeResources.interest_rate,
      nextRateChangeTime: authoritativeResources.next_rate_change,
    };

    const updatedAt = new Date(serverTime).toISOString();
    const { error: saveError } = await supabase
      .from('profiles')
      .upsert({
        id: req.user.id,
        game_state: nextState,
        updated_at: updatedAt,
      });

    if (saveError) throw saveError;

    const normalizedSync = await syncNormalizedDomain(req.user.id, nextState, traceId);
    if (!normalizedSync.ok && normalizedSync.warning) {
      diagnostics.push(normalizedSync.warning);
    }

    const responsePayload = {
      ok: true,
      newRevision: nextRevision,
      statePatch,
      serverTime,
      diagnostics,
      traceId,
    };

    const { error: commandUpdateError } = await supabase
      .from('player_commands')
      .update({
        resulting_revision: nextRevision,
        response_payload: responsePayload,
      })
      .eq('player_id', req.user.id)
      .eq('command_id', commandId);

    if (commandUpdateError) {
      throw commandUpdateError;
    }

    console.log('[CommandGateway] Command processed', {
      traceId,
      userId: shortId(req.user.id),
      commandId,
      commandType: type,
      expectedRevision: parseRevision(expectedRevision),
      newRevision: nextRevision,
    });

    observeCommandEvent({
      type,
      result: 'success',
      durationMs: Date.now() - commandStartedAt,
    });

    return res.json(responsePayload);
  } catch (error) {
    if (isLikelyUuid(req.body?.commandId)) {
      const failedPayload = {
        ok: false,
        error: error.message || 'Failed to process command',
        errorCode: 'COMMAND_FAILED',
        traceId,
      };

      await supabase
        .from('player_commands')
        .update({ response_payload: failedPayload })
        .eq('player_id', req.user.id)
        .eq('command_id', req.body.commandId);
    }

    console.error('[CommandGateway] Command failed', {
      traceId,
      userId: shortId(req.user?.id),
      error: normalizeServerError(error),
    });

    observeCommandEvent({
      type: req.body?.type,
      result: 'failed',
      errorCode: 'COMMAND_FAILED',
      durationMs: Date.now() - commandStartedAt,
    });

    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to process command',
      errorCode: 'COMMAND_FAILED',
      traceId,
    });
  }
});

app.post('/api/profile/reset', requireAuthUser, async (req, res) => {
  try {
    const { error } = await supabase.from('profiles').delete().eq('id', req.user.id);
    if (error) throw error;
    await supabase.from('player_resources').delete().eq('player_id', req.user.id);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to reset profile' });
  }
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
        const { data: players, error } = await supabase
            .from('profiles')
            .select('id, game_state, role');
        
        if (error) throw error;
        
        // Mapear para extraer campos del JSONB
        const results = players.map(p => {
            const state = p.game_state || {};
            const stats = state.rankingStats || {
                DOMINION: state.empirePoints || 0,
                MILITARY: 0,
                ECONOMY: 0,
                CAMPAIGN: state.campaignProgress || 0
            };
            
            return {
                id: p.id,
                name: state.playerName || 'Commander',
                flag: state.playerFlag || 'US',
                score: state.empirePoints || 0,
                stats: stats,
                role: normalizeRole(p.role)
            };
        });
        
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SOCKET.IO LOGIC ---

const playerPresence = new Map();
const GLOBAL_ROOM = 'global';

io.on('connection', (socket) => {
  let playerId = null;

  socket.on('join_room', ({ peerId }) => {
    playerId = peerId;
    socket.join(GLOBAL_ROOM);

    playerPresence.set(peerId, {
      id: peerId,
      socketId: socket.id,
      name: 'Player',
      level: 0,
      lastSeen: Date.now(),
    });

    const peersInRoom = [];
    for (const [pid, data] of playerPresence.entries()) {
      if (pid !== peerId) {
        peersInRoom.push(pid);
      }
    }

    socket.emit('room_joined', { roomId: GLOBAL_ROOM, peers: peersInRoom });
    socket.to(GLOBAL_ROOM).emit('peer_join', { peerId });
  });

  socket.on('broadcast_action', ({ action }) => {
    socket.to(GLOBAL_ROOM).emit('remote_action', { action, fromPeerId: playerId });
  });

  socket.on('send_to_peer', ({ targetPeerId, action }) => {
    const target = playerPresence.get(targetPeerId);
    if (!target) return;
    const targetSocketId = target.socketId;
    io.to(targetSocketId).emit('remote_action', { action, fromPeerId: playerId });
  });

  socket.on('presence_update', ({ playerData }) => {
    if (!playerId) return;
    const existing = playerPresence.get(playerId);
    if (existing) {
      existing.name = playerData.name || existing.name;
      existing.level = playerData.level ?? existing.level;
      existing.flag = playerData.flag;
      existing.lastSeen = Date.now();
    }
  });

  socket.on('disconnect', () => {
    if (playerId) {
      socket.to(GLOBAL_ROOM).emit('peer_leave', { peerId: playerId });
      playerPresence.delete(playerId);
    }
  });
});

const PORT = process.env.PORT || 10000;

// Run hard reset if requested via environment variable
await hardResetDatabase();
await ensureProfilesForAuthUsers();
setInterval(ensureProfilesForAuthUsers, PROFILE_SYNC_INTERVAL_MS);
setInterval(() => {
  console.log('[CommandMetrics] Snapshot', getCommandMetricsSnapshot());
}, COMMAND_METRICS_LOG_INTERVAL_MS);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[BattleServer] Running on port ${PORT}`);
  console.log(`[BattleServer] Health check: http://localhost:${PORT}/health`);
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
