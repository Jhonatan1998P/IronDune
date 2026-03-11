
import { BUILDING_DEFS } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
import { BuildingType, ResourceType, TechType, UnitType } from '../../types';
import { UNLIMITED_CAPACITY, calculateMaxBankCapacity } from '../../constants';

export { calculateMaxBankCapacity };

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

// Calculates Wallet Storage (Resources)
export const calculateMaxStorage = (
    buildings: Record<BuildingType, { level: number }>,
    _multipliers: Multipliers,
    _empirePoints: number
): Record<ResourceType, number> => {

    const diamondMineLevel = buildings[BuildingType.DIAMOND_MINE]?.level || 0;

    // Diamond capacity is strictly based on mine level: +10 per level
    const diamondCapacity = diamondMineLevel * 10;

    const maxResources: Record<ResourceType, number> = {
        [ResourceType.MONEY]: UNLIMITED_CAPACITY,
        [ResourceType.OIL]: UNLIMITED_CAPACITY,
        [ResourceType.AMMO]: UNLIMITED_CAPACITY,
        [ResourceType.GOLD]: UNLIMITED_CAPACITY,
        [ResourceType.DIAMOND]: Math.max(10, diamondCapacity)
    };

    return maxResources;
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
