/**
 * ANTI-EXPLOIT & SECURITY MEASURES
 * Protects war system from exploits, cheating, and edge cases
 */

import { GameState, WarState, IncomingAttack, ResourceType, UnitType, BuildingType } from '../../types';
import { WAR_DURATION_MS, WAR_TOTAL_WAVES, WAR_PLAYER_ATTACKS, WAR_OVERTIME_MS, WAR_WAVE_INTERVAL_MS, SCORE_TO_RESOURCE_VALUE } from '../../constants';

// ============================================
// EXPLOIT DETECTION
// ============================================

interface ExploitDetection {
    detected: boolean;
    type: string | null;
    severity: 'low' | 'medium' | 'high' | 'critical';
    evidence: Record<string, any>;
    recommendedAction: string;
}

/**
 * Detects potential war system exploits
 */
export const detectWarExploits = (state: GameState, war: WarState): ExploitDetection => {
    const now = Date.now();

    // Check 1: Impossible wave timing
    const timeSinceStart = now - war.startTime;
    const expectedMaxWave = Math.floor(timeSinceStart / WAR_WAVE_INTERVAL_MS) + 2; // 2 wave buffer
    
    if (war.currentWave > expectedMaxWave + 10) { // Allow 10 wave buffer for offline
        return {
            detected: true,
            type: 'IMPOSSIBLE_WAVE_PROGRESS',
            severity: 'high',
            evidence: {
                currentWave: war.currentWave,
                expectedMaxWave,
                timeSinceStart,
                warStartTime: war.startTime
            },
            recommendedAction: 'Cap wave number to expected maximum'
        };
    }

    // Check 2: Impossible victory count
    const totalBattles = war.playerVictories + war.enemyVictories;
    const maxPossibleBattles = Math.min(war.currentWave - 1, war.totalWaves);
    
    if (totalBattles > maxPossibleBattles + 5) { // Allow 5 battle buffer
        return {
            detected: true,
            type: 'IMPOSSIBLE_VICTORY_COUNT',
            severity: 'critical',
            evidence: {
                totalBattles,
                maxPossibleBattles,
                playerVictories: war.playerVictories,
                enemyVictories: war.enemyVictories
            },
            recommendedAction: 'Reset victory counts to match wave progress'
        };
    }

    // Check 3: Loot pool overflow
    const maxExpectedLoot = war.enemyScore * SCORE_TO_RESOURCE_VALUE * war.currentWave * 0.5;
    const actualLoot = Object.values(war.lootPool).reduce((a, b) => a + b, 0);
    
    if (actualLoot > maxExpectedLoot * 2) { // 2x buffer for variance
        return {
            detected: true,
            type: 'LOOT_POOL_OVERFLOW',
            severity: 'critical',
            evidence: {
                actualLoot,
                maxExpectedLoot,
                lootPool: war.lootPool
            },
            recommendedAction: 'Cap loot pool to maximum expected value'
        };
    }

    // Check 4: Resource loss overflow
    const maxPlayerLoss = state.empirePoints * SCORE_TO_RESOURCE_VALUE * war.currentWave;
    const actualPlayerLoss = Object.values(war.playerResourceLosses).reduce((a, b) => a + b, 0);
    
    if (actualPlayerLoss > maxPlayerLoss * 1.5) {
        return {
            detected: true,
            type: 'RESOURCE_LOSS_OVERFLOW',
            severity: 'high',
            evidence: {
                actualPlayerLoss,
                maxPlayerLoss,
                playerResourceLosses: war.playerResourceLosses
            },
            recommendedAction: 'Cap resource losses to maximum expected'
        };
    }

    // Check 5: Impossible war duration
    const maxWarDuration = WAR_DURATION_MS + (WAR_OVERTIME_MS * 20); // Max 20 overtime extensions
    
    if (war.duration > maxWarDuration) {
        return {
            detected: true,
            type: 'IMPOSSIBLE_WAR_DURATION',
            severity: 'high',
            evidence: {
                currentDuration: war.duration,
                maxDuration: maxWarDuration,
                overtimeCount: Math.floor((war.duration - WAR_DURATION_MS) / WAR_OVERTIME_MS)
            },
            recommendedAction: 'Cap war duration to maximum allowed'
        };
    }

    // Check 6: Attack speed exploit
    const timeBetweenWaves = war.nextWaveTime - (war.startTime + ((war.currentWave - 2) * WAR_WAVE_INTERVAL_MS));
    
    if (war.currentWave > 1 && timeBetweenWaves < WAR_WAVE_INTERVAL_MS * 0.5) {
        return {
            detected: true,
            type: 'ATTACK_SPEED_EXPLOIT',
            severity: 'medium',
            evidence: {
                timeBetweenWaves,
                expectedInterval: WAR_WAVE_INTERVAL_MS,
                nextWaveTime: war.nextWaveTime
            },
            recommendedAction: 'Enforce minimum wave interval'
        };
    }

    // Check 7: Enemy score manipulation
    const scoreRatio = war.enemyScore / Math.max(1, state.empirePoints);
    const minRatio = 0.1;
    const maxRatio = 10.0;
    
    if (scoreRatio < minRatio || scoreRatio > maxRatio) {
        return {
            detected: true,
            type: 'ENEMY_SCORE_MANIPULATION',
            severity: 'medium',
            evidence: {
                enemyScore: war.enemyScore,
                playerScore: state.empirePoints,
                scoreRatio
            },
            recommendedAction: 'Clamp enemy score to valid range'
        };
    }

    // Check 8: Unit loss impossibility
    const totalPlayerUnits = Object.values(state.units).reduce((a, b) => a + b, 0);
    
    if (war.playerUnitLosses > totalPlayerUnits * war.currentWave) {
        return {
            detected: true,
            type: 'UNIT_LOSS_OVERFLOW',
            severity: 'high',
            evidence: {
                reportedLosses: war.playerUnitLosses,
                totalUnits: totalPlayerUnits,
                currentWave: war.currentWave
            },
            recommendedAction: 'Cap unit losses to realistic maximum'
        };
    }

    return {
        detected: false,
        type: null,
        severity: 'low',
        evidence: {},
        recommendedAction: ''
    };
};

/**
 * Detects attack exploits
 */
export const detectAttackExploits = (attack: IncomingAttack, state: GameState): ExploitDetection => {
    const now = Date.now();

    // Check 1: Impossible travel time
    const travelTime = attack.endTime - attack.startTime;
    const minTravelTime = 5 * 60 * 1000; // 5 minutes
    const maxTravelTime = 60 * 60 * 1000; // 1 hour
    
    if (travelTime < minTravelTime || travelTime > maxTravelTime) {
        return {
            detected: true,
            type: 'IMPOSSIBLE_TRAVEL_TIME',
            severity: 'high',
            evidence: {
                travelTime,
                minTravelTime,
                maxTravelTime,
                startTime: attack.startTime,
                endTime: attack.endTime
            },
            recommendedAction: 'Set travel time to standard value'
        };
    }

    // Check 2: Attack in far past
    if (attack.endTime < now - (24 * 60 * 60 * 1000)) {
        return {
            detected: true,
            type: 'STALE_ATTACK',
            severity: 'medium',
            evidence: {
                attackEndTime: attack.endTime,
                currentTime: now,
                ageHours: (now - attack.endTime) / (60 * 60 * 1000)
            },
            recommendedAction: 'Remove stale attack'
        };
    }

    // Check 3: Attack in far future
    if (attack.startTime > now + (24 * 60 * 60 * 1000)) {
        return {
            detected: true,
            type: 'FUTURE_ATTACK',
            severity: 'medium',
            evidence: {
                attackStartTime: attack.startTime,
                currentTime: now
            },
            recommendedAction: 'Remove or reschedule attack'
        };
    }

    // Check 4: Army size exploit
    const totalUnits = Object.values(attack.units).reduce((a, b) => a + (b || 0), 0);
    const maxExpectedUnits = Math.floor(attack.attackerScore / 100) * 10; // Rough estimate
    
    if (totalUnits > maxExpectedUnits * 5) {
        return {
            detected: true,
            type: 'ARMY_SIZE_OVERFLOW',
            severity: 'critical',
            evidence: {
                totalUnits,
                maxExpectedUnits,
                attackerScore: attack.attackerScore,
                armyComposition: attack.units
            },
            recommendedAction: 'Regenerate army with valid composition'
        };
    }

    // Check 5: Invalid unit types
    const validUnitTypes = Object.values(UnitType);
    for (const [unitType, count] of Object.entries(attack.units)) {
        if (!validUnitTypes.includes(unitType as UnitType)) {
            return {
                detected: true,
                type: 'INVALID_UNIT_TYPE',
                severity: 'high',
                evidence: {
                    invalidUnit: unitType,
                    count,
                    armyComposition: attack.units
                },
                recommendedAction: 'Remove invalid unit type'
            };
        }
        if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
            return {
                detected: true,
                type: 'INVALID_UNIT_COUNT',
                severity: 'high',
                evidence: {
                    unitType,
                    count,
                    armyComposition: attack.units
                },
                recommendedAction: 'Sanitize unit count'
            };
        }
    }

    return {
        detected: false,
        type: null,
        severity: 'low',
        evidence: {},
        recommendedAction: ''
    };
};

// ============================================
// ANTI-CHEAT MEASURES
// ============================================

/**
 * Rate limiter for war actions
 */
class RateLimiter {
    private limits: Map<string, { count: number; resetTime: number }> = new Map();

    constructor(
        private maxActions: number,
        private windowMs: number
    ) {}

    check(key: string): boolean {
        const now = Date.now();
        const record = this.limits.get(key);

        if (!record || now >= record.resetTime) {
            this.limits.set(key, { count: 1, resetTime: now + this.windowMs });
            return true;
        }

        if (record.count >= this.maxActions) {
            return false;
        }

        record.count++;
        return true;
    }

    reset(key: string): void {
        this.limits.delete(key);
    }

    getRemaining(key: string): number {
        const now = Date.now();
        const record = this.limits.get(key);

        if (!record || now >= record.resetTime) {
            return this.maxActions;
        }

        return this.maxActions - record.count;
    }

    getResetTime(key: string): number {
        const record = this.limits.get(key);
        return record?.resetTime || 0;
    }
}

// Global rate limiters
export const warAttackLimiter = new RateLimiter(WAR_PLAYER_ATTACKS, WAR_DURATION_MS);
export const enemyAttackLimiter = new RateLimiter(3, 24 * 60 * 60 * 1000); // 3 attacks per 24h

/**
 * Checks if player can launch war attack
 */
export const canPlayerAttack = (war: WarState, playerId: string): { allowed: boolean; reason?: string; remaining?: number } => {
    if (war.playerAttacksLeft <= 0) {
        return { allowed: false, reason: 'No attacks remaining' };
    }

    if (!warAttackLimiter.check(`war-${war.id}-${playerId}`)) {
        const remaining = warAttackLimiter.getRemaining(`war-${war.id}-${playerId}`);
        const resetTime = warAttackLimiter.getResetTime(`war-${war.id}-${playerId}`);
        return { 
            allowed: false, 
            reason: 'Attack rate limit exceeded',
            remaining,
        };
    }

    return { allowed: true, remaining: war.playerAttacksLeft };
};

/**
 * Checks if enemy can attack player
 */
export const canEnemyAttack = (enemyId: string): { allowed: boolean; reason?: string } => {
    if (!enemyAttackLimiter.check(`enemy-${enemyId}`)) {
        return { allowed: false, reason: 'Enemy attack cooldown active' };
    }

    return { allowed: true };
};

// ============================================
// STATE INTEGRITY CHECKS
// ============================================

/**
 * Deep integrity check for war state
 */
export const checkWarIntegrity = (war: WarState, state: GameState): { valid: boolean; issues: string[] } => {
    const issues: string[] = [];

    // Check 1: Resource record consistency
    const requiredResources = [ResourceType.MONEY, ResourceType.OIL, ResourceType.AMMO, ResourceType.GOLD, ResourceType.DIAMOND];
    for (const res of requiredResources) {
        if (typeof war.lootPool[res] !== 'number' || war.lootPool[res] < 0) {
            issues.push(`Invalid loot pool for ${res}`);
        }
        if (typeof war.playerResourceLosses[res] !== 'number' || war.playerResourceLosses[res] < 0) {
            issues.push(`Invalid player resource loss for ${res}`);
        }
        if (typeof war.enemyResourceLosses[res] !== 'number' || war.enemyResourceLosses[res] < 0) {
            issues.push(`Invalid enemy resource loss for ${res}`);
        }
    }

    // Check 2: Victory count consistency
    if (war.playerVictories < 0 || war.enemyVictories < 0) {
        issues.push('Negative victory count detected');
    }

    if (Math.abs(war.playerVictories - war.enemyVictories) > war.currentWave) {
        issues.push('Victory count difference exceeds wave number');
    }

    // Check 3: Wave progression logic
    if (war.currentWave > war.totalWaves && war.playerVictories === war.enemyVictories) {
        // Should be in overtime
        const expectedOvertimeWaves = Math.ceil((war.duration - WAR_DURATION_MS) / WAR_OVERTIME_MS);
        if (war.totalWaves < WAR_TOTAL_WAVES + expectedOvertimeWaves) {
            issues.push('Overtime wave count mismatch');
        }
    }

    // Check 4: Timing consistency
    const now = Date.now();
    const warEndTime = war.startTime + war.duration;
    
    if (war.nextWaveTime > warEndTime && now < warEndTime) {
        issues.push('Next wave time exceeds war end time');
    }

    if (war.startTime > now) {
        issues.push('War start time is in the future');
    }

    // Check 5: Unit record integrity
    for (const [unitType, count] of Object.entries(war.currentEnemyGarrison)) {
        if (!Object.values(UnitType).includes(unitType as UnitType)) {
            issues.push(`Invalid unit type in garrison: ${unitType}`);
        }
        if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
            issues.push(`Invalid unit count in garrison for ${unitType}`);
        }
    }

    // Check 6: Score consistency
    const scoreRatio = war.enemyScore / Math.max(1, state.empirePoints);
    if (scoreRatio < 0.01 || scoreRatio > 100) {
        issues.push(`Extreme score ratio: ${scoreRatio}`);
    }

    // Check 7: Attacks remaining consistency
    if (war.playerAttacksLeft < 0) {
        issues.push('Negative attacks remaining');
    }
    
    const expectedAttacks = WAR_PLAYER_ATTACKS + Math.max(0, war.totalWaves - WAR_TOTAL_WAVES);
    if (war.playerAttacksLeft > expectedAttacks) {
        issues.push(`Attacks remaining exceeds maximum: ${war.playerAttacksLeft} > ${expectedAttacks}`);
    }

    return {
        valid: issues.length === 0,
        issues
    };
};

// ============================================
// AUTOMATIC REMEDIATION
// ============================================

/**
 * Automatically fixes detected exploits
 */
export const remediateWarExploit = (
    state: GameState,
    war: WarState,
    detection: ExploitDetection
): { state: GameState; war: WarState; applied: string[] } => {
    const applied: string[] = [];
    const newWar = { ...war };
    const newState = { ...state };

    switch (detection.type) {
        case 'IMPOSSIBLE_WAVE_PROGRESS':
            const maxWave = Math.floor((Date.now() - war.startTime) / WAR_WAVE_INTERVAL_MS) + 2;
            newWar.currentWave = Math.min(maxWave, WAR_TOTAL_WAVES + 20);
            applied.push('Capped wave progression');
            break;

        case 'IMPOSSIBLE_VICTORY_COUNT':
            const maxBattles = Math.min(newWar.currentWave - 1, newWar.totalWaves);
            newWar.playerVictories = Math.min(newWar.playerVictories, maxBattles);
            newWar.enemyVictories = Math.min(newWar.enemyVictories, maxBattles);
            applied.push('Capped victory counts');
            break;

        case 'LOOT_POOL_OVERFLOW':
            const maxLoot = war.enemyScore * SCORE_TO_RESOURCE_VALUE * war.currentWave * 0.5;
            const scale = maxLoot / Math.max(1, Object.values(war.lootPool).reduce((a, b) => a + b, 0));
            (Object.keys(newWar.lootPool) as ResourceType[]).forEach(key => {
                newWar.lootPool[key] = Math.floor(newWar.lootPool[key] * scale);
            });
            applied.push('Capped loot pool');
            break;

        case 'RESOURCE_LOSS_OVERFLOW':
            const maxLoss = state.empirePoints * SCORE_TO_RESOURCE_VALUE * war.currentWave;
            const totalLoss = Object.values(war.playerResourceLosses).reduce((a, b) => a + b, 0);
            if (totalLoss > maxLoss) {
                const lossScale = maxLoss / totalLoss;
                (Object.keys(newWar.playerResourceLosses) as ResourceType[]).forEach(key => {
                    newWar.playerResourceLosses[key] = Math.floor(newWar.playerResourceLosses[key] * lossScale);
                });
            }
            applied.push('Capped resource losses');
            break;

        case 'IMPOSSIBLE_WAR_DURATION':
            newWar.duration = Math.min(war.duration, WAR_DURATION_MS + (WAR_OVERTIME_MS * 20));
            applied.push('Capped war duration');
            break;

        case 'ENEMY_SCORE_MANIPULATION':
            const playerScore = state.empirePoints;
            newWar.enemyScore = Math.max(
                playerScore * 0.1,
                Math.min(playerScore * 10, war.enemyScore)
            );
            applied.push('Clamped enemy score');
            break;

        case 'UNIT_LOSS_OVERFLOW':
            const totalUnits = Object.values(state.units).reduce((a, b) => a + b, 0);
            newWar.playerUnitLosses = Math.min(war.playerUnitLosses, totalUnits * war.currentWave);
            applied.push('Capped unit losses');
            break;
    }

    return {
        state: newState,
        war: newWar,
        applied
    };
};

/**
 * Sanitizes attack and returns cleaned version
 */
export const sanitizeAttack = (attack: IncomingAttack): IncomingAttack => {
    const sanitized = { ...attack };

    // Fix travel time
    const travelTime = attack.endTime - attack.startTime;
    if (travelTime < 5 * 60 * 1000) {
        sanitized.endTime = attack.startTime + (15 * 60 * 1000); // Standard 15 min
    } else if (travelTime > 60 * 60 * 1000) {
        sanitized.endTime = attack.startTime + (15 * 60 * 1000);
    }

    // Sanitize army
    const validUnits: Partial<Record<UnitType, number>> = {};
    for (const [unitType, count] of Object.entries(attack.units)) {
        if (Object.values(UnitType).includes(unitType as UnitType)) {
            if (typeof count === 'number' && count >= 0 && Number.isInteger(count)) {
                validUnits[unitType as UnitType] = count;
            }
        }
    }
    sanitized.units = validUnits;

    // Ensure valid attacker score
    if (typeof attack.attackerScore !== 'number' || attack.attackerScore <= 0) {
        sanitized.attackerScore = 1000;
    }

    return sanitized;
};
