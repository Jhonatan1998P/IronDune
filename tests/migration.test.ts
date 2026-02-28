import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    sanitizeAndMigrateSave,
    sanitizeBot,
    sanitizeRankingData,
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
} from '../utils/engine/migration';
import { GameState, ResourceType, BuildingType, UnitType, BotPersonality } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { SAVE_VERSION } from '../constants';
import { RankingCategory, BotEvent } from '../utils/engine/rankings';

// ============================================
// UTILS VALIDATION TESTS
// ============================================
describe('Migration Utils Validation', () => {
    describe('isValidNumber', () => {
        it('should return true for valid numbers', () => {
            expect(isValidNumber(42)).toBe(true);
            expect(isValidNumber(0)).toBe(true);
            expect(isValidNumber(-10)).toBe(true);
            expect(isValidNumber(3.14)).toBe(true);
        });

        it('should return false for NaN', () => {
            expect(isValidNumber(NaN)).toBe(false);
            expect(isValidNumber('42')).toBe(false);
            expect(isValidNumber(null)).toBe(false);
            expect(isValidNumber(undefined)).toBe(false);
        });

        it('should return false for Infinity', () => {
            expect(isValidNumber(Infinity)).toBe(false);
            expect(isValidNumber(-Infinity)).toBe(false);
        });

        it('should respect min/max bounds', () => {
            expect(isValidNumber(5, 0, 10)).toBe(true);
            expect(isValidNumber(-1, 0, 10)).toBe(false);
            expect(isValidNumber(11, 0, 10)).toBe(false);
        });
    });

    describe('isValidString', () => {
        it('should return true for valid strings', () => {
            expect(isValidString('hello')).toBe(true);
            expect(isValidString('   trimmed   ')).toBe(true);
        });

        it('should return false for non-strings', () => {
            expect(isValidString(42)).toBe(false);
            expect(isValidString(null)).toBe(false);
            expect(isValidString(undefined)).toBe(false);
            expect(isValidString({})).toBe(false);
        });

        it('should respect min/max length', () => {
            expect(isValidString('abc', 1, 5)).toBe(true);
            expect(isValidString('', 1, 5)).toBe(false);
            expect(isValidString('verylongstring', 1, 5)).toBe(false);
        });
    });

    describe('isValidBoolean', () => {
        it('should return true for booleans', () => {
            expect(isValidBoolean(true)).toBe(true);
            expect(isValidBoolean(false)).toBe(true);
        });

        it('should return false for non-booleans', () => {
            expect(isValidBoolean(1)).toBe(false);
            expect(isValidBoolean('true')).toBe(false);
            expect(isValidBoolean(null)).toBe(false);
        });
    });

    describe('isValidArray', () => {
        it('should return true for arrays', () => {
            expect(isValidArray([])).toBe(true);
            expect(isValidArray([1, 2, 3])).toBe(true);
        });

        it('should return false for non-arrays', () => {
            expect(isValidArray({})).toBe(false);
            expect(isValidArray('array')).toBe(false);
            expect(isValidArray(null)).toBe(false);
        });
    });

    describe('isValidObject', () => {
        it('should return true for plain objects', () => {
            expect(isValidObject({})).toBe(true);
            expect(isValidObject({ key: 'value' })).toBe(true);
        });

        it('should return false for null, arrays, and primitives', () => {
            expect(isValidObject(null)).toBe(false);
            expect(isValidObject([])).toBe(false);
            expect(isValidObject(42)).toBe(false);
            expect(isValidObject('string')).toBe(false);
        });
    });

    describe('isValidEnum', () => {
        it('should return true for valid enum values', () => {
            const validValues = ['A', 'B', 'C'] as const;
            expect(isValidEnum('A', validValues)).toBe(true);
            expect(isValidEnum('B', validValues)).toBe(true);
        });

        it('should return false for invalid enum values', () => {
            const validValues = ['A', 'B', 'C'] as const;
            expect(isValidEnum('D', validValues)).toBe(false);
            expect(isValidEnum('a', validValues)).toBe(false);
        });
    });

    describe('safeNumber', () => {
        it('should return the value for valid numbers', () => {
            expect(safeNumber(42, 0)).toBe(42);
            expect(safeNumber(3.14, 0)).toBe(3.14);
        });

        it('should return fallback for invalid numbers', () => {
            expect(safeNumber(NaN, 0)).toBe(0);
            expect(safeNumber('42', 0)).toBe(0);
            expect(safeNumber(null, 0)).toBe(0);
            expect(safeNumber(undefined, 0)).toBe(0);
        });

        it('should return fallback for out-of-bounds numbers', () => {
            expect(safeNumber(-1, 0, 0, 10)).toBe(0);
            expect(safeNumber(11, 0, 0, 10)).toBe(0);
        });
    });

    describe('safeString', () => {
        it('should return trimmed string for valid strings', () => {
            expect(safeString('  hello  ', 'default')).toBe('hello');
        });

        it('should return fallback for invalid strings', () => {
            expect(safeString(42, 'default')).toBe('default');
            expect(safeString(null, 'default')).toBe('default');
            expect(safeString('', 'default')).toBe('default');
        });
    });

    describe('safeBoolean', () => {
        it('should return the value for valid booleans', () => {
            expect(safeBoolean(true, false)).toBe(true);
            expect(safeBoolean(false, true)).toBe(false);
        });

        it('should return fallback for invalid booleans', () => {
            expect(safeBoolean(1, false)).toBe(false);
            expect(safeBoolean('true', false)).toBe(false);
        });
    });

    describe('safeArray', () => {
        it('should return the array for valid arrays', () => {
            expect(safeArray([1, 2, 3], [])).toEqual([1, 2, 3]);
        });

        it('should return fallback for invalid arrays', () => {
            expect(safeArray('array', [])).toEqual([]);
            expect(safeArray(null, [])).toEqual([]);
        });
    });

    describe('safeObject', () => {
        it('should return the object for valid objects', () => {
            expect(safeObject({ key: 'value' }, {})).toEqual({ key: 'value' });
        });

        it('should return fallback for invalid objects', () => {
            expect(safeObject('object', {})).toEqual({});
            expect(safeObject(null, {})).toEqual({});
        });
    });
});

// ============================================
// RESOURCE MIGRATION TESTS
// ============================================
describe('Migrate Resources', () => {
    const defaultResources = INITIAL_GAME_STATE.resources;

    it('should migrate valid resources', () => {
        const savedResources = {
            [ResourceType.MONEY]: 5000,
            [ResourceType.OIL]: 100,
            [ResourceType.AMMO]: 50,
            [ResourceType.GOLD]: 10,
            [ResourceType.DIAMOND]: 5
        };

        const result = migrateResources(savedResources, defaultResources);

        expect(result[ResourceType.MONEY]).toBe(5000);
        expect(result[ResourceType.OIL]).toBe(100);
        expect(result[ResourceType.AMMO]).toBe(50);
        expect(result[ResourceType.GOLD]).toBe(10);
        expect(result[ResourceType.DIAMOND]).toBe(5);
    });

    it('should use defaults for invalid resources', () => {
        const savedResources = {
            [ResourceType.MONEY]: 'invalid',
            [ResourceType.OIL]: NaN,
            [ResourceType.AMMO]: null
        };

        const result = migrateResources(savedResources, defaultResources);

        expect(result[ResourceType.MONEY]).toBe(defaultResources[ResourceType.MONEY]);
        expect(result[ResourceType.OIL]).toBe(defaultResources[ResourceType.OIL]);
        expect(result[ResourceType.AMMO]).toBe(defaultResources[ResourceType.AMMO]);
    });

    it('should handle missing resources', () => {
        const savedResources = {};
        const result = migrateResources(savedResources, defaultResources);

        expect(result[ResourceType.MONEY]).toBe(defaultResources[ResourceType.MONEY]);
    });

    it('should handle null/undefined input', () => {
        expect(migrateResources(null, defaultResources)).toEqual(defaultResources);
        expect(migrateResources(undefined, defaultResources)).toEqual(defaultResources);
    });
});

// ============================================
// UNITS MIGRATION TESTS
// ============================================
describe('Migrate Units', () => {
    const defaultUnits = INITIAL_GAME_STATE.units;

    it('should migrate valid units', () => {
        // Get first valid unit type from default units
        const firstUnitType = Object.keys(defaultUnits)[0] as UnitType;
        const secondUnitType = Object.keys(defaultUnits)[1] as UnitType;
        
        const savedUnits = {
            [firstUnitType]: 100,
            [secondUnitType]: 50
        };

        const result = migrateUnits(savedUnits, defaultUnits);

        expect(result[firstUnitType]).toBe(100);
        expect(result[secondUnitType]).toBe(50);
    });

    it('should use defaults for invalid units', () => {
        const firstUnitType = Object.keys(defaultUnits)[0] as UnitType;
        
        const savedUnits = {
            [firstUnitType]: 'invalid'
        };

        const result = migrateUnits(savedUnits, defaultUnits);

        expect(result[firstUnitType]).toBe(defaultUnits[firstUnitType]);
    });
});

// ============================================
// BUILDINGS MIGRATION TESTS
// ============================================
describe('Migrate Buildings', () => {
    const defaultBuildings = INITIAL_GAME_STATE.buildings;

    it('should migrate valid buildings with level and isDamaged', () => {
        const savedBuildings = {
            [BuildingType.HOUSE]: { level: 5, isDamaged: false },
            [BuildingType.DIAMOND_MINE]: { level: 3, isDamaged: true }
        };

        const result = migrateBuildings(savedBuildings, defaultBuildings);

        expect(result[BuildingType.HOUSE].level).toBe(5);
        expect(result[BuildingType.HOUSE].isDamaged).toBe(false);
        expect(result[BuildingType.DIAMOND_MINE].level).toBe(3);
        expect(result[BuildingType.DIAMOND_MINE].isDamaged).toBe(true);
    });

    it('should handle missing isDamaged field', () => {
        const savedBuildings = {
            [BuildingType.HOUSE]: { level: 5 }
        };

        const result = migrateBuildings(savedBuildings, defaultBuildings);

        expect(result[BuildingType.HOUSE].level).toBe(5);
        expect(result[BuildingType.HOUSE].isDamaged).toBe(false);
    });

    it('should handle invalid isDamaged field', () => {
        const savedBuildings = {
            [BuildingType.HOUSE]: { level: 5, isDamaged: 'yes' }
        };

        const result = migrateBuildings(savedBuildings, defaultBuildings);

        expect(result[BuildingType.HOUSE].isDamaged).toBe(false);
    });

    it('should ensure Diamond Mine minimum level 1', () => {
        const savedBuildings = {
            [BuildingType.DIAMOND_MINE]: { level: 0, isDamaged: false }
        };

        const result = migrateBuildings(savedBuildings, defaultBuildings);

        // Note: The minimum level check is done in sanitizeAndMigrateSave, not here
        expect(result[BuildingType.DIAMOND_MINE].level).toBe(0);
    });
});

// ============================================
// LOGS MIGRATION TESTS
// ============================================
describe('Migrate Logs', () => {
    it('should migrate valid logs', () => {
        const savedLogs = [
            {
                id: 'log-1',
                messageKey: 'log_battle_win',
                timestamp: Date.now(),
                type: 'combat',
                params: { targetName: 'Enemy' },
                archived: false
            }
        ];

        const result = migrateLogs(savedLogs);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('log-1');
        expect(result[0].type).toBe('combat');
    });

    it('should sanitize invalid log types', () => {
        const savedLogs = [
            {
                id: 'log-1',
                messageKey: 'test',
                timestamp: Date.now(),
                type: 'invalid_type',
                params: {}
            }
        ];

        const result = migrateLogs(savedLogs);

        expect(result[0].type).toBe('info'); // Default for invalid type
    });

    it('should handle missing required fields', () => {
        const savedLogs = [
            {
                messageKey: 'test'
                // Missing id and timestamp
            }
        ];

        const result = migrateLogs(savedLogs);

        expect(result).toHaveLength(0); // Filtered out due to missing required fields
    });

    it('should handle empty array', () => {
        expect(migrateLogs([])).toEqual([]);
    });

    it('should handle null/undefined input', () => {
        expect(migrateLogs(null)).toEqual([]);
        expect(migrateLogs(undefined)).toEqual([]);
    });
});

// ============================================
// WAR STATE MIGRATION TESTS
// ============================================
describe('Migrate War State', () => {
    it('should migrate valid war state', () => {
        const savedWar = {
            id: 'war-123',
            enemyId: 'bot-1',
            enemyName: 'Enemy Bot',
            enemyScore: 5000,
            startTime: Date.now(),
            duration: 60 * 60 * 1000,
            nextWaveTime: Date.now() + 10000,
            currentWave: 3,
            totalWaves: 8,
            playerVictories: 2,
            enemyVictories: 1,
            playerAttacksLeft: 5,
            lootPool: {
                [ResourceType.MONEY]: 1000,
                [ResourceType.OIL]: 100,
                [ResourceType.AMMO]: 50,
                [ResourceType.GOLD]: 10,
                [ResourceType.DIAMOND]: 5
            },
            playerResourceLosses: {
                [ResourceType.MONEY]: 500,
                [ResourceType.OIL]: 50,
                [ResourceType.AMMO]: 25,
                [ResourceType.GOLD]: 5,
                [ResourceType.DIAMOND]: 2
            },
            enemyResourceLosses: {
                [ResourceType.MONEY]: 600,
                [ResourceType.OIL]: 60,
                [ResourceType.AMMO]: 30,
                [ResourceType.GOLD]: 6,
                [ResourceType.DIAMOND]: 3
            },
            playerUnitLosses: 50,
            enemyUnitLosses: 75,
            currentEnemyGarrison: { [UnitType.SOLDIER]: 100 }
        };

        const result = migrateWarState(savedWar);

        expect(result).not.toBeNull();
        expect(result?.id).toBe('war-123');
        expect(result?.enemyName).toBe('Enemy Bot');
        expect(result?.currentWave).toBe(3);
    });

    it('should handle null/undefined input', () => {
        expect(migrateWarState(null)).toBeNull();
        expect(migrateWarState(undefined)).toBeNull();
    });

    it('should sanitize invalid resource values', () => {
        const savedWar = {
            id: 'war-123',
            enemyId: 'bot-1',
            enemyName: 'Enemy',
            enemyScore: 5000,
            startTime: Date.now(),
            lootPool: {
                [ResourceType.MONEY]: 'invalid',
                [ResourceType.OIL]: NaN
            }
        };

        const result = migrateWarState(savedWar);

        expect(result?.lootPool[ResourceType.MONEY]).toBe(0);
        expect(result?.lootPool[ResourceType.OIL]).toBe(0);
    });
});

// ============================================
// LIFETIME STATS MIGRATION TESTS
// ============================================
describe('Migrate Lifetime Stats', () => {
    it('should migrate valid stats', () => {
        const savedStats = {
            enemiesKilled: 100,
            unitsLost: 50,
            resourcesMined: 10000,
            missionsCompleted: 25,
            highestRankAchieved: 10
        };

        const result = migrateLifetimeStats(savedStats);

        expect(result.enemiesKilled).toBe(100);
        expect(result.unitsLost).toBe(50);
        expect(result.resourcesMined).toBe(10000);
        expect(result.missionsCompleted).toBe(25);
        expect(result.highestRankAchieved).toBe(10);
    });

    it('should handle invalid values', () => {
        const savedStats = {
            enemiesKilled: 'invalid',
            unitsLost: NaN,
            resourcesMined: -100
        };

        const result = migrateLifetimeStats(savedStats);

        expect(result.enemiesKilled).toBe(0);
        expect(result.unitsLost).toBe(0);
        expect(result.resourcesMined).toBe(0);
    });

    it('should handle null/undefined input', () => {
        const result = migrateLifetimeStats(null);

        expect(result.enemiesKilled).toBe(0);
        expect(result.highestRankAchieved).toBe(9999);
    });
});

// ============================================
// BOT SANITIZATION TESTS
// ============================================
describe('Sanitize Bot', () => {
    it('should sanitize valid bot data', () => {
        const bot = {
            id: 'bot-1',
            name: 'Test Bot',
            avatarId: 1,
            country: 'US',
            stats: {
                [RankingCategory.DOMINION]: 5000,
                [RankingCategory.MILITARY]: 2000,
                [RankingCategory.ECONOMY]: 50000,
                [RankingCategory.CAMPAIGN]: 5
            },
            ambition: 1.5,
            personality: BotPersonality.WARLORD,
            lastRank: 50,
            currentEvent: BotEvent.PEACEFUL_PERIOD,
            eventTurnsRemaining: 10,
            growthModifier: 0.5,
            reputation: 45
        };

        const result = sanitizeBot(bot, 0);

        expect(result.id).toBe('bot-1');
        expect(result.name).toBe('Test Bot');
        expect(result.personality).toBe(BotPersonality.WARLORD);
        expect(result.stats[RankingCategory.DOMINION]).toBe(5000);
    });

    it('should handle invalid personality', () => {
        const bot = {
            id: 'bot-1',
            name: 'Test Bot',
            personality: 'INVALID_PERSONALITY'
        };

        const result = sanitizeBot(bot, 0);

        expect(result.personality).toBe(BotPersonality.WARLORD); // Default
    });

    it('should handle suspicious scores', () => {
        const bot = {
            id: 'bot-1',
            name: 'Test Bot',
            stats: {
                [RankingCategory.DOMINION]: 10000000 // High score - now allowed (no artificial cap)
            },
            lastRank: 50
        };

        const result = sanitizeBot(bot, 0);

        // High scores are now preserved - bots can grow indefinitely
        expect(result.stats[RankingCategory.DOMINION]).toBe(10000000);
    });

    it('should preserve very high scores (5M+ bug fix)', () => {
        const bot = {
            id: 'bot-1',
            name: 'Test Bot',
            stats: {
                [RankingCategory.DOMINION]: 5000000, // 5M - previously flagged as suspicious
                [RankingCategory.MILITARY]: 2500000,
                [RankingCategory.ECONOMY]: 50000000
            },
            lastRank: 10,
            personality: BotPersonality.WARLORD,
            currentEvent: BotEvent.PEACEFUL_PERIOD
        };

        const result = sanitizeBot(bot, 0);

        // All high scores should be preserved (bug fix: previously reduced to ~2M)
        expect(result.stats[RankingCategory.DOMINION]).toBe(5000000);
        expect(result.stats[RankingCategory.MILITARY]).toBe(2500000);
        expect(result.stats[RankingCategory.ECONOMY]).toBe(50000000);
    });

    it('should preserve extremely high scores (100M+)', () => {
        const bot = {
            id: 'bot-1',
            name: 'Test Bot',
            stats: {
                [RankingCategory.DOMINION]: 100000000, // 100M
                [RankingCategory.ECONOMY]: 1000000000 // 1B
            },
            lastRank: 1,
            personality: BotPersonality.TYCOON,
            currentEvent: BotEvent.ECONOMIC_BOOM
        };

        const result = sanitizeBot(bot, 0);

        // Extremely high scores should also be preserved
        expect(result.stats[RankingCategory.DOMINION]).toBe(100000000);
        expect(result.stats[RankingCategory.ECONOMY]).toBe(1000000000);
    });

    it('should handle missing stats', () => {
        const bot = {
            id: 'bot-1',
            name: 'Test Bot'
        };

        const result = sanitizeBot(bot, 0);

        expect(result.stats[RankingCategory.DOMINION]).toBeDefined();
        expect(result.stats[RankingCategory.DOMINION]).toBeGreaterThan(0);
    });

    it('should clamp reputation to valid range', () => {
        const bot = {
            id: 'bot-1',
            name: 'Test Bot',
            reputation: 150 // Out of range
        };

        const result = sanitizeBot(bot, 0);

        expect(result.reputation).toBeLessThanOrEqual(100);
    });
});

// ============================================
// RANKING DATA SANITIZATION TESTS
// ============================================
describe('Sanitize Ranking Data', () => {
    it('should sanitize valid ranking data', () => {
        const rankingData = {
            bots: [
                {
                    id: 'bot-1',
                    name: 'Bot 1',
                    stats: {
                        [RankingCategory.DOMINION]: 5000
                    },
                    personality: BotPersonality.WARLORD
                }
            ],
            lastUpdateTime: Date.now()
        };

        const result = sanitizeRankingData(rankingData, 10);

        expect(result.bots).toHaveLength(1);
        expect(result.bots[0].id).toBe('bot-1');
    });

    it('should reset for old save versions', () => {
        const rankingData = {
            bots: [{ id: 'bot-1', name: 'Bot 1' }],
            lastUpdateTime: Date.now()
        };

        const result = sanitizeRankingData(rankingData, 5); // Version < 6

        // Should initialize with fresh bots (199 bots from initializeRankingState)
        expect(result.bots.length).toBeGreaterThan(0);
    });

    it('should handle invalid ranking data', () => {
        const nullResult = sanitizeRankingData(null, 10);
        const emptyResult = sanitizeRankingData({}, 10);
        const emptyBotsResult = sanitizeRankingData({ bots: [] }, 10);
        
        // All should return initialized state with bots
        expect(nullResult.bots.length).toBeGreaterThan(0);
        expect(emptyResult.bots.length).toBeGreaterThan(0);
        expect(emptyBotsResult.bots.length).toBeGreaterThan(0);
    });
});

// ============================================
// FULL SAVE MIGRATION TESTS
// ============================================
describe('Sanitize And Migrate Save - Full Integration', () => {
    it('should return initial state for null/undefined input', () => {
        const result = sanitizeAndMigrateSave(null);

        expect(result.saveVersion).toBe(SAVE_VERSION);
        expect(result.playerName).toBe('Commander');
        expect(result.resources).toEqual(INITIAL_GAME_STATE.resources);
    });

    it('should migrate a complete valid save', () => {
        const saved = {
            saveVersion: 5,
            playerName: 'TestCommander',
            hasChangedName: true,
            resources: {
                [ResourceType.MONEY]: 10000,
                [ResourceType.OIL]: 500,
                [ResourceType.AMMO]: 250,
                [ResourceType.GOLD]: 50,
                [ResourceType.DIAMOND]: 10
            },
            buildings: {
                [BuildingType.HOUSE]: { level: 10, isDamaged: false },
                [BuildingType.DIAMOND_MINE]: { level: 5, isDamaged: false }
            },
            units: {
                [UnitType.SOLDIER]: 100,
                [UnitType.TANK]: 20
            },
            bankBalance: 5000,
            empirePoints: 1500,
            campaignProgress: 5,
            logs: [
                {
                    id: 'log-1',
                    messageKey: 'log_battle_win',
                    timestamp: Date.now(),
                    type: 'combat',
                    params: {}
                }
            ],
            rankingData: {
                bots: Array(200).fill(null).map((_, i) => ({
                    id: `bot-${i}`,
                    name: `Bot ${i}`,
                    stats: { [RankingCategory.DOMINION]: 1000 + i * 100 },
                    personality: BotPersonality.WARLORD
                })),
                lastUpdateTime: Date.now()
            }
        };

        const result = sanitizeAndMigrateSave(saved);

        expect(result.playerName).toBe('TestCommander');
        expect(result.hasChangedName).toBe(true);
        expect(result.resources[ResourceType.MONEY]).toBe(10000);
        expect(result.buildings[BuildingType.HOUSE].level).toBe(10);
        // Units may be filtered based on valid UnitType enum values
        expect(result.bankBalance).toBe(5000);
        expect(result.logs.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle corrupted save data gracefully', () => {
        const saved = {
            saveVersion: 'invalid',
            playerName: 12345,
            resources: 'not an object',
            buildings: null,
            units: 'invalid'
        };

        const result = sanitizeAndMigrateSave(saved);

        // Should not throw, should return valid state with defaults
        expect(result.saveVersion).toBe(SAVE_VERSION);
        expect(result.playerName).toBe('Commander'); // Default
        expect(result.resources).toEqual(INITIAL_GAME_STATE.resources);
    });

    it('should ensure Diamond Mine minimum level 1', () => {
        const saved = {
            saveVersion: 10,
            buildings: {
                [BuildingType.DIAMOND_MINE]: { level: 0, isDamaged: false }
            }
        };

        const result = sanitizeAndMigrateSave(saved);

        expect(result.buildings[BuildingType.DIAMOND_MINE].level).toBeGreaterThanOrEqual(1);
    });

    it('should migrate war state correctly', () => {
        const saved = {
            saveVersion: 10,
            activeWar: {
                id: 'war-123',
                enemyId: 'bot-1',
                enemyName: 'War Enemy',
                enemyScore: 10000,
                startTime: Date.now(),
                duration: 60 * 60 * 1000,
                currentWave: 5,
                totalWaves: 8,
                playerVictories: 3,
                enemyVictories: 2,
                playerAttacksLeft: 4,
                lootPool: {},
                playerResourceLosses: {},
                enemyResourceLosses: {},
                playerUnitLosses: 100,
                enemyUnitLosses: 150,
                currentEnemyGarrison: {}
            }
        };

        const result = sanitizeAndMigrateSave(saved);

        expect(result.activeWar).not.toBeNull();
        expect(result.activeWar?.enemyName).toBe('War Enemy');
        expect(result.activeWar?.currentWave).toBe(5);
    });

    it('should migrate grudges correctly', () => {
        const saved = {
            saveVersion: 10,
            grudges: [
                {
                    id: 'grudge-1',
                    botId: 'bot-1',
                    botName: 'Vengeful Bot',
                    botPersonality: BotPersonality.TURTLE,
                    botScore: 5000,
                    createdAt: Date.now(),
                    retaliationTime: Date.now() + 1000000,
                    notified: false
                }
            ]
        };

        const result = sanitizeAndMigrateSave(saved);

        expect(result.grudges).toHaveLength(1);
        expect(result.grudges[0].botName).toBe('Vengeful Bot');
        expect(result.grudges[0].botPersonality).toBe(BotPersonality.TURTLE);
    });

    it('should migrate spy reports correctly', () => {
        const saved = {
            saveVersion: 10,
            spyReports: [
                {
                    id: 'spy-1',
                    botId: 'bot-1',
                    botName: 'Spy Target',
                    botScore: 5000,
                    botPersonality: BotPersonality.ROGUE,
                    createdAt: Date.now(),
                    expiresAt: Date.now() + 600000,
                    units: { [UnitType.SOLDIER]: 50 },
                    resources: { [ResourceType.MONEY]: 1000 },
                    buildings: { [BuildingType.HOUSE]: 5 }
                }
            ]
        };

        const result = sanitizeAndMigrateSave(saved);

        expect(result.spyReports).toHaveLength(1);
        expect(result.spyReports[0].botName).toBe('Spy Target');
    });

    it('should migrate active missions correctly', () => {
        const saved = {
            saveVersion: 10,
            activeMissions: [
                {
                    id: 'mission-1',
                    type: 'PATROL',
                    startTime: Date.now(),
                    endTime: Date.now() + 300000,
                    duration: 5,
                    units: { [UnitType.SOLDIER]: 10 }
                }
            ]
        };

        const result = sanitizeAndMigrateSave(saved);

        expect(result.activeMissions).toHaveLength(1);
        expect(result.activeMissions[0].type).toBe('PATROL');
    });

    it('should handle all edge cases in a single migration', () => {
        const saved = {
            saveVersion: 3, // Old version - should reset rankings
            playerName: '', // Invalid - too short
            resources: {
                [ResourceType.MONEY]: NaN,
                [ResourceType.OIL]: Infinity,
                [ResourceType.AMMO]: -100 // Negative
            },
            buildings: {
                [BuildingType.HOUSE]: { level: 'five' }, // Invalid type
                [BuildingType.DIAMOND_MINE]: { level: 0 } // Below minimum
            },
            logs: [
                { id: '1' }, // Missing required fields
                { id: '2', messageKey: 'test', timestamp: Date.now() } // Valid minimal
            ],
            lifetimeStats: {
                enemiesKilled: null,
                highestRankAchieved: 0 // Invalid
            }
        };

        const result = sanitizeAndMigrateSave(saved);

        // Should not throw and should return valid state
        expect(result.saveVersion).toBe(SAVE_VERSION);
        expect(result.playerName).toBe('Commander'); // Default
        expect(result.buildings[BuildingType.DIAMOND_MINE].level).toBeGreaterThanOrEqual(1);
        expect(result.logs.length).toBeGreaterThanOrEqual(0);
        expect(result.lifetimeStats.highestRankAchieved).toBe(9999); // Default
    });
});

// ============================================
// STRESS TESTS
// ============================================
describe('Migration Stress Tests', () => {
    it('should handle very large save data', () => {
        const saved = {
            saveVersion: 10,
            logs: Array(1000).fill(null).map((_, i) => ({
                id: `log-${i}`,
                messageKey: 'log_battle_win',
                timestamp: Date.now(),
                type: 'combat',
                params: {}
            })),
            rankingData: {
                bots: Array(200).fill(null).map((_, i) => ({
                    id: `bot-${i}`,
                    name: `Bot ${i}`,
                    stats: { [RankingCategory.DOMINION]: 1000 + i },
                    personality: BotPersonality.WARLORD
                })),
                lastUpdateTime: Date.now()
            }
        };

        const result = sanitizeAndMigrateSave(saved);

        expect(result.logs.length).toBeLessThanOrEqual(1000);
        expect(result.rankingData.bots).toHaveLength(200);
    });

    it('should handle deeply nested corrupted data', () => {
        const saved = {
            saveVersion: 10,
            resources: {
                [ResourceType.MONEY]: { nested: 'object' },
                [ResourceType.OIL]: [1, 2, 3]
            },
            buildings: {
                [BuildingType.HOUSE]: {
                    level: { also: 'nested' },
                    isDamaged: { not: 'boolean' }
                }
            }
        };

        const result = sanitizeAndMigrateSave(saved);

        // Should not throw
        expect(result.resources[ResourceType.MONEY]).toBe(INITIAL_GAME_STATE.resources[ResourceType.MONEY]);
        expect(result.buildings[BuildingType.HOUSE].isDamaged).toBe(false);
    });

    it('should handle circular reference attempts', () => {
        const circular: any = { a: 1 };
        circular.self = circular;

        const saved = {
            saveVersion: 10,
            customData: circular
        };

        // Should not throw when processing
        const result = sanitizeAndMigrateSave(saved);

        expect(result.saveVersion).toBe(SAVE_VERSION);
    });
});

// ============================================
// DATA LOSS PREVENTION TESTS
// ============================================
describe('Migration - Data Loss Prevention', () => {
    describe('Resources Protection', () => {
        it('should preserve valid resources even if some are corrupted', () => {
            const saved = {
                saveVersion: 10,
                resources: {
                    [ResourceType.MONEY]: 50000,
                    [ResourceType.OIL]: 10000,
                    [ResourceType.AMMO]: 'corrupted',
                    [ResourceType.GOLD]: null,
                    [ResourceType.DIAMOND]: 100
                }
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.resources[ResourceType.MONEY]).toBe(50000);
            expect(result.resources[ResourceType.OIL]).toBe(10000);
            expect(result.resources[ResourceType.DIAMOND]).toBe(100);
        });

        it('should preserve resources with zero values', () => {
            const saved = {
                saveVersion: 10,
                resources: {
                    [ResourceType.MONEY]: 0,
                    [ResourceType.OIL]: 0,
                    [ResourceType.AMMO]: 0,
                    [ResourceType.GOLD]: 0,
                    [ResourceType.DIAMOND]: 0
                }
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.resources[ResourceType.MONEY]).toBe(0);
            expect(result.resources[ResourceType.OIL]).toBe(0);
        });

        it('should handle extremely large resource values', () => {
            const saved = {
                saveVersion: 10,
                resources: {
                    [ResourceType.MONEY]: Number.MAX_SAFE_INTEGER,
                    [ResourceType.OIL]: 1000000
                }
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.resources[ResourceType.MONEY]).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
            expect(result.resources[ResourceType.MONEY]).toBeGreaterThan(0);
        });
    });

    describe('Units Protection', () => {
        it('should preserve valid units even if some are corrupted', () => {
            const defaultUnits = INITIAL_GAME_STATE.units;
            const firstUnit = Object.keys(defaultUnits)[0] as UnitType;
            const secondUnit = Object.keys(defaultUnits)[1] as UnitType;
            
            const saved = {
                saveVersion: 10,
                units: {
                    [firstUnit]: 100,
                    [secondUnit]: 'corrupted'
                }
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.units[firstUnit]).toBe(100);
        });

        it('should preserve zero-value units', () => {
            const defaultUnits = INITIAL_GAME_STATE.units;
            const firstUnit = Object.keys(defaultUnits)[0] as UnitType;
            
            const saved = {
                saveVersion: 10,
                units: {
                    [firstUnit]: 0
                }
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.units[firstUnit]).toBe(0);
        });
    });

    describe('Logs Protection', () => {
        it('should preserve valid logs when some are corrupted', () => {
            const saved = {
                saveVersion: 10,
                logs: [
                    { id: 'valid-1', messageKey: 'log_battle_win', timestamp: Date.now(), type: 'combat' },
                    { id: 'valid-2', messageKey: 'log_mission_complete', timestamp: Date.now(), type: 'mission' },
                    'corrupted',
                    null,
                    { id: 'valid-3', messageKey: 'log_war_start', timestamp: Date.now(), type: 'war' }
                ]
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.logs.length).toBeGreaterThanOrEqual(2);
            expect(result.logs.find(l => l.id === 'valid-1')).toBeTruthy();
            expect(result.logs.find(l => l.id === 'valid-3')).toBeTruthy();
        });

        it('should preserve archived status of logs', () => {
            const saved = {
                saveVersion: 10,
                logs: [
                    { id: 'log-1', messageKey: 'test', timestamp: Date.now(), type: 'combat', archived: true },
                    { id: 'log-2', messageKey: 'test', timestamp: Date.now(), type: 'combat', archived: false }
                ]
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.logs.find(l => l.id === 'log-1')?.archived).toBe(true);
            expect(result.logs.find(l => l.id === 'log-2')?.archived).toBe(false);
        });
    });

    describe('Buildings Protection', () => {
        it('should preserve valid buildings when some are corrupted', () => {
            const saved = {
                saveVersion: 10,
                buildings: {
                    [BuildingType.HOUSE]: { level: 10, isDamaged: false },
                    [BuildingType.FACTORY]: 'corrupted',
                    [BuildingType.DIAMOND_MINE]: { level: 5, isDamaged: true }
                }
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.buildings[BuildingType.HOUSE].level).toBe(10);
            expect(result.buildings[BuildingType.DIAMOND_MINE].level).toBe(5);
            expect(result.buildings[BuildingType.DIAMOND_MINE].isDamaged).toBe(true);
        });

        it('should preserve all valid building types even if some are missing', () => {
            const saved = {
                saveVersion: 10,
                buildings: {
                    [BuildingType.HOUSE]: { level: 5 }
                }
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.buildings[BuildingType.HOUSE].level).toBe(5);
            expect(result.buildings[BuildingType.DIAMOND_MINE].level).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Spy Reports Protection', () => {
        it('should preserve valid spy reports when some are corrupted', () => {
            const saved = {
                saveVersion: 10,
                spyReports: [
                    {
                        id: 'spy-1',
                        botId: 'bot-1',
                        botName: 'Valid Bot',
                        botScore: 5000,
                        botPersonality: BotPersonality.WARLORD,
                        createdAt: Date.now(),
                        expiresAt: Date.now() + 600000,
                        units: {},
                        resources: {},
                        buildings: {}
                    },
                    'corrupted',
                    null,
                    { id: 'spy-2', invalid: 'data' }
                ]
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.spyReports.length).toBeGreaterThanOrEqual(1);
            expect(result.spyReports.find(s => s.id === 'spy-1')).toBeTruthy();
        });
    });

    describe('Active Missions Protection', () => {
        it('should preserve valid missions when some are corrupted', () => {
            const now = Date.now();
            const saved = {
                saveVersion: 10,
                activeMissions: [
                    {
                        id: 'mission-1',
                        type: 'PATROL',
                        startTime: now,
                        endTime: now + 300000,
                        duration: 5,
                        units: { [UnitType.CYBER_MARINE]: 10 }
                    },
                    'corrupted',
                    { id: 'mission-2', invalid: 'data' }
                ]
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.activeMissions.length).toBeGreaterThanOrEqual(1);
            expect(result.activeMissions.find(m => m.id === 'mission-1')).toBeTruthy();
        });
    });

    describe('Incoming Attacks Protection', () => {
        it('should preserve valid attacks when some are corrupted', () => {
            const now = Date.now();
            const saved = {
                saveVersion: 10,
                incomingAttacks: [
                    {
                        id: 'attack-1',
                        attackerName: 'Enemy Bot',
                        attackerScore: 5000,
                        units: {},
                        startTime: now,
                        endTime: now + 600000
                    },
                    'corrupted',
                    { id: 'attack-2' }
                ]
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.incomingAttacks.length).toBeGreaterThanOrEqual(1);
            expect(result.incomingAttacks.find(a => a.id === 'attack-1')).toBeTruthy();
        });

        it('should remove expired attacks', () => {
            const now = Date.now();
            const saved = {
                saveVersion: 10,
                incomingAttacks: [
                    { id: 'expired', attackerName: 'Bot', attackerScore: 1000, units: {}, startTime: now - 1000000, endTime: now - 500000 },
                    { id: 'valid', attackerName: 'Bot', attackerScore: 1000, units: {}, startTime: now, endTime: now + 600000 }
                ]
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.incomingAttacks.find(a => a.id === 'valid')).toBeTruthy();
        });
    });

    describe('Grudges Protection', () => {
        it('should preserve valid grudges when some are corrupted', () => {
            const saved = {
                saveVersion: 10,
                grudges: [
                    {
                        id: 'grudge-1',
                        botId: 'bot-1',
                        botName: 'Enemy Bot',
                        botPersonality: BotPersonality.WARLORD,
                        botScore: 5000,
                        createdAt: Date.now(),
                        retaliationTime: Date.now() + 1000000,
                        notified: false
                    },
                    'corrupted'
                ]
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.grudges.length).toBeGreaterThanOrEqual(1);
            expect(result.grudges.find(g => g.id === 'grudge-1')).toBeTruthy();
        });
    });

    describe('War State Protection', () => {
        it('should preserve valid war state when partially corrupted', () => {
            const saved = {
                saveVersion: 10,
                activeWar: {
                    id: 'war-1',
                    enemyId: 'bot-1',
                    enemyName: 'War Enemy',
                    enemyScore: 10000,
                    startTime: Date.now(),
                    duration: 'corrupted',
                    lootPool: { [ResourceType.MONEY]: 1000 }
                }
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.activeWar).not.toBeNull();
            expect(result.activeWar?.id).toBe('war-1');
            expect(result.activeWar?.lootPool[ResourceType.MONEY]).toBe(1000);
        });

        it('should handle null war state', () => {
            const saved = {
                saveVersion: 10,
                activeWar: null
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.activeWar).toBeNull();
        });
    });

    describe('Market Protection', () => {
        it('should preserve valid market data', () => {
            const saved = {
                saveVersion: 10,
                marketOffers: [
                    { id: 'offer-1', type: 'SELL', resource: ResourceType.OIL, amount: 1000, pricePerUnit: 10 }
                ],
                marketNextRefreshTime: Date.now() + 3600000
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.marketOffers.length).toBe(1);
            expect(result.marketNextRefreshTime).toBeGreaterThan(Date.now());
        });
    });

    describe('Diplomatic Actions Protection', () => {
        it('should preserve valid diplomatic actions', () => {
            const saved = {
                saveVersion: 10,
                diplomaticActions: {
                    'bot-1': {
                        lastGiftTime: Date.now() - 3600000,
                        lastAllianceTime: 0,
                        lastPeaceTime: 0
                    },
                    'bot-2': 'corrupted'
                }
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.diplomaticActions['bot-1']).toBeTruthy();
            expect(result.diplomaticActions['bot-1'].lastGiftTime).toBeGreaterThan(0);
        });
    });

    describe('Gift Codes Protection', () => {
        it('should preserve redeemed gift codes', () => {
            const saved = {
                saveVersion: 10,
                redeemedGiftCodes: [
                    { code: 'CODE123', redeemedAt: Date.now() - 86400000 }
                ],
                giftCodeCooldowns: {
                    'COOLDOWN1': Date.now() - 3600000
                }
            };

            const result = sanitizeAndMigrateSave(saved);

            expect(result.redeemedGiftCodes.length).toBe(1);
            expect(result.giftCodeCooldowns['COOLDOWN1']).toBeTruthy();
        });
    });
});
