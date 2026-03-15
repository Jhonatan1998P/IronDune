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
import { startScheduler, pushFreshStateToPlayer } from './scheduler.js';
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

// --- RANKINGS ENDPOINTS ---

// GET /api/rankings?category=DOMINION|MILITARY|ECONOMY|CAMPAIGN
// Returns combined player + bot rankings from Supabase v_global_ranking view
app.get('/api/rankings', async (req, res) => {
    try {
        const category = (req.query.category || 'DOMINION').toUpperCase();
        const categoryField = {
            DOMINION: 'score_dominion',
            MILITARY: 'score_combat',
            ECONOMY: 'score_economy',
            CAMPAIGN: 'score_campaign',
        }[category] || 'score_dominion';

        // Query players and bots separately to include country/personality
        const [playersRes, botsRes] = await Promise.all([
            supabase.from('profiles')
                .select(`id, username, empire_points, combat_points, economy_points, campaign_points, game_state`)
                .order(categoryField === 'score_dominion' ? 'empire_points' : categoryField === 'score_combat' ? 'combat_points' : categoryField === 'score_economy' ? 'economy_points' : 'campaign_points', { ascending: false })
                .limit(200),
            supabase.from('bots')
                .select(`id, name, score, personality, country, stats`)
                .order('score', { ascending: false })
                .limit(100),
        ]);

        const scoreKey = { score_dominion: 'empire_points', score_combat: 'combat_points', score_economy: 'economy_points', score_campaign: 'campaign_points' }[categoryField] || 'empire_points';

        const players = (playersRes.data || []).map(p => ({
            id: p.id,
            name: p.username || 'Commander',
            score: Number(p[scoreKey] || p.empire_points || 0),
            isPlayer: true,
            isBot: false,
            country: p.game_state?.country || 'XX',
            personality: null,
            avatarId: p.game_state?.avatarId || 0,
        }));

        const botScoreField = { score_dominion: null, score_combat: 'MILITARY', score_economy: 'ECONOMY', score_campaign: 'DOMINION' }[categoryField];
        const bots = (botsRes.data || []).map(b => ({
            id: b.id,
            name: b.name || 'Bot',
            score: botScoreField && b.stats ? Number(b.stats[botScoreField] || 0) : Number(b.score || 0),
            isPlayer: false,
            isBot: true,
            country: b.country || 'XX',
            personality: b.personality || 'WARLORD',
            avatarId: 0,
        }));

        const combined = [...players, ...bots].sort((a, b) => b.score - a.score);

        const getTier = (rank) => {
            if (rank <= 3) return 'S';
            if (rank <= 10) return 'A';
            if (rank <= 50) return 'B';
            if (rank <= 100) return 'C';
            return 'D';
        };

        const ranked = combined.map((entry, i) => ({
            ...entry,
            rank: i + 1,
            tier: getTier(i + 1),
        }));

        res.json(ranked);
    } catch (e) {
        console.error('[Rankings] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/pvp-rankings
// Returns player-only PvP ranking with online status from playerPresence
app.get('/api/pvp-rankings', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, empire_points, combat_points')
            .order('combat_points', { ascending: false })
            .limit(200);

        if (error) throw error;

        const getTier = (rank) => {
            if (rank <= 3) return 'S';
            if (rank <= 10) return 'A';
            if (rank <= 50) return 'B';
            if (rank <= 100) return 'C';
            return 'D';
        };

        const ranked = (data || []).map((p, i) => ({
            id: p.id,
            rank: i + 1,
            name: p.username || 'Commander',
            score: Number(p.combat_points || p.empire_points || 0),
            isOnline: playerPresence.has(p.id),
            tier: getTier(i + 1),
        }));

        res.json(ranked);
    } catch (e) {
        console.error('[PvP Rankings] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/online-count
// Returns only the count of online players (no names — for privacy)
app.get('/api/online-count', (_req, res) => {
    res.json({ count: playerPresence.size });
});

// GET /api/market/global
// Returns current global market prices from Supabase
app.get('/api/market/global', async (_req, res) => {
    try {
        const { data, error } = await supabase
            .from('global_market')
            .select('resource_type, current_price, base_price, last_update');
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
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
        res.json(result);
        // Push updated state to client after mutation (non-blocking)
        pushFreshStateToPlayer(userId).catch(() => {});
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
        res.json(result);
        pushFreshStateToPlayer(userId).catch(() => {});
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
        res.json(result);
        pushFreshStateToPlayer(userId).catch(() => {});
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
        pushFreshStateToPlayer(userId).catch(() => {});
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
        pushFreshStateToPlayer(userId).catch(() => {});
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
        pushFreshStateToPlayer(userId).catch(() => {});
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
        pushFreshStateToPlayer(userId).catch(() => {});
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
        pushFreshStateToPlayer(userId).catch(() => {});
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
        pushFreshStateToPlayer(userId).catch(() => {});
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

    playerPresence.set(peerId, {
      id: peerId,
      socketId: socket.id,
      lastSeen: Date.now(),
    });

    try {
        // Apply offline delta for this player on connection
        await supabase.rpc('sync_player_production_v3', { p_id: peerId });

        // Load fresh state from DB
        const [ecoRes, cqRes, uqRes, rqRes, movRes] = await Promise.all([
            supabase.from('player_economy').select('*').eq('player_id', peerId).single(),
            supabase.from('construction_queue').select('*').eq('player_id', peerId),
            supabase.from('unit_queue').select('*').eq('player_id', peerId),
            supabase.from('research_queue').select('*').eq('player_id', peerId),
            supabase.from('movements').select('*').eq('sender_id', peerId).eq('status', 'active'),
        ]);

        const economy = ecoRes.data;
        if (economy) {
            const snapshot = {
                MONEY: Number(economy.money),
                OIL: Number(economy.oil),
                AMMO: Number(economy.ammo),
                GOLD: Number(economy.gold),
                DIAMOND: Number(economy.diamond || 0),
            };
            const rates = {
                MONEY: Number(economy.money_prod),
                OIL: Number(economy.oil_prod),
                AMMO: Number(economy.ammo_prod),
                GOLD: Number(economy.gold_prod),
                DIAMOND: 0,
            };
            const queues = {
                constructions: cqRes.data || [],
                units: uqRes.data || [],
                research: rqRes.data || [],
            };

            playerLiveStates.set(peerId, {
                resources: snapshot,
                rates,
                queues,
                lastUpdate: Number(economy.last_calc_time) || Date.now(),
            });

            // Push initial engine sync immediately on connection
            socket.emit('engine_sync_update', {
                resources: snapshot,
                rates,
                queues,
                movements: movRes.data || [],
                serverTime: Date.now(),
            });
        }
    } catch (err) {
        console.error(`[Socket] join_room error for ${peerId}:`, err.message);
    }
  });

  // HEARTBEAT: Client requests sync every 2s — server responds with delta-time resources
  socket.on('request_engine_sync', () => {
    if (!playerId || !playerLiveStates.has(playerId)) return;

    const live = playerLiveStates.get(playerId);
    const now = Date.now();
    const delta = Math.max(0, (now - live.lastUpdate) / 1000);

    // Fast in-memory delta calculation (authoritative interpolation)
    const currentResources = {
        MONEY: live.resources.MONEY + (live.rates.MONEY * delta),
        OIL: live.resources.OIL + (live.rates.OIL * delta),
        AMMO: live.resources.AMMO + (live.rates.AMMO * delta),
        GOLD: live.resources.GOLD + (live.rates.GOLD * delta),
        DIAMOND: live.resources.DIAMOND,
    };

    socket.emit('engine_sync_update', {
        resources: currentResources,
        rates: live.rates,
        queues: live.queues,
        serverTime: now,
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
  
  // Sync offline delta immediately on boot (Render sleep recovery)
  console.log('[BattleServer] Performing initial offline delta sync...');
  try {
    await supabase.rpc('sync_all_production_v3');
  } catch (e) {
    console.warn('[Boot] Sync error:', e.message);
  }

  // Start scheduler with access to io + presence maps for real-time push
  startScheduler(io, playerPresence, playerLiveStates);
});
