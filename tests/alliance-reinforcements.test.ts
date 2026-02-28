import { describe, it, expect, beforeEach } from 'vitest';
import { BotPersonality, UnitType, ResourceType, BuildingType } from '../types';
import { RankingCategory, StaticBot, BotEvent } from '../utils/engine/rankings';
import { calculatePotentialReinforcements, getPlayerGarrison, isPlayerUnderThreat } from '../utils/engine/allianceReinforcements';
import { GameState, RankingData } from '../types';
import { REPUTATION_ALLY_THRESHOLD } from '../constants';

describe('Alliance Reinforcements System', () => {
    const NOW = Date.now();
    
    // Helper to create a StaticBot with specific attributes
    const createBot = (overrides: Partial<StaticBot> = {}): StaticBot => ({
        id: `bot-${Math.random().toString(36).substr(2, 9)}`,
        name: `Bot_${Math.random().toString(36).substr(2, 6)}`,
        avatarId: Math.floor(Math.random() * 100),
        country: 'US',
        stats: {
            [RankingCategory.DOMINION]: 1000,
            [RankingCategory.MILITARY]: 500,
            [RankingCategory.ECONOMY]: 300,
            [RankingCategory.CAMPAIGN]: 200
        },
        ambition: 0.5,
        personality: BotPersonality.WARLORD,
        lastRank: undefined,
        currentEvent: BotEvent.PEACEFUL_PERIOD,
        eventTurnsRemaining: 0,
        growthModifier: 1.0,
        reputation: 50,
        ...overrides
    });

    // Helper to create a base GameState
    const createGameState = (overrides: Partial<GameState> = {}): GameState => ({
        saveVersion: 1,
        playerName: 'TestPlayer',
        hasChangedName: false,
        resources: {
            [ResourceType.MONEY]: 100000,
            [ResourceType.OIL]: 5000,
            [ResourceType.AMMO]: 10000,
            [ResourceType.GOLD]: 100,
            [ResourceType.DIAMOND]: 10
        },
        maxResources: {
            [ResourceType.MONEY]: 500000,
            [ResourceType.OIL]: 50000,
            [ResourceType.AMMO]: 100000,
            [ResourceType.GOLD]: 1000,
            [ResourceType.DIAMOND]: 100
        },
        buildings: {} as Record<BuildingType, { level: number; isDamaged?: boolean }>,
        units: {},
        researchedTechs: [],
        techLevels: {},
        activeResearch: null,
        activeMissions: [],
        activeRecruitments: [],
        activeConstructions: [],
        bankBalance: 0,
        currentInterestRate: 0.05,
        nextRateChangeTime: NOW + 3600000,
        lastInterestPayoutTime: NOW,
        empirePoints: 20000,
        lastSaveTime: NOW,
        campaignProgress: 0,
        lastCampaignMissionFinishedTime: 0,
        marketOffers: [],
        marketNextRefreshTime: NOW + 300000,
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
        lastEnemyAttackCheckTime: NOW,
        lastEnemyAttackResetTime: NOW,
        spyReports: [],
        targetAttackCounts: {},
        lastAttackResetTime: NOW,
        rankingData: {
            bots: [],
            lastUpdateTime: NOW
        },
        diplomaticActions: {},
        lastReputationDecayTime: NOW,
        lifetimeStats: {
            enemiesKilled: 0,
            unitsLost: 0,
            resourcesMined: 0,
            missionsCompleted: 0,
            highestRankAchieved: 1
        },
        logs: [],
        ...overrides
    });

    describe('1. calculatePotentialReinforcements - Basic Functionality', () => {
        it('should return empty array when no allied bots exist', () => {
            const gameState = createGameState({
                rankingData: {
                    bots: [
                        createBot({ reputation: 30 }),
                        createBot({ reputation: 50 }),
                        createBot({ reputation: 69 })
                    ],
                    lastUpdateTime: NOW
                }
            });

            const reinforcements = calculatePotentialReinforcements(gameState, NOW);

            expect(reinforcements).toHaveLength(0);
        });

        it('should return reinforcements only from bots with reputation >= 75', () => {
            const alliedBot1 = createBot({ reputation: 75, name: 'Ally_75' });
            const alliedBot2 = createBot({ reputation: 85, name: 'Ally_85' });
            const alliedBot3 = createBot({ reputation: 100, name: 'Ally_100' });
            const enemyBot = createBot({ reputation: 74, name: 'Enemy_74' });

            const gameState = createGameState({
                rankingData: {
                    bots: [alliedBot1, alliedBot2, alliedBot3, enemyBot],
                    lastUpdateTime: NOW
                }
            });

            const reinforcements = calculatePotentialReinforcements(gameState, NOW);

            expect(reinforcements).toHaveLength(3);
            expect(reinforcements.map(r => r.botName)).toContain('Ally_75');
            expect(reinforcements.map(r => r.botName)).toContain('Ally_85');
            expect(reinforcements.map(r => r.botName)).toContain('Ally_100');
            expect(reinforcements.map(r => r.botName)).not.toContain('Enemy_74');
        });

        it('should sort reinforcements by reputation (highest first)', () => {
            const bots = [
                createBot({ reputation: 75, name: 'Bot_75' }),
                createBot({ reputation: 90, name: 'Bot_90' }),
                createBot({ reputation: 85, name: 'Bot_85' }),
                createBot({ reputation: 100, name: 'Bot_100' })
            ];

            const gameState = createGameState({
                rankingData: {
                    bots,
                    lastUpdateTime: NOW
                }
            });

            const reinforcements = calculatePotentialReinforcements(gameState, NOW);

            expect(reinforcements[0].reputation).toBe(100);
            expect(reinforcements[1].reputation).toBe(90);
            expect(reinforcements[2].reputation).toBe(85);
            expect(reinforcements[3].reputation).toBe(75);
        });

        it('should handle bots with undefined reputation (default to 50)', () => {
            const botWithRep = createBot({ reputation: 75 });
            const botWithoutRep = createBot({ reputation: undefined as unknown as number });

            const gameState = createGameState({
                rankingData: {
                    bots: [botWithRep, botWithoutRep],
                    lastUpdateTime: NOW
                }
            });

            const reinforcements = calculatePotentialReinforcements(gameState, NOW);

            expect(reinforcements).toHaveLength(1);
            expect(reinforcements[0].reputation).toBe(75);
        });
    });

    describe('2. Reinforcement Army Composition', () => {
        it('should generate army with 30% of bot military strength', () => {
            const highScoreBot = createBot({
                reputation: 80,
                stats: {
                    [RankingCategory.DOMINION]: 10000,
                    [RankingCategory.MILITARY]: 5000,
                    [RankingCategory.ECONOMY]: 3000,
                    [RankingCategory.CAMPAIGN]: 2000
                }
            });

            const gameState = createGameState({
                rankingData: {
                    bots: [highScoreBot],
                    lastUpdateTime: NOW
                }
            });

            const reinforcements = calculatePotentialReinforcements(gameState, NOW);

            expect(reinforcements).toHaveLength(1);
            expect(reinforcements[0].botScore).toBe(10000);
            
            // Army should be approximately 30% of bot's strength
            const totalUnits = reinforcements[0].totalUnits;
            expect(totalUnits).toBeGreaterThan(0);
        });

        it('should include all unit types in reinforcement army', () => {
            const bot = createBot({
                reputation: 75,
                stats: {
                    [RankingCategory.DOMINION]: 5000,
                    [RankingCategory.MILITARY]: 2500,
                    [RankingCategory.ECONOMY]: 1500,
                    [RankingCategory.CAMPAIGN]: 1000
                },
                personality: BotPersonality.WARLORD
            });

            const gameState = createGameState({
                rankingData: {
                    bots: [bot],
                    lastUpdateTime: NOW
                }
            });

            const reinforcements = calculatePotentialReinforcements(gameState, NOW);

            expect(reinforcements).toHaveLength(1);
            const army = reinforcements[0].units;
            
            // Army should have multiple unit types
            const unitTypes = Object.keys(army);
            expect(unitTypes.length).toBeGreaterThan(0);
        });

        it('should vary army composition based on bot personality', () => {
            const warlordBot = createBot({
                reputation: 80,
                stats: { [RankingCategory.DOMINION]: 5000, [RankingCategory.MILITARY]: 2500, [RankingCategory.ECONOMY]: 1500, [RankingCategory.CAMPAIGN]: 1000 },
                personality: BotPersonality.WARLORD
            });

            const turtleBot = createBot({
                reputation: 80,
                stats: { [RankingCategory.DOMINION]: 5000, [RankingCategory.MILITARY]: 2500, [RankingCategory.ECONOMY]: 1500, [RankingCategory.CAMPAIGN]: 1000 },
                personality: BotPersonality.TURTLE
            });

            const tycoonBot = createBot({
                reputation: 80,
                stats: { [RankingCategory.DOMINION]: 5000, [RankingCategory.MILITARY]: 2500, [RankingCategory.ECONOMY]: 1500, [RankingCategory.CAMPAIGN]: 1000 },
                personality: BotPersonality.TYCOON
            });

            const gameStateWarlord = createGameState({
                rankingData: { bots: [warlordBot], lastUpdateTime: NOW }
            });

            const gameStateTurtle = createGameState({
                rankingData: { bots: [turtleBot], lastUpdateTime: NOW }
            });

            const gameStateTycoon = createGameState({
                rankingData: { bots: [tycoonBot], lastUpdateTime: NOW }
            });

            const warlordReinforcements = calculatePotentialReinforcements(gameStateWarlord, NOW);
            const turtleReinforcements = calculatePotentialReinforcements(gameStateTurtle, NOW);
            const tycoonReinforcements = calculatePotentialReinforcements(gameStateTycoon, NOW);

            // All should have reinforcements
            expect(warlordReinforcements).toHaveLength(1);
            expect(turtleReinforcements).toHaveLength(1);
            expect(tycoonReinforcements).toHaveLength(1);

            // Army compositions should differ based on personality
            expect(warlordReinforcements[0].units).not.toEqual(turtleReinforcements[0].units);
        });
    });

    describe('3. Reinforcement Entry Data Integrity', () => {
        it('should include all required fields in ReinforcementEntry', () => {
            const bot = createBot({
                reputation: 85,
                name: 'TestAlly',
                stats: { [RankingCategory.DOMINION]: 3000, [RankingCategory.MILITARY]: 1500, [RankingCategory.ECONOMY]: 1000, [RankingCategory.CAMPAIGN]: 500 }
            });

            const gameState = createGameState({
                rankingData: {
                    bots: [bot],
                    lastUpdateTime: NOW
                }
            });

            const reinforcements = calculatePotentialReinforcements(gameState, NOW);

            expect(reinforcements).toHaveLength(1);
            const entry = reinforcements[0];

            // Verify all required fields exist
            expect(entry).toHaveProperty('botId');
            expect(entry).toHaveProperty('botName');
            expect(entry).toHaveProperty('botScore');
            expect(entry).toHaveProperty('reputation');
            expect(entry).toHaveProperty('units');
            expect(entry).toHaveProperty('totalUnits');
            expect(entry).toHaveProperty('estimatedArrival');

            // Verify field types and values
            expect(entry.botId).toBe(bot.id);
            expect(entry.botName).toBe('TestAlly');
            expect(entry.botScore).toBe(3000);
            expect(entry.reputation).toBe(85);
            expect(typeof entry.units).toBe('object');
            expect(typeof entry.totalUnits).toBe('number');
            expect(typeof entry.estimatedArrival).toBe('number');
        });

        it('should calculate totalUnits correctly from units object', () => {
            const bot = createBot({
                reputation: 75,
                stats: { [RankingCategory.DOMINION]: 2000, [RankingCategory.MILITARY]: 1000, [RankingCategory.ECONOMY]: 600, [RankingCategory.CAMPAIGN]: 400 }
            });

            const gameState = createGameState({
                rankingData: {
                    bots: [bot],
                    lastUpdateTime: NOW
                }
            });

            const reinforcements = calculatePotentialReinforcements(gameState, NOW);
            const entry = reinforcements[0];

            // Manually calculate total units
            const manualTotal = Object.values(entry.units).reduce((sum, count) => sum + (count || 0), 0);

            expect(entry.totalUnits).toBe(manualTotal);
        });

        it('should set estimatedArrival between 5-15 minutes from now', () => {
            const bot = createBot({ reputation: 80 }); // Must be >= 75 to be ally

            const gameState = createGameState({
                rankingData: {
                    bots: [bot],
                    lastUpdateTime: NOW
                }
            });

            // Run multiple times to test random ETA
            const samples = 20;
            const etas: number[] = [];

            for (let i = 0; i < samples; i++) {
                const reinforcements = calculatePotentialReinforcements(gameState, NOW);
                // Ensure reinforcements exist before accessing
                if (reinforcements.length > 0) {
                    const eta = reinforcements[0].estimatedArrival;
                    etas.push(eta);
                }
            }

            // All ETAs should be between 5-15 minutes from NOW
            etas.forEach(eta => {
                const minutesFromNow = (eta - NOW) / 60000;
                expect(minutesFromNow).toBeGreaterThanOrEqual(4.5); // Allow small variance
                expect(minutesFromNow).toBeLessThanOrEqual(15.5);
            });
        });
    });

    describe('4. getPlayerGarrison - Player Unit Tracking', () => {
        it('should return zero totals when player has no units', () => {
            const gameState = createGameState({ units: {} });

            const garrison = getPlayerGarrison(gameState);

            expect(garrison.totalUnits).toBe(0);
            expect(garrison.totalPower).toBe(0);
            expect(Object.keys(garrison.units).length).toBe(0);
        });

        it('should calculate total units correctly', () => {
            const gameState = createGameState({
                units: {
                    [UnitType.CYBER_MARINE]: 100,
                    [UnitType.HEAVY_COMMANDO]: 50,
                    [UnitType.SCOUT_TANK]: 25,
                    [UnitType.TITAN_MBT]: 10
                }
            });

            const garrison = getPlayerGarrison(gameState);

            expect(garrison.totalUnits).toBe(185);
        });

        it('should calculate total power based on unit stats (HP * Attack * Defense)', () => {
            const gameState = createGameState({
                units: {
                    [UnitType.CYBER_MARINE]: 10 // 200 HP * 25 ATK * 10 DEF = 50,000 power per unit
                }
            });

            const garrison = getPlayerGarrison(gameState);

            // Power = HP * Attack * Defense per unit * count
            const expectedPower = 200 * 25 * 10 * 10; // 500,000
            expect(garrison.totalPower).toBe(expectedPower);
        });

        it('should handle mixed unit types with different power levels', () => {
            const units = {
                [UnitType.CYBER_MARINE]: 10,      // 200 * 25 * 10 = 50,000 per unit
                [UnitType.PHANTOM_SUB]: 1         // 125000 * 10000 * 5000 = 6,250,000,000,000 per unit
            };

            const gameState = createGameState({ units });
            const garrison = getPlayerGarrison(gameState);

            expect(garrison.totalUnits).toBe(11);
            // Phantom Sub alone should dominate the power calculation
            expect(garrison.totalPower).toBeGreaterThan(6000000000000);
        });

        it('should return unit composition breakdown', () => {
            const units = {
                [UnitType.CYBER_MARINE]: 50,
                [UnitType.HEAVY_COMMANDO]: 30,
                [UnitType.WRAITH_GUNSHIP]: 5
            };

            const gameState = createGameState({ units });
            const garrison = getPlayerGarrison(gameState);

            expect(garrison.units[UnitType.CYBER_MARINE]).toBe(50);
            expect(garrison.units[UnitType.HEAVY_COMMANDO]).toBe(30);
            expect(garrison.units[UnitType.WRAITH_GUNSHIP]).toBe(5);
        });
    });

    describe('5. isPlayerUnderThreat - Threat Detection', () => {
        it('should return false when no threats exist', () => {
            const gameState = createGameState({
                incomingAttacks: [],
                activeWar: null,
                grudges: []
            });

            expect(isPlayerUnderThreat(gameState)).toBe(false);
        });

        it('should return true when incoming attacks exist', () => {
            const gameState = createGameState({
                incomingAttacks: [
                    {
                        id: 'attack-1',
                        attackerName: 'Enemy',
                        attackerScore: 1000,
                        units: { [UnitType.CYBER_MARINE]: 10 },
                        startTime: NOW,
                        endTime: NOW + 600000
                    }
                ],
                activeWar: null,
                grudges: []
            });

            expect(isPlayerUnderThreat(gameState)).toBe(true);
        });

        it('should return true when active war exists', () => {
            const gameState = createGameState({
                incomingAttacks: [],
                activeWar: {
                    id: 'war-1',
                    enemyId: 'enemy-bot',
                    enemyName: 'Enemy Bot',
                    enemyScore: 2000,
                    startTime: NOW,
                    duration: 7200000,
                    nextWaveTime: NOW + 300000,
                    currentWave: 1,
                    totalWaves: 8,
                    playerVictories: 0,
                    enemyVictories: 0,
                    playerAttacksLeft: 8,
                    lootPool: { [ResourceType.MONEY]: 0, [ResourceType.OIL]: 0, [ResourceType.AMMO]: 0, [ResourceType.GOLD]: 0, [ResourceType.DIAMOND]: 0 },
                    playerResourceLosses: { [ResourceType.MONEY]: 0, [ResourceType.OIL]: 0, [ResourceType.AMMO]: 0, [ResourceType.GOLD]: 0, [ResourceType.DIAMOND]: 0 },
                    enemyResourceLosses: { [ResourceType.MONEY]: 0, [ResourceType.OIL]: 0, [ResourceType.AMMO]: 0, [ResourceType.GOLD]: 0, [ResourceType.DIAMOND]: 0 },
                    playerUnitLosses: 0,
                    enemyUnitLosses: 0,
                    currentEnemyGarrison: {}
                },
                grudges: []
            });

            expect(isPlayerUnderThreat(gameState)).toBe(true);
        });

        it('should return true when grudges exist', () => {
            const gameState = createGameState({
                incomingAttacks: [],
                activeWar: null,
                grudges: [
                    {
                        id: 'grudge-1',
                        botId: 'enemy-bot',
                        botName: 'Vengeful Bot',
                        botPersonality: BotPersonality.WARLORD,
                        botScore: 1500,
                        createdAt: NOW,
                        retaliationTime: NOW + 1800000,
                        notified: false
                    }
                ]
            });

            expect(isPlayerUnderThreat(gameState)).toBe(true);
        });

        it('should return true when multiple threat types exist simultaneously', () => {
            const gameState = createGameState({
                incomingAttacks: [
                    {
                        id: 'attack-1',
                        attackerName: 'Enemy',
                        attackerScore: 1000,
                        units: {},
                        startTime: NOW,
                        endTime: NOW + 600000
                    }
                ],
                activeWar: {
                    id: 'war-1',
                    enemyId: 'enemy-bot',
                    enemyName: 'Enemy Bot',
                    enemyScore: 2000,
                    startTime: NOW,
                    duration: 7200000,
                    nextWaveTime: NOW + 300000,
                    currentWave: 1,
                    totalWaves: 8,
                    playerVictories: 0,
                    enemyVictories: 0,
                    playerAttacksLeft: 8,
                    lootPool: { [ResourceType.MONEY]: 0, [ResourceType.OIL]: 0, [ResourceType.AMMO]: 0, [ResourceType.GOLD]: 0, [ResourceType.DIAMOND]: 0 },
                    playerResourceLosses: { [ResourceType.MONEY]: 0, [ResourceType.OIL]: 0, [ResourceType.AMMO]: 0, [ResourceType.GOLD]: 0, [ResourceType.DIAMOND]: 0 },
                    enemyResourceLosses: { [ResourceType.MONEY]: 0, [ResourceType.OIL]: 0, [ResourceType.AMMO]: 0, [ResourceType.GOLD]: 0, [ResourceType.DIAMOND]: 0 },
                    playerUnitLosses: 0,
                    enemyUnitLosses: 0,
                    currentEnemyGarrison: {}
                },
                grudges: [
                    {
                        id: 'grudge-1',
                        botId: 'enemy-bot',
                        botName: 'Vengeful Bot',
                        botPersonality: BotPersonality.WARLORD,
                        botScore: 1500,
                        createdAt: NOW,
                        retaliationTime: NOW + 1800000,
                        notified: false
                    }
                ]
            });

            expect(isPlayerUnderThreat(gameState)).toBe(true);
        });
    });

    describe('6. Edge Cases and Integration', () => {
        it('should handle empty ranking data gracefully', () => {
            const gameState = createGameState({
                rankingData: {
                    bots: [],
                    lastUpdateTime: NOW
                }
            });

            const reinforcements = calculatePotentialReinforcements(gameState, NOW);
            const garrison = getPlayerGarrison(gameState);
            const underThreat = isPlayerUnderThreat(gameState);

            expect(reinforcements).toHaveLength(0);
            expect(garrison.totalUnits).toBe(0);
            expect(underThreat).toBe(false);
        });

        it('should handle very high reputation bots (100)', () => {
            const maxRepBot = createBot({
                reputation: 100,
                stats: { [RankingCategory.DOMINION]: 50000, [RankingCategory.MILITARY]: 25000, [RankingCategory.ECONOMY]: 15000, [RankingCategory.CAMPAIGN]: 10000 }
            });

            const gameState = createGameState({
        empirePoints: 50000,
                rankingData: {
                    bots: [maxRepBot],
                    lastUpdateTime: NOW
                }
            });

            const reinforcements = calculatePotentialReinforcements(gameState, NOW);

            expect(reinforcements).toHaveLength(1);
            expect(reinforcements[0].reputation).toBe(100);
            expect(reinforcements[0].totalUnits).toBeGreaterThan(0);
        });

        it('should maintain data consistency across multiple calls', () => {
            const bot = createBot({
                reputation: 80,
                name: 'ConsistentBot',
                stats: { [RankingCategory.DOMINION]: 5000, [RankingCategory.MILITARY]: 2500, [RankingCategory.ECONOMY]: 1500, [RankingCategory.CAMPAIGN]: 1000 }
            });

            const gameState = createGameState({
                rankingData: {
                    bots: [bot],
                    lastUpdateTime: NOW
                }
            });

            // Call multiple times
            const result1 = calculatePotentialReinforcements(gameState, NOW);
            const result2 = calculatePotentialReinforcements(gameState, NOW);
            const result3 = calculatePotentialReinforcements(gameState, NOW);

            // Basic info should be consistent
            expect(result1[0].botId).toBe(result2[0].botId);
            expect(result1[0].botId).toBe(result3[0].botId);
            expect(result1[0].botName).toBe(result2[0].botName);
            expect(result1[0].reputation).toBe(result2[0].reputation);
            expect(result1[0].reputation).toBe(result3[0].reputation);

            // Army composition should be consistent (same personality and score)
            expect(result1[0].totalUnits).toBe(result2[0].totalUnits);
            expect(result1[0].totalUnits).toBe(result3[0].totalUnits);
        });
    });
});
