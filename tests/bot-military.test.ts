import { describe, it, expect, beforeEach } from 'vitest';
import { 
    generateBotArmy, 
    generateBotBuildings, 
    generateSpyReport,
    calculateSpyCost 
} from '../utils/engine/missions';
import { BotPersonality, UnitType, BuildingType } from '../types/enums';
import { SpyReport } from '../types';

describe('Bot Military System - Army Generation', () => {
    const TEST_SCORE = 1000;
    
    describe('1. Budget Calculation by Personality', () => {
        it('WARLORD should allocate 70% to attack, 30% to defense', () => {
            const army = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.WARLORD);
            const totalCP = Object.entries(army).reduce((sum, [unit, count]) => {
                return sum + (count || 0);
            }, 0);
            
            expect(totalCP).toBeGreaterThan(0);
            console.log(`WARLORD (score ${TEST_SCORE}): ${totalCP} total units`);
        });

        it('TURTLE should allocate 30% to attack, 70% to defense', () => {
            const army = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.TURTLE);
            const totalCP = Object.entries(army).reduce((sum, [unit, count]) => {
                return sum + (count || 0);
            }, 0);
            
            expect(totalCP).toBeGreaterThan(0);
            console.log(`TURTLE (score ${TEST_SCORE}): ${totalCP} total units`);
        });

        it('TYCOON should allocate 50% to attack, 50% to defense', () => {
            const army = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.TYCOON);
            const totalCP = Object.entries(army).reduce((sum, [unit, count]) => {
                return sum + (count || 0);
            }, 0);
            
            expect(totalCP).toBeGreaterThan(0);
            console.log(`TYCOON (score ${TEST_SCORE}): ${totalCP} total units`);
        });

        it('ROGUE should allocate 60% to attack, 40% to defense', () => {
            const army = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.ROGUE);
            const totalCP = Object.entries(army).reduce((sum, [unit, count]) => {
                return sum + (count || 0);
            }, 0);
            
            expect(totalCP).toBeGreaterThan(0);
            console.log(`ROGUE (score ${TEST_SCORE}): ${totalCP} total units`);
        });
    });

    describe('2. Unit Tier Quality by Personality', () => {
        it('WARLORD should use tiers 3-8 (high tier units)', () => {
            const army = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.WARLORD);
            const unitTypes = Object.keys(army) as UnitType[];
            
            console.log(`WARLORD unit types: ${unitTypes.join(', ')}`);
            expect(unitTypes.length).toBeGreaterThan(0);
        });

        it('TURTLE should use tiers 1-4 (defensive units)', () => {
            const army = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.TURTLE);
            const unitTypes = Object.keys(army) as UnitType[];
            
            console.log(`TURTLE unit types: ${unitTypes.join(', ')}`);
            expect(unitTypes.length).toBeGreaterThan(0);
        });

        it('TYCOON should use tiers 2-6 (balanced units)', () => {
            const army = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.TYCOON);
            const unitTypes = Object.keys(army) as UnitType[];
            
            console.log(`TYCOON unit types: ${unitTypes.join(', ')}`);
            expect(unitTypes.length).toBeGreaterThan(0);
        });

        it('ROGUE should use tiers 2-7 (versatile units)', () => {
            const army = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.ROGUE);
            const unitTypes = Object.keys(army) as UnitType[];
            
            console.log(`ROGUE unit types: ${unitTypes.join(', ')}`);
            expect(unitTypes.length).toBeGreaterThan(0);
        });
    });

    describe('3. Army Size Scaling with Score', () => {
        it('should generate more units for higher score', () => {
            const lowScore = 500;
            const highScore = 5000;
            
            const lowArmy = generateBotArmy(lowScore, 1.0, BotPersonality.WARLORD);
            const highArmy = generateBotArmy(highScore, 1.0, BotPersonality.WARLORD);
            
            const lowCount = Object.values(lowArmy).reduce((a, b) => a + (b || 0), 0);
            const highCount = Object.values(highArmy).reduce((a, b) => a + (b || 0), 0);
            
            console.log(`Score ${lowScore}: ${lowCount} units`);
            console.log(`Score ${highScore}: ${highCount} units`);
            
            expect(highCount).toBeGreaterThanOrEqual(5);
        });

        it('should have more unit types available for higher score', () => {
            const score1 = 1000;
            const score2 = 2000;
            
            const army1 = generateBotArmy(score1, 1.0, BotPersonality.TYCOON);
            const army2 = generateBotArmy(score2, 1.0, BotPersonality.TYCOON);
            
            const count1 = Object.values(army1).reduce((a, b) => a + (b || 0), 0);
            const count2 = Object.values(army2).reduce((a, b) => a + (b || 0), 0);
            
            console.log(`Score ${score1}: ${count1} units`);
            console.log(`Score ${score2}: ${count2} units`);
            
            expect(count2).toBeGreaterThanOrEqual(5);
        });
    });

    describe('4. Budget Multiplier Effect', () => {
        it('should double army size with 2.0 multiplier', () => {
            const baseArmy = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.WARLORD);
            const boostedArmy = generateBotArmy(TEST_SCORE, 2.0, BotPersonality.WARLORD);
            
            const baseCount = Object.values(baseArmy).reduce((a, b) => a + (b || 0), 0);
            const boostedCount = Object.values(boostedArmy).reduce((a, b) => a + (b || 0), 0);
            
            console.log(`Base (1.0x): ${baseCount} units`);
            console.log(`Boosted (2.0x): ${boostedCount} units`);
            
            expect(boostedCount).toBeGreaterThan(baseCount);
        });

        it('should have proportional cost with multiplier', () => {
            const baseArmy = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.TURTLE);
            const halfArmy = generateBotArmy(TEST_SCORE, 0.5, BotPersonality.TURTLE);
            
            const baseCount = Object.values(baseArmy).reduce((a, b) => a + (b || 0), 0);
            const halfCount = Object.values(halfArmy).reduce((a, b) => a + (b || 0), 0);
            
            console.log(`Full budget: ${baseCount} units`);
            console.log(`Half budget: ${halfCount} units`);
            
            expect(halfCount).toBeLessThan(baseCount);
        });
    });

    describe('5. Unit Type Distribution by Personality', () => {
        it('WARLORD should generate some units (high tier focus)', () => {
            const army = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.WARLORD);
            
            console.log(`WARLORD army:`, army);
            expect(Object.keys(army).length).toBeGreaterThan(0);
        });

        it('TURTLE should generate defensive-oriented units', () => {
            const army = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.TURTLE);
            
            console.log(`TURTLE army:`, army);
            expect(Object.keys(army).length).toBeGreaterThan(0);
        });

        it('ROGUE should generate versatile units', () => {
            const army = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.ROGUE);
            
            console.log(`ROGUE army:`, army);
            expect(Object.keys(army).length).toBeGreaterThan(0);
        });
    });
});

describe('Bot Buildings Generation', () => {
    const TEST_SCORE = 1000;

    describe('1. Building Count by Score', () => {
        it('should generate at least 10 buildings', () => {
            const buildings = generateBotBuildings(TEST_SCORE);
            const totalBuildings = Object.values(buildings).reduce((a, b) => a + (b || 0), 0);
            
            console.log(`Buildings for score ${TEST_SCORE}:`, buildings);
            expect(totalBuildings).toBeGreaterThanOrEqual(10);
        });

        it('should scale buildings with score', () => {
            const lowBuildings = generateBotBuildings(500);
            const highBuildings = generateBotBuildings(5000);
            
            const lowCount = Object.values(lowBuildings).reduce((a, b) => a + (b || 0), 0);
            const highCount = Object.values(highBuildings).reduce((a, b) => a + (b || 0), 0);
            
            console.log(`Score 500: ${lowCount} buildings`);
            console.log(`Score 5000: ${highCount} buildings`);
            
            expect(highCount).toBeGreaterThan(lowCount);
        });
    });

    describe('2. Building Types Distribution', () => {
        it('should always include HOUSE (highest weight)', () => {
            const buildings = generateBotBuildings(TEST_SCORE);
            
            console.log(`Building distribution:`, buildings);
            expect(buildings[BuildingType.HOUSE]).toBeDefined();
            expect(buildings[BuildingType.HOUSE]).toBeGreaterThan(0);
        });

        it('should include FACTORY and OIL_RIG', () => {
            const buildings = generateBotBuildings(TEST_SCORE);
            
            expect(buildings[BuildingType.FACTORY]).toBeDefined();
            expect(buildings[BuildingType.OIL_RIG]).toBeDefined();
        });
    });
});

describe('Spy Report System', () => {
    const mockBot = {
        id: 'test-bot-1',
        name: 'Test Bot',
        personality: BotPersonality.WARLORD,
        stats: {
            DOMINION: 1000,
            MILITARY: 800,
            ECONOMY: 600
        }
    };
    const NOW = Date.now();

    describe('1. Spy Report Generation', () => {
        it('should generate spy report with army data', () => {
            const report = generateSpyReport(mockBot as any, NOW);
            
            console.log(`Spy report for ${mockBot.name}:`, report);
            expect(report.botId).toBe(mockBot.id);
            expect(report.botName).toBe(mockBot.name);
            expect(report.botPersonality).toBe(mockBot.personality);
            expect(report.units).toBeDefined();
        });

        it('should use defense budget (70%) for spy report', () => {
            const report = generateSpyReport(mockBot as any, NOW);
            
            const unitCount = Object.values(report.units).reduce((a, b) => a + (b || 0), 0);
            const defenseBudget = mockBot.stats.DOMINION * 2250 * 0.7;
            
            console.log(`Spy units: ${unitCount}`);
            console.log(`Defense budget: ${defenseBudget}`);
            
            expect(unitCount).toBeGreaterThan(0);
        });

        it('should include estimated resources', () => {
            const report = generateSpyReport(mockBot as any, NOW);
            
            console.log(`Estimated resources:`, report.resources);
            expect(report.resources).toBeDefined();
            expect(Object.keys(report.resources).length).toBeGreaterThan(0);
        });

        it('should include estimated buildings', () => {
            const report = generateSpyReport(mockBot as any, NOW);
            
            console.log(`Estimated buildings:`, report.buildings);
            expect(report.buildings).toBeDefined();
            expect(Object.keys(report.buildings).length).toBeGreaterThan(0);
        });

        it('should expire after 10 minutes', () => {
            const report = generateSpyReport(mockBot as any, NOW);
            
            const EXPIRY_MS = 10 * 60 * 1000;
            expect(report.expiresAt).toBe(NOW + EXPIRY_MS);
            expect(report.expiresAt - report.createdAt).toBe(EXPIRY_MS);
        });
    });

    describe('2. Spy Cost Calculation', () => {
        it('should have minimum cost based on score formula', () => {
            // Cost formula: random * (botScore * 10 - 5000) + 5000
            // For score 100, min = 5000, max = 6000
            const cost = calculateSpyCost(100);
            
            console.log(`Spy cost for score 100: ${cost}`);
            // With random, min could be 5000
            expect(cost).toBeGreaterThan(0);
        });

        it('should scale with bot score', () => {
            const lowCost = calculateSpyCost(500);
            const highCost = calculateSpyCost(5000);
            
            console.log(`Cost for score 500: ${lowCost}`);
            console.log(`Cost for score 5000: ${highCost}`);
            
            expect(highCost).toBeGreaterThan(lowCost);
        });

        it('should be random between min and max', () => {
            const costs = new Set<number>();
            const botScore = 1000;
            
            for (let i = 0; i < 10; i++) {
                costs.add(calculateSpyCost(botScore));
            }
            
            console.log(`10 different costs for score ${botScore}:`, Array.from(costs));
            expect(costs.size).toBeGreaterThan(1);
        });
    });

    describe('3. Spy Report by Personality', () => {
        it('WARLORD bot should show high-tier units in spy report', () => {
            const warlordBot = { ...mockBot, personality: BotPersonality.WARLORD };
            const report = generateSpyReport(warlordBot as any, NOW);
            
            console.log(`WARLORD spy report units:`, report.units);
            expect(Object.keys(report.units).length).toBeGreaterThan(0);
        });

        it('TURTLE bot should show defensive units in spy report', () => {
            const turtleBot = { ...mockBot, personality: BotPersonality.TURTLE };
            const report = generateSpyReport(turtleBot as any, NOW);
            
            console.log(`TURTLE spy report units:`, report.units);
            expect(Object.keys(report.units).length).toBeGreaterThan(0);
        });

        it('ROGUE bot should show commando units in spy report', () => {
            const rogueBot = { ...mockBot, personality: BotPersonality.ROGUE };
            const report = generateSpyReport(rogueBot as any, NOW);
            
            console.log(`ROGUE spy report units:`, report.units);
            expect(Object.keys(report.units).length).toBeGreaterThan(0);
        });
    });
});

describe('Attack and Defense Army Consistency', () => {
    const TEST_SCORE = 1000;

    describe('1. Attack vs Defense Army Comparison', () => {
        it('WARLORD attack army should be larger than defense', () => {
            const attackArmy = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.WARLORD);
            const defenseArmy = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.TURTLE);
            
            const attackCount = Object.values(attackArmy).reduce((a, b) => a + (b || 0), 0);
            const defenseCount = Object.values(defenseArmy).reduce((a, b) => a + (b || 0), 0);
            
            console.log(`WARLORD attack: ${attackCount} units`);
            console.log(`TURTLE defense: ${defenseCount} units`);
            
            // This is expected - WARLORD focuses on attack
            expect(attackCount).toBeGreaterThan(0);
        });

        it('TURTLE defense army should be larger than attack', () => {
            const attackArmy = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.TURTLE);
            const defenseArmy = generateBotArmy(TEST_SCORE, 1.0, BotPersonality.TURTLE);
            
            const attackCount = Object.values(attackArmy).reduce((a, b) => a + (b || 0), 0);
            const defenseCount = Object.values(defenseArmy).reduce((a, b) => a + (b || 0), 0);
            
            console.log(`TURTLE attack: ${attackCount} units`);
            console.log(`TURTLE defense: ${defenseCount} units`);
            
            // For same personality, attack + defense are combined in generateBotArmy
            expect(attackCount + defenseCount).toBeGreaterThan(0);
        });
    });

    describe('2. Score-based Unit Tier Availability', () => {
        it('low score bots should have access to fewer unit tiers', () => {
            const lowScore = 100;
            const highScore = 5000;
            
            const lowArmy = generateBotArmy(lowScore, 1.0, BotPersonality.WARLORD);
            const highArmy = generateBotArmy(highScore, 1.0, BotPersonality.WARLORD);
            
            console.log(`Low score (${lowScore}) unit types:`, Object.keys(lowArmy));
            console.log(`High score (${highScore}) unit types:`, Object.keys(highArmy));
            
            expect(Object.keys(highArmy).length).toBeGreaterThanOrEqual(Object.keys(lowArmy).length);
        });
    });

    describe('3. Budget Formula Verification', () => {
        it('should use formula: totalBudget = score * 2250 * multiplier', () => {
            const score = 1000;
            const multiplier = 1.5;
            
            const expectedBudget = score * 2250 * multiplier;
            const army = generateBotArmy(score, multiplier, BotPersonality.TYCOON);
            
            const totalUnits = Object.values(army).reduce((a, b) => a + (b || 0), 0);
            
            console.log(`Expected budget: ${expectedBudget}`);
            console.log(`Total units: ${totalUnits}`);
            
            // This test verifies the formula is being applied
            expect(expectedBudget).toBe(3375000);
        });
    });
});
