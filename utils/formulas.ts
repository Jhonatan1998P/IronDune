
import { BuildingDef, ResourceType, TechDef, UnitDef } from "../types";

/**
 * BUILDING FORMULAS
 */

/**
 * Calculates the total cost for constructing/upgrading a specific amount of levels/buildings.
 * Handles both LINEAR (Quantity) and EXPONENTIAL (Level) scaling.
 */
export const calculateConstructionCost = (
    def: BuildingDef, 
    startLevel: number, 
    count: number
): { money: number; oil: number; ammo: number } => {
    let totalMoney = 0;
    let totalOil = 0;
    let totalAmmo = 0;

    for (let i = 0; i < count; i++) {
        const currentLvl = startLevel + i;
        let multiplier = 0;
        
        if (def.costScaling === 'LINEAR') {
            multiplier = 1 + (def.costMultiplier * currentLvl);
        } else {
            // Default exponential scaling
            multiplier = Math.pow(def.costMultiplier, currentLvl);
        }
        
        totalMoney += Math.floor(def.baseCost.money * multiplier);
        totalOil += Math.floor(def.baseCost.oil * multiplier);
        totalAmmo += Math.floor(def.baseCost.ammo * multiplier);
    }

    return { money: totalMoney, oil: totalOil, ammo: totalAmmo };
};

/**
 * Calculates the total construction time.
 * Quantity Mode: Base time * quantity.
 * Level Mode: Base time scales exponentially (x1.5 per level).
 */
export const calculateConstructionTime = (
    def: BuildingDef, 
    startLevel: number, 
    count: number
): number => {
    if (def.buildMode === 'QUANTITY') {
        return def.buildTime * count;
    } else {
        let totalT = 0;
        for (let i = 0; i < count; i++) {
            const currentLvl = startLevel + i;
            const timeMultiplier = Math.pow(1.5, currentLvl);
            totalT += Math.floor(def.buildTime * timeMultiplier);
        }
        return totalT;
    }
};

/**
 * Calculates the max affordable buildings based on current resources.
 */
export const calculateMaxAffordableBuildings = (
    def: BuildingDef, 
    startLevel: number, 
    resources: Record<ResourceType, number>
): number => {
    let count = 0;
    let currentMoney = resources[ResourceType.MONEY];
    let currentOil = resources[ResourceType.OIL];
    let currentAmmo = resources[ResourceType.AMMO];
    
    // Safety limit to avoid infinite loops in UI
    while (count < 100) {
        const nextCost = calculateConstructionCost(def, startLevel + count, 1);
        
        if (currentMoney >= nextCost.money && 
            currentOil >= nextCost.oil && 
            currentAmmo >= nextCost.ammo) {
            
            currentMoney -= nextCost.money;
            currentOil -= nextCost.oil;
            currentAmmo -= nextCost.ammo;
            count++;
        } else {
            break;
        }
    }
    return Math.max(1, count);
};

/**
 * UNIT FORMULAS
 */

export const calculateRecruitmentCost = (
    def: UnitDef, 
    amount: number
): { money: number; oil: number; ammo: number } => {
    // Units typically have linear scaling (Batch recruitment)
    return {
        money: def.cost.money * amount,
        oil: def.cost.oil * amount,
        ammo: def.cost.ammo * amount
    };
};

export const calculateRecruitmentTime = (
    def: UnitDef, 
    amount: number
): number => {
    return def.recruitTime * amount;
};

export const calculateMaxAffordableUnits = (
    def: UnitDef,
    resources: Record<ResourceType, number>
): number => {
    const maxMoney = Math.floor(resources[ResourceType.MONEY] / def.cost.money);
    const maxOil = def.cost.oil > 0 ? Math.floor(resources[ResourceType.OIL] / def.cost.oil) : Infinity;
    const maxAmmo = def.cost.ammo > 0 ? Math.floor(resources[ResourceType.AMMO] / def.cost.ammo) : Infinity;
    const max = Math.min(maxMoney, maxOil, maxAmmo);
    // Cap at 100 for UI/Gameplay balance reasons per batch
    return Math.max(1, Math.min(max, 100)); 
};

/**
 * RESEARCH FORMULAS
 */

export const calculateResearchCost = (
    def: TechDef, 
    currentLevel: number
): { money: number; oil: number; ammo: number } => {
    const multiplier = Math.pow(def.costMultiplier || 1, currentLevel);
    return {
        money: Math.floor(def.cost.money * multiplier),
        oil: Math.floor(def.cost.oil * multiplier),
        ammo: Math.floor(def.cost.ammo * multiplier)
    };
};
