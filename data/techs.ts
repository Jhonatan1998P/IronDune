
import { BuildingType, TechCategory, TechDef, TechType } from '../types';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const TECH_DEFS: Record<TechType, TechDef> = {
  // =================================================================================
  // RAMA: PRODUCTIVE & LOGISTICS (La base de la pirámide)
  // =================================================================================
  
  // --- ECONOMY ---
  [TechType.EFFICIENT_WORKFLOWS]: {
    id: TechType.EFFICIENT_WORKFLOWS,
    category: TechCategory.PRODUCTIVE,
    reqUniversityLevel: 1,
    translationKey: 'efficient_workflows',
    cost: { money: 100000, oil: 0, ammo: 0 }, 
    costMultiplier: 2.5, 
    maxLevel: 20,
    researchTime: 10 * MINUTE,
    score: 100,
  },
  [TechType.DEEP_DRILLING]: {
    id: TechType.DEEP_DRILLING,
    category: TechCategory.PRODUCTIVE,
    reqUniversityLevel: 2,
    reqBuildings: { [BuildingType.OIL_RIG]: 5 },
    translationKey: 'deep_drilling',
    cost: { money: 250000, oil: 5000, ammo: 0 },
    costMultiplier: 2.5,
    maxLevel: 20,
    researchTime: 15 * MINUTE,
    score: 150,
  },
  [TechType.MASS_PRODUCTION]: {
    id: TechType.MASS_PRODUCTION,
    category: TechCategory.PRODUCTIVE,
    reqUniversityLevel: 3,
    reqBuildings: { [BuildingType.FACTORY]: 3 },
    translationKey: 'mass_production',
    cost: { money: 500000, oil: 10000, ammo: 0 },
    costMultiplier: 2.5,
    maxLevel: 20,
    researchTime: 20 * MINUTE,
    score: 200,
  },
  [TechType.GOLD_REFINING]: {
    id: TechType.GOLD_REFINING,
    category: TechCategory.PRODUCTIVE,
    reqUniversityLevel: 5,
    reqBuildings: { [BuildingType.GOLD_MINE]: 2 },
    translationKey: 'gold_refining',
    cost: { money: 2000000, oil: 50000, ammo: 0 },
    costMultiplier: 3.0,
    maxLevel: 20,
    researchTime: 45 * MINUTE,
    score: 500,
  },
  [TechType.LOGISTICS_RAIDING]: {
    id: TechType.LOGISTICS_RAIDING,
    category: TechCategory.PRODUCTIVE,
    reqUniversityLevel: 6,
    translationKey: 'logistics_raiding',
    cost: { money: 5000000, oil: 100000, ammo: 100000 },
    costMultiplier: 3.0,
    maxLevel: 20,
    researchTime: 1 * HOUR,
    score: 1000,
  },

  // --- LOGISTICS (Critical for T3 storage requirements) ---
  [TechType.WAREHOUSING_1]: {
    id: TechType.WAREHOUSING_1,
    category: TechCategory.LOGISTICS,
    reqUniversityLevel: 1,
    translationKey: 'warehousing_1',
    cost: { money: 50000, oil: 0, ammo: 0 },
    researchTime: 5 * MINUTE,
    score: 50,
  },
  [TechType.RESOURCE_MANAGEMENT]: {
    id: TechType.RESOURCE_MANAGEMENT,
    category: TechCategory.LOGISTICS,
    reqUniversityLevel: 4,
    reqTechs: [TechType.WAREHOUSING_1],
    translationKey: 'resource_management',
    cost: { money: 1500000, oil: 25000, ammo: 0 },
    researchTime: 30 * MINUTE,
    score: 300,
  },
  
  // NEW: Campaign Slots Tech
  [TechType.STRATEGIC_COMMAND]: {
    id: TechType.STRATEGIC_COMMAND,
    category: TechCategory.LOGISTICS,
    reqUniversityLevel: 10,
    reqTechs: [TechType.RESOURCE_MANAGEMENT, TechType.ADV_INFANTRY_TACTICS],
    reqEmpirePoints: 500000, // Very high requirement
    translationKey: 'strategic_command',
    cost: { money: 50000000, oil: 5000000, ammo: 2500000 },
    costMultiplier: 10.0, // Extremely expensive to level up (+1 slot per level, max 3 levels = 4 slots total)
    maxLevel: 3,
    researchTime: 12 * HOUR,
    score: 10000,
  },

  // =================================================================================
  // RAMA: GROUND & INFANTRY (Tierra)
  // =================================================================================

  // TIER 1: BASIC INFANTRY
  [TechType.BASIC_TRAINING]: {
    id: TechType.BASIC_TRAINING,
    category: TechCategory.MILITARY_GROUND,
    reqUniversityLevel: 1,
    translationKey: 'basic_training',
    cost: { money: 15000, oil: 0, ammo: 500 },
    researchTime: 2 * MINUTE,
    score: 10,
  },
  [TechType.UNLOCK_SOLDIER]: {
    id: TechType.UNLOCK_SOLDIER,
    category: TechCategory.MILITARY_GROUND,
    reqUniversityLevel: 1,
    reqBuildings: { [BuildingType.BARRACKS]: 1 },
    reqTechs: [TechType.BASIC_TRAINING],
    translationKey: 'unlock_soldier',
    cost: { money: 25000, oil: 0, ammo: 1000 },
    researchTime: 5 * MINUTE,
    score: 20,
  },

  // TIER 2: SPECIALIZED INFANTRY
  [TechType.CAMOUFLAGE]: {
    id: TechType.CAMOUFLAGE,
    category: TechCategory.MILITARY_GROUND,
    reqUniversityLevel: 3,
    reqTechs: [TechType.BASIC_TRAINING],
    translationKey: 'camouflage',
    cost: { money: 500000, oil: 5000, ammo: 10000 },
    researchTime: 30 * MINUTE,
    score: 150,
  },
  [TechType.MARKSMANSHIP]: {
    id: TechType.MARKSMANSHIP,
    category: TechCategory.MILITARY_GROUND,
    reqUniversityLevel: 3,
    reqBuildings: { [BuildingType.BARRACKS]: 5 },
    translationKey: 'marksmanship',
    cost: { money: 750000, oil: 0, ammo: 25000 },
    researchTime: 45 * MINUTE,
    score: 200,
  },
  [TechType.UNLOCK_SNIPER]: {
    id: TechType.UNLOCK_SNIPER,
    category: TechCategory.MILITARY_GROUND,
    reqUniversityLevel: 4,
    reqBuildings: { [BuildingType.BARRACKS]: 8 },
    reqTechs: [TechType.CAMOUFLAGE, TechType.MARKSMANSHIP],
    translationKey: 'unlock_sniper',
    cost: { money: 1500000, oil: 10000, ammo: 50000 },
    researchTime: 1 * HOUR,
    score: 350,
  },

  // TIER 3: ELITE INFANTRY
  [TechType.ADV_INFANTRY_TACTICS]: {
    id: TechType.ADV_INFANTRY_TACTICS,
    category: TechCategory.MILITARY_GROUND,
    reqUniversityLevel: 7,
    reqTechs: [TechType.UNLOCK_SNIPER, TechType.UNLOCK_MORTAR], // Cross dependency
    translationKey: 'adv_infantry_tactics',
    cost: { money: 15000000, oil: 100000, ammo: 500000 }, // High Cost
    researchTime: 4 * HOUR,
    score: 1000,
  },
  [TechType.UNLOCK_COMMANDO]: {
    id: TechType.UNLOCK_COMMANDO,
    category: TechCategory.MILITARY_GROUND,
    reqUniversityLevel: 8,
    reqBuildings: { [BuildingType.BARRACKS]: 15, [BuildingType.UNIVERSITY]: 8 },
    reqTechs: [TechType.ADV_INFANTRY_TACTICS, TechType.EXPLOSIVE_CHEMISTRY], // Needs explosives
    translationKey: 'unlock_commando',
    cost: { money: 35000000, oil: 250000, ammo: 1000000 },
    researchTime: 6 * HOUR,
    score: 2500,
  },

  // SPECIAL: PATROL
  [TechType.PATROL_TRAINING]: {
    id: TechType.PATROL_TRAINING,
    category: TechCategory.MILITARY_GROUND,
    reqUniversityLevel: 5,
    reqBuildings: { [BuildingType.BARRACKS]: 10 },
    translationKey: 'patrol_training',
    cost: { money: 5000000, oil: 50000, ammo: 50000 },
    researchTime: 2 * HOUR,
    score: 500,
    maxLevel: 10,
    costMultiplier: 2.0 
  },

  // =================================================================================
  // RAMA: MECHANIZED & ARMOR (Blindados)
  // =================================================================================

  // TIER 1: LIGHT VEHICLES
  [TechType.COMBUSTION_ENGINE]: {
    id: TechType.COMBUSTION_ENGINE,
    category: TechCategory.MILITARY_MECH,
    reqUniversityLevel: 2,
    reqBuildings: { [BuildingType.OIL_RIG]: 3 },
    translationKey: 'combustion_engine',
    cost: { money: 300000, oil: 25000, ammo: 0 }, 
    researchTime: 20 * MINUTE,
    score: 100,
  },
  [TechType.UNLOCK_LIGHT_TANK]: {
    id: TechType.UNLOCK_LIGHT_TANK,
    category: TechCategory.MILITARY_MECH,
    reqUniversityLevel: 3,
    reqBuildings: { [BuildingType.TANK_FACTORY]: 2 },
    reqTechs: [TechType.COMBUSTION_ENGINE],
    translationKey: 'unlock_light_tank',
    cost: { money: 800000, oil: 50000, ammo: 10000 },
    researchTime: 40 * MINUTE,
    score: 250,
  },

  // TIER 2: MAIN BATTLE TANKS
  [TechType.HEAVY_PLATING]: {
    id: TechType.HEAVY_PLATING,
    category: TechCategory.MILITARY_MECH,
    reqUniversityLevel: 5,
    reqBuildings: { [BuildingType.FACTORY]: 10 },
    translationKey: 'heavy_plating',
    cost: { money: 5000000, oil: 200000, ammo: 0 },
    researchTime: 2 * HOUR,
    score: 600,
  },
  [TechType.UNLOCK_TANK]: {
    id: TechType.UNLOCK_TANK,
    category: TechCategory.MILITARY_MECH,
    reqUniversityLevel: 6,
    reqBuildings: { [BuildingType.TANK_FACTORY]: 5 },
    reqTechs: [TechType.COMBUSTION_ENGINE, TechType.HEAVY_PLATING, TechType.BALLISTICS], // Needs Ballistics
    translationKey: 'unlock_tank',
    cost: { money: 12000000, oil: 500000, ammo: 100000 },
    researchTime: 4 * HOUR,
    score: 1200,
  },

  // TIER 3: SUPER HEAVY
  [TechType.COMPOSITE_ARMOR]: {
    id: TechType.COMPOSITE_ARMOR,
    category: TechCategory.MILITARY_MECH,
    reqUniversityLevel: 8,
    reqTechs: [TechType.HEAVY_PLATING],
    translationKey: 'composite_armor',
    cost: { money: 40000000, oil: 2000000, ammo: 0 },
    researchTime: 8 * HOUR,
    score: 3000,
  },
  [TechType.UNLOCK_HEAVY_TANK]: {
    id: TechType.UNLOCK_HEAVY_TANK,
    category: TechCategory.MILITARY_MECH,
    reqUniversityLevel: 9,
    reqBuildings: { [BuildingType.TANK_FACTORY]: 10 },
    reqTechs: [TechType.COMPOSITE_ARMOR, TechType.UNLOCK_TANK, TechType.EXPLOSIVE_CHEMISTRY],
    translationKey: 'unlock_heavy_tank',
    cost: { money: 85000000, oil: 5000000, ammo: 1000000 },
    researchTime: 12 * HOUR,
    score: 5000,
  },

  // =================================================================================
  // RAMA: ARTILLERY & SUPPORT (Artillería)
  // =================================================================================

  // TIER 1: LIGHT ARTILLERY
  [TechType.BALLISTICS]: {
    id: TechType.BALLISTICS,
    category: TechCategory.MILITARY_GROUND, // Categorized here for tech tree grouping
    reqUniversityLevel: 2,
    translationKey: 'ballistics',
    cost: { money: 150000, oil: 5000, ammo: 10000 },
    researchTime: 15 * MINUTE,
    score: 80,
  },
  [TechType.UNLOCK_MORTAR]: {
    id: TechType.UNLOCK_MORTAR,
    category: TechCategory.MILITARY_GROUND,
    reqUniversityLevel: 2,
    reqBuildings: { [BuildingType.FACTORY]: 5 },
    reqTechs: [TechType.BALLISTICS],
    translationKey: 'unlock_mortar',
    cost: { money: 400000, oil: 10000, ammo: 25000 },
    researchTime: 30 * MINUTE,
    score: 150,
  },

  // TIER 2: HEAVY ARTILLERY
  [TechType.EXPLOSIVE_CHEMISTRY]: {
    id: TechType.EXPLOSIVE_CHEMISTRY,
    category: TechCategory.MILITARY_MECH,
    reqUniversityLevel: 4,
    reqBuildings: { [BuildingType.MUNITIONS_FACTORY]: 5 },
    reqTechs: [TechType.BALLISTICS],
    translationKey: 'explosive_chemistry',
    cost: { money: 2500000, oil: 50000, ammo: 100000 },
    researchTime: 2 * HOUR,
    score: 500,
  },
  [TechType.UNLOCK_HOWITZER]: {
    id: TechType.UNLOCK_HOWITZER,
    category: TechCategory.MILITARY_MECH,
    reqUniversityLevel: 5,
    reqBuildings: { [BuildingType.TANK_FACTORY]: 4 },
    reqTechs: [TechType.EXPLOSIVE_CHEMISTRY, TechType.HEAVY_PLATING], // Needs Tank Armor tech
    translationKey: 'unlock_howitzer',
    cost: { money: 6000000, oil: 150000, ammo: 250000 },
    researchTime: 3 * HOUR,
    score: 900,
  },

  // TIER 3: ROCKETRY
  [TechType.ROCKETRY]: {
    id: TechType.ROCKETRY,
    category: TechCategory.MILITARY_MECH,
    reqUniversityLevel: 8,
    reqTechs: [TechType.EXPLOSIVE_CHEMISTRY, TechType.AERODYNAMICS], // Needs Aero knowledge
    translationKey: 'rocketry',
    cost: { money: 30000000, oil: 1000000, ammo: 500000 },
    researchTime: 6 * HOUR,
    score: 2500,
  },
  [TechType.UNLOCK_MLRS]: {
    id: TechType.UNLOCK_MLRS,
    category: TechCategory.MILITARY_MECH,
    reqUniversityLevel: 9,
    reqBuildings: { [BuildingType.TANK_FACTORY]: 8 },
    reqTechs: [TechType.ROCKETRY, TechType.UNLOCK_TANK],
    translationKey: 'unlock_mlrs',
    cost: { money: 65000000, oil: 3000000, ammo: 2000000 },
    researchTime: 10 * HOUR,
    score: 4500,
  },

  // =================================================================================
  // RAMA: NAVAL (Marina)
  // =================================================================================

  // TIER 1: COASTAL DEFENSE
  [TechType.NAVAL_ENGINEERING]: {
    id: TechType.NAVAL_ENGINEERING,
    category: TechCategory.MILITARY_NAVAL,
    reqUniversityLevel: 3,
    reqBuildings: { [BuildingType.SHIPYARD]: 1 },
    translationKey: 'naval_engineering',
    cost: { money: 1000000, oil: 100000, ammo: 0 },
    researchTime: 1 * HOUR,
    score: 400,
  },
  [TechType.UNLOCK_PATROL_BOAT]: {
    id: TechType.UNLOCK_PATROL_BOAT,
    category: TechCategory.MILITARY_NAVAL,
    reqUniversityLevel: 4,
    reqBuildings: { [BuildingType.SHIPYARD]: 2 },
    reqTechs: [TechType.NAVAL_ENGINEERING, TechType.COMBUSTION_ENGINE],
    translationKey: 'unlock_patrol_boat',
    cost: { money: 2500000, oil: 200000, ammo: 50000 },
    researchTime: 2 * HOUR,
    score: 700,
  },

  // TIER 2: BLUE WATER NAVY
  [TechType.SONAR_TECH]: {
    id: TechType.SONAR_TECH,
    category: TechCategory.MILITARY_NAVAL,
    reqUniversityLevel: 6,
    reqTechs: [TechType.NAVAL_ENGINEERING],
    translationKey: 'sonar_tech',
    cost: { money: 8000000, oil: 500000, ammo: 0 },
    researchTime: 4 * HOUR,
    score: 1500,
  },
  [TechType.UNLOCK_DESTROYER]: {
    id: TechType.UNLOCK_DESTROYER,
    category: TechCategory.MILITARY_NAVAL,
    reqUniversityLevel: 7,
    reqBuildings: { [BuildingType.SHIPYARD]: 5 },
    reqTechs: [TechType.SONAR_TECH, TechType.HEAVY_PLATING, TechType.BALLISTICS],
    translationKey: 'unlock_destroyer',
    cost: { money: 20000000, oil: 1500000, ammo: 500000 },
    researchTime: 6 * HOUR,
    score: 3000,
  },

  // TIER 3: DEEP SEA
  [TechType.STEALTH_HULL]: {
    id: TechType.STEALTH_HULL,
    category: TechCategory.MILITARY_NAVAL,
    reqUniversityLevel: 9,
    reqTechs: [TechType.NAVAL_ENGINEERING, TechType.COMPOSITE_ARMOR],
    translationKey: 'stealth_hull',
    cost: { money: 50000000, oil: 3000000, ammo: 0 },
    researchTime: 10 * HOUR,
    score: 5000,
  },
  [TechType.UNLOCK_SUBMARINE]: {
    id: TechType.UNLOCK_SUBMARINE,
    category: TechCategory.MILITARY_NAVAL,
    reqUniversityLevel: 10,
    reqBuildings: { [BuildingType.SHIPYARD]: 10 },
    reqTechs: [TechType.STEALTH_HULL, TechType.SONAR_TECH, TechType.ROCKETRY], // Needs torpedo/rocketry
    translationKey: 'unlock_submarine',
    cost: { money: 100000000, oil: 8000000, ammo: 2000000 },
    researchTime: 16 * HOUR,
    score: 8000,
  },

  // =================================================================================
  // RAMA: AIR FORCE (Aérea)
  // =================================================================================

  // TIER 1: ROTORCRAFT
  [TechType.AERODYNAMICS]: {
    id: TechType.AERODYNAMICS,
    category: TechCategory.MILITARY_AIR,
    reqUniversityLevel: 5,
    translationKey: 'aerodynamics',
    cost: { money: 3000000, oil: 500000, ammo: 0 },
    researchTime: 3 * HOUR,
    score: 800,
  },
  [TechType.UNLOCK_HELICOPTER]: {
    id: TechType.UNLOCK_HELICOPTER,
    category: TechCategory.MILITARY_AIR,
    reqUniversityLevel: 5,
    reqBuildings: { [BuildingType.AIRFIELD]: 2 },
    reqTechs: [TechType.AERODYNAMICS, TechType.COMBUSTION_ENGINE, TechType.ROCKETRY], // Needs rockets
    translationKey: 'unlock_helicopter',
    cost: { money: 6000000, oil: 1000000, ammo: 200000 },
    researchTime: 4 * HOUR,
    score: 1200,
  },

  // TIER 2: JET AIRCRAFT
  [TechType.JET_ENGINES]: {
    id: TechType.JET_ENGINES,
    category: TechCategory.MILITARY_AIR,
    reqUniversityLevel: 7,
    reqTechs: [TechType.AERODYNAMICS],
    translationKey: 'jet_engines',
    cost: { money: 15000000, oil: 2000000, ammo: 0 },
    researchTime: 6 * HOUR,
    score: 2500,
  },
  [TechType.UNLOCK_FIGHTER]: {
    id: TechType.UNLOCK_FIGHTER,
    category: TechCategory.MILITARY_AIR,
    reqUniversityLevel: 8,
    reqBuildings: { [BuildingType.AIRFIELD]: 5 },
    reqTechs: [TechType.JET_ENGINES, TechType.MARKSMANSHIP], // Needs advanced optics/aiming
    translationKey: 'unlock_fighter',
    cost: { money: 35000000, oil: 4000000, ammo: 1000000 },
    researchTime: 8 * HOUR,
    score: 4000,
  },

  // TIER 3: STRATEGIC BOMBER
  [TechType.PRECISION_BOMBING]: {
    id: TechType.PRECISION_BOMBING,
    category: TechCategory.MILITARY_AIR,
    reqUniversityLevel: 9,
    reqTechs: [TechType.AERODYNAMICS, TechType.BALLISTICS],
    translationKey: 'precision_bombing',
    cost: { money: 50000000, oil: 1000000, ammo: 2000000 },
    researchTime: 10 * HOUR,
    score: 5000,
  },
  [TechType.UNLOCK_BOMBER]: {
    id: TechType.UNLOCK_BOMBER,
    category: TechCategory.MILITARY_AIR,
    reqUniversityLevel: 10,
    reqBuildings: { [BuildingType.AIRFIELD]: 10 },
    reqTechs: [TechType.PRECISION_BOMBING, TechType.JET_ENGINES, TechType.EXPLOSIVE_CHEMISTRY],
    translationKey: 'unlock_bomber',
    cost: { money: 120000000, oil: 10000000, ammo: 5000000 },
    researchTime: 24 * HOUR,
    score: 10000,
  }
};
