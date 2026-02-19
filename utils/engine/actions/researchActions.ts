
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
    if (state.buildings[BuildingType.UNIVERSITY].level < def.reqUniversityLevel) return { success: false, errorKey: 'req_building' };
    
    if (def.reqBuildings) {
        for (const [bType, lvl] of Object.entries(def.reqBuildings)) {
            if (state.buildings[bType as BuildingType].level < (lvl as number)) return { success: false, errorKey: 'req_building' };
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
        state.resources[ResourceType.AMMO] < calculatedCost.ammo) {
        return { success: false, errorKey: 'insufficient_funds' };
    }

    const newState = {
        ...state,
        resources: {
            ...state.resources,
            [ResourceType.MONEY]: state.resources[ResourceType.MONEY] - calculatedCost.money,
            [ResourceType.OIL]: state.resources[ResourceType.OIL] - calculatedCost.oil,
            [ResourceType.AMMO]: state.resources[ResourceType.AMMO] - calculatedCost.ammo,
        },
        activeResearch: { techId, startTime: Date.now(), endTime: Date.now() + def.researchTime }
    };
    return { success: true, newState };
};
