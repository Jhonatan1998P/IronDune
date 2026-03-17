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
import { OFFLINE_PRODUCTION_LIMIT_MS } from './engine/constants.js';
import { processServerEconomyTick } from './engine/economyTick.js';
import { getOrCreatePlayerResources } from './engine/resourceValidator.js';

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
        const resourcesRow = await getOrCreatePlayerResources(profile.id);
        const deltaSinceSave = Math.max(0, now - (state.lastSaveTime || now));
        const deltaTimeMs = Math.min(deltaSinceSave, OFFLINE_PRODUCTION_LIMIT_MS);

        if (deltaTimeMs > 0) {
            const economyResult = processServerEconomyTick(state, resourcesRow, deltaTimeMs, now, { capOffline: true });
            const playerResourceUpdate = {
                money: economyResult.resources.MONEY,
                oil: economyResult.resources.OIL,
                ammo: economyResult.resources.AMMO,
                gold: economyResult.resources.GOLD,
                diamond: economyResult.resources.DIAMOND,
                money_rate: economyResult.rates.money_rate,
                oil_rate: economyResult.rates.oil_rate,
                ammo_rate: economyResult.rates.ammo_rate,
                gold_rate: economyResult.rates.gold_rate,
                diamond_rate: economyResult.rates.diamond_rate,
                money_max: economyResult.maxStorage.money_max,
                oil_max: economyResult.maxStorage.oil_max,
                ammo_max: economyResult.maxStorage.ammo_max,
                gold_max: economyResult.maxStorage.gold_max,
                diamond_max: economyResult.maxStorage.diamond_max,
                bank_balance: economyResult.bankBalance,
                interest_rate: economyResult.interestRate,
                next_rate_change: economyResult.nextRateChange,
                last_tick_at: new Date(now).toISOString(),
                updated_at: new Date().toISOString(),
            };

            await supabase
                .from('player_resources')
                .update(playerResourceUpdate)
                .eq('player_id', profile.id);

            state.resources = economyResult.resources;
            state.maxResources = {
                MONEY: economyResult.maxStorage.money_max,
                OIL: economyResult.maxStorage.oil_max,
                AMMO: economyResult.maxStorage.ammo_max,
                GOLD: economyResult.maxStorage.gold_max,
                DIAMOND: economyResult.maxStorage.diamond_max,
            };
            state.bankBalance = economyResult.bankBalance;
            state.currentInterestRate = economyResult.interestRate;
            state.nextRateChangeTime = economyResult.nextRateChange;
            state.marketOffers = economyResult.marketOffers;
            state.activeMarketEvent = economyResult.activeMarketEvent;
            state.marketNextRefreshTime = economyResult.marketNextRefreshTime;
            state.lifetimeStats = {
                ...(state.lifetimeStats || {}),
                resourcesMined: economyResult.lifetimeResourcesMined,
            };
            modified = true;
        }

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
                // ONLY PvP (P2P) battles generate global loot fields available for all players
                if (item.result?.generatedLogisticLoot && item.result.generatedLogisticLoot.origin === 'P2P') {
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
