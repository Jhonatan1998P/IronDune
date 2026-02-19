
import { ResourceType, TechType, UnitCategory, UnitDef, UnitType } from '../types';

const PER_10_MINUTES = 600;
const rate = (amount: number) => amount / PER_10_MINUTES;

export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  // ========================================================================
  // TIER 0: INFANTERÍA LIGERA (CARNE DE CAÑÓN)
  // Defensa 0 - 20. Vulnerable a todo.
  // ========================================================================

  [UnitType.SOLDIER]: {
    id: UnitType.SOLDIER,
    category: UnitCategory.GROUND,
    translationKey: 'soldier',
    reqTech: TechType.UNLOCK_SOLDIER,
    hp: 40,          
    attack: 15,      // No penetra Tier 1 (80 def * 0.2 = 16)
    defense: 5,      
    recruitTime: 45000, // 45 Segundos (Min)
    cost: { money: 15000, oil: 0, ammo: 50 }, 
    upkeep: { [ResourceType.MONEY]: rate(50), [ResourceType.AMMO]: rate(5) },
    rapidFire: {}, // Dispara a lo que sea
    score: 1,
  },

  [UnitType.SNIPER]: {
    id: UnitType.SNIPER,
    category: UnitCategory.GROUND,
    translationKey: 'sniper',
    reqTech: TechType.UNLOCK_SNIPER,
    hp: 25,          
    attack: 90,      // Penetra Tier 0 y 1. Rebota en Tier 2 (200 def * 0.2 = 40, OK)
    defense: 0,      
    recruitTime: 60000, // 1 Minuto
    cost: { money: 80000, oil: 0, ammo: 100, diamond: 0 }, // Requiere tecnología
    upkeep: { [ResourceType.MONEY]: rate(200), [ResourceType.GOLD]: rate(1) },
    rapidFire: {
        [UnitType.SOLDIER]: 0.30,  
        [UnitType.MORTAR]: 0.25,
        [UnitType.COMMANDO]: 0.10
    },
    score: 2,
  },

  // ========================================================================
  // TIER 0/1: ARTILLERÍA LIGERA Y APOYO
  // ========================================================================

  [UnitType.MORTAR]: {
    id: UnitType.MORTAR,
    category: UnitCategory.ARTILLERY,
    translationKey: 'mortar',
    reqTech: TechType.UNLOCK_MORTAR,
    hp: 40,
    attack: 55,      // Penetra Tier 0.
    defense: 5,
    recruitTime: 75000, // 1 Minuto 15 Segundos
    cost: { money: 120000, oil: 0, ammo: 300 },
    upkeep: { [ResourceType.MONEY]: rate(150), [ResourceType.AMMO]: rate(50) },
    rapidFire: {
        [UnitType.SOLDIER]: 0.40, 
        [UnitType.SNIPER]: 0.30
    },
    score: 3,
  },

  [UnitType.MLRS]: {
    id: UnitType.MLRS,
    category: UnitCategory.ARTILLERY,
    translationKey: 'mlrs',
    reqTech: TechType.UNLOCK_MLRS,
    hp: 180,
    attack: 120,     // Penetra Tier 1 y Tier 2 bajo.
    defense: 40,     // Tier 0 defensa
    recruitTime: 180000, // 3 Minutos
    cost: { money: 1500000, oil: 500, ammo: 4000 },
    upkeep: { [ResourceType.MONEY]: rate(1000), [ResourceType.AMMO]: rate(300) },
    rapidFire: {
        [UnitType.HELICOPTER]: 0.25, 
        [UnitType.LIGHT_TANK]: 0.20,
        [UnitType.PATROL_BOAT]: 0.20
    },
    score: 15,
  },

  // ========================================================================
  // TIER 1: LIGERO / AÉREO (Defensa 50-100)
  // Umbral daño recibido: 10-20
  // ========================================================================

  [UnitType.LIGHT_TANK]: {
    id: UnitType.LIGHT_TANK,
    category: UnitCategory.TANK,
    translationKey: 'light_tank',
    reqTech: TechType.UNLOCK_LIGHT_TANK,
    hp: 400,
    attack: 85,      // Mata infantería y otros ligeros
    defense: 80,     // Inmune a Soldados (15 atk < 16 umbral)
    recruitTime: 90000, // 1 Minuto 30 Segundos
    cost: { money: 600000, oil: 400, ammo: 200 },
    upkeep: { [ResourceType.MONEY]: rate(500), [ResourceType.OIL]: rate(50) },
    rapidFire: {
        [UnitType.SOLDIER]: 0.25,    
        [UnitType.SNIPER]: 0.20,     
        [UnitType.MORTAR]: 0.20
    },
    score: 6,
  },

  [UnitType.HELICOPTER]: {
    id: UnitType.HELICOPTER,
    category: UnitCategory.AIR,
    translationKey: 'helicopter',
    reqTech: TechType.UNLOCK_HELICOPTER,
    hp: 350,
    attack: 300,     // ATGM: Penetra todo
    defense: 60,     // Papel aluminio
    recruitTime: 240000, // 4 Minutos
    cost: { money: 2500000, oil: 1500, ammo: 1000 },
    upkeep: { [ResourceType.MONEY]: rate(2000), [ResourceType.OIL]: rate(300) },
    rapidFire: {
        [UnitType.TANK]: 0.20,       
        [UnitType.HEAVY_TANK]: 0.10,
        [UnitType.COMMANDO]: 0.15
    },
    score: 20,
  },

  [UnitType.PATROL_BOAT]: {
    id: UnitType.PATROL_BOAT,
    category: UnitCategory.NAVAL,
    translationKey: 'patrol_boat',
    reqTech: TechType.UNLOCK_PATROL_BOAT,
    hp: 800,
    attack: 150,
    defense: 100,
    recruitTime: 120000, // 2 Minutos
    cost: { money: 2000000, oil: 800, ammo: 1000 },
    upkeep: { [ResourceType.MONEY]: rate(1200), [ResourceType.OIL]: rate(100) },
    rapidFire: {
        [UnitType.HELICOPTER]: 0.15, 
        [UnitType.SOLDIER]: 0.30,
        [UnitType.PATROL_BOAT]: 0.10
    },
    score: 12,
  },

  // ========================================================================
  // TIER 2: BLINDADO / ESTRUCTURA (Defensa 150-250)
  // Umbral daño recibido: 30-50
  // ========================================================================

  [UnitType.TANK]: { // MBT
    id: UnitType.TANK,
    category: UnitCategory.TANK,
    translationKey: 'tank',
    reqTech: TechType.UNLOCK_TANK,
    hp: 1200,
    attack: 220,     // Cañón 120mm
    defense: 200,    // Umbral 40. Inmune a fuego ligero.
    recruitTime: 300000, // 5 Minutos
    cost: { money: 2800000, oil: 1200, ammo: 800 },
    upkeep: { [ResourceType.MONEY]: rate(2500), [ResourceType.OIL]: rate(200), [ResourceType.AMMO]: rate(50) },
    rapidFire: {
        [UnitType.LIGHT_TANK]: 0.20, 
        [UnitType.MLRS]: 0.15,
        [UnitType.TANK]: 0.10
    },
    score: 25,
  },

  [UnitType.COMMANDO]: { // Elite Infantry (Glass Cannon)
    id: UnitType.COMMANDO,
    category: UnitCategory.GROUND,
    translationKey: 'commando',
    reqTech: TechType.UNLOCK_COMMANDO,
    hp: 300,         
    attack: 160,     // Cargas Huecas. Rompe umbral de Tanque Pesado (110).
    defense: 40,     // Camuflaje (Defensa baja física)
    recruitTime: 150000, // 2 Minutos 30 Segundos
    cost: { money: 500000, oil: 50, ammo: 1000, diamond: 0 },
    upkeep: { [ResourceType.MONEY]: rate(1000), [ResourceType.GOLD]: rate(5) },
    rapidFire: {
        [UnitType.HEAVY_TANK]: 0.10, 
        [UnitType.HOWITZER]: 0.20,
        [UnitType.MLRS]: 0.20
    },
    score: 10,
  },

  [UnitType.FIGHTER_JET]: {
    id: UnitType.FIGHTER_JET,
    category: UnitCategory.AIR,
    translationKey: 'fighter_jet',
    reqTech: TechType.UNLOCK_FIGHTER,
    hp: 1500,
    attack: 500,     // Aire-Aire
    defense: 150,    // Evasión
    recruitTime: 420000, // 7 Minutos
    cost: { money: 8000000, oil: 4000, ammo: 2000 },
    upkeep: { [ResourceType.MONEY]: rate(6000), [ResourceType.OIL]: rate(1000), [ResourceType.GOLD]: rate(2) },
    rapidFire: {
        [UnitType.BOMBER]: 0.25,     
        [UnitType.HELICOPTER]: 0.25, 
        [UnitType.FIGHTER_JET]: 0.15 
    },
    score: 60,
  },

  // ========================================================================
  // TIER 3: SUPER-PESADO / NAVAL (Defensa 350-600)
  // Umbral daño recibido: 70-120
  // ========================================================================

  [UnitType.HEAVY_TANK]: {
    id: UnitType.HEAVY_TANK,
    category: UnitCategory.TANK,
    translationKey: 'heavy_tank',
    reqTech: TechType.UNLOCK_HEAVY_TANK,
    hp: 4500,
    attack: 350,     
    defense: 550,    // Umbral 110. Inmune a casi todo excepto especialistas.
    recruitTime: 540000, // 9 Minutos
    cost: { money: 8000000, oil: 5000, ammo: 3000 },
    upkeep: { [ResourceType.MONEY]: rate(5000), [ResourceType.OIL]: rate(800), [ResourceType.DIAMOND]: rate(0.1) },
    rapidFire: {
        [UnitType.TANK]: 0.20,       
        [UnitType.HOWITZER]: 0.15,
        [UnitType.DESTROYER]: 0.05
    },
    score: 80,
  },

  [UnitType.HOWITZER]: { // Obús (Moved to Tier 3 Offensive Power, Tier 1 Def)
    id: UnitType.HOWITZER,
    category: UnitCategory.ARTILLERY,
    translationKey: 'howitzer',
    reqTech: TechType.UNLOCK_HOWITZER,
    hp: 200,
    attack: 300,     // Rompe cualquier blindaje
    defense: 20,     // Muy vulnerable
    recruitTime: 210000, // 3 Minutos 30 Segundos
    cost: { money: 3000000, oil: 200, ammo: 1500 },
    upkeep: { [ResourceType.MONEY]: rate(2000), [ResourceType.AMMO]: rate(200) },
    rapidFire: {
        [UnitType.HEAVY_TANK]: 0.10, 
        [UnitType.DESTROYER]: 0.10,
        [UnitType.TANK]: 0.15
    },
    score: 20,
  },

  [UnitType.DESTROYER]: {
    id: UnitType.DESTROYER,
    category: UnitCategory.NAVAL,
    translationKey: 'destroyer',
    reqTech: TechType.UNLOCK_DESTROYER,
    hp: 6000,
    attack: 400,
    defense: 300,    // Umbral 60
    recruitTime: 360000, // 6 Minutos
    cost: { money: 12000000, oil: 6000, ammo: 4000 },
    upkeep: { [ResourceType.MONEY]: rate(8000), [ResourceType.OIL]: rate(1200) },
    rapidFire: {
        [UnitType.SUBMARINE]: 0.20,  
        [UnitType.FIGHTER_JET]: 0.15,
        [UnitType.BOMBER]: 0.10
    },
    score: 100,
  },

  [UnitType.SUBMARINE]: {
    id: UnitType.SUBMARINE,
    category: UnitCategory.NAVAL,
    translationKey: 'submarine',
    reqTech: TechType.UNLOCK_SUBMARINE,
    hp: 3000,        
    attack: 800,     // Torpedos Masivos
    defense: 120,    
    recruitTime: 480000, // 8 Minutos
    cost: { money: 18000000, oil: 8000, ammo: 2000 },
    upkeep: { [ResourceType.MONEY]: rate(10000), [ResourceType.OIL]: rate(1500), [ResourceType.GOLD]: rate(5) },
    rapidFire: {
        [UnitType.DESTROYER]: 0.20,  
        [UnitType.PATROL_BOAT]: 0.25,
        [UnitType.HEAVY_TANK]: 0.05 // Misil crucero a tierra
    },
    score: 150,
  },

  [UnitType.BOMBER]: {
    id: UnitType.BOMBER,
    category: UnitCategory.AIR,
    translationKey: 'bomber',
    reqTech: TechType.UNLOCK_BOMBER,
    hp: 4000,        
    attack: 1500,    // Nuke táctica / MOAB
    defense: 250,    
    recruitTime: 600000, // 10 Minutos (Max)
    cost: { money: 35000000, oil: 15000, ammo: 10000 },
    upkeep: { [ResourceType.MONEY]: rate(20000), [ResourceType.OIL]: rate(4000), [ResourceType.DIAMOND]: rate(0.5) },
    rapidFire: {
        [UnitType.HEAVY_TANK]: 0.30, 
        [UnitType.DESTROYER]: 0.20,  
        [UnitType.HOWITZER]: 0.30    
    },
    score: 250,
  },
};

export const INITIAL_UNITS: Record<UnitType, number> = Object.values(UnitType).reduce((acc, type) => {
  acc[type] = 0;
  return acc;
}, {} as Record<UnitType, number>);
