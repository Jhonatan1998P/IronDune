import { BotPersonality, GameState, IncomingAttack, LogEntry, ResourceType } from '../../types';
import { RankingCategory } from './rankings';
import { generateBotArmy } from './missions';
import {
    ENEMY_ATTACK_CHECK_INTERVAL_MS,
    ENEMY_ATTACK_COOLDOWN_MS,
    ENEMY_ATTACK_MAX_PER_BOT,
    ENEMY_ATTACK_RESET_MS,
    ENEMY_ATTACK_BASE_CHANCE,
    ENEMY_ATTACK_CHANCE_MULTIPLIER,
    ENEMY_ATTACK_CHANCE_WARLORD,
    ENEMY_ATTACK_CHANCE_TURTLE,
    ENEMY_ATTACK_CHANCE_TYCOON,
    ENEMY_ATTACK_CHANCE_ROGUE,
    ENEMY_ATTACK_POWER_RATIO_LIMIT,
    ENEMY_ATTACK_SIMULTANEOUS_DELAY_MS,
    RETALIATION_TIME_MIN_MS,
    RETALIATION_TIME_MAX_MS,
    RETALIATION_CHANCE_WARLORD,
    RETALIATION_CHANCE_TURTLE,
    RETALIATION_CHANCE_TYCOON,
    RETALIATION_CHANCE_ROGUE,
    RETALIATION_MULTIPLIER_WARLORD,
    RETALIATION_MULTIPLIER_TURTLE,
    RETALIATION_MULTIPLIER_TYCOON,
    RETALIATION_MULTIPLIER_ROGUE,
    RETALIATION_GRUDGE_DURATION_MS,
    REPUTATION_ENEMY_THRESHOLD,
    REPUTATION_ALLY_THRESHOLD,
    PVP_TRAVEL_TIME_MS,
    NEWBIE_PROTECTION_THRESHOLD
} from '../../constants';

/**
 * Calculate attack chance based on reputation and personality
 * Lower reputation = higher chance to attack
 */
export const calculateEnemyAttackChance = (reputation: number, personality: BotPersonality): number => {
    // Only bots with reputation <= 30 can attack
    if (reputation > REPUTATION_ENEMY_THRESHOLD) {
        return 0;
    }

    // Base chance at rep 30, increases as rep goes down
    const repDifference = REPUTATION_ENEMY_THRESHOLD - reputation;
    let baseChance = ENEMY_ATTACK_BASE_CHANCE + (repDifference * ENEMY_ATTACK_CHANCE_MULTIPLIER);

    // Cap at 100%
    baseChance = Math.min(1.0, baseChance);

    // Apply personality modifier
    let personalityMultiplier = 1.0;
    switch (personality) {
        case BotPersonality.WARLORD:
            personalityMultiplier = ENEMY_ATTACK_CHANCE_WARLORD;
            break;
        case BotPersonality.TURTLE:
            personalityMultiplier = ENEMY_ATTACK_CHANCE_TURTLE;
            break;
        case BotPersonality.TYCOON:
            personalityMultiplier = ENEMY_ATTACK_CHANCE_TYCOON;
            break;
        case BotPersonality.ROGUE:
            personalityMultiplier = ENEMY_ATTACK_CHANCE_ROGUE;
            break;
    }

    return Math.min(1.0, baseChance * personalityMultiplier);
};

/**
 * Calculate retaliation time (15-45 minutes random)
 */
export const calculateRetaliationTime = (now: number): number => {
    return now + RETALIATION_TIME_MIN_MS + Math.random() * (RETALIATION_TIME_MAX_MS - RETALIATION_TIME_MIN_MS);
};

/**
 * Get retaliation chance based on personality
 */
export const getRetaliationChance = (personality: BotPersonality): number => {
    switch (personality) {
        case BotPersonality.WARLORD:
            return RETALIATION_CHANCE_WARLORD;
        case BotPersonality.TURTLE:
            return RETALIATION_CHANCE_TURTLE;
        case BotPersonality.TYCOON:
            return RETALIATION_CHANCE_TYCOON;
        case BotPersonality.ROGUE:
            return RETALIATION_CHANCE_ROGUE;
        default:
            return 0.8;
    }
};

/**
 * Get retaliation army multiplier based on personality
 */
export const getRetaliationMultiplier = (personality: BotPersonality): number => {
    switch (personality) {
        case BotPersonality.WARLORD:
            return RETALIATION_MULTIPLIER_WARLORD;
        case BotPersonality.TURTLE:
            return RETALIATION_MULTIPLIER_TURTLE;
        case BotPersonality.TYCOON:
            return RETALIATION_MULTIPLIER_TYCOON;
        case BotPersonality.ROGUE:
            return RETALIATION_MULTIPLIER_ROGUE;
        default:
            return 1.0;
    }
};

/**
 * Create a grudge when player attacks a bot
 * The retaliation roll happens NOW - determines if bot will seek vengeance
 */
export const createGrudge = (
    state: GameState,
    botId: string,
    botName: string,
    botScore: number,
    botPersonality: BotPersonality,
    now: number
): { grudgeCreated: boolean; log: LogEntry | null } => {
    const bot = state.rankingData.bots.find(b => b.id === botId);
    const reputation = bot?.reputation ?? 50;

    // Roll for retaliation immediately when attacked
    const retaliationChance = getRetaliationChance(botPersonality);
    const willRetaliate = Math.random() < retaliationChance;

    if (!willRetaliate) {
        // Bot decides not to seek vengeance
        return {
            grudgeCreated: false,
            log: {
                id: `grudge-decay-${now}-${botId}`,
                messageKey: 'log_grudge_decayed',
                type: 'intel',
                timestamp: now,
                params: { attacker: botName }
            }
        };
    }

    // Create grudge with random retaliation time
    const retaliationTime = calculateRetaliationTime(now);
    const grudgeId = `grudge-${botId}-${now}`;

    return {
        grudgeCreated: true,
        log: {
            id: `grudge-created-${now}-${botId}`,
            messageKey: 'log_grudge_created',
            type: 'intel',
            timestamp: now,
            params: {
                attacker: botName,
                retaliationTime: new Date(retaliationTime).toLocaleTimeString()
            }
        }
    };
};

/**
 * Process enemy attack checks (every 30 minutes)
 * Checks if enemy bots should attack the player
 */
export const processEnemyAttackCheck = (state: GameState, now: number): { stateUpdates: Partial<GameState>, logs: LogEntry[] } => {
    const logs: LogEntry[] = [];
    const elapsedSinceLastCheck = now - state.lastEnemyAttackCheckTime;

    // Only check every 30 minutes
    if (elapsedSinceLastCheck < ENEMY_ATTACK_CHECK_INTERVAL_MS) {
        return { stateUpdates: {}, logs: [] };
    }

    // Check if newbie protection is active
    const isNewbie = state.empirePoints < NEWBIE_PROTECTION_THRESHOLD;
    if (isNewbie) {
        // Reset check time but don't spawn attacks
        return {
            stateUpdates: {
                lastEnemyAttackCheckTime: now
            },
            logs: []
        };
    }

    // Reset attack counts if 24 hours have passed
    let enemyAttackCounts = { ...state.enemyAttackCounts };
    if (now - state.lastEnemyAttackResetTime >= ENEMY_ATTACK_RESET_MS) {
        enemyAttackCounts = {};
        logs.push({
            id: `attack-reset-${now}`,
            messageKey: 'log_attack_reset',
            type: 'info',
            timestamp: now,
            params: {}
        });
    }

    const newIncomingAttacks = [...state.incomingAttacks];
    const bots = state.rankingData.bots;
    const playerPower = state.empirePoints;

    // Track simultaneous attacks for delay calculation
    let pendingAttacks: { bot: typeof bots[0], arrivalTime: number }[] = [];

    // Check each bot for potential attack
    bots.forEach(bot => {
        const reputation = bot.reputation ?? 50;

        // Only bots with reputation <= 30 can attack
        if (reputation > REPUTATION_ENEMY_THRESHOLD) {
            return;
        }

        // Check if bot has reached max attacks
        const attackRecord = enemyAttackCounts[bot.id];
        if (attackRecord && attackRecord.count >= ENEMY_ATTACK_MAX_PER_BOT) {
            return;
        }

        // Check cooldown (2 hours between attacks from same bot)
        if (attackRecord && now - attackRecord.lastAttackTime < ENEMY_ATTACK_COOLDOWN_MS) {
            return;
        }

        // NEW: Check power ratio - bot can only attack if <= 150% of player power
        const botScore = bot.stats[RankingCategory.DOMINION];
        const powerRatio = botScore / Math.max(1, playerPower);
        if (powerRatio > ENEMY_ATTACK_POWER_RATIO_LIMIT) {
            return; // Bot is too powerful to attack
        }

        // Calculate attack chance based on reputation and personality
        const attackChance = calculateEnemyAttackChance(reputation, bot.personality);

        // Roll for attack
        if (Math.random() >= attackChance) {
            return; // Bot doesn't attack this cycle
        }

        // Bot attacks!
        const army = generateBotArmy(botScore, 1.0, bot.personality);
        
        // Calculate arrival time with delay for simultaneous attacks
        let arrivalTime = now + PVP_TRAVEL_TIME_MS;
        if (pendingAttacks.length > 0) {
            // Add 5 minute delay for each previous pending attack
            arrivalTime += ENEMY_ATTACK_SIMULTANEOUS_DELAY_MS * pendingAttacks.length;
        }
        
        pendingAttacks.push({ bot, arrivalTime });

        const attack: IncomingAttack = {
            id: `enemy-attack-${bot.id}-${now}`,
            attackerName: bot.name,
            attackerScore: botScore,
            units: army,
            startTime: now,
            endTime: arrivalTime,
            isWarWave: false,
            delayCount: 0
        };

        newIncomingAttacks.push(attack);

        // Update attack count
        if (!enemyAttackCounts[bot.id]) {
            enemyAttackCounts[bot.id] = { count: 0, lastAttackTime: 0 };
        }
        enemyAttackCounts[bot.id].count += 1;
        enemyAttackCounts[bot.id].lastAttackTime = now;

        logs.push({
            id: `enemy-attack-alert-${now}-${bot.id}`,
            messageKey: 'log_enemy_attack',
            type: 'combat',
            timestamp: now,
            params: {
                attacker: bot.name,
                reputation: Math.floor(reputation)
            }
        });
    });

    return {
        stateUpdates: {
            enemyAttackCounts,
            lastEnemyAttackCheckTime: now,
            lastEnemyAttackResetTime: (now - state.lastEnemyAttackResetTime >= ENEMY_ATTACK_RESET_MS) ? now : (state.lastEnemyAttackResetTime || now),
            incomingAttacks: newIncomingAttacks
        },
        logs
    };
};

/**
 * Initialize enemy attack state for new games
 */
export const initializeEnemyAttackState = (now: number) => ({
    enemyAttackCounts: {},
    lastEnemyAttackCheckTime: now,
    lastEnemyAttackResetTime: now
});
