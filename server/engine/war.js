// ============================================================
// WAR ENGINE - Mirror of utils/engine/war.ts
// ============================================================

import { BuildingType, ResourceType, UnitType, BotPersonality } from './enums.js';
import { calculateActiveReinforcements } from './allianceReinforcements.js';
import { 
    WAR_TOTAL_WAVES, WAR_PLAYER_ATTACKS, GLOBAL_ATTACK_TRAVEL_TIME_MS, 
    WAR_DURATION_MS, WAR_WAVE_INTERVAL_MS, WAR_OVERTIME_MS, 
    calculateMaxBankCapacity, PLUNDERABLE_BUILDINGS, PLUNDER_RATES,
    REPUTATION_ENEMY_THRESHOLD, REPUTATION_ALLY_THRESHOLD, 
    BOT_BUDGET_RATIO, ENEMY_ATTACK_POWER_RATIO_MIN, ENEMY_ATTACK_POWER_RATIO_LIMIT
} from './constants.js';
import { generateBotArmy, calculateResourceCost } from './missions.js';
import { simulateCombat } from './combat.js';
import { recordReputationChange } from './reputationHistory.js';
import { applyDefendReputation, applyAllyDefenseReputation } from './reputation.js';
import { generateLogisticLootFromCombat, mergeWarLogisticLoot } from './logisticLoot.js';
import { isValidWarState, sanitizeWarState, correctWaveTiming } from './warValidation.js';

export const processWarTick = (state, now) => {
    if (!state.activeWar) return { stateUpdates: {}, logs: [] };

    let war = { ...state.activeWar };
    const logs = [];
    const stateUpdates = {};

    war = correctWaveTiming(war, now);

    const warEndTime = war.startTime + war.duration;
    if (now >= warEndTime) {
        if (war.playerVictories === war.enemyVictories) {
            war.duration += WAR_OVERTIME_MS;
            war.totalWaves += 1;
            logs.push({ id: `war-overtime-${now}`, messageKey: 'log_war_overtime', type: 'war', timestamp: now });
        } else {
            return resolveWar(state, war, now);
        }
    }

    if (now >= war.nextWaveTime && war.currentWave <= war.totalWaves) {
        const result = processWarWave(state, war, now);
        war = { ...war, ...result.warUpdates };
        logs.push(...result.logs);
        if (result.stateUpdates) Object.assign(stateUpdates, result.stateUpdates);
    }

    stateUpdates.activeWar = war;
    return { stateUpdates, logs };
};

const processWarWave = (state, war, now) => {
    const logs = [];
    const waveNum = war.currentWave;
    const enemyScore = war.enemyScore;
    const personality = war.botPersonality || BotPersonality.WARLORD;
    
    const armyMultiplier = 0.5 + (waveNum * 0.1);
    const enemyArmy = generateBotArmy(enemyScore, armyMultiplier, personality, state.units);

    let allyArmies;
    const reinforcements = calculateActiveReinforcements(state, now);
    if (reinforcements.length > 0) {
        allyArmies = {};
        for (const ref of reinforcements) allyArmies[ref.botId] = ref.units;
    }

    const battleResult = simulateCombat(state.units, enemyArmy, 1.0, allyArmies);
    const playerWon = battleResult.winner === 'PLAYER';

    const newWar = { ...war };
    if (playerWon) newWar.playerVictories++;
    else newWar.enemyVictories++;

    newWar.currentWave++;
    newWar.nextWaveTime = now + WAR_WAVE_INTERVAL_MS;

    const pResLoss = calculateResourceCost(battleResult.totalPlayerCasualties);
    const eResLoss = calculateResourceCost(battleResult.totalEnemyCasualties);
    Object.keys(pResLoss).forEach(k => {
        newWar.playerResourceLosses[k] = (newWar.playerResourceLosses[k] || 0) + pResLoss[k];
        newWar.enemyResourceLosses[k] = (newWar.enemyResourceLosses[k] || 0) + eResLoss[k];
    });

    const logParams = { combatResult: battleResult, wave: waveNum, attacker: war.enemyName };
    logs.push({ id: `war-wave-${waveNum}-${now}`, messageKey: playerWon ? 'log_war_wave_win' : 'log_war_wave_loss', params: logParams, timestamp: now, type: 'war' });

    const stateUpdates = { units: battleResult.finalPlayerArmy };
    
    const debris = generateLogisticLootFromCombat(battleResult, 'WAR', `war-${war.id}-w${waveNum}`, { attackerId: war.enemyId, attackerName: war.enemyName, defenderId: 'PLAYER', defenderName: state.playerName }, war.id, waveNum);
    if (debris) {
        if (!stateUpdates.logisticLootFields) stateUpdates.logisticLootFields = [...(state.logisticLootFields || [])];
        stateUpdates.logisticLootFields.push(debris);
    }

    return { warUpdates: newWar, logs, stateUpdates };
};

const resolveWar = (state, war, now) => {
    const playerWon = war.playerVictories > war.enemyVictories;
    const logs = [];
    const stateUpdates = { activeWar: null, lastWarEndTime: now };

    logs.push({ id: `war-resolve-${now}`, messageKey: playerWon ? 'log_war_win' : 'log_war_loss', params: { enemy: war.enemyName }, timestamp: now, type: 'war' });

    const attackerBot = state.rankingData.bots.find(b => b.id === war.enemyId);
    if (attackerBot) {
        const repResult = applyDefendReputation(attackerBot, playerWon);
        attackerBot.reputation = repResult.newReputation;
    }

    return { stateUpdates, logs };
};
