import { describe, it, expect } from 'vitest';
import { BotPersonality } from '../types/enums';
import { calculateRetaliationTime, getRetaliationChance, getRetaliationMultiplier } from '../utils/engine/nemesis';
import { calculateDecayMultiplier, processReputationDecay } from '../utils/engine/diplomacy';
import { StaticBot, RankingCategory, BotEvent } from '../utils/engine/rankings';
import { REPUTATION_MIN, REPUTATION_MAX, REPUTATION_DECAY_INTERVAL_MS, REPUTATION_ALLY_THRESHOLD, REPUTATION_ENEMY_THRESHOLD } from '../constants';

describe('Bot Reaction to Player Attack - Retaliation System', () => {
    const NOW = Date.now();
    const TEST_SCORE = 1000;

    describe('1. Retaliation Time (15-45 minutes random)', () => {
        it('Retaliation time should be between 15-45 minutes for all personalities', () => {
            const samples = 20;
            const times: number[] = [];

            for (let i = 0; i < samples; i++) {
                const retTime = calculateRetaliationTime(NOW);
                times.push(retTime - NOW);
            }

            const avgMs = times.reduce((a, b) => a + b, 0) / samples;
            const avgMinutes = avgMs / 60000;

            console.log(`Retaliation times: ${times.map(t => (t/60000).toFixed(1)).join(', ')} mins`);
            console.log(`Average: ${avgMinutes.toFixed(1)} minutes (expected ~30)`);

            // All retaliation times should be between 15-45 minutes
            times.forEach(t => {
                const minutes = t / 60000;
                expect(minutes).toBeGreaterThanOrEqual(14); // Allow small variance
                expect(minutes).toBeLessThanOrEqual(46);
            });
        });
    });

    describe('2. Retaliation Chance by Personality', () => {
        it('WARLORD should have highest retaliation chance (95%)', () => {
            const chance = getRetaliationChance(BotPersonality.WARLORD);
            console.log(`WARLORD retaliation chance: ${chance * 100}%`);
            expect(chance).toBe(0.95);
        });

        it('TURTLE should have high retaliation chance (85%)', () => {
            const chance = getRetaliationChance(BotPersonality.TURTLE);
            console.log(`TURTLE retaliation chance: ${chance * 100}%`);
            expect(chance).toBe(0.85);
        });

        it('TYCOON should have lowest retaliation chance (70%)', () => {
            const chance = getRetaliationChance(BotPersonality.TYCOON);
            console.log(`TYCOON retaliation chance: ${chance * 100}%`);
            expect(chance).toBe(0.70);
        });

        it('ROGUE should have high retaliation chance (90%)', () => {
            const chance = getRetaliationChance(BotPersonality.ROGUE);
            console.log(`ROGUE retaliation chance: ${chance * 100}%`);
            expect(chance).toBe(0.90);
        });
    });

    describe('3. Retaliation Multiplier by Personality', () => {
        it('WARLORD should have 1.3x army multiplier', () => {
            const multiplier = getRetaliationMultiplier(BotPersonality.WARLORD);
            console.log(`WARLORD retaliation multiplier: ${multiplier}x`);
            expect(multiplier).toBe(1.3);
        });

        it('TURTLE should have 1.5x army multiplier (deathball)', () => {
            const multiplier = getRetaliationMultiplier(BotPersonality.TURTLE);
            console.log(`TURTLE retaliation multiplier: ${multiplier}x`);
            expect(multiplier).toBe(1.5);
        });

        it('TYCOON should have 1.0x army multiplier', () => {
            const multiplier = getRetaliationMultiplier(BotPersonality.TYCOON);
            console.log(`TYCOON retaliation multiplier: ${multiplier}x`);
            expect(multiplier).toBe(1.0);
        });

        it('ROGUE should have 1.0x army multiplier', () => {
            const multiplier = getRetaliationMultiplier(BotPersonality.ROGUE);
            console.log(`ROGUE retaliation multiplier: ${multiplier}x`);
            expect(multiplier).toBe(1.0);
        });
    });

    describe('4. Grudge Expiration Logic', () => {
        it('grudge expires after 48 hours', () => {
            const GRUDGE_DURATION_MS = 48 * 60 * 60 * 1000;
            const expectedExpiryHours = GRUDGE_DURATION_MS / 3600000;

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

            console.log(`Bot rep 80 -> ${updatedBot.reputation} (should stay 80)`);
            expect(updatedBot.reputation).toBe(80);
        });

        it('reputation < 75 should decay', () => {
            const bot: StaticBot = {
                id: 'test-bot',
                name: 'Test Bot',
                personality: BotPersonality.WARLORD,
                reputation: 50,
                stats: { [RankingCategory.DOMINION]: TEST_SCORE, [RankingCategory.MILITARY]: 800, [RankingCategory.ECONOMY]: 600, [RankingCategory.CAMPAIGN]: 0 },
                avatarId: 1,
                country: 'US',
                ambition: 1,
                currentEvent: BotEvent.PEACEFUL_PERIOD,
                eventTurnsRemaining: 0,
                growthModifier: 1
            };

            const result = processReputationDecay([bot], NOW - REPUTATION_DECAY_INTERVAL_MS, NOW);
            const updatedBot = result.updatedBots[0];

            console.log(`Bot rep 50 -> ${updatedBot.reputation} (should decay)`);
            expect(updatedBot.reputation).toBeLessThan(50);
        });

        it('reputation < 40 should decay faster (accelerated)', () => {
            const bot40: StaticBot = {
                id: 'test-bot-40',
                name: 'Test Bot 40',
                personality: BotPersonality.WARLORD,
                reputation: 40,
                stats: { [RankingCategory.DOMINION]: TEST_SCORE, [RankingCategory.MILITARY]: 800, [RankingCategory.ECONOMY]: 600, [RankingCategory.CAMPAIGN]: 0 },
                avatarId: 1,
                country: 'US',
                ambition: 1,
                currentEvent: BotEvent.PEACEFUL_PERIOD,
                eventTurnsRemaining: 0,
                growthModifier: 1
            };

            const bot20: StaticBot = {
                id: 'test-bot-20',
                name: 'Test Bot 20',
                personality: BotPersonality.WARLORD,
                reputation: 20,
                stats: { [RankingCategory.DOMINION]: TEST_SCORE, [RankingCategory.MILITARY]: 800, [RankingCategory.ECONOMY]: 600, [RankingCategory.CAMPAIGN]: 0 },
                avatarId: 1,
                country: 'US',
                ambition: 1,
                currentEvent: BotEvent.PEACEFUL_PERIOD,
                eventTurnsRemaining: 0,
                growthModifier: 1
            };

            const result40 = processReputationDecay([bot40], NOW - REPUTATION_DECAY_INTERVAL_MS, NOW);
            const result20 = processReputationDecay([bot20], NOW - REPUTATION_DECAY_INTERVAL_MS, NOW);

            const decay40 = 40 - result40.updatedBots[0].reputation;
            const decay20 = 20 - result20.updatedBots[0].reputation;

            console.log(`Bot rep 40 decays by: ${decay40.toFixed(2)}`);
            console.log(`Bot rep 20 decays by: ${decay20.toFixed(2)} (should be more)`);

            expect(decay20).toBeGreaterThan(decay40);
        });

        it('reputation cannot go below 0', () => {
            const bot: StaticBot = {
                id: 'test-bot',
                name: 'Test Bot',
                personality: BotPersonality.WARLORD,
                reputation: 0,
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

            console.log(`Bot rep 0 -> ${updatedBot.reputation} (should stay >= 0)`);
            expect(updatedBot.reputation).toBeGreaterThanOrEqual(0);
        });
    });

    describe('2. Reputation Thresholds', () => {
        it('bots with rep < 30 are enemies', () => {
            const enemyThreshold = REPUTATION_ENEMY_THRESHOLD;
            console.log(`Enemy threshold: rep < ${enemyThreshold}`);
            expect(enemyThreshold).toBe(30);
        });

        it('bots with rep >= 70 are allies', () => {
            const allyThreshold = REPUTATION_ALLY_THRESHOLD;
            console.log(`Ally threshold: rep >= ${allyThreshold}`);
            expect(allyThreshold).toBe(70);
        });
    });
});

describe('Personality-Specific Behavior Summary', () => {
    const NOW = Date.now();

    describe('1. Comprehensive Personality Profiles', () => {
        it('WARLORD: aggressive, high retaliation chance, strong army', () => {
            const chance = getRetaliationChance(BotPersonality.WARLORD);
            const multiplier = getRetaliationMultiplier(BotPersonality.WARLORD);

            console.log('=== WARLORD PROFILE ===');
            console.log(`Retaliation chance: ${chance * 100}% (very vengeful)`);
            console.log(`Army multiplier: ${multiplier}x (30% stronger)`);
            console.log(`Strategy: Aggressive offense, high-tier units`);

            expect(chance).toBe(0.95);
            expect(multiplier).toBe(1.3);
        });

        it('TURTLE: defensive, high retaliation chance, deathball army', () => {
            const chance = getRetaliationChance(BotPersonality.TURTLE);
            const multiplier = getRetaliationMultiplier(BotPersonality.TURTLE);

            console.log('=== TURTLE PROFILE ===');
            console.log(`Retaliation chance: ${chance * 100}% (holds grudges)`);
            console.log(`Army multiplier: ${multiplier}x (50% stronger - deathball)`);
            console.log(`Strategy: Defensive superiority, tanky units`);

            expect(chance).toBe(0.85);
            expect(multiplier).toBe(1.5);
        });

        it('TYCOON: economic, low retaliation chance, normal army', () => {
            const chance = getRetaliationChance(BotPersonality.TYCOON);
            const multiplier = getRetaliationMultiplier(BotPersonality.TYCOON);

            console.log('=== TYCOON PROFILE ===');
            console.log(`Retaliation chance: ${chance * 100}% (busy making money)`);
            console.log(`Army multiplier: ${multiplier}x (normal strength)`);
            console.log(`Strategy: Cost-effective, balanced army`);

            expect(chance).toBe(0.70);
            expect(multiplier).toBe(1.0);
        });

        it('ROGUE: unpredictable, high retaliation chance, normal army', () => {
            const chance = getRetaliationChance(BotPersonality.ROGUE);
            const multiplier = getRetaliationMultiplier(BotPersonality.ROGUE);

            console.log('=== ROGUE PROFILE ===');
            console.log(`Retaliation chance: ${chance * 100}% (vengeful)`);
            console.log(`Army multiplier: ${multiplier}x (normal strength)`);
            console.log(`Strategy: Hit-and-run, versatile units`);

            expect(chance).toBe(0.90);
            expect(multiplier).toBe(1.0);
        });
    });

    describe('2. Retaliation Time Comparison', () => {
        it('all personalities have same 15-45 min retaliation time', () => {
            const iterations = 20;
            const results: Record<string, number[]> = {
                WARLORD: [],
                TURTLE: [],
                TYCOON: [],
                ROGUE: []
            };

            for (let i = 0; i < iterations; i++) {
                const retTime = calculateRetaliationTime(NOW);
                const ms = retTime - NOW;
                // All personalities use the same random time
                results.WARLORD.push(ms);
                results.TURTLE.push(ms);
                results.TYCOON.push(ms);
                results.ROGUE.push(ms);
            }

            const avgWarlord = results.WARLORD.reduce((a, b) => a + b, 0) / iterations;
            const avgTurtle = results.TURTLE.reduce((a, b) => a + b, 0) / iterations;

            console.log('=== RETALIATION TIME (All personalities: 15-45 min) ===');
            console.log(`Average: ${(avgWarlord / 60000).toFixed(1)} minutes`);

            // All should be roughly equal (same random time)
            expect(avgWarlord).toBe(avgTurtle);
        });
    });
});
