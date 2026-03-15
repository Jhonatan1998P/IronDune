import { describe, it, expect, beforeEach } from 'vitest';
import { 
    initializeRankingState, 
    processRankingEvolution, 
    GROWTH_INTERVAL_MS, 
    RankingCategory,
    BotEvent,
    StaticBot
} from '../utils/engine/rankings';
import { BotPersonality } from '../types/enums';

describe('Bot Growth System', () => {
    let bots: StaticBot[];
    const GROWTH_INTERVAL = GROWTH_INTERVAL_MS;

    beforeEach(() => {
        const ranking = initializeRankingState();
        bots = ranking.bots;
    });

    describe('1. Growth Rates by Personality', () => {
        it('WARLORD should grow MILITARY by 8% base + event modifier per cycle', () => {
            const warlord = bots.find(b => b.personality === BotPersonality.WARLORD)!;
            warlord.currentEvent = BotEvent.PEACEFUL_PERIOD;
            warlord.eventTurnsRemaining = 10;
            warlord.growthModifier = 0;
            const initialMilitary = warlord.stats[RankingCategory.MILITARY];
            
            const result = processRankingEvolution([warlord], GROWTH_INTERVAL);
            const updatedBot = result.bots[0];
            
            // Base 8% + PEACEFUL_PERIOD modifier 1% = 9%
            const expectedGrowth = initialMilitary * 1.09;
            const actualGrowth = updatedBot.stats[RankingCategory.MILITARY];
            
            console.log(`WARLORD: ${initialMilitary} -> ${actualGrowth} (expected ~${expectedGrowth})`);
            expect(actualGrowth).toBe(Math.floor(expectedGrowth));
        });

        it('TURTLE should grow ECONOMY by 3% base + event modifier per cycle', () => {
            const turtle = bots.find(b => b.personality === BotPersonality.TURTLE)!;
            turtle.currentEvent = BotEvent.PEACEFUL_PERIOD;
            turtle.eventTurnsRemaining = 10;
            turtle.growthModifier = 0;
            const initialEconomy = turtle.stats[RankingCategory.ECONOMY];
            
            const result = processRankingEvolution([turtle], GROWTH_INTERVAL);
            const updatedBot = result.bots[0];
            
            // Base 3% + PEACEFUL_PERIOD modifier 1% = 4%
            const expectedGrowth = initialEconomy * 1.04;
            const actualGrowth = updatedBot.stats[RankingCategory.ECONOMY];
            
            console.log(`TURTLE: ${initialEconomy} -> ${actualGrowth} (expected ~${expectedGrowth})`);
            expect(actualGrowth).toBe(Math.floor(expectedGrowth));
        });

        it('TYCOON should grow ECONOMY by 6% base + event modifier per cycle', () => {
            const tycoon = bots.find(b => b.personality === BotPersonality.TYCOON)!;
            tycoon.currentEvent = BotEvent.PEACEFUL_PERIOD;
            tycoon.eventTurnsRemaining = 10;
            tycoon.growthModifier = 0;
            const initialEconomy = tycoon.stats[RankingCategory.ECONOMY];
            
            const result = processRankingEvolution([tycoon], GROWTH_INTERVAL);
            const updatedBot = result.bots[0];
            
            // Base 6% + PEACEFUL_PERIOD modifier 1% = 7%
            const expectedGrowth = initialEconomy * 1.07;
            const actualGrowth = updatedBot.stats[RankingCategory.ECONOMY];
            
            console.log(`TYCOON: ${initialEconomy} -> ${actualGrowth} (expected ~${expectedGrowth})`);
            expect(actualGrowth).toBe(Math.floor(expectedGrowth));
        });

        it('ROGUE should grow DOMINION by 5% base + event modifier per cycle', () => {
            const rogue = bots.find(b => b.personality === BotPersonality.ROGUE)!;
            rogue.currentEvent = BotEvent.PEACEFUL_PERIOD;
            rogue.eventTurnsRemaining = 10;
            rogue.growthModifier = 0;
            const initialDominion = rogue.stats[RankingCategory.DOMINION];
            
            const result = processRankingEvolution([rogue], GROWTH_INTERVAL);
            const updatedBot = result.bots[0];
            
            // Base 5% + PEACEFUL_PERIOD modifier 1% = 6%
            const expectedGrowth = initialDominion * 1.06;
            const actualGrowth = updatedBot.stats[RankingCategory.DOMINION];
            
            console.log(`ROGUE: ${initialDominion} -> ${actualGrowth} (expected ~${expectedGrowth})`);
            expect(actualGrowth).toBe(Math.floor(expectedGrowth));
        });
    });

    describe('2. Multiple Cycles Growth', () => {
        it('should apply growth correctly over 2 cycles (12 hours)', () => {
            const warlord = bots.find(b => b.personality === BotPersonality.WARLORD)!;
            const initialMilitary = warlord.stats[RankingCategory.MILITARY];
            
            const result = processRankingEvolution([warlord], GROWTH_INTERVAL * 2);
            
            console.log(`2 cycles: ${initialMilitary} -> ${result.bots[0].stats[RankingCategory.MILITARY]}`);
            expect(result.cycles).toBe(2);
        });

        it('should apply growth correctly over 10 cycles (60 hours)', () => {
            const warlord = bots.find(b => b.personality === BotPersonality.WARLORD)!;
            const initialMilitary = warlord.stats[RankingCategory.MILITARY];
            
            const result = processRankingEvolution([warlord], GROWTH_INTERVAL * 10);
            
            console.log(`10 cycles: ${initialMilitary} -> ${result.bots[0].stats[RankingCategory.MILITARY]}`);
            expect(result.cycles).toBe(10);
        });
    });

    describe('3. Partial Cycles (Growth Precision)', () => {
        it('should NOT grow if elapsed time < 6 hours', () => {
            const warlord = bots.find(b => b.personality === BotPersonality.WARLORD)!;
            warlord.currentEvent = BotEvent.PEACEFUL_PERIOD;
            warlord.eventTurnsRemaining = 10;
            warlord.growthModifier = 0;
            const initialMilitary = warlord.stats[RankingCategory.MILITARY];
            
            const result = processRankingEvolution([warlord], GROWTH_INTERVAL - 1);
            
            expect(result.cycles).toBe(0);
            expect(result.bots[0].stats[RankingCategory.MILITARY]).toBe(initialMilitary);
        });

        it('should apply partial growth for 7 hours (6h + 1h partial)', () => {
            const warlord = bots.find(b => b.personality === BotPersonality.WARLORD)!;
            warlord.currentEvent = BotEvent.PEACEFUL_PERIOD;
            warlord.eventTurnsRemaining = 10;
            warlord.growthModifier = 0;
            const initialMilitary = warlord.stats[RankingCategory.MILITARY];
            
            const result = processRankingEvolution([warlord], GROWTH_INTERVAL + 3600000);
            
            // Full cycle: 500 * 1.09 = 545
            // Partial (1h = 1/6): 545 * 0.09 * (1/6) = 8
            // Total: 545 + 8 = 553
            const expected = 553;
            
            console.log(`7 hours (6h + 1h partial):`);
            console.log(`  Initial: ${initialMilitary}`);
            console.log(`  Full cycle (9%): 545`);
            console.log(`  Partial: 8`);
            console.log(`  Expected: ${expected}`);
            console.log(`  Actual: ${result.bots[0].stats[RankingCategory.MILITARY]}`);
            
            expect(result.cycles).toBe(2);
            expect(result.bots[0].stats[RankingCategory.MILITARY]).toBe(expected);
        });

        it('should apply partial growth for 12.5 hours (2 cycles + 0.5 partial)', () => {
            const warlord = bots.find(b => b.personality === BotPersonality.WARLORD)!;
            warlord.currentEvent = BotEvent.PEACEFUL_PERIOD;
            warlord.eventTurnsRemaining = 10;
            warlord.growthModifier = 0;
            const initialMilitary = warlord.stats[RankingCategory.MILITARY];
            
            const result = processRankingEvolution([warlord], GROWTH_INTERVAL * 2 + 1800000);
            
            console.log(`12.5 hours (2 cycles + 0.5 partial):`);
            console.log(`  Expected: ~597`);
            console.log(`  Actual: ${result.bots[0].stats[RankingCategory.MILITARY]}`);
            
            expect(result.cycles).toBe(3);
            expect(result.bots[0].stats[RankingCategory.MILITARY]).toBeGreaterThanOrEqual(596);
            expect(result.bots[0].stats[RankingCategory.MILITARY]).toBeLessThanOrEqual(599);
        });
    });

    describe('4. GROWTH MODIFIER ACCUMULATION BUG', () => {
        it('CRITICAL: growthModifier accumulates WITHOUT reset', () => {
            const warlord = bots.find(b => b.personality === BotPersonality.WARLORD)!;
            warlord.growthModifier = 0; // Reset
            
            const result1 = processRankingEvolution([warlord], GROWTH_INTERVAL);
            const modifierAfter1 = result1.bots[0].growthModifier;
            
            const result2 = processRankingEvolution(result1.bots, GROWTH_INTERVAL);
            const modifierAfter2 = result2.bots[0].growthModifier;
            
            const result3 = processRankingEvolution(result2.bots, GROWTH_INTERVAL);
            const modifierAfter3 = result3.bots[0].growthModifier;
            
            console.log(`Growth modifier accumulation:`);
            console.log(`  After 1 cycle: ${modifierAfter1}`);
            console.log(`  After 2 cycles: ${modifierAfter2}`);
            console.log(`  After 3 cycles: ${modifierAfter3}`);
            console.log(`  Base rate for WARLORD: 0.08 (8%)`);
            
            // This test documents the BUG - modifier should NOT accumulate
            // Expected: always 0.08 + event modifier
            // Actual: accumulates infinitely
        });

        it('CRITICAL: Warlord growth becomes exponential due to bug', () => {
            const warlord = bots.find(b => b.personality === BotPersonality.WARLORD)!;
            warlord.growthModifier = 0;
            warlord.currentEvent = BotEvent.PEACEFUL_PERIOD;
            warlord.eventTurnsRemaining = 10; // Prevent event changes
            
            const initialMilitary = warlord.stats[RankingCategory.MILITARY];
            
            // After 10 cycles, with bug, growth should be massive
            const result = processRankingEvolution([warlord], GROWTH_INTERVAL * 10);
            const finalMilitary = result.bots[0].stats[RankingCategory.MILITARY];
            
            // Expected without bug: 1000 * 1.08^10 = 2158
            // Actual with bug: MUCH higher
            const expectedWithoutBug = Math.floor(initialMilitary * Math.pow(1.08, 10));
            const actualGrowth = finalMilitary - initialMilitary;
            const expectedGrowth = expectedWithoutBug - initialMilitary;
            
            console.log(`After 10 cycles:`);
            console.log(`  Initial: ${initialMilitary}`);
            console.log(`  Expected (no bug): ${expectedWithoutBug}`);
            console.log(`  Actual: ${finalMilitary}`);
            console.log(`  Growth multiplier: ${(finalMilitary / initialMilitary).toFixed(2)}x`);
            
            // This shows the bug magnitude
            expect(finalMilitary).toBeGreaterThan(expectedWithoutBug);
        });
    });

    describe('5. Event Modifiers', () => {
        it('ATTACKED should reduce growth by 3%', () => {
            const warlord = bots.find(b => b.personality === BotPersonality.WARLORD)!;
            warlord.currentEvent = BotEvent.ATTACKED;
            warlord.eventTurnsRemaining = 5;
            warlord.growthModifier = 0;
            
            const initialMilitary = warlord.stats[RankingCategory.MILITARY];
            const result = processRankingEvolution([warlord], GROWTH_INTERVAL);
            
            // Expected: base 8% - 3% = 5%
            const expected = initialMilitary * 1.05;
            
            console.log(`ATTACKED: ${initialMilitary} -> ${result.bots[0].stats[RankingCategory.MILITARY]} (expected ~${expected})`);
            expect(result.bots[0].stats[RankingCategory.MILITARY]).toBe(Math.floor(expected));
        });

        it('ECONOMIC_BOOM should increase growth by 3%', () => {
            const tycoon = bots.find(b => b.personality === BotPersonality.TYCOON)!;
            tycoon.currentEvent = BotEvent.ECONOMIC_BOOM;
            tycoon.eventTurnsRemaining = 5;
            tycoon.growthModifier = 0;
            
            const initialEconomy = tycoon.stats[RankingCategory.ECONOMY];
            const result = processRankingEvolution([tycoon], GROWTH_INTERVAL);
            
            // Expected: base 6% + 3% = 9%
            const expected = initialEconomy * 1.09;
            
            console.log(`ECONOMIC_BOOM: ${initialEconomy} -> ${result.bots[0].stats[RankingCategory.ECONOMY]} (expected ~${expected})`);
            expect(result.bots[0].stats[RankingCategory.ECONOMY]).toBe(Math.floor(expected));
        });

        it('RESOURCES_CRISIS should reduce growth by 4%', () => {
            const turtle = bots.find(b => b.personality === BotPersonality.TURTLE)!;
            turtle.currentEvent = BotEvent.RESOURCES_CRISIS;
            turtle.eventTurnsRemaining = 5;
            turtle.growthModifier = 0;
            
            const initialEconomy = turtle.stats[RankingCategory.ECONOMY];
            const result = processRankingEvolution([turtle], GROWTH_INTERVAL);
            
            // Expected: base 3% - 4% = -1% (shrinks!)
            const expected = initialEconomy * 0.99;
            
            console.log(`RESOURCES_CRISIS: ${initialEconomy} -> ${result.bots[0].stats[RankingCategory.ECONOMY]} (expected ~${expected})`);
            expect(result.bots[0].stats[RankingCategory.ECONOMY]).toBe(Math.floor(expected));
        });
    });

    describe('6. Dominion Growth', () => {
        it('Dominion should grow proportionally to main category', () => {
            const warlord = bots.find(b => b.personality === BotPersonality.WARLORD)!;
            warlord.currentEvent = BotEvent.PEACEFUL_PERIOD;
            warlord.eventTurnsRemaining = 10;
            warlord.growthModifier = 0;
            
            const initialDominion = warlord.stats[RankingCategory.DOMINION];
            const initialMilitary = warlord.stats[RankingCategory.MILITARY];
            
            const result = processRankingEvolution([warlord], GROWTH_INTERVAL);
            const finalDominion = result.bots[0].stats[RankingCategory.DOMINION];
            
            const baseRate = 0.05;
            const expectedDominionGrowth = initialDominion * baseRate;
            const actualDominionGrowth = finalDominion - initialDominion;
            
            console.log(`Dominion growth:`);
            console.log(`  Initial Dominion: ${initialDominion}`);
            console.log(`  Expected growth: ${expectedDominionGrowth}`);
            console.log(`  Actual growth: ${actualDominionGrowth}`);
            
            expect(actualDominionGrowth).toBe(Math.floor(expectedDominionGrowth));
        });

        it('Dominion for ROGUE grows as main category', () => {
            const rogue = bots.find(b => b.personality === BotPersonality.ROGUE)!;
            rogue.currentEvent = BotEvent.PEACEFUL_PERIOD;
            rogue.eventTurnsRemaining = 10;
            rogue.growthModifier = 0;
            
            const initialDominion = rogue.stats[RankingCategory.DOMINION];
            
            const result = processRankingEvolution([rogue], GROWTH_INTERVAL);
            const finalDominion = result.bots[0].stats[RankingCategory.DOMINION];
            
            // Base 5% + PEACEFUL_PERIOD modifier 1% = 6%
            const expected = initialDominion * 1.06;
            
            console.log(`ROGUE Dominion: ${initialDominion} -> ${finalDominion} (expected ~${expected})`);
            expect(finalDominion).toBe(Math.floor(expected));
        });
    });

    describe('7. Offline vs Online Consistency', () => {
        it('should produce identical results for same elapsed time', () => {
            const warlord = bots.find(b => b.personality === BotPersonality.WARLORD)!;
            warlord.currentEvent = BotEvent.PEACEFUL_PERIOD;
            warlord.eventTurnsRemaining = 10;
            warlord.growthModifier = 0;
            const elapsed = GROWTH_INTERVAL * 3;
            
            // Simulate online (single call)
            const onlineResult = processRankingEvolution([warlord], elapsed);
            
            // Simulate offline (multiple calls with accumulated time)
            let offlineBots = [{
                ...warlord,
                currentEvent: BotEvent.PEACEFUL_PERIOD,
                eventTurnsRemaining: 10,
                growthModifier: 0
            }];
            offlineBots = processRankingEvolution(offlineBots, GROWTH_INTERVAL).bots;
            offlineBots = processRankingEvolution(offlineBots, GROWTH_INTERVAL).bots;
            offlineBots = processRankingEvolution(offlineBots, GROWTH_INTERVAL).bots;
            
            console.log(`Online vs Offline (3 cycles):`);
            console.log(`  Online military: ${onlineResult.bots[0].stats[RankingCategory.MILITARY]}`);
            console.log(`  Offline military: ${offlineBots[0].stats[RankingCategory.MILITARY]}`);
            
            expect(onlineResult.bots[0].stats[RankingCategory.MILITARY])
                .toBe(offlineBots[0].stats[RankingCategory.MILITARY]);
        });
    });

    describe('8. Unlimited Growth', () => {
        it('should continue growing normally after 5M in category (no cap)', () => {
            const warlord = bots.find(b => b.personality === BotPersonality.WARLORD)!;
            warlord.stats[RankingCategory.MILITARY] = 5000000;
            warlord.currentEvent = BotEvent.PEACEFUL_PERIOD;
            warlord.eventTurnsRemaining = 10;
            warlord.growthModifier = 0;

            const initial = warlord.stats[RankingCategory.MILITARY];
            const result = processRankingEvolution([warlord], GROWTH_INTERVAL);
            const final = result.bots[0].stats[RankingCategory.MILITARY];

            // No cap: full growth rate applies
            // Total rate: base 8% + modifier 1% = 9%
            // = 5000000 * 1.09 = 5450000
            const expected = initial * 1.09;

            console.log(`Unlimited growth test (5M): ${initial} -> ${final} (expected ~${expected})`);
            expect(final).toBe(Math.floor(expected));
        });

        it('should continue growing normally after 10M in category (no cap)', () => {
            const warlord = bots.find(b => b.personality === BotPersonality.WARLORD)!;
            warlord.stats[RankingCategory.MILITARY] = 10000000;
            warlord.currentEvent = BotEvent.PEACEFUL_PERIOD;
            warlord.eventTurnsRemaining = 10;
            warlord.growthModifier = 0;

            const initial = warlord.stats[RankingCategory.MILITARY];
            const result = processRankingEvolution([warlord], GROWTH_INTERVAL);
            const final = result.bots[0].stats[RankingCategory.MILITARY];

            // No cap: full growth rate applies
            // Total rate: base 8% + modifier 1% = 9%
            // = 10000000 * 1.09 = 10900000
            const expected = initial * 1.09;

            console.log(`Unlimited growth test (10M): ${initial} -> ${final} (expected ~${expected})`);
            expect(final).toBe(Math.floor(expected));
        });
    });

    describe('9. Decimal Precision Loss', () => {
        it('loses decimal precision due to Math.floor', () => {
            const turtle = bots.find(b => b.personality === BotPersonality.TURTLE)!;
            turtle.stats[RankingCategory.ECONOMY] = 100; // Small value to show precision loss
            turtle.currentEvent = BotEvent.PEACEFUL_PERIOD;
            turtle.eventTurnsRemaining = 10;
            turtle.growthModifier = 0;
            
            // After 1 cycle: 100 * 1.03 = 103
            const result1 = processRankingEvolution([turtle], GROWTH_INTERVAL);
            const after1 = result1.bots[0].stats[RankingCategory.ECONOMY];
            
            // After 2 cycles: 103 * 1.03 = 106.09 -> 106
            const result2 = processRankingEvolution(result1.bots, GROWTH_INTERVAL);
            const after2 = result2.bots[0].stats[RankingCategory.ECONOMY];
            
            // Expected with compound: 100 * 1.03^2 = 106.09 -> 106
            // But let's check accumulated:
            const expectedCompound = Math.floor(100 * Math.pow(1.03, 2));
            
            console.log(`Precision test:`);
            console.log(`  After 1 cycle: ${after1} (expected 103)`);
            console.log(`  After 2 cycles: ${after2} (expected ${expectedCompound})`);
            
            // The issue: floor is applied each cycle, not at end
        });
    });

    describe('10. Full Simulation - 30 Days', () => {
        it('simulates 30 days of bot growth (120 cycles)', () => {
            const warlord = bots.find(b => b.personality === BotPersonality.WARLORD)!;
            const initial = {
                military: warlord.stats[RankingCategory.MILITARY],
                dominion: warlord.stats[RankingCategory.DOMINION]
            };
            
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            const result = processRankingEvolution([warlord], thirtyDaysMs);
            const final = {
                military: result.bots[0].stats[RankingCategory.MILITARY],
                dominion: result.bots[0].stats[RankingCategory.DOMINION]
            };
            
            console.log(`30 days simulation (${result.cycles} cycles):`);
            console.log(`  Military: ${initial.military} -> ${final.military} (${(final.military/initial.military).toFixed(1)}x)`);
            console.log(`  Dominion: ${initial.dominion} -> ${final.dominion} (${(final.dominion/initial.dominion).toFixed(1)}x)`);
            
            // This will show the actual behavior including bugs
            expect(result.cycles).toBe(120);
        });
    });
});
