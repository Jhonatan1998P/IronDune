// ============================================================
// NEMESIS ENGINE - Mirror of utils/engine/nemesis.ts
// ============================================================

import { BotPersonality } from './enums.js';
import { 
    GLOBAL_ATTACK_TRAVEL_TIME_MS, 
    NEWBIE_PROTECTION_THRESHOLD, 
    RETALIATION_TIME_MIN_MS,
    RETALIATION_TIME_MAX_MS,
    RETALIATION_GRUDGE_DURATION_MS,
    RETALIATION_MULTIPLIER_WARLORD,
    RETALIATION_MULTIPLIER_TURTLE,
    RETALIATION_MULTIPLIER_TYCOON,
    RETALIATION_MULTIPLIER_ROGUE,
    RETALIATION_CHANCE_WARLORD,
    RETALIATION_CHANCE_TURTLE,
    RETALIATION_CHANCE_TYCOON,
    RETALIATION_CHANCE_ROGUE
} from './constants.js';
import { generateBotArmy } from './missions.js';

const NOTIFICATION_LEAD_TIME_MS = 10 * 60 * 1000;

export const calculateRetaliationTime = (now) => {
    return now + RETALIATION_TIME_MIN_MS + Math.random() * (RETALIATION_TIME_MAX_MS - RETALIATION_TIME_MIN_MS);
};

export const getRetaliationChance = (personality) => {
    switch (personality) {
        case BotPersonality.WARLORD: return RETALIATION_CHANCE_WARLORD;
        case BotPersonality.TURTLE: return RETALIATION_CHANCE_TURTLE;
        case BotPersonality.TYCOON: return RETALIATION_CHANCE_TYCOON;
        case BotPersonality.ROGUE: return RETALIATION_CHANCE_ROGUE;
        default: return 0.8;
    }
};

export const getRetaliationMultiplier = (personality) => {
    switch (personality) {
        case BotPersonality.WARLORD: return RETALIATION_MULTIPLIER_WARLORD;
        case BotPersonality.TURTLE: return RETALIATION_MULTIPLIER_TURTLE;
        case BotPersonality.TYCOON: return RETALIATION_MULTIPLIER_TYCOON;
        case BotPersonality.ROGUE: return RETALIATION_MULTIPLIER_ROGUE;
        default: return 1.0;
    }
};

const launchRetaliation = (grudge, now, playerUnits) => {
    const arrivalTime = now + GLOBAL_ATTACK_TRAVEL_TIME_MS;
    const multiplier = getRetaliationMultiplier(grudge.botPersonality);
    const units = generateBotArmy(grudge.botScore, multiplier, grudge.botPersonality, playerUnits);

    return {
        id: `retal-${grudge.id}-${now}`,
        attackerName: grudge.botName,
        attackerScore: grudge.botScore,
        units,
        startTime: now,
        endTime: arrivalTime,
        isWarWave: false,
        delayCount: 0
    };
};

export const processNemesisTick = (state, now) => {
    if (!state.grudges || state.grudges.length === 0) return { stateUpdates: {}, logs: [] };

    const logs = [];
    const remainingGrudges = [];
    const newIncomingAttacks = [...(state.incomingAttacks || [])];

    const isNewbie = (state.empirePoints || 0) < NEWBIE_PROTECTION_THRESHOLD;
    const isCoolingDown = (state.nextAttackTime || 0) > now;
    const isProtected = isNewbie || isCoolingDown;

    state.grudges.forEach(grudge => {
        if (now > grudge.createdAt + RETALIATION_GRUDGE_DURATION_MS) return;

        const forceAttack = now > grudge.retaliationTime + (12 * 60 * 60 * 1000);

        if (isProtected && !forceAttack) {
            if (grudge.retaliationTime <= now) {
                const jitter = Math.random() * 5 * 60 * 1000;
                grudge.retaliationTime = isCoolingDown ? (state.nextAttackTime + jitter) : (now + 3600000);

                if (!grudge.notified) {
                    logs.push({
                        id: `intel-warn-${grudge.id}`,
                        messageKey: 'log_grudge_planning',
                        type: 'intel',
                        timestamp: now,
                        params: { attacker: grudge.botName }
                    });
                    grudge.notified = true;
                }
            }
            remainingGrudges.push(grudge);
            return;
        }

        if (now >= grudge.retaliationTime) {
            const attack = launchRetaliation(grudge, now, state.units);
            newIncomingAttacks.push(attack);
            logs.push({
                id: `retal-launch-${grudge.id}`,
                messageKey: 'alert_incoming',
                type: 'combat',
                timestamp: now,
                params: { attacker: grudge.botName }
            });
            return;
        }

        if (!grudge.notified && (grudge.retaliationTime - now <= NOTIFICATION_LEAD_TIME_MS)) {
             logs.push({
                id: `intel-imm-${grudge.id}`,
                messageKey: 'log_grudge_imminent',
                type: 'intel',
                timestamp: now,
                params: { attacker: grudge.botName }
            });
            grudge.notified = true;
        }
        remainingGrudges.push(grudge);
    });

    return {
        stateUpdates: {
            grudges: remainingGrudges,
            incomingAttacks: newIncomingAttacks
        },
        logs
    };
};
