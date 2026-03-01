import { ActiveMission, GameState, IncomingAttack, LogEntry, QueuedAttackResult, BattleResult, UnitType, ResourceType, BuildingType } from '../../types';
import { resolveMission } from './missions';
import { simulateCombat } from './combat';

export const getQueuedOutgoingAttacks = (state: GameState, now: number): ActiveMission[] => {
    return state.activeMissions
        .filter(mission => mission.endTime <= now)
        .sort((a, b) => {
            if (a.endTime !== b.endTime) {
                return a.endTime - b.endTime;
            }
            return a.startTime - b.startTime;
        });
};

export const getQueuedIncomingAttacks = (state: GameState, now: number): IncomingAttack[] => {
    return state.incomingAttacks
        .filter(attack => attack.endTime <= now)
        .sort((a, b) => {
            if (a.endTime !== b.endTime) {
                return a.endTime - b.endTime;
            }
            return a.startTime - b.startTime;
        });
};

export const processOutgoingAttackInQueue = (
    state: GameState,
    mission: ActiveMission,
    now: number
): { newState: GameState; result: any; logs: LogEntry[] } => {
    const newState = JSON.parse(JSON.stringify(state)) as GameState;
    const logs: LogEntry[] = [];

    const missionResult = resolveMission(
        mission,
        newState.resources,
        newState.maxResources,
        newState.campaignProgress,
        newState.techLevels,
        newState.activeWar,
        now,
        newState.rankingData.bots,
        newState.empirePoints,
        newState.buildings as any,
        newState.targetAttackCounts,
        newState.spyReports
    );

    Object.entries(missionResult.resources).forEach(([res, qty]) => {
        const resourceType = res as ResourceType;
        newState.resources[resourceType] = Math.min(
            newState.maxResources[resourceType],
            newState.resources[resourceType] + (qty as number)
        );
    });

    if (missionResult.unitsToAdd) {
        Object.entries(missionResult.unitsToAdd).forEach(([uType, count]) => {
            const unitType = uType as UnitType;
            newState.units[unitType] = (newState.units[unitType] || 0) + (count as number);
        });
    }

    if (missionResult.buildingsToAdd) {
        Object.entries(missionResult.buildingsToAdd).forEach(([bType, count]) => {
            const buildingType = bType as BuildingType;
            if (!newState.buildings[buildingType]) {
                newState.buildings[buildingType] = { level: 0 };
            }
            newState.buildings[buildingType].level += (count as number);
        });
    }

    if (missionResult.newCampaignProgress !== undefined) {
        newState.campaignProgress = missionResult.newCampaignProgress;
    }

    const logEntry: LogEntry = {
        id: `log-${mission.id}-${now}`,
        messageKey: missionResult.logKey,
        params: missionResult.logParams,
        timestamp: now,
        type: missionResult.logType
    };
    logs.push(logEntry);

    if (missionResult.newGrudge) {
        newState.grudges = [...newState.grudges, missionResult.newGrudge];
    }

    if (missionResult.reputationChanges) {
        missionResult.reputationChanges.forEach(({ botId }) => {
            if (!newState.diplomaticActions[botId]) {
                newState.diplomaticActions[botId] = {
                    lastGiftTime: 0,
                    lastAllianceTime: 0,
                    lastPeaceTime: 0
                };
            }
        });
    }

    const result = {
        resources: missionResult.resources,
        unitsToAdd: missionResult.unitsToAdd,
        buildingsToAdd: missionResult.buildingsToAdd,
        logKey: missionResult.logKey,
        logType: missionResult.logType,
        logParams: missionResult.logParams,
        battleResult: missionResult.logParams?.combatResult,
        processedAt: now
    };

    return { newState, result, logs };
};

export const processIncomingAttackInQueue = (
    state: GameState,
    attack: IncomingAttack,
    now: number
): { newState: GameState; result: any; logs: LogEntry[] } => {
    const newState = JSON.parse(JSON.stringify(state)) as GameState;
    const logs: LogEntry[] = [];

    const playerUnits = newState.units;
    const enemyUnits = attack.units;

    const battleResult = simulateDefenseCombat(playerUnits, enemyUnits, 1.0);

    const survivingUnits: Partial<Record<UnitType, number>> = {};
    Object.entries(battleResult.finalPlayerArmy).forEach(([uType, count]) => {
        if (count && count > 0) {
            survivingUnits[uType as UnitType] = count;
        }
    });
    
    const fullUnits: Record<UnitType, number> = {
        [UnitType.CYBER_MARINE]: 0,
        [UnitType.HEAVY_COMMANDO]: 0,
        [UnitType.SCOUT_TANK]: 0,
        [UnitType.TITAN_MBT]: 0,
        [UnitType.WRAITH_GUNSHIP]: 0,
        [UnitType.ACE_FIGHTER]: 0,
        [UnitType.AEGIS_DESTROYER]: 0,
        [UnitType.PHANTOM_SUB]: 0
    };
    Object.entries(survivingUnits).forEach(([uType, count]) => {
        fullUnits[uType as UnitType] = count || 0;
    });
    newState.units = fullUnits;

    const playerCasualtiesValue = calculateCasualtiesValue(state.units, battleResult.totalPlayerCasualties);

    const logKey = battleResult.winner === 'PLAYER' ? 'log_defense_win' : 'log_defense_loss';
    const logType: LogEntry['type'] = 'combat';

    const logParams: any = {
        combatResult: battleResult,
        attacker: attack.attackerName
    };

    const logEntry: LogEntry = {
        id: `log-defense-${attack.id}-${now}`,
        messageKey: logKey,
        params: logParams,
        timestamp: now,
        type: logType
    };
    logs.push(logEntry);

    const result = {
        resources: {},
        unitsLost: battleResult.totalPlayerCasualties,
        resourcesLost: playerCasualtiesValue,
        logKey,
        logType,
        logParams,
        battleResult,
        processedAt: now
    };

    return { newState, result, logs };
};

const calculateCasualtiesValue = (
    _initialUnits: Record<UnitType, number>,
    _casualties: Partial<Record<UnitType, number>>
): Partial<Record<ResourceType, number>> => {
    return {};
};

export const simulateDefenseCombat = (
    playerUnits: Record<UnitType, number>,
    enemyUnits: Partial<Record<UnitType, number>>,
    damageMultiplier: number
): BattleResult => {
    return simulateCombat(enemyUnits, playerUnits, damageMultiplier);
};

interface QueuedAttackItem {
    type: 'OUTGOING' | 'INCOMING';
    endTime: number;
    mission?: ActiveMission;
    attack?: IncomingAttack;
}

export const processAttackQueue = (
    state: GameState,
    now: number
): { newState: GameState; queuedResults: QueuedAttackResult[]; newLogs: LogEntry[] } => {
    let currentState = JSON.parse(JSON.stringify(state)) as GameState;
    const queuedResults: QueuedAttackResult[] = [];
    const allLogs: LogEntry[] = [];

    const outgoingAttacks = getQueuedOutgoingAttacks(state, now);
    const incomingAttacks = getQueuedIncomingAttacks(state, now);

    const queue: QueuedAttackItem[] = [];

    outgoingAttacks.forEach(mission => {
        queue.push({
            type: 'OUTGOING',
            endTime: mission.endTime,
            mission
        });
    });

    incomingAttacks.forEach(attack => {
        queue.push({
            type: 'INCOMING',
            endTime: attack.endTime,
            attack
        });
    });

    queue.sort((a, b) => {
        if (a.endTime !== b.endTime) {
            return a.endTime - b.endTime;
        }
        const aStart = a.mission?.startTime || a.attack?.startTime || 0;
        const bStart = b.mission?.startTime || b.attack?.startTime || 0;
        return aStart - bStart;
    });

    for (const item of queue) {
        const attackTime = item.endTime;
        
        if (item.type === 'OUTGOING' && item.mission) {
            const { newState, result, logs } = processOutgoingAttackInQueue(currentState, item.mission, attackTime);
            currentState = newState;
            allLogs.push(...logs.map(log => ({ ...log, timestamp: attackTime })));

            currentState.activeMissions = currentState.activeMissions.filter(m => m.id !== item.mission!.id);

            queuedResults.push({
                id: item.mission.id,
                type: 'OUTGOING',
                missionId: item.mission.id,
                result,
                processedAt: attackTime
            });
        } else if (item.type === 'INCOMING' && item.attack) {
            const { newState, result, logs } = processIncomingAttackInQueue(currentState, item.attack, attackTime);
            currentState = newState;
            allLogs.push(...logs.map(log => ({ ...log, timestamp: attackTime })));

            currentState.incomingAttacks = currentState.incomingAttacks.filter(a => a.id !== item.attack!.id);

            queuedResults.push({
                id: item.attack.id,
                type: 'INCOMING',
                attackId: item.attack.id,
                result,
                processedAt: attackTime
            });
        }
    }

    currentState.lastProcessedAttackTime = now;

    return {
        newState: currentState,
        queuedResults,
        newLogs: allLogs
    };
};
