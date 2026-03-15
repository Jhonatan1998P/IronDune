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
import { handleBuild, handleRecruit, handleResearch, handleBankTransaction, handleRepair, handleDiamondExchange, handleEspionage, handleSalvageMission } from './engine/actions.js';

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

app.post('/api/battle/process-queue', async (req, res) => {
    try {
        const { userId, now } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        
        // Usar la lógica del scheduler para procesar un perfil específico a demanda
        // Esto garantiza autoridad total ya que usa los datos de la DB
        const { processSingleProfile, fetchFullState } = await import('./scheduler.js');
        
        await processSingleProfile(userId, now || Date.now());
        const newState = await fetchFullState(userId);
        
        res.json({ newState, newLogs: newState.logs || [] });
    } catch (error) {
        console.error('[BattleServer] Error processing authoritative queue:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/battle/war-tick', async (req, res) => {
    try {
        const { userId, now } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        
        const { fetchFullState } = await import('./scheduler.js');
        const state = await fetchFullState(userId);
        
        const result = processWarTick(state, now || Date.now());
        res.json(result);
    } catch (error) {
        console.error('[BattleServer] Error processing war tick:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/battle/enemy-attack-check', async (req, res) => {
    try {
        const { userId, now } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const { fetchFullState } = await import('./scheduler.js');
        const state = await fetchFullState(userId);

        const result = processEnemyAttackCheck(state, now || Date.now());
        res.json(result);
    } catch (error) {
        console.error('[BattleServer] Error processing enemy attack check:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/battle/nemesis-tick', async (req, res) => {
    try {
        const { userId, now } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        
        const { fetchFullState } = await import('./scheduler.js');
        const state = await fetchFullState(userId);

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

// --- AUTHORITATIVE ACTIONS ---

async function refreshPlayerCache(userId) {
    if (!playerLiveStates.has(userId)) return;
    
    const { data: economy } = await supabase.from('player_economy').select('*').eq('player_id', userId).single();
    const { data: cQueue } = await supabase.from('construction_queue').select('*').eq('player_id', userId);
    const { data: uQueue } = await supabase.from('unit_queue').select('*').eq('player_id', userId);
    const { data: rQueue } = await supabase.from('research_queue').select('*').eq('player_id', userId);

    if (economy) {
        playerLiveStates.set(userId, {
            resources: {
                MONEY: Number(economy.money),
                OIL: Number(economy.oil),
                AMMO: Number(economy.ammo),
                GOLD: Number(economy.gold),
                DIAMOND: Number(economy.diamond || 0)
            },
            rates: {
                MONEY: Number(economy.money_prod),
                OIL: Number(economy.oil_prod),
                AMMO: Number(economy.ammo_prod),
                GOLD: Number(economy.gold_prod),
                DIAMOND: 0
            },
            queues: {
                constructions: cQueue || [],
                units: uQueue || [],
                research: rQueue || []
            },
            lastUpdate: Number(economy.last_calc_time)
        });
    }
}

app.post('/api/game/build', async (req, res) => {
    try {
        const { userId, buildingType, amount } = req.body;
        if (!userId || !buildingType) return res.status(400).json({ error: 'Missing params' });
        const result = await handleBuild(userId, buildingType, amount || 1);
        await refreshPlayerCache(userId);
        res.json(result);
    } catch (error) {
        console.error('[ActionServer] Build error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/game/recruit', async (req, res) => {
    try {
        const { userId, unitType, amount } = req.body;
        if (!userId || !unitType || !amount) return res.status(400).json({ error: 'Missing params' });
        const result = await handleRecruit(userId, unitType, amount);
        await refreshPlayerCache(userId);
        res.json(result);
    } catch (error) {
        console.error('[ActionServer] Recruit error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/game/research', async (req, res) => {
    try {
        const { userId, techType } = req.body;
        if (!userId || !techType) return res.status(400).json({ error: 'Missing params' });
        const result = await handleResearch(userId, techType);
        await refreshPlayerCache(userId);
        res.json(result);
    } catch (error) {
        console.error('[ActionServer] Research error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/game/bank-transaction', async (req, res) => {
    try {
        const { userId, amount, type } = req.body;
        if (!userId || !amount || !type) return res.status(400).json({ error: 'Missing params' });
        const result = await handleBankTransaction(userId, amount, type);
        res.json(result);
    } catch (error) {
        console.error('[ActionServer] Bank error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/game/repair', async (req, res) => {
    try {
        const { userId, buildingType } = req.body;
        if (!userId || !buildingType) return res.status(400).json({ error: 'Missing params' });
        const result = await handleRepair(userId, buildingType);
        res.json(result);
    } catch (error) {
        console.error('[ActionServer] Repair error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/game/diamond-exchange', async (req, res) => {
    try {
        const { userId, targetResource, amount } = req.body;
        if (!userId || !targetResource || !amount) return res.status(400).json({ error: 'Missing params' });
        const result = await handleDiamondExchange(userId, targetResource, amount);
        res.json(result);
    } catch (error) {
        console.error('[ActionServer] Diamond exchange error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/game/espionage', async (req, res) => {
    try {
        const { userId, targetId } = req.body;
        if (!userId || !targetId) return res.status(400).json({ error: 'Missing params' });
        const result = await handleEspionage(userId, targetId);
        res.json(result);
    } catch (error) {
        console.error('[ActionServer] Espionage error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/game/salvage-mission', async (req, res) => {
    try {
        const { userId, lootId, drones } = req.body;
        if (!userId || !lootId || !drones) return res.status(400).json({ error: 'Missing params' });
        const result = await handleSalvageMission(userId, lootId, drones);
        res.json(result);
    } catch (error) {
        console.error('[ActionServer] Salvage error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/game/start-mission', async (req, res) => {
    try {
        const { userId, targetId, type, units, resources, travelTime } = req.body;
        if (!userId || !targetId || !type || !units) return res.status(400).json({ error: 'Missing params' });
        
        const now = Date.now();
        const endTime = now + (travelTime || 900000); // Default 15m

        // Validate and subtract units from player_units
        for (const [uType, count] of Object.entries(units)) {
            const { data: current } = await supabase.from('player_units').select('count').eq('player_id', userId).eq('unit_type', uType).single();
            if (!current || current.count < count) throw new Error(`Not enough ${uType}`);
            await supabase.from('player_units').update({ count: current.count - count }).eq('player_id', userId).eq('unit_type', uType);
        }

        const { data: mov, error } = await supabase.from('movements').insert({
            sender_id: userId,
            target_id: targetId,
            type: type,
            units: units,
            resources: resources || {},
            start_time: now,
            end_time: endTime,
            status: 'active'
        }).select().single();

        if (error) throw error;
        res.json(mov);
    } catch (error) {
        console.error('[ActionServer] Mission error:', error);
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
    const { data: cQueue } = await supabase.from('construction_queue').select('*').eq('player_id', peerId);
    const { data: uQueue } = await supabase.from('unit_queue').select('*').eq('player_id', peerId);
    const { data: rQueue } = await supabase.from('research_queue').select('*').eq('player_id', peerId);

    if (economy) {
        playerLiveStates.set(peerId, {
            resources: {
                MONEY: Number(economy.money),
                OIL: Number(economy.oil),
                AMMO: Number(economy.ammo),
                GOLD: Number(economy.gold),
                DIAMOND: Number(economy.diamond || 0)
            },
            rates: {
                MONEY: Number(economy.money_prod),
                OIL: Number(economy.oil_prod),
                AMMO: Number(economy.ammo_prod),
                GOLD: Number(economy.gold_prod),
                DIAMOND: 0 // Se calcula por edificios específicos si aplica
            },
            queues: {
                constructions: cQueue || [],
                units: uQueue || [],
                research: rQueue || []
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

    // Cálculo autoritativo en memoria (Source of Truth temporal) para respuesta inmediata
    const currentResources = {
        MONEY: live.resources.MONEY + (live.rates.MONEY * delta),
        OIL: live.resources.OIL + (live.rates.OIL * delta),
        AMMO: live.resources.AMMO + (live.rates.AMMO * delta),
        GOLD: live.resources.GOLD + (live.rates.GOLD * delta),
        DIAMOND: live.resources.DIAMOND + (live.rates.DIAMOND * delta),
    };

    socket.emit('engine_sync_update', {
        resources: currentResources,
        rates: live.rates,
        queues: live.queues,
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
  
  // Ejecutar primer sync inmediatamente para procesar tiempo offline (Render Sleep recovery)
  console.log('[BattleServer] Performing initial offline sync...');
  await supabase.rpc('sync_all_production_v3');
  
  startScheduler();
});
