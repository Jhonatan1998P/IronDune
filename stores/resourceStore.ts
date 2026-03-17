import { create } from 'zustand';
import { ResourceType } from '../types';

export interface ServerResourceSnapshot {
  money: number;
  oil: number;
  ammo: number;
  gold: number;
  diamond: number;
  money_rate: number;
  oil_rate: number;
  ammo_rate: number;
  gold_rate: number;
  diamond_rate: number;
  money_max: number;
  oil_max: number;
  ammo_max: number;
  gold_max: number;
  diamond_max: number;
  bank_balance: number;
  interest_rate: number;
  last_tick_at?: string;
}

export interface ResourceState {
  resources: Record<ResourceType, number>;
  rates: Record<ResourceType, number>;
  maxResources: Record<ResourceType, number>;
  bankBalance: number;
  interestRate: number;
  lastServerTick: number;
  isRealtimeConnected: boolean;
  interpolatedResources: Record<ResourceType, number>;
  applyServerSnapshot: (payload: ServerResourceSnapshot) => void;
  interpolate: (now: number) => void;
  setRealtimeConnected: (connected: boolean) => void;
}

const INITIAL_RESOURCES: Record<ResourceType, number> = {
  [ResourceType.MONEY]: 5000,
  [ResourceType.OIL]: 2500,
  [ResourceType.AMMO]: 1500,
  [ResourceType.GOLD]: 500,
  [ResourceType.DIAMOND]: 5,
};

const INITIAL_RATES: Record<ResourceType, number> = {
  [ResourceType.MONEY]: 0,
  [ResourceType.OIL]: 0,
  [ResourceType.AMMO]: 0,
  [ResourceType.GOLD]: 0,
  [ResourceType.DIAMOND]: 0,
};

const INITIAL_MAX: Record<ResourceType, number> = {
  [ResourceType.MONEY]: 999_999_999_999_999,
  [ResourceType.OIL]: 999_999_999_999_999,
  [ResourceType.AMMO]: 999_999_999_999_999,
  [ResourceType.GOLD]: 999_999_999_999_999,
  [ResourceType.DIAMOND]: 10,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const useResourceStore = create<ResourceState>((set, get) => ({
  resources: INITIAL_RESOURCES,
  rates: INITIAL_RATES,
  maxResources: INITIAL_MAX,
  bankBalance: 0,
  interestRate: 0.15,
  lastServerTick: Date.now(),
  isRealtimeConnected: false,
  interpolatedResources: INITIAL_RESOURCES,

  applyServerSnapshot: (payload) => {
    const resources = {
      [ResourceType.MONEY]: payload.money,
      [ResourceType.OIL]: payload.oil,
      [ResourceType.AMMO]: payload.ammo,
      [ResourceType.GOLD]: payload.gold,
      [ResourceType.DIAMOND]: payload.diamond,
    };
    const rates = {
      [ResourceType.MONEY]: payload.money_rate,
      [ResourceType.OIL]: payload.oil_rate,
      [ResourceType.AMMO]: payload.ammo_rate,
      [ResourceType.GOLD]: payload.gold_rate,
      [ResourceType.DIAMOND]: payload.diamond_rate,
    };
    const maxResources = {
      [ResourceType.MONEY]: payload.money_max,
      [ResourceType.OIL]: payload.oil_max,
      [ResourceType.AMMO]: payload.ammo_max,
      [ResourceType.GOLD]: payload.gold_max,
      [ResourceType.DIAMOND]: payload.diamond_max,
    };
    const parsedTick = payload.last_tick_at ? Date.parse(payload.last_tick_at) : Date.now();
    const lastServerTick = Number.isFinite(parsedTick) ? parsedTick : Date.now();

    set({
      resources,
      rates,
      maxResources,
      bankBalance: payload.bank_balance,
      interestRate: payload.interest_rate,
      lastServerTick,
      interpolatedResources: resources,
    });
  },

  interpolate: (now) => {
    const state = get();
    const elapsedSeconds = Math.max(0, (now - state.lastServerTick) / 1000);
    const nextInterpolated: Record<ResourceType, number> = {
      [ResourceType.MONEY]: 0,
      [ResourceType.OIL]: 0,
      [ResourceType.AMMO]: 0,
      [ResourceType.GOLD]: 0,
      [ResourceType.DIAMOND]: 0,
    };

    (Object.values(ResourceType) as ResourceType[]).forEach((resource) => {
      const base = state.resources[resource] || 0;
      const rate = state.rates[resource] || 0;
      const max = state.maxResources[resource] || Number.MAX_SAFE_INTEGER;
      nextInterpolated[resource] = clamp(base + (rate * elapsedSeconds), 0, max);
    });

    set({ interpolatedResources: nextInterpolated });
  },

  setRealtimeConnected: (connected) => set({ isRealtimeConnected: connected }),
}));
