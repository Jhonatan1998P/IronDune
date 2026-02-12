
import { BUILDING_DEFS } from '../../../data/buildings';
import { BuildingType, GameState, ResourceType } from '../../../types';
import { calculateConstructionCost, calculateConstructionTime } from '../../formulas';
import { ActionResult } from './types';

export const executeBuild = (state: GameState, type: BuildingType, amount: number): ActionResult => {
    if (amount <= 0) return { success: false };
    if (state.activeConstructions.length >= 3) return { success: false, errorKey: 'queue_full' };

    const def = BUILDING_DEFS[type];
    const currentQty = state.buildings[type].level;
    const queuedQty = state.activeConstructions.filter(c => c.buildingType === type).reduce((sum, c) => sum + c.count, 0);
    const effectiveStartLevel = currentQty + queuedQty;
    
    // Use centralized formula
    const totalCost = calculateConstructionCost(def, effectiveStartLevel, amount);
    const totalTime = calculateConstructionTime(def, effectiveStartLevel, amount);

    if (state.resources[ResourceType.MONEY] < totalCost.money || 
        state.resources[ResourceType.OIL] < totalCost.oil || 
        state.resources[ResourceType.AMMO] < totalCost.ammo) {
        return { success: false, errorKey: 'insufficient_funds' };
    }

    const newState = {
        ...state,
        resources: {
            ...state.resources,
            [ResourceType.MONEY]: state.resources[ResourceType.MONEY] - totalCost.money,
            [ResourceType.OIL]: state.resources[ResourceType.OIL] - totalCost.oil,
            [ResourceType.AMMO]: state.resources[ResourceType.AMMO] - totalCost.ammo,
        },
        activeConstructions: [
            ...state.activeConstructions,
            { id: `build-${Date.now()}`, buildingType: type, count: amount, startTime: Date.now(), endTime: Date.now() + totalTime }
        ]
    };
    return { success: true, newState };
};
