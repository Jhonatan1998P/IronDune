
import { TECH_DEFS } from '../../../data/techs';
import { BuildingType, GameState, ResourceType, TechType } from '../../../types';
import { calculateResearchCost } from '../../formulas';
import { ActionResult } from './types';

export const executeResearch = (state: GameState, techId: TechType): ActionResult => {
    const def = TECH_DEFS[techId];
    if (!def) return { success: false, errorKey: 'unknown_tech' };
    
    const currentLevel = state.techLevels[techId] || 0;
    const maxLevel = def.maxLevel || 1;
    if (currentLevel >= maxLevel) return { success: false }; 
    if (maxLevel === 1 && state.researchedTechs.includes(techId)) return { success: false };
    if (state.activeResearch) return { success: false, errorKey: 'research_busy' };

    // Validations
    let reqUniversityLvl = def.reqUniversityLevel;
    // SPECIAL CASE: STRATEGIC_COMMAND requires University level = 3 + (currentLevel)
    if (techId === TechType.STRATEGIC_COMMAND) {
        reqUniversityLvl = 3 + currentLevel;
    }
    if (state.buildings[BuildingType.UNIVERSITY].level < reqUniversityLvl) return { success: false, errorKey: 'req_building' };
    
    if (def.reqBuildings) {
        for (const [bType, lvl] of Object.entries(def.reqBuildings)) {
            let requiredLvl = lvl as number;
            // SPECIAL CASE: PATROL_TRAINING requires Barracks level = Next Research Level
            if (techId === TechType.PATROL_TRAINING && bType === BuildingType.BARRACKS) {
                requiredLvl = currentLevel + 1;
            }
            if (state.buildings[bType as BuildingType].level < requiredLvl) return { success: false, errorKey: 'req_building' };
        }
    }
    
    if (def.reqTechs) {
        if (!def.reqTechs.every(t => state.researchedTechs.includes(t))) return { success: false, errorKey: 'req_tech' };
    }
    
    // NEW: Empire Points Validation
    if (def.reqEmpirePoints && state.empirePoints < def.reqEmpirePoints) {
        return { success: false, errorKey: 'req_score' };
    }

    const calculatedCost = calculateResearchCost(def, currentLevel);

    if (state.resources[ResourceType.MONEY] < calculatedCost.money || 
        state.resources[ResourceType.OIL] < calculatedCost.oil || 
        state.resources[ResourceType.AMMO] < calculatedCost.ammo ||
        (calculatedCost.gold && state.resources[ResourceType.GOLD] < calculatedCost.gold) ||
        (calculatedCost.diamond && state.resources[ResourceType.DIAMOND] < calculatedCost.diamond)) {
        return { success: false, errorKey: 'insufficient_funds' };
    }

    const newState = {
        ...state,
        resources: {
            ...state.resources,
            [ResourceType.MONEY]: state.resources[ResourceType.MONEY] - calculatedCost.money,
            [ResourceType.OIL]: state.resources[ResourceType.OIL] - calculatedCost.oil,
            [ResourceType.AMMO]: state.resources[ResourceType.AMMO] - calculatedCost.ammo,
            [ResourceType.GOLD]: state.resources[ResourceType.GOLD] - (calculatedCost.gold || 0),
            [ResourceType.DIAMOND]: state.resources[ResourceType.DIAMOND] - (calculatedCost.diamond || 0),
        },
        activeResearch: { techId, startTime: Date.now(), endTime: Date.now() + def.researchTime }
    };
    return { success: true, newState };
};
