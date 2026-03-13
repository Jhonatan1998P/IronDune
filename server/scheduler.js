/**
 * BACKGROUND SCHEDULER
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
    console.log('[Scheduler] Starting background battle processor...');
    setInterval(processOfflinePlayers, SCHEDULER_INTERVAL_MS);
};

async function processOfflinePlayers() {
    try {
        const now = Date.now();
        const staleTime = new Date(now - STALE_THRESHOLD_MS).toISOString();

        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, game_state, updated_at')
            .lt('updated_at', staleTime)
            .limit(50);

        if (error) throw error;
        if (!profiles || profiles.length === 0) return;

        console.log(`[Scheduler] Checking ${profiles.length} offline profiles...`);

        for (const profile of profiles) {
            await processSingleProfile(profile, now);
        }
    } catch (error) {
        console.error('[Scheduler] Error in processing loop:', error);
    }
}

async function processSingleProfile(profile, now) {
    let state = profile.game_state;
    if (!state) return;
    let modified = false;
    let allLogs = [];

    try {
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
            state.lastSaveTime = now;
            await supabase
                .from('profiles')
                .update({ game_state: state, updated_at: new Date().toISOString() })
                .eq('id', profile.id);
        }
    } catch (error) {
        console.error(`[Scheduler] Error processing profile ${profile.id}:`, error);
    }
}

async function applyDefenderUpdates(updates, now) {
    try {
        const { targetId, logKey, logParams, unitsLost, buildingsLost } = updates;
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('game_state')
            .eq('id', targetId)
            .single();

        if (error || !profile) return;
        let defenderState = profile.game_state;

        if (unitsLost) {
            Object.entries(unitsLost).forEach(([uType, count]) => {
                if (defenderState.units[uType]) {
                    defenderState.units[uType] = Math.max(0, defenderState.units[uType] - count);
                }
            });
        }

        if (buildingsLost) {
            Object.entries(buildingsLost).forEach(([bType, count]) => {
                if (defenderState.buildings[bType]) {
                    defenderState.buildings[bType].level = Math.max(0, defenderState.buildings[bType].level - count);
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
        defenderState.logs = [newLog, ...(defenderState.logs || [])].slice(0, 100);

        await supabase
            .from('profiles')
            .update({ game_state: defenderState, updated_at: new Date().toISOString() })
            .eq('id', targetId);
    } catch (e) {
        console.error('[Scheduler] Failed to apply defender updates:', e);
    }
}
