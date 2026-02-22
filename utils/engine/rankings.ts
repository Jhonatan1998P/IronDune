
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
}

export interface StaticBot {
    id: string;
    name: string;
    avatarId: number;
    country: string;
    stats: Record<RankingCategory, number>;
    ambition: number;
    personality: BotPersonality;
    lastRank?: number;
}

const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'ES', 'BR', 'CN', 'KR', 'JP', 'RU'];
const TOTAL_BOTS = 199;
export const GROWTH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const BASE_GROWTH_RATE = 0.05;
const SOFT_CAP_SCORE = 5000000;

export const getFlagEmoji = (countryCode: string) => {
    if (!countryCode) return '';
    const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
};

export const initializeRankingState = (): RankingData => ({
    bots: Array.from({ length: TOTAL_BOTS }, (_, i) => ({
        id: `bot-${i}`,
        name: `Bot ${i}`,
        avatarId: (i % 8) + 1,
        country: COUNTRIES[i % COUNTRIES.length],
        stats: { [RankingCategory.DOMINION]: 1000 + i * 500, [RankingCategory.MILITARY]: i * 50, [RankingCategory.ECONOMY]: i * 10000, [RankingCategory.CAMPAIGN]: 1 },
        ambition: 1.0,
        personality: BotPersonality.WARLORD,
        lastRank: i + 1
    })),
    lastUpdateTime: Date.now()
});

export const processRankingEvolution = (currentBots: StaticBot[], elapsed: number): { bots: StaticBot[], cycles: number } => ({ bots: currentBots, cycles: 0 });

const getTier = (rank: number): RankingEntry['tier'] => {
    if (rank <= 3) return 'S';
    if (rank <= 10) return 'A';
    if (rank <= 50) return 'B';
    if (rank <= 100) return 'C';
    return 'D';
};

export const getCurrentStandings = (state: GameState, bots: StaticBot[], category: RankingCategory): RankingEntry[] => {
    const entries: RankingEntry[] = bots.map(bot => {
        const score = bot.stats[category];
        const ratio = score / Math.max(1, state.empirePoints);
        return {
            id: bot.id,
            rank: 0,
            name: bot.name,
            score,
            isPlayer: false,
            avatarId: bot.avatarId,
            country: bot.country,
            tier: 'D',
            trend: 0,
            _rawLastRank: bot.lastRank,
            personality: bot.personality,
            canAttack: ratio >= 0.5 && ratio <= 1.5
        };
    });

    entries.push({
        id: 'PLAYER',
        rank: 0,
        name: 'YOU',
        score: state.empirePoints,
        isPlayer: true,
        avatarId: 0,
        country: 'US',
        tier: 'D',
        trend: 0,
        personality: BotPersonality.WARLORD
    });

    entries.sort((a, b) => b.score - a.score);

    return entries.map((entry, index) => ({
        ...entry,
        rank: index + 1,
        tier: getTier(index + 1),
        trend: (entry._rawLastRank || 0) - (index + 1)
    }));
};
