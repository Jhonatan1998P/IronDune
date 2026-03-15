// ============================================================
// ALLIANCE REINFORCEMENTS - Mirror of utils/engine/allianceReinforcements.ts
// ============================================================

import { REPUTATION_ALLY_THRESHOLD, REINFORCEMENT_RATIO, REINFORCEMENT_CHANCE, ALLY_REINFORCEMENT_MIN_SCORE, ALLY_REINFORCEMENT_MAX_RATIO } from './constants.js';
import { generateBotArmy } from './missions.js';
import { UNIT_DEFS } from './units.js';

export const calculateReinforcementArmy = (bot, ratio = REINFORCEMENT_RATIO) => {
    return generateBotArmy(bot.stats.DOMINION || bot.stats.MILITARY, ratio, bot.personality);
};

export const willSendReinforcements = () => Math.random() < REINFORCEMENT_CHANCE;

export const calculateActiveReinforcements = (gameState, now = Date.now()) => {
    const { rankingData } = gameState;
    const playerScore = gameState.empirePoints || 0;
    const maxAllyScore = Math.max(playerScore * ALLY_REINFORCEMENT_MAX_RATIO, ALLY_REINFORCEMENT_MIN_SCORE * ALLY_REINFORCEMENT_MAX_RATIO);
    
    const alliedBots = (rankingData.bots || []).filter(bot => {
        const rep = bot.reputation ?? 50;
        const botScore = bot.stats.DOMINION || bot.stats.MILITARY || 0;
        return rep >= REPUTATION_ALLY_THRESHOLD && botScore >= ALLY_REINFORCEMENT_MIN_SCORE && botScore <= maxAllyScore;
    });

    alliedBots.sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0));

    const activeReinforcements = [];
    for (const bot of alliedBots) {
        if (willSendReinforcements()) {
            const army = calculateReinforcementArmy(bot);
            const totalUnits = Object.values(army).reduce((sum, count) => sum + (count || 0), 0);
            const estimatedArrival = now + (1 + Math.random() * 2) * 60 * 1000;

            activeReinforcements.push({
                botId: bot.id,
                botName: bot.name,
                botScore: bot.stats.DOMINION || bot.stats.MILITARY,
                reputation: bot.reputation ?? 50,
                units: army,
                totalUnits,
                estimatedArrival
            });
        }
    }
    return activeReinforcements;
};
