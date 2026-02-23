
import { GameState, LogEntry } from '../../types';
import { processEconomyTick } from './economy';
import { processSystemTick, recalculateProgression } from './systems';
import { processWarTick } from './war';
import { processNemesisTick } from './nemesis';
import { processRankingEvolution, GROWTH_INTERVAL_MS } from './rankings';
import { processBotSimulationTick, BOT_UPDATE_INTERVAL } from './botSimulation';
import { processFactionTick } from './factions';
import { processDiplomacyTick } from './diplomacy';
import { processCoordinatedOperations } from './coordinatedAttacks';
import { processBotDecisions } from '../ai/decisionEngine';
import { processDiplomaticAI } from '../ai/diplomaticAI';

// Intervals for advanced AI systems (less frequent than main tick)
const AI_TICK_INTERVAL = 30 * 1000; // 30 seconds
let lastAITickTime = 0;

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

    // ══════════════════════════════════════════
    // ADVANCED AI SYSTEMS (New - runs less frequently)
    // ══════════════════════════════════════════
    if (now - lastAITickTime >= AI_TICK_INTERVAL) {
        lastAITickTime = now;

        // 5.1 Bot Economy Simulation (deferred calculation)
        if (state.botStates && Object.keys(state.botStates).length > 0) {
            state.botStates = processBotSimulationTick(state.botStates, now);
        }

        // 5.2 Bot AI Decision Making
        if (state.botStates && Object.keys(state.botStates).length > 0) {
            const worldState = {
                botStates: state.botStates,
                factions: state.factions || {},
                diplomacy: state.diplomacy || { proposals: {}, treaties: {}, worldEvents: [] },
                operations: state.operations || {},
                playerArmyScore: state.empirePoints,
                playerFactionId: state.playerFactionId || undefined
            };
            state.botStates = processBotDecisions(state.botStates, worldState, now);
        }

        // 5.3 Diplomatic AI (bots initiating diplomatic actions)
        if (state.botStates && state.diplomacy) {
            state.diplomacy = processDiplomaticAI(
                state.botStates,
                state.factions || {},
                state.diplomacy,
                now
            );
        }

        // 5.4 Faction Stability & Management
        if (state.factions && Object.keys(state.factions).length > 0) {
            const { factions: updatedFactions, events: factionEvents } = processFactionTick(
                state.factions,
                state.botStates || {},
                now
            );
            state.factions = updatedFactions;

            // Add faction events to world events
            if (factionEvents.length > 0 && state.diplomacy) {
                state.diplomacy = {
                    ...state.diplomacy,
                    worldEvents: [...state.diplomacy.worldEvents, ...factionEvents].slice(-100)
                };

                // Generate logs for major events
                for (const event of factionEvents) {
                    if (event.impact === 'major' || event.impact === 'critical') {
                        currentLogs.push({
                            id: `log-${now}-${Math.random().toString(36).substr(2, 4)}`,
                            messageKey: 'common.war.worldEvent',
                            params: { description: event.description, eventType: event.type },
                            timestamp: now,
                            type: 'war'
                        });
                    }
                }
            }
        }

        // 5.5 Diplomacy Processing (proposals, treaties)
        if (state.diplomacy) {
            const { diplomacy: updatedDiplomacy, events: dipEvents } = processDiplomacyTick(
                state.diplomacy,
                state.botStates || {},
                state.factions || {},
                now
            );
            state.diplomacy = updatedDiplomacy;
        }

        // 5.6 Coordinated Operations
        if (state.operations && Object.keys(state.operations).length > 0) {
            const { operations: updatedOps, events: opEvents, updatedBots } = processCoordinatedOperations(
                state.operations,
                state.botStates || {},
                now
            );
            state.operations = updatedOps;
            state.botStates = { ...state.botStates, ...updatedBots };

            // Generate logs for operation events
            for (const event of opEvents) {
                currentLogs.push({
                    id: `log-op-${now}-${Math.random().toString(36).substr(2, 4)}`,
                    messageKey: 'common.war.operationEvent',
                    params: { description: event.description },
                    timestamp: now,
                    type: 'intel'
                });
            }
        }
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
