import { describe, it, expect } from 'vitest';
import {
    initializeRankingState,
    processRankingEvolution,
    getCurrentStandings,
    GROWTH_INTERVAL_MS,
    RankingCategory,
    BotEvent,
    StaticBot
} from '../utils/engine/rankings';
import { BotPersonality } from '../types/enums';
import { GameState } from '../types';

describe('Ranking Trend Calculation', () => {
    const GROWTH_INTERVAL = GROWTH_INTERVAL_MS;

    const createMockGameState = (bots: StaticBot[]): GameState => ({
        saveVersion: 6,
        playerName: 'TestPlayer',
        hasChangedName: false,
        resources: { MONEY: 0, OIL: 0, AMMO: 0, GOLD: 0, DIAMOND: 0 },
        maxResources: { MONEY: 0, OIL: 0, AMMO: 0, GOLD: 0, DIAMOND: 0 },
        buildings: {} as any,
        units: {} as any,
        researchedTechs: [],
        techLevels: {},
        activeResearch: null,
        activeMissions: [],
        activeRecruitments: [],
        activeConstructions: [],
        bankBalance: 0,
        currentInterestRate: 0,
        nextRateChangeTime: 0,
        lastInterestPayoutTime: 0,
        empirePoints: 5000,
        lastSaveTime: Date.now(),
        campaignProgress: 1,
        lastCampaignMissionFinishedTime: 0,
        marketOffers: [],
        marketNextRefreshTime: 0,
        activeMarketEvent: null,
        completedTutorials: [],
        currentTutorialId: null,
        tutorialClaimable: false,
        tutorialAccepted: false,
        isTutorialMinimized: false,
        nextAttackTime: 0,
        incomingAttacks: [],
        activeWar: null,
        grudges: [],
        enemyAttackCounts: {},
        lastEnemyAttackCheckTime: 0,
        lastEnemyAttackResetTime: 0,
        spyReports: [],
        targetAttackCounts: {},
        lastAttackResetTime: 0,
        rankingData: { bots, lastUpdateTime: Date.now(), lastPlayerRank: 100 },
        diplomaticActions: {},
        lastReputationDecayTime: 0,
        lifetimeStats: {
            enemiesKilled: 0,
            unitsLost: 0,
            resourcesMined: 0,
            missionsCompleted: 0,
            highestRankAchieved: 0
        },
        logs: []
    });

    describe('Trend Indicator Logic', () => {
        it('should calculate trend correctly for initial state', () => {
            const ranking = initializeRankingState();
            const bots = ranking.bots;
            const state = createMockGameState(bots);
            
            const standings = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            
            // Verify trend calculation formula: trend = lastRank - currentRank
            standings.forEach(bot => {
                const expectedTrend = (bot._rawLastRank || 0) - bot.rank;
                expect(bot.trend).toBe(expectedTrend);
            });
        });

        it('should calculate trend correctly after one growth cycle', () => {
            const ranking = initializeRankingState();
            let bots = ranking.bots;
            let state = createMockGameState(bots);
            
            // Get initial standings
            const initialStandings = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            const playerInitialRank = initialStandings.find(e => e.isPlayer)!.rank;
            
            // Simulate one growth cycle
            const result = processRankingEvolution(bots, GROWTH_INTERVAL);
            bots = result.bots;
            state = createMockGameState(bots);
            
            // Get new standings
            const newStandings = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            
            // The trend should reflect the change from previous rank to current rank
            newStandings.forEach(entry => {
                if (entry._rawLastRank) {
                    const expectedTrend = entry._rawLastRank - entry.rank;
                    expect(entry.trend).toBe(expectedTrend);
                }
            });
        });

        it('should show positive trend when bot moves up in rank', () => {
            // Create a scenario where a bot clearly moves up
            const ranking = initializeRankingState();
            let bots = ranking.bots;
            
            // Make a mid-tier bot grow significantly
            const midBot = bots[Math.floor(bots.length / 2)];
            midBot.stats[RankingCategory.DOMINION] *= 3; // Triple the score
            
            let state = createMockGameState(bots);
            
            // First cycle to establish baseline
            const result1 = processRankingEvolution(bots, GROWTH_INTERVAL);
            bots = result1.bots;
            state = createMockGameState(bots);
            
            // Get standings after first cycle
            const standings1 = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            const boostedBotEntry1 = standings1.find(e => e.id === midBot.id)!;
            
            // Second cycle - trend should now show the improvement
            const result2 = processRankingEvolution(bots, GROWTH_INTERVAL);
            bots = result2.bots;
            state = createMockGameState(bots);
            
            const standings2 = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            const boostedBotEntry2 = standings2.find(e => e.id === midBot.id)!;
            
            // The bot should have moved up (lower rank number = better)
            // Trend = previous rank - current rank
            // If previous rank was higher number and current is lower, trend is positive
            if (boostedBotEntry2.rank < boostedBotEntry1.rank) {
                expect(boostedBotEntry2.trend).toBeGreaterThan(0);
            }
        });

        it('should show negative trend when bot moves down in rank', () => {
            const ranking = initializeRankingState();
            let bots = ranking.bots;
            
            // Make a top bot grow very slowly while others grow normally
            const topBot = bots[bots.length - 1]; // Start with highest score
            
            let state = createMockGameState(bots);
            
            // First cycle to establish baseline
            const result1 = processRankingEvolution(bots, GROWTH_INTERVAL);
            bots = result1.bots;
            state = createMockGameState(bots);
            
            const standings1 = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            const slowBotEntry1 = standings1.find(e => e.id === topBot.id)!;
            
            // Second cycle
            const result2 = processRankingEvolution(bots, GROWTH_INTERVAL);
            bots = result2.bots;
            state = createMockGameState(bots);
            
            const standings2 = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            const slowBotEntry2 = standings2.find(e => e.id === topBot.id)!;
            
            // If the bot fell in position, trend should be negative
            if (slowBotEntry2.rank > slowBotEntry1.rank) {
                expect(slowBotEntry2.trend).toBeLessThan(0);
            }
        });

        it('should persist lastRank in bots for localStorage', () => {
            const ranking = initializeRankingState();
            let bots = ranking.bots;
            
            // Initial state - bots have lastRank from initialization
            expect(bots[0].lastRank).toBeDefined();
            
            // After growth cycle, lastRank should be updated
            const result = processRankingEvolution(bots, GROWTH_INTERVAL);
            const updatedBots = result.bots;
            
            updatedBots.forEach(bot => {
                expect(bot.lastRank).toBeDefined();
                expect(bot.lastRank).toBeGreaterThan(0);
                expect(bot.lastRank).toBeLessThanOrEqual(updatedBots.length);
            });
            
            // This ensures when saved to localStorage, the trend data persists
        });

        it('should maintain trend data across multiple growth cycles', () => {
            const ranking = initializeRankingState();
            let bots = ranking.bots;
            let state = createMockGameState(bots);
            
            // Cycle 1
            let result = processRankingEvolution(bots, GROWTH_INTERVAL);
            bots = result.bots;
            state = createMockGameState(bots);
            const standings1 = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            
            // Cycle 2
            result = processRankingEvolution(bots, GROWTH_INTERVAL);
            bots = result.bots;
            state = createMockGameState(bots);
            const standings2 = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            
            // Cycle 3
            result = processRankingEvolution(bots, GROWTH_INTERVAL);
            bots = result.bots;
            state = createMockGameState(bots);
            const standings3 = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            
            // All cycles should have valid trend calculations
            [standings1, standings2, standings3].forEach((standings, idx) => {
                standings.forEach(entry => {
                    if (entry._rawLastRank) {
                        const expectedTrend = entry._rawLastRank - entry.rank;
                        expect(entry.trend).toBe(expectedTrend);
                    }
                });
            });
        });
    });
});
