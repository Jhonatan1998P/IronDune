import { ActiveMission, LogisticLootField, ResourceType, UnitType } from '../../types';
import { DEBRIS_ELIGIBLE_RESOURCES, SALVAGER_CARGO_CAPACITY } from '../../constants';

export interface SalvageResult {
    success: boolean;
    reason: 'EXPIRED' | 'HARVESTED' | 'NO_DRONES';
    resources: Partial<Record<ResourceType, number>>;
    dronesReturned: number;
    remainingLoot?: LogisticLootField;
}

export const resolveSalvageMission = (
    mission: ActiveMission,
    lootField: LogisticLootField | undefined
): SalvageResult => {
    
    // 1. Verificar que el campo aún existe y tiene recursos
    if (!lootField || lootField.expiresAt < Date.now()) {
        return { 
            success: false, 
            reason: 'EXPIRED', 
            resources: {},
            dronesReturned: mission.units?.[UnitType.SALVAGER_DRONE] || 0
        };
    }
    
    // 2. Calcular capacidad de carga total de los drones enviados
    const dronesCount = mission.units?.[UnitType.SALVAGER_DRONE] || 0;
    if (dronesCount <= 0) {
         return {
            success: false,
            reason: 'NO_DRONES',
            resources: {},
            dronesReturned: 0,
            remainingLoot: lootField
         };
    }
    
    const totalCapacity = dronesCount * SALVAGER_CARGO_CAPACITY;
    
    // 3. Recolectar recursos proporcionalmente hasta llenar capacidad
    const CARGO_CONVERSION_RATES: Record<ResourceType, number> = {
        [ResourceType.MONEY]: 1,
        [ResourceType.OIL]: 10,
        [ResourceType.AMMO]: 5,
        [ResourceType.GOLD]: 50,
        [ResourceType.DIAMOND]: 500,
    };
    
    const harvested: Partial<Record<ResourceType, number>> = {};
    let capacityUsed = 0;
    const remaining = { ...lootField.resources };
    
    for (const res of DEBRIS_ELIGIBLE_RESOURCES) {
        const available = remaining[res] || 0;
        if (available <= 0) continue;
        
        const valuePerUnit = CARGO_CONVERSION_RATES[res];
        const maxCanTake = Math.floor((totalCapacity - capacityUsed) / valuePerUnit);
        const toTake = Math.min(available, maxCanTake);
        
        if (toTake > 0) {
            harvested[res] = toTake;
            remaining[res] = available - toTake;
            capacityUsed += toTake * valuePerUnit;
        }
        
        if (capacityUsed >= totalCapacity) break;
    }
    
    const newLootField: LogisticLootField = {
        ...lootField,
        resources: remaining,
        isPartiallyHarvested: true,
        harvestCount: (lootField.harvestCount || 0) + 1,
        totalValue: Object.values(remaining).reduce((a, b) => a + (b || 0), 0)
    };
    
    return {
        success: true,
        reason: 'HARVESTED',
        resources: harvested,
        dronesReturned: dronesCount, // Todos regresan en PvE
        remainingLoot: newLootField
    };
};
