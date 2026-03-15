// ============================================================
// CAMPAIGN DATA - Mirror of data/campaigns.ts (no TypeScript)
// ============================================================

import { UnitType, ResourceType } from './enums.js';

export const CAMPAIGN_LEVELS = [
  {
    id: 1,
    enemyArmy: { [UnitType.CYBER_MARINE]: 10 }, 
    reward: { [ResourceType.MONEY]: 50000, [ResourceType.AMMO]: 1000 } 
  },
  {
    id: 2,
    enemyArmy: { [UnitType.CYBER_MARINE]: 25, [UnitType.HEAVY_COMMANDO]: 5 },
    reward: { [ResourceType.MONEY]: 150000, [ResourceType.AMMO]: 2500, [ResourceType.OIL]: 500 }
  },
  {
    id: 3,
    enemyArmy: { [UnitType.CYBER_MARINE]: 50, [UnitType.SCOUT_TANK]: 5 },
    reward: { [ResourceType.MONEY]: 350000, [ResourceType.OIL]: 1500, [ResourceType.AMMO]: 5000 }
  },
  {
    id: 4,
    enemyArmy: { [UnitType.SCOUT_TANK]: 5, [UnitType.CYBER_MARINE]: 80 },
    reward: { [ResourceType.MONEY]: 800000, [ResourceType.AMMO]: 10000, [ResourceType.OIL]: 3000 }
  },
  {
    id: 5,
    enemyArmy: { [UnitType.SCOUT_TANK]: 15, [UnitType.HEAVY_COMMANDO]: 25, [UnitType.WRAITH_GUNSHIP]: 1 },
    reward: { [ResourceType.MONEY]: 1500000, [ResourceType.OIL]: 5000, [ResourceType.GOLD]: 25 }
  },
  {
    id: 6,
    enemyArmy: { [UnitType.WRAITH_GUNSHIP]: 5, [UnitType.CYBER_MARINE]: 200, [UnitType.SCOUT_TANK]: 15 },
    reward: { [ResourceType.MONEY]: 3000000, [ResourceType.AMMO]: 25000, [ResourceType.GOLD]: 50 }
  },
  {
    id: 7,
    enemyArmy: { [UnitType.TITAN_MBT]: 10, [UnitType.SCOUT_TANK]: 30 },
    reward: { [ResourceType.MONEY]: 8000000, [ResourceType.OIL]: 15000, [ResourceType.GOLD]: 100 }
  },
  {
    id: 8,
    enemyArmy: { [UnitType.WRAITH_GUNSHIP]: 15, [UnitType.ACE_FIGHTER]: 5, [UnitType.AEGIS_DESTROYER]: 10 },
    reward: { [ResourceType.MONEY]: 15000000, [ResourceType.OIL]: 30000, [ResourceType.AMMO]: 50000 }
  },
  {
    id: 9,
    enemyArmy: { [UnitType.TITAN_MBT]: 25, [UnitType.SCOUT_TANK]: 10, [UnitType.HEAVY_COMMANDO]: 20 },
    reward: { [ResourceType.MONEY]: 35000000, [ResourceType.OIL]: 60000, [ResourceType.GOLD]: 250 }
  },
  {
    id: 10,
    enemyArmy: { [UnitType.TITAN_MBT]: 45, [UnitType.SCOUT_TANK]: 40 },
    reward: { [ResourceType.MONEY]: 75000000, [ResourceType.OIL]: 100000, [ResourceType.AMMO]: 150000, [ResourceType.DIAMOND]: 5 }
  },
  {
    id: 11,
    enemyArmy: { [UnitType.SCOUT_TANK]: 30, [UnitType.CYBER_MARINE]: 1000, [UnitType.HEAVY_COMMANDO]: 200 },
    reward: { [ResourceType.MONEY]: 150000000, [ResourceType.OIL]: 200000, [ResourceType.GOLD]: 500 }
  },
  {
    id: 12,
    enemyArmy: { [UnitType.TITAN_MBT]: 20, [UnitType.HEAVY_COMMANDO]: 100, [UnitType.WRAITH_GUNSHIP]: 25 },
    reward: { [ResourceType.MONEY]: 300000000, [ResourceType.OIL]: 400000, [ResourceType.AMMO]: 500000, [ResourceType.DIAMOND]: 5 }
  },
  {
    id: 13,
    enemyArmy: { [UnitType.ACE_FIGHTER]: 50, [UnitType.SCOUT_TANK]: 25 },
    reward: { [ResourceType.MONEY]: 600000000, [ResourceType.OIL]: 800000, [ResourceType.AMMO]: 1000000 }
  },
  {
    id: 14,
    enemyArmy: { [UnitType.AEGIS_DESTROYER]: 100, [UnitType.ACE_FIGHTER]: 25 },
    reward: { [ResourceType.MONEY]: 1200000000, [ResourceType.OIL]: 1500000, [ResourceType.GOLD]: 1500 }
  },
  {
    id: 15,
    enemyArmy: { [UnitType.PHANTOM_SUB]: 30, [UnitType.WRAITH_GUNSHIP]: 60, [UnitType.AEGIS_DESTROYER]: 15 },
    reward: { [ResourceType.MONEY]: 2500000000, [ResourceType.OIL]: 3000000, [ResourceType.AMMO]: 2500000, [ResourceType.DIAMOND]: 10 }
  },
  {
    id: 16,
    enemyArmy: { [UnitType.TITAN_MBT]: 210, [UnitType.SCOUT_TANK]: 50 },
    reward: { [ResourceType.MONEY]: 5000000000, [ResourceType.OIL]: 5000000, [ResourceType.GOLD]: 3000 }
  },
  {
    id: 17,
    enemyArmy: { [UnitType.ACE_FIGHTER]: 130, [UnitType.SCOUT_TANK]: 60 },
    reward: { [ResourceType.MONEY]: 10000000000, [ResourceType.OIL]: 10000000, [ResourceType.AMMO]: 10000000, [ResourceType.DIAMOND]: 15 }
  },
  {
    id: 18,
    enemyArmy: { [UnitType.AEGIS_DESTROYER]: 260, [UnitType.PHANTOM_SUB]: 60 },
    reward: { [ResourceType.MONEY]: 20000000000, [ResourceType.OIL]: 15000000, [ResourceType.GOLD]: 6000 }
  },
  {
    id: 19,
    enemyArmy: { [UnitType.SCOUT_TANK]: 300, [UnitType.TITAN_MBT]: 150, [UnitType.HEAVY_COMMANDO]: 1800 },
    reward: { [ResourceType.MONEY]: 35000000000, [ResourceType.OIL]: 25000000, [ResourceType.AMMO]: 30000000, [ResourceType.DIAMOND]: 20 }
  },
  {
    id: 20,
    enemyArmy: { [UnitType.TITAN_MBT]: 150, [UnitType.ACE_FIGHTER]: 80, [UnitType.WRAITH_GUNSHIP]: 250 },
    reward: { [ResourceType.MONEY]: 60000000000, [ResourceType.OIL]: 40000000, [ResourceType.GOLD]: 15000, [ResourceType.DIAMOND]: 25 }
  },
  {
    id: 21,
    enemyArmy: { [UnitType.ACE_FIGHTER]: 120, [UnitType.TITAN_MBT]: 200, [UnitType.SCOUT_TANK]: 120 },
    reward: { [ResourceType.MONEY]: 100000000000, [ResourceType.OIL]: 60000000, [ResourceType.GOLD]: 25000 }
  },
  {
    id: 22,
    enemyArmy: { [UnitType.AEGIS_DESTROYER]: 200, [UnitType.ACE_FIGHTER]: 150, [UnitType.PHANTOM_SUB]: 120 },
    reward: { [ResourceType.MONEY]: 150000000000, [ResourceType.OIL]: 90000000, [ResourceType.AMMO]: 100000000, [ResourceType.DIAMOND]: 30 }
  },
  {
    id: 23,
    enemyArmy: { [UnitType.TITAN_MBT]: 400, [UnitType.SCOUT_TANK]: 400, [UnitType.HEAVY_COMMANDO]: 1500 },
    reward: { [ResourceType.MONEY]: 250000000000, [ResourceType.OIL]: 150000000, [ResourceType.GOLD]: 40000, [ResourceType.DIAMOND]: 40 }
  },
  {
    id: 24,
    enemyArmy: { [UnitType.ACE_FIGHTER]: 900, [UnitType.WRAITH_GUNSHIP]: 600, [UnitType.SCOUT_TANK]: 300 },
    reward: { [ResourceType.MONEY]: 400000000000, [ResourceType.OIL]: 250000000, [ResourceType.AMMO]: 300000000, [ResourceType.DIAMOND]: 50 }
  },
  {
    id: 25,
    enemyArmy: { [UnitType.TITAN_MBT]: 800, [UnitType.ACE_FIGHTER]: 500, [UnitType.AEGIS_DESTROYER]: 300, [UnitType.PHANTOM_SUB]: 300 },
    reward: { [ResourceType.MONEY]: 750000000000, [ResourceType.OIL]: 500000000, [ResourceType.GOLD]: 100000, [ResourceType.DIAMOND]: 100 }
  }
];
