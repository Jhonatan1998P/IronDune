
import { GameState, LogEntry } from '../../types';
import { processEconomyTick } from './economy';
import { processSystemTick, recalculateProgression } from './systems';
import { processRankingEvolution, GROWTH_INTERVAL_MS } from './rankings';
import { processReputationDecay } from './diplomacy';

/**
 * Main game loop for the local client.
 * Focuses on economy, UI progression, and ranking updates.
 * CRITICAL: All combat, missions, and enemy events are delegated to the Remote Battle Server.
 */
export const calculateNextTick = (prev: GameState, deltaTimeMs: number = 1000): { newState: GameState, newLogs: LogEntry[] } => {
    const now = Date.now();
    let currentLogs: LogEntry[] = [];
    let state = { ...prev };

    // 1. Economic Pass (Production, Consumption, Bank, Market)
    // Local processing for immediate UI feedback
    const ecoUpdates = processEconomyTick(state, deltaTimeMs, now);
    state = { ...state, ...ecoUpdates };

    // 2. System/Task Pass (Constructions, Recruitments, Research)
    // These are safe to process locally for smooth progress bars
    const { stateUpdates: taskUpdates, logs: taskLogs } = processSystemTick(state, now, state.activeWar);
    state = { ...state, ...taskUpdates };
    currentLogs = [...currentLogs, ...taskLogs];

    // NOTE: Military, Nemesis, Enemy Attacks, and Salvage are skipped here.
    // The BattleSync mechanism in useGameEngine.ts handles communication with the server.

    // 3. Ranking Evolution (Every 6H of gameplay)
    const rankingElapsed = now - state.rankingData.lastUpdateTime;
    if (rankingElapsed >= GROWTH_INTERVAL_MS) {
        const { bots: updatedBots, cycles } = processRankingEvolution(state.rankingData.bots, rankingElapsed);
        state.rankingData = {
            bots: updatedBots,
            lastUpdateTime: state.rankingData.lastUpdateTime + (cycles * GROWTH_INTERVAL_MS)
        };
    }

    // 4. Reputation Decay (Every 4H of gameplay)
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

    // 5. Global Progression (Score Recalculation, Tutorial Triggers)
    const progUpdates = recalculateProgression(state);
    state = { ...state, ...progUpdates };

    // 6. Final Timestamp Update
    state.lastSaveTime = now;

    return { 
        newState: state, 
        newLogs: currentLogs 
    };
};
