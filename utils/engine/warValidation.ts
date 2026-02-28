/**
 * WAR SYSTEM VALIDATION & SANITIZATION
 * Production-ready validation layer for total war logic
 * Prevents exploits, corruption, and edge cases
 */

import { GameState, WarState, IncomingAttack, ResourceType, UnitType, BuildingType } from '../../types';
import { WAR_TOTAL_WAVES, WAR_PLAYER_ATTACKS, WAR_DURATION_MS, WAR_OVERTIME_MS, WAR_WAVE_INTERVAL_MS, WAR_COOLDOWN_MS, NEWBIE_PROTECTION_THRESHOLD, BOT_BUDGET_RATIO, PLUNDERABLE_BUILDINGS, PLUNDER_RATES } from '../../constants';

// ============================================
// CONFIGURATION & LIMITS
// ============================================

export const MAX_WAVE_DELAY_MS = 5 * 60 * 1000; // 5 minutes max drift correction
export const MIN_WAVE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes minimum between waves
export const MAX_WAVE_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes maximum between waves
export const MAX_LOOT_POOL_MULTIPLIER = 10; // Prevent infinite loot accumulation exploits
export const MAX_RESOURCE_LOSS_RATIO = 0.95; // Can't lose more than 95% in a war
export const MAX_UNIT_LOSS_RATIO = 0.99; // Can't lose more than 99% of units
export const MAX_WAVE_NUMBER = 50; // Hard cap on wave number (prevent overflow exploits)
export const MAX_WAR_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours max war duration
export const MIN_WAR_DURATION_MS = 5 * 60 * 1000; // 5 minutes min war duration
export const MAX_ENEMY_SCORE_RATIO = 10; // Enemy can't have more than 10x player score
export const MIN_ENEMY_SCORE_RATIO = 0.01; // Enemy can't have less than 1% player score

// ============================================
// TYPE GUARDS & VALIDATORS
// ============================================

/**
 * Validates that a WarState is structurally sound
 */
export const isValidWarState = (war: WarState | null): war is WarState => {
    if (!war) return false;

    // Required string fields
    if (!war.id || typeof war.id !== 'string') return false;
    if (!war.enemyId || typeof war.enemyId !== 'string') return false;
    if (!war.enemyName || typeof war.enemyName !== 'string') return false;

    // Required number fields with bounds
    if (typeof war.enemyScore !== 'number' || war.enemyScore <= 0) return false;
    if (typeof war.startTime !== 'number' || war.startTime <= 0) return false;
    if (typeof war.duration !== 'number' || war.duration < MIN_WAR_DURATION_MS || war.duration > MAX_WAR_DURATION_MS) return false;
    if (typeof war.nextWaveTime !== 'number' || war.nextWaveTime <= 0) return false;
    if (typeof war.currentWave !== 'number' || war.currentWave < 1 || war.currentWave > MAX_WAVE_NUMBER) return false;
    if (typeof war.totalWaves !== 'number' || war.totalWaves < 1 || war.totalWaves > MAX_WAVE_NUMBER) return false;
    if (typeof war.playerVictories !== 'number' || war.playerVictories < 0) return false;
    if (typeof war.enemyVictories !== 'number' || war.enemyVictories < 0) return false;
    if (typeof war.playerAttacksLeft !== 'number' || war.playerAttacksLeft < 0) return false;

    // Resource objects validation
    if (!isValidResourceRecord(war.lootPool)) return false;
    if (!isValidResourceRecord(war.playerResourceLosses)) return false;
    if (!isValidResourceRecord(war.enemyResourceLosses)) return false;

    // Unit record validation
    if (!isValidUnitRecord(war.currentEnemyGarrison)) return false;

    // Logical consistency checks
    if (war.currentWave > war.totalWaves && war.playerVictories === war.enemyVictories) {
        // Should be in overtime, check if duration was extended
        const expectedOvertimeWaves = Math.ceil((war.duration - WAR_DURATION_MS) / WAR_OVERTIME_MS);
        if (war.totalWaves < WAR_TOTAL_WAVES + expectedOvertimeWaves) {
            return false;
        }
    }

    return true;
};

/**
 * Validates resource record structure
 */
export const isValidResourceRecord = (record: any): record is Record<ResourceType, number> => {
    if (!record || typeof record !== 'object') return false;

    const requiredResources = [ResourceType.MONEY, ResourceType.OIL, ResourceType.AMMO, ResourceType.GOLD, ResourceType.DIAMOND];
    for (const res of requiredResources) {
        if (typeof record[res] !== 'number' || record[res] < 0) {
            return false;
        }
    }
    return true;
};

/**
 * Validates unit record structure
 */
export const isValidUnitRecord = (record: any): record is Partial<Record<UnitType, number>> => {
    if (!record || typeof record !== 'object') return false;

    for (const [key, value] of Object.entries(record)) {
        if (!Object.values(UnitType).includes(key as UnitType)) {
            return false;
        }
        if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
            return false;
        }
    }
    return true;
};

/**
 * Validates incoming attack structure
 */
export const isValidIncomingAttack = (attack: IncomingAttack): boolean => {
    if (!attack) return false;

    // Required fields
    if (!attack.id || typeof attack.id !== 'string') return false;
    if (!attack.attackerName || typeof attack.attackerName !== 'string') return false;
    if (typeof attack.attackerScore !== 'number' || attack.attackerScore <= 0) return false;
    if (typeof attack.startTime !== 'number' || attack.startTime <= 0) return false;
    if (typeof attack.endTime !== 'number' || attack.endTime <= 0) return false;

    // Time consistency
    if (attack.endTime <= attack.startTime) return false;

    // Unit validation
    if (!isValidUnitRecord(attack.units)) return false;

    // Optional fields type checks
    if (attack.delayCount !== undefined && (typeof attack.delayCount !== 'number' || attack.delayCount < 0)) return false;
    if (attack.isWarWave !== undefined && typeof attack.isWarWave !== 'boolean') return false;
    if (attack.isScouted !== undefined && typeof attack.isScouted !== 'boolean') return false;

    return true;
};

// ============================================
// SANITIZATION FUNCTIONS
// ============================================

/**
 * Sanitizes and repairs a WarState if possible
 * Returns null if war is beyond repair
 */
export const sanitizeWarState = (war: WarState | null, playerScore: number): WarState | null => {
    if (!war) return null;

    // Create a copy to avoid mutations
    const sanitized: WarState = { ...war };

    // Validate and fix string fields
    if (!sanitized.id || typeof sanitized.id !== 'string') {
        sanitized.id = `war-repaired-${Date.now()}`;
    }
    if (!sanitized.enemyId || typeof sanitized.enemyId !== 'string') {
        return null; // Can't repair without enemy ID
    }
    if (!sanitized.enemyName || typeof sanitized.enemyName !== 'string') {
        sanitized.enemyName = 'Unknown Enemy';
    }

    // Validate and fix enemy score
    if (typeof sanitized.enemyScore !== 'number' || sanitized.enemyScore <= 0) {
        sanitized.enemyScore = Math.max(1000, playerScore);
    } else {
        // Clamp enemy score to reasonable bounds
        const minScore = playerScore * MIN_ENEMY_SCORE_RATIO;
        const maxScore = playerScore * MAX_ENEMY_SCORE_RATIO;
        sanitized.enemyScore = Math.max(minScore, Math.min(maxScore, sanitized.enemyScore));
    }

    // Validate timestamps
    const now = Date.now();
    if (typeof sanitized.startTime !== 'number' || sanitized.startTime <= 0) {
        sanitized.startTime = now;
    }

    // Validate and fix duration
    if (typeof sanitized.duration !== 'number' || sanitized.duration < MIN_WAR_DURATION_MS || sanitized.duration > MAX_WAR_DURATION_MS) {
        sanitized.duration = WAR_DURATION_MS;
    }

    // Validate and fix nextWaveTime
    if (typeof sanitized.nextWaveTime !== 'number' || sanitized.nextWaveTime <= 0) {
        sanitized.nextWaveTime = now + WAR_WAVE_INTERVAL_MS;
    }

    // Validate and fix wave counters
    if (typeof sanitized.currentWave !== 'number' || sanitized.currentWave < 1) {
        sanitized.currentWave = 1;
    } else if (sanitized.currentWave > MAX_WAVE_NUMBER) {
        sanitized.currentWave = MAX_WAVE_NUMBER;
    }

    if (typeof sanitized.totalWaves !== 'number' || sanitized.totalWaves < 1) {
        sanitized.totalWaves = WAR_TOTAL_WAVES;
    } else if (sanitized.totalWaves > MAX_WAVE_NUMBER) {
        sanitized.totalWaves = MAX_WAVE_NUMBER;
    }

    // Validate victory counters
    sanitized.playerVictories = Math.max(0, Math.floor(sanitized.playerVictories || 0));
    sanitized.enemyVictories = Math.max(0, Math.floor(sanitized.enemyVictories || 0));
    sanitized.playerAttacksLeft = Math.max(0, Math.floor(sanitized.playerAttacksLeft || 0));

    // Sanitize resource records
    sanitized.lootPool = sanitizeResourceRecord(sanitized.lootPool);
    sanitized.playerResourceLosses = sanitizeResourceRecord(sanitized.playerResourceLosses);
    sanitized.enemyResourceLosses = sanitizeResourceRecord(sanitized.enemyResourceLosses);

    // Sanitize unit records
    sanitized.currentEnemyGarrison = sanitizeUnitRecord(sanitized.currentEnemyGarrison);

    // Apply loot pool cap (anti-exploit)
    const maxLootValue = playerScore * SCORE_TO_RESOURCE_VALUE * MAX_LOOT_POOL_MULTIPLIER;
    const totalLootValue = Object.values(sanitized.lootPool).reduce((sum, val) => sum + val, 0);
    if (totalLootValue > maxLootValue) {
        const scale = maxLootValue / totalLootValue;
        (Object.keys(sanitized.lootPool) as ResourceType[]).forEach(key => {
            sanitized.lootPool[key] = Math.floor(sanitized.lootPool[key] * scale);
        });
    }

    // Validate wave timing consistency
    const warEndTime = sanitized.startTime + sanitized.duration;
    if (sanitized.nextWaveTime > warEndTime) {
        sanitized.nextWaveTime = warEndTime;
    }

    return sanitized;
};

/**
 * Sanitizes resource record, ensuring all required resources exist with valid values
 */
export const sanitizeResourceRecord = (record: any): Record<ResourceType, number> => {
    const safe: Record<ResourceType, number> = {
        [ResourceType.MONEY]: 0,
        [ResourceType.OIL]: 0,
        [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0,
        [ResourceType.DIAMOND]: 0
    };

    if (!record || typeof record !== 'object') {
        return safe;
    }

    (Object.keys(safe) as ResourceType[]).forEach(key => {
        const value = record[key];
        if (typeof value === 'number' && value >= 0 && Number.isFinite(value)) {
            safe[key] = Math.floor(value);
        }
    });

    return safe;
};

/**
 * Sanitizes unit record, removing invalid units and ensuring non-negative integers
 */
export const sanitizeUnitRecord = (record: any): Partial<Record<UnitType, number>> => {
    const safe: Partial<Record<UnitType, number>> = {};

    if (!record || typeof record !== 'object') {
        return safe;
    }

    for (const [key, value] of Object.entries(record)) {
        if (Object.values(UnitType).includes(key as UnitType)) {
            if (typeof value === 'number' && value >= 0 && Number.isFinite(value)) {
                safe[key as UnitType] = Math.floor(value);
            }
        }
    }

    return safe;
};

/**
 * Sanitizes incoming attacks array
 */
export const sanitizeIncomingAttacks = (attacks: any[]): IncomingAttack[] => {
    if (!Array.isArray(attacks)) return [];

    return attacks
        .filter(isValidIncomingAttack)
        .map(attack => ({
            ...attack,
            units: sanitizeUnitRecord(attack.units),
            startTime: Math.max(0, attack.startTime),
            endTime: Math.max(attack.startTime + 60000, attack.endTime) // At least 1 minute travel time
        }));
};

// ============================================
// CONSISTENCY CHECKS
// ============================================

/**
 * Checks war state for logical inconsistencies and returns issues found
 */
export const checkWarConsistency = (war: WarState, playerScore: number): string[] => {
    const issues: string[] = [];

    // Check wave progression
    if (war.currentWave > war.totalWaves && war.playerVictories === war.enemyVictories) {
        const expectedOvertime = Math.ceil((war.duration - WAR_DURATION_MS) / WAR_OVERTIME_MS);
        if (war.totalWaves < WAR_TOTAL_WAVES + expectedOvertime) {
            issues.push(`Wave progression inconsistent: current=${war.currentWave}, total=${war.totalWaves}, overtime=${expectedOvertime}`);
        }
    }

    // Check victory count vs waves
    const totalBattles = war.playerVictories + war.enemyVictories;
    const expectedBattles = Math.min(war.currentWave - 1, war.totalWaves);
    if (totalBattles > expectedBattles + 2) { // Allow 2 battle buffer for timing
        issues.push(`Victory count exceeds wave count: ${totalBattles} battles in ${expectedBattles} waves`);
    }

    // Check enemy score ratio
    const scoreRatio = war.enemyScore / Math.max(1, playerScore);
    if (scoreRatio < MIN_ENEMY_SCORE_RATIO || scoreRatio > MAX_ENEMY_SCORE_RATIO) {
        issues.push(`Enemy score ratio out of bounds: ${scoreRatio}`);
    }

    // Check resource loss ratios
    const maxPossibleLoss = playerScore * SCORE_TO_RESOURCE_VALUE * war.totalWaves;
    const totalPlayerLoss = Object.values(war.playerResourceLosses).reduce((a, b) => a + b, 0);
    if (totalPlayerLoss > maxPossibleLoss * MAX_RESOURCE_LOSS_RATIO) {
        issues.push(`Player resource losses exceed maximum: ${totalPlayerLoss} > ${maxPossibleLoss}`);
    }

    // Check timing consistency
    const now = Date.now();
    const warEndTime = war.startTime + war.duration;
    if (war.nextWaveTime > warEndTime) {
        issues.push(`Next wave time exceeds war end time`);
    }

    // Check for expired war
    if (now > warEndTime && war.playerVictories === war.enemyVictories) {
        issues.push(`War expired but still in tie state`);
    }

    return issues;
};

/**
 * Checks incoming attacks for consistency
 */
export const checkAttackConsistency = (attacks: IncomingAttack[]): string[] => {
    const issues: string[] = [];
    const now = Date.now();

    attacks.forEach(attack => {
        // Check for impossible travel times
        const travelTime = attack.endTime - attack.startTime;
        if (travelTime < 60000 || travelTime > 60 * 60 * 1000) { // 1 min to 1 hour
            issues.push(`Attack ${attack.id} has impossible travel time: ${travelTime}ms`);
        }

        // Check for attacks that are too old (stale)
        if (attack.endTime < now - 24 * 60 * 60 * 1000) {
            issues.push(`Attack ${attack.id} is stale (ended >24h ago)`);
        }

        // Check for attacks too far in the future
        if (attack.startTime > now + 24 * 60 * 60 * 1000) {
            issues.push(`Attack ${attack.id} is scheduled too far in the future`);
        }
    });

    return issues;
};

// ============================================
// WAVE TIMING CORRECTION
// ============================================

/**
 * Corrects wave timing drift to prevent desynchronization
 */
export const correctWaveTiming = (war: WarState, now: number): WarState => {
    const corrected = { ...war };

    // Calculate expected wave time based on current wave
    const wavesElapsed = corrected.currentWave - 1;
    const expectedNextWaveTime = corrected.startTime + (wavesElapsed * WAR_WAVE_INTERVAL_MS);

    // Check for drift from expected schedule
    const drift = Math.abs(corrected.nextWaveTime - expectedNextWaveTime);

    // Only correct if drift exceeds threshold AND war is still active
    const warEndTime = corrected.startTime + corrected.duration;
    const isWarActive = now < warEndTime;
    
    if (drift > MAX_WAVE_DELAY_MS && isWarActive) {
        // Apply gentle correction (don't jump too much)
        const correctionDirection = corrected.nextWaveTime > expectedNextWaveTime ? -1 : 1;
        const correctionAmount = Math.min(drift * 0.5, MAX_WAVE_DELAY_MS);
        corrected.nextWaveTime += correctionDirection * correctionAmount;
    }

    // Ensure minimum interval before next wave (only if war is active)
    if (corrected.currentWave > 1 && isWarActive) {
        const lastWaveTime = corrected.startTime + ((corrected.currentWave - 2) * WAR_WAVE_INTERVAL_MS);
        const minNextWaveTime = lastWaveTime + MIN_WAVE_INTERVAL_MS;
        
        if (corrected.nextWaveTime < minNextWaveTime) {
            corrected.nextWaveTime = minNextWaveTime;
        }
    }

    // Ensure war doesn't end prematurely
    if (corrected.nextWaveTime > warEndTime) {
        corrected.nextWaveTime = warEndTime;
    }

    return corrected;
};

// ============================================
// EXPORTED VALIDATION HOOKS
// ============================================

/**
 * Main validation function for war system state
 * Should be called before processing any war tick
 */
export const validateWarSystem = (state: GameState): { valid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate active war
    if (state.activeWar) {
        if (!isValidWarState(state.activeWar)) {
            errors.push('Active war state is invalid');
            const sanitized = sanitizeWarState(state.activeWar, state.empirePoints);
            if (!sanitized) {
                errors.push('War state is beyond repair - must be terminated');
            } else {
                warnings.push('War state was sanitized and repaired');
            }
        } else {
            const consistencyIssues = checkWarConsistency(state.activeWar, state.empirePoints);
            if (consistencyIssues.length > 0) {
                warnings.push(...consistencyIssues);
            }
        }
    }

    // Validate incoming attacks
    const invalidAttacks = state.incomingAttacks.filter(a => !isValidIncomingAttack(a));
    if (invalidAttacks.length > 0) {
        errors.push(`${invalidAttacks.length} invalid incoming attacks detected`);
    }

    const attackIssues = checkAttackConsistency(state.incomingAttacks);
    if (attackIssues.length > 0) {
        warnings.push(...attackIssues);
    }

    // Validate war cooldown (if applicable)
    if (state.activeWar === null && state.lastInterestPayoutTime) {
        // Could add cooldown validation here if needed
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
};

// Re-export SCORE_TO_RESOURCE_VALUE for use in validation
import { SCORE_TO_RESOURCE_VALUE } from '../../constants';
