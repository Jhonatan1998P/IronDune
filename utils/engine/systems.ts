
import { BuildingType, GameState, LogEntry, UnitType, WarState, RankingCategory } from '../../types';
import { TUTORIAL_STEPS } from '../../data/tutorial';
import { BUILDING_DEFS } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
import { TECH_DEFS } from '../../data/techs';

/**
 * Handles localized UI progression: construction, recruitment, and research.
 * CRITICAL: Missions, Attacks, and War are now handled by the Remote Battle Server.
 */
export const processSystemTick = (state: GameState, now: number, _activeWar: WarState | null): { stateUpdates: Partial<GameState>, logs: LogEntry[] } => {
    const logs: LogEntry[] = [];
    const newBuildings = { ...state.buildings };
    const newUnits = { ...state.units };

    // 1. Constructions (Local UI update)
    const updatedConstructions = state.activeConstructions.filter(c => {
        if (now >= c.endTime) {
            newBuildings[c.buildingType] = {
                ...newBuildings[c.buildingType],
                level: newBuildings[c.buildingType].level + c.count
            };
            return false;
        }
        return true;
    });

    // 2. Recruitments (Local UI update)
    const updatedRecruitments = state.activeRecruitments.filter(r => {
        if (now >= r.endTime) {
            newUnits[r.unitType] = (newUnits[r.unitType] || 0) + r.count;
            return false;
        }
        return true;
    });

    // 3. Research (Local UI update)
    let updatedResearchedTechs = [...state.researchedTechs];
    let updatedTechLevels = { ...state.techLevels };
    let updatedActiveResearch = state.activeResearch;
    if (state.activeResearch && now >= state.activeResearch.endTime) {
       const techId = state.activeResearch.techId;
       updatedTechLevels[techId] = (updatedTechLevels[techId] || 0) + 1;
       if (!updatedResearchedTechs.includes(techId)) updatedResearchedTechs.push(techId);
       updatedActiveResearch = null;
    }

    return {
        stateUpdates: {
            buildings: newBuildings,
            units: newUnits,
            activeConstructions: updatedConstructions,
            activeRecruitments: updatedRecruitments,
            researchedTechs: updatedResearchedTechs,
            techLevels: updatedTechLevels,
            activeResearch: updatedActiveResearch,
        },
        logs
    };
};

/**
 * Calculates total Empire Points and checks Tutorial/Objectives status.
 */
export const recalculateProgression = (state: GameState): Partial<GameState> => {
    // 1. Keep client-side score logic aligned with legacy frontend (v5.5).
    let militaryPoints = 0;
    let economyPoints = 0;
    let techPoints = 0;

    Object.keys(state.units).forEach((u) => {
        const uType = u as UnitType;
        militaryPoints += Number(state.units[uType] || 0) * Number(UNIT_DEFS[uType]?.score || 0);
    });

    state.activeMissions.forEach((mission) => {
        Object.entries(mission.units).forEach(([uType, qty]) => {
            militaryPoints += Number(qty || 0) * Number(UNIT_DEFS[uType as UnitType]?.score || 0);
        });
    });

    Object.keys(state.buildings).forEach((b) => {
        const bType = b as BuildingType;
        const buildingLevel = Number(state.buildings[bType]?.level || 0);
        const score = buildingLevel * Number(BUILDING_DEFS[bType]?.score || 0);
        if (bType === BuildingType.BARRACKS || bType === BuildingType.TANK_FACTORY || bType === BuildingType.SHIPYARD || bType === BuildingType.AIRFIELD) {
            militaryPoints += score;
        } else {
            economyPoints += score;
        }
    });

    state.researchedTechs.forEach((techId) => {
        techPoints += Number(TECH_DEFS[techId]?.score || 0);
    });

    const bankPoints = Math.floor(Number(state.bankBalance || 0) / 100000);
    economyPoints += bankPoints;

    const totalPoints = Math.max(0, Math.floor(militaryPoints + economyPoints + techPoints));

    // 2. Check Tutorial
    let tutorialClaimable = state.tutorialClaimable;
    if (state.currentTutorialId && !tutorialClaimable) {
        const step = TUTORIAL_STEPS.find(s => s.id === state.currentTutorialId);
        if (step) {
            try {
                if (step.condition(state)) tutorialClaimable = true;
            } catch {
                tutorialClaimable = false;
            }
        }
    }

    return {
        empirePoints: totalPoints,
        rankingStats: {
            [RankingCategory.DOMINION]: totalPoints,
            [RankingCategory.MILITARY]: militaryPoints,
            [RankingCategory.ECONOMY]: economyPoints,
            [RankingCategory.CAMPAIGN]: state.campaignProgress
        },
        tutorialClaimable
    };
};
