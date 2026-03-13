// ============================================================
// UNIT_DEFS - Mirror of data/units.ts (no TypeScript)
// ============================================================

import { UnitType, ResourceType, TechType, UnitCategory } from './enums.js';

const PER_10_MINUTES = 600;
const rate = (amount) => amount / PER_10_MINUTES;

export const UNIT_DEFS = {
  [UnitType.CYBER_MARINE]: {
    id: UnitType.CYBER_MARINE,
    category: UnitCategory.GROUND,
    reqTech: TechType.UNLOCK_CYBER_MARINE,
    hp: 200, attack: 25, defense: 10, threshold: 0.1,
    recruitTime: 60000,
    cost: { money: 15000, oil: 0, ammo: 50 },
    upkeep: { [ResourceType.MONEY]: rate(50), [ResourceType.AMMO]: rate(5) },
    rapidFire: {},
    score: 5,
  },
  [UnitType.HEAVY_COMMANDO]: {
    id: UnitType.HEAVY_COMMANDO,
    category: UnitCategory.GROUND,
    reqTech: TechType.UNLOCK_HEAVY_COMMANDO,
    hp: 400, attack: 60, defense: 20, threshold: 0.2,
    recruitTime: 120000,
    cost: { money: 50000, oil: 0, ammo: 250 },
    upkeep: { [ResourceType.MONEY]: rate(150), [ResourceType.AMMO]: rate(20) },
    rapidFire: {
      [UnitType.SCOUT_TANK]: 0.86,
      [UnitType.TITAN_MBT]: 0.86,
    },
    score: 15,
  },
  [UnitType.SCOUT_TANK]: {
    id: UnitType.SCOUT_TANK,
    category: UnitCategory.TANK,
    reqTech: TechType.UNLOCK_SCOUT_TANK,
    hp: 1000, attack: 200, defense: 50, threshold: 0.5,
    recruitTime: 180000,
    cost: { money: 125000, oil: 125, ammo: 750 },
    upkeep: { [ResourceType.MONEY]: rate(300), [ResourceType.OIL]: rate(25) },
    rapidFire: {
      [UnitType.CYBER_MARINE]: 0.88,
      [UnitType.HEAVY_COMMANDO]: 0.88,
    },
    score: 40,
  },
  [UnitType.TITAN_MBT]: {
    id: UnitType.TITAN_MBT,
    category: UnitCategory.TANK,
    reqTech: TechType.UNLOCK_TITAN_MBT,
    hp: 3000, attack: 450, defense: 125, threshold: 1.25,
    recruitTime: 300000,
    cost: { money: 250000, oil: 500, ammo: 1500 },
    upkeep: { [ResourceType.MONEY]: rate(800), [ResourceType.OIL]: rate(100) },
    rapidFire: {
      [UnitType.AEGIS_DESTROYER]: 0.89,
      [UnitType.PHANTOM_SUB]: 0.89,
    },
    score: 80,
  },
  [UnitType.WRAITH_GUNSHIP]: {
    id: UnitType.WRAITH_GUNSHIP,
    category: UnitCategory.AIR,
    reqTech: TechType.UNLOCK_WRAITH_GUNSHIP,
    hp: 6000, attack: 1000, defense: 200, threshold: 2.0,
    recruitTime: 420000,
    cost: { money: 700000, oil: 1250, ammo: 5000 },
    upkeep: { [ResourceType.MONEY]: rate(2000), [ResourceType.OIL]: rate(250) },
    rapidFire: {
      [UnitType.SCOUT_TANK]: 0.91,
      [UnitType.TITAN_MBT]: 0.91,
    },
    score: 150,
  },
  [UnitType.ACE_FIGHTER]: {
    id: UnitType.ACE_FIGHTER,
    category: UnitCategory.AIR,
    reqTech: TechType.UNLOCK_ACE_FIGHTER,
    hp: 10000, attack: 2000, defense: 500, threshold: 5.0,
    recruitTime: 600000,
    cost: { money: 2000000, oil: 3000, ammo: 15000 },
    upkeep: { [ResourceType.MONEY]: rate(5000), [ResourceType.OIL]: rate(600) },
    rapidFire: {
      [UnitType.WRAITH_GUNSHIP]: 0.92,
      [UnitType.ACE_FIGHTER]: 0.92,
    },
    score: 300,
  },
  [UnitType.AEGIS_DESTROYER]: {
    id: UnitType.AEGIS_DESTROYER,
    category: UnitCategory.NAVAL,
    reqTech: TechType.UNLOCK_AEGIS_DESTROYER,
    hp: 25000, attack: 3500, defense: 200, threshold: 2.0,
    recruitTime: 720000,
    cost: { money: 6000000, oil: 50000, ammo: 100000 },
    upkeep: { [ResourceType.MONEY]: rate(15000), [ResourceType.OIL]: rate(2000) },
    rapidFire: {
      [UnitType.ACE_FIGHTER]: 0.94,
      [UnitType.WRAITH_GUNSHIP]: 0.94,
    },
    score: 600,
  },
  [UnitType.PHANTOM_SUB]: {
    id: UnitType.PHANTOM_SUB,
    category: UnitCategory.NAVAL,
    reqTech: TechType.UNLOCK_PHANTOM_SUB,
    hp: 125000, attack: 10000, defense: 5000, threshold: 50.0,
    recruitTime: 900000,
    cost: { money: 15000000, oil: 1500000, ammo: 5000000 },
    upkeep: { [ResourceType.MONEY]: rate(40000), [ResourceType.OIL]: rate(5000) },
    rapidFire: {
      [UnitType.PHANTOM_SUB]: 0.95,
      [UnitType.AEGIS_DESTROYER]: 0.95,
      [UnitType.ACE_FIGHTER]: 0.95,
      [UnitType.WRAITH_GUNSHIP]: 0.95,
      [UnitType.SCOUT_TANK]: 0.95,
      [UnitType.TITAN_MBT]: 0.95,
      [UnitType.HEAVY_COMMANDO]: 0.95,
      [UnitType.CYBER_MARINE]: 0.95,
    },
    score: 1200,
  },
  [UnitType.SALVAGER_DRONE]: {
    id: UnitType.SALVAGER_DRONE,
    category: UnitCategory.GROUND,
    reqTech: TechType.UNLOCK_SALVAGER_DRONE,
    hp: 500, attack: 10, defense: 100, threshold: 0.0,
    recruitTime: 90000,
    cost: { money: 100000, oil: 500, ammo: 0 },
    upkeep: { [ResourceType.MONEY]: rate(100), [ResourceType.OIL]: rate(15) },
    rapidFire: {},
    score: 10,
  },
};

// Market base prices (mirror of market.ts BASE_PRICES)
export const BASE_PRICES = {
  [ResourceType.MONEY]: 1,
  [ResourceType.OIL]: 10,
  [ResourceType.AMMO]: 50,
  [ResourceType.GOLD]: 500,
  [ResourceType.DIAMOND]: 5000,
};

export const calculateTotalUnitCost = (uType, count) => {
  const def = UNIT_DEFS[uType];
  if (!def) return 0;
  const moneyVal = def.cost.money * BASE_PRICES[ResourceType.MONEY];
  const oilVal = def.cost.oil * BASE_PRICES[ResourceType.OIL];
  const ammoVal = def.cost.ammo * BASE_PRICES[ResourceType.AMMO];
  const goldVal = (def.cost.diamond || 0) * BASE_PRICES[ResourceType.DIAMOND];
  return (moneyVal + oilVal + ammoVal + goldVal) * count;
};
