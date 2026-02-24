import { BUILDING_DEFS } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
import { TECH_DEFS } from '../../data/techs';
import { GameState, ResourceType, TechType, BuildingType, OfflineReport, LogEntry, IncomingAttack, WarState, UnitType } from '../../types';
import { resolveMission } from './missions';
import { calculateTechMultipliers, calculateMaxStorage, calculateProductionRates, calculateUpkeepCosts, calculateMaxBankCapacity } from './modifiers';
import { 
    OFFLINE_PRODUCTION_LIMIT_MS,
    ATTACK_COOLDOWN_MIN_MS,
    ATTACK_COOLDOWN_MAX_MS
} from '../../constants';
import { simulateCombat } from './combat';
import { processRankingEvolution, GROWTH_INTERVAL_MS } from './rankings';

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
        bankInterestEarned: 0,
        completedResearch: [],
        completedMissions: [],
    };

    const newLogs: LogEntry[] = [];

    if (timeElapsed < 60000) {
        return { newState: state, report, newLogs };
    }

    let newState = { ...state };
    
    const effectiveTimeMs = Math.min(timeElapsed, OFFLINE_PRODUCTION_LIMIT_MS);
    const effectiveTimeSecs = effectiveTimeMs / 1000;

    const multipliers = calculateTechMultipliers(newState.researchedTechs, newState.techLevels);
    const prodRates = calculateProductionRates(newState.buildings, multipliers);
    const upkeepCosts = calculateUpkeepCosts(newState.units);
    const maxStorage = calculateMaxStorage(newState.buildings, multipliers, newState.empirePoints);

    Object.values(ResourceType).forEach((res) => {
        const prod = (prodRates[res] || 0) * effectiveTimeSecs;
        const upkeep = (upkeepCosts[res] || 0) * effectiveTimeSecs;
        let netChange = prod - upkeep;

        if (res === ResourceType.DIAMOND) {
            const diamondMine = newState.buildings[BuildingType.DIAMOND_MINE];
            if (diamondMine && !diamondMine.isDamaged && diamondMine.level > 0) {
                const baseDiamondProd = (1 / 3600) * effectiveTimeSecs;
                netChange += baseDiamondProd;
            }
        }

        if (netChange > 0) {
            report.resourcesGained[res] = Math.floor(netChange);
        }

        newState.resources[res] = Math.max(0, Math.min(maxStorage[res], newState.resources[res] + netChange));
    });

    if (newState.bankBalance > 0 && newState.buildings[BuildingType.BANK].level > 0) {
        const maxBankCapacity = calculateMaxBankCapacity(newState.empirePoints, newState.buildings[BuildingType.BANK].level);
        if (newState.bankBalance < maxBankCapacity) {
            const minuteRate = newState.currentInterestRate / 360; 
            const timeInMinutes = effectiveTimeMs / 60000;
            const interestEarned = newState.bankBalance * minuteRate * timeInMinutes;
            const actualInterest = Math.min(maxBankCapacity - newState.bankBalance, interestEarned);
            newState.bankBalance += actualInterest;
            report.bankInterestEarned = Math.floor(actualInterest);
        }
    }

    const remainingConstructions: typeof newState.activeConstructions = [];
    for (const c of newState.activeConstructions) {
        if (now >= c.endTime) {
            newState.buildings[c.buildingType] = { level: newState.buildings[c.buildingType].level + c.count };
        } else {
            remainingConstructions.push(c);
        }
    }
    newState.activeConstructions = remainingConstructions;

    const remainingRecruitments: typeof newState.activeRecruitments = [];
    for (const r of newState.activeRecruitments) {
        if (now >= r.endTime) {
            newState.units[r.unitType] = (newState.units[r.unitType] || 0) + r.count;
        } else {
            remainingRecruitments.push(r);
        }
    }
    newState.activeRecruitments = remainingRecruitments;

    if (newState.activeResearch && now >= newState.activeResearch.endTime) {
        const techId = newState.activeResearch.techId;
        newState.techLevels[techId] = (newState.techLevels[techId] || 0) + 1;
        if (!newState.researchedTechs.includes(techId)) {
            newState.researchedTechs.push(techId);
        }
        report.completedResearch.push(techId);
        newState.activeResearch = null;
    }

    let nextAttackTime = newState.nextAttackTime || 0;
    if (now > nextAttackTime) {
        const wait = ATTACK_COOLDOWN_MIN_MS + Math.random() * (ATTACK_COOLDOWN_MAX_MS - ATTACK_COOLDOWN_MIN_MS);
        nextAttackTime = now + wait;
    }
    newState.nextAttackTime = nextAttackTime;

    const remainingMissions: typeof newState.activeMissions = [];
    for (const mission of newState.activeMissions) {
        if (now >= mission.endTime) {
            const outcome = resolveMission(
                mission,
                newState.resources,
                newState.maxResources,
                newState.campaignProgress,
                newState.techLevels,
                newState.activeWar,
                mission.endTime,
                newState.rankingData.bots,
                newState.empirePoints,
                newState.buildings,
                newState.targetAttackCounts
            );
            
            Object.assign(newState.resources, outcome.resources);
            Object.entries(outcome.unitsToAdd).forEach(([uType, qty]) => {
                newState.units[uType as UnitType] = (newState.units[uType as UnitType] || 0) + (qty as number);
            });
            
            if (outcome.buildingsToAdd) {
                Object.entries(outcome.buildingsToAdd).forEach(([bId, qty]) => {
                    const bType = bId as BuildingType;
                    if (!newState.buildings[bType]) newState.buildings[bType] = { level: 0 };
                    newState.buildings[bType].level += (qty as number);
                });
            }
            
            if (mission.type === 'CAMPAIGN_ATTACK') {
                newState.lastCampaignMissionFinishedTime = Math.max(newState.lastCampaignMissionFinishedTime, mission.endTime);
                if (outcome.newCampaignProgress) newState.campaignProgress = Math.max(newState.campaignProgress, outcome.newCampaignProgress);
            }
            
            if (outcome.newGrudge) {
                newState.grudges.push(outcome.newGrudge);
            }
            
            const isSuccess = outcome.logKey === 'log_battle_win' || outcome.logKey.includes('patrol_battle_win') || outcome.logKey.includes('contraband');
            report.completedMissions.push({
                id: mission.id,
                success: isSuccess,
                loot: outcome.logParams?.loot || {}
            });
            
            newLogs.push({
                id: `mis-res-${mission.endTime}-${mission.id}`,
                messageKey: outcome.logKey,
                type: outcome.logType as any,
                timestamp: mission.endTime,
                params: outcome.logParams
            });
        } else {
            remainingMissions.push(mission);
        }
    }
    newState.activeMissions = remainingMissions;

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

    return { newState, report, newLogs };
};
