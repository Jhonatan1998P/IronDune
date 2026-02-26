
import { BuildingType, GameState, ResourceType, TechType, UnitType } from '../../types';
import { SAVE_VERSION, WAR_DURATION_MS, WAR_PLAYER_ATTACKS, WAR_TOTAL_WAVES } from '../../constants';
import { INITIAL_GAME_STATE } from '../../data/initialState';
import { initializeRankingState, RankingCategory, StaticBot, BotEvent } from './rankings';
import { BotPersonality } from '../../types/enums';

// Key for old deprecated local storage ranking system
const LEGACY_STORAGE_KEY = 'ironDune_static_rankings_v3';

const VALID_PERSONALITIES = Object.values(BotPersonality);
const VALID_BOT_EVENTS = Object.values(BotEvent);
const REQUIRED_RANKING_CATEGORIES = Object.values(RankingCategory);

const DEFAULT_BOT_STATS: Record<RankingCategory, number> = {
    [RankingCategory.DOMINION]: 1000,
    [RankingCategory.MILITARY]: 500,
    [RankingCategory.ECONOMY]: 10000,
    [RankingCategory.CAMPAIGN]: 1
};

const BOT_SCORE_MIN = 1000;
const BOT_SCORE_MAX = 2000000;
const SUSPICIOUS_SCORE_THRESHOLD = 5000000;

const isSuspiciousScore = (score: number): boolean => {
    return score > SUSPICIOUS_SCORE_THRESHOLD || score < 100;
};

const calculateProgressiveScore = (rank: number): number => {
    const minScore = 1000;
    const maxScore = 2000000;
    const posRatio = Math.max(0, Math.min(1, (199 - rank) / 198));
    return Math.floor(minScore + posRatio * (maxScore - minScore));
};

export const sanitizeBot = (bot: any, index: number): StaticBot => {
    const sanitizedStats = { ...DEFAULT_BOT_STATS };
    
    const rank = bot.lastRank || (index + 1);
    const progressiveScore = calculateProgressiveScore(rank);

    if (bot.stats && typeof bot.stats === 'object') {
        REQUIRED_RANKING_CATEGORIES.forEach(cat => {
            if (typeof bot.stats[cat] === 'number' && !isNaN(bot.stats[cat])) {
                const botScore = bot.stats[cat];
                if (cat === RankingCategory.DOMINION) {
                    if (botScore === 1000 && rank < 199) {
                        sanitizedStats[cat] = progressiveScore;
                    } else if (isSuspiciousScore(botScore)) {
                        sanitizedStats[cat] = progressiveScore;
                    } else {
                        sanitizedStats[cat] = botScore;
                    }
                } else {
                    sanitizedStats[cat] = botScore;
                }
            } else {
                sanitizedStats[cat] = cat === RankingCategory.DOMINION ? progressiveScore : DEFAULT_BOT_STATS[cat];
            }
        });
    } else {
        sanitizedStats[RankingCategory.DOMINION] = progressiveScore;
    }
    
    let personality = BotPersonality.WARLORD;
    if (bot.personality && VALID_PERSONALITIES.includes(bot.personality)) {
        personality = bot.personality;
    }
    
    let currentEvent = BotEvent.PEACEFUL_PERIOD;
    if (bot.currentEvent && VALID_BOT_EVENTS.includes(bot.currentEvent)) {
        currentEvent = bot.currentEvent;
    }
    
    return {
        id: bot.id || `bot-${index}`,
        name: bot.name || `Bot_${index}`,
        avatarId: typeof bot.avatarId === 'number' ? bot.avatarId : (index % 8) + 1,
        country: bot.country || 'US',
        stats: sanitizedStats,
        ambition: typeof bot.ambition === 'number' && !isNaN(bot.ambition) ? bot.ambition : 1.0,
        personality,
        lastRank: typeof bot.lastRank === 'number' && !isNaN(bot.lastRank) ? bot.lastRank : index + 1,
        currentEvent,
        eventTurnsRemaining: typeof bot.eventTurnsRemaining === 'number' && !isNaN(bot.eventTurnsRemaining) 
            ? Math.max(0, bot.eventTurnsRemaining) 
            : 0,
        growthModifier: typeof bot.growthModifier === 'number' && !isNaN(bot.growthModifier) 
            ? bot.growthModifier 
            : 0,
        reputation: typeof bot.reputation === 'number' && !isNaN(bot.reputation)
            ? bot.reputation
            : 50
    };
};

export const sanitizeRankingData = (rankingData: any, saveVersion?: number): { bots: StaticBot[]; lastUpdateTime: number } => {
    const now = Date.now();
    
    const FORCE_RANKING_RESET_VERSION = 6;
    const needsReset = !saveVersion || saveVersion < FORCE_RANKING_RESET_VERSION;
    
    if (needsReset) {
        console.log(`[Migration] Resetting ranking data (save version: ${saveVersion || 'unknown'}, required: ${FORCE_RANKING_RESET_VERSION})`);
        return initializeRankingState();
    }
    
    if (!rankingData || typeof rankingData !== 'object') {
        return initializeRankingState();
    }
    
    if (!Array.isArray(rankingData.bots) || rankingData.bots.length === 0) {
        return initializeRankingState();
    }
    
    const sanitizedBots = rankingData.bots
        .filter((bot: any) => bot && typeof bot === 'object')
        .map((bot: any, index: number) => sanitizeBot(bot, index));
    
    if (sanitizedBots.length === 0) {
        return initializeRankingState();
    }
    
    const lastUpdateTime = typeof rankingData.lastUpdateTime === 'number' && !isNaN(rankingData.lastUpdateTime)
        ? rankingData.lastUpdateTime
        : now;
    
    return {
        bots: sanitizedBots,
        lastUpdateTime
    };
};

export const sanitizeAndMigrateSave = (saved: any): GameState => {
    // 1. Deep Clone Initial State to ensure full structure exists
    const cleanState: GameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));

    if (!saved) return cleanState;

    // 2. Migrate Primitives & Simple Arrays
    if (typeof saved.playerName === 'string' && saved.playerName.trim().length >= 2) {
        cleanState.playerName = saved.playerName.trim().substring(0, 20);
    }
    if (typeof saved.hasChangedName === 'boolean') cleanState.hasChangedName = saved.hasChangedName;
    if (typeof saved.bankBalance === 'number' && !isNaN(saved.bankBalance)) cleanState.bankBalance = saved.bankBalance;
    if (typeof saved.currentInterestRate === 'number') cleanState.currentInterestRate = saved.currentInterestRate;
    if (typeof saved.nextRateChangeTime === 'number') cleanState.nextRateChangeTime = saved.nextRateChangeTime;
    if (typeof saved.lastInterestPayoutTime === 'number') cleanState.lastInterestPayoutTime = saved.lastInterestPayoutTime;
    if (typeof saved.empirePoints === 'number') cleanState.empirePoints = saved.empirePoints;
    if (typeof saved.lastSaveTime === 'number') cleanState.lastSaveTime = saved.lastSaveTime;
    if (typeof saved.campaignProgress === 'number') cleanState.campaignProgress = saved.campaignProgress;
    if (typeof saved.lastCampaignMissionFinishedTime === 'number') cleanState.lastCampaignMissionFinishedTime = saved.lastCampaignMissionFinishedTime;
    if (typeof saved.isTutorialMinimized === 'boolean') cleanState.isTutorialMinimized = saved.isTutorialMinimized;
    if (typeof saved.tutorialAccepted === 'boolean') cleanState.tutorialAccepted = saved.tutorialAccepted;
    
    // Attack System Persistence (V1.4 - Cooldown based)
    if (typeof saved.nextAttackTime === 'number' && !isNaN(saved.nextAttackTime)) cleanState.nextAttackTime = saved.nextAttackTime;
    if (Array.isArray(saved.incomingAttacks)) cleanState.incomingAttacks = saved.incomingAttacks;
    
    // Grudges Migration (with personality sanitization)
    if (Array.isArray(saved.grudges)) {
        cleanState.grudges = saved.grudges.filter((g: any) => g && typeof g === 'object').map((g: any) => ({
            id: g.id || `grudge-${Date.now()}`,
            botId: g.botId || '',
            botName: g.botName || 'Unknown',
            botPersonality: g.botPersonality && VALID_PERSONALITIES.includes(g.botPersonality)
                ? g.botPersonality : BotPersonality.WARLORD,
            botScore: typeof g.botScore === 'number' && !isNaN(g.botScore) ? g.botScore : 1000,
            createdAt: typeof g.createdAt === 'number' && !isNaN(g.createdAt) ? g.createdAt : Date.now(),
            retaliationTime: typeof g.retaliationTime === 'number' && !isNaN(g.retaliationTime) ? g.retaliationTime : Date.now(),
            notified: typeof g.notified === 'boolean' ? g.notified : false
        }));
    }

    // Enemy Attack System Migration
    if (saved.enemyAttackCounts) cleanState.enemyAttackCounts = saved.enemyAttackCounts;
    if (saved.lastEnemyAttackCheckTime) cleanState.lastEnemyAttackCheckTime = saved.lastEnemyAttackCheckTime;
    if (saved.lastEnemyAttackResetTime) cleanState.lastEnemyAttackResetTime = saved.lastEnemyAttackResetTime;

    // Attack Counts Migration
    if (saved.targetAttackCounts) cleanState.targetAttackCounts = saved.targetAttackCounts;
    if (saved.lastAttackResetTime) cleanState.lastAttackResetTime = saved.lastAttackResetTime;

    // WAR MIGRATION: Ensure new fields exist if war is active
    if (saved.activeWar && typeof saved.activeWar === 'object') {
        const war = saved.activeWar;
        
        const sanitizeWarResources = (res: any): Record<ResourceType, number> => ({
            [ResourceType.MONEY]: typeof res?.[ResourceType.MONEY] === 'number' && !isNaN(res[ResourceType.MONEY]) ? res[ResourceType.MONEY] : 0,
            [ResourceType.OIL]: typeof res?.[ResourceType.OIL] === 'number' && !isNaN(res[ResourceType.OIL]) ? res[ResourceType.OIL] : 0,
            [ResourceType.AMMO]: typeof res?.[ResourceType.AMMO] === 'number' && !isNaN(res[ResourceType.AMMO]) ? res[ResourceType.AMMO] : 0,
            [ResourceType.GOLD]: typeof res?.[ResourceType.GOLD] === 'number' && !isNaN(res[ResourceType.GOLD]) ? res[ResourceType.GOLD] : 0,
            [ResourceType.DIAMOND]: typeof res?.[ResourceType.DIAMOND] === 'number' && !isNaN(res[ResourceType.DIAMOND]) ? res[ResourceType.DIAMOND] : 0
        });
        
        cleanState.activeWar = {
            id: war.id || `war-${Date.now()}`,
            enemyId: war.enemyId || '',
            enemyName: war.enemyName || 'Unknown Enemy',
            enemyScore: typeof war.enemyScore === 'number' && !isNaN(war.enemyScore) ? war.enemyScore : 1000,
            startTime: typeof war.startTime === 'number' && !isNaN(war.startTime) ? war.startTime : Date.now(),
            duration: typeof war.duration === 'number' && !isNaN(war.duration) && war.duration !== 110 * 60 * 1000 
                ? war.duration : WAR_DURATION_MS,
            nextWaveTime: typeof war.nextWaveTime === 'number' && !isNaN(war.nextWaveTime) ? war.nextWaveTime : Date.now(),
            currentWave: typeof war.currentWave === 'number' && !isNaN(war.currentWave) ? war.currentWave : 1,
            totalWaves: typeof war.totalWaves === 'number' && !isNaN(war.totalWaves) && war.totalWaves !== 7 
                ? war.totalWaves : WAR_TOTAL_WAVES,
            playerVictories: typeof war.playerVictories === 'number' && !isNaN(war.playerVictories) ? war.playerVictories : 0,
            enemyVictories: typeof war.enemyVictories === 'number' && !isNaN(war.enemyVictories) ? war.enemyVictories : 0,
            playerAttacksLeft: typeof war.playerAttacksLeft === 'number' && !isNaN(war.playerAttacksLeft) 
                ? war.playerAttacksLeft : WAR_PLAYER_ATTACKS,
            lootPool: sanitizeWarResources(war.lootPool),
            playerResourceLosses: sanitizeWarResources(war.playerResourceLosses),
            enemyResourceLosses: sanitizeWarResources(war.enemyResourceLosses),
            playerUnitLosses: typeof war.playerUnitLosses === 'number' && !isNaN(war.playerUnitLosses) ? war.playerUnitLosses : 0,
            enemyUnitLosses: typeof war.enemyUnitLosses === 'number' && !isNaN(war.enemyUnitLosses) ? war.enemyUnitLosses : 0,
            currentEnemyGarrison: war.currentEnemyGarrison || {}
        };
    }

    // 3. Migrate Techs
    if (Array.isArray(saved.researchedTechs)) {
        cleanState.researchedTechs = saved.researchedTechs.filter((id: string) => Object.values(TechType).includes(id as TechType));
    }
    
    // Migrate Tech Levels (New in version 2 or this feature update)
    if (saved.techLevels && typeof saved.techLevels === 'object') {
        cleanState.techLevels = saved.techLevels;
    }

    // 4. Migrate Resources
    if (saved.resources) {
        Object.keys(cleanState.resources).forEach(key => {
            const k = key as ResourceType;
            if (typeof saved.resources[k] === 'number' && !isNaN(saved.resources[k])) {
                cleanState.resources[k] = saved.resources[k];
            }
        });
    }

    if (saved.maxResources) {
        Object.keys(cleanState.maxResources).forEach(key => {
            const k = key as ResourceType;
            if (typeof saved.maxResources[k] === 'number' && !isNaN(saved.maxResources[k])) {
                cleanState.maxResources[k] = saved.maxResources[k];
            }
        });
    }

    // 5. Migrate Units
    if (saved.units) {
        Object.keys(cleanState.units).forEach(key => {
            const k = key as UnitType;
            if (typeof saved.units[k] === 'number' && !isNaN(saved.units[k])) {
                cleanState.units[k] = saved.units[k];
            }
        });
    }

    // 6. Migrate Buildings
    if (saved.buildings) {
        Object.keys(cleanState.buildings).forEach(key => {
            const k = key as BuildingType;
            if (saved.buildings[k] && typeof saved.buildings[k].level === 'number') {
                cleanState.buildings[k].level = saved.buildings[k].level;
            }
            if (saved.buildings[k] && typeof saved.buildings[k].isDamaged === 'boolean') {
                cleanState.buildings[k].isDamaged = saved.buildings[k].isDamaged;
            }
        });
    }

    // --- CRITICAL FIX: Ensure Diamond Mine is at least Level 1 ---
    if (!cleanState.buildings[BuildingType.DIAMOND_MINE] || cleanState.buildings[BuildingType.DIAMOND_MINE].level < 1) {
        const existingDiamondMine = cleanState.buildings[BuildingType.DIAMOND_MINE];
        cleanState.buildings[BuildingType.DIAMOND_MINE] = {
            level: 1,
            isDamaged: existingDiamondMine?.isDamaged ?? false
        };
    }

    // Ensure all building states have proper structure with isDamaged
    Object.keys(cleanState.buildings).forEach((key) => {
        const k = key as BuildingType;
        if (cleanState.buildings[k]) {
            const building = cleanState.buildings[k];
            if (typeof building.isDamaged !== 'boolean') {
                cleanState.buildings[k] = { ...building, isDamaged: false };
            }
        }
    });

    // 7. Migrate Missions
    if (Array.isArray(saved.activeMissions)) {
        cleanState.activeMissions = saved.activeMissions.filter((m: any) => 
            m && 
            typeof m.id === 'string' && 
            typeof m.endTime === 'number' && 
            m.units
        );
    }

    if (saved.activeResearch) {
        cleanState.activeResearch = saved.activeResearch;
    }
    
    // Migrate Active Recruitments (NEW)
    if (Array.isArray(saved.activeRecruitments)) {
        cleanState.activeRecruitments = saved.activeRecruitments;
    }

    // Migrate Active Constructions (NEW for this request)
    if (Array.isArray(saved.activeConstructions)) {
        cleanState.activeConstructions = saved.activeConstructions;
    }
    
    // Market Migration
    if (Array.isArray(saved.marketOffers)) {
        cleanState.marketOffers = saved.marketOffers;
    }
    if (saved.activeMarketEvent) {
        cleanState.activeMarketEvent = saved.activeMarketEvent;
    }
    if (typeof saved.marketNextRefreshTime === 'number') {
        cleanState.marketNextRefreshTime = saved.marketNextRefreshTime;
    }

    // Tutorial State
    if (Array.isArray(saved.completedTutorials)) {
        cleanState.completedTutorials = saved.completedTutorials;
    }
    if (typeof saved.currentTutorialId === 'string' || saved.currentTutorialId === null) {
        cleanState.currentTutorialId = saved.currentTutorialId;
    }
    if (typeof saved.tutorialClaimable === 'boolean') {
        cleanState.tutorialClaimable = saved.tutorialClaimable;
    }

    // Rankings Migration (IMPROVED V2.0 - Full sanitization) - Reset for old saves
    const savedVersion = saved.saveVersion;
    if (saved.rankingData) {
        cleanState.rankingData = sanitizeRankingData(saved.rankingData, savedVersion);
    } else {
        // LEGACY MIGRATION: Try to rescue data from localStorage if it exists
        try {
            const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacyData) {
                const parsedLegacy = JSON.parse(legacyData);
                cleanState.rankingData = sanitizeRankingData(parsedLegacy, savedVersion);
                console.log("Migrated rankings from LocalStorage to GameState.");
            } else {
                cleanState.rankingData = initializeRankingState();
            }
        } catch (e) {
            console.warn("Failed to migrate legacy rankings, initializing fresh:", e);
            cleanState.rankingData = initializeRankingState();
        }
    }

    // Migrate Lifetime Stats (with NaN protection)
    if (saved.lifetimeStats && typeof saved.lifetimeStats === 'object') {
        cleanState.lifetimeStats = {
            enemiesKilled: typeof saved.lifetimeStats.enemiesKilled === 'number' && !isNaN(saved.lifetimeStats.enemiesKilled) 
                ? saved.lifetimeStats.enemiesKilled : 0,
            unitsLost: typeof saved.lifetimeStats.unitsLost === 'number' && !isNaN(saved.lifetimeStats.unitsLost) 
                ? saved.lifetimeStats.unitsLost : 0,
            resourcesMined: typeof saved.lifetimeStats.resourcesMined === 'number' && !isNaN(saved.lifetimeStats.resourcesMined) 
                ? saved.lifetimeStats.resourcesMined : 0,
            missionsCompleted: typeof saved.lifetimeStats.missionsCompleted === 'number' && !isNaN(saved.lifetimeStats.missionsCompleted) 
                ? saved.lifetimeStats.missionsCompleted : 0,
            highestRankAchieved: typeof saved.lifetimeStats.highestRankAchieved === 'number' && !isNaN(saved.lifetimeStats.highestRankAchieved) 
                ? saved.lifetimeStats.highestRankAchieved : 9999
        };
    }

    // Logs Migration (New)
    if (Array.isArray(saved.logs)) {
        cleanState.logs = saved.logs;
    } else {
        cleanState.logs = [];
    }

    // Force update version
    cleanState.saveVersion = SAVE_VERSION;
    
    return cleanState;
};
