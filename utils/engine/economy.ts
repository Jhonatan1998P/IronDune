
import { BuildingType, GameState, ResourceType } from '../../types';
import { calculateTechMultipliers, calculateMaxStorage, calculateProductionRates, calculateUpkeepCosts, calculateMaxBankCapacity } from './modifiers';
import { generateMarketState } from './market';

const RATE_CHANGE_INTERVAL = 24 * 60 * 60 * 1000; // 24 Hours
const MIN_INTEREST_RATE = 0.025; // 2.5%
const MAX_INTEREST_RATE = 0.10; // 10%

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
        
        // Diamond Production: 1 diamond per hour per level
        if (res === ResourceType.DIAMOND) {
            const diamondMine = state.buildings[BuildingType.DIAMOND_MINE];
            if (diamondMine && diamondMine.level > 0 && !diamondMine.isDamaged) {
                // diamondMine.level diamonds per hour = diamondMine.level / 3600 per second
                const diamondProd = (diamondMine.level / 3600) * timeMultiplier;
                netChange += diamondProd;
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
       // Interest rate changes every 24 hours: Random between 2.5% (0.025) and 10% (0.10)
       newRate = Math.random() * (MAX_INTEREST_RATE - MIN_INTEREST_RATE) + MIN_INTEREST_RATE;
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
