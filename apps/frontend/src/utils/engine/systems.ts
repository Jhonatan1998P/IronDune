
import { BuildingType, GameState, LogEntry, UnitType, WarState, TechType } from '../../types';
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
    const updatedActiveResearch = (state.activeResearch || []).filter(r => {
        if (now >= r.endTime) {
            const techId = r.techId;
            updatedTechLevels[techId] = r.targetLevel || (updatedTechLevels[techId] || 0) + 1;
            if (!updatedResearchedTechs.includes(techId)) updatedResearchedTechs.push(techId);
            return false;
        }
        return true;
    });

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
    // 1. Calculate Score
    let points = 0;
    let pointsEconomy = 0;
    let pointsCombat = 0;

    // Buildings
    Object.keys(state.buildings).forEach(b => {
        const lvl = state.buildings[b as BuildingType].level;
        const scorePerLvl = BUILDING_DEFS[b as BuildingType].score || 0;
        const p = lvl * scorePerLvl;
        points += p;

        // Categorizar
        if (b === BuildingType.HOUSE || b === BuildingType.FACTORY || b === BuildingType.SKYSCRAPER || b === BuildingType.OIL_RIG || b === BuildingType.GOLD_MINE || b === BuildingType.BANK || b === BuildingType.DIAMOND_MINE) {
            pointsEconomy += p;
        } else {
            pointsCombat += p;
        }
    });
    
    // Base units
    Object.keys(state.units).forEach(u => {
        const p = state.units[u as UnitType] * (UNIT_DEFS[u as UnitType].score || 0);
        points += p;
        pointsCombat += p;
    });
    
    // Units on active missions still count towards empire points
    state.activeMissions.forEach(mission => {
        Object.entries(mission.units).forEach(([uType, qty]) => {
            const p = (qty || 0) * (UNIT_DEFS[uType as UnitType].score || 0);
            points += p;
            pointsCombat += p;
        });
    });
    
    state.researchedTechs.forEach(t => {
        const p = (TECH_DEFS[t]?.score || 0);
        points += p;
        if (t === TechType.DEEP_DRILLING || t === TechType.GOLD_REFINING || t === TechType.MASS_PRODUCTION) {
            pointsEconomy += p;
        } else {
            pointsCombat += p;
        }
    });

    const bankPoints = Math.floor(state.bankBalance / 100000);
    points += bankPoints;
    pointsEconomy += bankPoints;

    // 2. Check Tutorial
    let tutorialClaimable = state.tutorialClaimable;
    if (state.currentTutorialId && !tutorialClaimable) {
        const step = TUTORIAL_STEPS.find(s => s.id === state.currentTutorialId);
        if (step && step.condition(state)) tutorialClaimable = true;
    }

    return {
        empirePoints: points,
        combatPoints: pointsCombat,
        economyPoints: pointsEconomy,
        campaignPoints: state.campaignProgress * 100, // Heurística simple
        tutorialClaimable
    };
};
