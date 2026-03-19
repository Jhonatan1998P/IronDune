import { describe, expect, it } from 'vitest';
import { calculateEmpirePointsBreakdown } from '../server/lib/empirePoints.js';

describe('calculateEmpirePointsBreakdown', () => {
  it('calculates dominion points from buildings, units, tech, and campaign', () => {
    const result = calculateEmpirePointsBreakdown({
      buildings: {
        HOUSE: { level: 10, isDamaged: false },
        FACTORY: { level: 5, isDamaged: false },
      },
      units: {
        CYBER_MARINE: 20,
        SCOUT_TANK: 3,
      },
      techLevels: {
        BASIC_TRAINING: 2,
        BALLISTICS: 4,
      },
      campaignProgress: 3,
    });

    expect(result).toEqual({
      economyScore: 1800,
      militaryScore: 23,
      campaignScore: 1000,
      empirePoints: 3623,
    });
  });

  it('is resilient to missing or invalid state fields', () => {
    const result = calculateEmpirePointsBreakdown({
      buildings: null,
      units: { CYBER_MARINE: -10 },
      techLevels: { BASIC_TRAINING: 'x' },
      campaignProgress: 0,
    });

    expect(result.empirePoints).toBe(0);
    expect(result.economyScore).toBe(0);
    expect(result.militaryScore).toBe(0);
    expect(result.campaignScore).toBe(0);
  });
});
