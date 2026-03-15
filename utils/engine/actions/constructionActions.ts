
import { BUILDING_DEFS } from '../../../data/buildings';
import { BuildingType, GameState, ResourceType } from '../../../types';
import { calculateConstructionCost, calculateConstructionTime, calculateRepairCost } from '../../formulas';
import { ActionResult } from './types';

export const executeBuild = (state: GameState, type: BuildingType, amount: number): ActionResult => {
    if (amount <= 0) return { success: false };
    if (state.activeConstructions.length >= 3) return { success: false, errorKey: 'queue_full' };

    const def = BUILDING_DEFS[type];
    const currentQty = state.buildings[type].level;
    
    // Cannot upgrade a damaged building (Diamond Mine specific)
    if (state.buildings[type].isDamaged) {
        return { success: false, errorKey: 'status_damaged' };
    }

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

export const executeRepair = (state: GameState, type: BuildingType): ActionResult => {
    // Only damaged buildings can be repaired
    if (!state.buildings[type].isDamaged) return { success: false };
    
    const def = BUILDING_DEFS[type];
    const currentLevel = state.buildings[type].level;
    
    // Calculate 10% cost
    const repairCost = calculateRepairCost(def, currentLevel);

    if (state.resources[ResourceType.MONEY] < repairCost.money || 
        state.resources[ResourceType.OIL] < repairCost.oil || 
        state.resources[ResourceType.AMMO] < repairCost.ammo) {
        return { success: false, errorKey: 'insufficient_funds' };
    }

    // Repairs are instant for now (simplification) or could use construction queue
    // Given the request implies paying cost to fix, instant seems better UX for damage recovery
    const newState = {
        ...state,
        resources: {
            ...state.resources,
            [ResourceType.MONEY]: state.resources[ResourceType.MONEY] - repairCost.money,
            [ResourceType.OIL]: state.resources[ResourceType.OIL] - repairCost.oil,
            [ResourceType.AMMO]: state.resources[ResourceType.AMMO] - repairCost.ammo,
        },
        buildings: {
            ...state.buildings,
            [type]: {
                ...state.buildings[type],
                isDamaged: false
            }
        },
        // Log the repair event
        logs: [{
            id: `repair-${Date.now()}`,
            messageKey: 'status_repaired',
            type: 'info' as const,
            timestamp: Date.now(),
            params: { building: type }
        }, ...state.logs].slice(0, 100)
    };

    return { success: true, newState };
};
