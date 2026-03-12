import { ActiveMission, GameState, IncomingAttack, LogEntry, QueuedAttackResult, BattleResult, UnitType, ResourceType, BuildingType, LogisticLootField } from '../../types';
import { resolveMission } from './missions';
import { simulateCombat } from './combat';
import { calculateActiveReinforcements } from './allianceReinforcements';
import { recordReputationChange } from './reputationHistory';
import { applyDefendReputation, applyAllyDefenseReputation } from './reputation';
import { PLUNDERABLE_BUILDINGS, PLUNDER_RATES } from '../../constants';
import { generateLogisticLootFromCombat } from './logisticLoot';

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

    if (missionResult.generatedLogisticLoot) {
        if (!newState.logisticLootFields) newState.logisticLootFields = [];
        newState.logisticLootFields.push(missionResult.generatedLogisticLoot);
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
        processedAt: now,
        generatedLogisticLoot: missionResult.generatedLogisticLoot
    };

    return { newState, result, logs };
};

export const processIncomingAttackInQueue = (
    state: GameState,
    attack: IncomingAttack,
    initialPlayerUnits: Record<UnitType, number>,
    now: number
): { newState: GameState; result: any; logs: LogEntry[] } => {
    let newState = JSON.parse(JSON.stringify(state)) as GameState;
    const logs: LogEntry[] = [];

    const playerUnits = initialPlayerUnits;
    const enemyUnits = attack.units;

    // Calculate allied reinforcements for defense
    let allyArmies: Record<string, Partial<Record<UnitType, number>>> | undefined;
    const reinforcements = calculateActiveReinforcements(newState, now);
    if (reinforcements.length > 0) {
        allyArmies = {};
        for (const ref of reinforcements) {
            allyArmies[ref.botId] = ref.units;
        }
    }

    const battleResult = simulateDefenseCombat(playerUnits, enemyUnits, 1.0, allyArmies);

    // --- REPUTATION UPDATES ---
    const playerWon = battleResult.winner === 'PLAYER';
    
    // 1. Attacker reputation change (if it's a known bot)
    const attackerBot = newState.rankingData.bots.find(b => 
        (attack.attackerId && b.id === attack.attackerId) || 
        b.name === attack.attackerName
    );
    
    if (attackerBot) {
        const repResult = applyDefendReputation(attackerBot, playerWon);
        attackerBot.reputation = repResult.newReputation;
        
        newState = recordReputationChange(
            newState,
            attackerBot.id,
            {
                type: repResult.changeType,
                amount: repResult.change,
                timestamp: now,
                reason: playerWon ? 'defense_win' : 'defense_loss'
            },
            now
        );
        
        // Ensure ranking bots are also updated in the array
        newState.rankingData.bots = newState.rankingData.bots.map(b => 
            b.id === attackerBot.id ? { ...b, reputation: repResult.newReputation } : b
        );
    }

    // 2. Allies reputation change (for helping)
    if (allyArmies) {
        Object.keys(allyArmies).forEach(botId => {
            const allyBot = newState.rankingData.bots.find(b => b.id === botId);
            if (allyBot) {
                const repResult = applyAllyDefenseReputation(allyBot);
                allyBot.reputation = repResult.newReputation;
                
                newState = recordReputationChange(
                    newState,
                    allyBot.id,
                    {
                        type: repResult.changeType,
                        amount: repResult.change,
                        timestamp: now,
                        reason: 'ally_defense_support'
                    },
                    now
                );
                
                // Update in ranking bots array
                newState.rankingData.bots = newState.rankingData.bots.map(b => 
                    b.id === allyBot.id ? { ...b, reputation: repResult.newReputation } : b
                );
            }
        });
    }

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
        [UnitType.PHANTOM_SUB]: 0,
        [UnitType.SALVAGER_DRONE]: 0
    };
    Object.entries(survivingUnits).forEach(([uType, count]) => {
        fullUnits[uType as UnitType] = count || 0;
    });
    newState.units = fullUnits;

    const playerCasualtiesValue = calculateCasualtiesValue(state.units, battleResult.totalPlayerCasualties);

    // Apply building plunder if player lost the defense
    const stolenBuildings: Partial<Record<BuildingType, number>> = {};
    let diamondDamaged = false;

    if (battleResult.winner !== 'PLAYER' && !attack.isWarWave) {
        const plunderRate = PLUNDER_RATES[0]; // 33% for raid attacks

        PLUNDERABLE_BUILDINGS.forEach(bType => {
            const currentLvl = newState.buildings[bType]?.level || 0;
            if (currentLvl > 0) {
                const stolen = Math.floor(currentLvl * plunderRate);
                if (stolen > 0) {
                    stolenBuildings[bType] = stolen;
                    // Apply the building level reduction
                    newState.buildings[bType] = {
                        ...newState.buildings[bType],
                        level: Math.max(0, currentLvl - stolen)
                    };
                }
            }
        });

        // Handle Diamond Mine damage
        if (newState.buildings[BuildingType.DIAMOND_MINE]?.level > 0) {
            diamondDamaged = true;
            stolenBuildings[BuildingType.DIAMOND_MINE] = 1;
            newState.buildings[BuildingType.DIAMOND_MINE] = {
                ...newState.buildings[BuildingType.DIAMOND_MINE],
                isDamaged: true
            };
        }
    }

    const logKey = battleResult.winner === 'PLAYER' ? 'log_defense_win' : 'log_defense_loss';
    const logType: LogEntry['type'] = 'combat';

    const logParams: any = {
        combatResult: battleResult,
        attacker: attack.attackerName,
        buildingLoot: Object.keys(stolenBuildings).length > 0 ? stolenBuildings : undefined,
        diamondDamaged: diamondDamaged || undefined,
        // Ally names for display in combat report
        allyNames: allyArmies
            ? Object.keys(allyArmies).reduce((acc, botId) => {
                const bot = newState.rankingData.bots.find(b => b.id === botId);
                if (bot) acc[botId] = bot.name;
                return acc;
            }, {} as Record<string, string>)
            : undefined
    };

    const logEntry: LogEntry = {
        id: `log-defense-${attack.id}-${now}`,
        messageKey: logKey,
        params: logParams,
        timestamp: now,
        type: logType
    };
    logs.push(logEntry);

    const generatedLogisticLoot = generateLogisticLootFromCombat(
        battleResult,
        'RAID',
        attack.id,
        {
            attackerId: attack.attackerId || 'BOT',
            attackerName: attack.attackerName,
            defenderId: 'PLAYER',
            defenderName: newState.playerName || 'Player'
        }
    ) || undefined;

    if (generatedLogisticLoot) {
        if (!newState.logisticLootFields) newState.logisticLootFields = [];
        newState.logisticLootFields.push(generatedLogisticLoot);
    }

    const result = {
        resources: {},
        unitsLost: battleResult.totalPlayerCasualties,
        resourcesLost: playerCasualtiesValue,
        stolenBuildings: Object.keys(stolenBuildings).length > 0 ? stolenBuildings : undefined,
        diamondDamaged,
        logKey,
        logType,
        logParams,
        battleResult,
        processedAt: now,
        generatedLogisticLoot
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
    damageMultiplier: number,
    allyArmies?: Record<string, Partial<Record<UnitType, number>>>
): BattleResult => {
    return simulateCombat(playerUnits, enemyUnits, damageMultiplier, allyArmies);
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
            // Para ataques P2P salientes, el atacante NO procesa la batalla sincrónicamente aquí.
            // La resolución se maneja de forma asíncrona vía useP2PBattleResolver.
            if (item.mission.isP2P) {
                // Removemos la misión P2P de la cola local para no procesarla como si fuera contra un bot.
                // Sin embargo, useP2PBattleResolver aún la necesita, pero este hook
                // mira gameState.activeMissions, por lo que NO debemos eliminarla de currentState.activeMissions
                // hasta que se resuelva la batalla P2P o de timeout.
                continue;
            }

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
            // Para ataques P2P, el defensor NO procesa la batalla localmente.
            // El atacante es quien resuelve y envía el resultado via useP2PBattleResolver.
            // Aquí solo eliminamos el ataque de la cola para que no se procese dos veces.
            if (item.attack.isP2P) {
                // Ataque P2P: no procesamos localmente, solo limpiamos la lista
                // (el resultado llegará via gameEventBus 'P2P_BATTLE_RESULT')
                currentState.incomingAttacks = currentState.incomingAttacks.filter(a => a.id !== item.attack!.id);
                continue;
            }

            const { newState, result, logs } = processIncomingAttackInQueue(currentState, item.attack, currentState.units, attackTime);
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
