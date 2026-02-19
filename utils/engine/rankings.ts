
import { BotPersonality } from '../../types/enums';
import { GameState, RankingData } from '../../types';

// --- NAME GENERATION DATASETS ---

const COUNTRIES = [
    'US', 'GB', 'DE', 'FR', 'ES', 'BR', 'CN', 'KR', 'JP', 'RU', 
    'CA', 'AU', 'IT', 'IN', 'MX', 'AR', 'CL', 'CO', 'PL', 'UA',
    'TR', 'ID', 'VN', 'TH', 'PH', 'MY', 'SG', 'SA', 'ZA', 'EG'
];

const CLAN_TAGS = [
    '[IDF]', '[WAR]', '[RATS]', '[GDI]', '[NOD]', '[OPS]', '[101]', '[PVP]', '[AFK]', '[BOT]', 
    '[ELITE]', '[USA]', '[ESP]', '[MEX]', '[RUS]', '[CHN]', '[IRON]', '[DUNE]', '[HEX]', '[VOID]',
    '[FATE]', '[SINS]', '[GOD]', '[EVIL]', '[N7]', '[ODST]', '[SAS]', '[NAVY]', '[USMC]', '[KOR]'
];

const ADJECTIVES = [
    'Dark', 'Neon', 'Cyber', 'Iron', 'Steel', 'Silent', 'Rogue', 'Savage', 'Atomic', 'Toxic', 
    'Solar', 'Lunar', 'Crimson', 'Shadow', 'Rapid', 'Heavy', 'Ghost', 'Elite', 'Prime', 'Alpha', 
    'Omega', 'Lost', 'Fallen', 'Rising', 'Epic', 'Crazy', 'Mad', 'Pro', 'Noob', 'Holy',
    'Black', 'White', 'Red', 'Blue', 'Green', 'Golden', 'Silver', 'Crystal', 'Phantom', 'Demon',
    'Lethal', 'Vengeful', 'Radiant', 'Frozen', 'Burning', 'Electric', 'Divine', 'Cursed', 'Ancient'
];

const NOUNS = [
    'Wolf', 'Viper', 'Bear', 'Eagle', 'Falcon', 'Shark', 'Cobra', 'Dragon', 'Tiger', 'Lion',
    'Blade', 'Edge', 'Storm', 'Thunder', 'Rain', 'Frost', 'Ice', 'Fire', 'Flame', 'Spark',
    'Sniper', 'Gunner', 'Pilot', 'Tank', 'Commando', 'General', 'King', 'Lord', 'God', 'Slayer',
    'Hunter', 'Raider', 'Reaper', 'Spectre', 'Phantom', 'Titan', 'Atlas', 'Zeus', 'Ares', 'Mars',
    'Unit', 'Mech', 'Droid', 'System', 'Glitch', 'Error', 'Zero', 'One', 'User', 'Player',
    'Knight', 'Samurai', 'Ninja', 'Viking', 'Pirate', 'Spartan', 'Trooper', 'Ranger', 'Scout', 'Spy',
    'Beast', 'Monster', 'Demon', 'Angel', 'Spirit', 'Soul', 'Mind', 'Heart', 'Fist', 'Hand'
];

const PREFIXES_LEET = ['xX_', 'iAm_', 'The_', 'Real_', 'Dr_', 'Mr_', 'Capt_', 'Itz_', 'Im_'];
const SUFFIXES_LEET = ['_Xx', '_HD', '_YT', '_TV', '_PRO', '_OG', '_1337', '_Gamer', '_TTV', '_LIVE'];

export enum RankingCategory {
    DOMINION = 'DOMINION',   // Empire Points
    MILITARY = 'MILITARY',   // Enemies Killed
    ECONOMY = 'ECONOMY',     // Total Resources Mined (approx)
    CAMPAIGN = 'CAMPAIGN'    // Campaign Level
}

export interface RankingEntry {
    id: string;
    rank: number;
    name: string;
    score: number;
    isPlayer: boolean;
    avatarId: number; // 1-10
    country: string; // ISO Code
    tier: 'S' | 'A' | 'B' | 'C' | 'D';
    trend: number; // Difference vs last rank (positive = climbed)
    _rawLastRank?: number; // Internal use
    personality: BotPersonality; // New
}

// Bot definition for storage
export interface StaticBot {
    id: string;
    name: string;
    avatarId: number;
    country: string;
    stats: Record<RankingCategory, number>;
    ambition: number; // Multiplier for growth (0.90 - 1.15)
    personality: BotPersonality;
    lastRank?: number; // Rank snapshot before last update
}

const TOTAL_BOTS = 199; // +1 Player = 200 Total
export const GROWTH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 Hours

// --- BALANCING CONSTANTS ---
const BASE_GROWTH_RATE = 0.05; // 5% Base Growth per cycle (Passive)
const SOFT_CAP_SCORE = 5000000; // Updated to 5 Million for Tier 4 reach

// --- GENERATION LOGIC ---

export const getFlagEmoji = (countryCode: string) => {
    if (!countryCode) return '';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
};

const getRandomElement = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const getRandomName = () => {
    const pattern = Math.random();
    
    if (pattern < 0.35) {
        return `${getRandomElement(ADJECTIVES)}${getRandomElement(NOUNS)}`;
    }
    
    if (pattern < 0.60) {
        const noun = getRandomElement(NOUNS);
        const finalNoun = Math.random() > 0.5 ? noun : noun.toLowerCase();
        return `${getRandomElement(CLAN_TAGS)} ${finalNoun}`;
    }

    if (pattern < 0.80) {
        const noun = getRandomElement(NOUNS);
        const num = Math.floor(Math.random() * 1000); 
        return `${noun}${num}`;
    }

    if (pattern < 0.95) {
        const prefix = getRandomElement(PREFIXES_LEET);
        const noun = getRandomElement(NOUNS);
        const useSuffix = Math.random() > 0.5;
        return `${prefix}${noun}${useSuffix ? getRandomElement(SUFFIXES_LEET) : ''}`;
    }

    const noun = getRandomElement(NOUNS).toLowerCase();
    return Math.random() > 0.5 ? noun : `${noun}_${Math.floor(Math.random() * 100)}`;
};

const getRandomPersonality = (): BotPersonality => {
    const r = Math.random();
    if (r < 0.35) return BotPersonality.WARLORD; // 35%
    if (r < 0.65) return BotPersonality.TURTLE;  // 30%
    if (r < 0.85) return BotPersonality.TYCOON;  // 20%
    return BotPersonality.ROGUE;                 // 15%
};

// Generate a static list of bots
const generateStaticBots = (): StaticBot[] => {
    const bots: StaticBot[] = [];

    for (let i = 0; i < TOTAL_BOTS; i++) {
        let tierMultiplier = 0;
        const percentile = i / TOTAL_BOTS;

        if (percentile < 0.05) { // Top 5%
            tierMultiplier = 0.9 + (Math.random() * 0.1);
        } else if (percentile < 0.20) { // Next 15%
            tierMultiplier = 0.6 + (Math.random() * 0.2);
        } else if (percentile < 0.50) { // Next 30%
            tierMultiplier = 0.3 + (Math.random() * 0.2);
        } else { // Bottom 50%
            tierMultiplier = Math.random() * 0.2;
        }

        const MAX_POINTS = 2000000; 
        const MAX_KILLS = 150000;
        const MAX_RES = 500000000;
        const MAX_CAMPAIGN = 25;

        const curve = Math.pow(tierMultiplier, 3); 

        const personality = getRandomPersonality();
        let pointBias = 1.0, killBias = 1.0, ecoBias = 1.0;

        if (personality === BotPersonality.WARLORD) killBias = 1.5;
        if (personality === BotPersonality.TYCOON) ecoBias = 2.0;
        if (personality === BotPersonality.TURTLE) { pointBias = 1.3; ecoBias = 1.2; killBias = 0.5; }

        const points = Math.floor(curve * MAX_POINTS * pointBias) + Math.floor(Math.random() * 500);
        const kills = Math.floor(curve * MAX_KILLS * killBias) + Math.floor(Math.random() * 50);
        const economy = Math.floor(curve * MAX_RES * ecoBias) + Math.floor(Math.random() * 10000);
        
        let campaign = Math.floor(tierMultiplier * MAX_CAMPAIGN);
        if (campaign < 1) campaign = 1;
        if (campaign > 25) campaign = 25;

        const ambition = 0.90 + (Math.random() * 0.25);

        bots.push({
            id: `bot-${i}`,
            name: getRandomName(),
            avatarId: Math.floor(Math.random() * 8) + 1,
            country: getRandomElement(COUNTRIES),
            stats: {
                [RankingCategory.DOMINION]: points,
                [RankingCategory.MILITARY]: kills,
                [RankingCategory.ECONOMY]: economy,
                [RankingCategory.CAMPAIGN]: campaign
            },
            ambition,
            personality,
            lastRank: i + 1
        });
    }

    return bots;
};

// --- PURE FUNCTIONS ---

export const initializeRankingState = (): RankingData => {
    return {
        bots: generateStaticBots(),
        lastUpdateTime: Date.now()
    };
};

export const processRankingEvolution = (currentBots: StaticBot[], elapsed: number): { bots: StaticBot[], cycles: number } => {
    const cycles = Math.floor(elapsed / GROWTH_INTERVAL_MS);
    if (cycles <= 0) return { bots: currentBots, cycles: 0 };

    // Snapshot current ranking for trend calculation
    const sortedIdsByScore = [...currentBots]
        .sort((a, b) => (b.stats?.DOMINION || 0) - (a.stats?.DOMINION || 0))
        .map(b => b.id);

    const updatedBots = currentBots.map(bot => {
        const currentStats = bot.stats || { DOMINION: 0, MILITARY: 0, ECONOMY: 0, CAMPAIGN: 1 };
        const newStats = { ...currentStats };
        
        // 1. SATURATION (LOGISTIC GROWTH)
        const safeScore = Math.max(1, currentStats[RankingCategory.DOMINION] || 1);
        const saturationFactor = SOFT_CAP_SCORE / (SOFT_CAP_SCORE + safeScore);
        
        // 2. GROWTH CALCULATION
        const growthRate = BASE_GROWTH_RATE * (bot.ambition || 1.0) * saturationFactor;
        const compoundMultiplier = Math.pow(1 + growthRate, cycles);

        if (isNaN(compoundMultiplier) || !isFinite(compoundMultiplier)) {
            return bot; 
        }

        // 3. PERSONALITY BIAS
        let pMilitaryMult = 1.0;
        let pEcoMult = 1.0;
        
        switch (bot.personality) {
            case BotPersonality.WARLORD: pMilitaryMult = 1.3; pEcoMult = 0.8; break;
            case BotPersonality.TURTLE: pMilitaryMult = 0.9; pEcoMult = 1.1; break;
            case BotPersonality.TYCOON: pMilitaryMult = 0.7; pEcoMult = 1.5; break;
            case BotPersonality.ROGUE: 
                pMilitaryMult = 1.2; pEcoMult = 0.9; 
                break;
        }

        // 4. VOLATILITY
        let volatility = 1.0;
        const maxLoops = Math.min(cycles, 10); 
        
        for(let i=0; i<maxLoops; i++) {
            const entropy = Math.random();
            if (entropy < 0.05) volatility *= (0.85 + (Math.random() * 0.05)); 
            else if (entropy < 0.25) volatility *= (0.95 + (Math.random() * 0.04));
            else volatility *= (1.00 + (Math.random() * 0.03));
        }

        const totalMultiplier = compoundMultiplier * volatility;
        
        newStats[RankingCategory.DOMINION] = Math.floor(newStats[RankingCategory.DOMINION] * totalMultiplier);
        newStats[RankingCategory.MILITARY] = Math.floor(newStats[RankingCategory.MILITARY] * (totalMultiplier * 1.02 * pMilitaryMult)); 
        newStats[RankingCategory.ECONOMY] = Math.floor(newStats[RankingCategory.ECONOMY] * (totalMultiplier * pEcoMult));
        
        if (newStats[RankingCategory.CAMPAIGN] < 25) {
            const chance = 0.1 * (bot.ambition || 1) * cycles;
            const levelsGained = Math.min(2, Math.floor(chance) + (Math.random() < (chance % 1) ? 1 : 0));
            newStats[RankingCategory.CAMPAIGN] = Math.min(25, newStats[RankingCategory.CAMPAIGN] + levelsGained);
        }

        return { 
            ...bot, 
            stats: newStats,
            lastRank: sortedIdsByScore.indexOf(bot.id) + 1
        };
    });

    return { bots: updatedBots, cycles };
};

const getTier = (rank: number): RankingEntry['tier'] => {
    if (rank <= 3) return 'S';
    if (rank <= 10) return 'A';
    if (rank <= 50) return 'B';
    if (rank <= 100) return 'C';
    return 'D';
};

// --- PUBLIC API ---

export const getCurrentStandings = (state: GameState, bots: StaticBot[], category: RankingCategory): RankingEntry[] => {
    let playerScore = 0;
    switch (category) {
        case RankingCategory.DOMINION:
            playerScore = state.empirePoints;
            break;
        case RankingCategory.MILITARY:
            playerScore = state.lifetimeStats.enemiesKilled;
            break;
        case RankingCategory.ECONOMY:
            playerScore = Math.floor(state.lifetimeStats.resourcesMined);
            break;
        case RankingCategory.CAMPAIGN:
            playerScore = state.campaignProgress;
            break;
    }

    const entries: RankingEntry[] = bots.map(bot => ({
        id: bot.id,
        rank: 0, 
        name: bot.name,
        score: bot.stats[category],
        isPlayer: false,
        avatarId: bot.avatarId,
        country: bot.country,
        tier: 'D',
        trend: 0, 
        _rawLastRank: bot.lastRank,
        personality: bot.personality
    }));

    entries.push({
        id: 'PLAYER',
        rank: 0,
        name: 'YOU',
        score: playerScore,
        isPlayer: true,
        avatarId: 0, 
        country: 'US', // Default
        tier: 'D',
        trend: 0,
        _rawLastRank: undefined,
        personality: BotPersonality.WARLORD 
    });

    entries.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.isPlayer ? -1 : 1; 
    });

    return entries.map((entry, index) => {
        const currentRank = index + 1;
        let trend = 0;
        
        if (category === RankingCategory.DOMINION && !entry.isPlayer && entry._rawLastRank) {
            trend = entry._rawLastRank - currentRank;
        }

        return {
            ...entry,
            rank: currentRank,
            tier: getTier(currentRank),
            trend
        };
    });
};
