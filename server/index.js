import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './db/lib/supabase.js';
import { processAttackQueue } from './engine/attackQueue.js';
import { processWarTick } from './engine/war.js';
import { processEnemyAttackCheck } from './engine/enemyAttack.js';
import { processNemesisTick } from './engine/nemesis.js';
import { simulateCombat } from './engine/combat.js';
import { startScheduler } from './scheduler.js';
import { runSetupOnDeploy } from './scripts/runSetupOnDeploy.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
            .from('salvage_fields')
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
            .from('bots')
            .select('*');
        
        if (error) throw error;
        res.json(bots);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SOCKET.IO LOGIC ---

const playerPresence = new Map();
const playerLiveStates = new Map(); // Cache para cálculos rápidos
const GLOBAL_ROOM = 'global';

io.on('connection', (socket) => {
  let playerId = null;

  socket.on('join_room', async ({ peerId }) => {
    playerId = peerId;
    socket.join(GLOBAL_ROOM);
    
    // Cargar estado inicial para la caché de autoridad
    const { data: economy } = await supabase.from('player_economy').select('*').eq('player_id', peerId).single();
    if (economy) {
        playerLiveStates.set(peerId, {
            resources: {
                MONEY: Number(economy.money),
                OIL: Number(economy.oil),
                AMMO: Number(economy.ammo),
                GOLD: Number(economy.gold)
            },
            rates: {
                MONEY: Number(economy.money_prod),
                OIL: Number(economy.oil_prod),
                AMMO: Number(economy.ammo_prod),
                GOLD: Number(economy.gold_prod)
            },
            lastUpdate: Number(economy.last_calc_time)
        });
    }

    playerPresence.set(peerId, {
      id: peerId,
      socketId: socket.id,
      lastSeen: Date.now(),
    });
  });

  // HEARTBEAT AUTORITATIVO: El cliente pide sincronización cada segundo
  socket.on('request_engine_sync', () => {
    if (!playerId || !playerLiveStates.has(playerId)) return;

    const live = playerLiveStates.get(playerId);
    const now = Date.now();
    const delta = (now - live.lastUpdate) / 1000;

    // Cálculo autoritativo en memoria (Source of Truth temporal)
    const currentResources = {
        MONEY: live.resources.MONEY + (live.rates.MONEY * delta),
        OIL: live.resources.OIL + (live.rates.OIL * delta),
        AMMO: live.resources.AMMO + (live.rates.AMMO * delta),
        GOLD: live.resources.GOLD + (live.rates.GOLD * delta),
    };

    socket.emit('engine_sync_update', {
        resources: currentResources,
        serverTime: now
    });
  });

  socket.on('disconnect', () => {
    if (playerId) {
      playerPresence.delete(playerId);
      playerLiveStates.delete(playerId);
    }
  });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, '0.0.0.0', async () => {
  console.log(`[BattleServer] Running on port ${PORT}`);
  console.log(`[BattleServer] Health check: http://localhost:${PORT}/health`);
  await runSetupOnDeploy(); // hard reset solo si DB_HARD_RESET=true
  startScheduler();
});
