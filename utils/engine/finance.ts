
import { BuildingType, GameState, ResourceType } from '../../types';
import { ActionResult } from './actions';
import { calculateMaxBankCapacity } from './modifiers';

export const executeBankTransaction = (state: GameState, amount: number, type: 'deposit' | 'withdraw'): ActionResult => {
    const bankLevel = state.buildings[BuildingType.BANK].level;
    if (bankLevel < 1) {
        return { success: false, errorKey: 'req_building' };
    }

    if (amount <= 0) {
        return { success: false };
    }

    const maxBankBalance = calculateMaxBankCapacity(state.empirePoints, bankLevel);

    if (type === 'deposit') {
        // Validation: Cannot deposit if already full or if deposit would exceed capacity
        if (state.bankBalance >= maxBankBalance) {
            return { success: false, errorKey: 'storage_full' };
        }
        
        if (state.bankBalance + amount > maxBankBalance) {
            return { success: false, errorKey: 'storage_full' };
        }

        if (state.resources[ResourceType.MONEY] < amount) {
            return { success: false, errorKey: 'insufficient_funds' };
        }

        const newState = {
            ...state,
            resources: {
                ...state.resources,
                [ResourceType.MONEY]: state.resources[ResourceType.MONEY] - amount
            },
            bankBalance: state.bankBalance + amount
        };

        return { success: true, newState };

    } else {
        // Withdraw
        if (state.bankBalance < amount) {
            return { success: false, errorKey: 'insufficient_funds' };
        }

        const newState = {
            ...state,
            resources: {
                ...state.resources,
                [ResourceType.MONEY]: Math.min(state.maxResources[ResourceType.MONEY], state.resources[ResourceType.MONEY] + amount)
            },
            bankBalance: state.bankBalance - amount
        };

        return { success: true, newState };
    }
};
