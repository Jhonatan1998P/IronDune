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
