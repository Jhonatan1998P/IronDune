import { describe, it, expect } from 'vitest';
import { validateCommandPayload } from '../server/commandValidation.js';

describe('command payload contracts', () => {
  it('normalizes empty maps before validating tutorial reward', () => {
    const result = validateCommandPayload('TUTORIAL_CLAIM_REWARD', {
      costs: {},
      gains: {},
      statePatch: {
        completedTutorials: { intro: true },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({
      statePatch: {
        completedTutorials: { intro: true },
      },
    });
  });

  it('rejects forbidden costs on tutorial reward', () => {
    const result = validateCommandPayload('TUTORIAL_CLAIM_REWARD', {
      costs: { MONEY: 10 },
      statePatch: {
        completedTutorials: { intro: true },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('COMMAND_FIELD_FORBIDDEN');
  });

  it('requires costs for bank deposit and forbids gains', () => {
    const missingCosts = validateCommandPayload('BANK_DEPOSIT', {
      statePatch: { logs: [] },
    });
    expect(missingCosts.ok).toBe(false);
    expect(missingCosts.errorCode).toBe('COMMAND_FIELD_REQUIRED');

    const withGains = validateCommandPayload('BANK_DEPOSIT', {
      costs: { MONEY: 10 },
      gains: { MONEY: 1 },
      statePatch: { logs: [] },
    });
    expect(withGains.ok).toBe(false);
    expect(withGains.errorCode).toBe('COMMAND_FIELD_FORBIDDEN');
  });

  it('enforces statePatch semantics for diplomacy peace', () => {
    const missingPatch = validateCommandPayload('DIPLOMACY_PROPOSE_PEACE', {
      statePatch: { logs: [] },
    });

    expect(missingPatch.ok).toBe(false);
    expect(missingPatch.errorCode).toBe('INVALID_COMMAND_SEMANTICS');
  });
});
