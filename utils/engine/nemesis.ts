import { BotPersonality, UnitType } from '../../types/enums';
import { GameState, Grudge, IncomingAttack, LogEntry } from '../../types';
import { 
    PVP_TRAVEL_TIME_MS, 
    NEWBIE_PROTECTION_THRESHOLD, 
    REPUTATION_ALLY_THRESHOLD, 
    REPUTATION_ENEMY_THRESHOLD,
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
} from '../../constants';
import { generateBotArmy } from './missions';

const NOTIFICATION_LEAD_TIME_MS = 10 * 60 * 1000; // 10 Minutes warning before attack launch if planned

// --- HELPER: CALCULATE RETALIATION TIME (15-45 min random) ---
export const calculateRetaliationTime = (now: number): number => {
    return now + RETALIATION_TIME_MIN_MS + Math.random() * (RETALIATION_TIME_MAX_MS - RETALIATION_TIME_MIN_MS);
};

// --- HELPER: GET RETALIATION CHANCE BY PERSONALITY ---
export const getRetaliationChance = (personality: BotPersonality): number => {
    switch (personality) {
        case BotPersonality.WARLORD:
            return RETALIATION_CHANCE_WARLORD; // 95% - very vengeful
        case BotPersonality.TURTLE:
            return RETALIATION_CHANCE_TURTLE; // 85% - holds grudges
        case BotPersonality.TYCOON:
            return RETALIATION_CHANCE_TYCOON; // 70% - busy making money
        case BotPersonality.ROGUE:
            return RETALIATION_CHANCE_ROGUE; // 90% - unpredictable but vengeful
        default:
            return 0.8;
    }
};

// --- HELPER: GET RETALIATION MULTIPLIER BY PERSONALITY ---
export const getRetaliationMultiplier = (personality: BotPersonality): number => {
    switch (personality) {
        case BotPersonality.WARLORD:
            return RETALIATION_MULTIPLIER_WARLORD; // 30% stronger
        case BotPersonality.TURTLE:
            return RETALIATION_MULTIPLIER_TURTLE; // 50% stronger (deathball)
        case BotPersonality.TYCOON:
            return RETALIATION_MULTIPLIER_TYCOON; // Normal strength
        case BotPersonality.ROGUE:
            return RETALIATION_MULTIPLIER_ROGUE; // Normal strength
        default:
            return 1.0;
    }
};

// --- HELPER: CREATE INCOMING ATTACK ---
const launchRetaliation = (grudge: Grudge, now: number): IncomingAttack => {
    const arrivalTime = now + PVP_TRAVEL_TIME_MS;

    // Personality affects army strength via multiplier
    const multiplier = getRetaliationMultiplier(grudge.botPersonality);
    const units = generateBotArmy(grudge.botScore, multiplier, grudge.botPersonality);

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

// --- MAIN LOOP: PROCESS GRUDGES ---
export const processNemesisTick = (state: GameState, now: number): { stateUpdates: Partial<GameState>, logs: LogEntry[] } => {
    if (!state.grudges || state.grudges.length === 0) return { stateUpdates: {}, logs: [] };

    const logs: LogEntry[] = [];
    const remainingGrudges: Grudge[] = [];
    const newIncomingAttacks: IncomingAttack[] = [...state.incomingAttacks];

    // Check if player is protected
    const isNewbie = state.empirePoints < NEWBIE_PROTECTION_THRESHOLD;
    const isCoolingDown = state.nextAttackTime > now;
    const isProtected = isNewbie || isCoolingDown;

    state.grudges.forEach(grudge => {
        // 1. Expire old grudges (48h to hold a grudge)
        if (now > grudge.createdAt + RETALIATION_GRUDGE_DURATION_MS) {
            // Grudge forgotten
            return;
        }

        // Bots with "Vengeance" in mind will ignore protection if enough time has passed
        const forceAttack = now > grudge.retaliationTime + (12 * 60 * 60 * 1000);

        // 2. Logic: Wake-Up Call (Protection Active)
        if (isProtected && !forceAttack) {
            // If retaliation time has passed BUT player is protected,
            // we reschedule the attack for EXACTLY when protection ends (plus a small random jitter).
            // This creates the "Wake-Up Call" effect where attacks land right after shield drop.

            const protectionEnd = Math.max(state.nextAttackTime, now);

            if (grudge.retaliationTime <= now) {
                // Reschedule to future
                const jitter = Math.random() * 5 * 60 * 1000; // 0-5 mins jitter
                const newTarget = isCoolingDown ? (state.nextAttackTime + jitter) : (now + 3600000);

                grudge.retaliationTime = newTarget;

                // NOTIFICATION LOGIC
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

        // 3. Logic: Active Retaliation (No Protection)
        if (now >= grudge.retaliationTime) {
            // The retaliation roll already happened when grudge was created
            // Now we just launch the attack
            const attack = launchRetaliation(grudge, now);
            newIncomingAttacks.push(attack);

            logs.push({
                id: `retal-launch-${grudge.id}`,
                messageKey: 'alert_incoming',
                type: 'combat',
                timestamp: now,
                params: { attacker: grudge.botName }
            });

            // Grudge is satisfied and removed
            return;
        }

        // 4. Pre-Attack Notification (10 mins before)
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

    // Only return updates if changes occurred
    if (remainingGrudges.length !== state.grudges.length || newIncomingAttacks.length !== state.incomingAttacks.length || logs.length > 0) {
        return {
            stateUpdates: {
                grudges: remainingGrudges,
                incomingAttacks: newIncomingAttacks
            },
            logs
        };
    }

    return { stateUpdates: {}, logs: [] };
};
