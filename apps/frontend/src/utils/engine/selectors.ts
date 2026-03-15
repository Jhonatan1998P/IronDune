
import { BuildingType, GameState, ResourceType } from '../../types';
import { calculateProductionRates, calculateUpkeepCosts, calculateTechMultipliers } from './modifiers';

/**
 * Calculates current resource generation and consumption rates based on game state.
 * Includes visual projections like Bank Interest.
 */
export const getIncomeStats = (state: GameState): { production: Record<ResourceType, number>; upkeep: Record<ResourceType, number> } => {
    const techMultipliers = calculateTechMultipliers(state.researchedTechs, state.techLevels);
    
    // Get base rates per second from modifiers
    const production = calculateProductionRates(state.buildings, techMultipliers);
    const upkeep = calculateUpkeepCosts(state.units);

    // Add Bank Interest visual projection
    // Note: In engine loop, interest is added directly to balance, not technically a "production rate" of the MONEY resource.
    // However, for UI clarity, we calculate the equivalent per-second rate here.
    if (state.bankBalance > 0 && state.buildings[BuildingType.BANK].level > 0) {
        // Logic mirrors utils/engine/economy.ts
        // Interest rate is per 24 hours (24 * 60 = 1440 minutes)
        const minuteRate = state.currentInterestRate / 1440; 
        const interestPerMinute = state.bankBalance * minuteRate;
        // Add to per-second rate for display
        production[ResourceType.MONEY] += (interestPerMinute / 60);
    }

    return { production, upkeep };
};
