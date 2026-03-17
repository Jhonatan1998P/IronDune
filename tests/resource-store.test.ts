import { describe, expect, it } from 'vitest';
import { ResourceType } from '../types';
import { useResourceStore } from '../stores/resourceStore';

describe('resourceStore interpolation', () => {
  it('interpolates server snapshot using net rates', () => {
    useResourceStore.getState().applyServerSnapshot({
      money: 1000,
      oil: 200,
      ammo: 300,
      gold: 50,
      diamond: 5,
      money_rate: 10,
      oil_rate: -1,
      ammo_rate: 0,
      gold_rate: 0.5,
      diamond_rate: 0,
      money_max: 100000,
      oil_max: 100000,
      ammo_max: 100000,
      gold_max: 100000,
      diamond_max: 10,
      bank_balance: 0,
      interest_rate: 0.15,
      last_tick_at: new Date(1_000).toISOString(),
    });

    useResourceStore.getState().interpolate(3_000);
    const state = useResourceStore.getState();

    expect(state.interpolatedResources[ResourceType.MONEY]).toBeCloseTo(1020, 6);
    expect(state.interpolatedResources[ResourceType.OIL]).toBeCloseTo(198, 6);
    expect(state.interpolatedResources[ResourceType.GOLD]).toBeCloseTo(51, 6);
  });
});
