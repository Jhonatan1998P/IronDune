
import { GameState, LogEntry, ResourceType } from '../../types';
import { StaticBot, RankingCategory } from './rankings';
import {
    REPUTATION_MIN,
    REPUTATION_MAX,
    REPUTATION_DECAY_INTERVAL_MS,
    REPUTATION_DECAY_AMOUNT,
    REPUTATION_DECAY_NEUTRAL_ZONE,
    REPUTATION_DECAY_MIN_THRESHOLD,
    REPUTATION_DECAY_MAX_THRESHOLD,
    REPUTATION_DECAY_BOOST_THRESHOLD,
    REPUTATION_DECAY_MAX_MULTIPLIER,
    DIPLOMACY_GIFT_BASE_COST,
    DIPLOMACY_GIFT_COST_SCALE,
    DIPLOMACY_GIFT_COST_MAX_SCALE,
    DIPLOMACY_GIFT_COST_REP_THRESHOLD,
    DIPLOMACY_GIFT_REPUTATION_GAIN,
    DIPLOMACY_GIFT_COOLDOWN_MS,
    DIPLOMACY_ALLIANCE_REP_REQUIREMENT,
    DIPLOMACY_ALLIANCE_REP_GAIN,
    DIPLOMACY_PEACE_PROPOSAL_REP_REQUIREMENT,
    DIPLOMACY_PEACE_REP_GAIN,
    DIPLOMACY_PEACE_COOLDOWN_MS
} from '../../constants';

export interface DiplomacyResult {
    success: boolean;
    messageKey: string;
    params?: Record<string, any>;
    newReputation?: number;
    newResources?: Partial<Record<ResourceType, number>>;
    giftCost?: Partial<Record<ResourceType, number>>;
}

export interface ReputationDecayResult {
    updatedBots: StaticBot[];
    decayLogs: LogEntry[];
    newLastDecayTime: number;
}

const calculateDecayMultiplier = (reputation: number): number => {
    if (reputation > REPUTATION_DECAY_BOOST_THRESHOLD) {
        return 1.0;
    }
    const ratio = reputation / REPUTATION_DECAY_BOOST_THRESHOLD;
    const multiplier = 1.0 + (REPUTATION_DECAY_MAX_MULTIPLIER - 1.0) * (1.0 - ratio);
    return multiplier;
};

export const processReputationDecay = (
    bots: StaticBot[],
    lastDecayTime: number,
    now: number
): ReputationDecayResult => {
    const elapsed = now - lastDecayTime;
    const cycles = Math.floor(elapsed / REPUTATION_DECAY_INTERVAL_MS);
    
    if (cycles <= 0) {
        return {
            updatedBots: bots,
            decayLogs: [],
            newLastDecayTime: lastDecayTime
        };
    }

    const updatedBots = bots.map(bot => {
        const currentRep = bot.reputation ?? 50;
        
        if (currentRep >= REPUTATION_DECAY_MAX_THRESHOLD) {
            return bot;
        }
        
        if (currentRep <= REPUTATION_MIN) {
            return bot;
        }
        
        const multiplier = calculateDecayMultiplier(currentRep);
        const effectiveDecayAmount = REPUTATION_DECAY_AMOUNT * multiplier;
        
        let newRep = currentRep;
        
        if (currentRep > 100 - REPUTATION_DECAY_NEUTRAL_ZONE) {
            newRep = Math.max(100 - REPUTATION_DECAY_NEUTRAL_ZONE, currentRep - (effectiveDecayAmount * cycles));
        }
        else if (currentRep < REPUTATION_DECAY_NEUTRAL_ZONE) {
            newRep = Math.min(REPUTATION_DECAY_NEUTRAL_ZONE, currentRep + (effectiveDecayAmount * cycles));
        }
        
        return {
            ...bot,
            reputation: Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, newRep))
        };
    });

    const decayLogs: LogEntry[] = [];
    
    return {
        updatedBots,
        decayLogs,
        newLastDecayTime: lastDecayTime + (cycles * REPUTATION_DECAY_INTERVAL_MS)
    };
};

export const calculateGiftCost = (bot: StaticBot): Partial<Record<ResourceType, number>> => {
    const botScore = bot.stats[RankingCategory.DOMINION] || 0;
    const reputation = bot.reputation ?? 50;
    
    let scaleFactor = DIPLOMACY_GIFT_COST_SCALE;
    
    if (reputation <= DIPLOMACY_GIFT_COST_REP_THRESHOLD) {
        const repRatio = Math.max(0, reputation) / DIPLOMACY_GIFT_COST_REP_THRESHOLD;
        scaleFactor = DIPLOMACY_GIFT_COST_SCALE + (DIPLOMACY_GIFT_COST_MAX_SCALE - DIPLOMACY_GIFT_COST_SCALE) * (1 - repRatio);
    }
    
    const costBonus = Math.floor(botScore * scaleFactor);
    
    return {
        [ResourceType.MONEY]: (DIPLOMACY_GIFT_BASE_COST.MONEY || 0) + costBonus,
        [ResourceType.OIL]: (DIPLOMACY_GIFT_BASE_COST.OIL || 0) + Math.floor(costBonus * 0.005),
        [ResourceType.AMMO]: (DIPLOMACY_GIFT_BASE_COST.AMMO || 0) + Math.floor(costBonus * 0.002),
        [ResourceType.GOLD]: (DIPLOMACY_GIFT_BASE_COST.GOLD || 0) + Math.floor(costBonus * 0.001)
    };
};

export const sendGift = (
    state: GameState,
    botId: string,
    now: number
): DiplomacyResult => {
    const bot = state.rankingData.bots.find(b => b.id === botId);
    if (!bot) {
        return { success: false, messageKey: 'diplomacy_bot_not_found' };
    }

    const giftCost = calculateGiftCost(bot);

    const lastGiftTime = (state.diplomaticActions?.[botId]?.lastGiftTime ?? 0);
    if (now - lastGiftTime < DIPLOMACY_GIFT_COOLDOWN_MS) {
        const remainingMinutes = Math.ceil((DIPLOMACY_GIFT_COOLDOWN_MS - (now - lastGiftTime)) / 60000);
        return { 
            success: false, 
            messageKey: 'diplomacy_gift_cooldown',
            params: { minutes: remainingMinutes },
            giftCost
        };
    }

    const newResources = { ...state.resources };
    for (const [resource, amount] of Object.entries(giftCost)) {
        const resType = resource as ResourceType;
        const costAmount = amount ?? 0;
        if ((newResources[resType] ?? 0) < costAmount) {
            return { success: false, messageKey: 'diplomacy_insufficient_resources', giftCost };
        }
        newResources[resType] = (newResources[resType] ?? 0) - costAmount;
    }

    const newRep = Math.min(
        REPUTATION_MAX,
        (bot.reputation ?? 50) + DIPLOMACY_GIFT_REPUTATION_GAIN
    );

    return {
        success: true,
        messageKey: 'diplomacy_gift_sent',
        params: { botName: bot.name, reputation: DIPLOMACY_GIFT_REPUTATION_GAIN },
        newReputation: newRep,
        newResources,
        giftCost
    };
};

export const proposeAlliance = (
    state: GameState,
    botId: string,
    now: number
): DiplomacyResult => {
    const bot = state.rankingData.bots.find(b => b.id === botId);
    if (!bot) {
        return { success: false, messageKey: 'diplomacy_bot_not_found' };
    }

    const currentRep = bot.reputation ?? 50;
    if (currentRep < DIPLOMACY_ALLIANCE_REP_REQUIREMENT) {
        return {
            success: false,
            messageKey: 'diplomacy_alliance_rep_too_low',
            params: { required: DIPLOMACY_ALLIANCE_REP_REQUIREMENT, current: currentRep }
        };
    }

    const lastAllianceTime = (state.diplomaticActions?.[botId]?.lastAllianceTime ?? 0);
    if (now - lastAllianceTime < DIPLOMACY_PEACE_COOLDOWN_MS) {
        return { success: false, messageKey: 'diplomacy_alliance_cooldown' };
    }

    const newRep = Math.min(
        REPUTATION_MAX,
        currentRep + DIPLOMACY_ALLIANCE_REP_GAIN
    );

    return {
        success: true,
        messageKey: 'diplomacy_alliance_proposed',
        params: { botName: bot.name },
        newReputation: newRep
    };
};

export const proposePeace = (
    state: GameState,
    botId: string,
    now: number
): DiplomacyResult => {
    const bot = state.rankingData.bots.find(b => b.id === botId);
    if (!bot) {
        return { success: false, messageKey: 'diplomacy_bot_not_found' };
    }

    const currentRep = bot.reputation ?? 50;
    
    if (currentRep >= DIPLOMACY_PEACE_PROPOSAL_REP_REQUIREMENT && currentRep < 50) {
        const lastPeaceTime = (state.diplomaticActions?.[botId]?.lastPeaceTime ?? 0);
        if (now - lastPeaceTime < DIPLOMACY_PEACE_COOLDOWN_MS) {
            return { success: false, messageKey: 'diplomacy_peace_cooldown' };
        }

        const newRep = Math.min(
            50,
            currentRep + DIPLOMACY_PEACE_REP_GAIN
        );

        return {
            success: true,
            messageKey: 'diplomacy_peace_proposed',
            params: { botName: bot.name },
            newReputation: newRep
        };
    }
    
    if (currentRep >= 50) {
        return {
            success: true,
            messageKey: 'diplomacy_peace_already',
            params: { botName: bot.name }
        };
    }

    const lastPeaceTime = (state.diplomaticActions?.[botId]?.lastPeaceTime ?? 0);
    if (now - lastPeaceTime < DIPLOMACY_PEACE_COOLDOWN_MS) {
        return { success: false, messageKey: 'diplomacy_peace_cooldown' };
    }

    const reducedGain = Math.floor(DIPLOMACY_PEACE_REP_GAIN / 2);
    const newRep = Math.min(
        50,
        currentRep + reducedGain
    );

    return {
        success: true,
        messageKey: 'diplomacy_peace_proposed_hard',
        params: { botName: bot.name, reputation: reducedGain },
        newReputation: newRep
    };
};
