
import { BUILDING_DEFS } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
import { BuildingType, ResourceType, TechType, UnitType } from '../../types';
import { INITIAL_MAX_RESOURCES } from '../../data/initialState';

export interface Multipliers {
    storageMult: number;
    moneyProdMult: number;
    oilProdMult: number;
    ammoProdMult: number;
    goldProdMult: number;
}

export const calculateTechMultipliers = (researchedTechs: TechType[], techLevels: Partial<Record<TechType, number>>): Multipliers => {
    let storageMult = 1.0;
    let moneyProdMult = 1.0;
    let oilProdMult = 1.0;
    let ammoProdMult = 1.0;
    let goldProdMult = 1.0;

    if (researchedTechs.includes(TechType.WAREHOUSING_1)) storageMult += 0.2;
    if (researchedTechs.includes(TechType.RESOURCE_MANAGEMENT)) storageMult += 0.1;
    
    // Production Techs with Levels (+5% per level)
    if (researchedTechs.includes(TechType.EFFICIENT_WORKFLOWS)) {
        const level = techLevels[TechType.EFFICIENT_WORKFLOWS] || 1;
        moneyProdMult += (level * 0.05);
    }
    
    if (researchedTechs.includes(TechType.DEEP_DRILLING)) {
        const level = techLevels[TechType.DEEP_DRILLING] || 1;
        oilProdMult += (level * 0.05);
    }

    if (researchedTechs.includes(TechType.MASS_PRODUCTION)) {
        const level = techLevels[TechType.MASS_PRODUCTION] || 1;
        ammoProdMult += (level * 0.05);
    }

    if (researchedTechs.includes(TechType.GOLD_REFINING)) {
        const level = techLevels[TechType.GOLD_REFINING] || 1;
        goldProdMult += (level * 0.05);
    }

    return { storageMult, moneyProdMult, oilProdMult, ammoProdMult, goldProdMult };
};

// Base Constants for Formula
const FORMULA_BASE_CAP: Record<ResourceType, number> = {
    [ResourceType.MONEY]: 1000000,
    [ResourceType.AMMO]: 100000, 
    [ResourceType.OIL]: 50000,
    [ResourceType.GOLD]: 25000,
    [ResourceType.DIAMOND]: 50 // Base cap for diamonds
};

// Calculates Wallet Storage (Resources)
export const calculateMaxStorage = (
    buildings: Record<BuildingType, { level: number }>, 
    multipliers: Multipliers,
    empirePoints: number
): Record<ResourceType, number> => {
    
    const bankLevel = buildings[BuildingType.BANK].level;

    // SCENARIO A: NO BANK (Starter Pack)
    if (bankLevel === 0) {
        const maxResources = { ...INITIAL_MAX_RESOURCES };
        Object.keys(maxResources).forEach(r => {
            // No storage mult for diamond initial
            if (r !== ResourceType.DIAMOND) {
                maxResources[r as ResourceType] = Math.floor(maxResources[r as ResourceType] * multipliers.storageMult);
            }
        });
        return maxResources;
    }

    // SCENARIO B: HAS BANK (Dynamic Formula for Wallet)
    const maxResources = { ...INITIAL_MAX_RESOURCES }; 
    
    const pointsRatio = Math.max(1, empirePoints / 100); 
    const bankMultiplier = 1 + (0.05 * bankLevel);

    Object.values(ResourceType).forEach(res => {
        const base = FORMULA_BASE_CAP[res];
        let val = (pointsRatio * base) * bankMultiplier;
        
        // Apply Tech Multiplier (After formula)
        if (res !== ResourceType.DIAMOND) {
            val *= multipliers.storageMult;
        } else {
            // Special case for Diamonds: Bank level adds flat +5 per level
            val = INITIAL_MAX_RESOURCES.DIAMOND + (bankLevel * 5);
        }
        
        maxResources[res] = Math.floor(val);
    });

    return maxResources;
};

// Calculates Bank Vault Capacity (Financial Deposits)
export const calculateMaxBankCapacity = (empirePoints: number, bankLevel: number): number => {
    if (bankLevel === 0) return 0;
    
    // Formula: ((pts / 100) * 3.000.000) * (1 + (0.1 * bankLevel))
    // We use Math.max(1, empirePoints) to prevent zero capacity if points are momentarily 0 but bank exists.
    const effectivePoints = Math.max(1, empirePoints);
    const baseCapacity = 3000000;
    
    const capacity = ((effectivePoints / 100) * baseCapacity) * (1 + (0.1 * bankLevel));
    
    return Math.floor(capacity);
};

export const calculateProductionRates = (buildings: Record<BuildingType, { level: number }>, multipliers: Multipliers): Record<ResourceType, number> => {
    const production: Record<ResourceType, number> = {
        [ResourceType.MONEY]: 0,
        [ResourceType.OIL]: 0,
        [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0,
        [ResourceType.DIAMOND]: 0
    };

    (Object.keys(buildings) as BuildingType[]).forEach((bType) => {
        const qty = buildings[bType].level;
        if (qty > 0) {
            const def = BUILDING_DEFS[bType];
            Object.entries(def.productionRate).forEach(([res, rate]) => {
                if (rate) {
                    let finalRate = rate * qty;
                    // Apply Tech Multipliers (Standard Resources only)
                    if (res === ResourceType.MONEY) finalRate *= multipliers.moneyProdMult;
                    if (res === ResourceType.OIL) finalRate *= multipliers.oilProdMult;
                    if (res === ResourceType.AMMO) finalRate *= multipliers.ammoProdMult;
                    if (res === ResourceType.GOLD) finalRate *= multipliers.goldProdMult;
                    // Diamond production is flat per building level, no tech multiplier
                    
                    production[res as ResourceType] += finalRate;
                }
            });
        }
    });

    return production;
};

export const calculateUpkeepCosts = (units: Record<UnitType, number>): Record<ResourceType, number> => {
    const upkeep: Record<ResourceType, number> = {
        [ResourceType.MONEY]: 0,
        [ResourceType.OIL]: 0,
        [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0,
        [ResourceType.DIAMOND]: 0
    };

    (Object.keys(units) as UnitType[]).forEach((uType) => {
        const qty = units[uType];
        if (qty > 0) {
            const def = UNIT_DEFS[uType];
            if (def.upkeep) {
                Object.entries(def.upkeep).forEach(([res, rate]) => {
                    upkeep[res as ResourceType] += (rate * qty);
                });
            }
        }
    });

    return upkeep;
};
