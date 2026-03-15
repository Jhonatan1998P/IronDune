
import { GameState, ResourceType, BuildingType, OfflineReport, LogEntry } from '../../types';
import { calculateTechMultipliers, calculateMaxStorage, calculateProductionRates, calculateUpkeepCosts } from './modifiers';
import { 
    OFFLINE_PRODUCTION_LIMIT_MS,
    calculateMaxBankCapacity,
    calculateInterestEarned
} from '../../constants';
import { processRankingEvolution, GROWTH_INTERVAL_MS } from './rankings';
import { processReputationDecay } from './diplomacy';

/**
 * Calculates basic offline progress (Resources, Buildings, Research).
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

    const MAX_OFFLINE_MS = 24 * 60 * 60 * 1000;
    const effectiveTimeMs = Math.min(Math.max(0, timeElapsed), Math.min(MAX_OFFLINE_MS, OFFLINE_PRODUCTION_LIMIT_MS));
    const effectiveTimeSecs = effectiveTimeMs / 1000;

    let newState = JSON.parse(JSON.stringify(state)) as GameState;

    // 1. Production & Upkeep
    const multipliers = calculateTechMultipliers(newState.researchedTechs, newState.techLevels);
    const prodRates = calculateProductionRates(newState.buildings, multipliers);
    const upkeepCosts = calculateUpkeepCosts(newState.units);
    const maxStorage = calculateMaxStorage(newState.buildings, multipliers, newState.empirePoints);

    Object.values(ResourceType).forEach((res) => {
        const prod = (prodRates[res] || 0) * effectiveTimeSecs;
        const upkeep = (upkeepCosts[res] || 0) * effectiveTimeSecs;
        const netChange = prod - upkeep;

        if (res === ResourceType.DIAMOND) {
            const diamondMine = newState.buildings[BuildingType.DIAMOND_MINE];
            if (diamondMine && diamondMine.level > 0 && diamondMine.isDamaged) {
                newState.resources[res] = Math.max(0, newState.resources[res] - upkeep);
                return;
            }
        }

        const prevAmount = newState.resources[res];
        if (netChange > 0) {
            const availableSpace = Math.max(0, maxStorage[res] - prevAmount);
            const actualGain = Math.min(netChange, availableSpace);
            newState.resources[res] = prevAmount + actualGain;
            report.resourcesGained[res] = Math.floor(newState.resources[res]) - Math.floor(prevAmount);
        } else if (netChange < 0) {
            newState.resources[res] = Math.max(0, prevAmount + netChange);
            report.resourcesConsumed[res] = Math.floor(prevAmount) - Math.floor(newState.resources[res]);
        }
    });

    // 2. Bank Interest
    if (newState.bankBalance > 0 && newState.buildings[BuildingType.BANK].level > 0) {
        const maxBankCapacity = calculateMaxBankCapacity(newState.empirePoints, newState.buildings[BuildingType.BANK].level);
        if (newState.bankBalance < maxBankCapacity) {
            const interestEarned = calculateInterestEarned(newState.bankBalance, newState.currentInterestRate, effectiveTimeMs);
            const actualInterest = Math.min(maxBankCapacity - newState.bankBalance, interestEarned);
            newState.bankBalance += actualInterest;
            report.bankInterestEarned = Math.floor(actualInterest);
        }
    }

    // 3. Constructions
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

    // 4. Recruitments
    const remainingRecruitments: typeof newState.activeRecruitments = [];
    for (const r of newState.activeRecruitments) {
        if (now >= r.endTime) {
            newState.units[r.unitType] = (newState.units[r.unitType] || 0) + r.count;
        } else {
            remainingRecruitments.push(r);
        }
    }
    newState.activeRecruitments = remainingRecruitments;

    // 5. Research
    const remainingResearch: typeof newState.activeResearch = [];
    for (const r of (newState.activeResearch || [])) {
        if (now >= r.endTime) {
            const techId = r.techId;
            newState.techLevels[techId] = r.targetLevel || (newState.techLevels[techId] || 0) + 1;
            if (!newState.researchedTechs.includes(techId)) {
                newState.researchedTechs.push(techId);
            }
            report.completedResearch.push(techId);
        } else {
            remainingResearch.push(r);
        }
    }
    newState.activeResearch = remainingResearch;

    // 6. Rankings & Reputation Decay
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
