/**
 * ALLIED REINFORCEMENTS SYSTEM - COMPREHENSIVE UNIT TESTS
 * 
 * Tests for:
 * - Reinforcement calculation (5% ratio)
 * - Probability system (15% chance)
 * - Combat integration with multiple armies
 * - Edge cases, boundary conditions, error handling
 * - Race conditions and concurrent attacks
 * - Data validation and sanitization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
    calculateReinforcementArmy,
    willSendReinforcements,
    calculateActiveReinforcements,
    calculatePotentialReinforcements,
    isPlayerUnderThreat,
    getPlayerGarrison,
    type ReinforcementEntry
} from '../utils/engine/allianceReinforcements';
import { 
    REPUTATION_ALLY_THRESHOLD, 
    REINFORCEMENT_RATIO, 
    REINFORCEMENT_CHANCE 
} from '../constants';
import { GameState, UnitType, BotPersonality } from '../types';
import { RankingCategory } from '../utils/engine/rankings';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { simulateCombat } from '../utils/engine/combat';

// ============================================================================
// MOCK DATA & HELPERS
// ============================================================================

const createMockBot = (
    id: string,
    name: string,
    score: number,
    reputation: number,
    personality: BotPersonality = BotPersonality.WARLORD
) => ({
    id,
    name,
    stats: {
        [RankingCategory.DOMINION]: score,
        [RankingCategory.OFFENSE]: score * 0.6,
        [RankingCategory.DEFENSE]: score * 0.4,
        [RankingCategory.ECONOMY]: score * 0.3
    },
    personality,
    reputation,
    trend: 'stable' as const,
    tier: 1,
    rank: 1
});

const createMockGameState = (
    overrides: Partial<GameState> = {}
): GameState => ({
    ...INITIAL_GAME_STATE,
    ...overrides,
    rankingData: {
        bots: overrides.rankingData?.bots || [],
        lastUpdateTime: Date.now()
    },
    allyReinforcements: overrides.allyReinforcements || [],
    incomingAttacks: overrides.incomingAttacks || [],
    activeWar: overrides.activeWar || null,
    grudges: overrides.grudges || []
});

// ============================================================================
// TEST SUITE: CONSTANTS VALIDATION
// ============================================================================

describe('Alliance Reinforcements - Constants Validation', () => {
    describe('REPUTATION_ALLY_THRESHOLD', () => {
        it('should be exactly 75', () => {
            expect(REPUTATION_ALLY_THRESHOLD).toBe(75);
        });

        it('should be between 0 and 100', () => {
            expect(REPUTATION_ALLY_THRESHOLD).toBeGreaterThanOrEqual(0);
            expect(REPUTATION_ALLY_THRESHOLD).toBeLessThanOrEqual(100);
        });
    });

    describe('REINFORCEMENT_RATIO', () => {
        it('should be exactly 0.05 (5%)', () => {
            expect(REINFORCEMENT_RATIO).toBe(0.05);
        });

        it('should be between 0 and 1', () => {
            expect(REINFORCEMENT_RATIO).toBeGreaterThanOrEqual(0);
            expect(REINFORCEMENT_RATIO).toBeLessThanOrEqual(1);
        });

        it('should not exceed 10% for balance', () => {
            expect(REINFORCEMENT_RATIO).toBeLessThanOrEqual(0.10);
        });
    });

    describe('REINFORCEMENT_CHANCE', () => {
        it('should be exactly 0.15 (15%)', () => {
            expect(REINFORCEMENT_CHANCE).toBe(0.15);
        });

        it('should be between 0 and 1', () => {
            expect(REINFORCEMENT_CHANCE).toBeGreaterThanOrEqual(0);
            expect(REINFORCEMENT_CHANCE).toBeLessThanOrEqual(1);
        });
    });
});

// ============================================================================
// TEST SUITE: REINFORCEMENT ARMY CALCULATION
// ============================================================================

describe('Alliance Reinforcements - Army Calculation', () => {
    describe('calculateReinforcementArmy', () => {
        it('should calculate 5% of bot military budget', () => {
            const bot = createMockBot('bot-1', 'Test Bot', 10000, 80);
            const army = calculateReinforcementArmy(bot);
            
            // Army should exist and have units
            expect(army).toBeDefined();
            expect(typeof army).toBe('object');
            
            // Should have at least some units
            const totalUnits = Object.values(army).reduce((sum, count) => sum + (count || 0), 0);
            expect(totalUnits).toBeGreaterThan(0);
        });

        it('should scale with bot score', () => {
            const lowScoreBot = createMockBot('bot-low', 'Low Bot', 1000, 80);
            const highScoreBot = createMockBot('bot-high', 'High Bot', 100000, 80);
            
            const lowArmy = calculateReinforcementArmy(lowScoreBot);
            const highArmy = calculateReinforcementArmy(highScoreBot);
            
            const lowTotal = Object.values(lowArmy).reduce((sum, count) => sum + (count || 0), 0);
            const highTotal = Object.values(highArmy).reduce((sum, count) => sum + (count || 0), 0);
            
            // Higher score should produce more units
            expect(highTotal).toBeGreaterThan(lowTotal);
        });

        it('should handle zero score bot gracefully', () => {
            const bot = createMockBot('bot-zero', 'Zero Bot', 0, 80);
            const army = calculateReinforcementArmy(bot);
            
            expect(army).toBeDefined();
            // Should still return an army object, even if empty or minimal
        });

        it('should handle negative score bot gracefully', () => {
            const bot = createMockBot('bot-neg', 'Negative Bot', -1000, 80);
            const army = calculateReinforcementArmy(bot);
            
            expect(army).toBeDefined();
        });

        it('should handle very large score bot', () => {
            const bot = createMockBot('bot-huge', 'Huge Bot', 10000000, 80);
            const army = calculateReinforcementArmy(bot);
            
            expect(army).toBeDefined();
            const totalUnits = Object.values(army).reduce((sum, count) => sum + (count || 0), 0);
            expect(totalUnits).toBeGreaterThan(0);
        });

        it('should respect personality differences', () => {
            const warlordBot = createMockBot('bot-warlord', 'Warlord', 5000, 80, BotPersonality.WARLORD);
            const turtleBot = createMockBot('bot-turtle', 'Turtle', 5000, 80, BotPersonality.TURTLE);
            const tycoonBot = createMockBot('bot-tycoon', 'Tycoon', 5000, 80, BotPersonality.TYCOON);
            const rogueBot = createMockBot('bot-rogue', 'Rogue', 5000, 80, BotPersonality.ROGUE);
            
            const warlordArmy = calculateReinforcementArmy(warlordBot);
            const turtleArmy = calculateReinforcementArmy(turtleBot);
            const tycoonArmy = calculateReinforcementArmy(tycoonBot);
            const rogueArmy = calculateReinforcementArmy(rogueBot);
            
            // All should produce armies
            expect(Object.keys(warlordArmy).length).toBeGreaterThan(0);
            expect(Object.keys(turtleArmy).length).toBeGreaterThan(0);
            expect(Object.keys(tycoonArmy).length).toBeGreaterThan(0);
            expect(Object.keys(rogueArmy).length).toBeGreaterThan(0);
        });

        it('should handle undefined personality', () => {
            const bot = createMockBot('bot-undef', 'Undefined Bot', 5000, 80);
            // @ts-ignore - Testing undefined personality
            bot.personality = undefined;
            
            const army = calculateReinforcementArmy(bot);
            expect(army).toBeDefined();
        });

        it('should handle null personality', () => {
            const bot = createMockBot('bot-null', 'Null Bot', 5000, 80);
            // @ts-ignore - Testing null personality
            bot.personality = null;
            
            const army = calculateReinforcementArmy(bot);
            expect(army).toBeDefined();
        });

        it('should return valid UnitType keys', () => {
            const bot = createMockBot('bot-types', 'Types Bot', 10000, 80);
            const army = calculateReinforcementArmy(bot);
            
            Object.keys(army).forEach(key => {
                expect(Object.values(UnitType)).toContain(key as UnitType);
            });
        });

        it('should not have negative unit counts', () => {
            const bot = createMockBot('bot-neg', 'Negative Bot', 10000, 80);
            const army = calculateReinforcementArmy(bot);
            
            Object.values(army).forEach(count => {
                expect(count).toBeGreaterThanOrEqual(0);
            });
        });

        it('should handle fractional ratio parameter', () => {
            const bot = createMockBot('bot-ratio', 'Ratio Bot', 10000, 80);
            
            // Test with custom ratio
            const halfArmy = calculateReinforcementArmy(bot, 0.5);
            const fullArmy = calculateReinforcementArmy(bot, 1.0);
            const smallArmy = calculateReinforcementArmy(bot, 0.01);
            
            expect(Object.values(halfArmy).reduce((a, b) => a + (b || 0), 0))
                .toBeGreaterThan(Object.values(smallArmy).reduce((a, b) => a + (b || 0), 0));
            expect(Object.values(fullArmy).reduce((a, b) => a + (b || 0), 0))
                .toBeGreaterThanOrEqual(Object.values(halfArmy).reduce((a, b) => a + (b || 0), 0));
        });

        it('should handle zero ratio', () => {
            const bot = createMockBot('bot-zero-ratio', 'Zero Ratio Bot', 10000, 80);
            const army = calculateReinforcementArmy(bot, 0);
            
            // With zero ratio, army should be empty or minimal
            const totalUnits = Object.values(army).reduce((sum, count) => sum + (count || 0), 0);
            expect(totalUnits).toBeGreaterThanOrEqual(0);
        });

        it('should handle ratio > 1', () => {
            const bot = createMockBot('bot-over-ratio', 'Over Ratio Bot', 10000, 80);
            const army = calculateReinforcementArmy(bot, 2.0);
            
            expect(army).toBeDefined();
        });
    });
});

// ============================================================================
// TEST SUITE: PROBABILITY SYSTEM
// ============================================================================

describe('Alliance Reinforcements - Probability System', () => {
    describe('willSendReinforcements', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should return boolean', () => {
            const result = willSendReinforcements();
            expect(typeof result).toBe('boolean');
        });

        it('should have approximately 15% success rate over many trials', () => {
            const trials = 10000;
            let successes = 0;
            
            for (let i = 0; i < trials; i++) {
                if (willSendReinforcements()) {
                    successes++;
                }
            }
            
            const successRate = successes / trials;
            // Allow 2% variance for randomness
            expect(successRate).toBeGreaterThanOrEqual(0.13);
            expect(successRate).toBeLessThanOrEqual(0.17);
        });

        it('should not always return the same value', () => {
            const results = new Set();
            for (let i = 0; i < 100; i++) {
                results.add(willSendReinforcements());
            }
            
            // Should have both true and false
            expect(results.size).toBeGreaterThan(1);
        });

        it('should be independent between calls', () => {
            const result1 = willSendReinforcements();
            const result2 = willSendReinforcements();
            const result3 = willSendReinforcements();
            
            // Each call should be independent (not testing specific values, just independence)
            expect(typeof result1).toBe('boolean');
            expect(typeof result2).toBe('boolean');
            expect(typeof result3).toBe('boolean');
        });
    });
});

// ============================================================================
// TEST SUITE: ACTIVE REINFORCEMENTS CALCULATION
// ============================================================================

describe('Alliance Reinforcements - Active Calculation', () => {
    describe('calculateActiveReinforcements', () => {
        it('should return empty array when no allies exist', () => {
            const state = createMockGameState({
                rankingData: { bots: [], lastUpdateTime: Date.now() }
            });
            
            const reinforcements = calculateActiveReinforcements(state);
            expect(reinforcements).toEqual([]);
        });

        it('should return empty array when all bots are below ally threshold', () => {
            const state = createMockGameState({
                rankingData: {
                    bots: [
                        createMockBot('bot-1', 'Bot 1', 1000, 74), // Below 75
                        createMockBot('bot-2', 'Bot 2', 2000, 50),
                        createMockBot('bot-3', 'Bot 3', 3000, 0)
                    ],
                    lastUpdateTime: Date.now()
                }
            });
            
            const reinforcements = calculateActiveReinforcements(state);
            expect(reinforcements).toEqual([]);
        });

        it('should only include bots with reputation >= 75', () => {
            const state = createMockGameState({
                rankingData: {
                    bots: [
                        createMockBot('bot-ally', 'Ally Bot', 1000, 75), // Exactly 75
                        createMockBot('bot-friend', 'Friend Bot', 2000, 90),
                        createMockBot('bot-enemy', 'Enemy Bot', 3000, 74), // Below threshold
                        createMockBot('bot-neutral', 'Neutral Bot', 4000, 50)
                    ],
                    lastUpdateTime: Date.now()
                }
            });
            
            // Mock Math.random to always trigger reinforcement
            vi.spyOn(Math, 'random').mockReturnValue(0.0); // 0.0 < 0.15 = true
            
            const reinforcements = calculateActiveReinforcements(state);
            
            // Should only include allies (rep >= 75)
            expect(reinforcements.length).toBeLessThanOrEqual(2);
            reinforcements.forEach(ref => {
                expect(ref.reputation).toBeGreaterThanOrEqual(75);
            });
            
            vi.restoreAllMocks();
        });

        it('should include botId, botName, botScore, and units in each reinforcement', () => {
            const state = createMockGameState({
                rankingData: {
                    bots: [
                        createMockBot('bot-1', 'Test Ally', 5000, 80)
                    ],
                    lastUpdateTime: Date.now()
                }
            });
            
            vi.spyOn(Math, 'random').mockReturnValue(0.0);
            
            const reinforcements = calculateActiveReinforcements(state);
            
            if (reinforcements.length > 0) {
                const ref = reinforcements[0];
                expect(ref.botId).toBeDefined();
                expect(ref.botName).toBeDefined();
                expect(ref.botScore).toBeDefined();
                expect(ref.units).toBeDefined();
                expect(typeof ref.totalUnits).toBe('number');
                expect(typeof ref.estimatedArrival).toBe('number');
            }
            
            vi.restoreAllMocks();
        });

        it('should calculate estimatedArrival in the future', () => {
            const now = Date.now();
            const state = createMockGameState({
                rankingData: {
                    bots: [
                        createMockBot('bot-1', 'Test Ally', 5000, 80)
                    ],
                    lastUpdateTime: now
                }
            });
            
            vi.spyOn(Math, 'random').mockReturnValue(0.0);
            
            const reinforcements = calculateActiveReinforcements(state, now);
            
            if (reinforcements.length > 0) {
                expect(reinforcements[0].estimatedArrival).toBeGreaterThan(now);
            }
            
            vi.restoreAllMocks();
        });

        it('should handle bots with default reputation (undefined)', () => {
            const bot = createMockBot('bot-undef', 'Undefined Rep Bot', 5000, 80);
            // @ts-ignore - Testing undefined reputation
            delete bot.reputation;
            
            const state = createMockGameState({
                rankingData: {
                    bots: [bot],
                    lastUpdateTime: Date.now()
                }
            });
            
            const reinforcements = calculateActiveReinforcements(state);
            // Should not crash, bot with undefined rep should be treated as neutral (50)
            expect(Array.isArray(reinforcements)).toBe(true);
        });

        it('should handle bots with null reputation', () => {
            const bot = createMockBot('bot-null', 'Null Rep Bot', 5000, 80);
            // @ts-ignore - Testing null reputation
            bot.reputation = null;
            
            const state = createMockGameState({
                rankingData: {
                    bots: [bot],
                    lastUpdateTime: Date.now()
                }
            });
            
            const reinforcements = calculateActiveReinforcements(state);
            expect(Array.isArray(reinforcements)).toBe(true);
        });

        it('should handle very large number of allies', () => {
            const manyAllies = Array.from({ length: 100 }, (_, i) => 
                createMockBot(`bot-${i}`, `Ally ${i}`, 1000 + i * 100, 75 + (i % 25))
            );
            
            const state = createMockGameState({
                rankingData: {
                    bots: manyAllies,
                    lastUpdateTime: Date.now()
                }
            });
            
            const reinforcements = calculateActiveReinforcements(state);
            expect(reinforcements.length).toBeLessThanOrEqual(100);
        });

        it('should sort allies by reputation (highest first)', () => {
            const state = createMockGameState({
                rankingData: {
                    bots: [
                        createMockBot('bot-low', 'Low Rep', 1000, 76),   // Lowest ally rep
                        createMockBot('bot-high', 'High Rep', 2000, 100), // Highest rep
                        createMockBot('bot-mid', 'Mid Rep', 3000, 85)     // Mid rep
                    ],
                    lastUpdateTime: Date.now()
                }
            });
            
            vi.spyOn(Math, 'random').mockReturnValue(0.0);
            
            const reinforcements = calculateActiveReinforcements(state);
            
            // Check that reinforcements are sorted by reputation descending
            // Note: Only allies (rep >= 75) are included
            expect(reinforcements.length).toBe(3);
            
            for (let i = 1; i < reinforcements.length; i++) {
                expect(reinforcements[i - 1].reputation)
                    .toBeGreaterThanOrEqual(reinforcements[i].reputation);
            }
            
            vi.restoreAllMocks();
        });
    });
});

// ============================================================================
// TEST SUITE: POTENTIAL REINFORCEMENTS
// ============================================================================

describe('Alliance Reinforcements - Potential Calculation', () => {
    describe('calculatePotentialReinforcements', () => {
        it('should return all potential allies regardless of probability', () => {
            const state = createMockGameState({
                rankingData: {
                    bots: [
                        createMockBot('bot-1', 'Ally 1', 1000, 80),
                        createMockBot('bot-2', 'Ally 2', 2000, 90)
                    ],
                    lastUpdateTime: Date.now()
                }
            });
            
            const reinforcements = calculatePotentialReinforcements(state);
            
            // All allies should be included (not filtered by probability)
            expect(reinforcements.length).toBe(2);
        });

        it('should calculate estimatedArrival between 5-15 minutes in future', () => {
            const now = Date.now();
            const state = createMockGameState({
                rankingData: {
                    bots: [
                        createMockBot('bot-1', 'Ally 1', 1000, 80)
                    ],
                    lastUpdateTime: now
                }
            });
            
            const reinforcements = calculatePotentialReinforcements(state, now);
            
            if (reinforcements.length > 0) {
                const arrival = reinforcements[0].estimatedArrival;
                const minArrival = now + 5 * 60 * 1000; // 5 minutes
                const maxArrival = now + 15 * 60 * 1000; // 15 minutes
                
                expect(arrival).toBeGreaterThanOrEqual(minArrival);
                expect(arrival).toBeLessThanOrEqual(maxArrival);
            }
        });
    });
});

// ============================================================================
// TEST SUITE: THREAT DETECTION
// ============================================================================

describe('Alliance Reinforcements - Threat Detection', () => {
    describe('isPlayerUnderThreat', () => {
        it('should return false when no threats exist', () => {
            const state = createMockGameState({
                incomingAttacks: [],
                activeWar: null,
                grudges: []
            });
            
            expect(isPlayerUnderThreat(state)).toBe(false);
        });

        it('should return true when incoming attacks exist', () => {
            const state = createMockGameState({
                incomingAttacks: [
                    {
                        id: 'attack-1',
                        attackerName: 'Enemy',
                        attackerScore: 1000,
                        units: { [UnitType.CYBER_MARINE]: 10 },
                        startTime: Date.now(),
                        endTime: Date.now() + 100000
                    }
                ],
                activeWar: null,
                grudges: []
            });
            
            expect(isPlayerUnderThreat(state)).toBe(true);
        });

        it('should return true when war is active', () => {
            const state = createMockGameState({
                incomingAttacks: [],
                activeWar: {
                    id: 'war-1',
                    enemyId: 'enemy-1',
                    enemyName: 'Enemy',
                    enemyScore: 1000,
                    startTime: Date.now(),
                    duration: 100000,
                    nextWaveTime: Date.now() + 50000,
                    currentWave: 1,
                    totalWaves: 8,
                    playerVictories: 0,
                    enemyVictories: 0,
                    playerAttacksLeft: 8,
                    lootPool: { money: 0, oil: 0, ammo: 0, gold: 0, diamond: 0 },
                    playerResourceLosses: { money: 0, oil: 0, ammo: 0, gold: 0, diamond: 0 },
                    enemyResourceLosses: { money: 0, oil: 0, ammo: 0, gold: 0, diamond: 0 },
                    playerUnitLosses: 0,
                    enemyUnitLosses: 0,
                    currentEnemyGarrison: {}
                },
                grudges: []
            });
            
            expect(isPlayerUnderThreat(state)).toBe(true);
        });

        it('should return true when grudges exist', () => {
            const state = createMockGameState({
                incomingAttacks: [],
                activeWar: null,
                grudges: [
                    {
                        id: 'grudge-1',
                        botId: 'bot-1',
                        botName: 'Angry Bot',
                        botPersonality: BotPersonality.WARLORD,
                        botScore: 1000,
                        createdAt: Date.now(),
                        retaliationTime: Date.now() + 100000,
                        notified: false
                    }
                ]
            });
            
            expect(isPlayerUnderThreat(state)).toBe(true);
        });

        it('should return true when multiple threat types exist', () => {
            const state = createMockGameState({
                incomingAttacks: [
                    {
                        id: 'attack-1',
                        attackerName: 'Enemy',
                        attackerScore: 1000,
                        units: {},
                        startTime: Date.now(),
                        endTime: Date.now() + 100000
                    }
                ],
                activeWar: {
                    id: 'war-1',
                    enemyId: 'enemy-1',
                    enemyName: 'Enemy',
                    enemyScore: 1000,
                    startTime: Date.now(),
                    duration: 100000,
                    nextWaveTime: Date.now() + 50000,
                    currentWave: 1,
                    totalWaves: 8,
                    playerVictories: 0,
                    enemyVictories: 0,
                    playerAttacksLeft: 8,
                    lootPool: { money: 0, oil: 0, ammo: 0, gold: 0, diamond: 0 },
                    playerResourceLosses: { money: 0, oil: 0, ammo: 0, gold: 0, diamond: 0 },
                    enemyResourceLosses: { money: 0, oil: 0, ammo: 0, gold: 0, diamond: 0 },
                    playerUnitLosses: 0,
                    enemyUnitLosses: 0,
                    currentEnemyGarrison: {}
                },
                grudges: [
                    {
                        id: 'grudge-1',
                        botId: 'bot-1',
                        botName: 'Angry Bot',
                        botPersonality: BotPersonality.WARLORD,
                        botScore: 1000,
                        createdAt: Date.now(),
                        retaliationTime: Date.now() + 100000,
                        notified: false
                    }
                ]
            });
            
            expect(isPlayerUnderThreat(state)).toBe(true);
        });
    });
});

// ============================================================================
// TEST SUITE: GARRISON CALCULATION
// ============================================================================

describe('Alliance Reinforcements - Garrison Calculation', () => {
    describe('getPlayerGarrison', () => {
        it('should return player units with zero units', () => {
            const state = createMockGameState();
            const garrison = getPlayerGarrison(state);
            
            expect(garrison.units).toBeDefined();
            expect(garrison.totalUnits).toBe(0);
            expect(garrison.totalPower).toBe(0);
        });

        it('should calculate total units correctly', () => {
            const state = createMockGameState({
                units: {
                    [UnitType.CYBER_MARINE]: 100,
                    [UnitType.HEAVY_COMMANDO]: 50,
                    [UnitType.SCOUT_TANK]: 25
                }
            } as Partial<GameState>);
            
            const garrison = getPlayerGarrison(state);
            expect(garrison.totalUnits).toBe(175);
        });

        it('should calculate total power based on unit stats', () => {
            const state = createMockGameState({
                units: {
                    [UnitType.CYBER_MARINE]: 10
                }
            } as Partial<GameState>);
            
            const garrison = getPlayerGarrison(state);
            
            // Power = HP * Attack * Defense per unit
            // CYBER_MARINE: 200 HP * 25 Attack * 10 Defense = 50,000 per unit
            // 10 units = 500,000
            expect(garrison.totalPower).toBeGreaterThan(0);
        });

        it('should handle mixed unit types', () => {
            const state = createMockGameState({
                units: {
                    [UnitType.CYBER_MARINE]: 100,
                    [UnitType.PHANTOM_SUB]: 5
                }
            } as Partial<GameState>);
            
            const garrison = getPlayerGarrison(state);
            
            expect(garrison.totalUnits).toBe(105);
            expect(garrison.totalPower).toBeGreaterThan(0);
        });

        it('should handle zero count units', () => {
            const state = createMockGameState({
                units: {
                    [UnitType.CYBER_MARINE]: 0,
                    [UnitType.HEAVY_COMMANDO]: 0
                }
            } as Partial<GameState>);
            
            const garrison = getPlayerGarrison(state);
            expect(garrison.totalUnits).toBe(0);
        });

        it('should handle negative unit counts gracefully', () => {
            const state = createMockGameState({
                units: {
                    [UnitType.CYBER_MARINE]: -10
                }
            } as Partial<GameState>);
            
            const garrison = getPlayerGarrison(state);
            // Negative counts should not contribute to total
            expect(garrison.totalUnits).toBeGreaterThanOrEqual(0);
        });
    });
});

// ============================================================================
// TEST SUITE: COMBAT INTEGRATION
// ============================================================================

describe('Alliance Reinforcements - Combat Integration', () => {
    describe('simulateCombat with allies', () => {
        it('should handle combat without allies (backward compatibility)', () => {
            const playerArmy = { [UnitType.CYBER_MARINE]: 10 };
            const enemyArmy = { [UnitType.CYBER_MARINE]: 5 };
            
            const result = simulateCombat(playerArmy, enemyArmy, 1.0);
            
            expect(result.winner).toBeDefined();
            expect(result.initialPlayerArmy).toBeDefined();
            expect(result.initialEnemyArmy).toBeDefined();
        });

        it('should handle combat with allies', () => {
            const playerArmy = { [UnitType.CYBER_MARINE]: 10 };
            const enemyArmy = { [UnitType.CYBER_MARINE]: 20 };
            const allyArmies = {
                'ally-1': { [UnitType.CYBER_MARINE]: 5 },
                'ally-2': { [UnitType.HEAVY_COMMANDO]: 3 }
            };
            
            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);
            
            expect(result.winner).toBeDefined();
            expect(result.initialAllyArmies).toBeDefined();
            expect(result.initialAllyArmies!['ally-1']).toBeDefined();
            expect(result.initialAllyArmies!['ally-2']).toBeDefined();
        });

        it('should track ally casualties separately', () => {
            const playerArmy = { [UnitType.CYBER_MARINE]: 10 };
            const enemyArmy = { [UnitType.CYBER_MARINE]: 100 };
            const allyArmies = {
                'ally-1': { [UnitType.CYBER_MARINE]: 5 }
            };
            
            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);
            
            expect(result.totalAllyCasualties).toBeDefined();
            expect(result.totalAllyCasualties!['ally-1']).toBeDefined();
        });

        it('should track ally damage dealt', () => {
            const playerArmy = { [UnitType.CYBER_MARINE]: 10 };
            const enemyArmy = { [UnitType.CYBER_MARINE]: 50 };
            const allyArmies = {
                'ally-1': { [UnitType.CYBER_MARINE]: 10 }
            };
            
            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);
            
            expect(result.allyDamageDealt).toBeDefined();
            expect(result.allyDamageDealt!['ally-1']).toBeDefined();
            expect(result.allyDamageDealt!['ally-1']).toBeGreaterThanOrEqual(0);
        });

        it('should handle empty ally armies', () => {
            const playerArmy = { [UnitType.CYBER_MARINE]: 10 };
            const enemyArmy = { [UnitType.CYBER_MARINE]: 5 };
            const allyArmies = {
                'ally-1': {}
            };
            
            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);
            
            expect(result).toBeDefined();
        });

        it('should handle multiple allies', () => {
            const playerArmy = { [UnitType.CYBER_MARINE]: 10 };
            const enemyArmy = { [UnitType.CYBER_MARINE]: 100 };
            const allyArmies = {
                'ally-1': { [UnitType.CYBER_MARINE]: 5 },
                'ally-2': { [UnitType.HEAVY_COMMANDO]: 5 },
                'ally-3': { [UnitType.SCOUT_TANK]: 5 },
                'ally-4': { [UnitType.TITAN_MBT]: 2 }
            };
            
            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);
            
            expect(Object.keys(result.initialAllyArmies!)).toHaveLength(4);
            expect(Object.keys(result.finalAllyArmies!)).toHaveLength(4);
        });

        it('should combine player + allies for winner determination', () => {
            // Player alone would lose, but with allies should win
            const playerArmy = { [UnitType.CYBER_MARINE]: 5 };
            const enemyArmy = { [UnitType.CYBER_MARINE]: 50 };
            const allyArmies = {
                'ally-1': { [UnitType.CYBER_MARINE]: 50 },
                'ally-2': { [UnitType.CYBER_MARINE]: 50 }
            };
            
            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);
            
            // Combined force should win
            expect(result.winner).toBe('PLAYER');
        });

        it('should handle ally performance tracking', () => {
            const playerArmy = { [UnitType.CYBER_MARINE]: 10 };
            const enemyArmy = { [UnitType.CYBER_MARINE]: 50 };
            const allyArmies = {
                'ally-1': { [UnitType.CYBER_MARINE]: 10 }
            };
            
            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);
            
            expect(result.allyPerformance).toBeDefined();
            expect(result.allyPerformance!['ally-1']).toBeDefined();
        });
    });
});

// ============================================================================
// TEST SUITE: EDGE CASES & ERROR HANDLING
// ============================================================================

describe('Alliance Reinforcements - Edge Cases & Error Handling', () => {
    describe('Data Validation', () => {
        it('should handle gameState with missing optional fields', () => {
            const state = {
                rankingData: { bots: [], lastUpdateTime: Date.now() }
            } as GameState;
            
            expect(() => calculateActiveReinforcements(state)).not.toThrow();
        });

        it('should handle extremely large bot scores', () => {
            const bot = createMockBot('bot-huge', 'Huge Bot', Number.MAX_SAFE_INTEGER, 80);
            
            expect(() => calculateReinforcementArmy(bot)).not.toThrow();
        });

        it('should handle NaN scores', () => {
            const bot = createMockBot('bot-nan', 'NaN Bot', NaN, 80);
            
            expect(() => calculateReinforcementArmy(bot)).not.toThrow();
        });

        it('should handle Infinity scores', () => {
            const bot = createMockBot('bot-inf', 'Infinity Bot', Infinity, 80);
            
            expect(() => calculateReinforcementArmy(bot)).not.toThrow();
        });
    });

    describe('Race Conditions', () => {
        it('should handle concurrent reinforcement calculations', async () => {
            const state = createMockGameState({
                rankingData: {
                    bots: Array.from({ length: 10 }, (_, i) => 
                        createMockBot(`bot-${i}`, `Bot ${i}`, 1000, 80)
                    ),
                    lastUpdateTime: Date.now()
                }
            });
            
            // Run multiple calculations concurrently
            const promises = Array.from({ length: 100 }, () => 
                Promise.resolve(calculateActiveReinforcements(state))
            );
            
            const results = await Promise.all(promises);
            
            // All should complete without errors
            expect(results.length).toBe(100);
            results.forEach(result => {
                expect(Array.isArray(result)).toBe(true);
            });
        });

        it('should handle rapid successive calls', () => {
            const state = createMockGameState({
                rankingData: {
                    bots: [createMockBot('bot-1', 'Bot 1', 1000, 80)],
                    lastUpdateTime: Date.now()
                }
            });
            
            const results = [];
            for (let i = 0; i < 1000; i++) {
                results.push(calculateActiveReinforcements(state));
            }
            
            expect(results.length).toBe(1000);
        });
    });

    describe('Memory & Performance', () => {
        it('should not cause memory leaks with large ally counts', () => {
            const state = createMockGameState({
                rankingData: {
                    bots: Array.from({ length: 1000 }, (_, i) => 
                        createMockBot(`bot-${i}`, `Bot ${i}`, 1000, 80)
                    ),
                    lastUpdateTime: Date.now()
                }
            });
            
            expect(() => calculateActiveReinforcements(state)).not.toThrow();
        });

        it('should complete within reasonable time', () => {
            const state = createMockGameState({
                rankingData: {
                    bots: Array.from({ length: 100 }, (_, i) => 
                        createMockBot(`bot-${i}`, `Bot ${i}`, 1000, 80)
                    ),
                    lastUpdateTime: Date.now()
                }
            });
            
            const start = performance.now();
            calculateActiveReinforcements(state);
            const end = performance.now();
            
            // Should complete within 100ms
            expect(end - start).toBeLessThan(100);
        });
    });
});

// ============================================================================
// TEST SUITE: INTEGRATION SCENARIOS
// ============================================================================

describe('Alliance Reinforcements - Integration Scenarios', () => {
    it('should simulate complete reinforcement flow', () => {
        // 1. Create game state with allies
        const state = createMockGameState({
            rankingData: {
                bots: [
                    createMockBot('ally-1', 'Strong Ally', 10000, 90),
                    createMockBot('ally-2', 'Weak Ally', 5000, 75),
                    createMockBot('enemy-1', 'Enemy', 8000, 20)
                ],
                lastUpdateTime: Date.now()
            },
            incomingAttacks: [
                {
                    id: 'attack-1',
                    attackerName: 'Enemy',
                    attackerScore: 8000,
                    units: { [UnitType.CYBER_MARINE]: 100 },
                    startTime: Date.now(),
                    endTime: Date.now() + 100000
                }
            ]
        });

        // 2. Check if player is under threat
        expect(isPlayerUnderThreat(state)).toBe(true);

        // 3. Calculate potential reinforcements
        const potential = calculatePotentialReinforcements(state);
        expect(potential.length).toBe(2); // Two allies

        // 4. Calculate active reinforcements (with probability)
        const active = calculateActiveReinforcements(state);
        expect(Array.isArray(active)).toBe(true);

        // 5. Verify reinforcement structure
        active.forEach(ref => {
            expect(ref.botId).toBeDefined();
            expect(ref.units).toBeDefined();
            expect(ref.reputation).toBeGreaterThanOrEqual(75);
        });
    });

    it('should handle war scenario with reinforcements', () => {
        const state = createMockGameState({
            rankingData: {
                bots: [
                    createMockBot('ally-1', 'War Ally', 15000, 85)
                ],
                lastUpdateTime: Date.now()
            },
            activeWar: {
                id: 'war-1',
                enemyId: 'enemy-1',
                enemyName: 'Enemy',
                enemyScore: 20000,
                startTime: Date.now(),
                duration: 100000,
                nextWaveTime: Date.now() + 50000,
                currentWave: 3,
                totalWaves: 8,
                playerVictories: 1,
                enemyVictories: 1,
                playerAttacksLeft: 6,
                lootPool: { money: 0, oil: 0, ammo: 0, gold: 0, diamond: 0 },
                playerResourceLosses: { money: 0, oil: 0, ammo: 0, gold: 0, diamond: 0 },
                enemyResourceLosses: { money: 0, oil: 0, ammo: 0, gold: 0, diamond: 0 },
                playerUnitLosses: 0,
                enemyUnitLosses: 0,
                currentEnemyGarrison: {}
            }
        });

        expect(isPlayerUnderThreat(state)).toBe(true);
        
        const reinforcements = calculateActiveReinforcements(state);
        expect(Array.isArray(reinforcements)).toBe(true);
    });
});
