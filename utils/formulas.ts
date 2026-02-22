
import { BANK_LEVEL_CAPACITIES } from "../constants";
import { BuildingDef, BuildingType, ResourceType, TechDef, UnitDef } from "../types";

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
        const nextLevel = currentLvl + 1; // Target Level for upgrade

        // --- SPECIAL CASE: BANK ---
        // Cost is 10% of the capacity of the *next* level (the one being built)
        if (def.id === BuildingType.BANK) {
            const targetCapacity = nextLevel < BANK_LEVEL_CAPACITIES.length 
                ? BANK_LEVEL_CAPACITIES[nextLevel] 
                : BANK_LEVEL_CAPACITIES[BANK_LEVEL_CAPACITIES.length - 1]; // Cap if over max defined
            
            const bankCost = Math.floor(targetCapacity * 0.10);
            totalMoney += bankCost;
            // Bank only costs money in this specific override
            continue; 
        }

        // --- STANDARD BUILDINGS ---
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

export const calculateRepairCost = (
    def: BuildingDef,
    currentLevel: number
): { money: number; oil: number; ammo: number } => {
    // Repair cost is 10% of the NEXT level cost (current level + 1)
    // effectively mimicking the cost it would take to build this level again but cheaper
    // Note: Request says "(costo próximo nivel / 10)".
    // If I have level 5, next is 6. 
    // calculateConstructionCost(def, 5, 1) calculates cost for level 6.
    
    const baseCost = calculateConstructionCost(def, currentLevel, 1);
    
    return {
        money: Math.floor(baseCost.money / 10),
        oil: Math.floor(baseCost.oil / 10),
        ammo: Math.floor(baseCost.ammo / 10)
    };
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

export const calculateEspionageCost = (targetScore: number, playerLevel: number): number => {
    return Math.floor((5000 + (targetScore * 2)) / 5);
};
