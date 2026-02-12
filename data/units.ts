
import { ResourceType, TechType, UnitCategory, UnitDef, UnitType } from '../types';

const PER_10_MINUTES = 600;
const rate = (amount: number) => amount / PER_10_MINUTES;

export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  // ========================================================================
  // CATEGORÍA: GROUND (INFANTERÍA)
  // ========================================================================

  [UnitType.SOLDIER]: {
    id: UnitType.SOLDIER,
    category: UnitCategory.GROUND,
    translationKey: 'soldier',
    reqTech: TechType.UNLOCK_SOLDIER,
    hp: 50,          
    attack: 15,      
    defense: 5,      
    recruitTime: 5000, 
    cost: { money: 50000, oil: 0, ammo: 100 }, 
    upkeep: { [ResourceType.MONEY]: rate(150), [ResourceType.AMMO]: rate(10) },
    rapidFire: {}, 
    score: 1,
  },

  [UnitType.SNIPER]: {
    id: UnitType.SNIPER,
    category: UnitCategory.GROUND,
    translationKey: 'sniper',
    reqTech: TechType.UNLOCK_SNIPER,
    hp: 35,          
    attack: 90,      
    defense: 0,      
    recruitTime: 10000, 
    cost: { money: 150000, oil: 0, ammo: 200 },
    upkeep: { [ResourceType.MONEY]: rate(300), [ResourceType.AMMO]: rate(20) },
    rapidFire: {
        [UnitType.SOLDIER]: 0.90,  
        [UnitType.COMMANDO]: 0.50, 
        [UnitType.MORTAR]: 0.80    
    },
    score: 2,
  },

  [UnitType.COMMANDO]: {
    id: UnitType.COMMANDO,
    category: UnitCategory.GROUND,
    translationKey: 'commando',
    reqTech: TechType.UNLOCK_COMMANDO,
    hp: 250,         
    attack: 140,     
    defense: 30,     
    recruitTime: 20000,
    cost: { money: 400000, oil: 100, ammo: 500 },
    upkeep: { [ResourceType.MONEY]: rate(800), [ResourceType.AMMO]: rate(50) },
    rapidFire: {
        [UnitType.TANK]: 0.70,        
        [UnitType.LIGHT_TANK]: 0.90,  
        [UnitType.HEAVY_TANK]: 0.40,  
        [UnitType.MLRS]: 0.80         
    },
    score: 5,
  },

  // ========================================================================
  // CATEGORÍA: ARTILLERY (APOYO)
  // ========================================================================

  [UnitType.MORTAR]: {
    id: UnitType.MORTAR,
    category: UnitCategory.ARTILLERY,
    translationKey: 'mortar',
    reqTech: TechType.UNLOCK_MORTAR,
    hp: 60,
    attack: 55,
    defense: 0,
    recruitTime: 15000,
    cost: { money: 300000, oil: 50, ammo: 500 },
    upkeep: { [ResourceType.MONEY]: rate(500), [ResourceType.AMMO]: rate(100) },
    rapidFire: {
        [UnitType.SOLDIER]: 0.95, 
        [UnitType.SNIPER]: 0.90
    },
    score: 3,
  },

  [UnitType.HOWITZER]: {
    id: UnitType.HOWITZER,
    category: UnitCategory.ARTILLERY,
    translationKey: 'howitzer',
    reqTech: TechType.UNLOCK_HOWITZER,
    hp: 180,
    attack: 280,     
    defense: 20,
    recruitTime: 45000,
    cost: { money: 1200000, oil: 400, ammo: 2000 },
    upkeep: { [ResourceType.MONEY]: rate(1500), [ResourceType.OIL]: rate(100), [ResourceType.AMMO]: rate(200) },
    rapidFire: {
        [UnitType.HEAVY_TANK]: 0.30, 
        [UnitType.DESTROYER]: 0.40   
    },
    score: 10,
  },

  [UnitType.MLRS]: {
    id: UnitType.MLRS,
    category: UnitCategory.ARTILLERY,
    translationKey: 'mlrs',
    reqTech: TechType.UNLOCK_MLRS,
    hp: 300,
    attack: 160,     
    defense: 40,
    recruitTime: 60000,
    cost: { money: 2500000, oil: 1000, ammo: 5000 },
    upkeep: { [ResourceType.MONEY]: rate(3000), [ResourceType.OIL]: rate(300), [ResourceType.AMMO]: rate(800) },
    rapidFire: {
        [UnitType.SOLDIER]: 1.00,     
        [UnitType.LIGHT_TANK]: 0.80,
        [UnitType.HELICOPTER]: 0.60,  
        [UnitType.PATROL_BOAT]: 0.70
    },
    score: 20,
  },

  // ========================================================================
  // CATEGORÍA: TANK (BLINDADOS)
  // ========================================================================

  [UnitType.LIGHT_TANK]: {
    id: UnitType.LIGHT_TANK,
    category: UnitCategory.TANK,
    translationKey: 'light_tank',
    reqTech: TechType.UNLOCK_LIGHT_TANK,
    hp: 650,
    attack: 110,
    defense: 60,     
    recruitTime: 30000,
    cost: { money: 1500000, oil: 1000, ammo: 800 },
    upkeep: { [ResourceType.MONEY]: rate(2000), [ResourceType.OIL]: rate(200), [ResourceType.AMMO]: rate(50) },
    rapidFire: {
        [UnitType.SOLDIER]: 0.80,    
        [UnitType.MORTAR]: 0.90,     
        [UnitType.SNIPER]: 0.90
    },
    score: 8,
  },

  [UnitType.TANK]: { 
    id: UnitType.TANK,
    category: UnitCategory.TANK,
    translationKey: 'tank',
    reqTech: TechType.UNLOCK_TANK,
    hp: 1800,
    attack: 220,
    defense: 150,    
    recruitTime: 60000,
    cost: { money: 4000000, oil: 3000, ammo: 2000 },
    upkeep: { [ResourceType.MONEY]: rate(4000), [ResourceType.OIL]: rate(500), [ResourceType.AMMO]: rate(150) },
    rapidFire: {
        [UnitType.LIGHT_TANK]: 0.80,
        [UnitType.HOWITZER]: 0.70,
        [UnitType.TANK]: 0.30        
    },
    score: 25,
  },

  [UnitType.HEAVY_TANK]: {
    id: UnitType.HEAVY_TANK,
    category: UnitCategory.TANK,
    translationKey: 'heavy_tank',
    reqTech: TechType.UNLOCK_HEAVY_TANK,
    hp: 5000,
    attack: 400,     
    defense: 350,    
    recruitTime: 120000,
    cost: { money: 10000000, oil: 8000, ammo: 5000 },
    upkeep: { [ResourceType.MONEY]: rate(8000), [ResourceType.OIL]: rate(1000), [ResourceType.AMMO]: rate(300) },
    rapidFire: {
        [UnitType.TANK]: 0.90,       
        [UnitType.HOWITZER]: 0.80
    },
    score: 60,
  },

  // ========================================================================
  // CATEGORÍA: NAVAL
  // ========================================================================

  [UnitType.PATROL_BOAT]: {
    id: UnitType.PATROL_BOAT,
    category: UnitCategory.NAVAL,
    translationKey: 'patrol_boat',
    reqTech: TechType.UNLOCK_PATROL_BOAT,
    hp: 1500,
    attack: 180,
    defense: 80,
    recruitTime: 60000,
    cost: { money: 5000000, oil: 2000, ammo: 2000 },
    upkeep: { [ResourceType.MONEY]: rate(3000), [ResourceType.OIL]: rate(300), [ResourceType.AMMO]: rate(100) },
    rapidFire: {
        [UnitType.HELICOPTER]: 0.80, 
        [UnitType.BOMBER]: 0.40,     
        [UnitType.SOLDIER]: 0.90     
    },
    score: 15,
  },

  [UnitType.DESTROYER]: {
    id: UnitType.DESTROYER,
    category: UnitCategory.NAVAL,
    translationKey: 'destroyer',
    reqTech: TechType.UNLOCK_DESTROYER,
    hp: 7500,
    attack: 450,
    defense: 250,
    recruitTime: 120000,
    cost: { money: 15000000, oil: 10000, ammo: 8000 },
    upkeep: { [ResourceType.MONEY]: rate(10000), [ResourceType.OIL]: rate(1500), [ResourceType.AMMO]: rate(500) },
    rapidFire: {
        [UnitType.SUBMARINE]: 0.90,  
        [UnitType.FIGHTER_JET]: 0.70,
        [UnitType.PATROL_BOAT]: 0.90
    },
    score: 80,
  },

  [UnitType.SUBMARINE]: {
    id: UnitType.SUBMARINE,
    category: UnitCategory.NAVAL,
    translationKey: 'submarine',
    reqTech: TechType.UNLOCK_SUBMARINE,
    hp: 4000,        
    attack: 1500,    
    defense: 100,    
    recruitTime: 150000,
    cost: { money: 25000000, oil: 15000, ammo: 5000 },
    upkeep: { [ResourceType.MONEY]: rate(15000), [ResourceType.OIL]: rate(2000), [ResourceType.AMMO]: rate(200) },
    rapidFire: {
        [UnitType.DESTROYER]: 0.50,  
        [UnitType.PATROL_BOAT]: 0.90 
    },
    score: 120,
  },

  // ========================================================================
  // CATEGORÍA: AIR (AÉREA)
  // ========================================================================

  [UnitType.HELICOPTER]: {
    id: UnitType.HELICOPTER,
    category: UnitCategory.AIR,
    translationKey: 'helicopter',
    reqTech: TechType.UNLOCK_HELICOPTER,
    hp: 900,
    attack: 350,     
    defense: 40,     
    recruitTime: 60000,
    cost: { money: 6000000, oil: 3000, ammo: 3000 },
    upkeep: { [ResourceType.MONEY]: rate(5000), [ResourceType.OIL]: rate(800), [ResourceType.AMMO]: rate(400) },
    rapidFire: {
        [UnitType.TANK]: 0.90,       
        [UnitType.HEAVY_TANK]: 0.70,
        [UnitType.HOWITZER]: 0.90
    },
    score: 30,
  },

  [UnitType.FIGHTER_JET]: {
    id: UnitType.FIGHTER_JET,
    category: UnitCategory.AIR,
    translationKey: 'fighter_jet',
    reqTech: TechType.UNLOCK_FIGHTER,
    hp: 2000,
    attack: 600,     
    defense: 120,    
    recruitTime: 120000,
    cost: { money: 15000000, oil: 8000, ammo: 5000 },
    upkeep: { [ResourceType.MONEY]: rate(12000), [ResourceType.OIL]: rate(2000), [ResourceType.AMMO]: rate(500) },
    rapidFire: {
        [UnitType.HELICOPTER]: 1.00, 
        [UnitType.BOMBER]: 0.90,     
        [UnitType.FIGHTER_JET]: 0.50 
    },
    score: 75,
  },

  [UnitType.BOMBER]: {
    id: UnitType.BOMBER,
    category: UnitCategory.AIR,
    translationKey: 'bomber',
    reqTech: TechType.UNLOCK_BOMBER,
    hp: 5500,        
    attack: 2500,    
    defense: 200,    
    recruitTime: 180000,
    cost: { money: 40000000, oil: 20000, ammo: 20000 },
    upkeep: { [ResourceType.MONEY]: rate(25000), [ResourceType.OIL]: rate(5000), [ResourceType.AMMO]: rate(2000) },
    rapidFire: {
        [UnitType.HEAVY_TANK]: 0.80, 
        [UnitType.DESTROYER]: 0.70,  
        [UnitType.HOWITZER]: 1.00
    },
    score: 200,
  },
};

export const INITIAL_UNITS: Record<UnitType, number> = Object.values(UnitType).reduce((acc, type) => {
  acc[type] = 0;
  return acc;
}, {} as Record<UnitType, number>);