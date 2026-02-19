
import { BuildingType, GameState, ResourceType } from '../../types';
import { calculateTechMultipliers, calculateMaxStorage, calculateProductionRates, calculateUpkeepCosts, calculateMaxBankCapacity } from './modifiers';
import { generateMarketState } from './market';

const RATE_CHANGE_INTERVAL = 60 * 60 * 1000; // 1 Hour

/**
 * Handles resource production, consumption, bank interest, and market refreshes.
 */
export const processEconomyTick = (state: GameState, deltaTimeMs: number, now: number): Partial<GameState> => {
    const timeMultiplier = deltaTimeMs / 1000;
    const multipliers = calculateTechMultipliers(state.researchedTechs, state.techLevels);
    const prodRates = calculateProductionRates(state.buildings, multipliers);
    const upkeepCosts = calculateUpkeepCosts(state.units);
    const maxStorage = calculateMaxStorage(state.buildings, multipliers, state.empirePoints);
    
    // 1. Resource Accumulation
    const newResources = { ...state.resources };
    const resourcesMinedIncrement = { value: 0 };

    Object.values(ResourceType).forEach((res) => {
        const prod = (prodRates[res] || 0) * timeMultiplier;
        const upkeep = (upkeepCosts[res] || 0) * timeMultiplier;
        let netChange = prod - upkeep;
        
        // Base Diamond Production Logic (1 per Hour)
        if (res === ResourceType.DIAMOND) {
            // Check damage state
            const diamondMine = state.buildings[BuildingType.DIAMOND_MINE];
            if (diamondMine && !diamondMine.isDamaged) {
                // 1 Diamond / 3600 seconds * timeMultiplier
                const baseDiamondProd = (1 / 3600) * timeMultiplier;
                netChange += baseDiamondProd;
            }
        }

        if (prod > 0 && res !== ResourceType.DIAMOND) {
            resourcesMinedIncrement.value += prod;
        }
        
        newResources[res] = Math.max(0, Math.min(maxStorage[res], newResources[res] + netChange));
    });

    // 2. Bank Logic
    let newBankBalance = state.bankBalance;
    let newRate = state.currentInterestRate;
    let newNextRateChange = state.nextRateChangeTime;
    const bankLevel = state.buildings[BuildingType.BANK].level;

    if (now >= state.nextRateChangeTime) {
       // High Volatility: Random between 2% (0.02) and 10% (0.10)
       newRate = Math.random() * (0.10 - 0.02) + 0.02;
       newNextRateChange = now + RATE_CHANGE_INTERVAL;
    }

    if (newBankBalance > 0 && bankLevel > 0) {
        const maxBankCapacity = calculateMaxBankCapacity(state.empirePoints, bankLevel);
        if (newBankBalance < maxBankCapacity) {
            const minuteRate = newRate / 360; 
            const timeInMinutes = deltaTimeMs / 60000;
            const interestEarned = newBankBalance * minuteRate * timeInMinutes;
            newBankBalance = Math.min(maxBankCapacity, newBankBalance + interestEarned);
        }
    }

    // 3. Market Refresh
    let newMarketOffers = [...state.marketOffers];
    let newActiveMarketEvent = state.activeMarketEvent;
    let newMarketNextRefreshTime = state.marketNextRefreshTime;

    if (now >= state.marketNextRefreshTime) {
        const marketLevel = state.buildings[BuildingType.MARKET].level;
        const marketData = generateMarketState(state.empirePoints, marketLevel);
        newMarketOffers = marketData.offers;
        newActiveMarketEvent = marketData.event;
        newMarketNextRefreshTime = marketData.nextRefresh;
    }

    return {
        resources: newResources,
        maxResources: maxStorage,
        bankBalance: newBankBalance,
        currentInterestRate: newRate,
        nextRateChangeTime: newNextRateChange,
        marketOffers: newMarketOffers,
        activeMarketEvent: newActiveMarketEvent,
        marketNextRefreshTime: newMarketNextRefreshTime,
        lifetimeStats: {
            ...state.lifetimeStats,
            resourcesMined: state.lifetimeStats.resourcesMined + resourcesMinedIncrement.value
        }
    };
};
