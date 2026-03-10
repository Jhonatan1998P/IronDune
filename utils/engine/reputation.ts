/**
 * Reputation System - Centralized Logic
 * 
 * Handles all reputation-related calculations, events, and history tracking.
 * Supports personality-based reactions and faction dynamics.
 */

import { GameState, LogEntry } from '../../types';
import { StaticBot, RankingCategory } from './rankings';
import { BotPersonality } from '../../types/enums';
import {
    REPUTATION_MIN,
    REPUTATION_MAX,
    REPUTATION_DECAY_INTERVAL_MS,
    REPUTATION_DECAY_AMOUNT,
    REPUTATION_DECAY_MAX_THRESHOLD,
    REPUTATION_DECAY_BOOST_THRESHOLD,
    REPUTATION_DECAY_MAX_MULTIPLIER,
    REPUTATION_ATTACK_PENALTY,
    REPUTATION_DEFEAT_PENALTY,
    REPUTATION_WIN_BONUS,
    REPUTATION_DEFEND_BONUS,
    REPUTATION_ALLY_THRESHOLD,
    REPUTATION_ENEMY_THRESHOLD,
    DIPLOMACY_GIFT_REPUTATION_GAIN,
    DIPLOMACY_ALLIANCE_REP_GAIN,
    DIPLOMACY_PEACE_REP_GAIN,
    ENEMY_ATTACK_CHANCE_WARLORD,
    ENEMY_ATTACK_CHANCE_TURTLE,
    ENEMY_ATTACK_CHANCE_TYCOON,
    ENEMY_ATTACK_CHANCE_ROGUE,
    RETALIATION_CHANCE_WARLORD,
    RETALIATION_CHANCE_TURTLE,
    RETALIATION_CHANCE_TYCOON,
    RETALIATION_CHANCE_ROGUE
} from '../../constants';

// ============================================================================
// TYPES
// ============================================================================

export enum ReputationChangeType {
    GIFT = 'GIFT',
    ALLIANCE = 'ALLIANCE',
    PEACE = 'PEACE',
    ATTACK_WIN = 'ATTACK_WIN',
    ATTACK_LOSS = 'ATTACK_LOSS',
    DEFEND_WIN = 'DEFEND_WIN',
    DEFEND_LOSS = 'DEFEND_LOSS',
    DECAY = 'DECAY',
    EVENT = 'EVENT',
    PERSONALITY = 'PERSONALITY'
}

export interface ReputationChange {
    type: ReputationChangeType;
    amount: number;
    timestamp: number;
    reason?: string;
}

export interface ReputationHistory {
    [botId: string]: ReputationChange[];
}

export interface ReputationState {
    current: number;
    previous: number;
    trend: 'UP' | 'DOWN' | 'STABLE';
    category: ReputationCategory;
    decayMultiplier: number;
}

export enum ReputationCategory {
    LOYAL_ALLY = 'LOYAL_ALLY',      // 85-100
    FRIENDLY = 'FRIENDLY',           // 71-84
    NEUTRAL = 'NEUTRAL',             // 41-70
    HOSTILE = 'HOSTILE',             // 16-40
    MORTAL_ENEMY = 'MORTAL_ENEMY'    // 0-15
}

// ============================================================================
// PERSONALITY MODIFIERS
// ============================================================================

/**
 * Personality-based reputation gain/loss modifiers
 */
export const PERSONALITY_REP_MODIFIERS: Record<BotPersonality, {
    giftMultiplier: number;
    attackLossPenalty: number;
    defendWinBonus: number;
    decayResistance: number;
    forgivenessRate: number;
}> = {
    [BotPersonality.WARLORD]: {
        giftMultiplier: 0.8,      // Respects strength over gifts
        attackLossPenalty: -1.5,  // Loses more rep when defeated
        defendWinBonus: 1.2,      // Gains more rep when defending successfully
        decayResistance: 0.9,     // Slightly faster decay
        forgivenessRate: 0.7      // Hard to regain trust
    },
    [BotPersonality.TURTLE]: {
        giftMultiplier: 1.1,      // Appreciates gifts
        attackLossPenalty: -0.8,  // More forgiving when defeated
        defendWinBonus: 1.0,      // Normal defend bonus
        decayResistance: 1.1,     // Slower decay
        forgivenessRate: 1.2      // More forgiving
    },
    [BotPersonality.TYCOON]: {
        giftMultiplier: 1.3,      // Loves gifts (economic focus)
        attackLossPenalty: -1.0,  // Normal penalty
        defendWinBonus: 0.9,      // Less focused on combat
        decayResistance: 1.0,     // Normal decay
        forgivenessRate: 1.1      // Business-like, moves on
    },
    [BotPersonality.ROGUE]: {
        giftMultiplier: 0.7,      // Suspicious of gifts
        attackLossPenalty: -1.2,  // Holds grudges
        defendWinBonus: 1.1,      // Respects cunning
        decayResistance: 0.85,    // Faster decay
        forgivenessRate: 0.6      // Very unforgiving
    }
};

/**
 * Personality-based retaliation chances
 */
export const PERSONALITY_RETALIATION_CHANCE: Record<BotPersonality, number> = {
    [BotPersonality.WARLORD]: RETALIATION_CHANCE_WARLORD,
    [BotPersonality.TURTLE]: RETALIATION_CHANCE_TURTLE,
    [BotPersonality.TYCOON]: RETALIATION_CHANCE_TYCOON,
    [BotPersonality.ROGUE]: RETALIATION_CHANCE_ROGUE
};

/**
 * Personality-based enemy attack chance modifiers
 */
export const PERSONALITY_ATTACK_CHANCE: Record<BotPersonality, number> = {
    [BotPersonality.WARLORD]: ENEMY_ATTACK_CHANCE_WARLORD,
    [BotPersonality.TURTLE]: ENEMY_ATTACK_CHANCE_TURTLE,
    [BotPersonality.TYCOON]: ENEMY_ATTACK_CHANCE_TYCOON,
    [BotPersonality.ROGUE]: ENEMY_ATTACK_CHANCE_ROGUE
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Get reputation category label
 */
export const getReputationCategory = (reputation: number): ReputationCategory => {
    if (reputation >= 85) return ReputationCategory.LOYAL_ALLY;
    if (reputation >= 71) return ReputationCategory.FRIENDLY;
    if (reputation >= 41) return ReputationCategory.NEUTRAL;
    if (reputation >= 16) return ReputationCategory.HOSTILE;
    return ReputationCategory.MORTAL_ENEMY;
};

/**
 * Get reputation category color
 */
export const getReputationColor = (reputation: number): string => {
    if (reputation >= 85) return 'text-green-300';
    if (reputation >= 71) return 'text-green-400';
    if (reputation >= 41) return 'text-yellow-400';
    if (reputation >= 16) return 'text-orange-400';
    return 'text-red-400';
};

/**
 * Get reputation category background color
 */
export const getReputationBgColor = (reputation: number): string => {
    if (reputation >= 85) return 'bg-green-500/20 border-green-500/40';
    if (reputation >= 71) return 'bg-green-600/20 border-green-600/40';
    if (reputation >= 41) return 'bg-yellow-500/20 border-yellow-500/40';
    if (reputation >= 16) return 'bg-orange-500/20 border-orange-500/40';
    return 'bg-red-500/20 border-red-500/40';
};

/**
 * Calculate decay multiplier based on current reputation
 */
export const calculateDecayMultiplier = (reputation: number): number => {
    if (reputation >= REPUTATION_DECAY_BOOST_THRESHOLD) {
        return 1.0;
    }
    const ratio = reputation / REPUTATION_DECAY_BOOST_THRESHOLD;
    const multiplier = 1.0 + (REPUTATION_DECAY_MAX_MULTIPLIER - 1.0) * (1.0 - ratio);
    return multiplier;
};

/**
 * Apply personality modifier to reputation change
 */
export const applyPersonalityModifier = (
    baseChange: number,
    personality: BotPersonality,
    modifierType: 'gift' | 'attackLoss' | 'defendWin'
): number => {
    const modifiers = PERSONALITY_REP_MODIFIERS[personality];
    
    switch (modifierType) {
        case 'gift':
            return Math.floor(baseChange * modifiers.giftMultiplier);
        case 'attackLoss':
            return Math.floor(baseChange * modifiers.attackLossPenalty);
        case 'defendWin':
            return Math.floor(baseChange * modifiers.defendWinBonus);
        default:
            return baseChange;
    }
};

/**
 * Clamp reputation value to valid range
 */
export const clampReputation = (reputation: number): number => {
    return Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, reputation));
};

// ============================================================================
// REPUTATION CHANGES
// ============================================================================

export interface ReputationChangeResult {
    success: boolean;
    newReputation: number;
    change: number;
    changeType: ReputationChangeType;
    logEntry?: LogEntry;
}

/**
 * Apply reputation change from gift
 */
export const applyGiftReputation = (
    bot: StaticBot,
    baseGain: number = DIPLOMACY_GIFT_REPUTATION_GAIN
): ReputationChangeResult => {
    const personality = bot.personality || BotPersonality.WARLORD;
    const gain = applyPersonalityModifier(baseGain, personality, 'gift');
    const newRep = clampReputation((bot.reputation ?? 50) + gain);
    
    return {
        success: true,
        newReputation: newRep,
        change: gain,
        changeType: ReputationChangeType.GIFT
    };
};

/**
 * Apply reputation change from alliance proposal
 */
export const applyAllianceReputation = (
    bot: StaticBot,
    baseGain: number = DIPLOMACY_ALLIANCE_REP_GAIN
): ReputationChangeResult => {
    const newRep = clampReputation((bot.reputation ?? 50) + baseGain);
    
    return {
        success: true,
        newReputation: newRep,
        change: baseGain,
        changeType: ReputationChangeType.ALLIANCE
    };
};

/**
 * Apply reputation change from peace proposal
 */
export const applyPeaceReputation = (
    bot: StaticBot,
    baseGain: number = DIPLOMACY_PEACE_REP_GAIN
): ReputationChangeResult => {
    const newRep = clampReputation((bot.reputation ?? 50) + baseGain);
    
    return {
        success: true,
        newReputation: newRep,
        change: baseGain,
        changeType: ReputationChangeType.PEACE
    };
};

/**
 * Apply reputation change when player attacks bot (win or loss)
 */
export const applyAttackReputation = (
    bot: StaticBot,
    playerWon: boolean
): ReputationChangeResult => {
    const personality = bot.personality || BotPersonality.WARLORD;
    let change: number;
    let changeType: ReputationChangeType;
    
    if (playerWon) {
        // Player won: bot loses reputation
        change = applyPersonalityModifier(REPUTATION_ATTACK_PENALTY, personality, 'attackLoss');
        changeType = ReputationChangeType.ATTACK_LOSS;
    } else {
        // Player lost: bot gains reputation (respects strength)
        change = Math.floor(REPUTATION_WIN_BONUS * PERSONALITY_REP_MODIFIERS[personality].defendWinBonus);
        changeType = ReputationChangeType.ATTACK_WIN;
    }
    
    const newRep = clampReputation((bot.reputation ?? 50) + change);
    
    return {
        success: true,
        newReputation: newRep,
        change,
        changeType
    };
};

/**
 * Apply reputation change when player successfully defends against bot
 */
export const applyDefendReputation = (
    bot: StaticBot,
    playerWon: boolean
): ReputationChangeResult => {
    const personality = bot.personality || BotPersonality.WARLORD;
    let change: number;
    let changeType: ReputationChangeType;
    
    if (playerWon) {
        // Player defended successfully: bot loses reputation
        change = applyPersonalityModifier(REPUTATION_DEFEAT_PENALTY, personality, 'attackLoss');
        changeType = ReputationChangeType.DEFEND_LOSS;
    } else {
        // Bot won attack: bot gains reputation
        change = Math.floor(REPUTATION_WIN_BONUS * PERSONALITY_REP_MODIFIERS[personality].defendWinBonus);
        changeType = ReputationChangeType.DEFEND_WIN;
    }
    
    const newRep = clampReputation((bot.reputation ?? 50) + change);
    
    return {
        success: true,
        newReputation: newRep,
        change,
        changeType
    };
};

/**
 * Apply reputation change to an ally that helped defend the player
 */
export const applyAllyDefenseReputation = (
    bot: StaticBot,
    baseGain: number = REPUTATION_DEFEND_BONUS
): ReputationChangeResult => {
    const personality = bot.personality || BotPersonality.WARLORD;
    const gain = applyPersonalityModifier(baseGain, personality, 'defendWin');
    const newRep = clampReputation((bot.reputation ?? 50) + gain);
    
    return {
        success: true,
        newReputation: newRep,
        change: gain,
        changeType: ReputationChangeType.DEFEND_WIN // Using DEFEND_WIN for ally success
    };
};

/**
 * Apply reputation decay
 */
export const applyReputationDecay = (
    bot: StaticBot,
    elapsed: number
): { newReputation: number; decay: number } => {
    const currentRep = bot.reputation ?? 50;
    
    // No decay above threshold
    if (currentRep >= REPUTATION_DECAY_MAX_THRESHOLD) {
        return { newReputation: currentRep, decay: 0 };
    }
    
    const cycles = elapsed / REPUTATION_DECAY_INTERVAL_MS;
    const multiplier = calculateDecayMultiplier(currentRep);
    const decayPerCycle = REPUTATION_DECAY_AMOUNT * multiplier;
    const totalDecay = Math.floor(decayPerCycle * cycles);
    
    return {
        newReputation: clampReputation(currentRep - totalDecay),
        decay: totalDecay
    };
};

// ============================================================================
// REPUTATION STATE & HISTORY
// ============================================================================

/**
 * Get current reputation state for a bot
 */
export const getReputationState = (bot: StaticBot): ReputationState => {
    const current = bot.reputation ?? 50;
    const previous = bot.lastRank !== undefined ? current : current; // Could track separately
    const trend = current > previous ? 'UP' : current < previous ? 'DOWN' : 'STABLE';
    
    return {
        current,
        previous,
        trend,
        category: getReputationCategory(current),
        decayMultiplier: calculateDecayMultiplier(current)
    };
};

/**
 * Initialize reputation history for a bot
 */
export const initializeReputationHistory = (botId: string): ReputationHistory => {
    return {
        [botId]: []
    };
};

/**
 * Add reputation change to history
 */
export const addReputationToHistory = (
    history: ReputationHistory,
    botId: string,
    change: ReputationChange
): ReputationHistory => {
    const botHistory = history[botId] || [];
    
    // Keep only last 50 changes per bot
    const updatedHistory = [change, ...botHistory].slice(0, 50);
    
    return {
        ...history,
        [botId]: updatedHistory
    };
};

/**
 * Get reputation trend over time
 */
export const getReputationTrend = (
    history: ReputationChange[],
    limit: number = 10
): { trend: 'UP' | 'DOWN' | 'STABLE'; netChange: number } => {
    const recentChanges = history.slice(0, limit);
    const netChange = recentChanges.reduce((sum, change) => sum + change.amount, 0);
    
    return {
        trend: netChange > 0 ? 'UP' : netChange < 0 ? 'DOWN' : 'STABLE',
        netChange
    };
};

// ============================================================================
// FACTION & RELATIONSHIP UTILITIES
// ============================================================================

/**
 * Check if bot is ally
 */
export const isAlly = (reputation: number): boolean => {
    return reputation >= REPUTATION_ALLY_THRESHOLD;
};

/**
 * Check if bot is enemy
 */
export const isEnemy = (reputation: number): boolean => {
    return reputation <= REPUTATION_ENEMY_THRESHOLD;
};

/**
 * Get relationship status label
 */
export const getRelationshipStatus = (reputation: number): string => {
    if (reputation >= 85) return 'Loyal Ally';
    if (reputation >= 71) return 'Friendly';
    if (reputation >= 41) return 'Neutral';
    if (reputation >= 16) return 'Hostile';
    return 'Mortal Enemy';
};

/**
 * Calculate chance for ally to send reinforcements
 */
export const calculateAllyReinforcementChance = (
    reputation: number,
    botScore: number,
    playerScore: number
): number => {
    if (!isAlly(reputation)) return 0;
    
    // Base chance
    let chance = 0.15;
    
    // Bonus for higher reputation
    const repBonus = (reputation - REPUTATION_ALLY_THRESHOLD) / 100;
    chance += repBonus * 0.1;
    
    // Penalty if ally is much stronger than player
    const scoreRatio = botScore / Math.max(1, playerScore);
    if (scoreRatio > 1.5) {
        chance *= 0.5; // Reduce chance by half if ally is 150%+ stronger
    }
    
    return Math.min(0.5, chance); // Cap at 50%
};

/**
 * Calculate chance for enemy to attack
 */
export const calculateEnemyAttackChance = (
    bot: StaticBot,
    playerScore: number
): number => {
    const reputation = bot.reputation ?? 50;
    
    // Only enemies attack (rep <= 30)
    if (reputation > REPUTATION_ENEMY_THRESHOLD) return 0;
    
    // Base chance increases as reputation decreases
    const repBelow = REPUTATION_ENEMY_THRESHOLD - reputation;
    const baseChance = 0.20 + (repBelow * 0.015);
    
    // Apply personality modifier
    const personalityModifier = PERSONALITY_ATTACK_CHANCE[bot.personality] || 1.0;
    
    // Check power ratio
    const botScore = bot.stats[RankingCategory.DOMINION] || 0;
    const powerRatio = botScore / Math.max(1, playerScore);
    
    if (powerRatio < 0.5 || powerRatio > 1.5) {
        return 0; // Won't attack if too weak or too strong
    }
    
    return baseChance * personalityModifier;
};

/**
 * Check if bot will retaliate
 */
export const willRetaliate = (bot: StaticBot): boolean => {
    const chance = PERSONALITY_RETALIATION_CHANCE[bot.personality] || 0.7;
    return Math.random() < chance;
};

// ============================================================================
// EXPORTED FOR BACKWARD COMPATIBILITY
// ============================================================================

// Re-export constants and types that diplomacy.ts might need
export {
    REPUTATION_MIN,
    REPUTATION_MAX,
    REPUTATION_DECAY_INTERVAL_MS,
    REPUTATION_DECAY_AMOUNT,
    REPUTATION_DECAY_MAX_THRESHOLD,
    REPUTATION_DECAY_BOOST_THRESHOLD,
    REPUTATION_DECAY_MAX_MULTIPLIER,
    REPUTATION_ALLY_THRESHOLD,
    REPUTATION_ENEMY_THRESHOLD
};
