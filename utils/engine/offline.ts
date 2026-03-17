
import { GameState, ResourceType, OfflineReport, LogEntry } from '../../types';
import { processRankingEvolution, GROWTH_INTERVAL_MS } from './rankings';
import { processReputationDecay } from './diplomacy';

/**
 * Calculates offline progress for timers and progression.
 * Military missions and attacks are EXCLUSIVELY handled by the Remote Battle Server.
 */
export const calculateOfflineProgress = (state: GameState): { newState: GameState, report: OfflineReport, newLogs: LogEntry[] } => {
    const now = Date.now();
    const timeElapsed = now - state.lastSaveTime;

    const report: OfflineReport = {
        timeElapsed,
        resourcesGained: {
            [ResourceType.MONEY]: 0,
            [ResourceType.OIL]: 0,
            [ResourceType.AMMO]: 0,
            [ResourceType.GOLD]: 0,
            [ResourceType.DIAMOND]: 0,
        },
        resourcesConsumed: {
            [ResourceType.MONEY]: 0,
            [ResourceType.OIL]: 0,
            [ResourceType.AMMO]: 0,
            [ResourceType.GOLD]: 0,
            [ResourceType.DIAMOND]: 0,
        },
        bankInterestEarned: 0,
        completedResearch: [],
        completedMissions: [],
        queuedAttackResults: [],
    };

    const newLogs: LogEntry[] = [];

    if (timeElapsed < 60000) {
        return { newState: state, report, newLogs };
    }

    let newState = JSON.parse(JSON.stringify(state)) as GameState;

    // 1. Constructions
    const remainingConstructions: typeof newState.activeConstructions = [];
    for (const c of newState.activeConstructions) {
        if (now >= c.endTime) {
            newState.buildings[c.buildingType] = { 
                ...newState.buildings[c.buildingType],
                level: newState.buildings[c.buildingType].level + c.count 
            };
        } else {
            remainingConstructions.push(c);
        }
    }
    newState.activeConstructions = remainingConstructions;

    // 2. Recruitments
    const remainingRecruitments: typeof newState.activeRecruitments = [];
    for (const r of newState.activeRecruitments) {
        if (now >= r.endTime) {
            newState.units[r.unitType] = (newState.units[r.unitType] || 0) + r.count;
        } else {
            remainingRecruitments.push(r);
        }
    }
    newState.activeRecruitments = remainingRecruitments;

    // 3. Research
    if (newState.activeResearch && now >= newState.activeResearch.endTime) {
        const techId = newState.activeResearch.techId;
        newState.techLevels[techId] = (newState.techLevels[techId] || 0) + 1;
        if (!newState.researchedTechs.includes(techId)) {
            newState.researchedTechs.push(techId);
        }
        report.completedResearch.push(techId);
        newState.activeResearch = null;
    }

    // 4. Rankings & Reputation Decay
    if (now - newState.rankingData.lastUpdateTime >= GROWTH_INTERVAL_MS) {
        const { bots: updatedBots, cycles } = processRankingEvolution(
            newState.rankingData.bots, 
            now - newState.rankingData.lastUpdateTime
        );
        newState.rankingData = {
            bots: updatedBots,
            lastUpdateTime: newState.rankingData.lastUpdateTime + (cycles * GROWTH_INTERVAL_MS)
        };
    }

    const { updatedBots: decayedBots, newLastDecayTime } = processReputationDecay(
        newState.rankingData.bots,
        newState.lastReputationDecayTime,
        now
    );
    newState.rankingData = { ...newState.rankingData, bots: decayedBots };
    newState.lastReputationDecayTime = newLastDecayTime;

    // IMPORTANT: Missions and attacks are NOT processed here. 
    // They will be synced with the server once the user returns and useGameEngine triggers BattleSync.

    newState.lastSaveTime = now;
    return { newState, report, newLogs };
};
