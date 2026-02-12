
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
export const PVP_LOOT_FACTOR = 0.15; // 15% of enemy investment recovered (Updated Requirement)
export const PVP_DIAMOND_STEAL_CHANCE = 0.50; // 50% Chance for bots to steal diamonds
export const MAX_ATTACKS_PER_TARGET = 3; // Limit attacks per target per day

// THREAT SYSTEM SETTINGS
export const THREAT_THRESHOLD = 100; // Trigger attack at 100
export const THREAT_OFFLINE_FACTOR = 0.25; // 4x Slower when offline

// THREAT (NEW LOGIC)
export const THREAT_PER_DIAMOND_LEVEL_PER_MINUTE = 1.0; // +1% per level per minute
export const WAR_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 Hours Cooldown after war

// WAR SYSTEM (UPDATED V1.2.1)
// Base: 130m (2h 10m).
// Waves: 8 waves * 15m = 120m. Leaves 10m buffer.
// Overtime: Only on tie. Adds 20m + 1 Wave + 1 Attack.
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
export const SCORE_TO_RESOURCE_VALUE = 12500; // 1 Point = $12,500 Resource Value (Updated Requirement)
export const BOT_BUDGET_RATIO = 1.0; // Bots invest 100% of Total Value into Army

export const TIER_THRESHOLDS = {
    TIER_1: 15000,
    TIER_2: 100000,
    TIER_3: 500000
};

export const SAVE_VERSION = 4;