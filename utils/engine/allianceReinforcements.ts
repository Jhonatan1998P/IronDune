import { GameState, StaticBot, UnitType } from '../../types';
import { RankingCategory } from './rankings';
import { REPUTATION_ALLY_THRESHOLD } from '../../constants';
import { generateBotArmy } from './missions';

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
 * Calculate potential reinforcement forces from allied bots
 * Allies are bots with reputation >= ALLY_THRESHOLD (70)
 */
export const calculatePotentialReinforcements = (
    gameState: GameState,
    now: number = Date.now()
): ReinforcementEntry[] => {
    const { rankingData, empirePoints } = gameState;
    
    // Filter allied bots (reputation >= 70)
    const alliedBots = rankingData.bots.filter(bot => {
        const rep = bot.reputation ?? 50;
        return rep >= REPUTATION_ALLY_THRESHOLD;
    });

    // Sort by reputation (highest first)
    alliedBots.sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0));

    // Calculate reinforcement army for each ally
    const reinforcements: ReinforcementEntry[] = alliedBots.map(bot => {
        // Allies send 30% of their military strength as reinforcements
        const reinforcementRatio = 0.3;
        const army = generateBotArmy(bot.stats[RankingCategory.DOMINION], reinforcementRatio, bot.personality);
        
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
 * Get total garrisoned units for the player
 */
export const getPlayerGarrison = (gameState: GameState): {
    units: Partial<Record<UnitType, number>>;
    totalUnits: number;
    totalPower: number;
} => {
    const units = gameState.units;
    const totalUnits = Object.values(units).reduce((sum, count) => sum + (count || 0), 0);
    
    // Calculate total power based on unit stats
    const { UNIT_DEFS } = require('../../data/units');
    let totalPower = 0;
    
    Object.entries(units).forEach(([unitType, count]) => {
        if (count && count > 0) {
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
