import { describe, it, expect } from 'vitest';
import { isValidWarState } from '../../server/engine/warValidation.js';

describe('War Engine (server mirror)', () => {
  it('exposes war validation utilities', () => {
    expect(typeof isValidWarState).toBe('function');
  });
});
