/**
 * Reputation History System
 * 
 * Tracks all reputation changes for each bot over time.
 * Persists to GameState for offline progression support.
 */

import { GameState } from '../../types';
import { StaticBot } from './rankings';
import { ReputationChange, ReputationChangeType, ReputationHistory } from './reputation';

// ============================================================================
// TYPES
// ============================================================================

export interface InteractionRecord {
    botId: string;
    totalInteractions: number;
    giftsSent: number;
    alliancesProposed: number;
    peaceProposed: number;
    attacksWon: number;
    attacksLost: number;
    defendsWon: number;
    defendsLost: number;
    lastInteractionTime: number;
    relationshipTrend: 'IMPROVING' | 'WORSENING' | 'STABLE';
}

export interface AllInteractions {
    [botId: string]: InteractionRecord;
}

// ============================================================================
// HISTORY MANAGEMENT
// ============================================================================

/**
 * Initialize interaction tracking for a bot
 */
export const initializeInteractionRecord = (botId: string): InteractionRecord => ({
    botId,
    totalInteractions: 0,
    giftsSent: 0,
    alliancesProposed: 0,
    peaceProposed: 0,
    attacksWon: 0,
    attacksLost: 0,
    defendsWon: 0,
    defendsLost: 0,
    lastInteractionTime: 0,
    relationshipTrend: 'STABLE'
});

/**
 * Record a reputation change in history
 */
export const recordReputationChange = (
    state: GameState,
    botId: string,
    change: ReputationChange,
    now: number
): GameState => {
    const newHistory = { ...state.reputationHistory };
    const botHistory = newHistory[botId] || [];
    
    // Add new change at the beginning
    const updatedHistory = [change, ...botHistory].slice(0, 100); // Keep last 100 changes
    newHistory[botId] = updatedHistory;
    
    // Update interaction record
    const newInteractions = { ...state.interactionRecords };
    const record = newInteractions[botId] || initializeInteractionRecord(botId);
    
    // Increment counters based on change type
    const updatedRecord = { ...record, totalInteractions: record.totalInteractions + 1, lastInteractionTime: now };
    
    switch (change.type) {
        case ReputationChangeType.GIFT:
            updatedRecord.giftsSent += 1;
            updatedRecord.relationshipTrend = 'IMPROVING';
            break;
        case ReputationChangeType.ALLIANCE:
            updatedRecord.alliancesProposed += 1;
            updatedRecord.relationshipTrend = 'IMPROVING';
            break;
        case ReputationChangeType.PEACE:
            updatedRecord.peaceProposed += 1;
            updatedRecord.relationshipTrend = 'IMPROVING';
            break;
        case ReputationChangeType.ATTACK_WIN:
        case ReputationChangeType.DEFEND_LOSS:
            updatedRecord.attacksLost += 1;
            updatedRecord.relationshipTrend = 'WORSENING';
            break;
        case ReputationChangeType.ATTACK_LOSS:
        case ReputationChangeType.DEFEND_WIN:
            updatedRecord.attacksWon += 1;
            break;
        case ReputationChangeType.DECAY:
            updatedRecord.relationshipTrend = 'WORSENING';
            break;
    }
    
    newInteractions[botId] = updatedRecord;
    
    return {
        ...state,
        reputationHistory: newHistory,
        interactionRecords: newInteractions
    };
};

/**
 * Get interaction record for a bot
 */
export const getInteractionRecord = (
    state: GameState,
    botId: string
): InteractionRecord => {
    return state.interactionRecords[botId] || initializeInteractionRecord(botId);
};

/**
 * Get reputation history for a bot
 */
export const getReputationHistory = (
    state: GameState,
    botId: string
): ReputationChange[] => {
    return state.reputationHistory[botId] || [];
};

/**
 * Calculate relationship trend based on recent history
 */
export const calculateRelationshipTrend = (
    history: ReputationChange[],
    limit: number = 10
): 'IMPROVING' | 'WORSENING' | 'STABLE' => {
    const recentChanges = history.slice(0, limit);
    if (recentChanges.length === 0) return 'STABLE';
    
    const netChange = recentChanges.reduce((sum, change) => sum + change.amount, 0);
    
    if (netChange > 5) return 'IMPROVING';
    if (netChange < -5) return 'WORSENING';
    return 'STABLE';
};

/**
 * Get summary of relationship with a bot
 */
export const getRelationshipSummary = (
    state: GameState,
    botId: string
): {
    record: InteractionRecord;
    trend: 'IMPROVING' | 'WORSENING' | 'STABLE';
    recentChanges: ReputationChange[];
} => {
    const record = getInteractionRecord(state, botId);
    const history = getReputationHistory(state, botId);
    const trend = calculateRelationshipTrend(history);
    
    return {
        record,
        trend,
        recentChanges: history.slice(0, 5)
    };
};

/**
 * Clear old history entries (cleanup function)
 */
export const cleanupOldHistory = (
    state: GameState,
    maxAge: number = 7 * 24 * 60 * 60 * 1000 // 7 days
): GameState => {
    const now = Date.now();
    const newHistory: ReputationHistory = {};
    
    Object.entries(state.reputationHistory).forEach(([botId, changes]) => {
        const recentChanges = changes.filter(change => now - change.timestamp < maxAge);
        if (recentChanges.length > 0) {
            newHistory[botId] = recentChanges;
        }
    });
    
    return {
        ...state,
        reputationHistory: newHistory
    };
};

/**
 * Export interaction data for a specific bot (for UI display)
 */
export const exportInteractionData = (
    state: GameState,
    botId: string,
    bot: StaticBot
) => {
    const summary = getRelationshipSummary(state, botId);
    const currentRep = bot.reputation ?? 50;
    
    return {
        botName: bot.name,
        currentReputation: currentRep,
        ...summary.record,
        trend: summary.trend,
        recentChanges: summary.recentChanges.map(change => ({
            type: change.type,
            amount: change.amount,
            timestamp: change.timestamp,
            reason: change.reason
        }))
    };
};
