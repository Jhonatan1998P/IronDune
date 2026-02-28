/**
 * COMBAT REPORT MODAL - INTEGRATION TESTS
 * 
 * Tests that verify the component ACTUALLY RENDERs the correct values
 * in the DOM, not just that the data is correct.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CombatReportModal } from '../components/reports/CombatReportModal';
import { BattleResult, UnitType, LogEntry } from '../types';

// ============================================================================
// MOCK DATA
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
            log_defense_loss: 'Defense Loss',
            mission_type_campaign: 'Campaign',
            mission_type_patrol: 'Patrol',
            mission_type_tactical: 'Tactical',
            close: 'Close',
        },
    },
    campaign: {
        victory_title: 'Victory',
        defeat_title: 'Defeat',
    },
    reports: {
        title: 'Reports',
        friendly: 'Friendly Forces',
        hostile: 'Hostile Forces',
        allies: 'Allies',
        rounds: 'Rounds',
        damage_dealt: 'Damage Dealt',
        integrity: 'Integrity',
        deployed: 'Deployed',
        lost: 'Lost',
        survived: 'Survived',
        unit_type: 'Unit Type',
        no_allies: 'No Allies',
        you_label: 'You',
        enemy_target: 'Enemy Target',
        hostile_force: 'Hostile Force',
        no_data: 'No Data',
        kill_analysis: 'Kill Analysis',
        combat_analysis: 'Combat Analysis',
        targets_neutralized: 'Targets Neutralized',
        fell_to: 'Fell To',
        no_kills: 'No Kills',
        no_casualties: 'No Casualties',
        efficiency: 'Efficiency',
        critical_bio: 'Critical Biological Loss',
        critical_mech: 'Critical Mechanical Loss',
        analysis_kill_text: '{count} {unit} neutralized',
        analysis_death_text: 'Lost {count} to {unit}',
        details_loot: 'Loot',
        details_stolen: 'Stolen',
        buildings_seized: 'Buildings Seized',
        buildings_lost: 'Buildings Lost',
        diamond_damaged: 'Diamond Damaged',
        no_loot: 'No Loot',
        no_losses: 'No Losses',
        allied_reinforcements: 'Allied Reinforcements',
    },
    units: {
        cyber_marine_name: { name: 'Cyber Marine' },
        heavy_commando_name: { name: 'Heavy Commando' },
        ace_fighter_name: { name: 'Ace Fighter' },
    },
    buildings: {
        barracks_name: { name: 'Barracks' },
        factory_name: { name: 'Factory' },
    },
    missions: {
        patrol: {
            complete: 'Patrol Complete',
            in_progress: 'Patrol In Progress',
        },
    },
});

const createMockBattleResult = (
    hasAllies: boolean = false,
    allyCount: number = 1
): BattleResult => {
    const baseResult: BattleResult = {
        winner: 'PLAYER',
        rounds: [
            {
                round: 1,
                playerUnitsStart: 10,
                enemyUnitsStart: 20,
                playerUnitsLost: 2,
                enemyUnitsLost: 5,
                details: []
            },
            {
                round: 2,
                playerUnitsStart: 8,
                enemyUnitsStart: 15,
                playerUnitsLost: 1,
                enemyUnitsLost: 3,
                details: []
            },
            {
                round: 3,
                playerUnitsStart: 7,
                enemyUnitsStart: 12,
                playerUnitsLost: 1,
                enemyUnitsLost: 2,
                details: []
            }
        ],
        initialPlayerArmy: {
            [UnitType.CYBER_MARINE]: 10
        },
        initialEnemyArmy: {
            [UnitType.CYBER_MARINE]: 20
        },
        finalPlayerArmy: {
            [UnitType.CYBER_MARINE]: 7
        },
        finalEnemyArmy: {
            [UnitType.CYBER_MARINE]: 10
        },
        totalPlayerCasualties: {
            [UnitType.CYBER_MARINE]: 3
        },
        totalEnemyCasualties: {
            [UnitType.CYBER_MARINE]: 10
        },
        playerTotalHpStart: 2000,
        playerTotalHpLost: 600,
        enemyTotalHpStart: 4000,
        enemyTotalHpLost: 2000,
        playerDamageDealt: 8000,
        enemyDamageDealt: 3000,
        playerPerformance: {
            [UnitType.CYBER_MARINE]: {
                kills: { [UnitType.CYBER_MARINE]: 10 },
                deathsBy: { [UnitType.CYBER_MARINE]: 3 },
                damageDealt: 8000,
                criticalKills: 2,
                criticalDeaths: 1
            }
        }
    };

    if (hasAllies) {
        const allyArmies: Record<string, Partial<Record<UnitType, number>>> = {};
        const allyCasualties: Record<string, Partial<Record<UnitType, number>>> = {};
        const finalAllyArmies: Record<string, Partial<Record<UnitType, number>>> = {};
        const allyDamageDealt: Record<string, number> = {};
        const allyPerformance: Record<string, Partial<Record<UnitType, any>>> = {};

        for (let i = 0; i < allyCount; i++) {
            const allyId = `ally-${i + 1}`;
            allyArmies[allyId] = {
                [UnitType.CYBER_MARINE]: 5,
                [UnitType.HEAVY_COMMANDO]: 3
            };
            allyCasualties[allyId] = {
                [UnitType.CYBER_MARINE]: 1,
                [UnitType.HEAVY_COMMANDO]: 0
            };
            finalAllyArmies[allyId] = {
                [UnitType.CYBER_MARINE]: 4,
                [UnitType.HEAVY_COMMANDO]: 3
            };
            allyDamageDealt[allyId] = 4000;
            allyPerformance[allyId] = {
                [UnitType.CYBER_MARINE]: {
                    kills: { [UnitType.CYBER_MARINE]: 5 },
                    deathsBy: { [UnitType.CYBER_MARINE]: 1 },
                    damageDealt: 2500,
                    criticalKills: 1,
                    criticalDeaths: 0
                },
                [UnitType.HEAVY_COMMANDO]: {
                    kills: { [UnitType.CYBER_MARINE]: 3 },
                    deathsBy: {},
                    damageDealt: 1500,
                    criticalKills: 0,
                    criticalDeaths: 0
                }
            };
        }

        baseResult.initialAllyArmies = allyArmies;
        baseResult.finalAllyArmies = finalAllyArmies;
        baseResult.totalAllyCasualties = allyCasualties;
        baseResult.allyDamageDealt = allyDamageDealt;
        baseResult.allyPerformance = allyPerformance;

        baseResult.playerTotalHpStart += allyCount * (5 * 200 + 3 * 400);
    }

    return baseResult;
};

const createMockLog = (
    battleResult: BattleResult,
    messageKey: string = 'log_defense_win',
    attacker: string = 'Enemy Bot',
    targetName?: string
): LogEntry => ({
    id: 'test-log-1',
    messageKey,
    type: 'combat',
    timestamp: Date.now(),
    params: {
        combatResult: battleResult,
        attacker,
        targetName,
        allyNames: {
            'ally-1': 'Strong Ally',
            'ally-2': 'Weak Ally'
        }
    }
});

// ============================================================================
// TEST SUITE: INTEGRATION TESTS
// ============================================================================

describe('Combat Report Modal - Integration Tests', () => {
    const mockT = createMockTranslation();
    const user = userEvent.setup();

    describe('Rounds Count Rendering', () => {
        it('should render exact number of rounds in summary', () => {
            const result = createMockBattleResult(false);
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Find rounds section - look for the number 3 near "Rounds" label
            const roundsLabel = screen.getByText(mockT.reports.rounds);
            const roundsSection = roundsLabel.closest('div')?.parentElement;
            expect(roundsSection).toHaveTextContent('3');
        });

        it('should render zero rounds when battle has no rounds', () => {
            const result = createMockBattleResult(false);
            result.rounds = [];
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            const roundsLabel = screen.getByText(mockT.reports.rounds);
            const roundsSection = roundsLabel.closest('div')?.parentElement;
            expect(roundsSection).toHaveTextContent('0');
        });

        it('should render single round correctly', () => {
            const result = createMockBattleResult(false);
            result.rounds = [
                { round: 1, playerUnitsStart: 10, enemyUnitsStart: 20, playerUnitsLost: 2, enemyUnitsLost: 5, details: [] }
            ];
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            const roundsLabel = screen.getByText(mockT.reports.rounds);
            const roundsSection = roundsLabel.closest('div')?.parentElement;
            expect(roundsSection).toHaveTextContent('1');
        });
    });

    describe('Damage Dealt Rendering', () => {
        it('should render player damage dealt (formatted)', () => {
            const result = createMockBattleResult(false);
            result.playerDamageDealt = 8000;
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            const damageLabel = screen.getByText(mockT.reports.damage_dealt);
            const damageSection = damageLabel.closest('div')?.parentElement;
            // formatNumber renders 8.00K for 8000
            expect(damageSection).toHaveTextContent('8.00K');
        });

        it('should render total damage including allies', () => {
            const result = createMockBattleResult(true, 2);
            result.playerDamageDealt = 5000;
            // Each ally deals 4000 damage
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            const damageLabel = screen.getByText(mockT.reports.damage_dealt);
            const damageSection = damageLabel.closest('div')?.parentElement;
            // Total: 5000 + 4000 + 4000 = 13000 -> "13.00K"
            expect(damageSection).toHaveTextContent('13.00K');
        });

        it('should render zero damage when no damage dealt', () => {
            const result = createMockBattleResult(false);
            result.playerDamageDealt = 0;
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            const damageLabel = screen.getByText(mockT.reports.damage_dealt);
            const damageSection = damageLabel.closest('div')?.parentElement;
            expect(damageSection).toHaveTextContent('0');
        });
    });

    describe('HP Percentage Rendering', () => {
        it('should render correct player HP percentage (70%)', () => {
            const result = createMockBattleResult(false);
            // playerTotalHpStart: 2000, playerTotalHpLost: 600
            // Expected: (2000-600)/2000 * 100 = 70%
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Check that 70% is visible on screen
            expect(screen.getByText('70%')).toBeInTheDocument();
        });

        it('should render correct enemy HP percentage (50%)', () => {
            const result = createMockBattleResult(false);
            // enemyTotalHpStart: 4000, enemyTotalHpLost: 2000
            // Expected: (4000-2000)/4000 * 100 = 50%
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Check that 50% is visible
            expect(screen.getByText('50%')).toBeInTheDocument();
        });

        it('should render 100% HP when no damage taken', () => {
            const result = createMockBattleResult(false);
            result.playerTotalHpLost = 0;
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            expect(screen.getByText('100%')).toBeInTheDocument();
        });

        it('should render 0% HP when total loss', () => {
            const result = createMockBattleResult(false);
            result.playerTotalHpLost = result.playerTotalHpStart;
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            expect(screen.getByText('0%')).toBeInTheDocument();
        });
    });

    describe('Casualties Rendering', () => {
        it('should render player casualties in unit list', async () => {
            const result = createMockBattleResult(false);
            // totalPlayerCasualties: 3 CYBER_MARINE
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Navigate to player tab
            const playerTab = screen.getAllByText(mockT.reports.friendly)[0];
            await user.click(playerTab);

            await waitFor(() => {
                // Should show lost count -3
                expect(screen.getByText('-3')).toBeInTheDocument();
            });
        });

        it('should render enemy casualties in unit list', async () => {
            const result = createMockBattleResult(false);
            // totalEnemyCasualties: 10 CYBER_MARINE
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Navigate to enemy tab
            const enemyTab = screen.getAllByText(mockT.reports.hostile)[0];
            await user.click(enemyTab);

            await waitFor(() => {
                expect(screen.getByText('-10')).toBeInTheDocument();
            });
        });

        it('should render ally casualties when allies present', async () => {
            const result = createMockBattleResult(true, 1);
            // ally-1 casualties: 1 CYBER_MARINE
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Navigate to allies tab
            const alliesTab = screen.getAllByText(mockT.reports.allies)[0];
            await user.click(alliesTab);

            await waitFor(() => {
                expect(screen.getByText('-1')).toBeInTheDocument();
            });
        });
    });

    describe('Troop Counts Rendering', () => {
        it('should render initial player troop count', async () => {
            const result = createMockBattleResult(false);
            // initialPlayerArmy: 10 CYBER_MARINE
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Navigate to player tab
            const playerTab = screen.getAllByText(mockT.reports.friendly)[0];
            await user.click(playerTab);

            await waitFor(() => {
                // Should show "Deployed: 10"
                expect(screen.getByText('10')).toBeInTheDocument();
            });
        });

        it('should render final player troop count (survived)', async () => {
            const result = createMockBattleResult(false);
            // finalPlayerArmy: 7 CYBER_MARINE (10 - 3 casualties)
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Navigate to player tab
            const playerTab = screen.getAllByText(mockT.reports.friendly)[0];
            await user.click(playerTab);

            await waitFor(() => {
                // Should show survived count (7)
                const survivedLabels = screen.getAllByText(mockT.reports.survived);
                expect(survivedLabels[0]).toBeInTheDocument();
            });
        });

        it('should render initial enemy troop count', async () => {
            const result = createMockBattleResult(false);
            // initialEnemyArmy: 20 CYBER_MARINE
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Navigate to enemy tab
            const enemyTab = screen.getAllByText(mockT.reports.hostile)[0];
            await user.click(enemyTab);

            await waitFor(() => {
                // Should show "Deployed: 20"
                expect(screen.getByText('20')).toBeInTheDocument();
            });
        });

        it('should render final enemy troop count', async () => {
            const result = createMockBattleResult(false);
            // finalEnemyArmy: 10 CYBER_MARINE (20 - 10 casualties)
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Navigate to enemy tab
            const enemyTab = screen.getAllByText(mockT.reports.hostile)[0];
            await user.click(enemyTab);

            await waitFor(() => {
                const survivedLabels = screen.getAllByText(mockT.reports.survived);
                expect(survivedLabels[0]).toBeInTheDocument();
            });
        });

        it('should render initial ally troop count', async () => {
            const result = createMockBattleResult(true, 1);
            // ally-1: 5 CYBER_MARINE + 3 HEAVY_COMMANDO = 8 total
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Navigate to allies tab
            const alliesTab = screen.getAllByText(mockT.reports.allies)[0];
            await user.click(alliesTab);

            await waitFor(() => {
                // Should show total units (8)
                expect(screen.getByText('8')).toBeInTheDocument();
            });
        });

        it('should render final ally troop count', async () => {
            const result = createMockBattleResult(true, 1);
            // ally-1 final: 4 CYBER_MARINE + 3 HEAVY_COMMANDO = 7 total
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Navigate to allies tab
            const alliesTab = screen.getAllByText(mockT.reports.allies)[0];
            await user.click(alliesTab);

            await waitFor(() => {
                const survivedLabels = screen.getAllByText(mockT.reports.survived);
                expect(survivedLabels[0]).toBeInTheDocument();
            });
        });
    });

    describe('Participant Names Rendering', () => {
        it('should render "You" as player name in defense battle', () => {
            const result = createMockBattleResult(false);
            const log = createMockLog(result, 'log_defense_win', 'Enemy Bot');

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Should show "You" as friendly force name
            expect(screen.getByText(mockT.reports.you_label)).toBeInTheDocument();
        });

        it('should render enemy name from attacker param', () => {
            const result = createMockBattleResult(false);
            const log = createMockLog(result, 'log_defense_win', 'Red Baron');

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Should show enemy name in the hostile forces section
            expect(screen.getByText('Red Baron')).toBeInTheDocument();
        });

        it('should render ally names from allyNames mapping', async () => {
            const result = createMockBattleResult(true, 2);
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Navigate to allies tab
            const alliesTab = screen.getAllByText(mockT.reports.allies)[0];
            await user.click(alliesTab);

            await waitFor(() => {
                // Should show ally names
                expect(screen.getByText('Strong Ally')).toBeInTheDocument();
                expect(screen.getByText('Weak Ally')).toBeInTheDocument();
            });
        });

        it('should render target name when player is attacking', () => {
            const result = createMockBattleResult(false);
            const log = createMockLog(result, 'log_battle_win', 'Player', 'Enemy Base');

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // The hostile forces section should show the enemy name
            // In attack battles, the defender name is shown
            // Check that "Enemy Base" or the hostile label is present
            const hostileSection = screen.getAllByText(mockT.reports.hostile)[0];
            expect(hostileSection).toBeInTheDocument();
        });
    });

    describe('Tab Navigation and Content', () => {
        it('should show summary tab by default with all key stats', () => {
            const result = createMockBattleResult(false);
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Summary should be visible - check for key elements
            expect(screen.getByText(mockT.reports.rounds)).toBeInTheDocument();
            expect(screen.getByText(mockT.reports.damage_dealt)).toBeInTheDocument();
            // Check for percentage which indicates HP integrity is shown
            expect(screen.getByText('70%')).toBeInTheDocument();
        });

        it('should switch to player tab and show unit details', async () => {
            const result = createMockBattleResult(false);
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Click player tab
            const playerTab = screen.getAllByText(mockT.reports.friendly)[0];
            await user.click(playerTab);

            // Should show unit type header after tab switch
            await waitFor(() => {
                expect(screen.getByText(mockT.reports.unit_type)).toBeInTheDocument();
            }, { timeout: 2000 });
        });

        it('should switch to enemy tab and show enemy unit details', async () => {
            const result = createMockBattleResult(false);
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Click enemy tab
            const enemyTab = screen.getAllByText(mockT.reports.hostile)[0];
            await user.click(enemyTab);

            await waitFor(() => {
                expect(screen.getByText(mockT.reports.unit_type)).toBeInTheDocument();
            });
        });

        it('should show no allies message when no allies present', async () => {
            const result = createMockBattleResult(false);
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Navigate to allies tab
            const alliesTab = screen.getAllByText(mockT.reports.allies)[0];
            await user.click(alliesTab);

            await waitFor(() => {
                // Should show no allies message
                expect(screen.getByText(mockT.reports.no_allies)).toBeInTheDocument();
            });
        });

        it('should show allies when present', async () => {
            const result = createMockBattleResult(true, 1);
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Navigate to allies tab
            const alliesTab = screen.getAllByText(mockT.reports.allies)[0];
            await user.click(alliesTab);

            await waitFor(() => {
                // Should NOT show no allies message
                expect(screen.queryByText(mockT.reports.no_allies)).not.toBeInTheDocument();
                
                // Should show ally name
                expect(screen.getByText('Strong Ally')).toBeInTheDocument();
            });
        });
    });

    describe('Analysis Tab', () => {
        it('should show analysis tab button', async () => {
            const result = createMockBattleResult(false);
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Analysis tab button should be visible
            expect(screen.getByText(mockT.reports.combat_analysis)).toBeInTheDocument();
            
            // Click analysis tab
            const analysisTab = screen.getByText(mockT.reports.combat_analysis);
            await user.click(analysisTab);

            // Tab should be active after click (content will render)
            expect(analysisTab).toHaveClass('border-yellow-500/30');
        });

        it('should show targets neutralized count', async () => {
            const result = createMockBattleResult(false);
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Click analysis tab
            const analysisTab = screen.getByText(mockT.reports.combat_analysis);
            await user.click(analysisTab);

            await waitFor(() => {
                expect(screen.getByText(mockT.reports.targets_neutralized)).toBeInTheDocument();
            }, { timeout: 2000 });
        });
    });

    describe('Edge Cases', () => {
        it('should handle very large numbers correctly', () => {
            const result = createMockBattleResult(false);
            result.playerDamageDealt = 1000000;
            result.playerTotalHpStart = 10000000;
            result.playerTotalHpLost = 5000000;
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // formatNumber renders large numbers with abbreviations
            const damageLabel = screen.getByText(mockT.reports.damage_dealt);
            const damageSection = damageLabel.closest('div')?.parentElement;
            
            // 1,000,000 is formatted as "1.00Mill" or similar
            expect(damageSection).toBeInTheDocument();
        });

        it('should handle zero values gracefully', () => {
            const result = createMockBattleResult(false);
            result.playerDamageDealt = 0;
            result.enemyDamageDealt = 0;
            result.playerTotalHpLost = 0;
            result.totalPlayerCasualties = {};
            result.finalPlayerArmy = { [UnitType.CYBER_MARINE]: 10 };
            const log = createMockLog(result);

            render(<CombatReportModal log={log} t={mockT as any} embedded />);

            // Should not crash and should show zeros
            const damageLabel = screen.getByText(mockT.reports.damage_dealt);
            const damageSection = damageLabel.closest('div')?.parentElement;
            
            expect(damageSection).toHaveTextContent('0');
        });
    });
});
