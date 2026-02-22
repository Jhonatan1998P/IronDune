
import { CampaignLevel, ResourceType, UnitType } from '../types';

export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  // --- TIER 1: SKIRMISHES (Training) ---
  {
    id: 1,
    nameKey: 'lvl_1',
    descriptionKey: 'lvl_1_desc',
    difficulty: 'EASY',
    enemyArmy: { [UnitType.CYBER_MARINE]: 10 }, 
    reward: { [ResourceType.MONEY]: 50000, [ResourceType.AMMO]: 1000 } 
  },
  {
    id: 2,
    nameKey: 'lvl_2',
    descriptionKey: 'lvl_2_desc',
    difficulty: 'EASY',
    enemyArmy: { [UnitType.CYBER_MARINE]: 25, [UnitType.HEAVY_COMMANDO]: 5 },
    reward: { [ResourceType.MONEY]: 150000, [ResourceType.AMMO]: 2500, [ResourceType.OIL]: 500 }
  },
  {
    id: 3,
    nameKey: 'lvl_3',
    descriptionKey: 'lvl_3_desc',
    difficulty: 'MEDIUM',
    enemyArmy: { [UnitType.CYBER_MARINE]: 50, [UnitType.SCOUT_TANK]: 5 },
    reward: { [ResourceType.MONEY]: 350000, [ResourceType.OIL]: 1500, [ResourceType.AMMO]: 5000 }
  },
  {
    id: 4,
    nameKey: 'lvl_4',
    descriptionKey: 'lvl_4_desc',
    difficulty: 'MEDIUM',
    enemyArmy: { [UnitType.SCOUT_TANK]: 5, [UnitType.CYBER_MARINE]: 80 },
    reward: { [ResourceType.MONEY]: 800000, [ResourceType.AMMO]: 10000, [ResourceType.OIL]: 3000 }
  },
  {
    id: 5,
    nameKey: 'lvl_5',
    descriptionKey: 'lvl_5_desc',
    difficulty: 'HARD',
    enemyArmy: { [UnitType.SCOUT_TANK]: 15, [UnitType.HEAVY_COMMANDO]: 25, [UnitType.WRAITH_GUNSHIP]: 1 },
    reward: { [ResourceType.MONEY]: 1500000, [ResourceType.OIL]: 5000, [ResourceType.GOLD]: 25 }
  },

  // --- TIER 2: MECHANIZED WARFARE ---
  {
    id: 6,
    nameKey: 'lvl_6',
    descriptionKey: 'lvl_6_desc',
    difficulty: 'HARD',
    enemyArmy: { [UnitType.WRAITH_GUNSHIP]: 5, [UnitType.CYBER_MARINE]: 200, [UnitType.SCOUT_TANK]: 15 },
    reward: { [ResourceType.MONEY]: 3000000, [ResourceType.AMMO]: 25000, [ResourceType.GOLD]: 50 }
  },
  {
    id: 7,
    nameKey: 'lvl_7',
    descriptionKey: 'lvl_7_desc',
    difficulty: 'HARD',
    enemyArmy: { [UnitType.TITAN_MBT]: 10, [UnitType.SCOUT_TANK]: 30 },
    reward: { [ResourceType.MONEY]: 8000000, [ResourceType.OIL]: 15000, [ResourceType.GOLD]: 100 }
  },
  {
    id: 8,
    nameKey: 'lvl_8',
    descriptionKey: 'lvl_8_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.WRAITH_GUNSHIP]: 15, [UnitType.ACE_FIGHTER]: 5, [UnitType.AEGIS_DESTROYER]: 10 },
    reward: { [ResourceType.MONEY]: 15000000, [ResourceType.OIL]: 30000, [ResourceType.AMMO]: 50000 }
  },
  {
    id: 9,
    nameKey: 'lvl_9',
    descriptionKey: 'lvl_9_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.TITAN_MBT]: 25, [UnitType.SCOUT_TANK]: 10, [UnitType.HEAVY_COMMANDO]: 20 },
    reward: { [ResourceType.MONEY]: 35000000, [ResourceType.OIL]: 60000, [ResourceType.GOLD]: 250 }
  },
  {
    id: 10,
    nameKey: 'lvl_10',
    descriptionKey: 'lvl_10_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.TITAN_MBT]: 45, [UnitType.SCOUT_TANK]: 40 },
    reward: { [ResourceType.MONEY]: 75000000, [ResourceType.OIL]: 100000, [ResourceType.AMMO]: 150000, [ResourceType.DIAMOND]: 5 }
  },

  // --- TIER 3: HEAVY ASSAULT ---
  {
    id: 11,
    nameKey: 'lvl_11',
    descriptionKey: 'lvl_11_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.SCOUT_TANK]: 30, [UnitType.CYBER_MARINE]: 1000, [UnitType.HEAVY_COMMANDO]: 200 },
    reward: { [ResourceType.MONEY]: 150000000, [ResourceType.OIL]: 200000, [ResourceType.GOLD]: 500 }
  },
  {
    id: 12,
    nameKey: 'lvl_12',
    descriptionKey: 'lvl_12_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.TITAN_MBT]: 20, [UnitType.HEAVY_COMMANDO]: 100, [UnitType.WRAITH_GUNSHIP]: 25 },
    reward: { [ResourceType.MONEY]: 300000000, [ResourceType.OIL]: 400000, [ResourceType.AMMO]: 500000, [ResourceType.DIAMOND]: 5 }
  },
  {
    id: 13,
    nameKey: 'lvl_13',
    descriptionKey: 'lvl_13_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.ACE_FIGHTER]: 50, [UnitType.SCOUT_TANK]: 25 },
    reward: { [ResourceType.MONEY]: 600000000, [ResourceType.OIL]: 800000, [ResourceType.AMMO]: 1000000 }
  },
  {
    id: 14,
    nameKey: 'lvl_14',
    descriptionKey: 'lvl_14_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.AEGIS_DESTROYER]: 100, [UnitType.ACE_FIGHTER]: 25 },
    reward: { [ResourceType.MONEY]: 1200000000, [ResourceType.OIL]: 1500000, [ResourceType.GOLD]: 1500 }
  },
  {
    id: 15,
    nameKey: 'lvl_15',
    descriptionKey: 'lvl_15_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.PHANTOM_SUB]: 30, [UnitType.WRAITH_GUNSHIP]: 60, [UnitType.AEGIS_DESTROYER]: 15 },
    reward: { [ResourceType.MONEY]: 2500000000, [ResourceType.OIL]: 3000000, [ResourceType.AMMO]: 2500000, [ResourceType.DIAMOND]: 10 }
  },

  // --- TIER 4: WORLD WAR ---
  {
    id: 16,
    nameKey: 'lvl_16',
    descriptionKey: 'lvl_16_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.TITAN_MBT]: 210, [UnitType.SCOUT_TANK]: 50 },
    reward: { [ResourceType.MONEY]: 5000000000, [ResourceType.OIL]: 5000000, [ResourceType.GOLD]: 3000 }
  },
  {
    id: 17,
    nameKey: 'lvl_17',
    descriptionKey: 'lvl_17_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.ACE_FIGHTER]: 130, [UnitType.SCOUT_TANK]: 60 },
    reward: { [ResourceType.MONEY]: 10000000000, [ResourceType.OIL]: 10000000, [ResourceType.AMMO]: 10000000, [ResourceType.DIAMOND]: 15 }
  },
  {
    id: 18,
    nameKey: 'lvl_18',
    descriptionKey: 'lvl_18_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.AEGIS_DESTROYER]: 260, [UnitType.PHANTOM_SUB]: 60 },
    reward: { [ResourceType.MONEY]: 20000000000, [ResourceType.OIL]: 15000000, [ResourceType.GOLD]: 6000 }
  },
  {
    id: 19,
    nameKey: 'lvl_19',
    descriptionKey: 'lvl_19_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.SCOUT_TANK]: 300, [UnitType.TITAN_MBT]: 150, [UnitType.HEAVY_COMMANDO]: 1800 },
    reward: { [ResourceType.MONEY]: 35000000000, [ResourceType.OIL]: 25000000, [ResourceType.AMMO]: 30000000, [ResourceType.DIAMOND]: 20 }
  },
  {
    id: 20,
    nameKey: 'lvl_20',
    descriptionKey: 'lvl_20_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.TITAN_MBT]: 150, [UnitType.ACE_FIGHTER]: 80, [UnitType.WRAITH_GUNSHIP]: 250 },
    reward: { [ResourceType.MONEY]: 60000000000, [ResourceType.OIL]: 40000000, [ResourceType.GOLD]: 15000, [ResourceType.DIAMOND]: 25 }
  },

  // --- TIER 5: ENDGAME ---
  {
    id: 21,
    nameKey: 'lvl_21',
    descriptionKey: 'lvl_21_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.ACE_FIGHTER]: 120, [UnitType.TITAN_MBT]: 200, [UnitType.SCOUT_TANK]: 120 },
    reward: { [ResourceType.MONEY]: 100000000000, [ResourceType.OIL]: 60000000, [ResourceType.GOLD]: 25000 }
  },
  {
    id: 22,
    nameKey: 'lvl_22',
    descriptionKey: 'lvl_22_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.AEGIS_DESTROYER]: 200, [UnitType.ACE_FIGHTER]: 150, [UnitType.PHANTOM_SUB]: 120 },
    reward: { [ResourceType.MONEY]: 150000000000, [ResourceType.OIL]: 90000000, [ResourceType.AMMO]: 100000000, [ResourceType.DIAMOND]: 30 }
  },
  {
    id: 23,
    nameKey: 'lvl_23',
    descriptionKey: 'lvl_23_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.TITAN_MBT]: 400, [UnitType.SCOUT_TANK]: 400, [UnitType.HEAVY_COMMANDO]: 1500 },
    reward: { [ResourceType.MONEY]: 250000000000, [ResourceType.OIL]: 150000000, [ResourceType.GOLD]: 40000, [ResourceType.DIAMOND]: 40 }
  },
  {
    id: 24,
    nameKey: 'lvl_24',
    descriptionKey: 'lvl_24_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.ACE_FIGHTER]: 900, [UnitType.WRAITH_GUNSHIP]: 600, [UnitType.SCOUT_TANK]: 300 },
    reward: { [ResourceType.MONEY]: 400000000000, [ResourceType.OIL]: 250000000, [ResourceType.AMMO]: 300000000, [ResourceType.DIAMOND]: 50 }
  },
  {
    id: 25,
    nameKey: 'lvl_25',
    descriptionKey: 'lvl_25_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.TITAN_MBT]: 800, [UnitType.ACE_FIGHTER]: 500, [UnitType.AEGIS_DESTROYER]: 300, [UnitType.PHANTOM_SUB]: 300 },
    reward: { [ResourceType.MONEY]: 750000000000, [ResourceType.OIL]: 500000000, [ResourceType.GOLD]: 100000, [ResourceType.DIAMOND]: 100 }
  }
];
