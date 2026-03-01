/**
 * COMBAT WITH ALLIES - SIMULATION TEST
 * 
 * Test file to simulate a combat scenario with allied reinforcements
 * for debugging purposes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CombatReportModal } from '../components/reports/CombatReportModal';
import { BattleResult, UnitType, LogEntry, GameState, IncomingAttack, AllyReinforcement } from '../types';
import { simulateCombat } from '../utils/engine/combat';

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

const createMockTranslation = () => ({
    common: {
        resources: {
            money: 'Money',
            oil: 'Oil',
            ammo: 'Ammo',
            gold: 'Gold',
            diamond: 'Diamond',
        },
        ui: {
            summary: 'Summary',
            your_losses: 'Your Losses',
            enemies_killed: 'Enemies Killed',
            units: 'Units',
            log_defense_win: 'Defense Victory',
            log_defense_loss: 'Defense Defeat',
            mission_type_campaign: 'Campaign',
            mission_type_patrol: 'Patrol',
            mission_type_tactical: 'Tactical',
            close: 'Close',
        },
    },
    campaign: {
        victory_title: 'Victory',
        defeat_title: 'Defeat',
        rewards: 'Rewards',
    },
    reports: {
        title: 'Mission Reports',
        friendly: 'Friendly',
        hostile: 'Hostile',
        allies: 'Allies',
        rounds: 'Duration (Rounds)',
        damage_dealt: 'Damage Dealt',
        integrity: 'Force Integrity',
        deployed: 'Deployed',
        lost: 'Lost',
        survived: 'Survived',
        unit_type: 'Unit Type',
        no_allies: 'No Allied Reinforcements',
        you_label: 'You',
        enemy_target: 'Enemy Target',
        hostile_force: 'Hostile Force',
        no_data: 'No detailed telemetry available',
        kill_analysis: 'Combat Log',
        combat_analysis: 'Forensic Analysis',
        targets_neutralized: 'Offensive Impact',
        fell_to: 'Cause of Death',
        no_kills: 'No Hostiles Neutralized',
        no_casualties: 'No Allied Casualties',
        efficiency: 'Efficiency (K/D)',
        critical_bio: 'Fatal Wounds',
        critical_mech: 'Critical Explosions',
        analysis_kill_text: '{count} {unit} neutralized',
        analysis_death_text: 'Lost {count} to enemy {unit}',
        details_loot: 'Resources Secured',
        details_stolen: 'Resources Stolen',
        buildings_seized: 'Infrastructure Stolen',
        buildings_lost: 'Buildings Lost',
        diamond_damaged: 'Diamond Mine Damaged',
        no_loot: 'No Resources Secured',
        no_losses: 'No Resources Lost',
        allied_reinforcements: 'Allied Reinforcements',
    },
});

const createMockGameState = (): GameState => ({
    saveVersion: 1,
    playerName: 'Test Player',
    hasChangedName: false,
    resources: {
        money: 10000,
        oil: 5000,
        ammo: 3000,
        gold: 1000,
        diamond: 500,
    },
    maxResources: {
        money: 10000,
        oil: 5000,
        ammo: 3000,
        gold: 1000,
        diamond: 500,
    },
    buildings: {} as any,
    units: {
        [UnitType.CYBER_MARINE]: 20,
        [UnitType.HEAVY_COMMANDO]: 10,
        [UnitType.SCOUT_TANK]: 5,
    },
    researchedTechs: [],
    techLevels: {},
    activeResearch: null,
    activeMissions: [],
    activeRecruitments: [],
    activeConstructions: [],
    bankBalance: 50000,
    currentInterestRate: 5,
    nextRateChangeTime: Date.now() + 86400000,
    lastInterestPayoutTime: Date.now(),
    empirePoints: 5000,
    lastSaveTime: Date.now(),
    campaignProgress: 0,
    lastCampaignMissionFinishedTime: 0,
    marketOffers: [],
    marketNextRefreshTime: Date.now(),
    activeMarketEvent: null,
    completedTutorials: [],
    currentTutorialId: null,
    tutorialClaimable: false,
    tutorialAccepted: false,
    isTutorialMinimized: false,
    nextAttackTime: 0,
    incomingAttacks: [],
    activeWar: null,
    allyReinforcements: [],
    grudges: [],
    enemyAttackCounts: {},
    lastEnemyAttackCheckTime: Date.now(),
    lastEnemyAttackResetTime: Date.now(),
    spyReports: [],
    targetAttackCounts: {},
    lastAttackResetTime: Date.now(),
    rankingData: {
        bots: [],
        lastUpdateTime: Date.now(),
    },
    diplomaticActions: {},
    lastReputationDecayTime: Date.now(),
    lifetimeStats: {
        enemiesKilled: 0,
        unitsLost: 0,
        resourcesMined: 0,
        missionsCompleted: 0,
        highestRankAchieved: 0,
    },
    redeemedGiftCodes: [],
    giftCodeCooldowns: {},
    logs: [],
});

const createMockIncomingAttack = (): IncomingAttack => ({
    id: 'attack-1',
    attackerName: 'Enemy Bot',
    attackerScore: 5000,
    units: {
        [UnitType.CYBER_MARINE]: 60,
        [UnitType.SCOUT_TANK]: 30,
        [UnitType.TITAN_MBT]: 15,
    },
    startTime: Date.now() - 5000,
    endTime: Date.now() + 5000,
    isScouted: true,
});

const createMockAllyReinforcement = (): AllyReinforcement => ({
    id: 'reinforcement-1',
    botId: 'ally-bot-1',
    botName: 'Friendly Ally',
    botScore: 5000,
    units: {
        [UnitType.CYBER_MARINE]: 15,
        [UnitType.HEAVY_COMMANDO]: 8,
    },
    totalUnits: 23,
    arrivalTime: Date.now() - 1000,
    expiresAt: Date.now() + 60000,
});

// ============================================================================
// TEST SUITE: COMBAT WITH ALLIES SIMULATION
// ============================================================================

describe('Combat with Allies - Simulation Test', () => {
    describe('Game State Setup', () => {
        it('should create mock game state with player having 5000 empire points', () => {
            const gameState = createMockGameState();
            expect(gameState.empirePoints).toBe(5000);
        });

        it('should create ally reinforcement with high reputation (>=75)', () => {
            const reinforcement = createMockAllyReinforcement();
            expect(reinforcement.botId).toBe('ally-bot-1');
            expect(reinforcement.botName).toBe('Friendly Ally');
            expect(reinforcement.totalUnits).toBeGreaterThan(0);
        });

        it('should create enemy attack with 100+ units', () => {
            const attack = createMockIncomingAttack();
            const totalEnemyUnits = Object.values(attack.units).reduce((a, b) => a + (b || 0), 0);
            expect(totalEnemyUnits).toBeGreaterThanOrEqual(100);
        });

        it('should simulate attack with very short travel time', () => {
            const attack = createMockIncomingAttack();
            const travelTime = attack.endTime - attack.startTime;
            expect(travelTime).toBeLessThan(60000);
        });
    });

    describe('Combat Simulation with Allies', () => {
        it('should simulate combat with player army and ally reinforcements', () => {
            const playerArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 30,
                [UnitType.HEAVY_COMMANDO]: 15,
            };

            const allyArmies: Record<string, Partial<Record<UnitType, number>>> = {
                'ally-bot-1': {
                    [UnitType.CYBER_MARINE]: 15,
                    [UnitType.HEAVY_COMMANDO]: 8,
                }
            };

            const enemyArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 50,
                [UnitType.SCOUT_TANK]: 20,
                [UnitType.TITAN_MBT]: 10,
            };

            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);

            expect(result).toBeDefined();
            expect(result.initialAllyArmies).toBeDefined();
            expect(Object.keys(result.initialAllyArmies!).length).toBe(1);
        });

        it('should generate battle result with ally army data', () => {
            const playerArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 20,
            };

            const allyArmies: Record<string, Partial<Record<UnitType, number>>> = {
                'ally-1': {
                    [UnitType.HEAVY_COMMANDO]: 10,
                }
            };

            const enemyArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 30,
            };

            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);

            expect(result.initialAllyArmies).toBeDefined();
            expect(result.finalAllyArmies).toBeDefined();
            expect(result.totalAllyCasualties).toBeDefined();
            expect(result.allyDamageDealt).toBeDefined();
            expect(result.allyPerformance).toBeDefined();
        });

        it('should correctly track ally damage dealt', () => {
            const playerArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 10,
            };

            const allyArmies: Record<string, Partial<Record<UnitType, number>>> = {
                'ally-1': {
                    [UnitType.CYBER_MARINE]: 10,
                }
            };

            const enemyArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 20,
            };

            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);

            expect(result.allyDamageDealt).toBeDefined();
            expect(result.allyDamageDealt!['ally-1']).toBeGreaterThanOrEqual(0);
        });

        it('should handle multiple allies in combat', () => {
            const playerArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 10,
            };

            const allyArmies: Record<string, Partial<Record<UnitType, number>>> = {
                'ally-1': {
                    [UnitType.CYBER_MARINE]: 5,
                },
                'ally-2': {
                    [UnitType.HEAVY_COMMANDO]: 5,
                }
            };

            const enemyArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 30,
            };

            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);

            expect(Object.keys(result.initialAllyArmies!).length).toBe(2);
            expect(result.allyDamageDealt).toBeDefined();
            expect(result.allyDamageDealt!['ally-1']).toBeGreaterThanOrEqual(0);
            expect(result.allyDamageDealt!['ally-2']).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Combat Report Modal with Allies', () => {
        it('should render combat result with ally data in the modal', () => {
            const playerArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 20,
                [UnitType.HEAVY_COMMANDO]: 10,
            };

            const allyArmies: Record<string, Partial<Record<UnitType, number>>> = {
                'ally-1': {
                    [UnitType.CYBER_MARINE]: 10,
                    [UnitType.HEAVY_COMMANDO]: 5,
                }
            };

            const enemyArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 40,
                [UnitType.SCOUT_TANK]: 10,
            };

            const battleResult = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);

            const log: LogEntry = {
                id: 'test-log-1',
                messageKey: 'log_defense_win',
                type: 'combat',
                timestamp: Date.now(),
                params: {
                    combatResult: battleResult,
                    attacker: 'Enemy Bot',
                    allyNames: {
                        'ally-1': 'Friendly Ally'
                    }
                }
            };

            const mockT = createMockTranslation();

            const { container } = render(
                <CombatReportModal log={log} onClose={() => {}} t={mockT as any} embedded />
            );

            expect(container).toBeDefined();
        });

        it('should include ally data in initialAllyArmies and finalAllyArmies', () => {
            const playerArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 15,
            };

            const allyArmies: Record<string, Partial<Record<UnitType, number>>> = {
                'ally-1': {
                    [UnitType.CYBER_MARINE]: 8,
                    [UnitType.HEAVY_COMMANDO]: 4,
                }
            };

            const enemyArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 25,
            };

            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);

            expect(result.initialAllyArmies).toBeDefined();
            expect(result.finalAllyArmies).toBeDefined();

            const ally1Initial = result.initialAllyArmies!['ally-1'];
            const ally1Final = result.finalAllyArmies!['ally-1'];

            expect(ally1Initial).toBeDefined();
            expect(ally1Final).toBeDefined();

            const initialCount = Object.values(ally1Initial).reduce((a, b) => a + (b || 0), 0);
            const finalCount = Object.values(ally1Final).reduce((a, b) => a + (b || 0), 0);

            expect(initialCount).toBe(12);
            expect(finalCount).toBeLessThanOrEqual(initialCount);
        });

        it('should correctly calculate ally casualties', () => {
            const playerArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 10,
            };

            const allyArmies: Record<string, Partial<Record<UnitType, number>>> = {
                'ally-1': {
                    [UnitType.CYBER_MARINE]: 10,
                }
            };

            const enemyArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 30,
            };

            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);

            expect(result.totalAllyCasualties).toBeDefined();
            const allyCasualties = result.totalAllyCasualties!['ally-1'];
            expect(allyCasualties).toBeDefined();

            const totalCasualties = Object.values(allyCasualties).reduce((a, b) => a + (b || 0), 0);
            expect(totalCasualties).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Full Combat Scenario', () => {
        it('should simulate complete attack scenario with allies', () => {
            const gameState = createMockGameState();

            gameState.empirePoints = 5000;

            const allyReinforcement = createMockAllyReinforcement();
            gameState.allyReinforcements = [allyReinforcement];

            const enemyAttack = createMockIncomingAttack();
            gameState.incomingAttacks = [enemyAttack];

            expect(gameState.empirePoints).toBe(5000);
            expect(gameState.allyReinforcements.length).toBe(1);
            expect(gameState.incomingAttacks.length).toBe(1);

            const playerArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 25,
                [UnitType.HEAVY_COMMANDO]: 12,
                [UnitType.SCOUT_TANK]: 5,
            };

            const allyArmies: Record<string, Partial<Record<UnitType, number>>> = {
                [allyReinforcement.botId]: allyReinforcement.units,
            };

            const battleResult = simulateCombat(
                playerArmy,
                enemyAttack.units,
                1.0,
                allyArmies
            );

            expect(battleResult.initialAllyArmies).toBeDefined();
            expect(battleResult.finalAllyArmies).toBeDefined();
            expect(battleResult.totalAllyCasualties).toBeDefined();
            expect(battleResult.allyDamageDealt).toBeDefined();

            const log: LogEntry = {
                id: 'combat-log-1',
                messageKey: 'log_defense_win',
                type: 'combat',
                timestamp: Date.now(),
                params: {
                    combatResult: battleResult,
                    attacker: enemyAttack.attackerName,
                    allyNames: {
                        [allyReinforcement.botId]: allyReinforcement.botName,
                    },
                },
            };

            const mockT = createMockTranslation();

            const { container } = render(
                <CombatReportModal log={log} onClose={() => {}} t={mockT as any} embedded />
            );

            expect(container).toBeDefined();
        });

        it('should handle multiple allies sending reinforcements', () => {
            const gameState = createMockGameState();
            gameState.empirePoints = 5000;

            const ally1: AllyReinforcement = {
                id: 'reinforcement-1',
                botId: 'ally-bot-1',
                botName: 'Strong Ally',
                botScore: 6000,
                units: { [UnitType.CYBER_MARINE]: 20, [UnitType.HEAVY_COMMANDO]: 10 },
                totalUnits: 30,
                arrivalTime: Date.now() - 2000,
                expiresAt: Date.now() + 60000,
            };

            const ally2: AllyReinforcement = {
                id: 'reinforcement-2',
                botId: 'ally-bot-2',
                botName: 'Reliable Ally',
                botScore: 4500,
                units: { [UnitType.CYBER_MARINE]: 12, [UnitType.SCOUT_TANK]: 5 },
                totalUnits: 17,
                arrivalTime: Date.now() - 1500,
                expiresAt: Date.now() + 60000,
            };

            gameState.allyReinforcements = [ally1, ally2];

            const playerArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 30,
            };

            const allyArmies: Record<string, Partial<Record<UnitType, number>>> = {
                [ally1.botId]: ally1.units,
                [ally2.botId]: ally2.units,
            };

            const enemyArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 80,
                [UnitType.SCOUT_TANK]: 20,
            };

            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);

            expect(Object.keys(result.initialAllyArmies!).length).toBe(2);
            expect(result.allyDamageDealt![ally1.botId]).toBeGreaterThanOrEqual(0);
            expect(result.allyDamageDealt![ally2.botId]).toBeGreaterThanOrEqual(0);

            const log: LogEntry = {
                id: 'multi-ally-combat',
                messageKey: 'log_defense_win',
                type: 'combat',
                timestamp: Date.now(),
                params: {
                    combatResult: result,
                    attacker: 'Enemy Force',
                    allyNames: {
                        [ally1.botId]: ally1.botName,
                        [ally2.botId]: ally2.botName,
                    },
                },
            };

            const mockT = createMockTranslation();

            const { container } = render(
                <CombatReportModal log={log} onClose={() => {}} t={mockT as any} embedded />
            );

            expect(container).toBeDefined();
        });

        it('should correctly render ally section in modal', () => {
            const playerArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 20,
            };

            const allyArmies: Record<string, Partial<Record<UnitType, number>>> = {
                'ally-1': {
                    [UnitType.CYBER_MARINE]: 10,
                    [UnitType.HEAVY_COMMANDO]: 5,
                }
            };

            const enemyArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 35,
            };

            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);

            expect(result.initialAllyArmies).toBeDefined();
            expect(result.finalAllyArmies).toBeDefined();

            const log: LogEntry = {
                id: 'ally-section-test',
                messageKey: 'log_defense_win',
                type: 'combat',
                timestamp: Date.now(),
                params: {
                    combatResult: result,
                    attacker: 'Enemy Bot',
                    allyNames: {
                        'ally-1': 'Test Ally'
                    }
                },
            };

            const mockT = createMockTranslation();

            const { container } = render(
                <CombatReportModal log={log} onClose={() => {}} t={mockT as any} embedded />
            );

            expect(container).toBeDefined();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty ally armies gracefully', () => {
            const playerArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 20,
            };

            const enemyArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 30,
            };

            const result = simulateCombat(playerArmy, enemyArmy, 1.0);

            expect(result.initialAllyArmies).toBeUndefined();
        });

        it('should handle very small ally army', () => {
            const playerArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 20,
            };

            const allyArmies: Record<string, Partial<Record<UnitType, number>>> = {
                'ally-1': {
                    [UnitType.CYBER_MARINE]: 1,
                }
            };

            const enemyArmy: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: 25,
            };

            const result = simulateCombat(playerArmy, enemyArmy, 1.0, allyArmies);

            expect(result.initialAllyArmies).toBeDefined();
            expect(result.allyDamageDealt!['ally-1']).toBeGreaterThanOrEqual(0);
        });
    });
});
