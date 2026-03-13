
import { BuildingType, BotPersonality, ResourceType } from "./types/enums";

// --- APP CONSTANTS ---
export const APP_VERSION = "Alpha 10.0.2";

// --- CONFIGURATION CONSTANTS ---
export const TICK_RATE_MS = 1000;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// NEWBIE PROTECTION
export const NEWBIE_PROTECTION_THRESHOLD = 1200; // Points required to enable Threat and PvP

// PVP SETTINGS
export const GLOBAL_ATTACK_TRAVEL_TIME_MS = 15 * 60 * 1000; // 15 Minutes standard for PvP, PvE and War
export const P2P_ATTACK_TRAVEL_TIME_MS = 15 * 60 * 1000; // 15 Minutes standard for Direct P2P Attacks
export const MAP_MISSION_TRAVEL_TIME_MS = 15 * 60 * 1000; // 15 Minutes standard for Campaign Map Missions
export const PVP_RANGE_MIN = 0.5; // 50%
export const PVP_RANGE_MAX = 1.5 // 150%
export const PVP_LOOT_FACTOR = 0.15; // Legacy Factor (Kept for compatibility)
export const MAX_ATTACKS_PER_TARGET = 3; // Limit attacks per target per day (bots)

// P2P COMBAT RULES
export const P2P_MAX_ATTACKS_PER_TARGET_PER_DAY = 6; // Max normal P2P attacks per target per day
export const P2P_ATTACK_RESET_INTERVAL_MS = ONE_DAY_MS; // 24 hours reset
export const P2P_ATTACK_COUNTS_STORAGE_KEY = 'ironDuneP2PAttackCounts'; // localStorage key

// P2P Building plunder rates (by attack number: 1st=33%, 2nd=25%, 3rd-6th=15%)
export const P2P_PLUNDER_RATES = [0.33, 0.25, 0.15, 0.15, 0.15, 0.15];

// BUILDING PLUNDER SETTINGS (NEW V1.3)
export const PLUNDER_RATES = [0.33, 0.25, 0.15]; // 1st attack, 2nd, 3rd (vs bots)
export const BOT_BUILDINGS_PER_SCORE = 20; // 1 building per 20 score points (score / 20)
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
export const WAR_WAVE_INTERVAL_MS = GLOBAL_ATTACK_TRAVEL_TIME_MS; // Waves arrive every 15 mins (if simulated offline)
export const WAR_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown between wars

// OFFLINE PROGRESSION LIMITS
export const OFFLINE_PRODUCTION_LIMIT_MS = 6 * 60 * 60 * 1000; // 6 Hours Cap for Resources/Upkeep

// LOGISTIC LOOT (BOTÍN LOGÍSTICO) SYSTEM
export const DEBRIS_EXPIRY_RAID_MS = 60 * 60 * 1000;        // 1 hour
export const DEBRIS_EXPIRY_WAR_BUFFER_MS = 30 * 60 * 1000;  // 30 min after war ends
export const DEBRIS_EXPIRY_P2P_MS = 120 * 60 * 1000;        // 2 hours
export const DEBRIS_EXPIRY_CAMPAIGN_MS = 30 * 60 * 1000;    // 30 minutes
export const DEBRIS_MAX_ACTIVE = 20;                         // Max simultaneous fields
export const DEBRIS_RATIO_ATTACKER = 0.30; // 30%
export const DEBRIS_RATIO_DEFENDER = 0.30; // 30%
export const DEBRIS_RATIO_ALLY = 0.20;     // 20%
export const DEBRIS_ELIGIBLE_RESOURCES = [ResourceType.MONEY, ResourceType.OIL, ResourceType.AMMO];

export const SALVAGER_CARGO_CAPACITY = 500000; // Capacity per drone
export const SALVAGE_TRAVEL_TIME_MS = 7.5 * 60 * 1000;  // 7.5 minutes
export const SALVAGE_TRAVEL_TIME_WAR_MS = 5 * 60 * 1000; // 5 minutes

// UNLIMITED CAPACITY (Used for Money, Oil, Ammo, Gold)
export const UNLIMITED_CAPACITY = 999_999_999_999_999;

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
export const BANK_RATE_CHANGE_INTERVAL_MS = ONE_DAY_MS; // 24 Hours
export const BANK_INTEREST_RATE_MIN = 0.10; // 10%
export const BANK_INTEREST_RATE_MAX = 0.20; // 20%

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

// BANK FORMULAS
export const calculateMaxBankCapacity = (_empirePoints: number, bankLevel: number): number => {
    if (bankLevel <= 0) return 0;
    if (bankLevel < BANK_LEVEL_CAPACITIES.length) {
        return BANK_LEVEL_CAPACITIES[bankLevel];
    }
    return BANK_LEVEL_CAPACITIES[BANK_LEVEL_CAPACITIES.length - 1];
};

export const calculateInterestEarned = (balance: number, rate: number, deltaTimeMs: number): number => {
    if (balance <= 0 || rate <= 0) return 0;
    const timeInDays = deltaTimeMs / ONE_DAY_MS;
    return balance * rate * timeInDays;
};

export const calculateHourlyInterest = (balance: number, rate: number): number => {
    return (balance * rate) / 24;
};

export const SAVE_VERSION = 7;

// REPUTATION SYSTEM
export const REPUTATION_ALLY_THRESHOLD = 75; // Bots above this are allies (75+)
export const REPUTATION_ENEMY_THRESHOLD = 30; // Bots below this are enemies
export const REPUTATION_ATTACK_PENALTY = -20; // Reputation loss when player attacks bot
export const REPUTATION_DEFEAT_PENALTY = -8; // Reputation loss when player defeats bot
export const REPUTATION_WIN_BONUS = 8; // Reputation gain when bot wins against player (they respect strength)
export const REPUTATION_DEFEND_BONUS = 8; // Reputation gain when player successfully defends against bot
export const REPUTATION_ALLY_DEFEND_CHANCE = 0.4; // 40% chance ally bots will help defend
export const REPUTATION_MIN = 0;
export const REPUTATION_MAX = 100;

// ALLIED REINFORCEMENTS SYSTEM
export const REINFORCEMENT_RATIO = 0.05; // Allies send 5% of their total military budget
export const REINFORCEMENT_CHANCE = 0.15; // 15% chance for allies to send reinforcements when player is attacked (TEST MODE)

// Ally score limits for reinforcements (to prevent very strong allies from helping)
export const ALLY_REINFORCEMENT_MIN_SCORE = 1000; // Minimum 1k points to send reinforcements
export const ALLY_REINFORCEMENT_MAX_RATIO = 1.5; // Maximum 150% of player's score

// ENEMY ATTACK SYSTEM (NEW)
export const ENEMY_ATTACK_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes - check if enemies attack
export const ENEMY_ATTACK_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours - min time between attacks from same bot
export const ENEMY_ATTACK_MAX_PER_BOT = 3; // Max attacks per bot per 24h cycle
export const ENEMY_ATTACK_RESET_MS = ONE_DAY_MS; // 24 hours - reset attack counter
export const ENEMY_ATTACK_BASE_CHANCE = 0.20; // 20% base chance to attack at rep 30
export const ENEMY_ATTACK_CHANCE_MULTIPLIER = 0.015; // +1.5% chance per rep point below 30
export const ENEMY_ATTACK_POWER_RATIO_MIN = 0.5; // Bots can only attack if their power is >= 50% of player
export const ENEMY_ATTACK_POWER_RATIO_LIMIT = 1.5; // Bots can only attack if their power is <= 150% of player
export const ENEMY_ATTACK_MAX_SIMULTANEOUS = 6; // Maximum number of simultaneous attacks the player can receive
export const ENEMY_ATTACK_SIMULTANEOUS_DELAY_MS = 5 * 60 * 1000; // 5 minutes between simultaneous attacks

// Personality-based attack chance modifiers (for enemy attack system)
export const ENEMY_ATTACK_CHANCE_WARLORD = 1.5; // 50% more likely to attack
export const ENEMY_ATTACK_CHANCE_TURTLE = 0.5; // 50% less likely to attack
export const ENEMY_ATTACK_CHANCE_TYCOON = 1.0; // Normal chance
export const ENEMY_ATTACK_CHANCE_ROGUE = 1.2; // 20% more likely (opportunistic)

// RETALIATION SYSTEM (UPDATED)
export const RETALIATION_TIME_MIN_MS = 15 * 60 * 1000; // 15 minutes minimum
export const RETALIATION_TIME_MAX_MS = 45 * 60 * 1000; // 45 minutes maximum
export const RETALIATION_GRUDGE_DURATION_MS = ONE_DAY_MS; // 24 hours to hold a grudge

// Personality-based retaliation multipliers (affects army strength)
export const RETALIATION_MULTIPLIER_WARLORD = 1.1; // 10% stronger
export const RETALIATION_MULTIPLIER_TURTLE = 1.2; // 20% stronger (deathball)
export const RETALIATION_MULTIPLIER_TYCOON = 1.0; // Normal strength
export const RETALIATION_MULTIPLIER_ROGUE = 1.0; // Normal strength

// Personality-based retaliation chance (probability bot will actually retaliate when time comes)
export const RETALIATION_CHANCE_WARLORD = 0.95; // 95% chance - very vengeful
export const RETALIATION_CHANCE_TURTLE = 0.85; // 85% chance - holds grudges
export const RETALIATION_CHANCE_TYCOON = 0.70; // 70% chance - busy making money
export const RETALIATION_CHANCE_ROGUE = 0.90; // 90% chance - unpredictable but vengeful

// DIPLOMACY SYSTEM
export const REPUTATION_DECAY_INTERVAL_MS = 1 * 60 * 60 * 1000; // 1 hour
export const REPUTATION_DECAY_AMOUNT = 0.25; // Reputation loss per decay interval
export const REPUTATION_DECAY_MAX_THRESHOLD = 85; // >= 75 doesn't decay
export const REPUTATION_DECAY_BOOST_THRESHOLD = 30; // Below 30, decay accelerates
export const REPUTATION_DECAY_MAX_MULTIPLIER = 2.0; // Maximum 2x decay when at 0 rep

export const DIPLOMACY_GIFT_BASE_COST: Partial<Record<string, number>> = {
    MONEY: 50000,
    OIL: 5000,
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
export const DIPLOMACY_PEACE_PROPOSAL_REP_REQUIREMENT = 10; // Minimum reputation to propose peace
export const DIPLOMACY_PEACE_REP_GAIN = 10; // +10 reputation for peace proposal
export const DIPLOMACY_PEACE_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours cooldown after peace proposal
