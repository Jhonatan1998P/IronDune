import { describe, it, expect, beforeEach } from 'vitest';
import { processReputationDecay } from '../utils/engine/diplomacy';
import { StaticBot, initializeRankingState } from '../utils/engine/rankings';
import {
    REPUTATION_DECAY_INTERVAL_MS,
    REPUTATION_DECAY_AMOUNT,
    REPUTATION_DECAY_MAX_THRESHOLD,
    REPUTATION_DECAY_BOOST_THRESHOLD,
    REPUTATION_DECAY_MAX_MULTIPLIER,
} from '../constants';

const DECAY_INTERVAL = REPUTATION_DECAY_INTERVAL_MS;

describe('Reputation Decay System - Always Decays Below 75', () => {
    let bots: StaticBot[];

    beforeEach(() => {
        const ranking = initializeRankingState();
        bots = ranking.bots;
    });

    describe('1. Stable (>= 75) - No Decay', () => {
        it('rep 100 does not decay', () => {
            const bot = { ...bots[0], reputation: 100 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            expect(result.updatedBots[0].reputation).toBe(100);
        });

        it('rep 80 does not decay', () => {
            const bot = { ...bots[0], reputation: 80 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            expect(result.updatedBots[0].reputation).toBe(80);
        });

        it('rep 75 does not decay (boundary)', () => {
            const bot = { ...bots[0], reputation: 75 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            expect(result.updatedBots[0].reputation).toBe(75);
        });

        it('rep 76 does not decay', () => {
            const bot = { ...bots[0], reputation: 76 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            expect(result.updatedBots[0].reputation).toBe(76);
        });
    });

    describe('2. Always Decays Below 75', () => {
        it('rep 74 decays by 2', () => {
            const bot = { ...bots[0], reputation: 74 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            expect(result.updatedBots[0].reputation).toBe(72);
        });

        it('rep 50 decays by 2', () => {
            const bot = { ...bots[0], reputation: 50 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            expect(result.updatedBots[0].reputation).toBe(48);
        });

        it('rep 30 decays by 2 (1.25x multiplier)', () => {
            const bot = { ...bots[0], reputation: 30 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            // Multiplier: 1 + (2-1) * (1 - 30/40) = 1 + 0.25 = 1.25
            // Decay: 2 * 1.25 = 2.5
            // New: 30 - 2.5 = 27.5
            expect(result.updatedBots[0].reputation).toBe(27.5);
        });

        it('rep 10 decays with multiplier (decimal precision)', () => {
            const bot = { ...bots[0], reputation: 10 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            // Multiplier: 1 + (2-1) * (1 - 10/40) = 1 + 0.75 = 1.75
            // Decay: 2 * 1.75 = 3.5
            // New: 10 - 3.5 = 6.5
            expect(result.updatedBots[0].reputation).toBe(6.5);
        });

        it('rep 0 decays with 2x multiplier', () => {
            const bot = { ...bots[0], reputation: 0 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            // Multiplier: 2x, Decay: 4, New: 0 - 4 = 0 (capped at min 0)
            expect(result.updatedBots[0].reputation).toBe(0);
        });

        it('rep 20 decays with 1.5x multiplier', () => {
            const bot = { ...bots[0], reputation: 20 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            // Multiplier: 1 + (2-1) * (1 - 20/40) = 1 + 0.5 = 1.5
            // Decay: 2 * 1.5 = 3
            // New: 20 - 3 = 17
            expect(result.updatedBots[0].reputation).toBe(17);
        });
    });

    describe('3. Multiplier Scales from 40 to 0', () => {
        it('rep 41 has 1x multiplier', () => {
            const bot = { ...bots[0], reputation: 41 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            // > 40, so multiplier = 1x, decay = 2
            expect(result.updatedBots[0].reputation).toBe(39);
        });

        it('rep 40 has 1x multiplier', () => {
            const bot = { ...bots[0], reputation: 40 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            // At threshold, multiplier = 1x
            expect(result.updatedBots[0].reputation).toBe(38);
        });

        it('rep 20 has 1.5x multiplier', () => {
            const bot = { ...bots[0], reputation: 20 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            expect(result.updatedBots[0].reputation).toBe(17);
        });

        it('rep 0 has 2x multiplier', () => {
            const bot = { ...bots[0], reputation: 0 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            expect(result.updatedBots[0].reputation).toBe(0);
        });
    });

    describe('4. Multiple Cycles', () => {
        it('rep 74 after 5 cycles', () => {
            const bot = { ...bots[0], reputation: 74 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL * 5);
            // 74 - (2 * 5) = 64
            expect(result.updatedBots[0].reputation).toBe(64);
        });

        it('rep 50 after 10 cycles reaches 30', () => {
            const bot = { ...bots[0], reputation: 50 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL * 10);
            // 50 - (2 * 10) = 30
            expect(result.updatedBots[0].reputation).toBe(30);
        });

        it('rep 10 with 2 cycles (decimal precision)', () => {
            const bot = { ...bots[0], reputation: 10 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL * 2);
            // Multiplier: 1.75, Decay per cycle: 3.5
            // Total: 10 - (3.5 * 2) = 10 - 7 = 3
            expect(result.updatedBots[0].reputation).toBe(3);
        });

        it('rep 5 reaches 0 after multiple cycles', () => {
            const bot = { ...bots[0], reputation: 5 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL * 3);
            // 5 - 3 - 2 - 0 = 0 (approximated)
            expect(result.updatedBots[0].reputation).toBe(0);
        });
    });

    describe('5. Boundary Values', () => {
        it('rep 74 decays (below threshold)', () => {
            const bot = { ...bots[0], reputation: 74 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            expect(result.updatedBots[0].reputation).toBe(72);
        });

        it('rep 1 decays with high multiplier', () => {
            const bot = { ...bots[0], reputation: 1 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            // Multiplier: ~1.975, Decay: ~3.95 -> floor = 3
            // New: 1 - 3 = -2 -> capped at 0
            expect(result.updatedBots[0].reputation).toBe(0);
        });

        it('rep stays within 0-100 bounds', () => {
            const bot100 = { ...bots[0], reputation: 100 };
            const result100 = processReputationDecay([bot100], 0, DECAY_INTERVAL * 100);
            expect(result100.updatedBots[0].reputation).toBe(100);

            const bot0 = { ...bots[0], reputation: 0 };
            const result0 = processReputationDecay([bot0], 0, DECAY_INTERVAL * 100);
            expect(result0.updatedBots[0].reputation).toBe(0);
        });
    });

    describe('6. Multiple Bots', () => {
        it('processes all bots independently', () => {
            const testBots = [
                { ...bots[0], id: 'bot1', reputation: 80 },
                { ...bots[1], id: 'bot2', reputation: 50 },
                { ...bots[2], id: 'bot3', reputation: 20 },
            ];
            const result = processReputationDecay(testBots, 0, DECAY_INTERVAL);
            
            // 80 >= 75 -> no decay
            expect(result.updatedBots[0].reputation).toBe(80);
            // 50 < 75 -> decays by 2
            expect(result.updatedBots[1].reputation).toBe(48);
            // 20 < 75 -> decays with 1.5x multiplier = 3
            expect(result.updatedBots[2].reputation).toBe(17);
        });
    });

    describe('7. newLastDecayTime Update', () => {
        it('updates correctly for 1 cycle', () => {
            const bot = { ...bots[0], reputation: 50 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            expect(result.newLastDecayTime).toBe(DECAY_INTERVAL);
        });

        it('updates correctly for multiple cycles', () => {
            const bot = { ...bots[0], reputation: 50 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL * 3);
            expect(result.newLastDecayTime).toBe(DECAY_INTERVAL * 3);
        });

        it('preserves remainder time', () => {
            const bot = { ...bots[0], reputation: 50 };
            const extra = 3600000;
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL + extra);
            expect(result.newLastDecayTime).toBe(DECAY_INTERVAL + extra);
        });

        it('updates even for partial cycles (decimal precision)', () => {
            const bot = { ...bots[0], reputation: 50 };
            const initialTime = 5000;
            const result = processReputationDecay([bot], initialTime, DECAY_INTERVAL - 1);
            // CASI 1 ciclo completo (0.99999...), decay ~2
            // New: 50 - 2 = ~48
            expect(result.newLastDecayTime).toBe(DECAY_INTERVAL - 1);
            expect(result.updatedBots[0].reputation).toBeCloseTo(48.0, 2);
        });
    });

    describe('8. Time Drift Tests', () => {
        it('applies proportional decay for partial cycles (decimal precision)', () => {
            const bot = { ...bots[0], reputation: 50 };
            const fiveHours = 5 * 60 * 60 * 1000;
            const result = processReputationDecay([bot], 0, fiveHours);
            
            // 5 horas = 1.25 ciclos
            // Decay: 2 * 1.25 = 2.5
            // New: 50 - 2.5 = 47.5
            expect(result.updatedBots[0].reputation).toBe(47.5);
            expect(result.newLastDecayTime).toBe(fiveHours);
        });
    });

    describe('9. Edge Cases', () => {
        it('all values from 1-74 decay', () => {
            const testValues = [1, 5, 10, 20, 30, 40, 50, 60, 70, 74];
            
            for (const rep of testValues) {
                const bot = { ...bots[0], reputation: rep };
                const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
                
                expect(result.updatedBots[0].reputation).toBeLessThan(rep);
            }
        });

        it('rep 0 stays at 0 (minimum)', () => {
            const bot = { ...bots[0], reputation: 0 };
            const result = processReputationDecay([bot], 0, DECAY_INTERVAL);
            expect(result.updatedBots[0].reputation).toBe(0);
        });

        it('75+ values stay stable', () => {
            const testValues = [75, 80, 90, 100];
            
            for (const rep of testValues) {
                const bot = { ...bots[0], reputation: rep };
                const result = processReputationDecay([bot], 0, DECAY_INTERVAL * 10);
                expect(result.updatedBots[0].reputation).toBe(rep);
            }
        });
    });
});

describe('Reputation Decay - Online vs Offline Consistency', () => {
    const createTestBots = (reputations: Record<string, number>) => {
        const ranking = initializeRankingState();
        return ranking.bots.map(bot => ({
            ...bot,
            reputation: reputations[bot.id] ?? 50
        }));
    };

    it('produces consistent results for same elapsed time', () => {
        const elapsed = DECAY_INTERVAL * 3;
        
        const botsOnline = createTestBots({ 'bot-1': 80, 'bot-2': 50, 'bot-3': 20 });
        const now = Date.now();
        const onlineResult = processReputationDecay(botsOnline, now - elapsed, now);
        
        const botsOffline = createTestBots({ 'bot-1': 80, 'bot-2': 50, 'bot-3': 20 });
        const offlineResult = processReputationDecay(botsOffline, now - elapsed, now);
        
        expect(onlineResult.updatedBots[0].reputation).toBe(offlineResult.updatedBots[0].reputation);
        expect(onlineResult.updatedBots[1].reputation).toBe(offlineResult.updatedBots[1].reputation);
        expect(onlineResult.updatedBots[2].reputation).toBe(offlineResult.updatedBots[2].reputation);
    });
});
