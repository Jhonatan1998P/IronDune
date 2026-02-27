
import { BuildingType, BotPersonality } from "./types/enums";

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

// ATTACK SYSTEM (NEW V1.4)
export const ATTACK_COOLDOWN_MIN_MS = 1 * 60 * 60 * 1000; // 1 Hour
export const ATTACK_COOLDOWN_MAX_MS = 6 * 60 * 60 * 1000; // 6 Hours

// WAR SYSTEM (UPDATED V1.2.1)
export const WAR_DURATION_MS = 130 * 60 * 1000; // 2 Hours 10 Minutes Base
export const WAR_OVERTIME_MS = 20 * 60 * 1000; // 20 Minutes added on Tie
export const WAR_TOTAL_WAVES = 8; // 8 Waves Base
export const WAR_PLAYER_ATTACKS = 8; // Matches waves
export const WAR_WAVE_BASE_STRENGTH = 0.95; // 95%
export const WAR_WAVE_SCALING = 0.05; // +5% per wave
export const WAR_WAVE_INTERVAL_MS = PVP_TRAVEL_TIME_MS; // Waves arrive every 15 mins (if simulated offline)
export const WAR_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown between wars

// OFFLINE PROGRESSION LIMITS
export const OFFLINE_PRODUCTION_LIMIT_MS = 4 * 60 * 60 * 1000; // 4 Hours Cap for Resources/Upkeep

// RVE & BALANCING CONSTANTS (V1.2.2)
export const SCORE_TO_RESOURCE_VALUE = 9000; // 1 Point = $9,000 Resource Value (Attack Budget Formula)
export const BOT_BUDGET_RATIO = 1.0; // Bots invest 100% of Total Value into Army

// SPY RESOURCE RATIOS - How military budget is divided into resources when spying
// Each personality has different resource allocation preferences
export const SPY_RESOURCE_RATIOS: Record<BotPersonality, { money: number; oil: number; gold: number; ammo: number }> = {
    [BotPersonality.WARLORD]: { money: 0.40, oil: 0.35, gold: 0.10, ammo: 0.15 },    // Focus on oil & ammo for war
    [BotPersonality.TURTLE]: { money: 0.35, oil: 0.30, gold: 0.25, ammo: 0.10 },    // More gold for defense/building
    [BotPersonality.TYCOON]: { money: 0.50, oil: 0.20, gold: 0.20, ammo: 0.10 },    // More money for economy
    [BotPersonality.ROGUE]: { money: 0.30, oil: 0.30, gold: 0.15, ammo: 0.25 }      // More ammo for raids
};

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

export const SAVE_VERSION = 6;

// REPUTATION SYSTEM
export const REPUTATION_ALLY_THRESHOLD = 70; // Bots above this are allies
export const REPUTATION_ENEMY_THRESHOLD = 30; // Bots below this are enemies
export const REPUTATION_ATTACK_PENALTY = -15; // Reputation loss when player attacks bot
export const REPUTATION_DEFEAT_PENALTY = -10; // Reputation loss when player defeats bot
export const REPUTATION_WIN_BONUS = 5; // Reputation gain when bot wins against player (they respect strength)
export const REPUTATION_DEFEND_BONUS = 8; // Reputation gain when player successfully defends against bot
export const REPUTATION_ALLY_DEFEND_CHANCE = 0.4; // 40% chance ally bots will help defend
export const REPUTATION_ALLY_BONUS = 3; // Reputation bonus from allied bots
export const REPUTATION_MIN = 0;
export const REPUTATION_MAX = 100;

// ENEMY ATTACK SYSTEM (NEW)
export const ENEMY_ATTACK_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes - check if enemies attack
export const ENEMY_ATTACK_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours - min time between attacks from same bot
export const ENEMY_ATTACK_MAX_PER_BOT = 3; // Max attacks per bot per 24h cycle
export const ENEMY_ATTACK_RESET_MS = 24 * 60 * 60 * 1000; // 24 hours - reset attack counter
export const ENEMY_ATTACK_BASE_CHANCE = 0.20; // 20% base chance to attack at rep 30
export const ENEMY_ATTACK_CHANCE_MULTIPLIER = 0.025; // +2.5% chance per rep point below 30

// Personality-based attack chance modifiers (for enemy attack system)
export const ENEMY_ATTACK_CHANCE_WARLORD = 1.5; // 50% more likely to attack
export const ENEMY_ATTACK_CHANCE_TURTLE = 0.5; // 50% less likely to attack
export const ENEMY_ATTACK_CHANCE_TYCOON = 1.0; // Normal chance
export const ENEMY_ATTACK_CHANCE_ROGUE = 1.2; // 20% more likely (opportunistic)

// RETALIATION SYSTEM (UPDATED)
export const RETALIATION_TIME_MIN_MS = 15 * 60 * 1000; // 15 minutes minimum
export const RETALIATION_TIME_MAX_MS = 45 * 60 * 1000; // 45 minutes maximum
export const RETALIATION_GRUDGE_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours to hold a grudge

// Personality-based retaliation multipliers (affects army strength)
export const RETALIATION_MULTIPLIER_WARLORD = 1.3; // 30% stronger
export const RETALIATION_MULTIPLIER_TURTLE = 1.5; // 50% stronger (deathball)
export const RETALIATION_MULTIPLIER_TYCOON = 1.0; // Normal strength
export const RETALIATION_MULTIPLIER_ROGUE = 1.0; // Normal strength

// Personality-based retaliation chance (probability bot will actually retaliate when time comes)
export const RETALIATION_CHANCE_WARLORD = 0.95; // 95% chance - very vengeful
export const RETALIATION_CHANCE_TURTLE = 0.85; // 85% chance - holds grudges
export const RETALIATION_CHANCE_TYCOON = 0.70; // 70% chance - busy making money
export const RETALIATION_CHANCE_ROGUE = 0.90; // 90% chance - unpredictable but vengeful

// DIPLOMACY SYSTEM
export const REPUTATION_DECAY_INTERVAL_MS = 1 * 60 * 60 * 1000; // 1 hour
export const REPUTATION_DECAY_AMOUNT = 1; // Reputation loss per decay interval
export const REPUTATION_DECAY_MIN_THRESHOLD = 0; // Minimum reputation is 0 (no floor)
export const REPUTATION_DECAY_MAX_THRESHOLD = 75; // >= 75 doesn't decay
export const REPUTATION_DECAY_BOOST_THRESHOLD = 40; // Below 40, decay accelerates
export const REPUTATION_DECAY_MAX_MULTIPLIER = 2.0; // Maximum 2x decay when at 0 rep

export const DIPLOMACY_GIFT_BASE_COST: Partial<Record<string, number>> = {
    MONEY: 100000,
    OIL: 500,
    AMMO: 200,
    GOLD: 100
};
export const DIPLOMACY_GIFT_COST_SCALE = 50; // Base scale factor
export const DIPLOMACY_GIFT_COST_MAX_SCALE = 300; // Maximum scale when reputation <= 40
export const DIPLOMACY_GIFT_COST_REP_THRESHOLD = 40; // Reputation threshold for increased cost
export const DIPLOMACY_GIFT_REPUTATION_GAIN = 8; // +8 reputation per gift
export const DIPLOMACY_GIFT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between gifts to same bot
export const DIPLOMACY_ALLIANCE_REP_REQUIREMENT = 50; // Minimum reputation to propose alliance
export const DIPLOMACY_ALLIANCE_REP_GAIN = 5; // +5 reputation for proposing alliance
export const DIPLOMACY_PEACE_PROPOSAL_REP_REQUIREMENT = 35; // Minimum reputation to propose peace
export const DIPLOMACY_PEACE_REP_GAIN = 10; // +10 reputation for peace proposal
export const DIPLOMACY_PEACE_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours cooldown after peace proposal
