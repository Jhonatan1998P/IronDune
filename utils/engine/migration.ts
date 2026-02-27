
import { BuildingType, GameState, ResourceType, TechType, UnitType, LogEntry, SpyReport, IncomingAttack, Grudge, WarState, ActiveMission, ActiveRecruitment, ActiveConstruction, ActiveResearch, BuildingState, LifetimeStats, DiplomaticActions, GiftCodeRedeemed, RankingData } from '../../types';
import { SAVE_VERSION, WAR_DURATION_MS, WAR_PLAYER_ATTACKS, WAR_TOTAL_WAVES } from '../../constants';
import { INITIAL_GAME_STATE } from '../../data/initialState';
import { initializeRankingState, RankingCategory, StaticBot, BotEvent } from './rankings';
import { BotPersonality } from '../../types/enums';
import { logMigrationError } from './errorLogger';

// ============================================
// CONFIGURACIÓN Y CONSTANTES DE VALIDACIÓN
// ============================================
const LEGACY_STORAGE_KEY = 'ironDune_static_rankings_v3';
const VALID_PERSONALITIES = Object.values(BotPersonality);
const VALID_BOT_EVENTS = Object.values(BotEvent);
const REQUIRED_RANKING_CATEGORIES = Object.values(RankingCategory);
const VALID_RESOURCE_TYPES = Object.values(ResourceType);
const VALID_UNIT_TYPES = Object.values(UnitType);
const VALID_BUILDING_TYPES = Object.values(BuildingType);
const VALID_TECH_TYPES = Object.values(TechType);
const VALID_LOG_TYPES = ['info', 'combat', 'build', 'research', 'finance', 'mission', 'market', 'tutorial', 'economy', 'war', 'intel'] as const;

const DEFAULT_BOT_STATS: Record<RankingCategory, number> = {
    [RankingCategory.DOMINION]: 1000,
    [RankingCategory.MILITARY]: 500,
    [RankingCategory.ECONOMY]: 10000,
    [RankingCategory.CAMPAIGN]: 1
};

const BOT_SCORE_MIN = 1000;
const BOT_SCORE_MAX = 2000000;
const SUSPICIOUS_SCORE_THRESHOLD = 5000000;

// ============================================
// UTILIDADES DE VALIDACIÓN ROBUSTA
// ============================================

/**
 * Valida que un valor sea un número válido (no NaN, no Infinity)
 */
const isValidNumber = (value: any, min?: number, max?: number): value is number => {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) return false;
    if (min !== undefined && value < min) return false;
    if (max !== undefined && value > max) return false;
    return true;
};

/**
 * Valida que un valor sea un string no vacío
 */
const isValidString = (value: any, minLength = 1, maxLength = Infinity): value is string => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    return trimmed.length >= minLength && trimmed.length <= maxLength;
};

/**
 * Valida que un valor sea un booleano
 */
const isValidBoolean = (value: any): value is boolean => {
    return typeof value === 'boolean';
};

/**
 * Valida que un valor sea un array
 */
const isValidArray = (value: any): value is any[] => {
    return Array.isArray(value);
};

/**
 * Valida que un valor sea un objeto plano (no null, no array)
 */
const isValidObject = (value: any): value is Record<string, any> => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
};

/**
 * Valida que un enum sea válido
 */
const isValidEnum = <T extends string>(value: any, validValues: T[]): value is T => {
    return validValues.includes(value);
};

/**
 * Safe number con fallback
 */
const safeNumber = (value: any, fallback: number, min?: number, max?: number): number => {
    return isValidNumber(value, min, max) ? value : fallback;
};

/**
 * Safe string con fallback
 */
const safeString = (value: any, fallback: string, minLength = 1, maxLength = Infinity): string => {
    return isValidString(value, minLength, maxLength) ? value.trim() : fallback;
};

/**
 * Safe boolean con fallback
 */
const safeBoolean = (value: any, fallback: boolean): boolean => {
    return isValidBoolean(value) ? value : fallback;
};

/**
 * Safe array con fallback
 */
const safeArray = (value: any, fallback: any[]): any[] => {
    return isValidArray(value) ? value : fallback;
};

/**
 * Safe object con fallback
 */
const safeObject = (value: any, fallback: Record<string, any>): Record<string, any> => {
    return isValidObject(value) ? value : fallback;
};

/**
 * Genera un hash simple para validación de integridad
 */
const generateDataHash = (data: any): string => {
    try {
        return btoa(JSON.stringify(data)).slice(0, 20);
    } catch {
        return `hash-${Date.now()}`;
    }
};

// ============================================
// LOGGING DE MIGRACIÓN
// ============================================
const MIGRATION_LOG_PREFIX = '[Migration]';

const logMigration = (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    logFn(`${MIGRATION_LOG_PREFIX} [${timestamp}] ${level.toUpperCase()}: ${message}`, data ?? '');
};

const logFieldMigration = (field: string, status: 'ok' | 'fixed' | 'default' | 'error', details?: string) => {
    if (status === 'error') {
        logMigration('warn', `Field "${field}" migration failed${details ? `: ${details}` : ''}`);
    } else if (status !== 'ok') {
        logMigration('info', `Field "${field}" ${status === 'fixed' ? 'fixed' : 'set to default'}${details ? `: ${details}` : ''}`);
    }
};

// ============================================
// VALIDACIÓN DE INTEGRIDAD DE DATOS
// ============================================
interface MigrationReport {
    success: boolean;
    fieldsFixed: number;
    fieldsDefaulted: number;
    fieldsError: number;
    warnings: string[];
    dataHash: string;
}

const createMigrationReport = (): MigrationReport => ({
    success: true,
    fieldsFixed: 0,
    fieldsDefaulted: 0,
    fieldsError: 0,
    warnings: [],
    dataHash: ''
});

// ============================================
// SANITIZACIÓN DE DATOS ESPECÍFICOS
// ============================================

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

    const rank = safeNumber(bot.lastRank, index + 1, 1, 200);
    const progressiveScore = calculateProgressiveScore(rank);

    if (isValidObject(bot.stats)) {
        REQUIRED_RANKING_CATEGORIES.forEach(cat => {
            const botScore = bot.stats[cat];
            if (isValidNumber(botScore)) {
                if (cat === RankingCategory.DOMINION) {
                    if (botScore === 1000 && rank < 199) {
                        sanitizedStats[cat] = progressiveScore;
                        logFieldMigration(`bot.stats.${cat}`, 'fixed', 'Score reset for low rank');
                    } else if (isSuspiciousScore(botScore)) {
                        sanitizedStats[cat] = progressiveScore;
                        logFieldMigration(`bot.stats.${cat}`, 'fixed', 'Suspicious score detected');
                    } else {
                        sanitizedStats[cat] = botScore;
                        logFieldMigration(`bot.stats.${cat}`, 'ok');
                    }
                } else {
                    sanitizedStats[cat] = botScore;
                    logFieldMigration(`bot.stats.${cat}`, 'ok');
                }
            } else {
                sanitizedStats[cat] = cat === RankingCategory.DOMINION ? progressiveScore : DEFAULT_BOT_STATS[cat];
                logFieldMigration(`bot.stats.${cat}`, 'default', 'Invalid or missing value');
            }
        });
    } else {
        sanitizedStats[RankingCategory.DOMINION] = progressiveScore;
        logFieldMigration('bot.stats', 'default', 'Missing or invalid stats object');
    }

    const personality = isValidEnum(bot.personality, VALID_PERSONALITIES) 
        ? bot.personality 
        : BotPersonality.WARLORD;
    if (personality !== bot.personality) {
        logFieldMigration('bot.personality', 'default', `Invalid personality: ${bot.personality}`);
    }

    const currentEvent = isValidEnum(bot.currentEvent, VALID_BOT_EVENTS)
        ? bot.currentEvent
        : BotEvent.PEACEFUL_PERIOD;
    if (currentEvent !== bot.currentEvent) {
        logFieldMigration('bot.currentEvent', 'default', `Invalid event: ${bot.currentEvent}`);
    }

    return {
        id: safeString(bot.id, `bot-${index}`, 1, 50),
        name: safeString(bot.name, `Bot_${index}`, 1, 50),
        avatarId: safeNumber(bot.avatarId, (index % 8) + 1, 1, 100),
        country: safeString(bot.country, 'US', 2, 3),
        stats: sanitizedStats,
        ambition: safeNumber(bot.ambition, 1.0, 0.1, 10.0),
        personality,
        lastRank: rank,
        currentEvent,
        eventTurnsRemaining: Math.max(0, safeNumber(bot.eventTurnsRemaining, 0, 0, 1000)),
        growthModifier: safeNumber(bot.growthModifier, 0, -100, 100),
        reputation: safeNumber(bot.reputation, 50, 0, 100)
    };
};

export const sanitizeRankingData = (rankingData: any, saveVersion?: number): RankingData => {
    const now = Date.now();

    const FORCE_RANKING_RESET_VERSION = 6;
    const needsReset = !saveVersion || saveVersion < FORCE_RANKING_RESET_VERSION;

    if (needsReset) {
        logMigration('info', `Resetting ranking data (save version: ${saveVersion || 'unknown'}, required: ${FORCE_RANKING_RESET_VERSION})`);
        return initializeRankingState();
    }

    if (!isValidObject(rankingData)) {
        logMigration('warn', 'Invalid ranking data object, initializing fresh');
        return initializeRankingState();
    }

    if (!isValidArray(rankingData.bots) || rankingData.bots.length === 0) {
        logMigration('warn', 'Empty or invalid bots array, initializing fresh');
        return initializeRankingState();
    }

    const sanitizedBots = rankingData.bots
        .filter((bot: any) => isValidObject(bot))
        .map((bot: any, index: number) => sanitizeBot(bot, index));

    if (sanitizedBots.length === 0) {
        logMigration('warn', 'No valid bots after sanitization, initializing fresh');
        return initializeRankingState();
    }

    const lastUpdateTime = safeNumber(rankingData.lastUpdateTime, now, 0);

    logMigration('info', `Successfully sanitized ${sanitizedBots.length} bots`);

    return {
        bots: sanitizedBots,
        lastUpdateTime
    };
};

// ============================================
// MIGRACIÓN DE SISTEMAS ESPECÍFICOS
// ============================================

const migrateResources = (savedResources: any, defaultResources: Record<ResourceType, number>): Record<ResourceType, number> => {
    const resources = { ...defaultResources };
    
    if (!isValidObject(savedResources)) {
        logFieldMigration('resources', 'default', 'Invalid or missing resources object');
        return resources;
    }

    VALID_RESOURCE_TYPES.forEach(type => {
        const savedValue = savedResources[type];
        if (isValidNumber(savedValue, 0)) {
            resources[type] = savedValue;
            logFieldMigration(`resources.${type}`, 'ok');
        } else {
            logFieldMigration(`resources.${type}`, 'default', `Invalid value: ${savedValue}`);
        }
    });

    return resources;
};

const migrateUnits = (savedUnits: any, defaultUnits: Record<UnitType, number>): Record<UnitType, number> => {
    const units = { ...defaultUnits };
    
    if (!isValidObject(savedUnits)) {
        logFieldMigration('units', 'default', 'Invalid or missing units object');
        return units;
    }

    VALID_UNIT_TYPES.forEach(type => {
        const savedValue = savedUnits[type];
        if (isValidNumber(savedValue, 0)) {
            units[type] = savedValue;
            logFieldMigration(`units.${type}`, 'ok');
        } else {
            logFieldMigration(`units.${type}`, 'default', `Invalid value: ${savedValue}`);
        }
    });

    return units;
};

const migrateBuildings = (savedBuildings: any, defaultBuildings: Record<BuildingType, BuildingState>): Record<BuildingType, BuildingState> => {
    const buildings = JSON.parse(JSON.stringify(defaultBuildings));
    
    if (!isValidObject(savedBuildings)) {
        logFieldMigration('buildings', 'default', 'Invalid or missing buildings object');
        return buildings;
    }

    VALID_BUILDING_TYPES.forEach(type => {
        const savedBuilding = savedBuildings[type];
        
        if (isValidObject(savedBuilding)) {
            if (isValidNumber(savedBuilding.level, 0)) {
                buildings[type].level = savedBuilding.level;
                logFieldMigration(`buildings.${type}.level`, 'ok');
            } else {
                logFieldMigration(`buildings.${type}.level`, 'default', `Invalid level: ${savedBuilding.level}`);
            }
            
            if (isValidBoolean(savedBuilding.isDamaged)) {
                buildings[type].isDamaged = savedBuilding.isDamaged;
                logFieldMigration(`buildings.${type}.isDamaged`, 'ok');
            } else {
                buildings[type].isDamaged = false;
                logFieldMigration(`buildings.${type}.isDamaged`, 'default', 'Missing or invalid boolean');
            }
        } else {
            logFieldMigration(`buildings.${type}`, 'default', 'Missing or invalid building object');
        }
    });

    return buildings;
};

const migrateMaxResources = (savedMaxResources: any, defaultMaxResources: Record<ResourceType, number>): Record<ResourceType, number> => {
    const maxResources = { ...defaultMaxResources };
    
    if (!isValidObject(savedMaxResources)) {
        logFieldMigration('maxResources', 'default', 'Invalid or missing maxResources object');
        return maxResources;
    }

    VALID_RESOURCE_TYPES.forEach(type => {
        const savedValue = savedMaxResources[type];
        if (isValidNumber(savedValue, 0)) {
            maxResources[type] = savedValue;
            logFieldMigration(`maxResources.${type}`, 'ok');
        } else {
            logFieldMigration(`maxResources.${type}`, 'default', `Invalid value: ${savedValue}`);
        }
    });

    return maxResources;
};

const migrateIncomingAttacks = (savedAttacks: any): IncomingAttack[] => {
    if (!isValidArray(savedAttacks)) {
        logFieldMigration('incomingAttacks', 'default', 'Invalid or missing array');
        return [];
    }

    const now = Date.now();
    return savedAttacks
        .filter((a: any) => isValidObject(a) && isValidString(a.id) && isValidNumber(a.endTime))
        .map((a: any) => ({
            id: safeString(a.id, `atk-${now}-${Math.random()}`, 1, 100),
            attackerName: safeString(a.attackerName, 'Unknown', 1, 100),
            attackerScore: safeNumber(a.attackerScore, 1000, 0),
            units: isValidObject(a.units) ? a.units : {},
            startTime: safeNumber(a.startTime, now, 0),
            endTime: a.endTime,
            delayCount: safeNumber(a.delayCount, 0, 0, 100),
            isWarWave: safeBoolean(a.isWarWave, false),
            isScouted: safeBoolean(a.isScouted, false)
        }));
};

const migrateGrudges = (savedGrudges: any): Grudge[] => {
    if (!isValidArray(savedGrudges)) {
        logFieldMigration('grudges', 'default', 'Invalid or missing array');
        return [];
    }

    const now = Date.now();
    return savedGrudges
        .filter((g: any) => isValidObject(g))
        .map((g: any) => ({
            id: safeString(g.id, `grudge-${now}`, 1, 100),
            botId: safeString(g.botId, '', 0, 100),
            botName: safeString(g.botName, 'Unknown', 1, 100),
            botPersonality: isValidEnum(g.botPersonality, VALID_PERSONALITIES) 
                ? g.botPersonality 
                : BotPersonality.WARLORD,
            botScore: safeNumber(g.botScore, 1000, 0),
            createdAt: safeNumber(g.createdAt, now, 0),
            retaliationTime: safeNumber(g.retaliationTime, now, 0),
            notified: safeBoolean(g.notified, false)
        }));
};

const migrateSpyReports = (savedReports: any): SpyReport[] => {
    if (!isValidArray(savedReports)) {
        logFieldMigration('spyReports', 'default', 'Invalid or missing array');
        return [];
    }

    const now = Date.now();
    return savedReports
        .filter((s: any) => isValidObject(s) && isValidString(s.id) && isValidString(s.botId) && isValidNumber(s.expiresAt))
        .map((s: any) => ({
            id: safeString(s.id, `spy-${now}-${Math.random()}`, 1, 100),
            botId: safeString(s.botId, '', 0, 100),
            botName: safeString(s.botName, 'Unknown', 1, 100),
            botScore: safeNumber(s.botScore, 1000, 0),
            botPersonality: isValidEnum(s.botPersonality, VALID_PERSONALITIES) 
                ? s.botPersonality 
                : BotPersonality.WARLORD,
            createdAt: safeNumber(s.createdAt, now, 0),
            expiresAt: s.expiresAt,
            units: isValidObject(s.units) ? s.units : {},
            resources: isValidObject(s.resources) ? s.resources : {},
            buildings: isValidObject(s.buildings) ? s.buildings : {}
        }));
};

const migrateActiveMissions = (savedMissions: any): ActiveMission[] => {
    if (!isValidArray(savedMissions)) {
        logFieldMigration('activeMissions', 'default', 'Invalid or missing array');
        return [];
    }

    const now = Date.now();
    return savedMissions
        .filter((m: any) => isValidObject(m) && isValidString(m.id) && isValidNumber(m.endTime) && isValidObject(m.units))
        .map((m: any) => ({
            id: safeString(m.id, `mission-${now}-${Math.random()}`, 1, 100),
            type: isValidEnum(m.type, ['PATROL', 'CAMPAIGN_ATTACK', 'PVP_ATTACK']) ? m.type : 'PATROL',
            startTime: safeNumber(m.startTime, now, 0),
            endTime: m.endTime,
            duration: safeNumber(m.duration, 5, 1, 120),
            units: m.units || {},
            levelId: safeNumber(m.levelId, undefined as any, 1),
            targetId: safeString(m.targetId, '', 0, 100),
            targetName: safeString(m.targetName, '', 0, 100),
            targetScore: safeNumber(m.targetScore, 1000, 0),
            isWarAttack: safeBoolean(m.isWarAttack, false)
        }));
};

const migrateWarState = (savedWar: any): WarState | null => {
    if (!isValidObject(savedWar)) {
        logFieldMigration('activeWar', 'default', 'Invalid or missing war object');
        return null;
    }

    const now = Date.now();
    const sanitizeWarResources = (res: any): Record<ResourceType, number> => {
        if (!isValidObject(res)) return {
            [ResourceType.MONEY]: 0,
            [ResourceType.OIL]: 0,
            [ResourceType.AMMO]: 0,
            [ResourceType.GOLD]: 0,
            [ResourceType.DIAMOND]: 0
        };
        
        return {
            [ResourceType.MONEY]: safeNumber(res[ResourceType.MONEY], 0, 0),
            [ResourceType.OIL]: safeNumber(res[ResourceType.OIL], 0, 0),
            [ResourceType.AMMO]: safeNumber(res[ResourceType.AMMO], 0, 0),
            [ResourceType.GOLD]: safeNumber(res[ResourceType.GOLD], 0, 0),
            [ResourceType.DIAMOND]: safeNumber(res[ResourceType.DIAMOND], 0, 0)
        };
    };

    const duration = safeNumber(savedWar.duration, WAR_DURATION_MS, 0);
    const totalWaves = safeNumber(savedWar.totalWaves, WAR_TOTAL_WAVES, 1, 20);
    const playerAttacksLeft = safeNumber(savedWar.playerAttacksLeft, WAR_PLAYER_ATTACKS, 0, 20);

    return {
        id: safeString(savedWar.id, `war-${now}`, 1, 100),
        enemyId: safeString(savedWar.enemyId, '', 0, 100),
        enemyName: safeString(savedWar.enemyName, 'Unknown Enemy', 1, 100),
        enemyScore: safeNumber(savedWar.enemyScore, 1000, 0),
        startTime: safeNumber(savedWar.startTime, now, 0),
        duration: duration !== WAR_DURATION_MS ? duration : WAR_DURATION_MS,
        nextWaveTime: safeNumber(savedWar.nextWaveTime, now, 0),
        currentWave: safeNumber(savedWar.currentWave, 1, 1, 20),
        totalWaves: totalWaves !== WAR_TOTAL_WAVES ? totalWaves : WAR_TOTAL_WAVES,
        playerVictories: safeNumber(savedWar.playerVictories, 0, 0, 20),
        enemyVictories: safeNumber(savedWar.enemyVictories, 0, 0, 20),
        playerAttacksLeft: playerAttacksLeft !== WAR_PLAYER_ATTACKS ? playerAttacksLeft : WAR_PLAYER_ATTACKS,
        lootPool: sanitizeWarResources(savedWar.lootPool),
        playerResourceLosses: sanitizeWarResources(savedWar.playerResourceLosses),
        enemyResourceLosses: sanitizeWarResources(savedWar.enemyResourceLosses),
        playerUnitLosses: safeNumber(savedWar.playerUnitLosses, 0, 0),
        enemyUnitLosses: safeNumber(savedWar.enemyUnitLosses, 0, 0),
        currentEnemyGarrison: isValidObject(savedWar.currentEnemyGarrison) ? savedWar.currentEnemyGarrison : {}
    };
};

const migrateLifetimeStats = (savedStats: any): LifetimeStats => {
    const defaultStats: LifetimeStats = {
        enemiesKilled: 0,
        unitsLost: 0,
        resourcesMined: 0,
        missionsCompleted: 0,
        highestRankAchieved: 9999
    };

    if (!isValidObject(savedStats)) {
        logFieldMigration('lifetimeStats', 'default', 'Invalid or missing object');
        return defaultStats;
    }

    return {
        enemiesKilled: safeNumber(savedStats.enemiesKilled, 0, 0),
        unitsLost: safeNumber(savedStats.unitsLost, 0, 0),
        resourcesMined: safeNumber(savedStats.resourcesMined, 0, 0),
        missionsCompleted: safeNumber(savedStats.missionsCompleted, 0, 0),
        highestRankAchieved: safeNumber(savedStats.highestRankAchieved, 9999, 1, 99999)
    };
};

const migrateDiplomaticActions = (savedActions: any): DiplomaticActions => {
    if (!isValidObject(savedActions)) {
        logFieldMigration('diplomaticActions', 'default', 'Invalid or missing object');
        return {};
    }

    const actions: DiplomaticActions = {};
    const now = Date.now();

    Object.entries(savedActions).forEach(([botId, data]) => {
        if (isValidObject(data)) {
            actions[botId] = {
                lastGiftTime: safeNumber((data as any).lastGiftTime, 0, 0),
                lastAllianceTime: safeNumber((data as any).lastAllianceTime, 0, 0),
                lastPeaceTime: safeNumber((data as any).lastPeaceTime, 0, 0)
            };
        }
    });

    return actions;
};

const migrateLogs = (savedLogs: any): LogEntry[] => {
    if (!isValidArray(savedLogs)) {
        logFieldMigration('logs', 'default', 'Invalid or missing array');
        return [];
    }

    const now = Date.now();
    return savedLogs
        .filter((log: any) => isValidObject(log) && isValidString(log.id) && isValidNumber(log.timestamp))
        .map((log: any) => ({
            id: safeString(log.id, `log-${now}-${Math.random()}`, 1, 100),
            messageKey: safeString(log.messageKey, 'unknown', 1, 200),
            params: isValidObject(log.params) ? log.params : {},
            timestamp: log.timestamp,
            type: isValidEnum(log.type, VALID_LOG_TYPES) ? log.type : 'info',
            archived: safeBoolean(log.archived, false)
        }));
};

export const sanitizeAndMigrateSave = (saved: any, savedDataForLogging?: any): GameState => {
    const report = createMigrationReport();
    const now = Date.now();
    
    // 1. Deep Clone Initial State to ensure full structure exists
    const cleanState: GameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));

    if (!saved) {
        logMigration('info', 'No saved data found, returning initial state');
        cleanState.saveVersion = SAVE_VERSION;
        return cleanState;
    }

    try {
        // 2. Migrate Save Version
        const savedVersion = safeNumber(saved.saveVersion, 0, 0);
        logMigration('info', `Migrating from save version: ${savedVersion}`);

        // 3. Migrate Primitives
        cleanState.playerName = safeString(saved.playerName, 'Commander', 2, 20);
        cleanState.hasChangedName = safeBoolean(saved.hasChangedName, false);
        cleanState.bankBalance = safeNumber(saved.bankBalance, 0, 0);
        cleanState.currentInterestRate = safeNumber(saved.currentInterestRate, 0.05, 0, 1);
        cleanState.nextRateChangeTime = safeNumber(saved.nextRateChangeTime, now, 0);
        cleanState.lastInterestPayoutTime = safeNumber(saved.lastInterestPayoutTime, now, 0);
        cleanState.empirePoints = safeNumber(saved.empirePoints, 0, 0);
        cleanState.lastSaveTime = safeNumber(saved.lastSaveTime, now, 0);
        cleanState.lastReputationDecayTime = safeNumber(saved.lastReputationDecayTime, now, 0);
        cleanState.campaignProgress = safeNumber(saved.campaignProgress, 1, 1);
        cleanState.lastCampaignMissionFinishedTime = safeNumber(saved.lastCampaignMissionFinishedTime, 0, 0);
        cleanState.isTutorialMinimized = safeBoolean(saved.isTutorialMinimized, false);
        cleanState.tutorialAccepted = safeBoolean(saved.tutorialAccepted, false);
        cleanState.nextAttackTime = safeNumber(saved.nextAttackTime, now + (3 * 60 * 60 * 1000), 0);

        // 4. Migrate Complex Systems using helper functions
        cleanState.incomingAttacks = migrateIncomingAttacks(saved.incomingAttacks);
        cleanState.grudges = migrateGrudges(saved.grudges);
        cleanState.spyReports = migrateSpyReports(saved.spyReports);
        cleanState.activeMissions = migrateActiveMissions(saved.activeMissions);
        cleanState.activeWar = migrateWarState(saved.activeWar);
        cleanState.lifetimeStats = migrateLifetimeStats(saved.lifetimeStats);
        cleanState.diplomaticActions = migrateDiplomaticActions(saved.diplomaticActions);
        cleanState.logs = migrateLogs(saved.logs);

        // 5. Migrate Resources, Units, Buildings
        cleanState.resources = migrateResources(saved.resources, INITIAL_GAME_STATE.resources);
        cleanState.maxResources = migrateMaxResources(saved.maxResources, INITIAL_GAME_STATE.maxResources);
        cleanState.units = migrateUnits(saved.units, INITIAL_GAME_STATE.units);
        cleanState.buildings = migrateBuildings(saved.buildings, INITIAL_GAME_STATE.buildings);

        // 6. Enemy Attack System
        cleanState.enemyAttackCounts = isValidObject(saved.enemyAttackCounts) ? saved.enemyAttackCounts : {};
        cleanState.lastEnemyAttackCheckTime = safeNumber(saved.lastEnemyAttackCheckTime, now, 0);
        cleanState.lastEnemyAttackResetTime = safeNumber(saved.lastEnemyAttackResetTime, now, 0);

        // 7. Attack Counts
        cleanState.targetAttackCounts = isValidObject(saved.targetAttackCounts) ? saved.targetAttackCounts : {};
        cleanState.lastAttackResetTime = safeNumber(saved.lastAttackResetTime, now, 0);

        // 8. Techs
        if (isValidArray(saved.researchedTechs)) {
            cleanState.researchedTechs = saved.researchedTechs.filter((id: string) => 
                VALID_TECH_TYPES.includes(id as TechType)
            );
        }
        cleanState.techLevels = isValidObject(saved.techLevels) ? saved.techLevels : {};
        cleanState.activeResearch = isValidObject(saved.activeResearch) ? saved.activeResearch : null;

        // 9. Active Recruitments & Constructions
        cleanState.activeRecruitments = isValidArray(saved.activeRecruitments) ? saved.activeRecruitments : [];
        cleanState.activeConstructions = isValidArray(saved.activeConstructions) ? saved.activeConstructions : [];

        // 10. Market
        cleanState.marketOffers = isValidArray(saved.marketOffers) ? saved.marketOffers : [];
        cleanState.activeMarketEvent = isValidObject(saved.activeMarketEvent) ? saved.activeMarketEvent : null;
        cleanState.marketNextRefreshTime = safeNumber(saved.marketNextRefreshTime, now, 0);

        // 11. Tutorial State
        cleanState.completedTutorials = isValidArray(saved.completedTutorials) ? saved.completedTutorials : [];
        cleanState.currentTutorialId = isValidString(saved.currentTutorialId) ? saved.currentTutorialId : null;
        cleanState.tutorialClaimable = safeBoolean(saved.tutorialClaimable, false);

        // 12. Rankings
        cleanState.rankingData = sanitizeRankingData(saved.rankingData, savedVersion);

        // 13. Gift Codes
        cleanState.redeemedGiftCodes = isValidArray(saved.redeemedGiftCodes) ? saved.redeemedGiftCodes : [];
        cleanState.giftCodeCooldowns = isValidObject(saved.giftCodeCooldowns) ? saved.giftCodeCooldowns : {};

        // 14. CRITICAL FIX: Ensure Diamond Mine is at least Level 1
        if (cleanState.buildings[BuildingType.DIAMOND_MINE].level < 1) {
            cleanState.buildings[BuildingType.DIAMOND_MINE] = {
                level: 1,
                isDamaged: cleanState.buildings[BuildingType.DIAMOND_MINE].isDamaged || false
            };
            logFieldMigration('buildings.DIAMOND_MINE.level', 'fixed', 'Ensured minimum level 1');
        }

        // 15. Ensure all building states have proper structure
        Object.keys(cleanState.buildings).forEach((key) => {
            const k = key as BuildingType;
            if (typeof cleanState.buildings[k].isDamaged !== 'boolean') {
                cleanState.buildings[k] = { ...cleanState.buildings[k], isDamaged: false };
            }
        });

        // 16. Force update version
        cleanState.saveVersion = SAVE_VERSION;

        // 17. Generate data hash for integrity verification
        report.dataHash = generateDataHash({
            resources: cleanState.resources,
            buildings: Object.keys(cleanState.buildings).length,
            units: cleanState.units,
            version: cleanState.saveVersion
        });

        logMigration('info', `Migration completed successfully. Hash: ${report.dataHash}`);

    } catch (error) {
        logMigration('error', `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        report.success = false;
        report.fieldsError++;
        
        // Log detailed error information
        logMigrationError({
            error,
            location: { file: 'utils/engine/migration.ts', function: 'sanitizeAndMigrateSave' },
            saveVersion: saved?.saveVersion,
            migrationStage: 'Full save migration',
            savedData: savedDataForLogging || saved,
            recoveryAction: 'Returned safe initial state to prevent application crash. All game data has been reset to default values.',
            suggestions: [
                'Try clearing browser localStorage using: localStorage.clear() in browser console, then start a new game',
                'Check if the save file was manually modified or corrupted during export/import',
                'Ensure your browser is up to date (Chrome, Firefox, Safari, Edge latest versions supported)',
                'Try importing the save file again using the import function',
                'If using a backup save, try an older backup from before the issue started',
                'Disable browser extensions that might interfere with localStorage',
                'Try a different browser to isolate the issue',
                'Contact support with the attached err.log file for detailed analysis'
            ]
        });
        
        // Return safe initial state on critical error
        return { ...INITIAL_GAME_STATE, saveVersion: SAVE_VERSION };
    }

    return cleanState;
};

// ============================================
// EXPORTS PARA TESTING
// ============================================
export {
    isValidNumber,
    isValidString,
    isValidBoolean,
    isValidArray,
    isValidObject,
    isValidEnum,
    safeNumber,
    safeString,
    safeBoolean,
    safeArray,
    safeObject,
    migrateResources,
    migrateUnits,
    migrateBuildings,
    migrateLogs,
    migrateWarState,
    migrateLifetimeStats
};
