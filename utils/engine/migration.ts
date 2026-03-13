
import { BuildingType, GameState, ResourceType, TechType, UnitType, LogEntry, SpyReport, IncomingAttack, Grudge, WarState, ActiveMission, BuildingState, RankingData, LifetimeStats, DiplomaticActions } from '../../types';
import { SAVE_VERSION, WAR_DURATION_MS, WAR_PLAYER_ATTACKS, WAR_TOTAL_WAVES } from '../../constants';
import { INITIAL_GAME_STATE } from '../../data/initialState';
import { initializeRankingState, RankingCategory, StaticBot, BotEvent } from './rankings';
import { BotPersonality } from '../../types/enums';
import { logMigrationError } from './errorLogger';

// ============================================
// CONFIGURACIÓN Y CONSTANTES DE VALIDACIÓN
// ============================================
const VALID_PERSONALITIES = Object.values(BotPersonality);
const VALID_BOT_EVENTS = Object.values(BotEvent);
const REQUIRED_RANKING_CATEGORIES = Object.values(RankingCategory);
const VALID_RESOURCE_TYPES = Object.values(ResourceType);
const VALID_UNIT_TYPES = Object.values(UnitType);
const VALID_BUILDING_TYPES = Object.values(BuildingType);
const VALID_TECH_TYPES = Object.values(TechType);
const VALID_LOG_TYPES = ['info', 'combat', 'build', 'research', 'finance', 'mission', 'market', 'tutorial', 'economy', 'war', 'intel'] as const;

// ============================================
// CONSTANTES PARA VALIDACIÓN DE RECURSOS
// ============================================
// Límites máximos razonables para recursos (basados en producción máxima posible)
// Estos valores son MUY por encima de lo normal para no afectar jugadores legítimos
const MAX_REASONABLE_RESOURCES: Record<ResourceType, number> = {
    [ResourceType.MONEY]: 10_000_000_000,      // 10 billones (máximo razonable con overflow)
    [ResourceType.OIL]: 500_000_000,           // 500 millones
    [ResourceType.AMMO]: 100_000_000,          // 100 millones
    [ResourceType.GOLD]: 50_000_000,           // 50 millones
    [ResourceType.DIAMOND]: 100_000            // 100 mil (extremadamente raro)
};

// Factor máximo de overflow permitido (recursos sobre el cap = cap * OVERFLOW_FACTOR)
// const OVERFLOW_FACTOR = 10; // Permitir hasta 10x el cap máximo como overflow legítimo

const DEFAULT_BOT_STATS: Record<RankingCategory, number> = {
    [RankingCategory.DOMINION]: 1000,
    [RankingCategory.MILITARY]: 500,
    [RankingCategory.ECONOMY]: 10000,
    [RankingCategory.CAMPAIGN]: 1
};

// Score limits - aligned with rankings.ts to allow unlimited growth
const BOT_SCORE_MAX = Number.MAX_SAFE_INTEGER; // Allow unlimited growth

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
 * Safe string que puede ser null
 */
const safeStringOrNull = (value: any): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    return null;
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

const logFieldMigration = (field: string, status: 'ok' | 'fixed' | 'default' | 'error', details?: string, silent: boolean = false) => {
    if (status === 'error') {
        logMigration('warn', `Field "${field}" migration failed${details ? `: ${details}` : ''}`);
    } else if (status !== 'ok' && !silent) {
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

const calculateProgressiveScore = (rank: number): number => {
    const minScore = 1000;
    const maxScore = BOT_SCORE_MAX; // Now uses Number.MAX_SAFE_INTEGER for unlimited growth
    const posRatio = Math.max(0, Math.min(1, (199 - rank) / 198));
    return Math.floor(minScore + posRatio * (maxScore - minScore));
};

export const sanitizeBot = (bot: any, index: number, silent: boolean = false): StaticBot => {
    const sanitizedStats = { ...DEFAULT_BOT_STATS };

    const rank = safeNumber(bot.lastRank, index + 1, 1, 200);
    const progressiveScore = calculateProgressiveScore(rank);

    if (isValidObject(bot.stats)) {
        REQUIRED_RANKING_CATEGORIES.forEach(cat => {
            const botScore = bot.stats[cat];
            if (isValidNumber(botScore, 0)) {
                // Valid score - keep it as is (no artificial caps)
                sanitizedStats[cat] = botScore;
                logFieldMigration(`bot.stats.${cat}`, 'ok', undefined, silent);
            } else {
                // Invalid score (NaN, negative, missing) - use progressive score based on rank
                sanitizedStats[cat] = progressiveScore;
                logFieldMigration(`bot.stats.${cat}`, 'default', 'Invalid or missing value', silent);
            }
        });
    } else {
        sanitizedStats[RankingCategory.DOMINION] = progressiveScore;
        logFieldMigration('bot.stats', 'default', 'Missing or invalid stats object', silent);
    }

    const personality = isValidEnum(bot.personality, VALID_PERSONALITIES) 
        ? bot.personality 
        : BotPersonality.WARLORD;
    if (personality !== bot.personality) {
        logFieldMigration('bot.personality', 'default', `Invalid personality: ${bot.personality}`, silent);
    }

    const currentEvent = isValidEnum(bot.currentEvent, VALID_BOT_EVENTS)
        ? bot.currentEvent
        : BotEvent.PEACEFUL_PERIOD;
    if (currentEvent !== bot.currentEvent) {
        logFieldMigration('bot.currentEvent', 'default', `Invalid event: ${bot.currentEvent}`, silent);
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

export const sanitizeRankingData = (rankingData: any, saveVersion?: number, silent: boolean = false): RankingData => {
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
        .map((bot: any, index: number) => sanitizeBot(bot, index, silent));

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

/**
 * CRITICAL FIX: Validates and caps inflated resources to prevent absurd resource amounts
 * This function runs on EVERY load/import to catch corruption and exploitation
 * Returns true if any resources were capped
 */
const validateAndCapInflatedResources = (resources: Record<ResourceType, number>, silent: boolean = false): boolean => {
    let fixed = false;

    VALID_RESOURCE_TYPES.forEach(type => {
        const currentValue = resources[type];
        const maxValue = MAX_REASONABLE_RESOURCES[type];

        if (isValidNumber(currentValue, 0) && currentValue > maxValue) {
            resources[type] = maxValue;
            logFieldMigration(`resources.${type}`, 'fixed', `Inflated value ${currentValue} capped to ${maxValue}`, silent);
            fixed = true;
        }
    });

    return fixed;
};

const migrateResources = (savedResources: any, defaultResources: Record<ResourceType, number>, silent: boolean = false): Record<ResourceType, number> => {
    const resources = { ...defaultResources };

    if (!isValidObject(savedResources)) {
        logFieldMigration('resources', 'default', 'Invalid or missing resources object', silent);
        return resources;
    }

    VALID_RESOURCE_TYPES.forEach(type => {
        const savedValue = savedResources[type];
        if (isValidNumber(savedValue, 0)) {
            // CRITICAL FIX: Detect and cap inflated resources
            const maxValue = MAX_REASONABLE_RESOURCES[type];
            if (savedValue > maxValue) {
                resources[type] = maxValue;
                logFieldMigration(`resources.${type}`, 'fixed', `Inflated value ${savedValue} capped to ${maxValue}`, silent);
            } else {
                resources[type] = savedValue;
                logFieldMigration(`resources.${type}`, 'ok', undefined, silent);
            }
        } else {
            logFieldMigration(`resources.${type}`, 'default', `Invalid value: ${savedValue}`, silent);
        }
    });

    return resources;
};

const migrateUnits = (savedUnits: any, defaultUnits: Record<UnitType, number>, silent: boolean = false): Record<UnitType, number> => {
    const units = { ...defaultUnits };
    
    if (!isValidObject(savedUnits)) {
        logFieldMigration('units', 'default', 'Invalid or missing units object', silent);
        return units;
    }

    VALID_UNIT_TYPES.forEach(type => {
        const savedValue = savedUnits[type];
        if (isValidNumber(savedValue, 0)) {
            units[type] = savedValue;
            logFieldMigration(`units.${type}`, 'ok', undefined, silent);
        } else {
            logFieldMigration(`units.${type}`, 'default', `Invalid value: ${savedValue}`, silent);
        }
    });

    return units;
};

const migrateBuildings = (savedBuildings: any, defaultBuildings: Record<BuildingType, BuildingState>, silent: boolean = false): Record<BuildingType, BuildingState> => {
    const buildings = JSON.parse(JSON.stringify(defaultBuildings));
    
    if (!isValidObject(savedBuildings)) {
        logFieldMigration('buildings', 'default', 'Invalid or missing buildings object', silent);
        return buildings;
    }

    VALID_BUILDING_TYPES.forEach(type => {
        const savedBuilding = savedBuildings[type];
        
        if (isValidObject(savedBuilding)) {
            if (isValidNumber(savedBuilding.level, 0)) {
                buildings[type].level = savedBuilding.level;
                logFieldMigration(`buildings.${type}.level`, 'ok', undefined, silent);
            } else {
                logFieldMigration(`buildings.${type}.level`, 'default', `Invalid level: ${savedBuilding.level}`, silent);
            }
            
            if (isValidBoolean(savedBuilding.isDamaged)) {
                buildings[type].isDamaged = savedBuilding.isDamaged;
                logFieldMigration(`buildings.${type}.isDamaged`, 'ok', undefined, silent);
            } else {
                buildings[type].isDamaged = false;
                logFieldMigration(`buildings.${type}.isDamaged`, 'default', 'Missing or invalid boolean', silent);
            }
        } else {
            logFieldMigration(`buildings.${type}`, 'default', 'Missing or invalid building object', silent);
        }
    });

    return buildings;
};

const migrateMaxResources = (savedMaxResources: any, defaultMaxResources: Record<ResourceType, number>, silent: boolean = false): Record<ResourceType, number> => {
    const maxResources = { ...defaultMaxResources };
    
    if (!isValidObject(savedMaxResources)) {
        logFieldMigration('maxResources', 'default', 'Invalid or missing maxResources object', silent);
        return maxResources;
    }

    VALID_RESOURCE_TYPES.forEach(type => {
        const savedValue = savedMaxResources[type];
        if (isValidNumber(savedValue, 0)) {
            maxResources[type] = savedValue;
            logFieldMigration(`maxResources.${type}`, 'ok', undefined, silent);
        } else {
            logFieldMigration(`maxResources.${type}`, 'default', `Invalid value: ${savedValue}`, silent);
        }
    });

    return maxResources;
};

const migrateIncomingAttacks = (savedAttacks: any, silent: boolean = false): IncomingAttack[] => {
    if (!isValidArray(savedAttacks)) {
        logFieldMigration('incomingAttacks', 'default', 'Invalid or missing array', silent);
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

const migrateGrudges = (savedGrudges: any, silent: boolean = false): Grudge[] => {
    if (!isValidArray(savedGrudges)) {
        logFieldMigration('grudges', 'default', 'Invalid or missing array', silent);
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

const migrateSpyReports = (savedReports: any, silent: boolean = false): SpyReport[] => {
    if (!isValidArray(savedReports)) {
        logFieldMigration('spyReports', 'default', 'Invalid or missing array', silent);
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

const migrateActiveMissions = (savedMissions: any, silent: boolean = false): ActiveMission[] => {
    if (!isValidArray(savedMissions)) {
        logFieldMigration('activeMissions', 'default', 'Invalid or missing array', silent);
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

const migrateWarState = (savedWar: any, silent: boolean = false): WarState | null => {
    if (savedWar === null || savedWar === undefined) return null;
    if (!isValidObject(savedWar)) {
        logFieldMigration('activeWar', 'default', 'Invalid or missing war object', silent);
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
        warLogisticLootIds: Array.isArray(savedWar.warLogisticLootIds) ? savedWar.warLogisticLootIds : [],
        totalLogisticLootGenerated: sanitizeWarResources(savedWar.totalLogisticLootGenerated || savedWar.lootPool),
        logisticLootHarvestedDuringWar: sanitizeWarResources(savedWar.logisticLootHarvestedDuringWar),
        playerResourceLosses: sanitizeWarResources(savedWar.playerResourceLosses),
        enemyResourceLosses: sanitizeWarResources(savedWar.enemyResourceLosses),
        playerUnitLosses: safeNumber(savedWar.playerUnitLosses, 0, 0),
        enemyUnitLosses: safeNumber(savedWar.enemyUnitLosses, 0, 0),
        currentEnemyGarrison: isValidObject(savedWar.currentEnemyGarrison) ? savedWar.currentEnemyGarrison : {},
        lootPool: sanitizeWarResources(savedWar.lootPool)
    };
};

const migrateLifetimeStats = (savedStats: any, silent: boolean = false): LifetimeStats => {
    const defaultStats: LifetimeStats = {
        enemiesKilled: 0,
        unitsLost: 0,
        resourcesMined: 0,
        missionsCompleted: 0,
        highestRankAchieved: 9999,
        battlesWon: 0,
        battlesLost: 0
    };

    if (!isValidObject(savedStats)) {
        logFieldMigration('lifetimeStats', 'default', 'Invalid or missing object', silent);
        return defaultStats;
    }

    return {
        enemiesKilled: safeNumber(savedStats.enemiesKilled, 0, 0),
        unitsLost: safeNumber(savedStats.unitsLost, 0, 0),
        resourcesMined: safeNumber(savedStats.resourcesMined, 0, 0),
        missionsCompleted: safeNumber(savedStats.missionsCompleted, 0, 0),
        highestRankAchieved: safeNumber(savedStats.highestRankAchieved, 9999, 1, 99999),
        battlesWon: safeNumber(savedStats.battlesWon, 0, 0),
        battlesLost: safeNumber(savedStats.battlesLost, 0, 0)
    };
};

const migrateDiplomaticActions = (savedActions: any, silent: boolean = false): DiplomaticActions => {
    if (!isValidObject(savedActions)) {
        logFieldMigration('diplomaticActions', 'default', 'Invalid or missing object', silent);
        return {};
    }

    const actions: DiplomaticActions = {};

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

const migrateLogs = (savedLogs: any, silent: boolean = false): LogEntry[] => {
    if (!isValidArray(savedLogs)) {
        logFieldMigration('logs', 'default', 'Invalid or missing array', silent);
        return [];
    }

    const now = Date.now();
    const validLogTypes = [...VALID_LOG_TYPES];

    return savedLogs
        .filter((log: any) => isValidObject(log) && isValidString(log.id) && isValidNumber(log.timestamp))
        .map((log: any) => ({
            id: safeString(log.id, `log-${now}-${Math.random()}`, 1, 100),
            messageKey: safeString(log.messageKey, 'unknown', 1, 200),
            params: isValidObject(log.params) ? log.params : {},
            timestamp: log.timestamp,
            type: isValidEnum(log.type, validLogTypes) ? log.type : 'info',
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
        // 2. Get Save Version - CRITICAL: Only migrate if version changed
        const savedVersion = safeNumber(saved.saveVersion, 0, 0);
        const versionChanged = savedVersion !== SAVE_VERSION;
        
        if (versionChanged) {
            logMigration('info', `VERSION CHANGE DETECTED: Migrating from version ${savedVersion} to ${SAVE_VERSION}`);
        }
        // Logs eliminados para evitar spam cuando la versión es la misma y no hay cambios críticos

        const silent = !versionChanged;

        // 3. CONDITIONAL MIGRATION: Only migrate data if version changed
        if (versionChanged) {
            // 3A. Migrate Primitives (only on version change)
            cleanState.playerName = safeString(saved.playerName, 'Commander', 2, 20);
            cleanState.playerFlag = safeStringOrNull(saved.playerFlag) || undefined;
            cleanState.peerId = safeStringOrNull(saved.peerId);
            cleanState.hasChangedName = safeBoolean(saved.hasChangedName, false);
            cleanState.bankBalance = safeNumber(saved.bankBalance, 0, 0);
            cleanState.currentInterestRate = safeNumber(saved.currentInterestRate, 0.05, 0, 1);
            cleanState.nextRateChangeTime = safeNumber(saved.nextRateChangeTime, now, 0);
            cleanState.lastInterestPayoutTime = safeNumber(saved.lastInterestPayoutTime, now, 0);
            cleanState.empirePoints = safeNumber(saved.empirePoints, 0, 0);
            // CRITICAL FIX: Handle corrupted timestamps (0 or invalid)
            cleanState.lastSaveTime = safeNumber(saved.lastSaveTime, now, 1); // Min 1 to reject 0
            cleanState.lastReputationDecayTime = safeNumber(saved.lastReputationDecayTime, now, 1);
            cleanState.campaignProgress = safeNumber(saved.campaignProgress, 1, 1);
            cleanState.lastCampaignMissionFinishedTime = safeNumber(saved.lastCampaignMissionFinishedTime, 0, 0);
            cleanState.isTutorialMinimized = safeBoolean(saved.isTutorialMinimized, false);
            cleanState.tutorialAccepted = safeBoolean(saved.tutorialAccepted, false);
            cleanState.nextAttackTime = safeNumber(saved.nextAttackTime, now + (3 * 60 * 60 * 1000), 0);

            // 3B. Migrate Complex Systems using helper functions (only on version change)
            cleanState.incomingAttacks = migrateIncomingAttacks(saved.incomingAttacks, silent);
            cleanState.grudges = migrateGrudges(saved.grudges, silent);
            cleanState.spyReports = migrateSpyReports(saved.spyReports, silent);
            cleanState.activeMissions = migrateActiveMissions(saved.activeMissions, silent);
            cleanState.activeWar = migrateWarState(saved.activeWar, silent);
            cleanState.lifetimeStats = migrateLifetimeStats(saved.lifetimeStats, silent);
            cleanState.diplomaticActions = migrateDiplomaticActions(saved.diplomaticActions, silent);
            cleanState.reputationHistory = isValidObject(saved.reputationHistory) ? saved.reputationHistory : {};
            cleanState.interactionRecords = isValidObject(saved.interactionRecords) ? saved.interactionRecords : {};
            cleanState.logs = migrateLogs(saved.logs, silent);
            cleanState.allyReinforcements = isValidArray(saved.allyReinforcements) ? saved.allyReinforcements : [];

            // 3C. Migrate Resources, Units, Buildings (only on version change)
            cleanState.resources = migrateResources(saved.resources, INITIAL_GAME_STATE.resources, silent);
            cleanState.maxResources = migrateMaxResources(saved.maxResources, INITIAL_GAME_STATE.maxResources, silent);
            cleanState.units = migrateUnits(saved.units, INITIAL_GAME_STATE.units, silent);
            cleanState.buildings = migrateBuildings(saved.buildings, INITIAL_GAME_STATE.buildings, silent);

            // 3D. Enemy Attack System (only on version change)
            cleanState.enemyAttackCounts = isValidObject(saved.enemyAttackCounts) ? saved.enemyAttackCounts : {};
            cleanState.lastEnemyAttackCheckTime = safeNumber(saved.lastEnemyAttackCheckTime, now, 0);
            cleanState.lastEnemyAttackResetTime = safeNumber(saved.lastEnemyAttackResetTime, now, 0);

            // 3E. Attack Counts (only on version change)
            cleanState.targetAttackCounts = isValidObject(saved.targetAttackCounts) ? saved.targetAttackCounts : {};
            cleanState.lastAttackResetTime = safeNumber(saved.lastAttackResetTime, now, 0);

            // 3F. Techs (only on version change)
            if (isValidArray(saved.researchedTechs)) {
                cleanState.researchedTechs = saved.researchedTechs.filter((id: string) => 
                    VALID_TECH_TYPES.includes(id as TechType)
                );
            }
            cleanState.techLevels = isValidObject(saved.techLevels) ? saved.techLevels : {};
            cleanState.activeResearch = isValidObject(saved.activeResearch) ? saved.activeResearch : null;

            // 3G. Active Recruitments & Constructions (only on version change)
            cleanState.activeRecruitments = isValidArray(saved.activeRecruitments) ? saved.activeRecruitments : [];
            cleanState.activeConstructions = isValidArray(saved.activeConstructions) ? saved.activeConstructions : [];

            // 3H. Market (only on version change)
            cleanState.marketOffers = isValidArray(saved.marketOffers) ? saved.marketOffers : [];
            cleanState.activeMarketEvent = isValidObject(saved.activeMarketEvent) ? saved.activeMarketEvent : null;
            cleanState.marketNextRefreshTime = safeNumber(saved.marketNextRefreshTime, now, 0);

            // 3I. Tutorial State (only on version change)
            cleanState.completedTutorials = isValidArray(saved.completedTutorials) ? saved.completedTutorials : [];
            cleanState.currentTutorialId = isValidString(saved.currentTutorialId) ? saved.currentTutorialId : null;
            cleanState.tutorialClaimable = safeBoolean(saved.tutorialClaimable, false);

            // 3J. Rankings (only on version change)
            cleanState.rankingData = sanitizeRankingData(saved.rankingData, savedVersion, silent);

            // 3K. Gift Codes (only on version change)
            cleanState.redeemedGiftCodes = isValidArray(saved.redeemedGiftCodes) ? saved.redeemedGiftCodes : [];
            cleanState.giftCodeCooldowns = isValidObject(saved.giftCodeCooldowns) ? saved.giftCodeCooldowns : {};

            // 3L. Logistic Loot System (v7) (only on version change)
            cleanState.logisticLootFields = isValidArray(saved.logisticLootFields) ? saved.logisticLootFields : [];
            cleanState.visibleLogisticLootFields = isValidArray(saved.visibleLogisticLootFields) ? saved.visibleLogisticLootFields : [];
            cleanState.lifetimeLogisticStats = isValidObject(saved.lifetimeLogisticStats) 
                ? saved.lifetimeLogisticStats 
                : INITIAL_GAME_STATE.lifetimeLogisticStats;
        } else {
            // NO VERSION CHANGE: Keep existing data without modifications (except critical fixes)
            cleanState.playerName = saved.playerName || INITIAL_GAME_STATE.playerName;
            cleanState.playerFlag = saved.playerFlag;
            cleanState.peerId = saved.peerId || null;
            cleanState.hasChangedName = saved.hasChangedName ?? false;
            cleanState.bankBalance = saved.bankBalance ?? 0;
            cleanState.currentInterestRate = saved.currentInterestRate ?? 0.05;
            cleanState.nextRateChangeTime = saved.nextRateChangeTime ?? now;
            cleanState.lastInterestPayoutTime = saved.lastInterestPayoutTime ?? now;
            cleanState.empirePoints = saved.empirePoints ?? 0;
            cleanState.lastSaveTime = saved.lastSaveTime ?? now;
            cleanState.lastReputationDecayTime = saved.lastReputationDecayTime ?? now;
            cleanState.campaignProgress = saved.campaignProgress ?? 1;
            cleanState.lastCampaignMissionFinishedTime = saved.lastCampaignMissionFinishedTime ?? 0;
            cleanState.isTutorialMinimized = saved.isTutorialMinimized ?? false;
            cleanState.tutorialAccepted = saved.tutorialAccepted ?? false;
            cleanState.nextAttackTime = saved.nextAttackTime ?? now + (3 * 60 * 60 * 1000);

            // CRITICAL FIX: Handle corrupted lastSaveTime (0 or invalid)
            // Using ?? doesn't work for 0, so we need explicit check
            cleanState.lastSaveTime = (saved.lastSaveTime && saved.lastSaveTime > 0) 
                ? saved.lastSaveTime 
                : now;
            cleanState.lastReputationDecayTime = (saved.lastReputationDecayTime && saved.lastReputationDecayTime > 0)
                ? saved.lastReputationDecayTime
                : now;
            
            cleanState.incomingAttacks = saved.incomingAttacks ?? [];
            cleanState.grudges = saved.grudges ?? [];
            cleanState.spyReports = saved.spyReports ?? [];
            cleanState.activeMissions = saved.activeMissions ?? [];
            cleanState.activeWar = saved.activeWar ?? null;
            cleanState.lifetimeStats = saved.lifetimeStats ?? INITIAL_GAME_STATE.lifetimeStats;
            cleanState.diplomaticActions = saved.diplomaticActions ?? {};
            cleanState.logs = saved.logs ?? [];
            cleanState.allyReinforcements = saved.allyReinforcements ?? [];
            
            cleanState.resources = saved.resources ?? INITIAL_GAME_STATE.resources;
            cleanState.maxResources = saved.maxResources ?? INITIAL_GAME_STATE.maxResources;
            cleanState.units = saved.units ?? INITIAL_GAME_STATE.units;
            cleanState.buildings = saved.buildings ?? INITIAL_GAME_STATE.buildings;
            
            cleanState.enemyAttackCounts = saved.enemyAttackCounts ?? {};
            cleanState.lastEnemyAttackCheckTime = saved.lastEnemyAttackCheckTime ?? now;
            cleanState.lastEnemyAttackResetTime = saved.lastEnemyAttackResetTime ?? now;
            
            cleanState.targetAttackCounts = saved.targetAttackCounts ?? {};
            cleanState.lastAttackResetTime = saved.lastAttackResetTime ?? now;
            
            cleanState.researchedTechs = saved.researchedTechs ?? [];
            cleanState.techLevels = saved.techLevels ?? {};
            cleanState.activeResearch = saved.activeResearch ?? null;
            
            cleanState.activeRecruitments = saved.activeRecruitments ?? [];
            cleanState.activeConstructions = saved.activeConstructions ?? [];
            
            cleanState.marketOffers = saved.marketOffers ?? [];
            cleanState.activeMarketEvent = saved.activeMarketEvent ?? null;
            cleanState.marketNextRefreshTime = saved.marketNextRefreshTime ?? now;
            
            cleanState.completedTutorials = saved.completedTutorials ?? [];
            cleanState.currentTutorialId = saved.currentTutorialId ?? null;
            cleanState.tutorialClaimable = saved.tutorialClaimable ?? false;
            
            cleanState.rankingData = saved.rankingData ?? INITIAL_GAME_STATE.rankingData;

            // Reputation History System (New)
            cleanState.reputationHistory = saved.reputationHistory ?? {};
            cleanState.interactionRecords = saved.interactionRecords ?? {};

            cleanState.redeemedGiftCodes = saved.redeemedGiftCodes ?? [];
            cleanState.giftCodeCooldowns = saved.giftCodeCooldowns ?? {};

            // Logistic Loot System (v7)
            cleanState.logisticLootFields = saved.logisticLootFields ?? [];
            cleanState.visibleLogisticLootFields = saved.visibleLogisticLootFields ?? [];
            cleanState.lifetimeLogisticStats = saved.lifetimeLogisticStats ?? INITIAL_GAME_STATE.lifetimeLogisticStats;
        }

        // ============================================
        // CRITICAL FIX: ALWAYS validate resources for inflation (regardless of version change)
        // This is the main fix for the "absurd resources on load/import" bug
        // ============================================
        const inflationFixed = validateAndCapInflatedResources(cleanState.resources, silent);
        if (inflationFixed) {
            logMigration('warn', 'CRITICAL FIX: Inflated resources detected and capped during load/import');
        }

        // 4. CRITICAL FIXES: Always apply these regardless of version change
        // These are essential data integrity checks that must happen on every load
        
        // 4A. Ensure Diamond Mine is at least Level 1
        if (!cleanState.buildings[BuildingType.DIAMOND_MINE] || cleanState.buildings[BuildingType.DIAMOND_MINE].level < 1) {
            cleanState.buildings[BuildingType.DIAMOND_MINE] = {
                level: 1,
                isDamaged: cleanState.buildings[BuildingType.DIAMOND_MINE]?.isDamaged || false
            };
            logMigration('warn', `CRITICAL FIX: Ensured Diamond Mine is at least Level 1`);
        }

        // 4B. Ensure all building states have proper structure
        Object.keys(cleanState.buildings).forEach((key) => {
            const k = key as BuildingType;
            if (!cleanState.buildings[k]) {
                cleanState.buildings[k] = { level: 0, isDamaged: false };
            }
            if (typeof cleanState.buildings[k].isDamaged !== 'boolean') {
                cleanState.buildings[k] = { ...cleanState.buildings[k], isDamaged: false };
            }
        });

        // 5. Force update version to current
        cleanState.saveVersion = SAVE_VERSION;

        // 6. Generate data hash for integrity verification
        report.dataHash = generateDataHash({
            resources: cleanState.resources,
            buildings: Object.keys(cleanState.buildings).length,
            units: cleanState.units,
            version: cleanState.saveVersion
        });

        if (versionChanged) {
            logMigration('info', `Migration completed successfully. Version: ${SAVE_VERSION}, Hash: ${report.dataHash}`);
        }

    } catch (error) {
        logMigration('error', `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        report.success = false;
        report.fieldsError++;
        
        // Log detailed error information
        logMigrationError(`Full save migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
            location: { file: 'utils/engine/migration.ts', function: 'sanitizeAndMigrateSave' },
            saveVersion: saved?.saveVersion,
            savedData: savedDataForLogging || saved,
            recoveryAction: 'Returned safe initial state to prevent application crash.',
            suggestions: [
                'Try clearing browser localStorage using: localStorage.clear()',
                'Check if the save file was manually modified or corrupted',
                'Ensure your browser is up to date'
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
