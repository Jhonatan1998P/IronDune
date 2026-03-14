
import { BotPersonality } from '../../types/enums';
import { GameState, RankingData } from '../../types';

export enum RankingCategory {
    DOMINION = 'DOMINION',
    MILITARY = 'MILITARY',
    ECONOMY = 'ECONOMY',
    CAMPAIGN = 'CAMPAIGN'
}

export interface RankingEntry {
    id: string;
    rank: number;
    name: string;
    score: number;
    isPlayer: boolean;
    avatarId: number;
    country: string;
    tier: 'S' | 'A' | 'B' | 'C' | 'D';
    trend: number;
    _rawLastRank?: number;
    personality: BotPersonality;
    canAttack?: boolean;
    isP2P?: boolean;
}

export interface StaticBot {
    id: string;
    name: string;
    avatarId: number;
    country: string;
    stats: Record<RankingCategory, number>;
    ambition: number;
    personality: BotPersonality;
    lastRank: number | undefined;
    currentEvent: BotEvent;
    eventTurnsRemaining: number;
    growthModifier: number;
    reputation: number;
    isPlayer?: boolean;
}

export const GROWTH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const BASE_GROWTH_RATE = 0.05;

export enum BotEvent {
    ATTACKED = 'ATTACKED',
    SUCCESSFUL_RAID = 'SUCCESSFUL_RAID',
    ECONOMIC_BOOM = 'ECONOMIC_BOOM',
    RESOURCES_CRISIS = 'RESOURCES_CRISIS',
    MILITARY_BUILDUP = 'MILITARY_BUILDUP',
    PEACEFUL_PERIOD = 'PEACEFUL_PERIOD'
}

const PERSONALITY_GROWTH_RATES: Record<BotPersonality, { base: number; category: RankingCategory }> = {
    [BotPersonality.WARLORD]: { base: 0.08, category: RankingCategory.MILITARY },
    [BotPersonality.TURTLE]: { base: 0.03, category: RankingCategory.ECONOMY },
    [BotPersonality.TYCOON]: { base: 0.06, category: RankingCategory.ECONOMY },
    [BotPersonality.ROGUE]: { base: 0.05, category: RankingCategory.DOMINION }
};

const EVENT_MODIFIERS: Record<BotEvent, number> = {
    [BotEvent.ATTACKED]: -0.03,
    [BotEvent.SUCCESSFUL_RAID]: 0.025,
    [BotEvent.ECONOMIC_BOOM]: 0.03,
    [BotEvent.RESOURCES_CRISIS]: -0.04,
    [BotEvent.MILITARY_BUILDUP]: 0.02,
    [BotEvent.PEACEFUL_PERIOD]: 0.01
};

export const getFlagEmoji = (countryCode: string) => {
    if (!countryCode) return '';
    const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
};

export const initializeRankingState = (): RankingData => ({
    bots: [], // Empezamos vacío, usePersistence cargará los datos reales de Supabase
    lastUpdateTime: Date.now(),
    lastPlayerRank: 1
});

const getTier = (rank: number): RankingEntry['tier'] => {
    if (rank <= 3) return 'S';
    if (rank <= 10) return 'A';
    if (rank <= 50) return 'B';
    if (rank <= 100) return 'C';
    return 'D';
};

export const getCurrentStandings = (state: GameState, allEntries: any[], category: RankingCategory): RankingEntry[] => {
    const entries: RankingEntry[] = (allEntries || []).map(entry => {
        const score = entry.stats ? (entry.stats[category] || 0) : 0;
        const ratio = score / Math.max(1, state.empirePoints);
        
        return {
            id: entry.id,
            rank: 0,
            name: entry.name,
            score,
            isPlayer: entry.isPlayer || entry.id === state.gameId,
            avatarId: entry.avatarId || 0,
            country: entry.country || 'UN',
            tier: 'D',
            trend: 0,
            _rawLastRank: entry.lastRank,
            personality: entry.personality || BotPersonality.WARLORD,
            canAttack: !entry.isPlayer && ratio >= 0.5 && ratio <= 1.5
        };
    });

    entries.sort((a, b) => b.score - a.score);

    const result = entries.map((entry, index) => ({
        ...entry,
        rank: index + 1,
        tier: getTier(index + 1),
        trend: (entry._rawLastRank || 0) - (index + 1)
    }));

    const playerEntry = result.find(e => e.isPlayer);
    if (playerEntry && state.rankingData) {
        state.rankingData.lastPlayerRank = playerEntry.rank;
    }

    return result;
};

const applyEvent = (bot: StaticBot): StaticBot => {
    const roll = Math.random();
    let newEvent: BotEvent = bot.currentEvent;
    let newTurnsRemaining = bot.eventTurnsRemaining;

    if (bot.eventTurnsRemaining <= 0) {
        if (roll < 0.15) {
            newEvent = BotEvent.ATTACKED;
            newTurnsRemaining = 1 + Math.floor(Math.random() * 2);
        } else if (roll < 0.25) {
            newEvent = BotEvent.SUCCESSFUL_RAID;
            newTurnsRemaining = 1 + Math.floor(Math.random() * 2);
        } else if (roll < 0.35) {
            newEvent = BotEvent.ECONOMIC_BOOM;
            newTurnsRemaining = 2 + Math.floor(Math.random() * 3);
        } else if (roll < 0.42) {
            newEvent = BotEvent.RESOURCES_CRISIS;
            newTurnsRemaining = 1 + Math.floor(Math.random() * 2);
        } else if (roll < 0.52) {
            newEvent = BotEvent.MILITARY_BUILDUP;
            newTurnsRemaining = 2 + Math.floor(Math.random() * 2);
        } else {
            newEvent = BotEvent.PEACEFUL_PERIOD;
            newTurnsRemaining = 2 + Math.floor(Math.random() * 3);
        }
    }

    const modifier = EVENT_MODIFIERS[newEvent];

    return {
        ...bot,
        currentEvent: newEvent,
        eventTurnsRemaining: Math.max(0, newTurnsRemaining - 1),
        growthModifier: modifier
    };
};

const applyGrowth = (bot: StaticBot): StaticBot => {
    const { base, category } = PERSONALITY_GROWTH_RATES[bot.personality];
    const totalRate = base + bot.growthModifier;
    const currentScore = bot.stats[category];

    // Apply growth rate directly - no cap
    let newScore = Math.floor(currentScore * (1 + totalRate));

    const newStats = {
        ...bot.stats,
        [category]: newScore
    };

    if (category !== RankingCategory.DOMINION) {
        const dominionCurrentScore = bot.stats[RankingCategory.DOMINION];
        const dominionGrowth = dominionCurrentScore * BASE_GROWTH_RATE;
        newStats[RankingCategory.DOMINION] = Math.floor(dominionCurrentScore + dominionGrowth);
    }

    return {
        ...bot,
        stats: newStats
    };
};

const applyPartialGrowth = (bot: StaticBot, partialRate: number): StaticBot => {
    const { base, category } = PERSONALITY_GROWTH_RATES[bot.personality];
    const totalRate = base + bot.growthModifier;
    const currentScore = bot.stats[category];

    // Apply partial growth rate directly - no cap
    const partialGrowthRate = totalRate * partialRate;
    let newScore = Math.floor(currentScore * (1 + partialGrowthRate));

    const newStats = {
        ...bot.stats,
        [category]: newScore
    };

    if (category !== RankingCategory.DOMINION) {
        const dominionCurrentScore = bot.stats[RankingCategory.DOMINION];
        const dominionPartialGrowth = dominionCurrentScore * (BASE_GROWTH_RATE * partialRate);
        newStats[RankingCategory.DOMINION] = Math.floor(dominionCurrentScore + dominionPartialGrowth);
    }

    return {
        ...bot,
        stats: newStats,
        eventTurnsRemaining: bot.eventTurnsRemaining
    };
};

export const processRankingEvolution = (currentBots: StaticBot[], elapsed: number): { bots: StaticBot[], cycles: number } => {
    const fullCycles = Math.floor(elapsed / GROWTH_INTERVAL_MS);
    const remainingTime = elapsed % GROWTH_INTERVAL_MS;

    if (fullCycles <= 0) {
        if (remainingTime <= 0) {
            return { bots: currentBots, cycles: 0 };
        }
        return { bots: currentBots, cycles: 0 };
    }

    // Before applying growth, update lastRank to current standings
    // This captures the rank BEFORE the growth cycle for trend calculation
    const preGrowthSorted = [...currentBots].sort((a, b) => 
        (b.stats ? b.stats[RankingCategory.DOMINION] : 0) - (a.stats ? a.stats[RankingCategory.DOMINION] : 0)
    );
    
    const preGrowthRanks = new Map<string, number>();
    preGrowthSorted.forEach((bot, index) => {
        preGrowthRanks.set(bot.id, index + 1);
    });

    let updatedBots = currentBots.map(bot => ({
        ...bot,
        lastRank: preGrowthRanks.get(bot.id) || bot.lastRank
    }));

    for (let c = 0; c < fullCycles; c++) {
        updatedBots = updatedBots.map(bot => applyEvent(bot));
        updatedBots = updatedBots.map(bot => applyGrowth(bot));
    }

    if (remainingTime > 0) {
        const partialGrowthRate = remainingTime / GROWTH_INTERVAL_MS;
        updatedBots = updatedBots.map(bot => applyPartialGrowth(bot, partialGrowthRate));
    }

    const totalCycles = fullCycles + (remainingTime > 0 ? 1 : 0);

    return {
        bots: updatedBots,
        cycles: totalCycles
    };
};
