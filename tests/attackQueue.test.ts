import { describe, it, expect, beforeEach } from 'vitest';
import { calculateOfflineProgress } from '../utils/engine/offline';
import { 
    processAttackQueue, 
    getQueuedOutgoingAttacks, 
    getQueuedIncomingAttacks 
} from '../utils/engine/attackQueue';
import { 
    GameState, 
    ActiveMission, 
    IncomingAttack, 
    QueuedAttackResult 
} from '../types';
import { UnitType, ResourceType, BuildingType } from '../types/enums';
import { INITIAL_GAME_STATE } from '../data/initialState';

const createTestState = (overrides: Partial<GameState> = {}): GameState => {
    const now = Date.now();
    return {
        ...INITIAL_GAME_STATE,
        lastSaveTime: now,
        ...overrides
    };
};

const createOutgoingMission = (
    id: string,
    startTime: number,
    endTime: number,
    type: ActiveMission['type'] = 'PVP_ATTACK'
): ActiveMission => ({
    id,
    type,
    startTime,
    endTime,
    duration: Math.floor((endTime - startTime) / 60000),
    units: { [UnitType.CYBER_MARINE]: 10 },
    targetId: 'bot-1',
    targetName: 'Test Bot',
    targetScore: 1000
});

const createIncomingAttack = (
    id: string,
    startTime: number,
    endTime: number
): IncomingAttack => ({
    id,
    attackerName: 'Enemy Commander',
    attackerScore: 1000,
    units: { [UnitType.CYBER_MARINE]: 20 },
    startTime,
    endTime
});

describe('Attack Queue System', () => {
    describe('1. Offline 45min Scenario - Incoming (15min) + Outgoing (30min)', () => {
        it('should process attacks in chronological order', () => {
            const now = Date.now();
            
            const incomingEndTime = now - (30 * 60 * 1000);
            const outgoingEndTime = now - (15 * 60 * 1000);

            const initialState = createTestState({
                lastSaveTime: now - (45 * 60 * 1000),
                incomingAttacks: [
                    createIncomingAttack('incoming-1', now - (45 * 60 * 1000), incomingEndTime)
                ],
                activeMissions: [
                    createOutgoingMission('mission-1', now - (45 * 60 * 1000), outgoingEndTime)
                ]
            });

            const { newState, report, newLogs } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(2);
            
            const sortedByTime = [...report.queuedAttackResults].sort((a, b) => a.processedAt - b.processedAt);
            expect(sortedByTime[0].type).toBe('INCOMING');
            expect(sortedByTime[1].type).toBe('OUTGOING');
            expect(sortedByTime[0].processedAt).toBeLessThan(sortedByTime[1].processedAt);

            expect(newState.incomingAttacks.length).toBe(0);
            expect(newState.activeMissions.length).toBe(0);

            expect(newLogs.length).toBeGreaterThan(0);
            const hasIncomingLog = newLogs.some(log => 
                log.messageKey === 'log_defense_win' || log.messageKey === 'log_defense_loss'
            );
            const hasOutgoingLog = newLogs.some(log => 
                log.type === 'combat' || log.type === 'mission' || log.messageKey
            );
            expect(hasIncomingLog).toBe(true);
            expect(hasOutgoingLog).toBe(true);
        });

        it('should process incoming attack BEFORE outgoing when incoming ends first', () => {
            const now = Date.now();
            
            const incomingEndTime = now - (30 * 60 * 1000);
            const outgoingEndTime = now - (15 * 60 * 1000);

            const initialState = createTestState({
                lastSaveTime: now - (45 * 60 * 1000),
                incomingAttacks: [
                    createIncomingAttack('incoming-1', now - (45 * 60 * 1000), incomingEndTime)
                ],
                activeMissions: [
                    createOutgoingMission('mission-1', now - (45 * 60 * 1000), outgoingEndTime)
                ]
            });

            const { report } = calculateOfflineProgress(initialState);

            const firstProcessed = report.queuedAttackResults[0];
            const secondProcessed = report.queuedAttackResults[1];

            expect(firstProcessed.type).toBe('INCOMING');
            expect(secondProcessed.type).toBe('OUTGOING');
            expect(firstProcessed.processedAt).toBe(incomingEndTime);
            expect(secondProcessed.processedAt).toBe(outgoingEndTime);
        });
    });

    describe('2. Same-time attacks processing order', () => {
        it('should process attacks that end at the same time in start time order', () => {
            const now = Date.now();
            const sharedEndTime = now - (15 * 60 * 1000);
            const incomingStartTime = now - (45 * 60 * 1000);
            const outgoingStartTime = now - (50 * 60 * 1000);

            const initialState = createTestState({
                lastSaveTime: now - (55 * 60 * 1000),
                incomingAttacks: [
                    createIncomingAttack('incoming-1', incomingStartTime, sharedEndTime)
                ],
                activeMissions: [
                    createOutgoingMission('mission-1', outgoingStartTime, sharedEndTime)
                ]
            });

            const { report } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(2);
            
            const firstProcessed = report.queuedAttackResults[0];
            const secondProcessed = report.queuedAttackResults[1];

            expect(firstProcessed.type).toBe('OUTGOING');
            expect(secondProcessed.type).toBe('INCOMING');
        });

        it('should handle multiple incoming attacks at same end time', () => {
            const now = Date.now();
            const sharedEndTime = now - (10 * 60 * 1000);

            const initialState = createTestState({
                lastSaveTime: now - (25 * 60 * 1000),
                incomingAttacks: [
                    createIncomingAttack('incoming-1', now - (25 * 60 * 1000), sharedEndTime),
                    createIncomingAttack('incoming-2', now - (35 * 60 * 1000), sharedEndTime),
                    createIncomingAttack('incoming-3', now - (30 * 60 * 1000), sharedEndTime)
                ]
            });

            const { newState, report } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(3);
            expect(newState.incomingAttacks.length).toBe(0);

            const firstProcessed = report.queuedAttackResults[0];
            expect(firstProcessed.type).toBe('INCOMING');
        });
    });

    describe('3. Multiple incoming attacks while offline', () => {
        it('should process multiple incoming attacks in chronological order', () => {
            const now = Date.now();
            
            const attack1End = now - (25 * 60 * 1000);
            const attack2End = now - (15 * 60 * 1000);
            const attack3End = now - (5 * 60 * 1000);

            const initialState = createTestState({
                lastSaveTime: now - (30 * 60 * 1000),
                incomingAttacks: [
                    createIncomingAttack('incoming-3', now - (30 * 60 * 1000), attack3End),
                    createIncomingAttack('incoming-1', now - (30 * 60 * 1000), attack1End),
                    createIncomingAttack('incoming-2', now - (30 * 60 * 1000), attack2End)
                ]
            });

            const { report } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(3);

            const sorted = [...report.queuedAttackResults].sort((a, b) => a.processedAt - b.processedAt);
            
            expect(sorted[0].processedAt).toBe(attack1End);
            expect(sorted[1].processedAt).toBe(attack2End);
            expect(sorted[2].processedAt).toBe(attack3End);

            expect(sorted.every(r => r.type === 'INCOMING')).toBe(true);
        });

        it('should handle unsorted incoming attacks correctly', () => {
            const now = Date.now();
            
            const attackTimes = [
                now - (20 * 60 * 1000),
                now - (35 * 60 * 1000),
                now - (5 * 60 * 1000)
            ];

            const initialState = createTestState({
                lastSaveTime: now - (40 * 60 * 1000),
                incomingAttacks: [
                    createIncomingAttack('attack-1', now - (40 * 60 * 1000), attackTimes[0]),
                    createIncomingAttack('attack-2', now - (40 * 60 * 1000), attackTimes[1]),
                    createIncomingAttack('attack-3', now - (40 * 60 * 1000), attackTimes[2])
                ]
            });

            const { report } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(3);

            const processedTimes = report.queuedAttackResults.map(r => r.processedAt).sort((a, b) => a - b);
            expect(processedTimes[0]).toBe(attackTimes[1]);
            expect(processedTimes[1]).toBe(attackTimes[0]);
            expect(processedTimes[2]).toBe(attackTimes[2]);
        });
    });

    describe('4. Multiple outgoing attacks while offline', () => {
        it('should process multiple outgoing attacks in chronological order', () => {
            const now = Date.now();
            
            const mission1End = now - (25 * 60 * 1000);
            const mission2End = now - (15 * 60 * 1000);
            const mission3End = now - (5 * 60 * 1000);

            const initialState = createTestState({
                lastSaveTime: now - (30 * 60 * 1000),
                activeMissions: [
                    createOutgoingMission('mission-3', now - (30 * 60 * 1000), mission3End),
                    createOutgoingMission('mission-1', now - (30 * 60 * 1000), mission1End),
                    createOutgoingMission('mission-2', now - (30 * 60 * 1000), mission2End)
                ]
            });

            const { report } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(3);

            const sorted = [...report.queuedAttackResults].sort((a, b) => a.processedAt - b.processedAt);
            
            expect(sorted[0].processedAt).toBe(mission1End);
            expect(sorted[1].processedAt).toBe(mission2End);
            expect(sorted[2].processedAt).toBe(mission3End);

            expect(sorted.every(r => r.type === 'OUTGOING')).toBe(true);
        });

        it('should process unsorted outgoing missions correctly', () => {
            const now = Date.now();
            
            const missionTimes = [
                now - (15 * 60 * 1000),
                now - (37 * 60 * 1000),
                now - (5 * 60 * 1000)
            ];

            const initialState = createTestState({
                lastSaveTime: now - (40 * 60 * 1000),
                activeMissions: [
                    createOutgoingMission('mission-1', now - (40 * 60 * 1000), missionTimes[0]),
                    createOutgoingMission('mission-2', now - (40 * 60 * 1000), missionTimes[1]),
                    createOutgoingMission('mission-3', now - (40 * 60 * 1000), missionTimes[2])
                ]
            });

            const { report } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(3);

            const processedTimes = report.queuedAttackResults.map(r => r.processedAt).sort((a, b) => a - b);
            expect(processedTimes[0]).toBe(missionTimes[1]);
            expect(processedTimes[1]).toBe(missionTimes[0]);
            expect(processedTimes[2]).toBe(missionTimes[2]);
        });
    });

    describe('5. Incoming attacks affect base defenses correctly', () => {
        it('should defend base with troops that remain after sending outgoing attack', () => {
            const now = Date.now();
            
            const incomingEndTime = now - (15 * 60 * 1000);
            const outgoingEndTime = now - (10 * 60 * 1000);

            const initialUnits: Record<UnitType, number> = {
                [UnitType.CYBER_MARINE]: 50,
                [UnitType.HEAVY_COMMANDO]: 0,
                [UnitType.SCOUT_TANK]: 0,
                [UnitType.TITAN_MBT]: 0,
                [UnitType.WRAITH_GUNSHIP]: 0,
                [UnitType.ACE_FIGHTER]: 0,
                [UnitType.AEGIS_DESTROYER]: 0,
                [UnitType.PHANTOM_SUB]: 0
            };

            const missionWith50Units: ActiveMission = {
                id: 'mission-1',
                type: 'PVP_ATTACK',
                startTime: now - (40 * 60 * 1000),
                endTime: outgoingEndTime,
                duration: 30,
                units: { [UnitType.CYBER_MARINE]: 50 },
                targetId: 'bot-1',
                targetName: 'Test Bot',
                targetScore: 1000
            };

            const initialState = createTestState({
                lastSaveTime: now - (45 * 60 * 1000),
                units: initialUnits,
                incomingAttacks: [
                    createIncomingAttack('incoming-1', now - (40 * 60 * 1000), incomingEndTime)
                ],
                activeMissions: [missionWith50Units]
            });

            const { report } = calculateOfflineProgress(initialState);

            const incomingResult = report.queuedAttackResults.find(r => r.type === 'INCOMING');
            expect(incomingResult).toBeDefined();
            expect(incomingResult?.result.battleResult).toBeDefined();

            const defenderPower = Object.values(incomingResult?.result.battleResult?.initialEnemyArmy || {}).reduce((sum, count) => sum + (count || 0), 0);
            expect(defenderPower).toBe(50);
        });

        it('should have weak defense when base has no troops', () => {
            const now = Date.now();
            
            const incomingEndTime = now - (15 * 60 * 1000);

            const initialUnits: Record<UnitType, number> = {
                [UnitType.CYBER_MARINE]: 0,
                [UnitType.HEAVY_COMMANDO]: 0,
                [UnitType.SCOUT_TANK]: 0,
                [UnitType.TITAN_MBT]: 0,
                [UnitType.WRAITH_GUNSHIP]: 0,
                [UnitType.ACE_FIGHTER]: 0,
                [UnitType.AEGIS_DESTROYER]: 0,
                [UnitType.PHANTOM_SUB]: 0
            };

            const weakEnemyAttack: IncomingAttack = {
                id: 'incoming-1',
                attackerName: 'Weak Enemy',
                attackerScore: 100,
                units: { [UnitType.CYBER_MARINE]: 1 },
                startTime: now - (25 * 60 * 1000),
                endTime: incomingEndTime
            };

            const initialState = createTestState({
                lastSaveTime: now - (30 * 60 * 1000),
                units: initialUnits,
                incomingAttacks: [weakEnemyAttack]
            });

            const { report } = calculateOfflineProgress(initialState);

            const incomingResult = report.queuedAttackResults.find(r => r.type === 'INCOMING');
            expect(incomingResult).toBeDefined();
            expect(incomingResult?.result.battleResult).toBeDefined();

            const defenderPower = Object.values(incomingResult?.result.battleResult?.initialEnemyArmy || {}).reduce((sum, count) => sum + (count || 0), 0);
            expect(defenderPower).toBe(0);
        });

        it('should reduce base defenses after first incoming attack, affecting second attack', () => {
            const now = Date.now();
            
            const firstAttackEnd = now - (20 * 60 * 1000);
            const secondAttackEnd = now - (10 * 60 * 1000);

            const initialUnits: Record<UnitType, number> = {
                [UnitType.CYBER_MARINE]: 30,
                [UnitType.HEAVY_COMMANDO]: 0,
                [UnitType.SCOUT_TANK]: 0,
                [UnitType.TITAN_MBT]: 0,
                [UnitType.WRAITH_GUNSHIP]: 0,
                [UnitType.ACE_FIGHTER]: 0,
                [UnitType.AEGIS_DESTROYER]: 0,
                [UnitType.PHANTOM_SUB]: 0
            };

            const enemyAttackWith20: IncomingAttack = {
                id: 'incoming-1',
                attackerName: 'Enemy Commander',
                attackerScore: 1000,
                units: { [UnitType.CYBER_MARINE]: 20 },
                startTime: now - (30 * 60 * 1000),
                endTime: firstAttackEnd
            };

            const enemyAttackWith20Second: IncomingAttack = {
                id: 'incoming-2',
                attackerName: 'Enemy Commander 2',
                attackerScore: 1000,
                units: { [UnitType.CYBER_MARINE]: 20 },
                startTime: now - (25 * 60 * 1000),
                endTime: secondAttackEnd
            };

            const initialState = createTestState({
                lastSaveTime: now - (30 * 60 * 1000),
                units: initialUnits,
                incomingAttacks: [enemyAttackWith20, enemyAttackWith20Second]
            });

            const { report } = calculateOfflineProgress(initialState);

            const firstAttack = report.queuedAttackResults.find(r => r.id === 'incoming-1');
            const secondAttack = report.queuedAttackResults.find(r => r.id === 'incoming-2');

            expect(firstAttack).toBeDefined();
            expect(secondAttack).toBeDefined();

            const firstDefenderPower = Object.values(firstAttack?.result.battleResult?.initialEnemyArmy || {}).reduce((sum, count) => sum + (count || 0), 0);
            const secondDefenderPower = Object.values(secondAttack?.result.battleResult?.initialEnemyArmy || {}).reduce((sum, count) => sum + (count || 0), 0);

            expect(firstDefenderPower).toBe(30);
            expect(secondDefenderPower).toBeLessThan(firstDefenderPower);
        });

        it('should process incoming attack before outgoing attack chronologically', () => {
            const now = Date.now();
            
            const incomingEndTime = now - (30 * 60 * 1000);
            const outgoingEndTime = now - (15 * 60 * 1000);

            const initialUnits: Record<UnitType, number> = {
                [UnitType.CYBER_MARINE]: 100,
                [UnitType.HEAVY_COMMANDO]: 0,
                [UnitType.SCOUT_TANK]: 0,
                [UnitType.TITAN_MBT]: 0,
                [UnitType.WRAITH_GUNSHIP]: 0,
                [UnitType.ACE_FIGHTER]: 0,
                [UnitType.AEGIS_DESTROYER]: 0,
                [UnitType.PHANTOM_SUB]: 0
            };

            const initialState = createTestState({
                lastSaveTime: now - (40 * 60 * 1000),
                units: initialUnits,
                incomingAttacks: [
                    createIncomingAttack('incoming-1', now - (40 * 60 * 1000), incomingEndTime)
                ],
                activeMissions: [
                    createOutgoingMission('mission-1', now - (40 * 60 * 1000), outgoingEndTime)
                ]
            });

            const { report } = calculateOfflineProgress(initialState);

            const sortedResults = [...report.queuedAttackResults].sort((a, b) => a.processedAt - b.processedAt);
            
            expect(sortedResults[0].type).toBe('INCOMING');
            expect(sortedResults[1].type).toBe('OUTGOING');
            expect(sortedResults[0].processedAt).toBe(incomingEndTime);
            expect(sortedResults[1].processedAt).toBe(outgoingEndTime);

            const defenderPower = Object.values(sortedResults[0].result.battleResult?.initialEnemyArmy || {}).reduce((sum, count) => sum + (count || 0), 0);
            expect(defenderPower).toBe(100);
        });
    });

    describe('Helper functions', () => {
        describe('getQueuedOutgoingAttacks', () => {
            it('should return only missions that have ended', () => {
                const now = Date.now();
                
                const activeMission = createOutgoingMission('active-1', now - (5 * 60 * 1000), now + (10 * 60 * 1000));
                const completedMission = createOutgoingMission('completed-1', now - (20 * 60 * 1000), now - (5 * 60 * 1000));

                const state = createTestState({
                    activeMissions: [activeMission, completedMission]
                });

                const queued = getQueuedOutgoingAttacks(state, now);
                
                expect(queued.length).toBe(1);
                expect(queued[0].id).toBe('completed-1');
            });

            it('should sort by endTime, then by startTime', () => {
                const now = Date.now();
                
                const mission1 = createOutgoingMission('m1', now - (30 * 60 * 1000), now - (10 * 60 * 1000));
                const mission2 = createOutgoingMission('m2', now - (35 * 60 * 1000), now - (10 * 60 * 1000));
                const mission3 = createOutgoingMission('m3', now - (20 * 60 * 1000), now - (5 * 60 * 1000));

                const state = createTestState({
                    activeMissions: [mission1, mission2, mission3]
                });

                const queued = getQueuedOutgoingAttacks(state, now);
                
                expect(queued.length).toBe(3);
                expect(queued[0].id).toBe('m2');
                expect(queued[1].id).toBe('m1');
                expect(queued[2].id).toBe('m3');
            });
        });

        describe('getQueuedIncomingAttacks', () => {
            it('should return only attacks that have ended', () => {
                const now = Date.now();
                
                const activeAttack = createIncomingAttack('active-1', now - (5 * 60 * 1000), now + (10 * 60 * 1000));
                const completedAttack = createIncomingAttack('completed-1', now - (20 * 60 * 1000), now - (5 * 60 * 1000));

                const state = createTestState({
                    incomingAttacks: [activeAttack, completedAttack]
                });

                const queued = getQueuedIncomingAttacks(state, now);
                
                expect(queued.length).toBe(1);
                expect(queued[0].id).toBe('completed-1');
            });

            it('should sort by endTime, then by startTime', () => {
                const now = Date.now();
                
                const attack1 = createIncomingAttack('a1', now - (30 * 60 * 1000), now - (10 * 60 * 1000));
                const attack2 = createIncomingAttack('a2', now - (35 * 60 * 1000), now - (10 * 60 * 1000));
                const attack3 = createIncomingAttack('a3', now - (20 * 60 * 1000), now - (5 * 60 * 1000));

                const state = createTestState({
                    incomingAttacks: [attack1, attack2, attack3]
                });

                const queued = getQueuedIncomingAttacks(state, now);
                
                expect(queued.length).toBe(3);
                expect(queued[0].id).toBe('a2');
                expect(queued[1].id).toBe('a1');
                expect(queued[2].id).toBe('a3');
            });
        });

        describe('processAttackQueue', () => {
            it('should process empty queue without errors', () => {
                const state = createTestState();
                const now = Date.now();

                const result = processAttackQueue(state, now);

                expect(result.newState).toBeDefined();
                expect(result.queuedResults.length).toBe(0);
                expect(result.newLogs.length).toBe(0);
            });

            it('should remove processed attacks from state', () => {
                const now = Date.now();
                const completedMission = createOutgoingMission('m1', now - (20 * 60 * 1000), now - (5 * 60 * 1000));
                const completedAttack = createIncomingAttack('a1', now - (20 * 60 * 1000), now - (5 * 60 * 1000));

                const state = createTestState({
                    activeMissions: [completedMission],
                    incomingAttacks: [completedAttack]
                });

                const result = processAttackQueue(state, now);

                expect(result.newState.activeMissions.length).toBe(0);
                expect(result.newState.incomingAttacks.length).toBe(0);
                expect(result.queuedResults.length).toBe(2);
            });
        });
    });

    describe('Edge cases', () => {
        it('should handle offline time less than 1 minute', () => {
            const now = Date.now();
            
            const initialState = createTestState({
                lastSaveTime: now - (30 * 1000),
                incomingAttacks: [
                    createIncomingAttack('incoming-1', now - (5 * 60 * 1000), now + (5 * 60 * 1000))
                ],
                activeMissions: [
                    createOutgoingMission('mission-1', now - (10 * 60 * 1000), now + (10 * 60 * 1000))
                ]
            });

            const { newState, report } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(0);
            expect(newState.incomingAttacks.length).toBe(1);
            expect(newState.activeMissions.length).toBe(1);
        });

        it('should handle no attacks at all', () => {
            const now = Date.now();
            
            const initialState = createTestState({
                lastSaveTime: now - (60 * 60 * 1000)
            });

            const { newState, report } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(0);
            expect(newState.incomingAttacks.length).toBe(0);
            expect(newState.activeMissions.length).toBe(0);
        });

        it('should handle attack that ends exactly at lastSaveTime', () => {
            const now = Date.now();
            const attackEndTime = now - (45 * 60 * 1000);
            
            const initialState = createTestState({
                lastSaveTime: now - (45 * 60 * 1000),
                incomingAttacks: [
                    createIncomingAttack('incoming-1', now - (60 * 60 * 1000), attackEndTime)
                ]
            });

            const { report } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(1);
            expect(report.queuedAttackResults[0].type).toBe('INCOMING');
        });
    });
});
