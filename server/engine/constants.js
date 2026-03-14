// ============================================================
// CONSTANTS - Mirror of constants.ts (no TypeScript)
// ============================================================

import { BuildingType, BotPersonality, ResourceType } from './enums.js';

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const TICK_RATE_MS = 1000;

export const NEWBIE_PROTECTION_THRESHOLD = 1200;
export const GLOBAL_ATTACK_TRAVEL_TIME_MS = 15 * 60 * 1000;
export const P2P_ATTACK_TRAVEL_TIME_MS = 15 * 60 * 1000;
// --- REGLAS DE COMBATE IRON DUNE (ESTRICTO) ---
export const MAX_ATTACKS_24H = 6;
export const MAX_ATTACKS_1H = 3;
export const BASH_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 Horas
export const SHORT_LIMIT_WINDOW_MS = 60 * 60 * 1000;    // 1 Hora

// --- SALVAMENTO (DEBRIS) ---
export const GLOBAL_DEBRIS_RATIO = 0.30; // 30% para todos (Atacante, Defensor, Aliados)

export const PVP_LOOT_FACTOR = 0; // Deshabilitamos robo de recursos directo
export const RETURN_SPEED_MULTIPLIER = 1.0; 

export const RESOURCE_WEIGHTS = {
    MONEY: 1,
    OIL: 2,
    AMMO: 1.5,
    GOLD: 10,
    DIAMOND: 500
};

export const UNIT_STATS = {
    // Definiremos esto aquí para que el servidor no dependa del frontend
    INFANTRY: { power: 10, toughness: 10, speed: 100, cargo: 50 },
    TANK: { power: 500, toughness: 600, speed: 80, cargo: 2000 },
    JET: { power: 1200, toughness: 800, speed: 400, cargo: 500 },
    SHIP: { power: 5000, toughness: 10000, speed: 40, cargo: 50000 },
    SALVAGER_DRONE: { power: 1, toughness: 50, speed: 150, cargo: 500000 }
};

export const PLUNDER_RATES = [0.33, 0.25, 0.15];
export const BOT_BUILDINGS_PER_SCORE = 20;
export const PLUNDERABLE_BUILDINGS = [
  BuildingType.HOUSE,
  BuildingType.FACTORY,
  BuildingType.SKYSCRAPER,
  BuildingType.OIL_RIG,
  BuildingType.GOLD_MINE,
  BuildingType.MUNITIONS_FACTORY,
];

export const ATTACK_COOLDOWN_MIN_MS = 1 * 60 * 60 * 1000;
export const ATTACK_COOLDOWN_MAX_MS = 6 * 60 * 60 * 1000;

export const WAR_DURATION_MS = 130 * 60 * 1000;
export const WAR_OVERTIME_MS = 20 * 60 * 1000;
export const WAR_TOTAL_WAVES = 8;
export const WAR_PLAYER_ATTACKS = 8;
export const WAR_WAVE_INTERVAL_MS = GLOBAL_ATTACK_TRAVEL_TIME_MS;
export const WAR_COOLDOWN_MS = 30 * 60 * 1000;

export const OFFLINE_PRODUCTION_LIMIT_MS = 6 * 60 * 60 * 1000;

export const DEBRIS_EXPIRY_RAID_MS = 60 * 60 * 1000;
export const DEBRIS_EXPIRY_WAR_BUFFER_MS = 30 * 60 * 1000;
export const DEBRIS_EXPIRY_P2P_MS = 120 * 60 * 1000;
export const DEBRIS_EXPIRY_CAMPAIGN_MS = 30 * 60 * 1000;
export const DEBRIS_MAX_ACTIVE = 20;
export const DEBRIS_RATIO_ATTACKER = 0.30;
export const DEBRIS_RATIO_DEFENDER = 0.30;
export const DEBRIS_RATIO_ALLY = 0.20;
export const DEBRIS_ELIGIBLE_RESOURCES = [ResourceType.MONEY, ResourceType.OIL, ResourceType.AMMO];

export const SALVAGER_CARGO_CAPACITY = 500000;
export const SALVAGE_TRAVEL_TIME_MS = 7.5 * 60 * 1000;
export const SALVAGE_TRAVEL_TIME_WAR_MS = 5 * 60 * 1000;

export const UNLIMITED_CAPACITY = 999_999_999_999_999;

export const SCORE_TO_RESOURCE_VALUE = 9000;
export const BOT_BUDGET_RATIO = 1.0;

export const SPY_RESOURCE_RATIOS = {
  [BotPersonality.WARLORD]: { money: 0.40, oil: 0.35, gold: 0.10, ammo: 0.15 },
  [BotPersonality.TURTLE]: { money: 0.35, oil: 0.30, gold: 0.25, ammo: 0.10 },
  [BotPersonality.TYCOON]: { money: 0.50, oil: 0.20, gold: 0.20, ammo: 0.10 },
  [BotPersonality.ROGUE]: { money: 0.30, oil: 0.30, gold: 0.15, ammo: 0.25 },
};

export const TIER_THRESHOLDS = {
  TIER_1: 15000,
  TIER_2: 100000,
  TIER_3: 500000,
};

export const BANK_LEVEL_CAPACITIES = [
  0, 5000000, 10000000, 25000000, 50000000, 75000000, 125000000,
  180000000, 250000000, 400000000, 800000000, 1500000000, 3500000000,
  8000000000, 20000000000, 50000000000,
];

export const calculateMaxBankCapacity = (_empirePoints, bankLevel) => {
  if (bankLevel <= 0) return 0;
  if (bankLevel < BANK_LEVEL_CAPACITIES.length) return BANK_LEVEL_CAPACITIES[bankLevel];
  return BANK_LEVEL_CAPACITIES[BANK_LEVEL_CAPACITIES.length - 1];
};

export const calculateInterestEarned = (balance, rate, deltaTimeMs) => {
  if (balance <= 0 || rate <= 0) return 0;
  const timeInDays = deltaTimeMs / ONE_DAY_MS;
  return balance * rate * timeInDays;
};

export const REPUTATION_ALLY_THRESHOLD = 75;
export const REPUTATION_ENEMY_THRESHOLD = 30;
export const REPUTATION_ATTACK_PENALTY = -20;
export const REPUTATION_DEFEAT_PENALTY = -8;
export const REPUTATION_WIN_BONUS = 8;
export const REPUTATION_DEFEND_BONUS = 8;
export const REPUTATION_ALLY_DEFEND_CHANCE = 0.4;
export const REPUTATION_MIN = 0;
export const REPUTATION_MAX = 100;

export const REINFORCEMENT_RATIO = 0.05;
export const REINFORCEMENT_CHANCE = 0.15;
export const ALLY_REINFORCEMENT_MIN_SCORE = 1000;
export const ALLY_REINFORCEMENT_MAX_RATIO = 1.5;

export const ENEMY_ATTACK_CHECK_INTERVAL_MS = 30 * 60 * 1000;
export const ENEMY_ATTACK_COOLDOWN_MS = 2 * 60 * 60 * 1000;
export const ENEMY_ATTACK_MAX_PER_BOT = 3;
export const ENEMY_ATTACK_RESET_MS = ONE_DAY_MS;
export const ENEMY_ATTACK_BASE_CHANCE = 0.20;
export const ENEMY_ATTACK_CHANCE_MULTIPLIER = 0.015;
export const ENEMY_ATTACK_POWER_RATIO_MIN = 0.5;
export const ENEMY_ATTACK_POWER_RATIO_LIMIT = 1.5;
export const ENEMY_ATTACK_MAX_SIMULTANEOUS = 6;
export const ENEMY_ATTACK_SIMULTANEOUS_DELAY_MS = 5 * 60 * 1000;

export const ENEMY_ATTACK_CHANCE_WARLORD = 1.5;
export const ENEMY_ATTACK_CHANCE_TURTLE = 0.5;
export const ENEMY_ATTACK_CHANCE_TYCOON = 1.0;
export const ENEMY_ATTACK_CHANCE_ROGUE = 1.2;

export const RETALIATION_TIME_MIN_MS = 15 * 60 * 1000;
export const RETALIATION_TIME_MAX_MS = 45 * 60 * 1000;
export const RETALIATION_GRUDGE_DURATION_MS = ONE_DAY_MS;

export const RETALIATION_MULTIPLIER_WARLORD = 1.1;
export const RETALIATION_MULTIPLIER_TURTLE = 1.2;
export const RETALIATION_MULTIPLIER_TYCOON = 1.0;
export const RETALIATION_MULTIPLIER_ROGUE = 1.0;

export const RETALIATION_CHANCE_WARLORD = 0.95;
export const RETALIATION_CHANCE_TURTLE = 0.85;
export const RETALIATION_CHANCE_TYCOON = 0.70;
export const RETALIATION_CHANCE_ROGUE = 0.90;

export const REPUTATION_DECAY_INTERVAL_MS = 1 * 60 * 60 * 1000;
export const REPUTATION_DECAY_AMOUNT = 0.25;
export const REPUTATION_DECAY_MAX_THRESHOLD = 85;
export const REPUTATION_DECAY_BOOST_THRESHOLD = 30;
export const REPUTATION_DECAY_MAX_MULTIPLIER = 2.0;

export const DIPLOMACY_GIFT_REPUTATION_GAIN = 8;
export const DIPLOMACY_ALLIANCE_REP_GAIN = 5;
export const DIPLOMACY_PEACE_REP_GAIN = 10;

