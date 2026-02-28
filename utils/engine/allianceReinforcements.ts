import { GameState, UnitType } from '../../types';
import { RankingCategory, StaticBot } from './rankings';
import { REPUTATION_ALLY_THRESHOLD, REINFORCEMENT_RATIO, REINFORCEMENT_CHANCE, ALLY_REINFORCEMENT_MIN_SCORE, ALLY_REINFORCEMENT_MAX_RATIO } from '../../constants';
import { generateBotArmy } from './missions';
import { UNIT_DEFS } from '../../data/units';
import { BotPersonality } from '../../types/enums';

export interface ReinforcementEntry {
    botId: string;
    botName: string;
    botScore: number;
    reputation: number;
    units: Partial<Record<UnitType, number>>;
    totalUnits: number;
    estimatedArrival: number; // Time in ms
}

/**
 * Calculate reinforcement army for an ally bot
 * Allies send 5% of their total military budget (attack + defense = 100%)
 */
export const calculateReinforcementArmy = (
    bot: StaticBot,
    ratio: number = REINFORCEMENT_RATIO
): Partial<Record<UnitType, number>> => {
    // Generate army using the bot's full military budget, then apply reinforcement ratio
    // generateBotArmy already combines attack + defense budgets (100% total)
    const fullArmy = generateBotArmy(
        bot.stats[RankingCategory.DOMINION],
        ratio, // Use reinforcement ratio (5%) instead of full budget
        bot.personality
    );
    return fullArmy;
};

/**
 * Check if an ally bot will send reinforcements based on 15% chance
 */
export const willSendReinforcements = (): boolean => {
    return Math.random() < REINFORCEMENT_CHANCE;
};

/**
 * Calculate potential reinforcement forces from allied bots
 * Allies are bots with reputation >= ALLY_THRESHOLD (75)
 */
export const calculatePotentialReinforcements = (
    gameState: GameState,
    now: number = Date.now()
): ReinforcementEntry[] => {
    const { rankingData } = gameState;

    // Filter allied bots (reputation >= 75) AND within score range
    const playerScore = gameState.empirePoints || 0;
    const maxAllyScore = Math.max(playerScore * ALLY_REINFORCEMENT_MAX_RATIO, ALLY_REINFORCEMENT_MIN_SCORE * ALLY_REINFORCEMENT_MAX_RATIO);
    
    const alliedBots = rankingData.bots.filter(bot => {
        const rep = bot.reputation ?? 50;
        const botScore = bot.stats[RankingCategory.DOMINION] || 0;
        return rep >= REPUTATION_ALLY_THRESHOLD && 
               botScore >= ALLY_REINFORCEMENT_MIN_SCORE && 
               botScore <= maxAllyScore;
    });

    // Sort by reputation (highest first)
    alliedBots.sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0));

    // Calculate reinforcement army for each ally
    const reinforcements: ReinforcementEntry[] = alliedBots.map(bot => {
        const army = calculateReinforcementArmy(bot);

        const totalUnits = Object.values(army).reduce((sum, count) => sum + (count || 0), 0);

        // Estimated arrival: 5-15 minutes based on distance (simulated)
        const estimatedArrival = now + (5 + Math.random() * 10) * 60 * 1000;

        return {
            botId: bot.id,
            botName: bot.name,
            botScore: bot.stats[RankingCategory.DOMINION],
            reputation: bot.reputation ?? 50,
            units: army,
            totalUnits,
            estimatedArrival
        };
    });

    return reinforcements;
};

/**
 * Calculate reinforcements when player is under attack
 * Each ally has 15% chance to send help
 */
export const calculateActiveReinforcements = (
    gameState: GameState,
    now: number = Date.now()
): ReinforcementEntry[] => {
    const { rankingData } = gameState;

    // Filter allied bots (reputation >= 75) AND within score range
    const playerScore = gameState.empirePoints || 0;
    const maxAllyScore = Math.max(playerScore * ALLY_REINFORCEMENT_MAX_RATIO, ALLY_REINFORCEMENT_MIN_SCORE * ALLY_REINFORCEMENT_MAX_RATIO);
    
    const alliedBots = rankingData.bots.filter(bot => {
        const rep = bot.reputation ?? 50;
        const botScore = bot.stats[RankingCategory.DOMINION] || 0;
        return rep >= REPUTATION_ALLY_THRESHOLD && 
               botScore >= ALLY_REINFORCEMENT_MIN_SCORE && 
               botScore <= maxAllyScore;
    });

    // Sort by reputation (highest first)
    alliedBots.sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0));

    // Each ally has 15% chance to send reinforcements
    const activeReinforcements: ReinforcementEntry[] = [];

    for (const bot of alliedBots) {
        if (willSendReinforcements()) {
            const army = calculateReinforcementArmy(bot);
            const totalUnits = Object.values(army).reduce((sum, count) => sum + (count || 0), 0);

            // Reinforcements arrive almost instantly (1-3 minutes)
            const estimatedArrival = now + (1 + Math.random() * 2) * 60 * 1000;

            activeReinforcements.push({
                botId: bot.id,
                botName: bot.name,
                botScore: bot.stats[RankingCategory.DOMINION],
                reputation: bot.reputation ?? 50,
                units: army,
                totalUnits,
                estimatedArrival
            });
        }
    }

    return activeReinforcements;
};

/**
 * Get total garrisoned units for the player
 */
export const getPlayerGarrison = (gameState: GameState): {
    units: Partial<Record<UnitType, number>>;
    totalUnits: number;
    totalPower: number;
} => {
    const units = gameState.units;
    let totalUnits = 0;
    let totalPower = 0;

    Object.entries(units).forEach(([unitType, count]) => {
        // Only count positive unit counts
        if (count && count > 0) {
            totalUnits += count;
            
            const def = UNIT_DEFS[unitType as UnitType];
            if (def) {
                // Power = HP * Attack * Defense (simplified)
                const unitPower = def.hp * def.attack * def.defense;
                totalPower += unitPower * count;
            }
        }
    });

    return {
        units,
        totalUnits,
        totalPower
    };
};

/**
 * Check if player is under attack and needs reinforcements
 */
export const isPlayerUnderThreat = (gameState: GameState): boolean => {
    return (
        gameState.incomingAttacks.length > 0 ||
        gameState.activeWar !== null ||
        gameState.grudges.length > 0
    );
};
