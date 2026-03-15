/**
 * BACKGROUND SCHEDULER - REFACTORED FOR GLOBAL AUTHORITY & PERSISTENCE
 * Processes production via SQL (V3 Delta) and resolves movements globally.
 */

import { supabase } from './db/lib/supabase.js';
import { processAttackQueue } from './engine/attackQueue.js';
import { processWarTick } from './engine/war.js';
import { processEnemyAttackCheck } from './engine/enemyAttack.js';
import { processNemesisTick } from './engine/nemesis.js';
import { saveGlobalLoot } from './engine/logisticLoot.js';
import { PLUNDERABLE_BUILDINGS } from './engine/constants.js';

const SCHEDULER_INTERVAL_MS = 2 * 60 * 1000; // 2 Minutes (User requested auto-sync)
const MARKET_TICK_MS = 10 * 60 * 1000; // 10 Minutes
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 Minutes

export const startScheduler = () => {
    console.log('[Scheduler] Starting global authority & persistence engine (2m sync)...');
    
    // 1. Global Authority Production & Delta Calculation (All players)
    setInterval(syncGlobalProduction, SCHEDULER_INTERVAL_MS);
    
    // 2. Movement & Offline Events Engine
    setInterval(processEngineTick, SCHEDULER_INTERVAL_MS);

    // 3. Global Market Fluctuation
    setInterval(tickGlobalMarket, MARKET_TICK_MS);

    // 4. Cleanup Expired Events
    setInterval(cleanupWorldEvents, SCHEDULER_INTERVAL_MS);
    
    // 5. Bot Growth & Reputation IA
    setInterval(processBotIntelligence, SCHEDULER_INTERVAL_MS * 5); // Every 10m
};

async function processBotIntelligence() {
    try {
        console.log('[Scheduler] Processing Bot IA growth & reputation...');
        const { data: bots, error } = await supabase.from('bots').select('*');
        if (error) throw error;

        for (const bot of bots) {
            // IA simple: crecimiento de puntos basado en reputación
            const growth = Math.floor(bot.reputation * (1 + Math.random()));
            await supabase.from('bots')
                .update({ 
                    score: bot.score + growth,
                    updated_at: new Date().toISOString()
                })
                .eq('id', bot.id);
        }
    } catch (error) {
        console.error('[Scheduler] Bot IA Error:', error);
    }
}

async function tickGlobalMarket() {
    try {
        console.log('[Scheduler] Simulating market fluctuation...');
        const { data: market, error } = await supabase.from('global_market').select('*');
        if (error) throw error;

        for (const res of market) {
            const change = 1 + (Math.random() * 0.04 - 0.02);
            const newPrice = Math.max(res.base_price * 0.5, res.current_price * change);
            
            await supabase.from('global_market')
                .update({ 
                    current_price: newPrice,
                    last_update: new Date().toISOString()
                })
                .eq('resource_type', res.resource_type);
        }
        console.log('[Scheduler] Market prices updated.');
    } catch (error) {
        console.error('[Scheduler] Market Tick Error:', error);
    }
}

async function cleanupWorldEvents() {
    try {
        const now = new Date().toISOString();
        await supabase.from('world_events').delete().lte('expires_at', now);
    } catch (error) {
        console.error('[Scheduler] Event Cleanup Error:', error);
    }
}

async function syncGlobalProduction() {
    try {
        console.log('[Scheduler] Executing Server-Side Authority: Global Sync (V3 Delta)...');
        const { data, error } = await supabase.rpc('sync_all_production_v3');
        if (error) throw error;

        if (data && data[0]) {
            const res = data[0];
            if (res.processed_constructions > 0 || res.processed_research > 0 || res.processed_units > 0) {
                console.log(`[Authority] Queues processed retroactively: Buildings: ${res.processed_constructions}, Research: ${res.processed_research}, Units: ${res.processed_units}`);
            }
        }
    } catch (error) {
        console.error('[Scheduler] Global Production Sync Error:', error);
    }
}

async function processEngineTick() {
    try {
        const now = Date.now();
        
        // 1. Resolve Expired Movements
        const { data: movements, error } = await supabase
            .from('movements')
            .select('*')
            .eq('status', 'active')
            .lte('end_time', now)
            .order('end_time', { ascending: true })
            .limit(20);

        if (error) throw error;

        if (movements && movements.length > 0) {
            console.log(`[Scheduler] Resolving ${movements.length} movements...`);
            for (const mov of movements) {
                await resolveMovement(mov, now);
            }
        }

        // 2. Process Stale Profiles
        const staleTime = new Date(now - STALE_THRESHOLD_MS).toISOString();
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id')
            .lt('updated_at', staleTime)
            .limit(10);

        if (profiles) {
            for (const profile of profiles) {
                await processSingleProfile(profile.id, now);
            }
        }
    } catch (error) {
        console.error('[Scheduler] Engine Tick Error:', error);
    }
}

async function resolveMovement(mov, now) {
    try {
        console.log(`[BattleEngine] Resolving ${mov.type} from ${mov.sender_id} to ${mov.target_id}`);
        await supabase.from('movements').update({ status: 'processing' }).eq('id', mov.id);

        if (mov.type === 'attack') {
            await executeP2PBattle(mov, now);
        } else if (mov.type === 'return') {
            await executeReturn(mov, now);
        } else {
            await processSingleProfile(mov.sender_id, now);
        }

        await supabase.from('movements').update({ status: 'completed' }).eq('id', mov.id);
    } catch (e) {
        console.error(`[BattleEngine] Critical failure in movement ${mov.id}:`, e);
        await supabase.from('movements').update({ status: 'active' }).eq('id', mov.id);
    }
}

async function executeP2PBattle(mov, now) {
    const attackerId = mov.sender_id;
    const defenderId = mov.target_id;
    const { 
        MAX_ATTACKS_24H, MAX_ATTACKS_1H, BASH_LIMIT_WINDOW_MS, SHORT_LIMIT_WINDOW_MS,
        FIRST_ATTACK_PLUNDER_RATE, SUBSEQUENT_ATTACK_PLUNDER_RATE, GLOBAL_DEBRIS_RATIO 
    } = await import('./engine/constants.js');

    const window24h = new Date(now - BASH_LIMIT_WINDOW_MS).toISOString();
    const window1h = new Date(now - SHORT_LIMIT_WINDOW_MS).toISOString();
    
    const { data: recentAttacks } = await supabase
        .from('reports')
        .select('id, created_at')
        .eq('user_id', defenderId)
        .eq('type', 'COMBAT')
        .filter('content->>attackerId', 'eq', attackerId)
        .gte('created_at', window24h);

    const total24h = recentAttacks?.length || 0;
    const total1h = recentAttacks?.filter(a => new Date(a.created_at) > new Date(window1h)).length || 0;

    if (total24h >= MAX_ATTACKS_24H || total1h >= MAX_ATTACKS_1H) {
        return cancelMission(mov, 'Bash Limit: Max 6/24h or 3/1h reached.');
    }

    const { data: defUnits } = await supabase.from('player_units').select('*').eq('player_id', defenderId);
    const { data: defBuildings } = await supabase.from('player_buildings').select('*').eq('player_id', defenderId);
    
    const attackerInitialArmy = { ...mov.units };
    const defenderInitialArmy = (defUnits || []).reduce((acc, u) => {
        acc[u.unit_type] = Number(u.count);
        return acc;
    }, {});

    const { simulateCombat } = await import('./engine/combat.js');
    const result = simulateCombat(defenderInitialArmy, attackerInitialArmy);
    
    let stolenBuildings = {};
    if (result.winner === 'ATTACKER') {
        const rate = (total24h === 0) ? FIRST_ATTACK_PLUNDER_RATE : SUBSEQUENT_ATTACK_PLUNDER_RATE;
        for (const b of (defBuildings || [])) {
            const currentVal = (b.quantity > 0) ? b.quantity : b.level;
            const stolenAmount = Math.floor(currentVal * rate);
            if (stolenAmount > 0) {
                stolenBuildings[b.building_type] = stolenAmount;
                await supabase.from('player_buildings').update({ 
                    quantity: (b.quantity > 0) ? Math.max(0, b.quantity - stolenAmount) : 0,
                    level: (b.level > 0) ? Math.max(0, b.level - stolenAmount) : 0
                }).eq('player_id', defenderId).eq('building_type', b.building_type);

                const { data: attB } = await supabase.from('player_buildings').select('*').eq('player_id', attackerId).eq('building_type', b.building_type).single();
                await supabase.from('player_buildings').upsert({
                    player_id: attackerId, building_type: b.building_type,
                    quantity: (b.quantity > 0) ? (Number(attB?.quantity || 0) + stolenAmount) : 0,
                    level: (b.level > 0) ? (Number(attB?.level || 0) + stolenAmount) : 0
                });
            }
        }
    }

    for (const [uType, count] of Object.entries(result.finalDefenderArmy)) {
        await supabase.from('player_units').upsert({ player_id: defenderId, unit_type: uType, count: Math.max(0, count) });
    }

    const detailedReport = {
        attackerId, defenderId, winner: result.winner, rounds: result.rounds, stolenBuildings,
        debrisValue: result.totalLossesValue * GLOBAL_DEBRIS_RATIO,
        sections: {
            attacker: { initial: attackerInitialArmy, losses: result.totalAttackerCasualties, survivors: result.finalAttackerArmy },
            defender: { initial: defenderInitialArmy, losses: result.totalDefenderCasualties, survivors: result.finalDefenderArmy },
            allies: result.allyCasualties || {}
        }
    };

    const travelTime = Number(mov.end_time) - Number(mov.start_time);
    await supabase.from('movements').insert({
        sender_id: attackerId, target_id: attackerId, type: 'return',
        units: result.finalAttackerArmy, start_time: now, end_time: now + travelTime, status: 'active'
    });

    await supabase.from('reports').insert([
        { user_id: attackerId, title: 'Attack Victory', content: detailedReport, type: 'COMBAT' },
        { user_id: defenderId, title: 'Defense Defeat', content: detailedReport, type: 'COMBAT' }
    ]);
}

async function cancelMission(mov, reason) {
    const travelTime = Number(mov.end_time) - Number(mov.start_time);
    await supabase.from('movements').insert({
        sender_id: mov.sender_id, target_id: mov.sender_id, type: 'return',
        units: mov.units, start_time: Date.now(), end_time: Date.now() + travelTime, status: 'active'
    });
    await supabase.from('reports').insert({
        user_id: mov.sender_id, title: 'Mission Cancelled', content: { reason, originalMovement: mov.id }, type: 'SYSTEM'
    });
}

async function executeReturn(mov, now) {
    for (const [unitType, count] of Object.entries(mov.units)) {
        const { data: current } = await supabase.from('player_units').select('count').eq('player_id', mov.sender_id).eq('unit_type', unitType).single();
        await supabase.from('player_units').upsert({
            player_id: mov.sender_id, unit_type: unitType, count: Number(current?.count || 0) + Number(count)
        });
    }
    if (mov.resources) {
        await supabase.rpc('add_resources', {
            p_id: mov.sender_id, m: mov.resources.MONEY || 0, o: mov.resources.OIL || 0, a: mov.resources.AMMO || 0
        });
    }
    console.log(`[BattleEngine] Return completed for ${mov.sender_id}`);
}

export async function fetchFullState(userId) {
    const [profileRes, economyRes, buildingsRes, researchRes, unitsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('player_economy').select('*').eq('player_id', userId).single(),
        supabase.from('player_buildings').select('*').eq('player_id', userId),
        supabase.from('player_research').select('*').eq('player_id', userId),
        supabase.from('player_units').select('*').eq('player_id', userId)
    ]);
    if (profileRes.error) throw profileRes.error;
    const profile = profileRes.data;
    const economy = economyRes.data || {};
    const state = {
        ...profile.game_state, playerName: profile.username, empirePoints: Number(profile.empire_points),
        resources: { MONEY: Number(economy.money || 0), OIL: Number(economy.oil || 0), AMMO: Number(economy.ammo || 0), GOLD: Number(economy.gold || 0), DIAMOND: Number(economy.diamond || 0) },
        bankBalance: Number(economy.bank_balance || 0), buildings: {}, units: {}, techLevels: {}, logs: []
    };
    if (buildingsRes.data) {
        buildingsRes.data.forEach(b => {
            const isQuantity = PLUNDERABLE_BUILDINGS.includes(b.building_type);
            state.buildings[b.building_type] = { level: isQuantity ? (b.quantity || 0) : (b.level || 0) };
        });
    }
    if (researchRes.data) { buildingsRes.data.forEach(r => { state.techLevels[r.tech_type] = r.level; }); }
    if (unitsRes.data) { unitsRes.data.forEach(u => { state.units[u.unit_type] = Number(u.count); }); }
    return state;
}

async function persistState(userId, state, now) {
    const { logs, newLogs, ...minimalGameState } = state;
    await supabase.from('profiles').update({ empire_points: state.empirePoints, game_state: minimalGameState, updated_at: new Date(now).toISOString() }).eq('id', userId);
    await supabase.from('player_economy').upsert({
        player_id: userId, money: state.resources.MONEY, oil: state.resources.OIL, ammo: state.resources.AMMO, gold: state.resources.GOLD, diamond: state.resources.DIAMOND, bank_balance: state.bankBalance, last_calc_time: now
    });
    const buildingData = Object.entries(state.buildings).map(([type, b]) => {
        const isQuantity = PLUNDERABLE_BUILDINGS.includes(type);
        return { player_id: userId, building_type: type, level: isQuantity ? 0 : b.level, quantity: isQuantity ? b.level : 0 };
    });
    if (buildingData.length > 0) await supabase.from('player_buildings').upsert(buildingData);
    const unitData = Object.entries(state.units).map(([type, count]) => ({ player_id: userId, unit_type: type, count: count }));
    if (unitData.length > 0) await supabase.from('player_units').upsert(unitData);
    if (newLogs && newLogs.length > 0) {
        const reportData = newLogs.map(log => ({ user_id: userId, title: log.messageKey, content: log.params || {}, type: (log.type || 'info').toUpperCase(), created_at: new Date(log.timestamp || now).toISOString() }));
        await supabase.from('reports').insert(reportData);
    }
}

export async function processSingleProfile(userId, now) {
    try {
        let state = await fetchFullState(userId);
        let modified = false;
        state.newLogs = [];
        const nemesisResult = processNemesisTick(state, now);
        if (Object.keys(nemesisResult.stateUpdates).length > 0) { state = { ...state, ...nemesisResult.stateUpdates }; state.newLogs.push(...nemesisResult.logs); modified = true; }
        const enemyAttackResult = processEnemyAttackCheck(state, now);
        if (Object.keys(enemyAttackResult.stateUpdates).length > 0) { state = { ...state, ...enemyAttackResult.stateUpdates }; state.newLogs.push(...enemyAttackResult.logs); modified = true; }
        const queueResult = await processAttackQueue(state, now);
        if (queueResult.queuedResults.length > 0) {
            state = queueResult.newState; state.newLogs.push(...queueResult.newLogs); modified = true;
            for (const item of queueResult.queuedResults) {
                if (item.result?.defenderUpdates) await applyDefenderUpdates(item.result.defenderUpdates, now);
                if (item.result?.generatedLogisticLoot) await saveGlobalLoot(item.result.generatedLogisticLoot);
            }
        }
        if (modified) await persistState(userId, state, now);
    } catch (error) { console.error(`[Scheduler] Error processing profile ${userId}:`, error); }
}

async function applyDefenderUpdates(updates, now) {
    try {
        const { targetId, logKey, logParams, unitsLost, buildingsLost, resourcesLost } = updates;
        let state = await fetchFullState(targetId);
        state.newLogs = [];
        if (unitsLost) Object.entries(unitsLost).forEach(([uType, count]) => { if (state.units[uType]) state.units[uType] = Math.max(0, state.units[uType] - count); });
        if (buildingsLost) Object.entries(buildingsLost).forEach(([bType, count]) => { if (state.buildings[bType]) state.buildings[bType].level = Math.max(0, state.buildings[bType].level - count); });
        if (resourcesLost) Object.entries(resourcesLost).forEach(([res, amount]) => { const key = res.toUpperCase(); if (state.resources[key] !== undefined) state.resources[key] = Math.max(0, state.resources[key] - amount); });
        state.newLogs.push({ id: `def-${targetId}-${now}`, messageKey: logKey, params: logParams, timestamp: now, type: 'combat' });
        await persistState(targetId, state, now);
    } catch (e) { console.error('[Scheduler] Defender Update Error:', e); }
}
