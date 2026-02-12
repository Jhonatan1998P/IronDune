
import { CampaignLevel, ResourceType, UnitType } from '../types';

// Difficulty & Reward Rebalance Logic (V1.2.1)
// Goal: 5-10% Net Profit after projected casualties assuming correct counters are used.
// Difficulty increased by introducing mixed unit compositions earlier.

export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  // --- TIER 1: SKIRMISHES (Training) ---
  {
    id: 1,
    nameKey: 'lvl_1',
    descriptionKey: 'lvl_1_desc',
    difficulty: 'EASY',
    enemyArmy: { [UnitType.SOLDIER]: 35 }, // Increased from 20
    reward: { [ResourceType.MONEY]: 3000000, [ResourceType.AMMO]: 7500 } // Value ~3M (Invest ~2.5M)
  },
  {
    id: 2,
    nameKey: 'lvl_2',
    descriptionKey: 'lvl_2_desc',
    difficulty: 'EASY',
    enemyArmy: { [UnitType.SOLDIER]: 60, [UnitType.SNIPER]: 10 },
    reward: { [ResourceType.MONEY]: 6500000, [ResourceType.AMMO]: 15000, [ResourceType.OIL]: 3000 }
  },
  {
    id: 3,
    nameKey: 'lvl_3',
    descriptionKey: 'lvl_3_desc',
    difficulty: 'MEDIUM',
    enemyArmy: { [UnitType.SOLDIER]: 150, [UnitType.MORTAR]: 15 }, // Added Mortar threat
    reward: { [ResourceType.MONEY]: 15000000, [ResourceType.OIL]: 8000, [ResourceType.GOLD]: 100 }
  },
  {
    id: 4,
    nameKey: 'lvl_4',
    descriptionKey: 'lvl_4_desc',
    difficulty: 'MEDIUM',
    enemyArmy: { [UnitType.LIGHT_TANK]: 15, [UnitType.SOLDIER]: 250 },
    reward: { [ResourceType.MONEY]: 35000000, [ResourceType.AMMO]: 40000, [ResourceType.OIL]: 15000 }
  },
  {
    id: 5,
    nameKey: 'lvl_5',
    descriptionKey: 'lvl_5_desc',
    difficulty: 'HARD',
    enemyArmy: { [UnitType.LIGHT_TANK]: 30, [UnitType.SNIPER]: 50, [UnitType.HELICOPTER]: 2 }, // Surprise Air unit
    reward: { [ResourceType.MONEY]: 65000000, [ResourceType.OIL]: 30000, [ResourceType.GOLD]: 300 }
  },

  // --- TIER 2: MECHANIZED WARFARE ---
  {
    id: 6,
    nameKey: 'lvl_6',
    descriptionKey: 'lvl_6_desc',
    difficulty: 'HARD',
    enemyArmy: { [UnitType.HELICOPTER]: 15, [UnitType.SOLDIER]: 500, [UnitType.MORTAR]: 20 },
    reward: { [ResourceType.MONEY]: 120000000, [ResourceType.AMMO]: 100000, [ResourceType.GOLD]: 500 }
  },
  {
    id: 7,
    nameKey: 'lvl_7',
    descriptionKey: 'lvl_7_desc',
    difficulty: 'HARD',
    enemyArmy: { [UnitType.TANK]: 25, [UnitType.LIGHT_TANK]: 50 },
    reward: { [ResourceType.MONEY]: 280000000, [ResourceType.OIL]: 80000, [ResourceType.GOLD]: 750, [ResourceType.DIAMOND]: 1 }
  },
  {
    id: 8,
    nameKey: 'lvl_8',
    descriptionKey: 'lvl_8_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.HELICOPTER]: 30, [UnitType.FIGHTER_JET]: 10, [UnitType.PATROL_BOAT]: 20 },
    reward: { [ResourceType.MONEY]: 600000000, [ResourceType.OIL]: 150000, [ResourceType.AMMO]: 150000, [ResourceType.DIAMOND]: 2 }
  },
  {
    id: 9,
    nameKey: 'lvl_9',
    descriptionKey: 'lvl_9_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.TANK]: 60, [UnitType.HOWITZER]: 25, [UnitType.COMMANDO]: 50 },
    reward: { [ResourceType.MONEY]: 1000000000, [ResourceType.OIL]: 250000, [ResourceType.GOLD]: 1500, [ResourceType.DIAMOND]: 3 }
  },
  {
    id: 10,
    nameKey: 'lvl_10',
    descriptionKey: 'lvl_10_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.HEAVY_TANK]: 15, [UnitType.TANK]: 80, [UnitType.MLRS]: 25 },
    reward: { [ResourceType.MONEY]: 2000000000, [ResourceType.OIL]: 400000, [ResourceType.AMMO]: 500000, [ResourceType.DIAMOND]: 5 }
  },

  // --- TIER 3: HEAVY ASSAULT ---
  {
    id: 11,
    nameKey: 'lvl_11',
    descriptionKey: 'lvl_11_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.MLRS]: 80, [UnitType.SOLDIER]: 2500, [UnitType.SNIPER]: 500 },
    reward: { [ResourceType.MONEY]: 3500000000, [ResourceType.OIL]: 600000, [ResourceType.GOLD]: 3000, [ResourceType.DIAMOND]: 6 }
  },
  {
    id: 12,
    nameKey: 'lvl_12',
    descriptionKey: 'lvl_12_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.HEAVY_TANK]: 50, [UnitType.COMMANDO]: 300, [UnitType.HELICOPTER]: 50 },
    reward: { [ResourceType.MONEY]: 5500000000, [ResourceType.OIL]: 1000000, [ResourceType.AMMO]: 1000000, [ResourceType.DIAMOND]: 8 }
  },
  {
    id: 13,
    nameKey: 'lvl_13',
    descriptionKey: 'lvl_13_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.BOMBER]: 25, [UnitType.FIGHTER_JET]: 80, [UnitType.MLRS]: 50 },
    reward: { [ResourceType.MONEY]: 8000000000, [ResourceType.OIL]: 1500000, [ResourceType.AMMO]: 1500000, [ResourceType.DIAMOND]: 10 }
  },
  {
    id: 14,
    nameKey: 'lvl_14',
    descriptionKey: 'lvl_14_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.DESTROYER]: 40, [UnitType.PATROL_BOAT]: 150, [UnitType.FIGHTER_JET]: 50 },
    reward: { [ResourceType.MONEY]: 12000000000, [ResourceType.OIL]: 2500000, [ResourceType.GOLD]: 7500, [ResourceType.DIAMOND]: 12 }
  },
  {
    id: 15,
    nameKey: 'lvl_15',
    descriptionKey: 'lvl_15_desc',
    difficulty: 'EXTREME',
    enemyArmy: { [UnitType.SUBMARINE]: 60, [UnitType.HELICOPTER]: 100, [UnitType.DESTROYER]: 20 },
    reward: { [ResourceType.MONEY]: 18000000000, [ResourceType.OIL]: 3500000, [ResourceType.AMMO]: 3000000, [ResourceType.DIAMOND]: 15 }
  },

  // --- TIER 4: WORLD WAR ---
  {
    id: 16,
    nameKey: 'lvl_16',
    descriptionKey: 'lvl_16_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.HEAVY_TANK]: 150, [UnitType.TANK]: 300, [UnitType.HOWITZER]: 100 },
    reward: { [ResourceType.MONEY]: 30000000000, [ResourceType.OIL]: 6000000, [ResourceType.GOLD]: 15000, [ResourceType.DIAMOND]: 20 }
  },
  {
    id: 17,
    nameKey: 'lvl_17',
    descriptionKey: 'lvl_17_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.BOMBER]: 80, [UnitType.FIGHTER_JET]: 250, [UnitType.MLRS]: 100 },
    reward: { [ResourceType.MONEY]: 45000000000, [ResourceType.OIL]: 9000000, [ResourceType.AMMO]: 8000000, [ResourceType.DIAMOND]: 25 }
  },
  {
    id: 18,
    nameKey: 'lvl_18',
    descriptionKey: 'lvl_18_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.DESTROYER]: 120, [UnitType.SUBMARINE]: 120, [UnitType.PATROL_BOAT]: 500 },
    reward: { [ResourceType.MONEY]: 70000000000, [ResourceType.OIL]: 12000000, [ResourceType.GOLD]: 30000, [ResourceType.DIAMOND]: 30 }
  },
  {
    id: 19,
    nameKey: 'lvl_19',
    descriptionKey: 'lvl_19_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.MLRS]: 300, [UnitType.HOWITZER]: 300, [UnitType.COMMANDO]: 1500, [UnitType.SNIPER]: 2000 },
    reward: { [ResourceType.MONEY]: 100000000000, [ResourceType.OIL]: 18000000, [ResourceType.AMMO]: 15000000, [ResourceType.DIAMOND]: 40 }
  },
  {
    id: 20,
    nameKey: 'lvl_20',
    descriptionKey: 'lvl_20_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.HEAVY_TANK]: 300, [UnitType.BOMBER]: 150, [UnitType.HELICOPTER]: 500 },
    reward: { [ResourceType.MONEY]: 150000000000, [ResourceType.OIL]: 30000000, [ResourceType.GOLD]: 75000, [ResourceType.DIAMOND]: 50 }
  },

  // --- TIER 5: ENDGAME ---
  {
    id: 21,
    nameKey: 'lvl_21',
    descriptionKey: 'lvl_21_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.BOMBER]: 250, [UnitType.HEAVY_TANK]: 300, [UnitType.MLRS]: 200 },
    reward: { [ResourceType.MONEY]: 250000000000, [ResourceType.OIL]: 50000000, [ResourceType.GOLD]: 100000, [ResourceType.DIAMOND]: 75 }
  },
  {
    id: 22,
    nameKey: 'lvl_22',
    descriptionKey: 'lvl_22_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.DESTROYER]: 400, [UnitType.BOMBER]: 250, [UnitType.SUBMARINE]: 200 },
    reward: { [ResourceType.MONEY]: 400000000000, [ResourceType.OIL]: 80000000, [ResourceType.AMMO]: 75000000, [ResourceType.DIAMOND]: 100 }
  },
  {
    id: 23,
    nameKey: 'lvl_23',
    descriptionKey: 'lvl_23_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.HEAVY_TANK]: 800, [UnitType.MLRS]: 800, [UnitType.COMMANDO]: 2000 },
    reward: { [ResourceType.MONEY]: 650000000000, [ResourceType.OIL]: 120000000, [ResourceType.GOLD]: 150000, [ResourceType.DIAMOND]: 125 }
  },
  {
    id: 24,
    nameKey: 'lvl_24',
    descriptionKey: 'lvl_24_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.BOMBER]: 500, [UnitType.FIGHTER_JET]: 1000, [UnitType.HELICOPTER]: 1000, [UnitType.MLRS]: 500 },
    reward: { [ResourceType.MONEY]: 900000000000, [ResourceType.OIL]: 250000000, [ResourceType.AMMO]: 300000000, [ResourceType.DIAMOND]: 150 }
  },
  {
    id: 25,
    nameKey: 'lvl_25',
    descriptionKey: 'lvl_25_desc',
    difficulty: 'NIGHTMARE',
    enemyArmy: { [UnitType.HEAVY_TANK]: 1500, [UnitType.BOMBER]: 800, [UnitType.DESTROYER]: 500, [UnitType.SUBMARINE]: 500 },
    reward: { [ResourceType.MONEY]: 1500000000000, [ResourceType.OIL]: 600000000, [ResourceType.GOLD]: 1500000, [ResourceType.DIAMOND]: 250 }
  }
];
