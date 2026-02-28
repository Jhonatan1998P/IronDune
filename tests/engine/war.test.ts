/**
 * WAR SYSTEM UNIT TESTS
 * Comprehensive test suite for total war logic
 * Covers validation, sanitization, combat, loot distribution, and anti-exploit measures
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResourceType, UnitType, BuildingType, WarState, GameState, IncomingAttack } from '../../types';
import { BotPersonality } from '../../types/enums';
import {
    isValidWarState,
    isValidResourceRecord,
    isValidUnitRecord,
    isValidIncomingAttack,
    sanitizeWarState,
    sanitizeResourceRecord,
    sanitizeUnitRecord,
    sanitizeIncomingAttacks,
    checkWarConsistency,
    checkAttackConsistency,
    correctWaveTiming,
    validateWarSystem
} from '../../utils/engine/warValidation';
import {
    detectWarExploits,
    detectAttackExploits,
    checkWarIntegrity,
    remediateWarExploit,
    sanitizeAttack,
    canPlayerAttack,
    canEnemyAttack
} from '../../utils/engine/warSecurity';
import {
    generateWarWave,
    startWar,
    distributeWarLoot,
    processWarTick
} from '../../utils/engine/war';
import {
    WAR_DURATION_MS,
    WAR_TOTAL_WAVES,
    WAR_PLAYER_ATTACKS,
    WAR_OVERTIME_MS,
    WAR_WAVE_INTERVAL_MS,
    SCORE_TO_RESOURCE_VALUE,
    NEWBIE_PROTECTION_THRESHOLD
} from '../../constants';
import { MIN_WAVE_INTERVAL_MS } from '../../utils/engine/warValidation';

// ============================================
// TEST UTILITIES
// ============================================

const createMockGameState = (overrides?: Partial<GameState>): GameState => ({
    saveVersion: 6,
    playerName: 'TestPlayer',
    hasChangedName: false,
    resources: {
        [ResourceType.MONEY]: 1000000,
        [ResourceType.OIL]: 10000,
        [ResourceType.AMMO]: 5000,
        [ResourceType.GOLD]: 1000,
        [ResourceType.DIAMOND]: 100
    },
    maxResources: {
        [ResourceType.MONEY]: 10000000,
        [ResourceType.OIL]: 100000,
        [ResourceType.AMMO]: 50000,
        [ResourceType.GOLD]: 10000,
        [ResourceType.DIAMOND]: 1000
    },
    buildings: {
        [BuildingType.BANK]: { level: 5 },
        [BuildingType.DIAMOND_MINE]: { level: 1 }
    } as any,
    units: {
        [UnitType.CYBER_MARINE]: 100,
        [UnitType.HEAVY_COMMANDO]: 50,
        [UnitType.SCOUT_TANK]: 30,
        [UnitType.TITAN_MBT]: 20
    } as any,
    researchedTechs: [],
    techLevels: {},
    activeResearch: null,
    activeMissions: [],
    activeRecruitments: [],
    activeConstructions: [],
    bankBalance: 5000000,
    currentInterestRate: 0.05,
    nextRateChangeTime: Date.now() + 3600000,
    lastInterestPayoutTime: Date.now(),
    empirePoints: 50000,
    lastSaveTime: Date.now(),
    campaignProgress: 0,
    lastCampaignMissionFinishedTime: 0,
    marketOffers: [],
    marketNextRefreshTime: Date.now() + 3600000,
    activeMarketEvent: null,
    completedTutorials: [],
    currentTutorialId: null,
    tutorialClaimable: false,
    tutorialAccepted: false,
    isTutorialMinimized: false,
    nextAttackTime: Date.now() + 3600000,
    incomingAttacks: [],
    activeWar: null,
    grudges: [],
    enemyAttackCounts: {},
    lastEnemyAttackCheckTime: Date.now(),
    lastEnemyAttackResetTime: Date.now(),
    spyReports: [],
    targetAttackCounts: {},
    lastAttackResetTime: Date.now(),
    rankingData: {
        bots: [
            {
                id: 'bot-1',
                name: 'EnemyBot',
                personality: BotPersonality.WARLORD,
                stats: { dominion: 45000, economy: 40000, military: 50000 },
                reputation: 25
            }
        ],
        lastUpdateTime: Date.now()
    },
    diplomaticActions: {},
    lastReputationDecayTime: Date.now(),
    lifetimeStats: {
        enemiesKilled: 0,
        unitsLost: 0,
        resourcesMined: 0,
        missionsCompleted: 0,
        highestRankAchieved: 1
    },
    redeemedGiftCodes: [],
    giftCodeCooldowns: {},
    logs: [],
    ...overrides
});

const createMockWarState = (overrides?: Partial<WarState>): WarState => ({
    id: 'war-test-1',
    enemyId: 'bot-1',
    enemyName: 'EnemyBot',
    enemyScore: 45000,
    startTime: Date.now(),
    duration: WAR_DURATION_MS,
    nextWaveTime: Date.now() + WAR_WAVE_INTERVAL_MS,
    currentWave: 1,
    totalWaves: WAR_TOTAL_WAVES,
    playerVictories: 0,
    enemyVictories: 0,
    playerAttacksLeft: WAR_PLAYER_ATTACKS,
    lootPool: {
        [ResourceType.MONEY]: 0,
        [ResourceType.OIL]: 0,
        [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0,
        [ResourceType.DIAMOND]: 0
    },
    playerResourceLosses: {
        [ResourceType.MONEY]: 0,
        [ResourceType.OIL]: 0,
        [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0,
        [ResourceType.DIAMOND]: 0
    },
    enemyResourceLosses: {
        [ResourceType.MONEY]: 0,
        [ResourceType.OIL]: 0,
        [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0,
        [ResourceType.DIAMOND]: 0
    },
    playerUnitLosses: 0,
    enemyUnitLosses: 0,
    currentEnemyGarrison: {
        [UnitType.CYBER_MARINE]: 50,
        [UnitType.HEAVY_COMMANDO]: 30
    },
    ...overrides
});

// ============================================
// VALIDATION TESTS
// ============================================

describe('War Validation', () => {
    describe('isValidWarState', () => {
        it('should validate a correct war state', () => {
            const war = createMockWarState();
            expect(isValidWarState(war)).toBe(true);
        });

        it('should reject null war state', () => {
            expect(isValidWarState(null)).toBe(false);
        });

        it('should reject war with missing enemyId', () => {
            const war = createMockWarState({ enemyId: '' });
            expect(isValidWarState(war)).toBe(false);
        });

        it('should reject war with negative victories', () => {
            const war = createMockWarState({ playerVictories: -1 });
            expect(isValidWarState(war)).toBe(false);
        });

        it('should reject war with invalid wave number', () => {
            const war = createMockWarState({ currentWave: 0 });
            expect(isValidWarState(war)).toBe(false);
        });

        it('should reject war with excessive wave number', () => {
            const war = createMockWarState({ currentWave: 101 });
            expect(isValidWarState(war)).toBe(false);
        });

        it('should reject war with invalid duration', () => {
            const war = createMockWarState({ duration: 1000 }); // Too short
            expect(isValidWarState(war)).toBe(false);
        });
    });

    describe('isValidResourceRecord', () => {
        it('should validate correct resource record', () => {
            const record = {
                [ResourceType.MONEY]: 1000,
                [ResourceType.OIL]: 500,
                [ResourceType.AMMO]: 300,
                [ResourceType.GOLD]: 100,
                [ResourceType.DIAMOND]: 50
            };
            expect(isValidResourceRecord(record)).toBe(true);
        });

        it('should reject record with missing resources', () => {
            const record = {
                [ResourceType.MONEY]: 1000,
                [ResourceType.OIL]: 500
            };
            expect(isValidResourceRecord(record)).toBe(false);
        });

        it('should reject record with negative values', () => {
            const record = {
                [ResourceType.MONEY]: -1000,
                [ResourceType.OIL]: 500,
                [ResourceType.AMMO]: 300,
                [ResourceType.GOLD]: 100,
                [ResourceType.DIAMOND]: 50
            };
            expect(isValidResourceRecord(record)).toBe(false);
        });

        it('should reject non-object records', () => {
            expect(isValidResourceRecord(null)).toBe(false);
            expect(isValidResourceRecord('string')).toBe(false);
        });
    });

    describe('isValidUnitRecord', () => {
        it('should validate correct unit record', () => {
            const record = {
                [UnitType.CYBER_MARINE]: 100,
                [UnitType.HEAVY_COMMANDO]: 50
            };
            expect(isValidUnitRecord(record)).toBe(true);
        });

        it('should accept empty unit record', () => {
            expect(isValidUnitRecord({})).toBe(true);
        });

        it('should reject record with invalid unit types', () => {
            const record = {
                'INVALID_UNIT': 100,
                [UnitType.CYBER_MARINE]: 50
            };
            expect(isValidUnitRecord(record)).toBe(false);
        });

        it('should reject record with negative counts', () => {
            const record = {
                [UnitType.CYBER_MARINE]: -100
            };
            expect(isValidUnitRecord(record)).toBe(false);
        });

        it('should reject record with non-integer counts', () => {
            const record = {
                [UnitType.CYBER_MARINE]: 100.5
            };
            expect(isValidUnitRecord(record)).toBe(false);
        });
    });

    describe('isValidIncomingAttack', () => {
        it('should validate correct incoming attack', () => {
            const attack: IncomingAttack = {
                id: 'attack-1',
                attackerName: 'Enemy',
                attackerScore: 50000,
                units: { [UnitType.CYBER_MARINE]: 100 },
                startTime: Date.now(),
                endTime: Date.now() + 900000,
                isWarWave: false,
                delayCount: 0
            };
            expect(isValidIncomingAttack(attack)).toBe(true);
        });

        it('should reject attack with missing fields', () => {
            const attack = {
                id: 'attack-1',
                attackerName: 'Enemy'
            } as any;
            expect(isValidIncomingAttack(attack)).toBe(false);
        });

        it('should reject attack with invalid end time', () => {
            const attack: IncomingAttack = {
                id: 'attack-1',
                attackerName: 'Enemy',
                attackerScore: 50000,
                units: { [UnitType.CYBER_MARINE]: 100 },
                startTime: Date.now() + 1000000,
                endTime: Date.now(),
                isWarWave: false
            };
            expect(isValidIncomingAttack(attack)).toBe(false);
        });
    });
});

// ============================================
// SANITIZATION TESTS
// ============================================

describe('War Sanitization', () => {
    describe('sanitizeWarState', () => {
        it('should repair war state with minor issues', () => {
            const war = createMockWarState({
                playerVictories: -5,
                enemyVictories: -3
            });
            const sanitized = sanitizeWarState(war, 50000);
            expect(sanitized).not.toBeNull();
            expect(sanitized!.playerVictories).toBeGreaterThanOrEqual(0);
            expect(sanitized!.enemyVictories).toBeGreaterThanOrEqual(0);
        });

        it('should clamp enemy score to valid range', () => {
            const war = createMockWarState({
                enemyScore: 1000000000 // Extremely high
            });
            const sanitized = sanitizeWarState(war, 50000);
            expect(sanitized).not.toBeNull();
            expect(sanitized!.enemyScore).toBeLessThanOrEqual(50000 * 10);
        });

        it('should sanitize resource records', () => {
            const war = createMockWarState({
                lootPool: {
                    [ResourceType.MONEY]: -1000,
                    [ResourceType.OIL]: NaN,
                    [ResourceType.AMMO]: Infinity,
                    [ResourceType.GOLD]: 100,
                    [ResourceType.DIAMOND]: 50
                } as any
            });
            const sanitized = sanitizeWarState(war, 50000);
            expect(sanitized).not.toBeNull();
            expect(sanitized!.lootPool[ResourceType.MONEY]).toBeGreaterThanOrEqual(0);
            expect(sanitized!.lootPool[ResourceType.OIL]).toBeGreaterThanOrEqual(0);
        });

        it('should return null for unrepairable war', () => {
            const war = {
                ...createMockWarState(),
                enemyId: '',
                id: ''
            } as any;
            const sanitized = sanitizeWarState(war, 50000);
            expect(sanitized).toBeNull();
        });

        it('should apply loot pool cap', () => {
            const maxLoot = 50000 * SCORE_TO_RESOURCE_VALUE * 10;
            const war = createMockWarState({
                lootPool: {
                    [ResourceType.MONEY]: maxLoot * 2,
                    [ResourceType.OIL]: maxLoot * 2,
                    [ResourceType.AMMO]: maxLoot * 2,
                    [ResourceType.GOLD]: maxLoot * 2,
                    [ResourceType.DIAMOND]: maxLoot * 2
                }
            });
            const sanitized = sanitizeWarState(war, 50000);
            expect(sanitized).not.toBeNull();
            const totalLoot = Object.values(sanitized!.lootPool).reduce((a, b) => a + b, 0);
            expect(totalLoot).toBeLessThanOrEqual(maxLoot * 5); // 5 resources
        });
    });

    describe('sanitizeResourceRecord', () => {
        it('should fix missing resources', () => {
            const record = {
                [ResourceType.MONEY]: 1000
            } as any;
            const sanitized = sanitizeResourceRecord(record);
            expect(sanitized[ResourceType.MONEY]).toBe(1000);
            expect(sanitized[ResourceType.OIL]).toBe(0);
            expect(sanitized[ResourceType.AMMO]).toBe(0);
        });

        it('should fix negative values', () => {
            const record = {
                [ResourceType.MONEY]: -1000,
                [ResourceType.OIL]: 500,
                [ResourceType.AMMO]: 300,
                [ResourceType.GOLD]: 100,
                [ResourceType.DIAMOND]: 50
            };
            const sanitized = sanitizeResourceRecord(record);
            expect(sanitized[ResourceType.MONEY]).toBe(0);
            expect(sanitized[ResourceType.OIL]).toBe(500);
        });

        it('should handle null input', () => {
            const sanitized = sanitizeResourceRecord(null as any);
            expect(sanitized[ResourceType.MONEY]).toBe(0);
            expect(sanitized[ResourceType.OIL]).toBe(0);
        });
    });

    describe('sanitizeUnitRecord', () => {
        it('should remove invalid unit types', () => {
            const record = {
                'INVALID_UNIT': 100,
                [UnitType.CYBER_MARINE]: 50
            } as any;
            const sanitized = sanitizeUnitRecord(record);
            expect(sanitized['INVALID_UNIT']).toBeUndefined();
            expect(sanitized[UnitType.CYBER_MARINE]).toBe(50);
        });

        it('should fix negative counts', () => {
            const record = {
                [UnitType.CYBER_MARINE]: -100
            } as any;
            const sanitized = sanitizeUnitRecord(record);
            expect(sanitized[UnitType.CYBER_MARINE]).toBeUndefined();
        });
    });

    describe('sanitizeIncomingAttacks', () => {
        it('should filter invalid attacks', () => {
            const attacks: any[] = [
                {
                    id: 'valid-1',
                    attackerName: 'Enemy',
                    attackerScore: 50000,
                    units: { [UnitType.CYBER_MARINE]: 100 },
                    startTime: Date.now(),
                    endTime: Date.now() + 900000
                },
                {
                    id: 'invalid-1',
                    attackerName: ''
                }
            ];
            const sanitized = sanitizeIncomingAttacks(attacks);
            expect(sanitized.length).toBe(1);
            expect(sanitized[0].id).toBe('valid-1');
        });

        it('should handle empty array', () => {
            expect(sanitizeIncomingAttacks([])).toEqual([]);
        });

        it('should handle non-array input', () => {
            expect(sanitizeIncomingAttacks(null as any)).toEqual([]);
        });
    });
});

// ============================================
// EXPLOIT DETECTION TESTS
// ============================================

describe('Exploit Detection', () => {
    describe('detectWarExploits', () => {
        it('should not detect exploits in clean war', () => {
            const state = createMockGameState();
            const war = createMockWarState();
            const detection = detectWarExploits(state, war);
            expect(detection.detected).toBe(false);
        });

        it('should detect impossible wave progress', () => {
            const state = createMockGameState();
            const war = createMockWarState({
                currentWave: 100,
                startTime: Date.now() - 60000 // 1 minute ago
            });
            const detection = detectWarExploits(state, war);
            expect(detection.detected).toBe(true);
            expect(detection.type).toBe('IMPOSSIBLE_WAVE_PROGRESS');
        });

        it('should detect impossible victory count', () => {
            const state = createMockGameState();
            const war = createMockWarState({
                currentWave: 2,
                playerVictories: 50,
                enemyVictories: 50
            });
            const detection = detectWarExploits(state, war);
            expect(detection.detected).toBe(true);
            expect(detection.type).toBe('IMPOSSIBLE_VICTORY_COUNT');
        });

        it('should detect loot pool overflow', () => {
            const state = createMockGameState();
            const war = createMockWarState({
                lootPool: {
                    [ResourceType.MONEY]: 1000000000000,
                    [ResourceType.OIL]: 1000000000000,
                    [ResourceType.AMMO]: 1000000000000,
                    [ResourceType.GOLD]: 1000000000000,
                    [ResourceType.DIAMOND]: 1000000000000
                }
            });
            const detection = detectWarExploits(state, war);
            expect(detection.detected).toBe(true);
            expect(detection.type).toBe('LOOT_POOL_OVERFLOW');
        });

        it('should detect impossible war duration', () => {
            const state = createMockGameState();
            const war = createMockWarState({
                duration: WAR_DURATION_MS + (WAR_OVERTIME_MS * 100)
            });
            const detection = detectWarExploits(state, war);
            expect(detection.detected).toBe(true);
            expect(detection.type).toBe('IMPOSSIBLE_WAR_DURATION');
        });
    });

    describe('detectAttackExploits', () => {
        it('should not detect exploits in clean attack', () => {
            const state = createMockGameState();
            const attack: IncomingAttack = {
                id: 'attack-1',
                attackerName: 'Enemy',
                attackerScore: 50000,
                units: { [UnitType.CYBER_MARINE]: 100 },
                startTime: Date.now(),
                endTime: Date.now() + 900000,
                isWarWave: false
            };
            const detection = detectAttackExploits(attack, state);
            expect(detection.detected).toBe(false);
        });

        it('should detect impossible travel time', () => {
            const state = createMockGameState();
            const attack: IncomingAttack = {
                id: 'attack-1',
                attackerName: 'Enemy',
                attackerScore: 50000,
                units: { [UnitType.CYBER_MARINE]: 100 },
                startTime: Date.now(),
                endTime: Date.now() + 1000, // 1 second
                isWarWave: false
            };
            const detection = detectAttackExploits(attack, state);
            expect(detection.detected).toBe(true);
            expect(detection.type).toBe('IMPOSSIBLE_TRAVEL_TIME');
        });

        it('should detect army size overflow', () => {
            const state = createMockGameState();
            const attack: IncomingAttack = {
                id: 'attack-1',
                attackerName: 'Enemy',
                attackerScore: 1000,
                units: { [UnitType.CYBER_MARINE]: 1000000 },
                startTime: Date.now(),
                endTime: Date.now() + 900000,
                isWarWave: false
            };
            const detection = detectAttackExploits(attack, state);
            expect(detection.detected).toBe(true);
            expect(detection.type).toBe('ARMY_SIZE_OVERFLOW');
        });
    });
});

// ============================================
// LOOT DISTRIBUTION TESTS
// ============================================

describe('Loot Distribution', () => {
    describe('distributeWarLoot', () => {
        it('should distribute loot correctly on victory', () => {
            const pool = {
                [ResourceType.MONEY]: 1000000,
                [ResourceType.OIL]: 10000,
                [ResourceType.AMMO]: 5000,
                [ResourceType.GOLD]: 1000,
                [ResourceType.DIAMOND]: 100
            };
            const currentResources = {
                [ResourceType.MONEY]: 500000,
                [ResourceType.OIL]: 5000,
                [ResourceType.AMMO]: 2500,
                [ResourceType.GOLD]: 500,
                [ResourceType.DIAMOND]: 50
            };
            const maxResources = {
                [ResourceType.MONEY]: 10000000,
                [ResourceType.OIL]: 100000,
                [ResourceType.AMMO]: 50000,
                [ResourceType.GOLD]: 10000,
                [ResourceType.DIAMOND]: 1000
            };

            const result = distributeWarLoot(
                pool,
                'PLAYER',
                currentResources,
                maxResources,
                5000000,
                50000,
                { [BuildingType.BANK]: { level: 5 } } as any
            );

            expect(result.resultKey).toBe('war_victory_secured');
            expect(result.newResources[ResourceType.MONEY]).toBeGreaterThan(currentResources[ResourceType.MONEY]);
            expect(result.convertedAmount).toBeGreaterThanOrEqual(0);
        });

        it('should handle overflow to bank', () => {
            const pool = {
                [ResourceType.MONEY]: 100000000,
                [ResourceType.OIL]: 0,
                [ResourceType.AMMO]: 0,
                [ResourceType.GOLD]: 0,
                [ResourceType.DIAMOND]: 0
            };
            const currentResources = {
                [ResourceType.MONEY]: 9999999,
                [ResourceType.OIL]: 0,
                [ResourceType.AMMO]: 0,
                [ResourceType.GOLD]: 0,
                [ResourceType.DIAMOND]: 0
            };
            const maxResources = {
                [ResourceType.MONEY]: 10000000,
                [ResourceType.OIL]: 100000,
                [ResourceType.AMMO]: 50000,
                [ResourceType.GOLD]: 10000,
                [ResourceType.DIAMOND]: 1000
            };

            const result = distributeWarLoot(
                pool,
                'PLAYER',
                currentResources,
                maxResources,
                5000000,
                50000,
                { [BuildingType.BANK]: { level: 10 } } as any
            );

            expect(result.newResources[ResourceType.MONEY]).toBe(10000000);
            expect(result.bankedAmount).toBeGreaterThan(0);
        });

        it('should return defeat result on loss', () => {
            const pool = {
                [ResourceType.MONEY]: 1000000,
                [ResourceType.OIL]: 10000,
                [ResourceType.AMMO]: 5000,
                [ResourceType.GOLD]: 1000,
                [ResourceType.DIAMOND]: 100
            };
            const currentResources = {
                [ResourceType.MONEY]: 500000,
                [ResourceType.OIL]: 5000,
                [ResourceType.AMMO]: 2500,
                [ResourceType.GOLD]: 500,
                [ResourceType.DIAMOND]: 50
            };
            const maxResources = {
                [ResourceType.MONEY]: 10000000,
                [ResourceType.OIL]: 100000,
                [ResourceType.AMMO]: 50000,
                [ResourceType.GOLD]: 10000,
                [ResourceType.DIAMOND]: 1000
            };

            const result = distributeWarLoot(
                pool,
                'ENEMY',
                currentResources,
                maxResources,
                5000000,
                50000,
                { [BuildingType.BANK]: { level: 5 } } as any
            );

            expect(result.resultKey).toBe('defeat_salvage');
            expect(result.newResources).toEqual(currentResources);
            expect(result.bankedAmount).toBe(0);
        });

        it('should handle invalid input gracefully', () => {
            const result = distributeWarLoot(
                null as any,
                'PLAYER',
                null as any,
                null as any,
                0,
                0,
                {} as any
            );

            expect(result.resultKey).toBe('defeat_salvage');
        });
    });
});

// ============================================
// WAVE TIMING TESTS
// ============================================

describe('Wave Timing', () => {
    describe('correctWaveTiming', () => {
        it('should not correct war with minimal drift', () => {
            const now = Date.now();
            const war = createMockWarState({
                startTime: now - 1000000,
                currentWave: 3,
                nextWaveTime: now + WAR_WAVE_INTERVAL_MS,
                duration: WAR_DURATION_MS + 10000000 // Ensure war is still active
            });
            const corrected = correctWaveTiming(war, now);
            // Allow small adjustments due to timing calculations
            expect(Math.abs(corrected.nextWaveTime - war.nextWaveTime)).toBeLessThan(1000);
        });

        it('should correct war with excessive drift', () => {
            const now = Date.now();
            const war = createMockWarState({
                startTime: now - (10 * 60 * 60 * 1000), // 10 hours ago
                currentWave: 3,
                nextWaveTime: now + (100 * 60 * 60 * 1000), // 100 hours in future
                duration: WAR_DURATION_MS + (100 * 60 * 60 * 1000) // Ensure war is still active
            });
            const corrected = correctWaveTiming(war, now);
            expect(corrected.nextWaveTime).not.toBe(war.nextWaveTime);
        });

        it('should ensure wave interval is within bounds', () => {
            const now = Date.now();
            const war = createMockWarState({
                startTime: now - 60000, // 1 minute ago
                currentWave: 2,
                nextWaveTime: now + 1000, // 1 second
                duration: WAR_DURATION_MS + 1000000 // Ensure war is still active
            });
            const corrected = correctWaveTiming(war, now);
            // Minimum interval is 10 minutes from last wave
            const lastWaveTime = war.startTime; // Wave 1 started at startTime
            expect(corrected.nextWaveTime - lastWaveTime).toBeGreaterThanOrEqual(MIN_WAVE_INTERVAL_MS);
        });
    });
});

// ============================================
// INTEGRITY CHECKS
// ============================================

describe('Integrity Checks', () => {
    describe('checkWarConsistency', () => {
        it('should return no issues for consistent war', () => {
            const war = createMockWarState();
            const issues = checkWarConsistency(war, 50000);
            expect(issues.length).toBe(0);
        });

        it('should detect victory count inconsistency', () => {
            const war = createMockWarState({
                currentWave: 2,
                playerVictories: 10,
                enemyVictories: 10
            });
            const issues = checkWarConsistency(war, 50000);
            expect(issues.length).toBeGreaterThan(0);
        });
    });

    describe('checkWarIntegrity', () => {
        it('should validate clean war state', () => {
            const state = createMockGameState();
            const war = createMockWarState();
            const result = checkWarIntegrity(war, state);
            expect(result.valid).toBe(true);
            expect(result.issues.length).toBe(0);
        });

        it('should detect negative victory counts', () => {
            const state = createMockGameState();
            const war = createMockWarState({
                playerVictories: -5
            });
            const result = checkWarIntegrity(war, state);
            expect(result.valid).toBe(false);
            expect(result.issues).toContain('Negative victory count detected');
        });

        it('should detect invalid resource records', () => {
            const state = createMockGameState();
            const war = createMockWarState({
                lootPool: {
                    [ResourceType.MONEY]: -1000,
                    [ResourceType.OIL]: 0,
                    [ResourceType.AMMO]: 0,
                    [ResourceType.GOLD]: 0,
                    [ResourceType.DIAMOND]: 0
                } as any
            });
            const result = checkWarIntegrity(war, state);
            expect(result.valid).toBe(false);
        });
    });
});

// ============================================
// RATE LIMITING TESTS
// ============================================

describe('Rate Limiting', () => {
    describe('canPlayerAttack', () => {
        it('should allow attack when attacks remaining', () => {
            const war = createMockWarState({
                playerAttacksLeft: 5
            });
            const result = canPlayerAttack(war, 'player-1');
            expect(result.allowed).toBe(true);
        });

        it('should deny attack when no attacks remaining', () => {
            const war = createMockWarState({
                playerAttacksLeft: 0
            });
            const result = canPlayerAttack(war, 'player-1');
            expect(result.allowed).toBe(false);
        });
    });
});

// ============================================
// WAVE GENERATION TESTS
// ============================================

describe('Wave Generation', () => {
    describe('generateWarWave', () => {
        it('should generate valid wave for wave 1', () => {
            const state = createMockGameState();
            const war = createMockWarState();
            const wave = generateWarWave(state, 1, war);
            
            expect(wave.id).toContain('war-wave-1');
            expect(wave.isWarWave).toBe(true);
            expect(wave.endTime).toBeGreaterThan(Date.now());
            expect(Object.keys(wave.units).length).toBeGreaterThan(0);
        });

        it('should generate valid wave for wave 8', () => {
            const state = createMockGameState();
            const war = createMockWarState();
            const wave = generateWarWave(state, 8, war);
            
            expect(wave.id).toContain('war-wave-8');
            expect(wave.isWarWave).toBe(true);
        });

        it('should generate valid wave for overtime', () => {
            const state = createMockGameState();
            const war = createMockWarState();
            const wave = generateWarWave(state, 10, war);
            
            expect(wave.id).toContain('war-wave-10');
            expect(wave.isWarWave).toBe(true);
        });

        it('should handle invalid wave numbers', () => {
            const state = createMockGameState();
            const war = createMockWarState();
            const wave = generateWarWave(state, 0, war);
            
            expect(wave).toBeDefined();
            expect(wave.isWarWave).toBe(true);
        });
    });
});

// ============================================
// PROCESS WAR TICK TESTS
// ============================================

describe('Process War Tick', () => {
    describe('processWarTick', () => {
        it('should handle state with no active war', () => {
            const state = createMockGameState();
            const now = Date.now();
            const result = processWarTick(state, now);
            
            expect(result.stateUpdates).toBeDefined();
            expect(result.stateUpdates.activeWar).toBeNull();
            expect(result.logs).toBeDefined();
        });

        it('should process active war tick', () => {
            const state = createMockGameState({
                activeWar: createMockWarState()
            });
            const now = Date.now();
            const result = processWarTick(state, now);
            
            expect(result.stateUpdates).toBeDefined();
            expect(result.stateUpdates.activeWar).toBeDefined();
            expect(result.logs).toBeDefined();
        });

        it('should handle war end condition', () => {
            const war = createMockWarState({
                startTime: Date.now() - (WAR_DURATION_MS + WAR_OVERTIME_MS),
                duration: WAR_DURATION_MS,
                playerVictories: 5,
                enemyVictories: 3,
                currentWave: WAR_TOTAL_WAVES + 5,
                totalWaves: WAR_TOTAL_WAVES + 5
            });
            const state = createMockGameState({
                activeWar: war
            });
            const now = Date.now();
            const result = processWarTick(state, now);
            
            expect(result.stateUpdates.activeWar).toBeNull();
            expect(result.logs.some(log => log.messageKey === 'log_war_ended')).toBe(true);
        });

        it('should handle overtime on tie', () => {
            const war = createMockWarState({
                startTime: Date.now() - WAR_DURATION_MS,
                duration: WAR_DURATION_MS,
                playerVictories: 4,
                enemyVictories: 4,
                currentWave: WAR_TOTAL_WAVES,
                totalWaves: WAR_TOTAL_WAVES
            });
            const state = createMockGameState({
                activeWar: war
            });
            const now = Date.now();
            const result = processWarTick(state, now);
            
            expect(result.stateUpdates.activeWar).toBeDefined();
            expect(result.stateUpdates.activeWar!.duration).toBeGreaterThan(WAR_DURATION_MS);
            expect(result.logs.some(log => log.messageKey === 'log_war_overtime')).toBe(true);
        });
    });
});
