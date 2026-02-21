
import { BuildingType } from "./types/enums";

// --- CONFIGURATION CONSTANTS ---
// Data definitions have been moved to the 'data/' directory to respect SRP.

export const TICK_RATE_MS = 1000;

// NEWBIE PROTECTION
export const NEWBIE_PROTECTION_THRESHOLD = 1000; // Points required to enable Threat and PvP

// CAMPAIGN SETTINGS
export const CAMPAIGN_TRAVEL_TIME = 7.5 * 60 * 1000; // 7.5 Minutes
export const CAMPAIGN_COOLDOWN = 15 * 60 * 1000; // 15 Minutes

// PVP SETTINGS
export const PVP_TRAVEL_TIME_MS = 15 * 60 * 1000; // 15 Minutes standard for PvP and War
export const PVP_RANGE_MIN = 0.5; // 50%
export const PVP_RANGE_MAX = 2.0; // 200%
export const PVP_LOOT_FACTOR = 0.15; // Legacy Factor (Kept for compatibility)
export const MAX_ATTACKS_PER_TARGET = 3; // Limit attacks per target per day

// BUILDING PLUNDER SETTINGS (NEW V1.3)
export const PLUNDER_RATES = [0.33, 0.25, 0.15]; // 1st attack, 2nd, 3rd

// Only Resource Producers can be stolen (Quantity Mode buildings + Skyscraper)
// Diamond Mine is handled separately via Damage logic.
export const PLUNDERABLE_BUILDINGS = [
    BuildingType.HOUSE,
    BuildingType.FACTORY,
    BuildingType.SKYSCRAPER,
    BuildingType.OIL_RIG,
    BuildingType.GOLD_MINE,
    BuildingType.MUNITIONS_FACTORY
];

// THREAT SYSTEM SETTINGS
export const THREAT_THRESHOLD = 100; // Trigger attack at 100
export const THREAT_OFFLINE_FACTOR = 0.25; // 4x Slower when offline

// THREAT (NEW LOGIC)
export const THREAT_PER_DIAMOND_LEVEL_PER_MINUTE = 1.0; // +1% per level per minute
export const WAR_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 Hours Cooldown after war

// WAR SYSTEM (UPDATED V1.2.1)
export const WAR_DURATION_MS = 130 * 60 * 1000; // 2 Hours 10 Minutes Base
export const WAR_OVERTIME_MS = 20 * 60 * 1000; // 20 Minutes added on Tie
export const WAR_TOTAL_WAVES = 8; // 8 Waves Base
export const WAR_PLAYER_ATTACKS = 8; // Matches waves
export const WAR_WAVE_BASE_STRENGTH = 0.95; // 95%
export const WAR_WAVE_SCALING = 0.05; // +5% per wave
export const WAR_WAVE_INTERVAL_MS = PVP_TRAVEL_TIME_MS; // Waves arrive every 15 mins (if simulated offline)

// OFFLINE PROGRESSION LIMITS
export const OFFLINE_PRODUCTION_LIMIT_MS = 4 * 60 * 60 * 1000; // 4 Hours Cap for Resources/Upkeep

// RVE & BALANCING CONSTANTS (V1.2.2)
export const SCORE_TO_RESOURCE_VALUE = 9000; // 1 Point = $9,000 Resource Value (Attack Budget Formula)
export const BOT_BUDGET_RATIO = 1.0; // Bots invest 100% of Total Value into Army

export const TIER_THRESHOLDS = {
    TIER_1: 15000,
    TIER_2: 100000,
    TIER_3: 500000
};

// BANK CONFIGURATION (Fixed Capacities)
// Index 0 is unused (Level 0), Index 1 is Level 1, etc.
export const BANK_LEVEL_CAPACITIES = [
    0, // Level 0
    5000000, // Level 1: 5M
    10000000, // Level 2: 10M
    25000000, // Level 3: 25M
    50000000, // Level 4: 50M
    75000000, // Level 5: 75M
    125000000, // Level 6: 125M
    180000000, // Level 7: 180M
    250000000, // Level 8: 250M
    400000000, // Level 9: 400M
    800000000, // Level 10: 800M
    1500000000, // Level 11: 1.50K Mill
    3500000000, // Level 12: 3.50K Mill
    8000000000, // Level 13: 8.00K Mill
    20000000000, // Level 14: 20.00K Mill
    50000000000 // Level 15: 50.00K Mill (50 Bill)
];

export const SAVE_VERSION = 5;
