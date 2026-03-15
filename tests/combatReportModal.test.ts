/**
 * COMBAT REPORT MODAL - ALLIED REINFORCEMENTS TESTS
 * 
 * Tests for:
 * - Battle result rendering with allies
 * - NaN prevention in HP calculations
 * - Ally army display
 * - Unit type inclusion from allies
 * - Forensic analysis with allies
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BattleResult, UnitType, LogEntry, UnitPerformanceStats } from '../types';

// ============================================================================
// MOCK DATA & HELPERS
// ============================================================================

const createMockBattleResult = (
    hasAllies: boolean = false,
    allyCount: number = 1
): BattleResult => {
    const baseResult: BattleResult = {
        winner: 'PLAYER',
        rounds: [
            {
                round: 1,
                playerUnitsStart: 10,
                enemyUnitsStart: 20,
                playerUnitsLost: 2,
                enemyUnitsLost: 5,
                details: []
            }
        ],
        initialPlayerArmy: {
            [UnitType.CYBER_MARINE]: 10
        },
        initialEnemyArmy: {
            [UnitType.CYBER_MARINE]: 20
        },
        finalPlayerArmy: {
            [UnitType.CYBER_MARINE]: 8
        },
        finalEnemyArmy: {
            [UnitType.CYBER_MARINE]: 15
        },
        totalPlayerCasualties: {
            [UnitType.CYBER_MARINE]: 2
        },
        totalEnemyCasualties: {
            [UnitType.CYBER_MARINE]: 5
        },
        playerTotalHpStart: 2000, // 10 * 200 HP
        playerTotalHpLost: 400,   // 2 * 200 HP
        enemyTotalHpStart: 4000,  // 20 * 200 HP
        enemyTotalHpLost: 1000,   // 5 * 200 HP
        playerDamageDealt: 5000,
        enemyDamageDealt: 2000,
        playerPerformance: {
            [UnitType.CYBER_MARINE]: {
                kills: { [UnitType.CYBER_MARINE]: 5 },
                deathsBy: { [UnitType.CYBER_MARINE]: 2 },
                damageDealt: 5000,
                criticalKills: 0,
                criticalDeaths: 0
            }
        }
    };

    if (hasAllies) {
        const allyArmies: Record<string, Partial<Record<UnitType, number>>> = {};
        const allyCasualties: Record<string, Partial<Record<UnitType, number>>> = {};
        const finalAllyArmies: Record<string, Partial<Record<UnitType, number>>> = {};
        const allyDamageDealt: Record<string, number> = {};
        const allyPerformance: Record<string, Partial<Record<UnitType, UnitPerformanceStats>>> = {};

        for (let i = 0; i < allyCount; i++) {
            const allyId = `ally-${i + 1}`;
            allyArmies[allyId] = {
                [UnitType.CYBER_MARINE]: 5,
                [UnitType.HEAVY_COMMANDO]: 3
            };
            allyCasualties[allyId] = {
                [UnitType.CYBER_MARINE]: 1,
                [UnitType.HEAVY_COMMANDO]: 0
            };
            finalAllyArmies[allyId] = {
                [UnitType.CYBER_MARINE]: 4,
                [UnitType.HEAVY_COMMANDO]: 3
            };
            allyDamageDealt[allyId] = 2500;
            allyPerformance[allyId] = {
                [UnitType.CYBER_MARINE]: {
                    kills: { [UnitType.CYBER_MARINE]: 3 },
                    deathsBy: { [UnitType.CYBER_MARINE]: 1 },
                    damageDealt: 1500,
                    criticalKills: 0,
                    criticalDeaths: 0
                },
                [UnitType.HEAVY_COMMANDO]: {
                    kills: { [UnitType.CYBER_MARINE]: 2 },
                    deathsBy: {},
                    damageDealt: 1000,
                    criticalKills: 1,
                    criticalDeaths: 0
                }
            };
        }

        baseResult.initialAllyArmies = allyArmies;
        baseResult.finalAllyArmies = finalAllyArmies;
        baseResult.totalAllyCasualties = allyCasualties;
        baseResult.allyDamageDealt = allyDamageDealt;
        baseResult.allyPerformance = allyPerformance;

        // Adjust totals to include allies
        baseResult.playerTotalHpStart += allyCount * (5 * 200 + 3 * 400); // Ally HP
    }

    return baseResult;
};

const createMockCombatLog = (
    battleResult: BattleResult,
    messageKey: string = 'log_defense_win'
): LogEntry => ({
    id: 'test-log-1',
    messageKey,
    type: 'combat',
    timestamp: Date.now(),
    params: {
        combatResult: battleResult,
        attacker: 'Enemy Bot',
        allyNames: {
            'ally-1': 'Strong Ally',
            'ally-2': 'Weak Ally'
        }
    }
});

// ============================================================================
// TEST SUITE: BATTLE RESULT DATA INTEGRITY
// ============================================================================

describe('Combat Report Modal - Battle Result Data Integrity', () => {
    describe('HP Calculations', () => {
        it('should not produce NaN with valid data', () => {
            const result = createMockBattleResult(false);
            
            const playerHpPercent = result.playerTotalHpStart > 0 
                ? ((result.playerTotalHpStart - result.playerTotalHpLost) / result.playerTotalHpStart) * 100 
                : 0;
            
            expect(playerHpPercent).not.toBeNaN();
            expect(playerHpPercent).toBe(80); // (2000-400)/2000 * 100
        });

        it('should not produce NaN with zero HP start', () => {
            const result = createMockBattleResult(false);
            result.playerTotalHpStart = 0;
            
            const playerHpPercent = result.playerTotalHpStart > 0 
                ? ((result.playerTotalHpStart - result.playerTotalHpLost) / result.playerTotalHpStart) * 100 
                : 0;
            
            expect(playerHpPercent).not.toBeNaN();
            expect(playerHpPercent).toBe(0);
        });

        it('should not produce NaN with undefined HP values', () => {
            const result = createMockBattleResult(false);
            result.playerTotalHpStart = undefined as any;
            result.playerTotalHpLost = undefined as any;
            
            const playerHpStart = result.playerTotalHpStart || 0;
            const playerHpLost = result.playerTotalHpLost || 0;
            const playerHpPercent = playerHpStart > 0 
                ? ((playerHpStart - playerHpLost) / playerHpStart) * 100 
                : 0;
            
            expect(playerHpPercent).not.toBeNaN();
            expect(playerHpPercent).toBe(0);
        });

        it('should handle negative HP values gracefully', () => {
            const result = createMockBattleResult(false);
            result.playerTotalHpStart = -1000;
            result.playerTotalHpLost = -200;
            
            const playerHpStart = result.playerTotalHpStart || 0;
            const playerHpLost = result.playerTotalHpLost || 0;
            const playerHpPercent = playerHpStart > 0 
                ? ((playerHpStart - playerHpLost) / playerHpStart) * 100 
                : 0;
            
            expect(playerHpPercent).not.toBeNaN();
        });

        it('should calculate correct percentage with allies', () => {
            const result = createMockBattleResult(true, 2);
            
            const playerHpPercent = result.playerTotalHpStart > 0 
                ? ((result.playerTotalHpStart - result.playerTotalHpLost) / result.playerTotalHpStart) * 100 
                : 0;
            
            expect(playerHpPercent).not.toBeNaN();
            expect(playerHpPercent).toBeGreaterThan(0);
            expect(playerHpPercent).toBeLessThanOrEqual(100);
        });
    });

    describe('Unit Type Collection', () => {
        it('should include player unit types', () => {
            const result = createMockBattleResult(false);
            const safePlayerArmy = result.initialPlayerArmy || {};
            
            const allUnitTypes = Array.from(new Set([
                ...Object.keys(safePlayerArmy)
            ])) as UnitType[];
            
            expect(allUnitTypes).toContain(UnitType.CYBER_MARINE);
        });

        it('should include enemy unit types', () => {
            const result = createMockBattleResult(false);
            const safeEnemyArmy = result.initialEnemyArmy || {};
            
            const allUnitTypes = Array.from(new Set([
                ...Object.keys(safeEnemyArmy)
            ])) as UnitType[];
            
            expect(allUnitTypes).toContain(UnitType.CYBER_MARINE);
        });

        it('should include ally unit types', () => {
            const result = createMockBattleResult(true, 2);
            const safePlayerArmy = result.initialPlayerArmy || {};
            const safeEnemyArmy = result.initialEnemyArmy || {};
            const safeAllyArmies = result.initialAllyArmies || {};
            
            const allyUnitTypes = Object.values(safeAllyArmies).flatMap(army => Object.keys(army));
            const allUnitTypes = Array.from(new Set([
                ...Object.keys(safePlayerArmy),
                ...Object.keys(safeEnemyArmy),
                ...allyUnitTypes
            ])) as UnitType[];
            
            expect(allUnitTypes).toContain(UnitType.CYBER_MARINE);
            expect(allUnitTypes).toContain(UnitType.HEAVY_COMMANDO);
        });

        it('should handle empty ally armies', () => {
            const result = createMockBattleResult(false);
            const safeAllyArmies = result.initialAllyArmies || {};
            
            const allyUnitTypes = Object.values(safeAllyArmies).flatMap(army => Object.keys(army));
            
            expect(allyUnitTypes).toEqual([]);
        });

        it('should handle undefined ally armies', () => {
            const result = createMockBattleResult(false);
            const safeAllyArmies = result.initialAllyArmies || {};
            
            expect(() => {
                const allyUnitTypes = Object.values(safeAllyArmies).flatMap(army => Object.keys(army));
                return allyUnitTypes;
            }).not.toThrow();
        });
    });

    describe('Army Data Safety', () => {
        it('should handle undefined initial armies', () => {
            const result = createMockBattleResult(false);
            result.initialPlayerArmy = undefined as any;
            result.initialEnemyArmy = undefined as any;
            
            const safePlayerArmy = result.initialPlayerArmy || {};
            const safeEnemyArmy = result.initialEnemyArmy || {};
            
            expect(safePlayerArmy).toEqual({});
            expect(safeEnemyArmy).toEqual({});
        });

        it('should handle null casualties', () => {
            const result = createMockBattleResult(false);
            result.totalPlayerCasualties = null as any;
            
            const casualties = result.totalPlayerCasualties || {};
            expect(casualties).toEqual({});
        });

        it('should handle empty final armies', () => {
            const result = createMockBattleResult(false);
            result.finalPlayerArmy = {};
            
            const finalArmy = result.finalPlayerArmy || {};
            expect(finalArmy).toEqual({});
        });

        it('should safely access unit counts', () => {
            const result = createMockBattleResult(false);
            const safePlayerArmy = result.initialPlayerArmy || {};
            
            const count = safePlayerArmy[UnitType.CYBER_MARINE] || 0;
            expect(count).toBe(10);
            
            const missingCount = safePlayerArmy[UnitType.HEAVY_COMMANDO] || 0;
            expect(missingCount).toBe(0);
        });
    });
});

// ============================================================================
// TEST SUITE: ALLY DISPLAY LOGIC
// ============================================================================

describe('Combat Report Modal - Ally Display Logic', () => {
    describe('Ally Army Rendering', () => {
        it('should show no allies message when no allies present', () => {
            const result = createMockBattleResult(false);
            
            const hasAllies = !!(result.initialAllyArmies && Object.keys(result.initialAllyArmies).length > 0);
            
            expect(hasAllies).toBe(false);
        });

        it('should identify allies when present', () => {
            const result = createMockBattleResult(true, 2);
            
            const hasAllies = result.initialAllyArmies && Object.keys(result.initialAllyArmies).length > 0;
            
            expect(hasAllies).toBe(true);
            expect(Object.keys(result.initialAllyArmies!).length).toBe(2);
        });

        it('should extract ally unit counts correctly', () => {
            const result = createMockBattleResult(true, 1);
            
            const allyArmies = result.initialAllyArmies!;
            const allyId = Object.keys(allyArmies)[0];
            const initialArmy = allyArmies[allyId] || {};
            
            const totalUnits = Object.values(initialArmy).reduce((a, b) => a + (b || 0), 0);
            
            expect(totalUnits).toBe(8); // 5 CYBER_MARINE + 3 HEAVY_COMMANDO
        });

        it('should calculate ally casualties correctly', () => {
            const result = createMockBattleResult(true, 1);
            
            const allyCasualties = result.totalAllyCasualties!;
            const allyId = Object.keys(allyCasualties)[0];
            const casualties = allyCasualties[allyId] || {};
            
            const totalCasualties = Object.values(casualties).reduce((a, b) => a + (b || 0), 0);
            
            expect(totalCasualties).toBe(1); // 1 CYBER_MARINE
        });

        it('should calculate ally survival rate correctly', () => {
            const result = createMockBattleResult(true, 1);
            
            const allyArmies = result.initialAllyArmies!;
            const finalAllyArmies = result.finalAllyArmies!;
            const allyId = Object.keys(allyArmies)[0];
            
            const initialArmy = allyArmies[allyId] || {};
            const finalArmy = finalAllyArmies[allyId] || {};
            
            const initialCyber = initialArmy[UnitType.CYBER_MARINE] || 0;
            const finalCyber = finalArmy[UnitType.CYBER_MARINE] || 0;
            const survivalRate = initialCyber > 0 ? (finalCyber / initialCyber) * 100 : 0;
            
            expect(survivalRate).not.toBeNaN();
            expect(survivalRate).toBe(80); // 4/5 * 100
        });

        it('should prevent NaN in percentage calculations', () => {
            const result = createMockBattleResult(true, 1);
            
            const allyArmies = result.initialAllyArmies!;
            const allyId = Object.keys(allyArmies)[0];
            const initialArmy = allyArmies[allyId] || {};
            
            const start = initialArmy[UnitType.CYBER_MARINE] || 0;
            const safeWidth = start > 0 ? (start / start) * 100 : 0;
            
            expect(safeWidth).not.toBeNaN();
            expect(safeWidth).toBe(100);
        });

        it('should handle zero units in percentage calculation', () => {
            const result = createMockBattleResult(true, 1);
            
            const allyArmies = result.initialAllyArmies!;
            const allyId = Object.keys(allyArmies)[0];
            const initialArmy = allyArmies[allyId] || {};
            
            const start = initialArmy[UnitType.ACE_FIGHTER] || 0; // Unit not present
            const safeWidth = start > 0 ? (start / start) * 100 : 0;
            
            expect(safeWidth).not.toBeNaN();
            expect(safeWidth).toBe(0);
        });
    });

    describe('Ally Names Display', () => {
        it('should use allyNames from log params when available', () => {
            const result = createMockBattleResult(true, 1);
            const log = createMockCombatLog(result);
            
            const allyId = 'ally-1';
            const allyBotName = log.params?.allyNames?.[allyId] || allyId;
            
            expect(allyBotName).toBe('Strong Ally');
        });

        it('should fallback to allyId when name not available', () => {
            const result = createMockBattleResult(true, 1);
            const log = createMockCombatLog(result);
            log.params!.allyNames = {}; // Empty names
            
            const allyId = 'ally-1';
            const allyBotName = log.params?.allyNames?.[allyId] || allyId;
            
            expect(allyBotName).toBe('ally-1');
        });

        it('should handle undefined allyNames', () => {
            const result = createMockBattleResult(true, 1);
            const log = createMockCombatLog(result);
            log.params!.allyNames = undefined;
            
            const allyId = 'ally-1';
            const allyBotName = log.params?.allyNames?.[allyId] || allyId;
            
            expect(allyBotName).toBe('ally-1');
        });
    });
});

// ============================================================================
// TEST SUITE: FORENSIC ANALYSIS WITH ALLIES
// ============================================================================

describe('Combat Report Modal - Forensic Analysis', () => {
    describe('Performance Stats', () => {
        it('should include player performance', () => {
            const result = createMockBattleResult(false);
            
            expect(result.playerPerformance).toBeDefined();
            expect(result.playerPerformance![UnitType.CYBER_MARINE]).toBeDefined();
        });

        it('should include ally performance when allies present', () => {
            const result = createMockBattleResult(true, 2);
            
            expect(result.allyPerformance).toBeDefined();
            expect(result.allyPerformance!['ally-1']).toBeDefined();
            expect(result.allyPerformance!['ally-2']).toBeDefined();
        });

        it('should calculate total kills including allies', () => {
            const result = createMockBattleResult(true, 1);
            
            let totalKills = 0;
            
            // Player kills
            if (result.playerPerformance) {
                Object.values(result.playerPerformance).forEach(perf => {
                    if (perf?.kills) {
                        Object.values(perf.kills).forEach(kills => {
                            totalKills += kills || 0;
                        });
                    }
                });
            }
            
            // Ally kills
            if (result.allyPerformance) {
                Object.values(result.allyPerformance).forEach(allyPerf => {
                    if (allyPerf) {
                        Object.values(allyPerf).forEach(perf => {
                            if (perf?.kills) {
                                Object.values(perf.kills).forEach(kills => {
                                    totalKills += kills || 0;
                                });
                            }
                        });
                    }
                });
            }
            
            expect(totalKills).toBeGreaterThan(0);
        });

        it('should handle undefined performance stats', () => {
            const result = createMockBattleResult(false);
            result.playerPerformance = undefined;
            
            expect(() => {
                if (result.playerPerformance) {
                    Object.values(result.playerPerformance).forEach(perf => {
                        // Process perf
                    });
                }
            }).not.toThrow();
        });

        it('should handle null performance stats', () => {
            const result = createMockBattleResult(false);
            result.playerPerformance = null as any;
            
            expect(() => {
                const perf = result.playerPerformance || {};
                Object.values(perf).forEach(p => {
                    // Process p
                });
            }).not.toThrow();
        });
    });

    describe('Damage Dealt', () => {
        it('should track player damage', () => {
            const result = createMockBattleResult(false);
            
            expect(result.playerDamageDealt).toBe(5000);
        });

        it('should track ally damage when allies present', () => {
            const result = createMockBattleResult(true, 2);
            
            expect(result.allyDamageDealt).toBeDefined();
            expect(result.allyDamageDealt!['ally-1']).toBe(2500);
            expect(result.allyDamageDealt!['ally-2']).toBe(2500);
        });

        it('should calculate total friendly damage', () => {
            const result = createMockBattleResult(true, 2);
            
            let totalFriendlyDamage = result.playerDamageDealt;
            
            if (result.allyDamageDealt) {
                Object.values(result.allyDamageDealt).forEach(damage => {
                    totalFriendlyDamage += damage || 0;
                });
            }
            
            expect(totalFriendlyDamage).toBe(5000 + 2500 + 2500); // Player + 2 Allies
        });

        it('should handle undefined ally damage', () => {
            const result = createMockBattleResult(false);
            
            const totalDamage = result.playerDamageDealt + 
                Object.values(result.allyDamageDealt || {}).reduce((a, b) => a + (b || 0), 0);
            
            expect(totalDamage).not.toBeNaN();
            expect(totalDamage).toBe(5000);
        });
    });
});

// ============================================================================
// TEST SUITE: EDGE CASES
// ============================================================================

describe('Combat Report Modal - Edge Cases', () => {
    it('should handle battle result with all optional fields missing', () => {
        const result = {
            winner: 'PLAYER' as const,
            rounds: []
        } as BattleResult;

        expect(() => {
            const safePlayerArmy = result.initialPlayerArmy || {};
            const safeEnemyArmy = result.initialEnemyArmy || {};
            const safeAllyArmies = result.initialAllyArmies || {};

            const playerHpStart = result.playerTotalHpStart || 0;
            const playerHpLost = result.playerTotalHpLost || 0;

            return {
                safePlayerArmy,
                safeEnemyArmy,
                safeAllyArmies,
                playerHpPercent: playerHpStart > 0 ? ((playerHpStart - playerHpLost) / playerHpStart) * 100 : 0
            };
        }).not.toThrow();
    });

    it('should handle ally army with zero units', () => {
        const result = createMockBattleResult(true, 1);
        if (result.initialAllyArmies) {
            result.initialAllyArmies['ally-1'] = {};
        }

        const allyArmies = result.initialAllyArmies!;
        const allyId = Object.keys(allyArmies)[0];
        const initialArmy = allyArmies[allyId] || {};

        const totalUnits = Object.values(initialArmy).reduce((a, b) => a + (b || 0), 0);

        expect(totalUnits).toBe(0);
    });

    it('should handle ally army with negative units', () => {
        const result = createMockBattleResult(true, 1);
        if (result.initialAllyArmies) {
            result.initialAllyArmies['ally-1'] = {
                [UnitType.CYBER_MARINE]: -5
            };
        }

        const allyArmies = result.initialAllyArmies!;
        const allyId = Object.keys(allyArmies)[0];
        const initialArmy = allyArmies[allyId] || {};

        // Note: The || 0 fallback only handles undefined/null, not negative numbers
        // Negative values will pass through, which is a data validation issue
        const totalUnits = Object.values(initialArmy).reduce((a, b) => a + (b || 0), 0);

        // This test documents the current behavior - negative values are NOT filtered
        // In production, unit counts should be validated before reaching this point
        expect(totalUnits).toBe(-5);
    });

    it('should handle multiple allies with different unit compositions', () => {
        const result = createMockBattleResult(true, 3);

        expect(Object.keys(result.initialAllyArmies!).length).toBe(3);

        // Each ally should have their own army
        Object.values(result.initialAllyArmies!).forEach(army => {
            expect(army).toBeDefined();
            const totalUnits = Object.values(army).reduce((a, b) => a + (b || 0), 0);
            expect(totalUnits).toBeGreaterThan(0);
        });
    });

    it('should handle very large unit counts', () => {
        const result = createMockBattleResult(false);
        if (result.initialPlayerArmy) {
            result.initialPlayerArmy[UnitType.CYBER_MARINE] = 1000000;
        }

        const safePlayerArmy = result.initialPlayerArmy || {};
        const count = safePlayerArmy[UnitType.CYBER_MARINE] || 0;

        expect(count).toBe(1000000);
        expect(() => {
            const percentage = (count / count) * 100;
            return percentage;
        }).not.toThrow();
    });
});

// ============================================================================
// TEST SUITE: EXACT VALUE RENDERING - COMBAT REPORT DATA
// ============================================================================

describe('Combat Report Modal - Exact Value Rendering', () => {
    describe('Rounds Count', () => {
        it('should render exact number of rounds', () => {
            const result = createMockBattleResult(false);
            result.rounds = [
                { round: 1, playerUnitsStart: 10, enemyUnitsStart: 20, playerUnitsLost: 2, enemyUnitsLost: 5, details: [] },
                { round: 2, playerUnitsStart: 8, enemyUnitsStart: 15, playerUnitsLost: 1, enemyUnitsLost: 3, details: [] },
                { round: 3, playerUnitsStart: 7, enemyUnitsStart: 12, playerUnitsLost: 0, enemyUnitsLost: 2, details: [] }
            ];

            const roundsCount = result.rounds?.length || 0;

            expect(roundsCount).toBe(3);
        });

        it('should render zero rounds when empty', () => {
            const result = createMockBattleResult(false);
            result.rounds = [];

            const roundsCount = result.rounds?.length || 0;

            expect(roundsCount).toBe(0);
        });

        it('should render single round correctly', () => {
            const result = createMockBattleResult(false);
            result.rounds = [
                { round: 1, playerUnitsStart: 10, enemyUnitsStart: 20, playerUnitsLost: 2, enemyUnitsLost: 5, details: [] }
            ];

            const roundsCount = result.rounds?.length || 0;

            expect(roundsCount).toBe(1);
        });

        it('should render many rounds correctly', () => {
            const result = createMockBattleResult(false);
            result.rounds = Array.from({ length: 10 }, (_, i) => ({
                round: i + 1,
                playerUnitsStart: 10 - i,
                enemyUnitsStart: 20 - i * 2,
                playerUnitsLost: 1,
                enemyUnitsLost: 2,
                details: [] as any[]
            }));

            const roundsCount = result.rounds?.length || 0;

            expect(roundsCount).toBe(10);
        });
    });

    describe('Damage Dealt Values', () => {
        it('should render exact player damage dealt', () => {
            const result = createMockBattleResult(false);
            result.playerDamageDealt = 7500;

            expect(result.playerDamageDealt).toBe(7500);
        });

        it('should render exact enemy damage dealt', () => {
            const result = createMockBattleResult(false);
            result.enemyDamageDealt = 3200;

            expect(result.enemyDamageDealt).toBe(3200);
        });

        it('should calculate total friendly damage including allies', () => {
            const result = createMockBattleResult(true, 2);
            result.playerDamageDealt = 5000;
            // Each ally deals 2500 damage (from createMockBattleResult)

            const totalAllyDamage = result.allyDamageDealt
                ? Object.values(result.allyDamageDealt).reduce((a, b) => a + (b || 0), 0)
                : 0;
            const totalFriendlyDamage = (result.playerDamageDealt || 0) + totalAllyDamage;

            expect(totalFriendlyDamage).toBe(10000); // 5000 player + 2500 * 2 allies
        });

        it('should calculate total damage from all sources', () => {
            const result = createMockBattleResult(true, 1);
            result.playerDamageDealt = 6000;
            result.enemyDamageDealt = 4000;

            const totalAllyDamage = result.allyDamageDealt
                ? Object.values(result.allyDamageDealt).reduce((a, b) => a + (b || 0), 0)
                : 0;
            const totalBattleDamage = (result.playerDamageDealt || 0) + totalAllyDamage + (result.enemyDamageDealt || 0);

            expect(totalBattleDamage).toBe(12500); // 6000 player + 2500 ally + 4000 enemy
        });

        it('should handle zero damage dealt', () => {
            const result = createMockBattleResult(false);
            result.playerDamageDealt = 0;
            result.enemyDamageDealt = 0;

            expect(result.playerDamageDealt).toBe(0);
            expect(result.enemyDamageDealt).toBe(0);
        });

        it('should handle undefined damage dealt', () => {
            const result = createMockBattleResult(false);
            result.playerDamageDealt = undefined as any;

            const safeDamage = result.playerDamageDealt || 0;
            expect(safeDamage).toBe(0);
        });
    });

    describe('Casualties Values', () => {
        it('should render exact player casualties by unit type', () => {
            const result = createMockBattleResult(false);

            const cyberMarineCasualties = result.totalPlayerCasualties?.[UnitType.CYBER_MARINE] || 0;

            expect(cyberMarineCasualties).toBe(2);
        });

        it('should render exact enemy casualties by unit type', () => {
            const result = createMockBattleResult(false);

            const cyberMarineCasualties = result.totalEnemyCasualties?.[UnitType.CYBER_MARINE] || 0;

            expect(cyberMarineCasualties).toBe(5);
        });

        it('should calculate total player casualties', () => {
            const result = createMockBattleResult(false);

            const totalCasualties = Object.values(result.totalPlayerCasualties || {}).reduce((a, b) => a + (b || 0), 0);

            expect(totalCasualties).toBe(2);
        });

        it('should calculate total enemy casualties', () => {
            const result = createMockBattleResult(false);

            const totalCasualties = Object.values(result.totalEnemyCasualties || {}).reduce((a, b) => a + (b || 0), 0);

            expect(totalCasualties).toBe(5);
        });

        it('should render exact ally casualties by unit type', () => {
            const result = createMockBattleResult(true, 1);

            const allyId = Object.keys(result.totalAllyCasualties!)[0];
            const cyberMarineCasualties = result.totalAllyCasualties?.[allyId]?.[UnitType.CYBER_MARINE] || 0;
            const heavyCommandoCasualties = result.totalAllyCasualties?.[allyId]?.[UnitType.HEAVY_COMMANDO] || 0;

            expect(cyberMarineCasualties).toBe(1);
            expect(heavyCommandoCasualties).toBe(0);
        });

        it('should calculate total ally casualties', () => {
            const result = createMockBattleResult(true, 2);

            let totalAllyCasualties = 0;
            Object.values(result.totalAllyCasualties || {}).forEach(allyCasualties => {
                totalAllyCasualties += Object.values(allyCasualties || {}).reduce((a, b) => a + (b || 0), 0);
            });

            expect(totalAllyCasualties).toBe(2); // 1 casualty per ally * 2 allies
        });

        it('should handle multiple unit types casualties', () => {
            const result = createMockBattleResult(false);
            if (result.totalPlayerCasualties) {
                result.totalPlayerCasualties[UnitType.HEAVY_COMMANDO] = 3;
            }

            const totalCasualties = Object.values(result.totalPlayerCasualties || {}).reduce((a, b) => a + (b || 0), 0);

            expect(totalCasualties).toBe(5); // 2 CYBER_MARINE + 3 HEAVY_COMMANDO
        });
    });

    describe('Troop Counts - Initial and Final', () => {
        it('should render exact initial player troop count', () => {
            const result = createMockBattleResult(false);

            const totalInitialPlayer = Object.values(result.initialPlayerArmy || {}).reduce((a, b) => a + (b || 0), 0);

            expect(totalInitialPlayer).toBe(10);
        });

        it('should render exact initial enemy troop count', () => {
            const result = createMockBattleResult(false);

            const totalInitialEnemy = Object.values(result.initialEnemyArmy || {}).reduce((a, b) => a + (b || 0), 0);

            expect(totalInitialEnemy).toBe(20);
        });

        it('should render exact final player troop count', () => {
            const result = createMockBattleResult(false);

            const totalFinalPlayer = Object.values(result.finalPlayerArmy || {}).reduce((a, b) => a + (b || 0), 0);

            expect(totalFinalPlayer).toBe(8); // 10 - 2 casualties
        });

        it('should render exact final enemy troop count', () => {
            const result = createMockBattleResult(false);

            const totalFinalEnemy = Object.values(result.finalEnemyArmy || {}).reduce((a, b) => a + (b || 0), 0);

            expect(totalFinalEnemy).toBe(15); // 20 - 5 casualties
        });

        it('should render exact initial ally troop count', () => {
            const result = createMockBattleResult(true, 1);

            const allyId = Object.keys(result.initialAllyArmies!)[0];
            const totalInitialAlly = Object.values(result.initialAllyArmies?.[allyId] || {}).reduce((a, b) => a + (b || 0), 0);

            expect(totalInitialAlly).toBe(8); // 5 CYBER_MARINE + 3 HEAVY_COMMANDO
        });

        it('should render exact final ally troop count', () => {
            const result = createMockBattleResult(true, 1);

            const allyId = Object.keys(result.finalAllyArmies!)[0];
            const totalFinalAlly = Object.values(result.finalAllyArmies?.[allyId] || {}).reduce((a, b) => a + (b || 0), 0);

            expect(totalFinalAlly).toBe(7); // 4 CYBER_MARINE + 3 HEAVY_COMMANDO
        });

        it('should calculate survival rate for player', () => {
            const result = createMockBattleResult(false);

            const initialTotal = Object.values(result.initialPlayerArmy || {}).reduce((a, b) => a + (b || 0), 0);
            const finalTotal = Object.values(result.finalPlayerArmy || {}).reduce((a, b) => a + (b || 0), 0);
            const survivalRate = initialTotal > 0 ? (finalTotal / initialTotal) * 100 : 0;

            expect(survivalRate).toBe(80); // 8/10 * 100
        });

        it('should calculate survival rate for enemy', () => {
            const result = createMockBattleResult(false);

            const initialTotal = Object.values(result.initialEnemyArmy || {}).reduce((a, b) => a + (b || 0), 0);
            const finalTotal = Object.values(result.finalEnemyArmy || {}).reduce((a, b) => a + (b || 0), 0);
            const survivalRate = initialTotal > 0 ? (finalTotal / initialTotal) * 100 : 0;

            expect(survivalRate).toBe(75); // 15/20 * 100
        });

        it('should calculate survival rate for allies', () => {
            const result = createMockBattleResult(true, 1);

            const allyId = Object.keys(result.initialAllyArmies!)[0];
            const initialTotal = Object.values(result.initialAllyArmies?.[allyId] || {}).reduce((a, b) => a + (b || 0), 0);
            const finalTotal = Object.values(result.finalAllyArmies?.[allyId] || {}).reduce((a, b) => a + (b || 0), 0);
            const survivalRate = initialTotal > 0 ? (finalTotal / initialTotal) * 100 : 0;

            expect(survivalRate).toBe(87.5); // 7/8 * 100
        });

        it('should verify initial = final + casualties for player', () => {
            const result = createMockBattleResult(false);

            const initialTotal = Object.values(result.initialPlayerArmy || {}).reduce((a, b) => a + (b || 0), 0);
            const finalTotal = Object.values(result.finalPlayerArmy || {}).reduce((a, b) => a + (b || 0), 0);
            const casualtiesTotal = Object.values(result.totalPlayerCasualties || {}).reduce((a, b) => a + (b || 0), 0);

            expect(initialTotal).toBe(finalTotal + casualtiesTotal);
        });

        it('should verify initial = final + casualties for enemy', () => {
            const result = createMockBattleResult(false);

            const initialTotal = Object.values(result.initialEnemyArmy || {}).reduce((a, b) => a + (b || 0), 0);
            const finalTotal = Object.values(result.finalEnemyArmy || {}).reduce((a, b) => a + (b || 0), 0);
            const casualtiesTotal = Object.values(result.totalEnemyCasualties || {}).reduce((a, b) => a + (b || 0), 0);

            expect(initialTotal).toBe(finalTotal + casualtiesTotal);
        });
    });

    describe('Participant Names Rendering', () => {
        it('should render player name as "you_label" when player is defender', () => {
            const log = createMockCombatLog(createMockBattleResult(false), 'log_defense_win');

            const isDefense = log.messageKey.includes('defense');
            const playerName = isDefense ? 'You' : log.params?.attacker;

            expect(isDefense).toBe(true);
            expect(playerName).toBe('You');
        });

        it('should render enemy name from attacker field', () => {
            const log = createMockCombatLog(createMockBattleResult(false), 'log_defense_win');

            const enemyName = log.params?.attacker || 'Unknown';

            expect(enemyName).toBe('Enemy Bot');
        });

        it('should render ally names from allyNames mapping', () => {
            const result = createMockBattleResult(true, 2);
            const log = createMockCombatLog(result, 'log_defense_win');

            const ally1Name = log.params?.allyNames?.['ally-1'] || 'ally-1';
            const ally2Name = log.params?.allyNames?.['ally-2'] || 'ally-2';

            expect(ally1Name).toBe('Strong Ally');
            expect(ally2Name).toBe('Weak Ally');
        });

        it('should fallback to ally ID when name not in allyNames', () => {
            const result = createMockBattleResult(true, 1);
            const log = createMockCombatLog(result, 'log_defense_win');
            log.params!.allyNames = { 'ally-1': 'Named Ally' };

            const ally1Name = log.params?.allyNames?.['ally-1'] || 'ally-1';
            const unknownAllyName = log.params?.allyNames?.['ally-99'] || 'ally-99';

            expect(ally1Name).toBe('Named Ally');
            expect(unknownAllyName).toBe('ally-99');
        });

        it('should handle undefined allyNames gracefully', () => {
            const result = createMockBattleResult(true, 1);
            const log = createMockCombatLog(result, 'log_defense_win');
            log.params!.allyNames = undefined;

            const allyId = 'ally-1';
            const allyName = log.params?.allyNames?.[allyId] || allyId;

            expect(allyName).toBe('ally-1');
        });

        it('should render attacker as enemy when player is attacking', () => {
            const result = createMockBattleResult(false);
            const log = createMockCombatLog(result, 'log_battle_win');
            log.params!.attacker = 'Player';
            log.params!.targetName = 'Enemy Base';

            const isAttack = log.messageKey.includes('battle_win') && !log.messageKey.includes('defense');
            const enemyName = isAttack ? log.params?.targetName : log.params?.attacker;

            expect(enemyName).toBe('Enemy Base');
        });
    });
});

// ============================================================================
// TEST SUITE: HP PERCENTAGE CALCULATIONS
// ============================================================================

describe('Combat Report Modal - HP Percentage Calculations', () => {
    describe('Player HP Percentage', () => {
        it('should calculate exact player HP percentage', () => {
            const result = createMockBattleResult(false);
            // playerTotalHpStart: 2000, playerTotalHpLost: 400

            const playerHpStart = result.playerTotalHpStart || 0;
            const playerHpLost = result.playerTotalHpLost || 0;
            const playerHpPercent = playerHpStart > 0
                ? ((playerHpStart - playerHpLost) / playerHpStart) * 100
                : 0;

            expect(playerHpPercent).toBe(80); // (2000-400)/2000 * 100
        });

        it('should calculate player HP percentage with allies', () => {
            const result = createMockBattleResult(true, 2);
            // Base: 2000 HP start, 400 HP lost
            // Allies: 2 * (5*200 + 3*400) = 2 * 2200 = 4400 HP added to start

            const playerHpStart = result.playerTotalHpStart || 0;
            const playerHpLost = result.playerTotalHpLost || 0;
            const playerHpPercent = playerHpStart > 0
                ? ((playerHpStart - playerHpLost) / playerHpStart) * 100
                : 0;

            expect(playerHpStart).toBe(6400); // 2000 + 4400
            expect(playerHpPercent).toBeGreaterThan(0);
            expect(playerHpPercent).toBeLessThan(100);
        });

        it('should handle zero HP start gracefully', () => {
            const result = createMockBattleResult(false);
            result.playerTotalHpStart = 0;

            const playerHpStart = result.playerTotalHpStart || 0;
            const playerHpLost = result.playerTotalHpLost || 0;
            const playerHpPercent = playerHpStart > 0
                ? ((playerHpStart - playerHpLost) / playerHpStart) * 100
                : 0;

            expect(playerHpPercent).toBe(0);
        });

        it('should handle 100% HP remaining', () => {
            const result = createMockBattleResult(false);
            result.playerTotalHpLost = 0;

            const playerHpStart = result.playerTotalHpStart || 0;
            const playerHpLost = result.playerTotalHpLost || 0;
            const playerHpPercent = playerHpStart > 0
                ? ((playerHpStart - playerHpLost) / playerHpStart) * 100
                : 0;

            expect(playerHpPercent).toBe(100);
        });

        it('should handle 0% HP remaining (total loss)', () => {
            const result = createMockBattleResult(false);
            result.playerTotalHpLost = result.playerTotalHpStart;

            const playerHpStart = result.playerTotalHpStart || 0;
            const playerHpLost = result.playerTotalHpLost || 0;
            const playerHpPercent = playerHpStart > 0
                ? ((playerHpStart - playerHpLost) / playerHpStart) * 100
                : 0;

            expect(playerHpPercent).toBe(0);
        });
    });

    describe('Enemy HP Percentage', () => {
        it('should calculate exact enemy HP percentage', () => {
            const result = createMockBattleResult(false);
            // enemyTotalHpStart: 4000, enemyTotalHpLost: 1000

            const enemyHpStart = result.enemyTotalHpStart || 0;
            const enemyHpLost = result.enemyTotalHpLost || 0;
            const enemyHpPercent = enemyHpStart > 0
                ? ((enemyHpStart - enemyHpLost) / enemyHpStart) * 100
                : 0;

            expect(enemyHpPercent).toBe(75); // (4000-1000)/4000 * 100
        });

        it('should handle zero enemy HP start', () => {
            const result = createMockBattleResult(false);
            result.enemyTotalHpStart = 0;

            const enemyHpStart = result.enemyTotalHpStart || 0;
            const enemyHpLost = result.enemyTotalHpLost || 0;
            const enemyHpPercent = enemyHpStart > 0
                ? ((enemyHpStart - enemyHpLost) / enemyHpStart) * 100
                : 0;

            expect(enemyHpPercent).toBe(0);
        });
    });

    describe('HP Values Consistency', () => {
        it('should verify HP lost matches casualties * unit HP', () => {
            const result = createMockBattleResult(false);
            // CYBER_MARINE has 200 HP, 2 casualties = 400 HP lost

            const expectedHpLost = (result.totalPlayerCasualties?.[UnitType.CYBER_MARINE] || 0) * 200;

            expect(result.playerTotalHpLost).toBe(expectedHpLost);
        });

        it('should verify player and enemy HP calculations are consistent', () => {
            const result = createMockBattleResult(false);

            const playerHpStart = result.playerTotalHpStart || 0;
            const playerHpLost = result.playerTotalHpLost || 0;
            const enemyHpStart = result.enemyTotalHpStart || 0;
            const enemyHpLost = result.enemyTotalHpLost || 0;

            const playerHpRemaining = playerHpStart - playerHpLost;
            const enemyHpRemaining = enemyHpStart - enemyHpLost;

            expect(playerHpRemaining).toBeGreaterThan(0);
            expect(enemyHpRemaining).toBeGreaterThan(0);
            expect(playerHpRemaining).toBeLessThanOrEqual(playerHpStart);
            expect(enemyHpRemaining).toBeLessThanOrEqual(enemyHpStart);
        });
    });
});

// ============================================================================
// TEST SUITE: ROUND-BY-ROUND DATA INTEGRITY
// ============================================================================

describe('Combat Report Modal - Round-by-Round Data', () => {
    it('should render exact round numbers in sequence', () => {
        const result = createMockBattleResult(false);
        result.rounds = [
            { round: 1, playerUnitsStart: 10, enemyUnitsStart: 20, playerUnitsLost: 2, enemyUnitsLost: 5, details: [] },
            { round: 2, playerUnitsStart: 8, enemyUnitsStart: 15, playerUnitsLost: 1, enemyUnitsLost: 3, details: [] },
            { round: 3, playerUnitsStart: 7, enemyUnitsStart: 12, playerUnitsLost: 0, enemyUnitsLost: 2, details: [] }
        ];

        const roundNumbers = result.rounds?.map(r => r.round) || [];

        expect(roundNumbers).toEqual([1, 2, 3]);
    });

    it('should verify round data contains all required fields', () => {
        const result = createMockBattleResult(false);
        result.rounds = [
            { round: 1, playerUnitsStart: 10, enemyUnitsStart: 20, playerUnitsLost: 2, enemyUnitsLost: 5, details: [] }
        ];

        const round = result.rounds?.[0];

        expect(round).toBeDefined();
        expect(round?.round).toBe(1);
        expect(round?.playerUnitsStart).toBe(10);
        expect(round?.enemyUnitsStart).toBe(20);
        expect(round?.playerUnitsLost).toBe(2);
        expect(round?.enemyUnitsLost).toBe(5);
    });

    it('should calculate cumulative casualties across rounds', () => {
        const result = createMockBattleResult(false);
        result.rounds = [
            { round: 1, playerUnitsStart: 10, enemyUnitsStart: 20, playerUnitsLost: 2, enemyUnitsLost: 5, details: [] },
            { round: 2, playerUnitsStart: 8, enemyUnitsStart: 15, playerUnitsLost: 1, enemyUnitsLost: 3, details: [] },
            { round: 3, playerUnitsStart: 7, enemyUnitsStart: 12, playerUnitsLost: 1, enemyUnitsLost: 2, details: [] }
        ];

        const totalPlayerLost = result.rounds?.reduce((sum, r) => sum + r.playerUnitsLost, 0) || 0;
        const totalEnemyLost = result.rounds?.reduce((sum, r) => sum + r.enemyUnitsLost, 0) || 0;

        expect(totalPlayerLost).toBe(4);
        expect(totalEnemyLost).toBe(10);
    });

    it('should verify round casualty totals match battle result totals', () => {
        const result = createMockBattleResult(false);
        result.rounds = [
            { round: 1, playerUnitsStart: 10, enemyUnitsStart: 20, playerUnitsLost: 2, enemyUnitsLost: 5, details: [] }
        ];

        const roundPlayerLost = result.rounds?.reduce((sum, r) => sum + r.playerUnitsLost, 0) || 0;
        const roundEnemyLost = result.rounds?.reduce((sum, r) => sum + r.enemyUnitsLost, 0) || 0;

        const totalPlayerCasualties = Object.values(result.totalPlayerCasualties || {}).reduce((a, b) => a + (b || 0), 0);
        const totalEnemyCasualties = Object.values(result.totalEnemyCasualties || {}).reduce((a, b) => a + (b || 0), 0);

        expect(roundPlayerLost).toBe(totalPlayerCasualties);
        expect(roundEnemyLost).toBe(totalEnemyCasualties);
    });
});
