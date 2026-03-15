// ============================================================
// REPUTATION HISTORY - Mirror of utils/engine/reputationHistory.ts
// ============================================================

import { ReputationChangeType } from './reputation.js';

export const initializeInteractionRecord = (botId) => ({
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

export const recordReputationChange = (state, botId, change, now) => {
    const newHistory = { ...(state.reputationHistory || {}) };
    const botHistory = newHistory[botId] || [];
    const updatedHistory = [change, ...botHistory].slice(0, 100);
    newHistory[botId] = updatedHistory;
    
    const newInteractions = { ...(state.interactionRecords || {}) };
    const record = newInteractions[botId] || initializeInteractionRecord(botId);
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
            updatedRecord.attacksWon += 1;
            updatedRecord.relationshipTrend = 'WORSENING';
            break;
        case ReputationChangeType.ATTACK_LOSS:
            updatedRecord.attacksLost += 1;
            updatedRecord.relationshipTrend = 'STABLE';
            break;
        case ReputationChangeType.DEFEND_WIN:
            updatedRecord.defendsWon += 1;
            updatedRecord.relationshipTrend = 'IMPROVING';
            break;
        case ReputationChangeType.DEFEND_LOSS:
            updatedRecord.defendsLost += 1;
            updatedRecord.relationshipTrend = 'WORSENING';
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
