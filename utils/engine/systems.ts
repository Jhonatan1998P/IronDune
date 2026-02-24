
import { BuildingType, GameState, LogEntry, ResourceType, UnitType, WarState } from '../../types';
import { resolveMission } from './missions';
import { TUTORIAL_STEPS } from '../../data/tutorial';
import { BUILDING_DEFS } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
import { TECH_DEFS } from '../../data/techs';
import { REPUTATION_MIN, REPUTATION_MAX, REPUTATION_ALLY_THRESHOLD } from '../../constants';

/**
 * Handles construction, recruitment, research, missions and general progression.
 */
export const processSystemTick = (state: GameState, now: number, activeWar: WarState | null): { stateUpdates: Partial<GameState>, logs: LogEntry[] } => {
    const logs: LogEntry[] = [];
    const newBuildings = { ...state.buildings };
    const newUnits = { ...state.units };
    const newResources = { ...state.resources }; // Clone resources to accumulate rewards
    const newLifetimeStats = { ...state.lifetimeStats };
    let newCampaignProgress = state.campaignProgress;
    let newLastCampaignTime = state.lastCampaignMissionFinishedTime;
    let updatedGrudges = [...state.grudges || []]; // Ensure it exists
    let updatedRankingBots = [...state.rankingData.bots];

    // 1. Constructions
    const updatedConstructions = state.activeConstructions.filter(c => {
        if (now >= c.endTime) {
            newBuildings[c.buildingType] = { level: newBuildings[c.buildingType].level + c.count };
            return false;
        }
        return true;
    });

    // 2. Recruitments
    const updatedRecruitments = state.activeRecruitments.filter(r => {
        if (now >= r.endTime) {
            newUnits[r.unitType] = (newUnits[r.unitType] || 0) + r.count;
            return false;
        }
        return true;
    });

    // 3. Research
    let updatedResearchedTechs = [...state.researchedTechs];
    let updatedTechLevels = { ...state.techLevels };
    let updatedActiveResearch = state.activeResearch;
    if (state.activeResearch && now >= state.activeResearch.endTime) {
       const techId = state.activeResearch.techId;
       updatedTechLevels[techId] = (updatedTechLevels[techId] || 0) + 1;
       if (!updatedResearchedTechs.includes(techId)) updatedResearchedTechs.push(techId);
       updatedActiveResearch = null;
    }

    // 4. Missions
    const updatedMissions = state.activeMissions.filter((mission, idx) => {
        if (now >= mission.endTime) {
            const outcome = resolveMission(
                mission, 
                newResources, // Pass the currently accumulating resources, not the stale state
                state.maxResources, 
                state.campaignProgress, 
                state.techLevels, 
                activeWar, 
                now, 
                state.rankingData.bots,
                state.empirePoints
            );
            
            // Apply outcome to local resources
            Object.assign(newResources, outcome.resources);

            // Apply outcome to local units
            Object.entries(outcome.unitsToAdd).forEach(([uType, qty]) => {
                newUnits[uType as UnitType] = (newUnits[uType as UnitType] || 0) + (qty as number);
            });

            // Apply outcome to local buildings (NEW: Plunder System)
            if (outcome.buildingsToAdd) {
                Object.entries(outcome.buildingsToAdd).forEach(([bId, qty]) => {
                    const bType = bId as BuildingType;
                    // Ensure building entry exists
                    if (!newBuildings[bType]) newBuildings[bType] = { level: 0 };
                    
                    newBuildings[bType] = {
                        level: newBuildings[bType].level + (qty as number)
                    };
                });
            }

            if (outcome.logParams?.combatResult) {
                const combat = outcome.logParams.combatResult;
                newLifetimeStats.unitsLost += Object.values(combat.totalPlayerCasualties).reduce((a:any, b:any) => a + b, 0) as number;
                newLifetimeStats.enemiesKilled += Object.values(combat.totalEnemyCasualties).reduce((a:any, b:any) => a + b, 0) as number;
            }

            if (outcome.logKey === 'log_battle_win' || outcome.logKey.includes('patrol_battle_win')) {
                newLifetimeStats.missionsCompleted++;
            }

            if (mission.type === 'CAMPAIGN_ATTACK') {
                newLastCampaignTime = now;
                if (outcome.newCampaignProgress) newCampaignProgress = Math.max(newCampaignProgress, outcome.newCampaignProgress);
            }

            // --- GRUDGE HANDLING ---
            if (outcome.newGrudge) {
                updatedGrudges.push(outcome.newGrudge);
            }

            // --- REPUTATION HANDLING ---
            if (outcome.reputationChanges && outcome.reputationChanges.length > 0) {
                updatedRankingBots = updatedRankingBots.map(bot => {
                    const change = outcome.reputationChanges?.find(r => r.botId === bot.id);
                    if (change) {
                        const newRep = Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, (bot.reputation || 50) + change.change));
                        return { ...bot, reputation: newRep };
                    }
                    return bot;
                });

                const alliesBefore = state.rankingData.bots.filter(b => (b.reputation || 50) >= REPUTATION_ALLY_THRESHOLD);
                const alliesAfter = updatedRankingBots.filter(b => (b.reputation || 50) >= REPUTATION_ALLY_THRESHOLD);
                if (alliesAfter.length > alliesBefore.length) {
                    logs.push({
                        id: `rep-gain-${now}`,
                        messageKey: 'log_new_ally',
                        type: 'info',
                        timestamp: now,
                        params: {}
                    });
                }
            }

            logs.push({
                id: `mis-res-${now}-${idx}`,
                messageKey: outcome.logKey,
                type: outcome.logType,
                timestamp: now,
                params: outcome.logParams
            });
            return false;
        }
        return true;
    });

    return {
        stateUpdates: {
            resources: newResources, // Return updated resources
            buildings: newBuildings,
            units: newUnits,
            activeConstructions: updatedConstructions,
            activeRecruitments: updatedRecruitments,
            researchedTechs: updatedResearchedTechs,
            techLevels: updatedTechLevels,
            activeResearch: updatedActiveResearch,
            activeMissions: updatedMissions,
            campaignProgress: newCampaignProgress,
            lastCampaignMissionFinishedTime: newLastCampaignTime,
            lifetimeStats: newLifetimeStats,
            grudges: updatedGrudges,
            rankingData: {
                bots: updatedRankingBots,
                lastUpdateTime: state.rankingData.lastUpdateTime
            }
        },
        logs
    };
};

/**
 * Calculates total Empire Points and checks Tutorial/Objectives status.
 */
export const recalculateProgression = (state: GameState): Partial<GameState> => {
    // 1. Calculate Score
    let points = 0;
    Object.keys(state.buildings).forEach(b => points += state.buildings[b as BuildingType].level * (BUILDING_DEFS[b as BuildingType].score || 0));
    
    // Base units
    Object.keys(state.units).forEach(u => points += state.units[u as UnitType] * (UNIT_DEFS[u as UnitType].score || 0));
    
    // Units on active missions still count towards empire points
    state.activeMissions.forEach(mission => {
        Object.entries(mission.units).forEach(([uType, qty]) => {
            points += (qty || 0) * (UNIT_DEFS[uType as UnitType].score || 0);
        });
    });
    
    state.researchedTechs.forEach(t => points += (TECH_DEFS[t]?.score || 0));
    points += Math.floor(state.bankBalance / 100000);

    // 2. Check Tutorial
    let tutorialClaimable = state.tutorialClaimable;
    if (state.currentTutorialId && !tutorialClaimable) {
        const step = TUTORIAL_STEPS.find(s => s.id === state.currentTutorialId);
        if (step && step.condition(state)) tutorialClaimable = true;
    }

    return {
        empirePoints: points,
        tutorialClaimable
    };
};
