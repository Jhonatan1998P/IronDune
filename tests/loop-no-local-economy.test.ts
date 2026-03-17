import { describe, expect, it } from 'vitest';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { calculateNextTick } from '../utils/engine/loop';

describe('Client loop economy removal', () => {
  it('does not mutate resources locally anymore', () => {
    const before = { ...INITIAL_GAME_STATE };
    const { newState } = calculateNextTick(before, 10_000);
    expect(newState.resources).toEqual(before.resources);
    expect(newState.bankBalance).toBe(before.bankBalance);
  });
});
