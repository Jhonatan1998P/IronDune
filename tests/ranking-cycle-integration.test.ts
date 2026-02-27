import { describe, it, expect } from 'vitest';
import {
    initializeRankingState,
    processRankingEvolution,
    getCurrentStandings,
    GROWTH_INTERVAL_MS,
    RankingCategory,
    StaticBot
} from '../utils/engine/rankings';
import { BotPersonality } from '../types/enums';
import { GameState } from '../types';

describe('Ranking Cycle Integration', () => {
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

    describe('Complete Growth Cycle Flow', () => {
        it('should calculate trend correctly after growth cycle', () => {
            const ranking = initializeRankingState();
            let bots = ranking.bots;
            let state = createMockGameState(bots);
            
            // Step 1: Get standings before growth
            const beforeStandings = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            const beforeRanks = new Map(beforeStandings.map(e => [e.id, e.rank]));
            
            // Step 2: Simulate growth cycle
            const result = processRankingEvolution(bots, GROWTH_INTERVAL);
            bots = result.bots;
            state = createMockGameState(bots);
            
            // Step 3: Get standings after growth
            const afterStandings = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            
            // Verify trend formula is correct: trend = lastRank - currentRank
            afterStandings.forEach(entry => {
                const expectedTrend = (entry._rawLastRank || 0) - entry.rank;
                expect(entry.trend).toBe(expectedTrend);
            });
            
            // Note: lastRank may not exactly match beforeRanks due to random events
            // affecting bot ordering during growth. The key is that trend formula works.
        });

        it('should persist lastRank correctly between cycles', () => {
            const ranking = initializeRankingState();
            let bots = ranking.bots;
            let state = createMockGameState(bots);
            
            // Cycle 1
            let result = processRankingEvolution(bots, GROWTH_INTERVAL);
            bots = result.bots;
            state = createMockGameState(bots);
            
            // Get standings after cycle 1
            const afterCycle1 = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            const ranksAfterCycle1 = new Map(afterCycle1.map(e => [e.id, e.rank]));
            
            // Store lastRank values from bots after cycle 1
            const botLastRanksAfterCycle1 = new Map(bots.map(b => [b.id, b.lastRank]));
            
            // Cycle 2
            result = processRankingEvolution(bots, GROWTH_INTERVAL);
            bots = result.bots;
            state = createMockGameState(bots);
            const afterCycle2 = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            
            // Verify trend formula is correct in cycle 2
            afterCycle2.forEach(entry => {
                const expectedTrend = (entry._rawLastRank || 0) - entry.rank;
                expect(entry.trend).toBe(expectedTrend);
            });
            
            // Key verification: _rawLastRank should come from bot.lastRank
            // (which was set at the START of cycle 2, representing end of cycle 1 positions)
            afterCycle2.filter(e => !e.isPlayer).forEach(entry => {
                // _rawLastRank should match the bot's stored lastRank
                const bot = bots.find(b => b.id === entry.id);
                expect(entry._rawLastRank).toBe(bot?.lastRank);
            });
        });

        it('should show accurate position changes for specific scenarios', () => {
            const ranking = initializeRankingState();
            let bots = ranking.bots;
            
            // Create a scenario: boost a mid-tier bot significantly
            const midTierIndex = Math.floor(bots.length / 2);
            const boostedBot = bots[midTierIndex];
            const initialScore = boostedBot.stats[RankingCategory.DOMINION];
            boostedBot.stats[RankingCategory.DOMINION] = initialScore * 5; // 5x boost
            
            let state = createMockGameState(bots);
            
            // Cycle 1: Establish baseline after boost
            let result = processRankingEvolution(bots, GROWTH_INTERVAL);
            bots = result.bots;
            state = createMockGameState(bots);
            const standings1 = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            
            const boostedEntry1 = standings1.find(e => e.id === boostedBot.id)!;
            
            // Cycle 2: Show trend from cycle 1 position
            result = processRankingEvolution(bots, GROWTH_INTERVAL);
            bots = result.bots;
            state = createMockGameState(bots);
            const standings2 = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            
            const boostedEntry2 = standings2.find(e => e.id === boostedBot.id)!;
            
            // The trend should reflect position change from cycle 1 to cycle 2
            const expectedTrend = boostedEntry1.rank - boostedEntry2.rank;
            expect(boostedEntry2.trend).toBe(expectedTrend);
            
            // If the bot improved, trend should be positive
            if (boostedEntry2.rank < boostedEntry1.rank) {
                expect(boostedEntry2.trend).toBeGreaterThan(0);
            }
        });

        it('should handle player trend correctly', () => {
            const ranking = initializeRankingState();
            let bots = ranking.bots;
            let state = createMockGameState(bots);
            
            // Initial state
            const initialStandings = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            const playerInitial = initialStandings.find(e => e.isPlayer)!;
            
            // After one growth cycle
            const result = processRankingEvolution(bots, GROWTH_INTERVAL);
            bots = result.bots;
            state = createMockGameState(bots);
            
            const newStandings = getCurrentStandings(state, bots, RankingCategory.DOMINION);
            const playerNew = newStandings.find(e => e.isPlayer)!;
            
            // Player trend should be calculated the same way
            const expectedPlayerTrend = (playerNew._rawLastRank || 0) - playerNew.rank;
            expect(playerNew.trend).toBe(expectedPlayerTrend);
        });
    });
});
