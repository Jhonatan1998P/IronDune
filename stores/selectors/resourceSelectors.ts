import type { ResourceState } from '../resourceStore';

export const selectInterpolatedResources = (state: ResourceState) => state.interpolatedResources;
export const selectResourceRates = (state: ResourceState) => state.rates;
export const selectMaxResources = (state: ResourceState) => state.maxResources;
export const selectBankBalance = (state: ResourceState) => state.bankBalance;
export const selectInterestRate = (state: ResourceState) => state.interestRate;
export const selectIsRealtimeConnected = (state: ResourceState) => state.isRealtimeConnected;
