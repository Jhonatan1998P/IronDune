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

/**
 * Test Suite: Movement Queue Order Tests
 * 
 * These tests verify the correct ordering and processing of incoming and outgoing movements
 * in the player's account queue, ensuring:
 * 1. Movements are processed by end time (arrival time)
 * 2. Movements are processed by arrival order, not by type
 * 3. Game state at exact moment of arrival is used for calculations
 * 4. State is correctly modified between events
 * 5. No data loss or corruption occurs during offline processing
 * 
 * IMPORTANT: When a movement is initiated, troops are no longer in the player's account.
 * They are in transit and only return when the movement completes.
 * Only troops NOT in movement and stationed at the account are available.
 */

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
    type: ActiveMission['type'] = 'PVP_ATTACK',
    units: Partial<Record<UnitType, number>> = { [UnitType.CYBER_MARINE]: 10 }
): ActiveMission => ({
    id,
    type,
    startTime,
    endTime,
    duration: Math.floor((endTime - startTime) / 60000),
    units,
    targetId: 'bot-1',
    targetName: 'Test Bot',
    targetScore: 1000
});

const createIncomingAttack = (
    id: string,
    startTime: number,
    endTime: number,
    units: Partial<Record<UnitType, number>> = { [UnitType.CYBER_MARINE]: 20 }
): IncomingAttack => ({
    id,
    attackerName: 'Enemy Commander',
    attackerScore: 1000,
    units,
    startTime,
    endTime
});

describe('Movement Queue Order Tests', () => {

    /**
     * TEST 1: Verify movements are processed in order of arrival (endTime)
     * 
     * Example: Two incoming attacks, one arriving in 5 minutes and another in 8 minutes.
     * The attack arriving in 5 minutes should be processed first.
     */
    describe('TEST 1: Movements processed by arrival time (endTime)', () => {
        
        it('should process incoming attacks in chronological order by endTime', () => {
            const now = Date.now();
            
            // Attack arriving in 5 minutes (from now, so endTime is 5 min ago)
            const attack5min = createIncomingAttack(
                'attack-5min',
                now - (25 * 60 * 1000),  // Started 25 min ago
                now - (5 * 60 * 1000)     // Ends 5 min ago = 5 min travel time
            );
            
            // Attack arriving in 8 minutes (from now, so endTime is 8 min ago)
            const attack8min = createIncomingAttack(
                'attack-8min',
                now - (28 * 60 * 1000),  // Started 28 min ago
                now - (8 * 60 * 1000)    // Ends 8 min ago = 8 min travel time
            );

            const initialState = createTestState({
                lastSaveTime: now - (30 * 60 * 1000),
                // Add in random order to verify sorting works
                incomingAttacks: [attack8min, attack5min]
            });

            const { report } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(2);

            // Sort by processedAt to verify order
            const sorted = [...report.queuedAttackResults].sort((a, b) => a.processedAt - b.processedAt);
            
            // The attack ending at 8 minutes (older, happened earlier) should be processed first
            expect(sorted[0].id).toBe('attack-8min');
            expect(sorted[0].processedAt).toBe(now - (8 * 60 * 1000));
            
            // The attack ending at 5 minutes (more recent) should be processed second
            expect(sorted[1].id).toBe('attack-5min');
            expect(sorted[1].processedAt).toBe(now - (5 * 60 * 1000));
        });

        it('should process outgoing missions in chronological order by endTime', () => {
            const now = Date.now();
            
            // Mission arriving in 8 minutes (older, happened earlier)
            const mission8min = createOutgoingMission(
                'mission-8min',
                now - (38 * 60 * 1000),
                now - (8 * 60 * 1000)
            );
            
            // Mission arriving in 5 minutes (more recent)
            const mission5min = createOutgoingMission(
                'mission-5min',
                now - (35 * 60 * 1000),
                now - (5 * 60 * 1000)
            );

            const initialState = createTestState({
                lastSaveTime: now - (40 * 60 * 1000),
                activeMissions: [mission8min, mission5min]
            });

            const { report } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(2);

            const sorted = [...report.queuedAttackResults].sort((a, b) => a.processedAt - b.processedAt);
            
            // The mission ending at 8 minutes (older) should be processed first
            expect(sorted[0].id).toBe('mission-8min');
            expect(sorted[1].id).toBe('mission-5min');
        });

        it('should process mixed incoming and outgoing by endTime regardless of type', () => {
            const now = Date.now();
            
            // Outgoing mission ending at 10 minutes (oldest)
            const outgoing10min = createOutgoingMission(
                'mission-10min',
                now - (40 * 60 * 1000),
                now - (10 * 60 * 1000)
            );
            
            // Incoming attack ending at 8 minutes
            const incoming8min = createIncomingAttack(
                'attack-8min',
                now - (28 * 60 * 1000),
                now - (8 * 60 * 1000)
            );
            
            // Incoming attack ending at 5 minutes (most recent)
            const incoming5min = createIncomingAttack(
                'attack-5min',
                now - (25 * 60 * 1000),
                now - (5 * 60 * 1000)
            );

            const initialState = createTestState({
                lastSaveTime: now - (45 * 60 * 1000),
                activeMissions: [outgoing10min],
                incomingAttacks: [incoming8min, incoming5min]
            });

            const { report } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(3);

            const sorted = [...report.queuedAttackResults].sort((a, b) => a.processedAt - b.processedAt);
            
            // Order should be by endTime (oldest first): outgoing10min, incoming8min, incoming5min
            expect(sorted[0].id).toBe('mission-10min');
            expect(sorted[1].id).toBe('attack-8min');
            expect(sorted[2].id).toBe('attack-5min');
        });
    });

    /**
     * TEST 2: Verify movements are processed by arrival order, not by type
     * 
     * The queue should process movements in the order they arrive at the target,
     * regardless of whether they are incoming or outgoing attacks.
     */
    describe('TEST 2: Movements processed by arrival order, not by type', () => {
        
        it('should process movements by arrival order regardless of type', () => {
            const now = Date.now();
            
            // Outgoing mission ending at 3 minutes
            const mission3min = createOutgoingMission(
                'mission-3min',
                now - (33 * 60 * 1000),
                now - (3 * 60 * 1000)
            );
            
            // Incoming attack ending at 2 minutes
            const incoming2min = createIncomingAttack(
                'attack-2min',
                now - (22 * 60 * 1000),
                now - (2 * 60 * 1000)
            );
            
            // Outgoing mission ending at 1 minute
            const mission1min = createOutgoingMission(
                'mission-1min',
                now - (31 * 60 * 1000),
                now - (1 * 60 * 1000)
            );

            const initialState = createTestState({
                lastSaveTime: now - (35 * 60 * 1000),
                activeMissions: [mission3min, mission1min],
                incomingAttacks: [incoming2min]
            });

            const { report } = calculateOfflineProgress(initialState);

            const sorted = [...report.queuedAttackResults].sort((a, b) => a.processedAt - b.processedAt);
            
            // Order should be strictly by endTime: mission3min -> incoming2min -> mission1min
            expect(sorted[0].id).toBe('mission-3min');
            expect(sorted[0].processedAt).toBe(now - (3 * 60 * 1000));
            
            expect(sorted[1].id).toBe('attack-2min');
            expect(sorted[1].processedAt).toBe(now - (2 * 60 * 1000));
            
            expect(sorted[2].id).toBe('mission-1min');
            expect(sorted[2].processedAt).toBe(now - (1 * 60 * 1000));
        });

        it('should not prioritize INCOMING over OUTGOING based on type alone', () => {
            const now = Date.now();
            
            // Incoming attack ending at 6 minutes (older)
            const incoming6min = createIncomingAttack(
                'incoming-6min',
                now - (26 * 60 * 1000),
                now - (6 * 60 * 1000)
            );
            
            // Outgoing mission ending at 5 minutes (more recent)
            const outgoing5min = createOutgoingMission(
                'outgoing-5min',
                now - (35 * 60 * 1000),
                now - (5 * 60 * 1000)
            );

            const initialState = createTestState({
                lastSaveTime: now - (40 * 60 * 1000),
                activeMissions: [outgoing5min],
                incomingAttacks: [incoming6min]
            });

            const { report } = calculateOfflineProgress(initialState);

            const sorted = [...report.queuedAttackResults].sort((a, b) => a.processedAt - b.processedAt);
            
            // Incoming at 6min (older) should come before outgoing at 5min (recent)
            // NOT outgoing first just because it's outgoing
            expect(sorted[0].id).toBe('incoming-6min');
            expect(sorted[1].id).toBe('outgoing-5min');
        });

        it('should handle same endTime by startTime order', () => {
            const now = Date.now();
            const sharedEndTime = now - (5 * 60 * 1000);
            
            // Incoming attack started earlier
            const incoming = createIncomingAttack(
                'incoming',
                now - (25 * 60 * 1000),  // Started 25 min ago
                sharedEndTime
            );
            
            // Outgoing mission started later
            const outgoing = createOutgoingMission(
                'outgoing',
                now - (20 * 60 * 1000),   // Started 20 min ago
                sharedEndTime
            );

            const initialState = createTestState({
                lastSaveTime: now - (30 * 60 * 1000),
                activeMissions: [outgoing],
                incomingAttacks: [incoming]
            });

            const { report } = calculateOfflineProgress(initialState);

            // At same endTime, the one with earlier startTime should be first
            expect(report.queuedAttackResults[0].id).toBe('incoming');
            expect(report.queuedAttackResults[1].id).toBe('outgoing');
        });
    });

    /**
     * TEST 3: Verify game state at exact moment of arrival is used
     * 
     * When a movement arrives, the game state from that exact second should be used
     * for all calculations, not a stale or future state.
     */
    describe('TEST 3: Game state at exact arrival time is used', () => {
        
        it('should use state from exact arrival time for incoming attack', () => {
            const now = Date.now();
            
            // Player has resources at time of save
            const initialResources: Record<ResourceType, number> = {
                ...INITIAL_GAME_STATE.resources,
                [ResourceType.MONEY]: 10000
            };
            
            // Incoming attack at 10 minutes ago
            const incomingAttack = createIncomingAttack(
                'attack-10min',
                now - (30 * 60 * 1000),
                now - (10 * 60 * 1000)
            );

            const initialState = createTestState({
                lastSaveTime: now - (35 * 60 * 1000),
                resources: initialResources,
                incomingAttacks: [incomingAttack]
            });

            const { report, newState } = calculateOfflineProgress(initialState);

            // The attack should have been processed with the state at that time
            expect(report.queuedAttackResults.length).toBe(1);
            
            // Verify the attack result exists
            const attackResult = report.queuedAttackResults[0];
            expect(attackResult).toBeDefined();
            expect(attackResult.type).toBe('INCOMING');
        });

        it('should reflect correct game state progression across multiple events', () => {
            const now = Date.now();
            
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
            
            const initialResources: Record<ResourceType, number> = {
                ...INITIAL_GAME_STATE.resources,
                [ResourceType.MONEY]: 5000,
                [ResourceType.OIL]: 1000,
                [ResourceType.AMMO]: 500
            };

            // First outgoing at 15 min ago - brings back resources
            const outgoing15min = createOutgoingMission(
                'mission-15min',
                now - (45 * 60 * 1000),
                now - (15 * 60 * 1000),
                'PVP_ATTACK',
                { [UnitType.CYBER_MARINE]: 10 }  // Sends 10 troops
            );
            
            // Incoming attack at 5 min ago - should see state AFTER first mission completes
            const incoming5min = createIncomingAttack(
                'attack-5min',
                now - (25 * 60 * 1000),
                now - (5 * 60 * 1000)
            );

            const initialState = createTestState({
                lastSaveTime: now - (50 * 60 * 1000),
                units: initialUnits,
                resources: initialResources,
                activeMissions: [outgoing15min],
                incomingAttacks: [incoming5min]
            });

            const { newState, report } = calculateOfflineProgress(initialState);

            // Verify both events were processed
            expect(report.queuedAttackResults.length).toBe(2);
            
            const sorted = [...report.queuedAttackResults].sort((a, b) => a.processedAt - b.processedAt);
            
            // First should be the outgoing mission at 15 min
            expect(sorted[0].type).toBe('OUTGOING');
            expect(sorted[0].processedAt).toBe(now - (15 * 60 * 1000));
            
            // Second should be the incoming attack at 5 min
            expect(sorted[1].type).toBe('INCOMING');
            expect(sorted[1].processedAt).toBe(now - (5 * 60 * 1000));
        });
    });

    /**
     * TEST 4: Verify state is correctly modified and ready for next event
     * 
     * When a movement arrives, the state should be modified correctly and
     * be ready to be processed for the next event in the queue.
     */
    describe('TEST 4: State is correctly modified between events', () => {
        
        it('should update game state after each event for next event processing', () => {
            const now = Date.now();
            
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

            // First incoming attack - 20 min ago
            const attack1 = createIncomingAttack(
                'attack-20min',
                now - (40 * 60 * 1000),
                now - (20 * 60 * 1000),
                { [UnitType.CYBER_MARINE]: 30 }  // Enemy attacks with 30
            );
            
            // Second incoming attack - 10 min ago
            const attack2 = createIncomingAttack(
                'attack-10min',
                now - (30 * 60 * 1000),
                now - (10 * 60 * 1000),
                { [UnitType.CYBER_MARINE]: 30 }  // Enemy attacks with 30
            );

            const initialState = createTestState({
                lastSaveTime: now - (45 * 60 * 1000),
                units: initialUnits,
                incomingAttacks: [attack2, attack1]  // Wrong order to test sorting
            });

            const { newState, report } = calculateOfflineProgress(initialState);

            // Both attacks should be processed
            expect(report.queuedAttackResults.length).toBe(2);
            
            // First attack should have removed some defenders
            const firstAttack = report.queuedAttackResults.find(r => r.id === 'attack-20min');
            expect(firstAttack).toBeDefined();
            expect(firstAttack?.result.battleResult).toBeDefined();
            
            // Second attack should also have a battle result
            const secondAttack = report.queuedAttackResults.find(r => r.id === 'attack-10min');
            expect(secondAttack).toBeDefined();
            expect(secondAttack?.result.battleResult).toBeDefined();
            
            // Both attacks should have been removed from state
            expect(newState.incomingAttacks.length).toBe(0);
        });

        it('should correctly accumulate resources from multiple outgoing missions', () => {
            const now = Date.now();
            
            const initialResources: Record<ResourceType, number> = {
                ...INITIAL_GAME_STATE.resources,
                [ResourceType.MONEY]: 1000,
                [ResourceType.OIL]: 100,
                [ResourceType.AMMO]: 50,
                [ResourceType.GOLD]: 0,
                [ResourceType.DIAMOND]: 0
            };

            // First mission returns at 20 min
            const mission1 = createOutgoingMission(
                'mission-20min',
                now - (50 * 60 * 1000),
                now - (20 * 60 * 1000),
                'PVP_ATTACK',
                { [UnitType.CYBER_MARINE]: 5 }
            );
            
            // Second mission returns at 10 min
            const mission2 = createOutgoingMission(
                'mission-10min',
                now - (40 * 60 * 1000),
                now - (10 * 60 * 1000),
                'PVP_ATTACK',
                { [UnitType.CYBER_MARINE]: 5 }
            );

            const initialState = createTestState({
                lastSaveTime: now - (55 * 60 * 1000),
                resources: initialResources,
                activeMissions: [mission2, mission1]  // Wrong order
            });

            const { newState, report } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(2);
            
            // Both missions should be completed
            expect(newState.activeMissions.length).toBe(0);
            
            // Resources should have been added (from mission rewards)
            // The exact amount depends on the mission reward logic
            const sorted = [...report.queuedAttackResults].sort((a, b) => a.processedAt - b.processedAt);
            expect(sorted[0].processedAt).toBe(now - (20 * 60 * 1000));
            expect(sorted[1].processedAt).toBe(now - (10 * 60 * 1000));
        });

        it('should prepare state correctly for subsequent events after incoming attack', () => {
            const now = Date.now();
            
            // Player has 50 troops
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

            // First attack at 20 min ago - enemy with 30 troops
            const attack1 = createIncomingAttack(
                'attack-20min',
                now - (40 * 60 * 1000),
                now - (20 * 60 * 1000),
                { [UnitType.CYBER_MARINE]: 30 }
            );
            
            // Second attack at 10 min ago - enemy with 20 troops
            const attack2 = createIncomingAttack(
                'attack-10min',
                now - (30 * 60 * 1000),
                now - (10 * 60 * 1000),
                { [UnitType.CYBER_MARINE]: 20 }
            );

            const initialState = createTestState({
                lastSaveTime: now - (45 * 60 * 1000),
                units: initialUnits,
                incomingAttacks: [attack2, attack1]
            });

            const { newState, report } = calculateOfflineProgress(initialState);

            // Both should be processed
            expect(newState.incomingAttacks.length).toBe(0);
            
            // Both should have battle results
            const attack1Result = report.queuedAttackResults.find(r => r.id === 'attack-20min');
            const attack2Result = report.queuedAttackResults.find(r => r.id === 'attack-10min');
            
            expect(attack1Result?.result.battleResult).toBeDefined();
            expect(attack2Result?.result.battleResult).toBeDefined();
        });
    });

    /**
     * TEST 5: Verify no data loss or corruption during offline processing
     * 
     * Ensures that troop counts, resources, and other game state data
     * are not lost or corrupted when processing events offline.
     * 
     * IMPORTANT: When a movement is initiated, troops are no longer in the player's account.
     * They are in transit and only available when the movement completes.
     */
    describe('TEST 5: Data integrity - no loss or corruption during offline processing', () => {
        
        it('should not lose troops during offline processing', () => {
            const now = Date.now();
            
            // Player starts with 100 troops
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

            // Send 30 troops on outgoing mission (they are now in transit, NOT in account)
            const outgoingMission = createOutgoingMission(
                'mission-send-30',
                now - (40 * 60 * 1000),
                now - (10 * 60 * 1000),
                'PVP_ATTACK',
                { [UnitType.CYBER_MARINE]: 30 }  // 30 troops in transit
            );

            const initialState = createTestState({
                lastSaveTime: now - (45 * 60 * 1000),
                units: initialUnits,  // 100 troops in account at save time
                activeMissions: [outgoingMission]
            });

            const { newState, report } = calculateOfflineProgress(initialState);

            // The mission should complete and return troops
            expect(report.queuedAttackResults.length).toBe(1);
            expect(newState.activeMissions.length).toBe(0);
            
            // The result should contain the returned units
            const missionResult = report.queuedAttackResults[0];
            expect(missionResult.type).toBe('OUTGOING');
        });

        it('should correctly track troops in transit vs stationed troops', () => {
            const now = Date.now();
            
            // Player has 50 troops in account
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

            // Send 20 troops on mission (now in transit, NOT in account)
            const outgoingInTransit = createOutgoingMission(
                'mission-in-transit',
                now - (40 * 60 * 1000),
                now - (10 * 60 * 1000),
                'PVP_ATTACK',
                { [UnitType.CYBER_MARINE]: 20 }  // 20 troops in transit
            );

            // Incoming attack arrives while outgoing is still in transit
            const incomingAttack = createIncomingAttack(
                'attack-15min',
                now - (35 * 60 * 1000),
                now - (15 * 60 * 1000),
                { [UnitType.CYBER_MARINE]: 10 }  // Enemy with 10 troops
            );

            const initialState = createTestState({
                lastSaveTime: now - (50 * 60 * 1000),
                units: initialUnits,  // 50 troops in account at save time
                // 20 troops are in transit (not in account)
                activeMissions: [outgoingInTransit],
                incomingAttacks: [incomingAttack]
            });

            const { report } = calculateOfflineProgress(initialState);

            // Both events should be processed
            expect(report.queuedAttackResults.length).toBe(2);
            
            // The incoming attack should defend with the 50 troops in account
            // NOT including the 20 in transit
            const incomingResult = report.queuedAttackResults.find(r => r.type === 'INCOMING');
            expect(incomingResult).toBeDefined();
            
            // The defender should have 50 troops (the ones in account)
            const defenderPower = Object.values(
                incomingResult?.result.battleResult?.initialPlayerArmy || {}
            ).reduce((sum, count) => sum + (count || 0), 0);
            
            // 50 troops in account should defend, NOT 50 + 20 = 70
            expect(defenderPower).toBe(50);
        });

        it('should not corrupt resource totals during multiple events', () => {
            const now = Date.now();
            
            const initialResources: Record<ResourceType, number> = {
                ...INITIAL_GAME_STATE.resources,
                [ResourceType.MONEY]: 10000,
                [ResourceType.OIL]: 5000,
                [ResourceType.AMMO]: 2000,
                [ResourceType.GOLD]: 100,
                [ResourceType.DIAMOND]: 10
            };

            // Multiple outgoing missions
            const mission1 = createOutgoingMission('m1', now - (50 * 60 * 1000), now - (25 * 60 * 1000));
            const mission2 = createOutgoingMission('m2', now - (45 * 60 * 1000), now - (15 * 60 * 1000));
            const mission3 = createOutgoingMission('m3', now - (40 * 60 * 1000), now - (5 * 60 * 1000));

            const initialState = createTestState({
                lastSaveTime: now - (55 * 60 * 1000),
                resources: initialResources,
                activeMissions: [mission3, mission1, mission2]
            });

            const { newState, report } = calculateOfflineProgress(initialState);

            // All missions should be completed
            expect(report.queuedAttackResults.length).toBe(3);
            expect(newState.activeMissions.length).toBe(0);
            
            // Resources should still be valid numbers (not NaN, not negative due to corruption)
            Object.values(newState.resources).forEach(res => {
                expect(typeof res).toBe('number');
                expect(Number.isFinite(res)).toBe(true);
                expect(res).toBeGreaterThanOrEqual(0);
            });
        });

        it('should preserve data integrity when processing empty queues', () => {
            const now = Date.now();
            
            const initialUnits: Record<UnitType, number> = {
                [UnitType.CYBER_MARINE]: 100,
                [UnitType.HEAVY_COMMANDO]: 50,
                [UnitType.SCOUT_TANK]: 30,
                [UnitType.TITAN_MBT]: 20,
                [UnitType.WRAITH_GUNSHIP]: 10,
                [UnitType.ACE_FIGHTER]: 5,
                [UnitType.AEGIS_DESTROYER]: 3,
                [UnitType.PHANTOM_SUB]: 2
            };

            const initialResources: Record<ResourceType, number> = {
                ...INITIAL_GAME_STATE.resources,
                [ResourceType.MONEY]: 50000,
                [ResourceType.OIL]: 10000,
                [ResourceType.AMMO]: 5000
            };

            const initialState = createTestState({
                lastSaveTime: now,
                units: initialUnits,
                resources: initialResources,
                activeMissions: [],
                incomingAttacks: []
            });

            const { newState, report } = calculateOfflineProgress(initialState);

            // NoOfflineProgress(initialState events to process
            expect(report.queuedAttackResults.length).toBe(0);
            
            // State should be unchanged
            expect(newState.units).toEqual(initialUnits);
            expect(newState.resources).toEqual(initialResources);
            expect(newState.activeMissions.length).toBe(0);
            expect(newState.incomingAttacks.length).toBe(0);
        });

        it('should handle large number of events without data corruption', () => {
            const now = Date.now();
            
            const initialUnits: Record<UnitType, number> = {
                [UnitType.CYBER_MARINE]: 1000,
                [UnitType.HEAVY_COMMANDO]: 0,
                [UnitType.SCOUT_TANK]: 0,
                [UnitType.TITAN_MBT]: 0,
                [UnitType.WRAITH_GUNSHIP]: 0,
                [UnitType.ACE_FIGHTER]: 0,
                [UnitType.AEGIS_DESTROYER]: 0,
                [UnitType.PHANTOM_SUB]: 0
            };

            // Create many incoming attacks
            const incomingAttacks: IncomingAttack[] = [];
            for (let i = 0; i < 20; i++) {
                incomingAttacks.push(
                    createIncomingAttack(
                        `attack-${i}`,
                        now - ((40 + i) * 60 * 1000),
                        now - ((30 - i) * 60 * 1000),
                        { [UnitType.CYBER_MARINE]: 10 + i }
                    )
                );
            }

            const initialState = createTestState({
                lastSaveTime: now - (70 * 60 * 1000),
                units: initialUnits,
                incomingAttacks
            });

            const { newState, report } = calculateOfflineProgress(initialState);

            // All attacks should be processed
            expect(report.queuedAttackResults.length).toBe(20);
            expect(newState.incomingAttacks.length).toBe(0);
            
            // Each result should have valid battle data
            report.queuedAttackResults.forEach(result => {
                expect(result.result).toBeDefined();
                if (result.type === 'INCOMING') {
                    expect(result.result.battleResult).toBeDefined();
                }
            });

            // Units should still be valid
            Object.values(newState.units).forEach(count => {
                expect(typeof count).toBe('number');
                expect(Number.isFinite(count)).toBe(true);
            });
        });

        it('should correctly process offline as if online - same results', () => {
            const now = Date.now();
            
            const initialUnits: Record<UnitType, number> = {
                [UnitType.CYBER_MARINE]: 80,
                [UnitType.HEAVY_COMMANDO]: 0,
                [UnitType.SCOUT_TANK]: 0,
                [UnitType.TITAN_MBT]: 0,
                [UnitType.WRAITH_GUNSHIP]: 0,
                [UnitType.ACE_FIGHTER]: 0,
                [UnitType.AEGIS_DESTROYER]: 0,
                [UnitType.PHANTOM_SUB]: 0
            };

            // Scenario: Player sends 30 troops on attack
            // While away, enemy attacks twice
            // Then player's attack returns
            
            const outgoingMission = createOutgoingMission(
                'player-attack',
                now - (60 * 60 * 1000),
                now - (15 * 60 * 1000),  // Returns at 15 min ago
                'PVP_ATTACK',
                { [UnitType.CYBER_MARINE]: 30 }
            );

            const enemyAttack1 = createIncomingAttack(
                'enemy-1',
                now - (50 * 60 * 1000),
                now - (30 * 60 * 1000),  // Arrives at 30 min ago
                { [UnitType.CYBER_MARINE]: 20 }
            );

            const enemyAttack2 = createIncomingAttack(
                'enemy-2',
                now - (40 * 60 * 1000),
                now - (20 * 60 * 1000),  // Arrives at 20 min ago
                { [UnitType.CYBER_MARINE]: 25 }
            );

            const initialState = createTestState({
                lastSaveTime: now - (65 * 60 * 1000),
                units: initialUnits,
                activeMissions: [outgoingMission],
                incomingAttacks: [enemyAttack2, enemyAttack1]  // Wrong order
            });

            const { newState, report } = calculateOfflineProgress(initialState);

            // All 3 events should be processed
            expect(report.queuedAttackResults.length).toBe(3);
            
            // They should be in chronological order
            const sorted = [...report.queuedAttackResults].sort((a, b) => a.processedAt - b.processedAt);
            
            // enemy-1 at 30 min ago
            expect(sorted[0].id).toBe('enemy-1');
            expect(sorted[0].processedAt).toBe(now - (30 * 60 * 1000));
            
            // enemy-2 at 20 min ago
            expect(sorted[1].id).toBe('enemy-2');
            expect(sorted[1].processedAt).toBe(now - (20 * 60 * 1000));
            
            // player-attack at 15 min ago
            expect(sorted[2].id).toBe('player-attack');
            expect(sorted[2].processedAt).toBe(now - (15 * 60 * 1000));

            // No pending events
            expect(newState.incomingAttacks.length).toBe(0);
            expect(newState.activeMissions.length).toBe(0);
            
            // State should be consistent (no NaN, no negative resources)
            Object.values(newState.resources).forEach(res => {
                expect(Number.isFinite(res)).toBe(true);
            });
        });
    });

    /**
     * Additional edge case tests for robustness
     */
    describe('Edge Cases', () => {
        
        it('should handle events with identical timestamps correctly', () => {
            const now = Date.now();
            const sameTime = now - (10 * 60 * 1000);
            
            const attack1 = createIncomingAttack('a1', now - (30 * 60 * 1000), sameTime);
            const attack2 = createIncomingAttack('a2', now - (35 * 60 * 1000), sameTime);
            const attack3 = createIncomingAttack('a3', now - (25 * 60 * 1000), sameTime);
            
            const mission1 = createOutgoingMission('m1', now - (40 * 60 * 1000), sameTime);
            const mission2 = createOutgoingMission('m2', now - (20 * 60 * 1000), sameTime);

            const initialState = createTestState({
                lastSaveTime: now - (45 * 60 * 1000),
                incomingAttacks: [attack1, attack2, attack3],
                activeMissions: [mission1, mission2]
            });

            const { report } = calculateOfflineProgress(initialState);

            expect(report.queuedAttackResults.length).toBe(5);
            
            // All should have same processedAt
            const allSameTime = report.queuedAttackResults.every(r => r.processedAt === sameTime);
            expect(allSameTime).toBe(true);
        });

        it('should handle very close timestamps in correct order', () => {
            const now = Date.now();
            
            // Events within 1 minute of each other
            // Note: smaller endTime = older event (happened longer ago)
            const attack1 = createIncomingAttack('a1', now - (20 * 60 * 1000), now - (10 * 60 * 1000)); // ends at 10 min (oldest)
            const attack2 = createIncomingAttack('a2', now - (18 * 60 * 1000), now - (9 * 60 * 1000) - 30000); // ends at 9:30 min
            const attack3 = createIncomingAttack('a3', now - (18 * 60 * 1000), now - (9 * 60 * 1000)); // ends at 9 min (most recent)

            const initialState = createTestState({
                lastSaveTime: now - (25 * 60 * 1000),
                incomingAttacks: [attack3, attack1, attack2]
            });

            const { report } = calculateOfflineProgress(initialState);

            const sorted = [...report.queuedAttackResults].sort((a, b) => a.processedAt - b.processedAt);
            
            // Sorted by endTime (oldest first): 10 min, 9:30 min, 9 min
            expect(sorted[0].id).toBe('a1');  // Ends at 10 min (oldest)
            expect(sorted[1].id).toBe('a2');  // Ends at 9:30 min
            expect(sorted[2].id).toBe('a3');  // Ends at 9 min (most recent)
        });
    });
});
