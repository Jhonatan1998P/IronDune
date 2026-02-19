
import { GameState, ResourceType } from '../../../types';
import { calculateDiamondExchangeRate } from '../market';
import { ActionResult } from './types';

export const executeTrade = (state: GameState, offerId: string, amount: number): ActionResult => {
    const offerIndex = state.marketOffers.findIndex(o => o.id === offerId);
    if (offerIndex === -1) return { success: false };
    
    const offer = state.marketOffers[offerIndex];
    if (amount <= 0) return { success: false };
    if (offer.amountSold + amount > offer.totalAmount) { return { success: false, errorKey: 'market_stock' }; }

    const totalCost = amount * offer.pricePerUnit;

    if (offer.type === 'BUY') { // Player Buys
        if (state.resources[ResourceType.MONEY] < totalCost) { return { success: false, errorKey: 'insufficient_funds' }; }
        if (state.resources[offer.resource] + amount > state.maxResources[offer.resource]) { return { success: false, errorKey: 'storage_full' }; }

        const newOffers = [...state.marketOffers];
        newOffers[offerIndex] = { ...offer, amountSold: offer.amountSold + amount };
        
        return {
            success: true,
            newState: {
                ...state,
                resources: {
                    ...state.resources,
                    [ResourceType.MONEY]: state.resources[ResourceType.MONEY] - totalCost,
                    [offer.resource]: state.resources[offer.resource] + amount
                },
                marketOffers: newOffers
            }
        };
    } else { // Player Sells
        if (state.resources[offer.resource] < amount) { return { success: false, errorKey: 'insufficient_funds' }; }
        if (state.resources[ResourceType.MONEY] + totalCost > state.maxResources[ResourceType.MONEY]) { return { success: false, errorKey: 'storage_full' }; }

        const newOffers = [...state.marketOffers];
        newOffers[offerIndex] = { ...offer, amountSold: offer.amountSold + amount };
        
        return {
            success: true,
            newState: {
                ...state,
                resources: {
                    ...state.resources,
                    [ResourceType.MONEY]: state.resources[ResourceType.MONEY] + totalCost,
                    [offer.resource]: state.resources[offer.resource] - amount
                },
                marketOffers: newOffers
            }
        };
    }
};

export const executeDiamondExchange = (state: GameState, targetResource: ResourceType, amount: number): ActionResult => {
    // Requires at least 1 diamond
    const currentDiamonds = state.resources[ResourceType.DIAMOND] || 0;
    if (currentDiamonds < amount) return { success: false, errorKey: 'missing_diamond' };
    
    // REFACTORED: Use the centralized formula
    const ratePerDiamond = calculateDiamondExchangeRate(targetResource, state.empirePoints, state.activeMarketEvent);
    const totalResourceAmount = ratePerDiamond * amount;

    // Ensure we have a valid amount to add
    if (totalResourceAmount <= 0) return { success: false, errorKey: 'market_limit' };

    // LOGIC: Clamp to max storage. Excess resources are simply lost as requested.
    const currentStock = state.resources[targetResource] || 0;
    const maxStock = state.maxResources[targetResource] || Number.MAX_SAFE_INTEGER;
    
    // Fill to max capacity, ignore the rest
    const newAmount = Math.min(maxStock, currentStock + totalResourceAmount);

    return {
        success: true,
        newState: {
            ...state,
            resources: {
                ...state.resources,
                [ResourceType.DIAMOND]: currentDiamonds - amount,
                [targetResource]: newAmount
            }
        },
        log: {
            id: `exch-${Date.now()}`,
            messageKey: 'market',
            type: 'market',
            timestamp: Date.now(),
            params: {
                type: 'BUY',
                amount: totalResourceAmount,
                resource: targetResource
            }
        }
    };
};
