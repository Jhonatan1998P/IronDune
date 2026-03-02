
import { BANK_LEVEL_CAPACITIES } from "../constants";
import { BuildingDef, BuildingType, ResourceType, TechDef, UnitDef } from "../types";

/**
 * BUILDING FORMULAS
 */

/**
 * Calculates the total cost for constructing/upgrading a specific amount of levels/buildings.
 * Handles both QUANTITY (linear batch) and LEVEL (exponential) scaling.
 */
export const calculateConstructionCost = (
    def: BuildingDef,
    startLevel: number,
    count: number
): { money: number; oil: number; ammo: number } => {
    // --- SPECIAL CASE: BANK ---
    // Cost is 10% of the capacity of the *next* level (the one being built)
    if (def.id === BuildingType.BANK) {
        let totalMoney = 0;
        for (let i = 0; i < count; i++) {
            const nextLevel = startLevel + i + 1;
            const targetCapacity = nextLevel < BANK_LEVEL_CAPACITIES.length
                ? BANK_LEVEL_CAPACITIES[nextLevel]
                : BANK_LEVEL_CAPACITIES[BANK_LEVEL_CAPACITIES.length - 1];
            totalMoney += Math.floor(targetCapacity * 0.10);
        }
        return { money: totalMoney, oil: 0, ammo: 0 };
    }

    // --- QUANTITY MODE BUILDINGS (House, Factory, Oil Rig, etc.) ---
    // Formula: Costo = baseCost × Σ(multiplier ^ (startLevel + i)) para i de 1 a count
    // Cada edificio cuesta más que el anterior (1.5% increase acumulativo)
    // Ejemplo: 1ra casa = 1000 × 1.015^1 = 1015, 2da casa = 1000 × 1.015^2 = 1030, etc.
    if (def.buildMode === 'QUANTITY') {
        let totalMoney = 0;
        let totalOil = 0;
        let totalAmmo = 0;

        for (let i = 1; i <= count; i++) {
            const multiplier = Math.pow(def.costMultiplier, startLevel + i);
            totalMoney += Math.floor(def.baseCost.money * multiplier);
            totalOil += Math.floor(def.baseCost.oil * multiplier);
            totalAmmo += Math.floor(def.baseCost.ammo * multiplier);
        }

        return { money: totalMoney, oil: totalOil, ammo: totalAmmo };
    }

    // --- LEVEL MODE BUILDINGS (Bank, Market, University, etc.) ---
    // Each level costs progressively more: baseCost × (multiplier ^ currentLevel)
    let totalMoney = 0;
    let totalOil = 0;
    let totalAmmo = 0;

    for (let i = 0; i < count; i++) {
        const currentLvl = startLevel + i;
        const multiplier = Math.pow(def.costMultiplier, currentLvl);

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
    // --- QUANTITY MODE: Each building costs exponentially more ---
    // Need to iterate and sum costs until we exceed budget
    if (def.buildMode === 'QUANTITY') {
        let count = 0;
        let currentMoney = resources[ResourceType.MONEY];
        let currentOil = resources[ResourceType.OIL];
        let currentAmmo = resources[ResourceType.AMMO];

        // Safety limit to avoid infinite loops in UI
        while (count < 100) {
            // Cost of next building (position = count + 1)
            const nextCost = calculateConstructionCost(def, startLevel, count + 1);
            const prevCost = count > 0 ? calculateConstructionCost(def, startLevel, count) : { money: 0, oil: 0, ammo: 0 };
            
            // Marginal cost of the next building
            const marginalMoney = nextCost.money - prevCost.money;
            const marginalOil = nextCost.oil - prevCost.oil;
            const marginalAmmo = nextCost.ammo - prevCost.ammo;

            if (currentMoney >= marginalMoney &&
                currentOil >= marginalOil &&
                currentAmmo >= marginalAmmo) {

                currentMoney -= marginalMoney;
                currentOil -= marginalOil;
                currentAmmo -= marginalAmmo;
                count++;
            } else {
                break;
            }
        }
        return Math.max(1, count);
    }

    // --- LEVEL MODE: Each level costs more, so we iterate ---
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
    return Math.floor(Math.random() * (targetScore * 5)) + 5000
};
