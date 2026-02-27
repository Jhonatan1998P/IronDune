
import { BotPersonality } from '../../types/enums';
import { GameState, RankingData } from '../../types';

export enum RankingCategory {
    DOMINION = 'DOMINION',
    MILITARY = 'MILITARY',
    ECONOMY = 'ECONOMY',
    CAMPAIGN = 'CAMPAIGN'
}

const BOT_NAME_PREFIXES = [
    'Night', 'Dark', 'Iron', 'Steel', 'Shadow', 'Ghost', 'Cyber', 'Neo', 'Ultra', 'Mega',
    'Death', 'Blood', 'Skull', 'War', 'Battle', 'Strike', 'Thunder', 'Storm', 'Fire', 'Frost',
    'Zero', 'Alpha', 'Omega', 'Delta', 'Sigma', 'Prime', 'Elite', 'Viper', 'Cobra', 'Titan',
    'Raven', 'Wolf', 'Fox', 'Eagle', 'Hawk', 'Dragon', 'Phoenix', 'Reaper', 'Slayer', 'Hunter',
    'Chrome', 'Toxic', 'Venom', 'Chaos', 'Demon', 'Angel', 'Ninja', 'Samurai', 'Knight', 'Warlord',
    'Blaze', 'Tempest', 'Avalanche', 'Cyclone', 'Thunder', 'Onyx', 'Crimson', 'Azure', 'Emerald', 'Violet'
];

const BOT_NAME_ROOTS = [
    'Wolf', 'Hawk', 'Fox', 'Viper', 'Cobra', 'Raven', 'Tiger', 'Lion', 'Eagle', 'Shark',
    'Blade', 'Fang', 'Claw', 'Strike', 'Force', 'Power', 'Might', 'Fury', 'Rage', 'Wrath',
    'Star', 'Nova', 'Comet', 'Storm', 'Blaze', 'Frost', 'Shadow', 'Ghost', 'Spectre', 'Phantom',
    'Wraith', 'Titan', 'Giant', 'Colossus', 'Behemoth', 'Leviathan', 'Hydra', 'Basilisk', 'Sphinx', 'Minotaur',
    'Nexus', 'Core', 'Node', 'Link', 'Sync', 'Grid', 'Net', 'Web', 'Signal', 'Wave',
    'Secutor', 'Centurion', 'Legion', 'Cohort', 'Phalanx', 'Battalion', 'Regiment', 'Division', 'Corp', 'Force',
    'Commander', 'General', 'Colonel', 'Captain', 'Sergeant', 'Major', 'Lieutenant', 'Warden', 'Guardian', 'Protector'
];

const BOT_NAME_SUFFIXES = [
    'X', 'XX', 'XXX', 'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15',
    'King', 'Lord', 'Master', 'Chief', 'Boss', 'Head', 'Lord', 'Queen', 'Prince', 'Duke',
    'Strike', 'Force', 'Power', 'Fury', 'Rage', 'Vengeance', 'Retribution', 'Justice', 'Wrath', 'Dominion',
    'Unit', 'Squad', 'Team', ' Platoon', 'Company', 'Detachment', 'Section', 'Troop', 'Battalion', 'Regiment',
    'Ace', 'Pro', 'Elite', 'Prime', 'Ultra', 'Super', 'Mega', 'Giga', 'Tera', 'Omega'
];

const SPANISH_BOT_NAME_PREFIXES = [
    'Noche', 'Sombra', 'Fantasma', 'Cyber', 'Neo', 'Acero', 'Hierro', 'Lobo', 'Halcón', 'Cuervo',
    'Víbora', 'Cobra', 'Tigre', 'León', 'Águila', 'Tiburón', 'Dragón', 'Fénix', 'Guerrero', 'Cazador',
    'Sombras', 'Oscuridad', 'Tormenta', 'Trueno', 'Fuego', 'Hielo', 'Veneno', 'Caos', 'Demonio', 'Ángel',
    'Ninja', 'Samurái', 'Caballero', 'Señor', 'General', 'Capitán', 'Comandante', 'Alfa', 'Omega', 'Delta',
    'Sigma', 'Primo', 'Élite', 'Cromo', 'Tóxico', 'Espada', 'Garras', 'Colmillo', 'Rayo', 'Ciclón',
    'Avalancha', 'Tempestad', 'Violeta', 'Escarlata', 'Carmesí', 'Azur', 'Esmeralda', 'Negro', 'Blanco', 'Gris'
];

const SPANISH_BOT_NAME_ROOTS = [
    'Wolf', 'Hawk', 'Fox', 'Viper', 'Cobra', 'Raven', 'Tiger', 'Lion', 'Eagle', 'Shark',
    'Lobo', 'Halcón', 'Zorro', 'Víbora', 'Serpiente', 'Cuervo', 'Tigre', 'León', 'Águila', 'Tiburón',
    'Fuego', 'Lluvia', 'Viento', 'Tierra', 'Mar', 'Cielo', 'Sol', 'Luna', 'Estrella', 'Cometa',
    'Garra', 'Colmillo', 'Espada', 'Escudo', 'Armadura', 'Yelmo', 'Lanza', 'Arco', 'Ballesta', 'Bomba',
    'Centinela', 'Guardián', 'Vigilante', ' Protector', 'Defensor', 'Escudero', 'Paladín', ' Templario', 'Cruzado', 'Mago',
    'Brujo', 'Hechicero', 'Conjurador', 'Nigromante', 'Invocador', 'Artesano', 'Maestro', 'Experto', 'Veterano', 'Leyenda'
];

const SPANISH_BOT_NAME_SUFFIXES = [
    'X', 'XX', 'XXX', 'Cero', 'Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez',
    '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15',
    'Rey', 'Señor', 'Maestro', 'Jefe', 'Capitán', 'Comandante', 'General', 'Coronel', 'Teniente', 'Sargento',
    'Force', 'Power', 'Fury', 'Rage', 'Vengeance', 'Justice', 'Wrath', 'Dominion', 'Strike', 'Team',
    'Squad', 'Unit', 'Platoon', 'Company', 'Regiment', 'Division', 'Corp', 'Legion', 'Cohort', 'Phalanx',
    'Pro', 'Elite', 'Prime', 'Ultra', 'Super', 'Mega', 'Giga', 'Tera', 'Omega', 'Alpha'
];

const usedBotNames = new Set<string>();

const randomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const generateEnglishBotName = (): string => {
    const patterns = [
        () => `${randomElement(BOT_NAME_PREFIXES)}_${randomElement(BOT_NAME_ROOTS)}_${randomElement(BOT_NAME_SUFFIXES)}`,
        () => `${randomElement(BOT_NAME_PREFIXES)}${randomElement(BOT_NAME_ROOTS)}${randomElement(BOT_NAME_SUFFIXES)}`,
        () => `${randomElement(BOT_NAME_PREFIXES)}_${randomElement(BOT_NAME_ROOTS)}${Math.floor(Math.random() * 99)}`,
        () => `${randomElement(BOT_NAME_ROOTS)}${Math.floor(Math.random() * 999)}`,
        () => `${randomElement(BOT_NAME_PREFIXES)}${Math.floor(Math.random() * 999)}`,
        () => `The_${randomElement(BOT_NAME_PREFIXES)}_${randomElement(BOT_NAME_ROOTS)}`,
        () => `${randomElement(BOT_NAME_PREFIXES)}${randomElement(BOT_NAME_SUFFIXES)}`,
    ];
    
    let name = '';
    let attempts = 0;
    do {
        name = randomElement(patterns)();
        attempts++;
    } while (usedBotNames.has(name) && attempts < 50);
    
    usedBotNames.add(name);
    return name;
};

const generateSpanishBotName = (): string => {
    const patterns = [
        () => `${randomElement(SPANISH_BOT_NAME_PREFIXES)}_${randomElement(SPANISH_BOT_NAME_ROOTS)}_${randomElement(SPANISH_BOT_NAME_SUFFIXES)}`,
        () => `${randomElement(SPANISH_BOT_NAME_PREFIXES)}${randomElement(SPANISH_BOT_NAME_ROOTS)}${randomElement(SPANISH_BOT_NAME_SUFFIXES)}`,
        () => `${randomElement(SPANISH_BOT_NAME_PREFIXES)}_${randomElement(SPANISH_BOT_NAME_ROOTS)}${Math.floor(Math.random() * 99)}`,
        () => `${randomElement(SPANISH_BOT_NAME_ROOTS)}${Math.floor(Math.random() * 999)}`,
        () => `${randomElement(SPANISH_BOT_NAME_PREFIXES)}${Math.floor(Math.random() * 999)}`,
        () => `El_${randomElement(SPANISH_BOT_NAME_PREFIXES)}_${randomElement(SPANISH_BOT_NAME_ROOTS)}`,
        () => `${randomElement(SPANISH_BOT_NAME_PREFIXES)}${randomElement(SPANISH_BOT_NAME_SUFFIXES)}`,
    ];
    
    let name = '';
    let attempts = 0;
    do {
        name = randomElement(patterns)();
        attempts++;
    } while (usedBotNames.has(name) && attempts < 50);
    
    usedBotNames.add(name);
    return name;
};

export const generateBotName = (language: 'en' | 'es' = 'en'): string => {
    return language === 'es' ? generateSpanishBotName() : generateEnglishBotName();
};

export const resetBotNameGenerator = (): void => {
    usedBotNames.clear();
};

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
    currentEvent: BotEvent;
    eventTurnsRemaining: number;
    growthModifier: number;
    reputation: number;
}

const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'ES', 'BR', 'CN', 'KR', 'JP', 'RU'];
const TOTAL_BOTS = 199;
export const GROWTH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const BASE_GROWTH_RATE = 0.05;
const SOFT_CAP_SCORE = Number.MAX_SAFE_INTEGER; // Removed growth cap - bots grow indefinitely

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

const PERSONALITIES = [BotPersonality.WARLORD, BotPersonality.TURTLE, BotPersonality.TYCOON, BotPersonality.ROGUE];

export const initializeRankingState = (): RankingData => ({
    bots: Array.from({ length: TOTAL_BOTS }, (_, i) => {
        const personality = PERSONALITIES[i % PERSONALITIES.length];
        // Higher index = higher rank (more points)
        const basePoints = 1000 * Math.pow(1.04, i);
        const dominionScore = Math.round(basePoints / 50) * 50;

        return {
            id: `bot-${i}`,
            name: generateBotName('en'),
            avatarId: (i % 8) + 1,
            country: COUNTRIES[i % COUNTRIES.length],
            stats: {
                [RankingCategory.DOMINION]: dominionScore,
                [RankingCategory.MILITARY]: Math.floor(dominionScore * 0.5),
                [RankingCategory.ECONOMY]: dominionScore * 10,
                [RankingCategory.CAMPAIGN]: 1
            },
            ambition: 1.0,
            personality,
            // Higher score = better rank (lower number), so invert the index
            lastRank: TOTAL_BOTS - i,
            currentEvent: BotEvent.PEACEFUL_PERIOD,
            eventTurnsRemaining: 0,
            growthModifier: 0,
            reputation: 50
        };
    }),
    lastUpdateTime: Date.now(),
    lastPlayerRank: TOTAL_BOTS + 1
});

const applyEvent = (bot: StaticBot): StaticBot => {
    const roll = Math.random();
    let newEvent: BotEvent = bot.currentEvent;
    let turns = 0;

    if (bot.eventTurnsRemaining <= 0) {
        if (roll < 0.15) {
            newEvent = BotEvent.ATTACKED;
            turns = 1 + Math.floor(Math.random() * 2);
        } else if (roll < 0.25) {
            newEvent = BotEvent.SUCCESSFUL_RAID;
            turns = 1 + Math.floor(Math.random() * 2);
        } else if (roll < 0.35) {
            newEvent = BotEvent.ECONOMIC_BOOM;
            turns = 2 + Math.floor(Math.random() * 3);
        } else if (roll < 0.42) {
            newEvent = BotEvent.RESOURCES_CRISIS;
            turns = 1 + Math.floor(Math.random() * 2);
        } else if (roll < 0.52) {
            newEvent = BotEvent.MILITARY_BUILDUP;
            turns = 2 + Math.floor(Math.random() * 2);
        } else {
            newEvent = BotEvent.PEACEFUL_PERIOD;
            turns = 2 + Math.floor(Math.random() * 3);
        }
    } else {
        newEvent = bot.currentEvent;
        turns = bot.eventTurnsRemaining;
    }

    const modifier = EVENT_MODIFIERS[newEvent];

    return {
        ...bot,
        currentEvent: newEvent,
        eventTurnsRemaining: Math.max(0, bot.eventTurnsRemaining - 1),
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
        b.stats[RankingCategory.DOMINION] - a.stats[RankingCategory.DOMINION]
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

const getTier = (rank: number): RankingEntry['tier'] => {
    if (rank <= 3) return 'S';
    if (rank <= 10) return 'A';
    if (rank <= 50) return 'B';
    if (rank <= 100) return 'C';
    return 'D';
};

export const getCurrentStandings = (state: GameState, bots: StaticBot[], category: RankingCategory): RankingEntry[] => {
    const previousPlayerRank = state.rankingData.lastPlayerRank;

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
        name: state.playerName || 'Commander',
        score: state.empirePoints,
        isPlayer: true,
        avatarId: 0,
        country: 'US',
        tier: 'D',
        trend: 0,
        _rawLastRank: previousPlayerRank,
        personality: BotPersonality.WARLORD
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
