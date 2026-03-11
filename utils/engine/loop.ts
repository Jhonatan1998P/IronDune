
import { GameState, LogEntry } from '../../types';
import { processEconomyTick } from './economy';
import { processSystemTick, recalculateProgression } from './systems';
import { processWarTick } from './war';
import { processNemesisTick } from './nemesis';
import { processEnemyAttackCheck } from './enemyAttack';
import { processRankingEvolution, GROWTH_INTERVAL_MS } from './rankings';
import { processReputationDecay } from './diplomacy';
import { processLogisticLootTick } from './logisticLoot';
import { processBotSalvageCheck } from './botSalvage';

export const calculateNextTick = (prev: GameState, deltaTimeMs: number = 1000): { newState: GameState, newLogs: LogEntry[] } => {
    const now = Date.now();
    let currentLogs: LogEntry[] = [];
    let state = { ...prev };

    // 1. Economic Pass (Production, Consumption, Bank, Market)
    const ecoUpdates = processEconomyTick(state, deltaTimeMs, now);
    state = { ...state, ...ecoUpdates };

    // 2. System/Task Pass (Queues, Research, Missions)
    const { stateUpdates: taskUpdates, logs: taskLogs } = processSystemTick(state, now, state.activeWar);
    state = { ...state, ...taskUpdates };
    currentLogs = [...currentLogs, ...taskLogs];

    // 3. Military/War Pass (Attack System, Inbound Attacks, War Logic)
    const { stateUpdates: warUpdates, logs: warLogs } = processWarTick(state, now);
    state = { ...state, ...warUpdates };
    currentLogs = [...currentLogs, ...warLogs];

    // 3c. Bot Salvage Pass (Bots competing for loot)
    const { stateUpdates: botSalvageUpdates, logs: botSalvageLogs } = processBotSalvageCheck(state, now);
    state = { ...state, ...botSalvageUpdates };
    currentLogs = [...currentLogs, ...botSalvageLogs];

    // 3d. Logistic Loot Pass (Expiration, Cleanup and Auto-salvage)
    // Se ejecuta después de todas las batallas y robos de bots
    if (state.logisticLootFields && state.logisticLootFields.length > 0) {
        const lootResult = processLogisticLootTick(state.logisticLootFields, now);
        state.logisticLootFields = lootResult.active;
        if (lootResult.autoSalvageValue > 0) {
            state.bankBalance += lootResult.autoSalvageValue;
            currentLogs.push({
                id: `loot-expire-${now}`,
                messageKey: 'log_debris_expired', 
                type: 'economy',
                timestamp: now,
                params: { count: lootResult.expired.length, autoSalvageValue: lootResult.autoSalvageValue }
            });
        }
        
        lootResult.expired.forEach(expiredLoot => {
            if (state.lifetimeLogisticStats) {
                state.lifetimeLogisticStats.totalExpired += expiredLoot.totalValue;
            }
        });
    }

    // 4. Nemesis System (Grudges & Retaliation)
    const { stateUpdates: nemesisUpdates, logs: nemesisLogs } = processNemesisTick(state, now);
    state = { ...state, ...nemesisUpdates };
    currentLogs = [...currentLogs, ...nemesisLogs];

    // 4b. Enemy Attack System (30min checks for low reputation bots)
    const { stateUpdates: enemyAttackUpdates, logs: enemyAttackLogs } = processEnemyAttackCheck(state, now);
    state = { ...state, ...enemyAttackUpdates };
    currentLogs = [...currentLogs, ...enemyAttackLogs];

    // 5. Ranking Evolution (Every 6H of gameplay)
    const rankingElapsed = now - state.rankingData.lastUpdateTime;
    if (rankingElapsed >= GROWTH_INTERVAL_MS) {
        const { bots: updatedBots, cycles } = processRankingEvolution(state.rankingData.bots, rankingElapsed);
        state.rankingData = {
            bots: updatedBots,
            lastUpdateTime: state.rankingData.lastUpdateTime + (cycles * GROWTH_INTERVAL_MS)
        };
    }

    // 5b. Reputation Decay (Every 4H of gameplay)
    const { updatedBots: decayedBots, newLastDecayTime } = processReputationDecay(
        state.rankingData.bots,
        state.lastReputationDecayTime,
        now
    );
    if (state.rankingData.bots !== decayedBots) {
        state.rankingData = {
            ...state.rankingData,
            bots: decayedBots
        };
    }
    state.lastReputationDecayTime = newLastDecayTime;

    // 6. Global Progression (Score Recalculation, Tutorial Triggers)
    const progUpdates = recalculateProgression(state);
    state = { ...state, ...progUpdates };

    // 7. Final Timestamp Update
    state.lastSaveTime = now;

    return { 
        newState: state, 
        newLogs: currentLogs 
    };
};
