/**
 * BACKGROUND SCHEDULER - REFACTORED FOR MULTI-TABLE ARCHITECTURE
 * Processes battles and military actions for offline players directly in Supabase
 */

import { supabase } from './lib/supabase.js';
import { processAttackQueue } from './engine/attackQueue.js';
import { processWarTick } from './engine/war.js';
import { processEnemyAttackCheck } from './engine/enemyAttack.js';
import { processNemesisTick } from './engine/nemesis.js';
import { saveGlobalLoot } from './engine/logisticLoot.js';

const SCHEDULER_INTERVAL_MS = 60 * 1000; // Check every minute
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // Players offline for more than 5 minutes

export const startScheduler = () => {
    console.log('[Scheduler] Starting background battle processor (Multi-Table)...');
    setInterval(processOfflinePlayers, SCHEDULER_INTERVAL_MS);
};

async function processOfflinePlayers() {
    try {
        const now = Date.now();
        const staleTime = new Date(now - STALE_THRESHOLD_MS).toISOString();

        // Solo traemos los IDs de perfiles que necesitan procesamiento
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, updated_at')
            .lt('updated_at', staleTime)
            .limit(20); // Procesamos de a 20 por ciclo

        if (error) throw error;
        if (!profiles || profiles.length === 0) return;

        console.log(`[Scheduler] Checking ${profiles.length} offline profiles...`);

        for (const profile of profiles) {
            await processSingleProfile(profile.id, now);
        }
    } catch (error) {
        console.error('[Scheduler] Error in processing loop:', error);
    }
}

async function fetchFullState(userId) {
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
    
    // Reconstruir objeto state para el motor
    const state = {
        ...profile.game_state,
        playerName: profile.username,
        empirePoints: Number(profile.empire_points),
        resources: {
            MONEY: Number(economy.money || 0),
            OIL: Number(economy.oil || 0),
            AMMO: Number(economy.ammo || 0),
            GOLD: Number(economy.gold || 0),
            DIAMOND: Number(economy.diamond || 0)
        },
        bankBalance: Number(economy.bank_balance || 0),
        buildings: {},
        units: {},
        techLevels: {},
        logs: profile.game_state.logs || []
    };

    if (buildingsRes.data) {
        buildingsRes.data.forEach(b => {
            state.buildings[b.building_type] = { level: b.level };
        });
    }

    if (researchRes.data) {
        researchRes.data.forEach(r => {
            state.techLevels[r.tech_type] = r.level;
        });
    }

    if (unitsRes.data) {
        unitsRes.data.forEach(u => {
            state.units[u.unit_type] = Number(u.count);
        });
    }

    return state;
}

async function persistState(userId, state, now) {
    // 1. Update Profile & GameState
    const { logs, ...minimalGameState } = state;
    await supabase.from('profiles').update({
        empire_points: state.empirePoints,
        game_state: {
            ...minimalGameState,
            logs: state.logs // Mantenemos logs en JSONB por simplicidad de UI por ahora
        },
        updated_at: new Date(now).toISOString()
    }).eq('id', userId);

    // 2. Update Economy
    await supabase.from('player_economy').upsert({
        player_id: userId,
        money: state.resources.MONEY,
        oil: state.resources.OIL,
        ammo: state.resources.AMMO,
        gold: state.resources.GOLD,
        diamond: state.resources.DIAMOND,
        bank_balance: state.bankBalance,
        last_calc_time: now
    });

    // 3. Update Buildings (Upsert batch)
    const buildingData = Object.entries(state.buildings).map(([type, b]) => ({
        player_id: userId,
        building_type: type,
        level: b.level
    }));
    if (buildingData.length > 0) {
        await supabase.from('player_buildings').upsert(buildingData);
    }

    // 4. Update Units (Upsert batch)
    const unitData = Object.entries(state.units).map(([type, count]) => ({
        player_id: userId,
        unit_type: type,
        count: count
    }));
    if (unitData.length > 0) {
        await supabase.from('player_units').upsert(unitData);
    }
}

async function processSingleProfile(userId, now) {
    try {
        let state = await fetchFullState(userId);
        let modified = false;
        let allLogs = [];

        // 1. Process Nemesis/Grudges
        const nemesisResult = processNemesisTick(state, now);
        if (Object.keys(nemesisResult.stateUpdates).length > 0) {
            state = { ...state, ...nemesisResult.stateUpdates };
            allLogs.push(...nemesisResult.logs);
            modified = true;
        }

        // 2. Process Enemy Attack Checks
        const enemyAttackResult = processEnemyAttackCheck(state, now);
        if (Object.keys(enemyAttackResult.stateUpdates).length > 0) {
            state = { ...state, ...enemyAttackResult.stateUpdates };
            allLogs.push(...enemyAttackResult.logs);
            modified = true;
        }

        // 3. Process War Tick
        if (state.activeWar) {
            const warResult = processWarTick(state, now);
            if (Object.keys(warResult.stateUpdates).length > 0) {
                state = { ...state, ...warResult.stateUpdates };
                allLogs.push(...warResult.logs);
                modified = true;
            }
        }

        // 4. Process Attack Queue (Incoming & Outgoing)
        const queueResult = processAttackQueue(state, now);
        if (queueResult.queuedResults.length > 0) {
            state = queueResult.newState;
            allLogs.push(...queueResult.newLogs);
            modified = true;

            for (const item of queueResult.queuedResults) {
                if (item.result?.defenderUpdates) {
                    await applyDefenderUpdates(item.result.defenderUpdates, now);
                }
                if (item.result?.generatedLogisticLoot) {
                    await saveGlobalLoot(item.result.generatedLogisticLoot);
                }
            }
        }

        if (modified) {
            if (allLogs.length > 0) {
                state.logs = [...allLogs, ...(state.logs || [])].slice(0, 100);
            }
            await persistState(userId, state, now);
        }
    } catch (error) {
        console.error(`[Scheduler] Error processing profile ${userId}:`, error);
    }
}

async function applyDefenderUpdates(updates, now) {
    try {
        const { targetId, logKey, logParams, unitsLost, buildingsLost, resourcesLost } = updates;
        
        // Fetch current defender state
        let state = await fetchFullState(targetId);

        if (unitsLost) {
            Object.entries(unitsLost).forEach(([uType, count]) => {
                if (state.units[uType]) {
                    state.units[uType] = Math.max(0, state.units[uType] - count);
                }
            });
        }

        if (buildingsLost) {
            Object.entries(buildingsLost).forEach(([bType, count]) => {
                if (state.buildings[bType]) {
                    state.buildings[bType].level = Math.max(0, state.buildings[bType].level - count);
                }
            });
        }

        if (resourcesLost) {
            Object.entries(resourcesLost).forEach(([res, amount]) => {
                const key = res.toUpperCase();
                if (state.resources[key] !== undefined) {
                    state.resources[key] = Math.max(0, state.resources[key] - amount);
                }
            });
        }

        const newLog = {
            id: `def-log-${targetId}-${now}`,
            messageKey: logKey,
            params: logParams,
            timestamp: now,
            type: 'combat'
        };
        state.logs = [newLog, ...(state.logs || [])].slice(0, 100);

        await persistState(targetId, state, now);
    } catch (e) {
        console.error('[Scheduler] Failed to apply defender updates:', e);
    }
}
