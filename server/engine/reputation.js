// ============================================================
// REPUTATION ENGINE - Mirror of utils/engine/reputation.ts
// ============================================================

import { BotPersonality } from './enums.js';
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
} from './constants.js';

export const ReputationChangeType = {
    GIFT: 'GIFT',
    ALLIANCE: 'ALLIANCE',
    PEACE: 'PEACE',
    ATTACK_WIN: 'ATTACK_WIN',
    ATTACK_LOSS: 'ATTACK_LOSS',
    DEFEND_WIN: 'DEFEND_WIN',
    DEFEND_LOSS: 'DEFEND_LOSS',
    DECAY: 'DECAY',
    EVENT: 'EVENT',
    PERSONALITY: 'PERSONALITY'
};

export const ReputationCategory = {
    LOYAL_ALLY: 'LOYAL_ALLY',
    FRIENDLY: 'FRIENDLY',
    NEUTRAL: 'NEUTRAL',
    HOSTILE: 'HOSTILE',
    MORTAL_ENEMY: 'MORTAL_ENEMY'
};

export const PERSONALITY_REP_MODIFIERS = {
    [BotPersonality.WARLORD]: {
        giftMultiplier: 0.8,
        attackLossPenalty: -1.5,
        defendWinBonus: 1.2,
        decayResistance: 0.9,
        forgivenessRate: 0.7
    },
    [BotPersonality.TURTLE]: {
        giftMultiplier: 1.1,
        attackLossPenalty: -0.8,
        defendWinBonus: 1.0,
        decayResistance: 1.1,
        forgivenessRate: 1.2
    },
    [BotPersonality.TYCOON]: {
        giftMultiplier: 1.3,
        attackLossPenalty: -1.0,
        defendWinBonus: 0.9,
        decayResistance: 1.0,
        forgivenessRate: 1.1
    },
    [BotPersonality.ROGUE]: {
        giftMultiplier: 0.7,
        attackLossPenalty: -1.2,
        defendWinBonus: 1.1,
        decayResistance: 0.85,
        forgivenessRate: 0.6
    }
};

export const PERSONALITY_RETALIATION_CHANCE = {
    [BotPersonality.WARLORD]: RETALIATION_CHANCE_WARLORD,
    [BotPersonality.TURTLE]: RETALIATION_CHANCE_TURTLE,
    [BotPersonality.TYCOON]: RETALIATION_CHANCE_TYCOON,
    [BotPersonality.ROGUE]: RETALIATION_CHANCE_ROGUE
};

export const PERSONALITY_ATTACK_CHANCE = {
    [BotPersonality.WARLORD]: ENEMY_ATTACK_CHANCE_WARLORD,
    [BotPersonality.TURTLE]: ENEMY_ATTACK_CHANCE_TURTLE,
    [BotPersonality.TYCOON]: ENEMY_ATTACK_CHANCE_TYCOON,
    [BotPersonality.ROGUE]: ENEMY_ATTACK_CHANCE_ROGUE
};

export const getReputationCategory = (reputation) => {
    if (reputation >= 85) return ReputationCategory.LOYAL_ALLY;
    if (reputation >= 71) return ReputationCategory.FRIENDLY;
    if (reputation >= 41) return ReputationCategory.NEUTRAL;
    if (reputation >= 16) return ReputationCategory.HOSTILE;
    return ReputationCategory.MORTAL_ENEMY;
};

export const calculateDecayMultiplier = (reputation) => {
    if (reputation >= REPUTATION_DECAY_BOOST_THRESHOLD) {
        return 1.0;
    }
    const ratio = reputation / REPUTATION_DECAY_BOOST_THRESHOLD;
    const multiplier = 1.0 + (REPUTATION_DECAY_MAX_MULTIPLIER - 1.0) * (1.0 - ratio);
    return multiplier;
};

export const applyPersonalityModifier = (baseChange, personality, modifierType) => {
    const modifiers = PERSONALITY_REP_MODIFIERS[personality];
    if (!modifiers) return baseChange;
    
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

export const clampReputation = (reputation) => {
    return Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, reputation));
};

export const applyGiftReputation = (bot, baseGain = DIPLOMACY_GIFT_REPUTATION_GAIN) => {
    const personality = bot.personality || BotPersonality.WARLORD;
    const gain = applyPersonalityModifier(baseGain, personality, 'gift');
    const newRep = clampReputation((bot.reputation ?? 50) + gain);
    return { success: true, newReputation: newRep, change: gain, changeType: ReputationChangeType.GIFT };
};

export const applyAllianceReputation = (bot, baseGain = DIPLOMACY_ALLIANCE_REP_GAIN) => {
    const newRep = clampReputation((bot.reputation ?? 50) + baseGain);
    return { success: true, newReputation: newRep, change: baseGain, changeType: ReputationChangeType.ALLIANCE };
};

export const applyPeaceReputation = (bot, baseGain = DIPLOMACY_PEACE_REP_GAIN) => {
    const newRep = clampReputation((bot.reputation ?? 50) + baseGain);
    return { success: true, newReputation: newRep, change: baseGain, changeType: ReputationChangeType.PEACE };
};

export const applyAttackReputation = (bot, playerWon) => {
    const personality = bot.personality || BotPersonality.WARLORD;
    let change;
    let changeType;
    if (playerWon) {
        change = applyPersonalityModifier(REPUTATION_ATTACK_PENALTY, personality, 'attackLoss');
        changeType = ReputationChangeType.ATTACK_LOSS;
    } else {
        change = Math.floor(REPUTATION_WIN_BONUS * PERSONALITY_REP_MODIFIERS[personality].defendWinBonus);
        changeType = ReputationChangeType.ATTACK_WIN;
    }
    const newRep = clampReputation((bot.reputation ?? 50) + change);
    return { success: true, newReputation: newRep, change, changeType };
};

export const applyDefendReputation = (bot, playerWon) => {
    const personality = bot.personality || BotPersonality.WARLORD;
    let change;
    let changeType;
    if (playerWon) {
        change = applyPersonalityModifier(REPUTATION_DEFEAT_PENALTY, personality, 'attackLoss');
        changeType = ReputationChangeType.DEFEND_LOSS;
    } else {
        change = Math.floor(REPUTATION_WIN_BONUS * PERSONALITY_REP_MODIFIERS[personality].defendWinBonus);
        changeType = ReputationChangeType.DEFEND_WIN;
    }
    const newRep = clampReputation((bot.reputation ?? 50) + change);
    return { success: true, newReputation: newRep, change, changeType };
};

export const applyAllyDefenseReputation = (bot, baseGain = REPUTATION_DEFEND_BONUS) => {
    const personality = bot.personality || BotPersonality.WARLORD;
    const gain = applyPersonalityModifier(baseGain, personality, 'defendWin');
    const newRep = clampReputation((bot.reputation ?? 50) + gain);
    return { success: true, newReputation: newRep, change: gain, changeType: ReputationChangeType.DEFEND_WIN };
};

export const applyReputationDecay = (bot, elapsed) => {
    const currentRep = bot.reputation ?? 50;
    if (currentRep >= REPUTATION_DECAY_MAX_THRESHOLD) {
        return { newReputation: currentRep, decay: 0 };
    }
    const cycles = elapsed / REPUTATION_DECAY_INTERVAL_MS;
    const multiplier = calculateDecayMultiplier(currentRep);
    const decayPerCycle = REPUTATION_DECAY_AMOUNT * multiplier;
    const totalDecay = Math.floor(decayPerCycle * cycles);
    return { newReputation: clampReputation(currentRep - totalDecay), decay: totalDecay };
};

export const calculateEnemyAttackChance = (reputation, personality) => {
    if (reputation > REPUTATION_ENEMY_THRESHOLD) return 0;
    const repDifference = REPUTATION_ENEMY_THRESHOLD - reputation;
    let baseChance = 0.20 + (repDifference * 0.015);
    baseChance = Math.min(1.0, baseChance);
    const personalityMultiplier = PERSONALITY_ATTACK_CHANCE[personality] || 1.0;
    return Math.min(1.0, baseChance * personalityMultiplier);
};

export const isAlly = (reputation) => reputation >= REPUTATION_ALLY_THRESHOLD;
export const isEnemy = (reputation) => reputation <= REPUTATION_ENEMY_THRESHOLD;

export const willRetaliate = (bot) => {
    const chance = PERSONALITY_RETALIATION_CHANCE[bot.personality] || 0.7;
    return Math.random() < chance;
};
