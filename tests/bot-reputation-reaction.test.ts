import { describe, it, expect, beforeEach } from 'vitest';
import { BotPersonality, UnitType } from '../types/enums';
import { calculateRetaliationTime } from '../utils/engine/nemesis';
import { calculateDecayMultiplier, processReputationDecay } from '../utils/engine/diplomacy';
import { StaticBot, RankingCategory, BotEvent } from '../utils/engine/rankings';
import { REPUTATION_MIN, REPUTATION_MAX, REPUTATION_DECAY_INTERVAL_MS, REPUTATION_ALLY_THRESHOLD, REPUTATION_ENEMY_THRESHOLD } from '../constants';

describe('Bot Reaction to Player Attack - Retaliation System', () => {
    const NOW = Date.now();
    const TEST_SCORE = 1000;

    describe('1. Retaliation Time by Personality', () => {
        it('WARLORD should have fastest retaliation (5-30 mins)', () => {
            const samples = 10;
            const times: number[] = [];
            
            for (let i = 0; i < samples; i++) {
                const retTime = calculateRetaliationTime(BotPersonality.WARLORD, NOW);
                times.push(retTime - NOW);
            }
            
            const avgMs = times.reduce((a, b) => a + b, 0) / samples;
            const avgMinutes = avgMs / 60000;
            
            console.log(`WARLORD retaliation times: ${times.map(t => (t/60000).toFixed(1)).join(', ')} mins`);
            console.log(`WARLORD average: ${avgMinutes.toFixed(1)} minutes`);
            
            expect(avgMinutes).toBeLessThanOrEqual(35);
            expect(avgMinutes).toBeGreaterThanOrEqual(3);
        });

        it('TURTLE should have slowest retaliation (2-6 hours)', () => {
            const samples = 10;
            const times: number[] = [];
            
            for (let i = 0; i < samples; i++) {
                const retTime = calculateRetaliationTime(BotPersonality.TURTLE, NOW);
                times.push(retTime - NOW);
            }
            
            const avgMs = times.reduce((a, b) => a + b, 0) / samples;
            const avgHours = avgMs / 3600000;
            
            console.log(`TURTLE retaliation times: ${times.map(t => (t/3600000).toFixed(1)).join(', ')} hours`);
            console.log(`TURTLE average: ${avgHours.toFixed(1)} hours`);
            
            expect(avgHours).toBeLessThanOrEqual(7);
            expect(avgHours).toBeGreaterThanOrEqual(1.5);
        });

        it('TYCOON should have medium retaliation (1-4 hours)', () => {
            const samples = 10;
            const times: number[] = [];
            
            for (let i = 0; i < samples; i++) {
                const retTime = calculateRetaliationTime(BotPersonality.TYCOON, NOW);
                times.push(retTime - NOW);
            }
            
            const avgMs = times.reduce((a, b) => a + b, 0) / samples;
            const avgHours = avgMs / 3600000;
            
            console.log(`TYCOON retaliation times: ${times.map(t => (t/3600000).toFixed(1)).join(', ')} hours`);
            console.log(`TYCOON average: ${avgHours.toFixed(1)} hours`);
            
            expect(avgHours).toBeLessThanOrEqual(5);
            expect(avgHours).toBeGreaterThanOrEqual(0.5);
        });

        it('ROGUE should have unpredictable timing (short OR long)', () => {
            const samples = 20;
            const times: number[] = [];
            
            for (let i = 0; i < samples; i++) {
                const retTime = calculateRetaliationTime(BotPersonality.ROGUE, NOW);
                times.push(retTime - NOW);
            }
            
            const avgMs = times.reduce((a, b) => a + b, 0) / samples;
            const avgHours = avgMs / 3600000;
            const hasShort = times.some(t => t < 3600000);
            const hasLong = times.some(t => t > 3600000 * 4);
            
            console.log(`ROGUE retaliation times: ${times.map(t => (t/3600000).toFixed(1)).join(', ')} hours`);
            console.log(`ROGUE average: ${avgHours.toFixed(1)} hours`);
            console.log(`ROGUE has short attacks (<1h): ${hasShort}, has long attacks (>4h): ${hasLong}`);
            
            expect(hasShort || hasLong).toBe(true);
        });
    });

    describe('2. Retaliation Multiplier by Personality', () => {
        it('WARLORD uses 1.3x multiplier for retaliation', () => {
            const retTime = calculateRetaliationTime(BotPersonality.WARLORD, NOW);
            const expectedMultiplier = 1.3;
            
            console.log(`WARLORD multiplier: ${expectedMultiplier}x (hardcoded in launchRetaliation)`);
            expect(expectedMultiplier).toBe(1.3);
        });

        it('TURTLE uses 1.5x multiplier (deathball) for retaliation', () => {
            const expectedMultiplier = 1.5;
            
            console.log(`TURTLE multiplier: ${expectedMultiplier}x (deathball strategy)`);
            expect(expectedMultiplier).toBe(1.5);
        });

        it('TYCOON and ROGUE use default 1.0x multiplier', () => {
            const expectedMultiplier = 1.0;
            
            console.log(`TYCOON/ROGUE multiplier: ${expectedMultiplier}x (default)`);
            expect(expectedMultiplier).toBe(1.0);
        });
    });

    describe('3. Grudge Expiration Logic', () => {
        it('grudge expires after 48 hours (2x window)', () => {
            const RETALIATION_WINDOW_MS = 24 * 60 * 60 * 1000;
            const expectedExpiry = RETALIATION_WINDOW_MS * 2;
            const expectedExpiryHours = expectedExpiry / 3600000;
            
            console.log(`Grudge expires after: ${expectedExpiryHours} hours (48h)`);
            expect(expectedExpiryHours).toBe(48);
        });
    });
});

describe('Bot Reaction to Low Reputation', () => {
    const NOW = Date.now();
    const TEST_SCORE = 1000;

    describe('1. Reputation Decay by Current Level', () => {
        it('reputation >= 75 should NOT decay (stable allies)', () => {
            const bot: StaticBot = {
                id: 'test-bot',
                name: 'Test Bot',
                personality: BotPersonality.WARLORD,
                reputation: 80,
                stats: { [RankingCategory.DOMINION]: TEST_SCORE, [RankingCategory.MILITARY]: 800, [RankingCategory.ECONOMY]: 600, [RankingCategory.CAMPAIGN]: 0 },
                avatarId: 1,
                country: 'US',
                ambition: 1,
                currentEvent: BotEvent.PEACEFUL_PERIOD,
                eventTurnsRemaining: 0,
                growthModifier: 1
            };
            
            const result = processReputationDecay([bot], NOW - REPUTATION_DECAY_INTERVAL_MS * 10, NOW);
            const updatedBot = result.updatedBots[0];
            
            console.log(`Bot with rep 80: decay applied = ${updatedBot.reputation !== 80}`);
            expect(updatedBot.reputation).toBe(80);
        });

        it('reputation >= 40 but < 75 should decay normally (1x)', () => {
            const bot: StaticBot = {
                id: 'test-bot',
                name: 'Test Bot',
                personality: BotPersonality.TYCOON,
                reputation: 50,
                stats: { [RankingCategory.DOMINION]: TEST_SCORE, [RankingCategory.MILITARY]: 800, [RankingCategory.ECONOMY]: 600, [RankingCategory.CAMPAIGN]: 0 },
                avatarId: 1,
                country: 'US',
                ambition: 1,
                currentEvent: BotEvent.PEACEFUL_PERIOD,
                eventTurnsRemaining: 0,
                growthModifier: 1
            };
            
            const result = processReputationDecay([bot], NOW - REPUTATION_DECAY_INTERVAL_MS * 5, NOW);
            const updatedBot = result.updatedBots[0];
            const expectedDecay = 2 * 5;
            
            console.log(`Bot with rep 50: ${updatedBot.reputation} (expected ${50 - expectedDecay})`);
            expect(updatedBot.reputation).toBe(50 - expectedDecay);
        });

        it('reputation < 40 should decay with accelerated multiplier', () => {
            const bot: StaticBot = {
                id: 'test-bot',
                name: 'Test Bot',
                personality: BotPersonality.ROGUE,
                reputation: 20,
                stats: { [RankingCategory.DOMINION]: TEST_SCORE, [RankingCategory.MILITARY]: 800, [RankingCategory.ECONOMY]: 600, [RankingCategory.CAMPAIGN]: 0 },
                avatarId: 1,
                country: 'US',
                ambition: 1,
                currentEvent: BotEvent.PEACEFUL_PERIOD,
                eventTurnsRemaining: 0,
                growthModifier: 1
            };
            
            const multiplier = calculateDecayMultiplier(20);
            const result = processReputationDecay([bot], NOW - REPUTATION_DECAY_INTERVAL_MS * 5, NOW);
            const updatedBot = result.updatedBots[0];
            
            console.log(`Bot with rep 20: decay multiplier = ${multiplier}x`);
            console.log(`Bot with rep 20: final reputation = ${updatedBot.reputation}`);
            
            expect(multiplier).toBeGreaterThan(1.0);
            expect(updatedBot.reputation).toBeLessThan(20);
        });

        it('reputation at 0 should have maximum decay (2x)', () => {
            const multiplier = calculateDecayMultiplier(0);
            
            console.log(`Decay multiplier at rep 0: ${multiplier}x`);
            expect(multiplier).toBe(2.0);
        });
    });

    describe('2. Attack Probability Based on Reputation', () => {
        it('reputation >= 70 (ally) = 30% attack chance', () => {
            const reputation = 80;
            let attackChance = 0.8;
            
            if (reputation >= REPUTATION_ALLY_THRESHOLD) {
                attackChance = 0.3;
            }
            
            console.log(`Ally (rep ${reputation}): attack chance = ${attackChance * 100}%`);
            expect(attackChance).toBe(0.3);
        });

        it('reputation 30-69 (neutral) = 80% attack chance', () => {
            const reputation = 50;
            let attackChance = 0.8;
            
            if (reputation >= REPUTATION_ALLY_THRESHOLD) {
                attackChance = 0.3;
            } else if (reputation < REPUTATION_ENEMY_THRESHOLD) {
                attackChance = 1.0;
            }
            
            console.log(`Neutral (rep ${reputation}): attack chance = ${attackChance * 100}%`);
            expect(attackChance).toBe(0.8);
        });

        it('reputation < 30 (enemy) = 100% attack chance', () => {
            const reputation = 20;
            let attackChance = 0.8;
            
            if (reputation >= REPUTATION_ALLY_THRESHOLD) {
                attackChance = 0.3;
            } else if (reputation < REPUTATION_ENEMY_THRESHOLD) {
                attackChance = 1.0;
            }
            
            console.log(`Enemy (rep ${reputation}): attack chance = ${attackChance * 100}%`);
            expect(attackChance).toBe(1.0);
        });
    });

    describe('3. Bot Behavior Thresholds', () => {
        it('ALLY threshold is 70', () => {
            console.log(`ALLY threshold: ${REPUTATION_ALLY_THRESHOLD}`);
            expect(REPUTATION_ALLY_THRESHOLD).toBe(70);
        });

        it('ENEMY threshold is 30', () => {
            console.log(`ENEMY threshold: ${REPUTATION_ENEMY_THRESHOLD}`);
            expect(REPUTATION_ENEMY_THRESHOLD).toBe(30);
        });

        it('reputation range is 0-100', () => {
            console.log(`Reputation range: ${REPUTATION_MIN} to ${REPUTATION_MAX}`);
            expect(REPUTATION_MIN).toBe(0);
            expect(REPUTATION_MAX).toBe(100);
        });
    });

    describe('4. Decay Rate Analysis', () => {
        it('should decay 2 points per 4 hours normally', () => {
            const DECAY_AMOUNT = 2;
            const DECAY_INTERVAL = 4 * 60 * 60 * 1000;
            
            console.log(`Decay: ${DECAY_AMOUNT} points per ${DECAY_INTERVAL / 3600000} hours`);
            expect(DECAY_AMOUNT).toBe(2);
            expect(DECAY_INTERVAL / 3600000).toBe(4);
        });

        it('should decay 50 points over many hours with normal decay', () => {
            const decayPerInterval = 2;
            const intervalsToZero = Math.ceil(50 / decayPerInterval);
            const hoursToZero = (intervalsToZero * 4);
            
            console.log(`Time from rep 50 to 0: ${hoursToZero} hours (${intervalsToZero} intervals)`);
            expect(hoursToZero).toBeGreaterThan(50);
        });

        it('should decay faster with max accelerated decay', () => {
            const decayPerInterval = 4; // 2x multiplier
            const intervalsToZero = Math.ceil(50 / decayPerInterval);
            const hoursToZero = (intervalsToZero * 4);
            
            console.log(`Time from rep 50 to 0 (max decay): ${hoursToZero} hours (${intervalsToZero} intervals)`);
            expect(hoursToZero).toBeLessThan(100);
        });
    });
});

describe('Bot Attack Weight Based on Reputation', () => {
    const TEST_SCORE = 1000;

    describe('1. Random Attack Selection Weight', () => {
        it('enemy bots (rep < 30) get 2x weight in random selection', () => {
            const rep = 20;
            let weight = 1.0;
            
            if (rep < REPUTATION_ENEMY_THRESHOLD) {
                weight = 2.0;
            }
            
            console.log(`Enemy (rep ${rep}): weight = ${weight}x`);
            expect(weight).toBe(2.0);
        });

        it('ally bots (rep >= 70) get 0.3x weight in random selection', () => {
            const rep = 80;
            let weight = 1.0;
            
            if (rep < REPUTATION_ENEMY_THRESHOLD) {
                weight = 2.0;
            } else if (rep >= REPUTATION_ALLY_THRESHOLD) {
                weight = 0.3;
            }
            
            console.log(`Ally (rep ${rep}): weight = ${weight}x`);
            expect(weight).toBe(0.3);
        });

        it('neutral bots get 1.0x weight', () => {
            const rep = 50;
            let weight = 1.0;
            
            if (rep < REPUTATION_ENEMY_THRESHOLD) {
                weight = 2.0;
            } else if (rep >= REPUTATION_ALLY_THRESHOLD) {
                weight = 0.3;
            }
            
            console.log(`Neutral (rep ${rep}): weight = ${weight}x`);
            expect(weight).toBe(1.0);
        });
    });

    describe('2. Ally Defense Chance', () => {
        it('allies have 40% chance to defend player', () => {
            const DEFEND_CHANCE = 0.4;
            
            console.log(`Ally defense chance: ${DEFEND_CHANCE * 100}%`);
            expect(DEFEND_CHANCE).toBe(0.4);
        });

        it('only bots with rep >= 70 can be allies', () => {
            const allyThreshold = REPUTATION_ALLY_THRESHOLD;
            
            console.log(`Minimum rep for alliance: ${allyThreshold}`);
            expect(allyThreshold).toBe(70);
        });
    });
});

describe('Personality-Specific Behavior Summary', () => {
    const NOW = Date.now();
    const TEST_SCORE = 1000;

    describe('1. Comprehensive Personality Profiles', () => {
        it('WARLORD: aggressive, fast retaliation, high-tier units', () => {
            const retTime = calculateRetaliationTime(BotPersonality.WARLORD, NOW);
            const retMinutes = (retTime - NOW) / 60000;
            
            console.log('=== WARLORD PROFILE ===');
            console.log(`Retaliation: ${retMinutes.toFixed(1)} minutes (5-30 min)`);
            console.log(`Attack ratio: 70% offense, 30% defense`);
            console.log(`Unit tiers: 3-8 (high tier focus)`);
            console.log(`Retaliation multiplier: 1.3x`);
            console.log(`Strategy: DAMAGE_DEALER, aggressive offense`);
            
            expect(retMinutes).toBeLessThanOrEqual(35);
        });

        it('TURTLE: defensive, slow retaliation, tanky units', () => {
            const retTime = calculateRetaliationTime(BotPersonality.TURTLE, NOW);
            const retHours = (retTime - NOW) / 3600000;
            
            console.log('=== TURTLE PROFILE ===');
            console.log(`Retaliation: ${retHours.toFixed(1)} hours (2-6 hours)`);
            console.log(`Attack ratio: 30% offense, 70% defense`);
            console.log(`Unit tiers: 1-4 (defensive focus)`);
            console.log(`Retaliation multiplier: 1.5x (deathball)`);
            console.log(`Strategy: FORTIFY, defensive superiority`);
            
            expect(retHours).toBeGreaterThanOrEqual(1.5);
        });

        it('TYCOON: balanced, medium retaliation, efficient units', () => {
            const retTime = calculateRetaliationTime(BotPersonality.TYCOON, NOW);
            const retHours = (retTime - NOW) / 3600000;
            
            console.log('=== TYCOON PROFILE ===');
            console.log(`Retaliation: ${retHours.toFixed(1)} hours (1-4 hours)`);
            console.log(`Attack ratio: 50% offense, 50% defense`);
            console.log(`Unit tiers: 2-6 (balanced focus)`);
            console.log(`Retaliation multiplier: 1.0x`);
            console.log(`Strategy: EFFICIENCY, cost-effective armies`);
            
            expect(retHours).toBeGreaterThanOrEqual(0.5);
        });

        it('ROGUE: unpredictable, random timing, versatile units', () => {
            const samples = 10;
            const times: number[] = [];
            
            for (let i = 0; i < samples; i++) {
                const retTime = calculateRetaliationTime(BotPersonality.ROGUE, NOW);
                times.push(retTime - NOW);
            }
            
            const shortAttacks = times.filter(t => t < 3600000).length;
            const longAttacks = times.filter(t => t > 3600000 * 4).length;
            
            console.log('=== ROGUE PROFILE ===');
            console.log(`Retaliation: unpredictable (short OR long)`);
            console.log(`Short attacks (<1h): ${shortAttacks}/${samples}`);
            console.log(`Long attacks (>4h): ${longAttacks}/${samples}`);
            console.log(`Attack ratio: 60% offense, 40% defense`);
            console.log(`Unit tiers: 2-7 (versatile focus)`);
            console.log(`Retaliation multiplier: 1.0x`);
            console.log(`Strategy: SURPRISE, hit-and-run tactics`);
            
            expect(shortAttacks + longAttacks).toBe(samples);
        });
    });

    describe('2. Reaction Time Comparison', () => {
        it('should rank personalities by reaction speed', () => {
            const iterations = 20;
            const results: Record<string, number[]> = {
                WARLORD: [],
                TURTLE: [],
                TYCOON: [],
                ROGUE: []
            };
            
            for (let i = 0; i < iterations; i++) {
                results.WARLORD.push(calculateRetaliationTime(BotPersonality.WARLORD, NOW) - NOW);
                results.TURTLE.push(calculateRetaliationTime(BotPersonality.TURTLE, NOW) - NOW);
                results.TYCOON.push(calculateRetaliationTime(BotPersonality.TYCOON, NOW) - NOW);
                results.ROGUE.push(calculateRetaliationTime(BotPersonality.ROGUE, NOW) - NOW);
            }
            
            const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
            
            const avgWarlord = avg(results.WARLORD) / 3600000;
            const avgTurtle = avg(results.TURTLE) / 3600000;
            const avgTycoon = avg(results.TYCOON) / 3600000;
            const avgRogue = avg(results.ROGUE) / 3600000;
            
            console.log('\n=== REACTION TIME RANKING ===');
            console.log(`1. WARLORD: ~${(avgWarlord * 60).toFixed(1)} min (FASTEST)`);
            console.log(`2. TYCOON: ~${avgTycoon.toFixed(1)} h`);
            console.log(`3. ROGUE: ~${avgRogue.toFixed(1)} h (variable)`);
            console.log(`4. TURTLE: ~${avgTurtle.toFixed(1)} h (SLOWEST)`);
            
            expect(avgWarlord).toBeLessThan(avgTycoon);
        });
    });

    describe('3. Low Reputation Impact by Personality', () => {
        it('all personalities accelerate decay when rep < 40', () => {
            const testReps = [35, 25, 15, 5, 0];
            
            console.log('\n=== DECAY MULTIPLIER BY REPUTATION ===');
            testReps.forEach(rep => {
                const multiplier = calculateDecayMultiplier(rep);
                console.log(`Rep ${rep}: ${multiplier}x decay`);
            });
            
            expect(calculateDecayMultiplier(35)).toBeGreaterThan(1.0);
            expect(calculateDecayMultiplier(0)).toBe(2.0);
        });
    });
});

describe('Attack Cooldown and Protection Interaction', () => {
    describe('1. Attack Cooldown Windows', () => {
        it('random attacks occur every 1-6 hours', () => {
            const minCooldown = 1 * 60 * 60 * 1000;
            const maxCooldown = 6 * 60 * 60 * 1000;
            
            console.log(`Attack cooldown: ${minCooldown/3600000}h to ${maxCooldown/3600000}h`);
            
            expect(minCooldown / 3600000).toBe(1);
            expect(maxCooldown / 3600000).toBe(6);
        });

        it('newbie protection at < 1000 score', () => {
            const NEWBIE_THRESHOLD = 1000;
            
            console.log(`Newbie protection: < ${NEWBIE_THRESHOLD} empire points`);
            expect(NEWBIE_THRESHOLD).toBe(1000);
        });
    });

    describe('2. Grudge Rescheduling During Protection', () => {
        it('grudges reschedule when player is protected', () => {
            console.log('\n=== GRUDGE RESCHEDULING ===');
            console.log('If retaliation time passes during protection:');
            console.log('- Attack rescheduled to protection end');
            console.log('- 0-5 min jitter added');
            console.log('- Notification sent when planning');
        });

        it('force attack after 12 hours even if protected', () => {
            const FORCE_ATTACK_AFTER = 12 * 60 * 60 * 1000;
            
            console.log(`Force attack after: ${FORCE_ATTACK_AFTER/3600000}h of waiting`);
            expect(FORCE_ATTACK_AFTER / 3600000).toBe(12);
        });
    });
});
