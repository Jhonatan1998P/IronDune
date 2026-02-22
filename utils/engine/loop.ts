
import { GameState, LogEntry } from '../../types';
import { processEconomyTick } from './economy';
import { processSystemTick, recalculateProgression } from './systems';
import { processWarTick } from './war';
import { processNemesisTick } from './nemesis';
import { processRankingEvolution, GROWTH_INTERVAL_MS } from './rankings';

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

    // 4. Nemesis System (Grudges & Retaliation)
    const { stateUpdates: nemesisUpdates, logs: nemesisLogs } = processNemesisTick(state, now);
    state = { ...state, ...nemesisUpdates };
    currentLogs = [...currentLogs, ...nemesisLogs];

    // 5. Ranking Evolution (Periodic 6H check)
    if (now - state.rankingData.lastUpdateTime >= GROWTH_INTERVAL_MS) {
        const { bots: updatedBots, cycles } = processRankingEvolution(state.rankingData.bots, now - state.rankingData.lastUpdateTime);
        state.rankingData = {
            bots: updatedBots,
            // Advance time by exact intervals to prevent drift
            lastUpdateTime: state.rankingData.lastUpdateTime + (cycles * GROWTH_INTERVAL_MS) 
        };
    }

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
