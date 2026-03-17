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

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

const requireAuthUser = async (req, res, next) => {
  const traceId = makeTraceId('auth-mw');
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      console.warn('[AuthMiddleware] Missing bearer token', { traceId });
      return res.status(401).json({ error: 'Missing auth token' });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      console.warn('[AuthMiddleware] Empty bearer token', { traceId });
      return res.status(401).json({ error: 'Missing auth token' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      console.warn('[AuthMiddleware] Invalid auth token', {
        traceId,
        error: normalizeServerError(error),
      });
      return res.status(401).json({ error: 'Invalid auth token' });
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
    return res.status(500).json({ error: 'Auth validation failed' });
  }
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

app.get('/api/profile', requireAuthUser, async (req, res) => {
  const traceId = makeTraceId('profile-load');
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

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('[ProfileAPI] Load no profile found', {
          traceId,
          userId: shortId(req.user.id),
        });
        return res.status(404).json({ game_state: null });
      }
      throw error;
    }

    console.log('[ProfileAPI] Load succeeded', {
      traceId,
      userId: shortId(req.user.id),
      hasState: Boolean(data?.game_state),
      updatedAt: data?.updated_at || null,
      stateKeys: data?.game_state ? Object.keys(data.game_state).length : 0,
    });
    return res.json({ game_state: data?.game_state || null, updated_at: data?.updated_at || null });
  } catch (error) {
    console.error('[ProfileAPI] Load failed', {
      traceId,
      userId: shortId(req.user?.id),
      error: normalizeServerError(error),
    });
    return res.status(500).json({ error: error.message || 'Failed to load profile' });
  }
});

app.post('/api/profile/save', requireAuthUser, async (req, res) => {
  const traceId = makeTraceId('profile-save');
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
      return res.status(400).json({ error: 'Missing game_state' });
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
        return res.status(409).json({ error: 'Profile out of date', updated_at: existing.updated_at });
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

    console.log('[ProfileAPI] Save succeeded', {
      traceId,
      userId: shortId(req.user.id),
      updatedAt,
      serverTime,
      savedStateKeys: Object.keys(stateToSave).length,
    });

    return res.json({ ok: true, serverTime, updated_at: updatedAt });
  } catch (error) {
    console.error('[ProfileAPI] Save failed', {
      traceId,
      userId: shortId(req.user?.id),
      error: normalizeServerError(error),
    });
    return res.status(500).json({ error: error.message || 'Failed to save profile' });
  }
});

app.post('/api/resources/deduct', requireAuthUser, async (req, res) => {
  try {
    const costs = req.body?.costs || {};
    const result = await validateResourceDeduction(req.user.id, costs);
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.reason || 'insufficient_funds', resource: result.resource });
    }
    return res.json({ ok: true, resources: result.resources });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Failed to deduct resources' });
  }
});

app.post('/api/resources/add', requireAuthUser, async (req, res) => {
  try {
    const gains = req.body?.gains || {};
    const result = await addResources(req.user.id, gains);
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.reason || 'add_failed' });
    }
    return res.json({ ok: true, resources: result.resources });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Failed to add resources' });
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

app.post('/api/battle/simulate-combat', (req, res) => {
    try {
        const { attackerUnits, defenderUnits, terrainModifier } = req.body;
        const result = simulateCombat(attackerUnits, defenderUnits, terrainModifier || 1.0);
        res.json(result);
    } catch (error) {
        console.error('[BattleServer] Simulation error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/battle/process-queue', (req, res) => {
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

app.post('/api/battle/war-tick', (req, res) => {
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

app.post('/api/battle/enemy-attack-check', (req, res) => {
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

app.post('/api/battle/nemesis-tick', (req, res) => {
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
