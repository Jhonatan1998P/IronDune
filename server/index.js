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

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const requireAuthUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing auth token' });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({ error: 'Missing auth token' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }

    req.user = data.user;
    return next();
  } catch (error) {
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
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('game_state, updated_at')
      .eq('id', req.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ game_state: null });
      }
      throw error;
    }

    return res.json({ game_state: data?.game_state || null, updated_at: data?.updated_at || null });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load profile' });
  }
});

app.post('/api/profile/save', requireAuthUser, async (req, res) => {
  try {
    const gameState = req.body?.game_state;
    if (!gameState) {
      return res.status(400).json({ error: 'Missing game_state' });
    }

    const serverTime = Date.now();
    const stateToSave = { ...gameState, lastSaveTime: serverTime };

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: req.user.id,
        game_state: stateToSave,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    return res.json({ ok: true, serverTime });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to save profile' });
  }
});

app.post('/api/profile/reset', requireAuthUser, async (req, res) => {
  try {
    const { error } = await supabase.from('profiles').delete().eq('id', req.user.id);
    if (error) throw error;
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
            .select('id, game_state');
        
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
                stats: stats
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

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[BattleServer] Running on port ${PORT}`);
  console.log(`[BattleServer] Health check: http://localhost:${PORT}/health`);
  if (process.env.DISABLE_SCHEDULER !== 'true') {
    startScheduler();
  } else {
    console.log('[BattleServer] Scheduler disabled via DISABLE_SCHEDULER=true');
  }
});
