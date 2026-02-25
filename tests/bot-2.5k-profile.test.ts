import { describe, it, expect } from 'vitest';
import { 
    generateBotArmy, 
    generateBotBuildings, 
    generateSpyReport,
    calculateSpyCost 
} from '../utils/engine/missions';
import { BotPersonality, UnitType, BuildingType } from '../types/enums';

const SCORE = 2500;
const NOW = Date.now();

const mockBot = (personality: BotPersonality) => ({
    id: `test-bot-${personality}`,
    name: `Test ${personality}`,
    personality,
    stats: {
        DOMINION: SCORE,
        MILITARY: SCORE * 0.8,
        ECONOMY: SCORE * 0.6
    }
});

describe('Bot Military Profile - 2.5K Score', () => {
    describe('=== WARLORD (70% Attack / 30% Defense) ===', () => {
        const personality = BotPersonality.WARLORD;
        const army = generateBotArmy(SCORE, 1.0, personality);
        const buildings = generateBotBuildings(SCORE);
        const spyReport = generateSpyReport(mockBot(personality) as any, NOW);
        const spyCost = calculateSpyCost(SCORE);

        it('WARLORD: Total Army Units', () => {
            const totalUnits = Object.values(army).reduce((a, b) => a + (b || 0), 0);
            const totalCP = Object.entries(army).reduce((sum, [unit, count]) => {
                return sum + (count || 0);
            }, 0);
            
            console.log('\n========== WARLORD (2.5K) ==========');
            console.log('Budget Split: 70% Attack / 30% Defense');
            console.log('Total Budget: ' + (SCORE * 2250).toLocaleString());
            console.log('--- ARMY (' + totalUnits + ' units) ---');
            Object.entries(army).forEach(([unit, count]) => {
                console.log(`  ${unit}: ${count}`);
            });
            console.log('--- BUILDINGS (' + Object.values(buildings).reduce((a,b) => a+(b||0), 0) + ' total) ---');
            Object.entries(buildings).forEach(([b, count]) => {
                if (count) console.log(`  ${b}: ${count}`);
            });
            console.log('--- SPY REPORT ---');
            console.log(`  Cost: ${spyCost.toLocaleString()}`);
            console.log(`  Units: ${Object.values(spyReport.units).reduce((a,b)=>a+(b||0),0)}`);
            console.log(`  Personality in report: ${spyReport.botPersonality}`);
            console.log('========================================\n');
            
            expect(totalUnits).toBeGreaterThan(0);
        });
    });

    describe('=== TURTLE (30% Attack / 70% Defense) ===', () => {
        const personality = BotPersonality.TURTLE;
        const army = generateBotArmy(SCORE, 1.0, personality);
        const buildings = generateBotBuildings(SCORE);
        const spyReport = generateSpyReport(mockBot(personality) as any, NOW);
        const spyCost = calculateSpyCost(SCORE);

        it('TURTLE: Total Army Units', () => {
            const totalUnits = Object.values(army).reduce((a, b) => a + (b || 0), 0);
            
            console.log('\n========== TURTLE (2.5K) ==========');
            console.log('Budget Split: 30% Attack / 70% Defense');
            console.log('Total Budget: ' + (SCORE * 2250).toLocaleString());
            console.log('--- ARMY (' + totalUnits + ' units) ---');
            Object.entries(army).forEach(([unit, count]) => {
                console.log(`  ${unit}: ${count}`);
            });
            console.log('--- BUILDINGS (' + Object.values(buildings).reduce((a,b) => a+(b||0), 0) + ' total) ---');
            Object.entries(buildings).forEach(([b, count]) => {
                if (count) console.log(`  ${b}: ${count}`);
            });
            console.log('--- SPY REPORT ---');
            console.log(`  Cost: ${spyCost.toLocaleString()}`);
            console.log(`  Units: ${Object.values(spyReport.units).reduce((a,b)=>a+(b||0),0)}`);
            console.log(`  Personality in report: ${spyReport.botPersonality}`);
            console.log('========================================\n');
            
            expect(totalUnits).toBeGreaterThan(0);
        });
    });

    describe('=== TYCOON (50% Attack / 50% Defense) ===', () => {
        const personality = BotPersonality.TYCOON;
        const army = generateBotArmy(SCORE, 1.0, personality);
        const buildings = generateBotBuildings(SCORE);
        const spyReport = generateSpyReport(mockBot(personality) as any, NOW);
        const spyCost = calculateSpyCost(SCORE);

        it('TYCOON: Total Army Units', () => {
            const totalUnits = Object.values(army).reduce((a, b) => a + (b || 0), 0);
            
            console.log('\n========== TYCOON (2.5K) ==========');
            console.log('Budget Split: 50% Attack / 50% Defense');
            console.log('Total Budget: ' + (SCORE * 2250).toLocaleString());
            console.log('--- ARMY (' + totalUnits + ' units) ---');
            Object.entries(army).forEach(([unit, count]) => {
                console.log(`  ${unit}: ${count}`);
            });
            console.log('--- BUILDINGS (' + Object.values(buildings).reduce((a,b) => a+(b||0), 0) + ' total) ---');
            Object.entries(buildings).forEach(([b, count]) => {
                if (count) console.log(`  ${b}: ${count}`);
            });
            console.log('--- SPY REPORT ---');
            console.log(`  Cost: ${spyCost.toLocaleString()}`);
            console.log(`  Units: ${Object.values(spyReport.units).reduce((a,b)=>a+(b||0),0)}`);
            console.log(`  Personality in report: ${spyReport.botPersonality}`);
            console.log('========================================\n');
            
            expect(totalUnits).toBeGreaterThan(0);
        });
    });

    describe('=== ROGUE (60% Attack / 40% Defense) ===', () => {
        const personality = BotPersonality.ROGUE;
        const army = generateBotArmy(SCORE, 1.0, personality);
        const buildings = generateBotBuildings(SCORE);
        const spyReport = generateSpyReport(mockBot(personality) as any, NOW);
        const spyCost = calculateSpyCost(SCORE);

        it('ROGUE: Total Army Units', () => {
            const totalUnits = Object.values(army).reduce((a, b) => a + (b || 0), 0);
            
            console.log('\n========== ROGUE (2.5K) ==========');
            console.log('Budget Split: 60% Attack / 40% Defense');
            console.log('Total Budget: ' + (SCORE * 2250).toLocaleString());
            console.log('--- ARMY (' + totalUnits + ' units) ---');
            Object.entries(army).forEach(([unit, count]) => {
                console.log(`  ${unit}: ${count}`);
            });
            console.log('--- BUILDINGS (' + Object.values(buildings).reduce((a,b) => a+(b||0), 0) + ' total) ---');
            Object.entries(buildings).forEach(([b, count]) => {
                if (count) console.log(`  ${b}: ${count}`);
            });
            console.log('--- SPY REPORT ---');
            console.log(`  Cost: ${spyCost.toLocaleString()}`);
            console.log(`  Units: ${Object.values(spyReport.units).reduce((a,b)=>a+(b||0),0)}`);
            console.log(`  Personality in report: ${spyReport.botPersonality}`);
            console.log('========================================\n');
            
            expect(totalUnits).toBeGreaterThan(0);
        });
    });

    describe('=== COMPARISON SUMMARY ===', () => {
        it('Compare all personalities', () => {
            const personalities = [
                BotPersonality.WARLORD,
                BotPersonality.TURTLE,
                BotPersonality.TYCOON,
                BotPersonality.ROGUE
            ];

            console.log('\n');
            console.log('╔════════════════════════════════════════════════════════════════════════╗');
            console.log('║          BOT MILITARY PROFILE - 2.5K POINTS SUMMARY                    ║');
            console.log('╠═══════════════════╦══════════╦══════════╦══════════╦══════════════════╣');
            console.log('║ Personality       ║ Units    ║ Buildings ║ Spy Cost ║ Unit Types      ║');
            console.log('╠═══════════════════╬══════════╬══════════╬══════════╬══════════════════╣');

            personalities.forEach(p => {
                const army = generateBotArmy(SCORE, 1.0, p);
                const buildings = generateBotBuildings(SCORE);
                const spyCost = calculateSpyCost(SCORE);
                const unitCount = Object.values(army).reduce((a,b) => a+(b||0), 0);
                const buildingCount = Object.values(buildings).reduce((a,b) => a+(b||0), 0);
                const unitTypes = Object.keys(army).length;

                const pName = p.padEnd(15);
                const uCount = unitCount.toString().padStart(9);
                const bCount = buildingCount.toString().padStart(10);
                const sCost = spyCost.toLocaleString().padStart(9);
                const uTypes = unitTypes.toString().padStart(14);

                console.log(`║ ${pName} ║ ${uCount} ║ ${bCount} ║ ${sCost} ║ ${uTypes} ║`);
            });

            console.log('╚═══════════════════╩══════════╩══════════╩══════════╩══════════════════╝');
            console.log('\nBUDGET RATIOS BY PERSONALITY:');
            console.log('  WARLORD: 70% Attack / 30% Defense (High tier offensive: TITAN_MBT, WRAITH_GUNSHIP, ACE_FIGHTER)');
            console.log('  TURTLE:  30% Attack / 70% Defense (Defensive: AEGIS_DESTROYER, PHANTOM_SUB, TITAN_MBT)');
            console.log('  TYCOON:  50% Attack / 50% Defense (Balanced: HEAVY_COMMANDO, SCOUT_TANK, ACE_FIGHTER)');
            console.log('  ROGUE:   60% Attack / 40% Defense (Versatile: HEAVY_COMMANDO, ACE_FIGHTER, PHANTOM_SUB)');
            console.log('\nSPY REPORT: Uses 70% of defense budget (all personalities use defense composition)');
            console.log('\n');

            expect(true).toBe(true);
        });
    });
});
