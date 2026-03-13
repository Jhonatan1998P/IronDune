// ============================================================
// ATTACK QUEUE ENGINE - Mirror of utils/engine/attackQueue.ts
// ============================================================

import { UnitType, ResourceType, BuildingType } from './enums.js';
import { resolveMission } from './missions.js';
import { resolveSalvageMission } from './salvage.js';
import { simulateCombat } from './combat.js';
import { calculateActiveReinforcements } from './allianceReinforcements.js';
import { recordReputationChange } from './reputationHistory.js';
import { applyDefendReputation, applyAllyDefenseReputation } from './reputation.js';
import { PLUNDERABLE_BUILDINGS, PLUNDER_RATES } from './constants.js';
import { generateLogisticLootFromCombat } from './logisticLoot.js';
import { supabase } from '../lib/supabase.js';

export const getQueuedOutgoingAttacks = (state, now) => {
    return (state.activeMissions || [])
        .filter(mission => mission.endTime <= now)
        .sort((a, b) => (a.endTime !== b.endTime) ? (a.endTime - b.endTime) : (a.startTime - b.startTime));
};

export const getQueuedIncomingAttacks = (state, now) => {
    return (state.incomingAttacks || [])
        .filter(attack => attack.endTime <= now)
        .sort((a, b) => (a.endTime !== b.endTime) ? (a.endTime - b.endTime) : (a.startTime - b.startTime));
};

export const processOutgoingAttackInQueue = async (state, mission, now, sameTimeMissions = []) => {
    const newState = JSON.parse(JSON.stringify(state));
    const logs = [];

    // --- SALVAGE MISSION LOGIC ---
    if (mission.type === 'SALVAGE') {
        const lootFieldId = mission.logisticLootId;
        const { data: lootField, error } = await supabase
            .from('logistic_loot')
            .select('*')
            .eq('id', lootFieldId)
            .single();
        
        // Map back to camelCase for the engine
        const mappedField = lootField ? {
            id: lootField.id,
            resources: lootField.resources,
            expiresAt: new Date(lootField.expires_at).getTime(),
            totalValue: lootField.total_value,
            harvestCount: lootField.harvest_count
        } : null;

        const outcome = await resolveSalvageMission(mission, mappedField, sameTimeMissions, state.techLevels);
        
        if (outcome.success) {
            Object.entries(outcome.resources).forEach(([rType, amt]) => {
                newState.resources[rType] = Math.min(newState.maxResources[rType], (newState.resources[rType] || 0) + amt);
            });
        }

        newState.units[UnitType.SALVAGER_DRONE] = (newState.units[UnitType.SALVAGER_DRONE] || 0) + outcome.dronesReturned;
        
        const logEntry = {
            id: `salvage-res-${now}-${mission.id}`,
            messageKey: outcome.success ? 'log_salvage_success' : 'log_salvage_failed',
            params: { ...outcome, loot: outcome.resources },
            timestamp: now,
            type: outcome.conflictOccurred ? 'combat' : 'info'
        };
        logs.push(logEntry);
        
        return { 
            newState, 
            result: { ...outcome, processedAt: now }, 
            logs 
        };
    }

    // --- REGULAR MISSION LOGIC ---
    const missionResult = resolveMission(
        mission, newState.resources, newState.maxResources, newState.campaignProgress,
        newState.techLevels, newState.activeWar, now, newState.rankingData.bots,
        newState.empirePoints, newState.buildings, newState.targetAttackCounts, newState.spyReports, newState.playerName
    );

    newState.resources = { ...missionResult.resources };

    if (missionResult.unitsToAdd) {
        Object.entries(missionResult.unitsToAdd).forEach(([uType, count]) => {
            newState.units[uType] = (newState.units[uType] || 0) + count;
        });
    }

    if (missionResult.buildingsToAdd) {
        Object.entries(missionResult.buildingsToAdd).forEach(([bType, count]) => {
            if (!newState.buildings[bType]) newState.buildings[bType] = { level: 0 };
            newState.buildings[bType].level += count;
        });
    }

    if (missionResult.newCampaignProgress !== undefined) newState.campaignProgress = missionResult.newCampaignProgress;

    const logEntry = {
        id: `log-${mission.id}-${now}`, messageKey: missionResult.logKey,
        params: missionResult.logParams, timestamp: now, type: missionResult.logType
    };
    logs.push(logEntry);

    if (missionResult.newGrudge) newState.grudges = [...(newState.grudges || []), missionResult.newGrudge];
    if (missionResult.generatedLogisticLoot) {
        if (!newState.logisticLootFields) newState.logisticLootFields = [];
        newState.logisticLootFields.push(missionResult.generatedLogisticLoot);
    }

    if (missionResult.reputationChanges) {
        missionResult.reputationChanges.forEach(({ botId }) => {
            if (!newState.diplomaticActions) newState.diplomaticActions = {};
            if (!newState.diplomaticActions[botId]) {
                newState.diplomaticActions[botId] = { lastGiftTime: 0, lastAllianceTime: 0, lastPeaceTime: 0 };
            }
        });
    }

    const result = {
        resources: missionResult.resources, unitsToAdd: missionResult.unitsToAdd,
        buildingsToAdd: missionResult.buildingsToAdd, logKey: missionResult.logKey,
        logType: missionResult.logType, logParams: missionResult.logParams,
        battleResult: missionResult.logParams?.combatResult, processedAt: now,
        generatedLogisticLoot: missionResult.generatedLogisticLoot,
        defenderUpdates: missionResult.defenderUpdates
    };

    return { newState, result, logs };
};

export const processIncomingAttackInQueue = (state, attack, initialPlayerUnits, now) => {
    let newState = JSON.parse(JSON.stringify(state));
    const logs = [];

    let allyArmies;
    const reinforcements = calculateActiveReinforcements(newState, now);
    if (reinforcements.length > 0) {
        allyArmies = {};
        for (const ref of reinforcements) allyArmies[ref.botId] = ref.units;
    }

    const battleResult = simulateCombat(initialPlayerUnits, attack.units, 1.0, allyArmies);
    const playerWon = battleResult.winner === 'PLAYER';
    
    const attackerBot = newState.rankingData.bots.find(b => (attack.attackerId && b.id === attack.attackerId) || b.name === attack.attackerName);
    if (attackerBot) {
        const repResult = applyDefendReputation(attackerBot, playerWon);
        attackerBot.reputation = repResult.newReputation;
        newState = recordReputationChange(newState, attackerBot.id, { type: repResult.changeType, amount: repResult.change, timestamp: now, reason: playerWon ? 'defense_win' : 'defense_loss' }, now);
    }

    if (allyArmies) {
        Object.keys(allyArmies).forEach(botId => {
            const allyBot = newState.rankingData.bots.find(b => b.id === botId);
            if (allyBot) {
                const repResult = applyAllyDefenseReputation(allyBot);
                allyBot.reputation = repResult.newReputation;
                newState = recordReputationChange(newState, allyBot.id, { type: repResult.changeType, amount: repResult.change, timestamp: now, reason: 'ally_defense_support' }, now);
            }
        });
    }

    const fullUnits = { ...newState.units };
    Object.keys(fullUnits).forEach(k => fullUnits[k] = 0);
    Object.entries(battleResult.finalPlayerArmy).forEach(([uType, count]) => { if (count && count > 0) fullUnits[uType] = count; });
    newState.units = fullUnits;

    const stolenBuildings = {};
    let diamondDamaged = false;
    if (battleResult.winner !== 'PLAYER' && !attack.isWarWave) {
        const plunderRate = PLUNDER_RATES[0];
        PLUNDERABLE_BUILDINGS.forEach(bType => {
            const currentLvl = newState.buildings[bType]?.level || 0;
            if (currentLvl > 0) {
                const stolen = Math.floor(currentLvl * plunderRate);
                if (stolen > 0) {
                    stolenBuildings[bType] = stolen;
                    newState.buildings[bType] = { ...newState.buildings[bType], level: Math.max(0, currentLvl - stolen) };
                }
            }
        });
        if (newState.buildings[BuildingType.DIAMOND_MINE]?.level > 0) {
            diamondDamaged = true;
            stolenBuildings[BuildingType.DIAMOND_MINE] = 1;
            newState.buildings[BuildingType.DIAMOND_MINE] = { ...newState.buildings[BuildingType.DIAMOND_MINE], isDamaged: true };
        }
    }

    const logKey = battleResult.winner === 'PLAYER' ? 'log_defense_win' : 'log_defense_loss';
    const logParams = {
        combatResult: battleResult, attacker: attack.attackerName,
        buildingLoot: Object.keys(stolenBuildings).length > 0 ? stolenBuildings : undefined,
        diamondDamaged: diamondDamaged || undefined,
        allyNames: allyArmies ? Object.keys(allyArmies).reduce((acc, botId) => {
            const bot = newState.rankingData.bots.find(b => b.id === botId);
            if (bot) acc[botId] = bot.name;
            return acc;
        }, {}) : undefined
    };

    logs.push({ id: `log-defense-${attack.id}-${now}`, messageKey: logKey, params: logParams, timestamp: now, type: 'combat' });

    const generatedLogisticLoot = generateLogisticLootFromCombat(battleResult, 'RAID', attack.id, { attackerId: attack.attackerId || 'BOT', attackerName: attack.attackerName, defenderId: 'PLAYER', defenderName: newState.playerName || 'Player' }) || undefined;
    if (generatedLogisticLoot) {
        if (!newState.logisticLootFields) newState.logisticLootFields = [];
        newState.logisticLootFields.push(generatedLogisticLoot);
    }

    const result = {
        resources: {}, unitsLost: battleResult.totalPlayerCasualties,
        stolenBuildings: Object.keys(stolenBuildings).length > 0 ? stolenBuildings : undefined,
        diamondDamaged, logKey, logType: 'combat', logParams, battleResult, processedAt: now, generatedLogisticLoot
    };
    return { newState, result, logs };
};

export const processAttackQueue = async (state, now) => {
    let currentState = JSON.parse(JSON.stringify(state));
    const queuedResults = [];
    const allLogs = [];

    const queue = [
        ...getQueuedOutgoingAttacks(state, now).map(m => ({ type: 'OUTGOING', endTime: m.endTime, mission: m })),
        ...getQueuedIncomingAttacks(state, now).map(a => ({ type: 'INCOMING', endTime: a.endTime, attack: a }))
    ].sort((a, b) => (a.endTime !== b.endTime) ? (a.endTime - b.endTime) : ((a.mission?.startTime || a.attack?.startTime || 0) - (b.mission?.startTime || b.attack?.startTime || 0)));

    for (const item of queue) {
        if (item.type === 'OUTGOING' && item.mission) {
            if (item.mission.isP2P) continue;

            const sameSecondMissions = queue
                .filter(q => q.type === 'OUTGOING' && q.mission?.type === 'SALVAGE' && 
                        q.mission?.logisticLootId === item.mission.logisticLootId &&
                        Math.floor(q.endTime / 1000) === Math.floor(item.endTime / 1000))
                .map(q => q.mission);

            const { newState, result, logs } = await processOutgoingAttackInQueue(currentState, item.mission, item.endTime, sameSecondMissions);
            currentState = newState;
            allLogs.push(...logs.map(log => ({ ...log, timestamp: item.endTime })));
            currentState.activeMissions = currentState.activeMissions.filter(m => m.id !== item.mission.id);
            queuedResults.push({ id: item.mission.id, type: 'OUTGOING', missionId: item.mission.id, result, processedAt: item.endTime });
        } else if (item.type === 'INCOMING' && item.attack) {
            if (item.attack.isP2P) {
                currentState.incomingAttacks = currentState.incomingAttacks.filter(a => a.id !== item.attack.id);
                continue;
            }
            const { newState, result, logs } = processIncomingAttackInQueue(currentState, item.attack, currentState.units, item.endTime);
            currentState = newState;
            allLogs.push(...logs.map(log => ({ ...log, timestamp: item.endTime })));
            currentState.incomingAttacks = currentState.incomingAttacks.filter(a => a.id !== item.attack.id);
            queuedResults.push({ id: item.attack.id, type: 'INCOMING', attackId: item.attack.id, result, processedAt: item.endTime });
        }
    }
    currentState.lastProcessedAttackTime = now;
    return { newState: currentState, queuedResults, newLogs: allLogs };
};
