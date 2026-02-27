
import { BuildingDef, BuildingType, ResourceType } from '../types';

const PER_10_MINUTES = 600;
const rate = (amount: number) => amount / PER_10_MINUTES;

// Configuración de Balanceo
const QUANTITY_MULT = 1.05;
// LEVEL_MULT genérico para edificios civiles
const LEVEL_MULT = 1.50; 

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  // --- ECONOMY ---
  [BuildingType.HOUSE]: {
    id: BuildingType.HOUSE,
    translationKey: 'house',
    buildMode: 'QUANTITY',
    baseCost: { money: 1000, oil: 0, ammo: 0 },
    costMultiplier: QUANTITY_MULT,
    productionRate: { [ResourceType.MONEY]: rate(500) }, // 500/10m
    maxLevel: 200,
    buildTime: 30000, // 30s (Updated)
    imagePlaceholder: 'https://picsum.photos/200/200?grayscale',
    score: 1,
  },
  [BuildingType.FACTORY]: {
    id: BuildingType.FACTORY,
    translationKey: 'factory',
    buildMode: 'QUANTITY',
    baseCost: { money: 25000, oil: 500, ammo: 0 },
    costMultiplier: QUANTITY_MULT,
    productionRate: { [ResourceType.MONEY]: rate(2500) }, // 2500/10m
    maxLevel: 100,
    buildTime: 30000, // 30s (Updated)
    imagePlaceholder: 'https://picsum.photos/201/201?grayscale',
    score: 5,
  },
  [BuildingType.SKYSCRAPER]: {
    id: BuildingType.SKYSCRAPER,
    translationKey: 'skyscraper',
    buildMode: 'QUANTITY',
    baseCost: { money: 5000000, oil: 100000, ammo: 0 },
    costMultiplier: QUANTITY_MULT,
    productionRate: { [ResourceType.MONEY]: rate(5000) }, // 5000/10m
    maxLevel: 100,
    buildTime: 30000, // 30s (Updated from 1m)
    imagePlaceholder: 'https://picsum.photos/202/202?grayscale',
    score: 100,
  },
  [BuildingType.BANK]: {
    id: BuildingType.BANK,
    translationKey: 'bank',
    buildMode: 'LEVEL',
    // Base cost is overridden by calculateConstructionCost in formulas.ts based on Capacity Table
    baseCost: { money: 500000, oil: 0, ammo: 0 }, 
    costMultiplier: 1.0, // Overridden
    costScaling: 'EXPONENTIAL', 
    productionRate: {},
    maxLevel: 15, // Capped at 15 per fixed table
    buildTime: 30000, // 30s
    imagePlaceholder: 'https://picsum.photos/203/203?grayscale',
    score: 50,
  },
  [BuildingType.MARKET]: {
    id: BuildingType.MARKET,
    translationKey: 'market',
    buildMode: 'LEVEL',
    baseCost: { money: 25000, oil: 0, ammo: 0 },
    costMultiplier: LEVEL_MULT,
    productionRate: {},
    maxLevel: 5,
    buildTime: 10000, // 10s
    imagePlaceholder: 'https://picsum.photos/204/204?grayscale',
    score: 15,
  },
  [BuildingType.DIAMOND_MINE]: {
    id: BuildingType.DIAMOND_MINE,
    translationKey: 'diamond_mine',
    buildMode: 'LEVEL',
    baseCost: { money: 10000000, oil: 0, ammo: 0 },
    costMultiplier: 5.0, 
    costScaling: 'EXPONENTIAL',
    // 1 Diamond per hour per level (1 / 6 per 10 mins)
    productionRate: { [ResourceType.DIAMOND]: rate(1/6) }, 
    maxLevel: 5,
    buildTime: 300000, // 5m
    imagePlaceholder: '',
    score: 500,
  },

  // --- RESOURCES ---
  [BuildingType.OIL_RIG]: {
    id: BuildingType.OIL_RIG,
    translationKey: 'oil_rig',
    buildMode: 'QUANTITY',
    baseCost: { money: 10000, oil: 0, ammo: 0 },
    costMultiplier: QUANTITY_MULT,
    productionRate: { [ResourceType.OIL]: rate(200) }, // 200/10m
    maxLevel: 100,
    buildTime: 30000, // 30s (Updated)
    imagePlaceholder: 'https://picsum.photos/205/205?grayscale',
    score: 3,
  },
  [BuildingType.GOLD_MINE]: {
    id: BuildingType.GOLD_MINE,
    translationKey: 'gold_mine',
    buildMode: 'QUANTITY',
    baseCost: { money: 15000, oil: 500, ammo: 0 },
    costMultiplier: QUANTITY_MULT,
    productionRate: { [ResourceType.GOLD]: rate(64) }, // 64/10m
    maxLevel: 50,
    buildTime: 30000, // 30s (Updated)
    imagePlaceholder: 'https://picsum.photos/206/206?grayscale',
    score: 25,
  },
  [BuildingType.MUNITIONS_FACTORY]: {
    id: BuildingType.MUNITIONS_FACTORY,
    translationKey: 'munitions_factory',
    buildMode: 'QUANTITY',
    baseCost: { money: 10000, oil: 200, ammo: 0 },
    costMultiplier: QUANTITY_MULT,
    productionRate: { [ResourceType.AMMO]: rate(700) }, // 700/10m
    maxLevel: 100,
    buildTime: 30000, // 30s (Updated)
    imagePlaceholder: 'https://picsum.photos/207/207?grayscale',
    score: 4,
  },

  // --- MILITARY / TECH ---
  [BuildingType.UNIVERSITY]: {
    id: BuildingType.UNIVERSITY,
    translationKey: 'university',
    buildMode: 'LEVEL',
    baseCost: { money: 50000, oil: 5000, ammo: 0 },
    costMultiplier: 2.05, 
    productionRate: {},
    maxLevel: 15, 
    buildTime: 30000, 
    imagePlaceholder: 'https://picsum.photos/208/208?grayscale',
    score: 40,
  },
  
  [BuildingType.BARRACKS]: {
    id: BuildingType.BARRACKS,
    translationKey: 'barracks',
    buildMode: 'LEVEL',
    baseCost: { money: 50000, oil: 0, ammo: 1000 },
    costMultiplier: 2.25,
    productionRate: {},
    maxLevel: 20,
    buildTime: 15000, 
    imagePlaceholder: 'https://picsum.photos/209/209?grayscale',
    score: 10,
  },
  
  [BuildingType.TANK_FACTORY]: {
    id: BuildingType.TANK_FACTORY,
    translationKey: 'tank_factory',
    buildMode: 'LEVEL',
    baseCost: { money: 500000, oil: 25000, ammo: 10000 },
    costMultiplier: 1.9,
    productionRate: {},
    maxLevel: 15,
    buildTime: 60000, // 1m
    imagePlaceholder: 'https://picsum.photos/210/210?grayscale',
    score: 35,
  },
  
  [BuildingType.SHIPYARD]: {
    id: BuildingType.SHIPYARD,
    translationKey: 'shipyard',
    buildMode: 'LEVEL',
    baseCost: { money: 1000000, oil: 50000, ammo: 20000 },
    costMultiplier: 1.75,
    productionRate: {},
    maxLevel: 10,
    buildTime: 90000, // 1m 30s
    imagePlaceholder: 'https://picsum.photos/211/211?grayscale',
    score: 35,
  },
  
  [BuildingType.AIRFIELD]: {
    id: BuildingType.AIRFIELD,
    translationKey: 'airfield',
    buildMode: 'LEVEL',
    baseCost: { money: 1500000, oil: 100000, ammo: 50000 },
    costMultiplier: 1.70,
    productionRate: {},
    maxLevel: 10,
    buildTime: 120000, // 2m
    imagePlaceholder: 'https://picsum.photos/212/212?grayscale',
    score: 35,
  },
};

export const INITIAL_BUILDINGS: Record<BuildingType, { level: number; isDamaged?: boolean }> = Object.values(BuildingType).reduce((acc, type) => {
  acc[type] = { level: 0, isDamaged: false };
  return acc;
}, {} as Record<BuildingType, { level: number; isDamaged?: boolean }>);
