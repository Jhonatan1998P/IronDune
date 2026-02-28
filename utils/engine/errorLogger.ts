/**
 * ERROR LOGGER & TELEMETRY SYSTEM
 * Centralized logging for war system and game events
 * Provides debugging, analytics, and error tracking
 */

import { GameState, WarState, LogEntry, IncomingAttack } from '../types';
import { appendFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';

// Configuración del archivo de log
const LOG_DIR = './logs';
const WAR_LOG_FILE = `${LOG_DIR}/war.log`;

// Asegurar que existe el directorio de logs
const ensureLogDir = (): void => {
    try {
        if (!existsSync(LOG_DIR)) {
            mkdirSync(LOG_DIR, { recursive: true });
        }
    } catch (e) {
        // Ignorar errores de directorio
    }
};

// ============================================
// TYPE DEFINITIONS
// ============================================

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export type LogCategory = 'war' | 'combat' | 'economy' | 'diplomacy' | 'system' | 'performance';

export interface TelemetryEvent {
    id: string;
    timestamp: number;
    category: LogCategory;
    level: LogLevel;
    event: string;
    data: Record<string, any>;
    sessionId?: string;
    playerId?: string;
}

export interface WarTelemetryData {
    warId: string;
    enemyId: string;
    enemyScore: number;
    playerScore: number;
    startTime: number;
    endTime?: number;
    totalWaves: number;
    playerVictories: number;
    enemyVictories: number;
    playerUnitLosses: number;
    enemyUnitLosses: number;
    playerResourceLosses: Record<string, number>;
    enemyResourceLosses: Record<string, number>;
    lootPoolValue: number;
    result: 'victory' | 'defeat' | 'draw';
    duration: number;
    overtimeWaves: number;
    issues: string[];
}

// ============================================
// SESSION MANAGEMENT
// ============================================

let sessionId: string = '';
let playerId: string = '';
let telemetryBuffer: TelemetryEvent[] = [];
const MAX_BUFFER_SIZE = 100;

/**
 * Initializes telemetry system with session and player IDs
 */
export const initTelemetry = (pid: string): void => {
    playerId = pid;
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    telemetryBuffer = [];
};

/**
 * Gets current session ID
 */
export const getSessionId = (): string => sessionId;

/**
 * Gets current player ID
 */
export const getPlayerId = (): string => playerId;

// ============================================
// LOGGING FUNCTIONS
// ============================================

/**
 * Core logging function
 */
const log = async (
    category: LogCategory,
    level: LogLevel,
    message: string,
    data?: Record<string, any>
): Promise<void> => {
    const timestamp = Date.now();
    const event: TelemetryEvent = {
        id: `log-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
        category,
        level,
        event: message,
        data: data || {},
        sessionId: sessionId || undefined,
        playerId: playerId || undefined
    };

    // Console output for development
    if (process.env.NODE_ENV !== 'production' || level !== 'debug') {
        const prefix = `[${category.toUpperCase()}][${level.toUpperCase()}]`;
        const dataStr = data ? JSON.stringify(data) : '';
        
        switch (level) {
            case 'debug':
                console.debug(`${prefix} ${message}`, dataStr);
                break;
            case 'info':
                console.info(`${prefix} ${message}`, dataStr);
                break;
            case 'warning':
                console.warn(`${prefix} ${message}`, dataStr);
                break;
            case 'error':
                console.error(`${prefix} ${message}`, dataStr);
                break;
            case 'critical':
                console.error(`${prefix} CRITICAL: ${message}`, dataStr);
                break;
        }
    }

    // Buffer for analytics (only warnings and above in production)
    if (level !== 'debug' && level !== 'info') {
        if (telemetryBuffer.length >= MAX_BUFFER_SIZE) {
            telemetryBuffer.shift(); // Remove oldest
        }
        telemetryBuffer.push(event);
    }

    // Write to war.log file
    try {
        ensureLogDir();
        const timestampISO = new Date().toISOString();
        const logMessage = `[${timestampISO}] [${category.toUpperCase()}] [${level.toUpperCase()}] ${message} ${data ? JSON.stringify(data, null, 0)}\n`;
        await appendFile(WAR_LOG_FILE, logMessage).catch(() => {});
    } catch (e) {
        // Silently ignore file write errors
    }
};

/**
 * Logs a debug message
 */
export const logDebug = (category: LogCategory, message: string, data?: Record<string, any>): void => {
    log(category, 'debug', message, data);
};

/**
 * Logs an info message
 */
export const logInfo = (category: LogCategory, message: string, data?: Record<string, any>): void => {
    log(category, 'info', message, data);
};

/**
 * Logs a warning
 */
export const logWarning = (category: LogCategory, message: string, data?: Record<string, any>): void => {
    log(category, 'warning', message, data);
};

/**
 * Logs an error
 */
export const logError = (category: LogCategory, message: string, data?: Record<string, any>): void => {
    log(category, 'error', message, data);
};

/**
 * Logs a critical error
 */
export const logCritical = (category: LogCategory, message: string, data?: Record<string, any>): void => {
    log(category, 'critical', message, data);
};

/**
 * Logs migration error (legacy compatibility)
 */
export const logMigrationError = (message: string, data?: Record<string, any>): void => {
    logError('system', `Migration error: ${message}`, data);
};

// ============================================
// WAR-SPECIFIC TELEMETRY
// ============================================

/**
 * Logs war start event
 */
export const logWarStart = (war: WarState, playerScore: number): void => {
    logInfo('war', 'War started', {
        warId: war.id,
        enemyId: war.enemyId,
        enemyName: war.enemyName,
        enemyScore: war.enemyScore,
        playerScore,
        scoreRatio: war.enemyScore / Math.max(1, playerScore),
        totalWaves: war.totalWaves,
        duration: war.duration
    });
};

/**
 * Logs war wave spawn
 */
export const logWarWave = (warId: string, waveNumber: number, enemyScore: number, armySize: number): void => {
    logDebug('war', 'War wave spawned', {
        warId,
        waveNumber,
        enemyScore,
        armySize,
        timestamp: Date.now()
    });
};

/**
 * Logs war combat resolution
 */
export const logWarCombat = (
    warId: string,
    waveNumber: number,
    winner: 'PLAYER' | 'ENEMY' | 'DRAW',
    playerCasualties: number,
    enemyCasualties: number,
    playerResourceLoss: number,
    enemyResourceLoss: number
): void => {
    logInfo('war', 'War combat resolved', {
        warId,
        waveNumber,
        winner,
        playerCasualties,
        enemyCasualties,
        playerResourceLoss,
        enemyResourceLoss,
        casualtyRatio: enemyCasualties / Math.max(1, playerCasualties)
    });
};

/**
 * Logs war end event
 */
export const logWarEnd = (telemetry: WarTelemetryData): void => {
    logInfo('war', 'War ended', {
        warId: telemetry.warId,
        enemyId: telemetry.enemyId,
        result: telemetry.result,
        duration: telemetry.duration,
        totalWaves: telemetry.totalWaves,
        playerVictories: telemetry.playerVictories,
        enemyVictories: telemetry.enemyVictories,
        playerUnitLosses: telemetry.playerUnitLosses,
        enemyUnitLosses: telemetry.enemyUnitLosses,
        lootPoolValue: telemetry.lootPoolValue,
        overtimeWaves: telemetry.overtimeWaves,
        issues: telemetry.issues
    });

    // Track in buffer for analytics
    trackWarAnalytics(telemetry);
};

/**
 * Logs war validation error
 */
export const logWarValidationError = (warId: string, errors: string[], warnings: string[]): void => {
    if (errors.length > 0) {
        logError('war', 'War validation failed', { warId, errors, warnings });
    } else if (warnings.length > 0) {
        logWarning('war', 'War validation warnings', { warId, warnings });
    }
};

/**
 * Logs war state sanitization
 */
export const logWarSanitization = (warId: string, before: any, after: any, changes: string[]): void => {
    logWarning('war', 'War state sanitized', {
        warId,
        changes,
        before: JSON.stringify(before),
        after: JSON.stringify(after)
    });
};

// ============================================
// COMBAT TELEMETRY
// ============================================

/**
 * Logs incoming attack
 */
export const logIncomingAttack = (attack: IncomingAttack, isWar: boolean): void => {
    logInfo('combat', 'Incoming attack detected', {
        attackId: attack.id,
        attackerName: attack.attackerName,
        attackerScore: attack.attackerScore,
        isWarWave: isWar,
        unitCount: Object.values(attack.units).reduce((a, b) => a + (b || 0), 0),
        travelTime: attack.endTime - attack.startTime,
        timestamp: Date.now()
    });
};

/**
 * Logs combat result
 */
export const logCombatResult = (
    attackId: string,
    winner: 'PLAYER' | 'ENEMY' | 'DRAW',
    playerCasualties: number,
    enemyCasualties: number,
    buildingLoot?: Record<string, number>
): void => {
    logInfo('combat', 'Combat resolved', {
        attackId,
        winner,
        playerCasualties,
        enemyCasualties,
        buildingLoot,
        casualtyRatio: enemyCasualties / Math.max(1, playerCasualties)
    });
};

// ============================================
// ANALYTICS TRACKING
// ============================================

interface WarAnalytics {
    totalWars: number;
    totalVictories: number;
    totalDefeats: number;
    totalDraws: number;
    averageWarDuration: number;
    averageWavesPerWar: number;
    averageCasualtiesPerWar: number;
    bestWinStreak: number;
    currentWinStreak: number;
    totalLootEarned: number;
    totalResourcesLost: number;
}

let warAnalytics: WarAnalytics = {
    totalWars: 0,
    totalVictories: 0,
    totalDefeats: 0,
    totalDraws: 0,
    averageWarDuration: 0,
    averageWavesPerWar: 0,
    averageCasualtiesPerWar: 0,
    bestWinStreak: 0,
    currentWinStreak: 0,
    totalLootEarned: 0,
    totalResourcesLost: 0
};

/**
 * Tracks war analytics
 */
const trackWarAnalytics = (telemetry: WarTelemetryData): void => {
    warAnalytics.totalWars++;
    
    if (telemetry.result === 'victory') {
        warAnalytics.totalVictories++;
        warAnalytics.currentWinStreak++;
        if (warAnalytics.currentWinStreak > warAnalytics.bestWinStreak) {
            warAnalytics.bestWinStreak = warAnalytics.currentWinStreak;
        }
        warAnalytics.totalLootEarned += telemetry.lootPoolValue;
    } else if (telemetry.result === 'defeat') {
        warAnalytics.totalDefeats++;
        warAnalytics.currentWinStreak = 0;
    } else {
        warAnalytics.totalDraws++;
    }

    // Update averages
    const total = warAnalytics.totalWars;
    warAnalytics.averageWarDuration = 
        ((warAnalytics.averageWarDuration * (total - 1)) + telemetry.duration) / total;
    
    warAnalytics.averageWavesPerWar = 
        ((warAnalytics.averageWavesPerWar * (total - 1)) + telemetry.totalWaves) / total;
    
    warAnalytics.averageCasualtiesPerWar = 
        ((warAnalytics.averageCasualtiesPerWar * (total - 1)) + telemetry.playerUnitLosses) / total;
    
    warAnalytics.totalResourcesLost += 
        Object.values(telemetry.playerResourceLosses).reduce((a, b) => a + b, 0);
};

/**
 * Gets current war analytics
 */
export const getWarAnalytics = (): WarAnalytics => ({ ...warAnalytics });

/**
 * Resets war analytics (for new game)
 */
export const resetWarAnalytics = (): void => {
    warAnalytics = {
        totalWars: 0,
        totalVictories: 0,
        totalDefeats: 0,
        totalDraws: 0,
        averageWarDuration: 0,
        averageWavesPerWar: 0,
        averageCasualtiesPerWar: 0,
        bestWinStreak: 0,
        currentWinStreak: 0,
        totalLootEarned: 0,
        totalResourcesLost: 0
    };
};

// ============================================
// BUFFER MANAGEMENT
// ============================================

/**
 * Gets buffered telemetry events
 */
export const getTelemetryBuffer = (): TelemetryEvent[] => [...telemetryBuffer];

/**
 * Clears telemetry buffer
 */
export const clearTelemetryBuffer = (): void => {
    telemetryBuffer = [];
};

/**
 * Flushes telemetry buffer (for persistence)
 */
export const flushTelemetryBuffer = (): TelemetryEvent[] => {
    const buffer = [...telemetryBuffer];
    telemetryBuffer = [];
    return buffer;
};

// ============================================
// PERFORMANCE MONITORING
// ============================================

interface PerformanceMetrics {
    warTickDuration: number[];
    combatSimulationDuration: number[];
    validationDuration: number[];
    averageWarTickMs: number;
    averageCombatMs: number;
    averageValidationMs: number;
    slowestWarTick: number;
    slowestCombat: number;
}

const performanceMetrics: PerformanceMetrics = {
    warTickDuration: [],
    combatSimulationDuration: [],
    validationDuration: [],
    averageWarTickMs: 0,
    averageCombatMs: 0,
    averageValidationMs: 0,
    slowestWarTick: 0,
    slowestCombat: 0
};

const MAX_METRICS_SAMPLES = 100;

/**
 * Records war tick performance
 */
export const recordWarTickPerformance = (durationMs: number): void => {
    performanceMetrics.warTickDuration.push(durationMs);
    if (performanceMetrics.warTickDuration.length > MAX_METRICS_SAMPLES) {
        performanceMetrics.warTickDuration.shift();
    }
    
    performanceMetrics.averageWarTickMs = 
        performanceMetrics.warTickDuration.reduce((a, b) => a + b, 0) / 
        performanceMetrics.warTickDuration.length;
    
    if (durationMs > performanceMetrics.slowestWarTick) {
        performanceMetrics.slowestWarTick = durationMs;
    }

    if (durationMs > 100) { // Log slow ticks
        logWarning('performance', 'Slow war tick detected', { durationMs });
    }
};

/**
 * Records combat simulation performance
 */
export const recordCombatPerformance = (durationMs: number): void => {
    performanceMetrics.combatSimulationDuration.push(durationMs);
    if (performanceMetrics.combatSimulationDuration.length > MAX_METRICS_SAMPLES) {
        performanceMetrics.combatSimulationDuration.shift();
    }
    
    performanceMetrics.averageCombatMs = 
        performanceMetrics.combatSimulationDuration.reduce((a, b) => a + b, 0) / 
        performanceMetrics.combatSimulationDuration.length;
    
    if (durationMs > performanceMetrics.slowestCombat) {
        performanceMetrics.slowestCombat = durationMs;
    }

    if (durationMs > 50) { // Log slow combats
        logWarning('performance', 'Slow combat simulation detected', { durationMs });
    }
};

/**
 * Records validation performance
 */
export const recordValidationPerformance = (durationMs: number): void => {
    performanceMetrics.validationDuration.push(durationMs);
    if (performanceMetrics.validationDuration.length > MAX_METRICS_SAMPLES) {
        performanceMetrics.validationDuration.shift();
    }
    
    performanceMetrics.averageValidationMs = 
        performanceMetrics.validationDuration.reduce((a, b) => a + b, 0) / 
        performanceMetrics.validationDuration.length;
};

/**
 * Gets performance metrics
 */
export const getPerformanceMetrics = (): PerformanceMetrics => ({ ...performanceMetrics });

// ============================================
// ERROR RECOVERY TRACKING
// ============================================

interface ErrorRecoveryStats {
    totalErrors: number;
    recoveredErrors: number;
    criticalErrors: number;
    warStatesRepaired: number;
    warStatesTerminated: number;
    attacksSanitized: number;
}

const errorRecoveryStats: ErrorRecoveryStats = {
    totalErrors: 0,
    recoveredErrors: 0,
    criticalErrors: 0,
    warStatesRepaired: 0,
    warStatesTerminated: 0,
    attacksSanitized: 0
};

/**
 * Tracks error recovery
 */
export const trackErrorRecovery = (
    type: 'recovered' | 'critical' | 'war_repaired' | 'war_terminated' | 'attack_sanitized'
): void => {
    errorRecoveryStats.totalErrors++;
    
    switch (type) {
        case 'recovered':
            errorRecoveryStats.recoveredErrors++;
            break;
        case 'critical':
            errorRecoveryStats.criticalErrors++;
            break;
        case 'war_repaired':
            errorRecoveryStats.warStatesRepaired++;
            break;
        case 'war_terminated':
            errorRecoveryStats.warStatesTerminated++;
            break;
        case 'attack_sanitized':
            errorRecoveryStats.attacksSanitized++;
            break;
    }
};

/**
 * Gets error recovery stats
 */
export const getErrorRecoveryStats = (): ErrorRecoveryStats => ({ ...errorRecoveryStats });
