
import { GameState, ResourceType } from '../../../types';
import { BASE_PRICES } from '../market';
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
    if (state.resources[ResourceType.DIAMOND] < amount) return { success: false, errorKey: 'missing_diamond' };
    
    const diamondsSpent = amount;
    // Base Value Calculation: Empire Points * 100
    const moneyPerDiamond = Math.max(1, state.empirePoints * 100);
    const totalMoneyValue = moneyPerDiamond * diamondsSpent;

    let resourceAmount = 0;

    if (targetResource === ResourceType.MONEY) {
        resourceAmount = totalMoneyValue;
    } else {
        // Calculate dynamic price based on Base + Event Modifiers
        const basePrice = BASE_PRICES[targetResource];
        let modifier = 1.0;
        
        if (state.activeMarketEvent && state.activeMarketEvent.priceModifiers[targetResource]) {
            modifier = state.activeMarketEvent.priceModifiers[targetResource] || 1.0;
        }
        
        const currentPrice = basePrice * modifier;
        if (currentPrice <= 0) return { success: false }; // Safety check

        resourceAmount = Math.floor(totalMoneyValue / currentPrice);
    }

    // Storage Check
    if (state.resources[targetResource] + resourceAmount > state.maxResources[targetResource]) {
        return { success: false, errorKey: 'storage_full' };
    }

    return {
        success: true,
        newState: {
            ...state,
            resources: {
                ...state.resources,
                [ResourceType.DIAMOND]: state.resources[ResourceType.DIAMOND] - diamondsSpent,
                [targetResource]: state.resources[targetResource] + resourceAmount
            }
        },
        log: {
            id: `exch-${Date.now()}`,
            messageKey: 'market',
            type: 'market',
            timestamp: Date.now(),
            params: {
                type: 'BUY',
                amount: resourceAmount,
                resource: targetResource
            }
        }
    };
};
