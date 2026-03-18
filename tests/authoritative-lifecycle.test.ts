import { describe, expect, it } from 'vitest';
import { buildAuthoritativeCommandResult, resolveLifecycleCompletions } from '../server/engine/authoritativeLifecycle.js';

const makeBaseState = () => ({
  buildings: {
    HOUSE: { level: 3, isDamaged: false },
    UNIVERSITY: { level: 1, isDamaged: false },
  },
  units: {
    CYBER_MARINE: 0,
  },
  techLevels: {
    BASIC_TRAINING: 0,
  },
  researchedTechs: ['UNLOCK_CYBER_MARINE'],
  activeConstructions: [],
  activeRecruitments: [],
  activeResearch: null,
});

describe('authoritative lifecycle engine', () => {
  it('increases build cost for sequential quantity constructions', () => {
    const now = Date.now();
    const base = makeBaseState();

    const first = buildAuthoritativeCommandResult('BUILD_START', base, { buildingType: 'HOUSE', amount: 1 }, now);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = buildAuthoritativeCommandResult('BUILD_START', first.nextState, { buildingType: 'HOUSE', amount: 1 }, now + 5);
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const firstCost = Number(first.costs?.MONEY || 0);
    const secondCost = Number(second.costs?.MONEY || 0);

    expect(firstCost).toBeGreaterThan(0);
    expect(secondCost).toBeGreaterThan(firstCost);
    expect(second.nextState.activeConstructions.length).toBe(2);
  });

  it('rejects research when another research is active', () => {
    const now = Date.now();
    const base = {
      ...makeBaseState(),
      activeResearch: {
        techId: 'BASIC_TRAINING',
        startTime: now,
        endTime: now + 60_000,
      },
    };

    const result = buildAuthoritativeCommandResult('RESEARCH_START', base, { techId: 'BALLISTICS' }, now + 10);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe('RESEARCH_BUSY');
  });

  it('applies authoritative speedup and charges one diamond', () => {
    const now = Date.now();
    const base = {
      ...makeBaseState(),
      activeConstructions: [{
        id: 'build-1',
        buildingType: 'HOUSE',
        count: 1,
        startTime: now,
        endTime: now + 90 * 60 * 1000,
      }],
    };

    const result = buildAuthoritativeCommandResult('SPEEDUP', base, { targetId: 'build-1', type: 'BUILD' }, now + 1_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(Number(result.costs?.DIAMOND || 0)).toBe(1);
    expect(result.nextState.activeConstructions[0].endTime).toBe(now + 60 * 60 * 1000);
  });

  it('resolves completed queues into authoritative state', () => {
    const now = Date.now();
    const base = {
      ...makeBaseState(),
      activeConstructions: [{
        id: 'build-done',
        buildingType: 'HOUSE',
        count: 2,
        startTime: now - 60_000,
        endTime: now - 1,
      }],
      activeRecruitments: [{
        id: 'rec-done',
        unitType: 'CYBER_MARINE',
        count: 3,
        startTime: now - 60_000,
        endTime: now - 1,
      }],
      activeResearch: {
        techId: 'BASIC_TRAINING',
        startTime: now - 60_000,
        endTime: now - 1,
      },
    };

    const resolved = resolveLifecycleCompletions(base, now);
    expect(resolved.changed).toBe(true);
    expect(resolved.state.activeConstructions.length).toBe(0);
    expect(resolved.state.activeRecruitments.length).toBe(0);
    expect(resolved.state.activeResearch).toBeNull();
    expect(resolved.state.buildings.HOUSE.level).toBe(5);
    expect(resolved.state.units.CYBER_MARINE).toBe(3);
    expect(resolved.state.techLevels.BASIC_TRAINING).toBe(1);
    expect(resolved.state.researchedTechs.includes('BASIC_TRAINING')).toBe(true);
  });
});
