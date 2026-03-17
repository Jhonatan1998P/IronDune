import { describe, expect, it } from 'vitest';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { processEconomyTick } from '../utils/engine/economy';
import { processServerEconomyTick } from '../server/engine/economyTick.js';

describe('Server economy parity', () => {
  it('matches client economy output for deterministic tick', () => {
    const now = Date.now();
    const state = {
      ...INITIAL_GAME_STATE,
      marketNextRefreshTime: now + 60_000,
      nextRateChangeTime: now + 60_000,
      lastSaveTime: now,
    };

    const client = processEconomyTick(state, 5000, now);
    const server = processServerEconomyTick(
      state,
      {
        money: state.resources.MONEY,
        oil: state.resources.OIL,
        ammo: state.resources.AMMO,
        gold: state.resources.GOLD,
        diamond: state.resources.DIAMOND,
        bank_balance: state.bankBalance,
        interest_rate: state.currentInterestRate,
        next_rate_change: state.nextRateChangeTime,
      },
      5000,
      now,
    );

    expect(server.resources.MONEY).toBeCloseTo(client.resources!.MONEY, 6);
    expect(server.resources.OIL).toBeCloseTo(client.resources!.OIL, 6);
    expect(server.resources.AMMO).toBeCloseTo(client.resources!.AMMO, 6);
    expect(server.resources.GOLD).toBeCloseTo(client.resources!.GOLD, 6);
    expect(server.resources.DIAMOND).toBeCloseTo(client.resources!.DIAMOND, 6);
    expect(server.bankBalance).toBeCloseTo(client.bankBalance!, 6);
    expect(server.maxStorage.money_max).toBe(client.maxResources!.MONEY);
    expect(server.maxStorage.diamond_max).toBe(client.maxResources!.DIAMOND);
  });
});
