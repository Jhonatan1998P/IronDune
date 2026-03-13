// ============================================================
// ENEMY ATTACK ENGINE - Mirror of utils/engine/enemyAttack.ts
// ============================================================

import { BotPersonality } from './enums.js';
import { generateBotArmy } from './missions.js';
import {
    ENEMY_ATTACK_CHECK_INTERVAL_MS,
    ENEMY_ATTACK_COOLDOWN_MS,
    ENEMY_ATTACK_MAX_PER_BOT,
    ENEMY_ATTACK_RESET_MS,
    ENEMY_ATTACK_POWER_RATIO_MIN,
    ENEMY_ATTACK_POWER_RATIO_LIMIT,
    ENEMY_ATTACK_MAX_SIMULTANEOUS,
    ENEMY_ATTACK_SIMULTANEOUS_DELAY_MS,
    REPUTATION_ENEMY_THRESHOLD,
    GLOBAL_ATTACK_TRAVEL_TIME_MS,
    NEWBIE_PROTECTION_THRESHOLD
} from './constants.js';
import { calculateEnemyAttackChance } from './reputation.js';
import { calculateRetaliationTime, getRetaliationChance } from './nemesis.js';

export const processEnemyAttackCheck = (state, now) => {
    const logs = [];
    const elapsedSinceLastCheck = now - (state.lastEnemyAttackCheckTime || 0);

    if (elapsedSinceLastCheck < ENEMY_ATTACK_CHECK_INTERVAL_MS) return { stateUpdates: {}, logs: [] };

    const isNewbie = (state.empirePoints || 0) < NEWBIE_PROTECTION_THRESHOLD;
    if (isNewbie) return { stateUpdates: { lastEnemyAttackCheckTime: now }, logs: [] };

    let enemyAttackCounts = { ...(state.enemyAttackCounts || {}) };
    if (now - (state.lastEnemyAttackResetTime || 0) >= ENEMY_ATTACK_RESET_MS) {
        enemyAttackCounts = {};
        logs.push({ id: `attack-reset-${now}`, messageKey: 'log_attack_reset', type: 'info', timestamp: now });
    }

    const newIncomingAttacks = [...(state.incomingAttacks || [])];
    const bots = (state.rankingData?.bots || []);
    const playerPower = state.empirePoints || 0;
    const currentAttacks = newIncomingAttacks.filter(a => !a.isWarWave);
    
    let pendingCount = 0;

    bots.forEach(bot => {
        const reputation = bot.reputation ?? 50;
        if (reputation > REPUTATION_ENEMY_THRESHOLD) return;
        if (currentAttacks.length + pendingCount >= ENEMY_ATTACK_MAX_SIMULTANEOUS) return;

        const attackRecord = enemyAttackCounts[bot.id];
        if (attackRecord && attackRecord.count >= ENEMY_ATTACK_MAX_PER_BOT) return;
        if (attackRecord && now - attackRecord.lastAttackTime < ENEMY_ATTACK_COOLDOWN_MS) return;

        const botScore = bot.stats.DOMINION || bot.stats.MILITARY || 0;
        const powerRatio = botScore / Math.max(1, playerPower);
        if (powerRatio < ENEMY_ATTACK_POWER_RATIO_MIN || powerRatio > ENEMY_ATTACK_POWER_RATIO_LIMIT) return;

        const attackChance = calculateEnemyAttackChance(reputation, bot.personality);
        if (Math.random() >= attackChance) return;

        const previousAttacks = attackRecord ? attackRecord.count : 0;
        const army = generateBotArmy(botScore, 1.0 - (previousAttacks * 0.25), bot.personality, state.units);
        
        let arrivalTime = now + GLOBAL_ATTACK_TRAVEL_TIME_MS + (ENEMY_ATTACK_SIMULTANEOUS_DELAY_MS * pendingCount);
        pendingCount++;

        newIncomingAttacks.push({
            id: `enemy-attack-${bot.id}-${now}`, attackerName: bot.name, attackerId: bot.id,
            attackerScore: botScore, units: army, startTime: now, endTime: arrivalTime,
            isWarWave: false, delayCount: 0
        });

        if (!enemyAttackCounts[bot.id]) enemyAttackCounts[bot.id] = { count: 0, lastAttackTime: 0 };
        enemyAttackCounts[bot.id].count += 1;
        enemyAttackCounts[bot.id].lastAttackTime = now;

        logs.push({
            id: `enemy-attack-alert-${now}-${bot.id}`, messageKey: 'log_enemy_attack',
            type: 'combat', timestamp: now, params: { attacker: bot.name, reputation: Math.floor(reputation) }
        });
    });

    return {
        stateUpdates: {
            enemyAttackCounts,
            lastEnemyAttackCheckTime: now,
            lastEnemyAttackResetTime: (now - (state.lastEnemyAttackResetTime || 0) >= ENEMY_ATTACK_RESET_MS) ? now : (state.lastEnemyAttackResetTime || now),
            incomingAttacks: newIncomingAttacks
        },
        logs
    };
};
