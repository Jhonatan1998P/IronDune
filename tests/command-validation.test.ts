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

  it('requires authoritative action payload for build command', () => {
    const missingAction = validateCommandPayload('BUILD_START', {
      statePatch: {
        activeConstructions: [],
      },
    });
    expect(missingAction.ok).toBe(false);
    expect(missingAction.errorCode).toBe('COMMAND_FIELD_FORBIDDEN');

    const validAction = validateCommandPayload('BUILD_START', {
      action: {
        buildingType: 'HOUSE',
        amount: 1,
      },
    });
    expect(validAction.ok).toBe(true);
  });

  it('accepts speedup action payload for authoritative lifecycle queue', () => {
    const validAction = validateCommandPayload('SPEEDUP', {
      action: {
        targetId: 'build-1',
        type: 'BUILD',
      },
    });
    expect(validAction.ok).toBe(true);
  });
});
