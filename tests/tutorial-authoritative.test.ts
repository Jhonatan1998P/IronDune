import { describe, expect, it } from 'vitest';
import { buildAuthoritativeTutorialCommandResult } from '../server/engine/authoritativeTutorial.js';

describe('authoritative tutorial commands', () => {
  it('rejects reward claim when objective is not completed', () => {
    const result = buildAuthoritativeTutorialCommandResult('TUTORIAL_CLAIM_REWARD', {
      currentTutorialId: 'tut_build_house',
      completedTutorials: [],
      buildings: {
        HOUSE: { level: 0, isDamaged: false },
      },
    }, {
      type: 'CLAIM_REWARD',
      tutorialId: 'tut_build_house',
    });

    expect(result.handled).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('TUTORIAL_OBJECTIVE_NOT_MET');
  });

  it('applies reward and advances tutorial when objective is completed', () => {
    const result = buildAuthoritativeTutorialCommandResult('TUTORIAL_CLAIM_REWARD', {
      currentTutorialId: 'tut_build_house',
      completedTutorials: ['tut_welcome'],
      tutorialAccepted: true,
      tutorialClaimable: false,
      isTutorialMinimized: true,
      buildings: {
        HOUSE: { level: 1, isDamaged: false },
      },
      units: {},
      researchedTechs: [],
      activeMissions: [],
      campaignProgress: 1,
    }, {
      type: 'CLAIM_REWARD',
      tutorialId: 'tut_build_house',
    });

    expect(result.handled).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.gains).toMatchObject({
      MONEY: 20000,
      OIL: 2000,
      AMMO: 1000,
    });
    expect(result.nextState.completedTutorials).toContain('tut_build_house');
    expect(result.nextState.currentTutorialId).toBe('tut_build_oil');
    expect(result.nextState.tutorialAccepted).toBe(false);
    expect(result.nextState.isTutorialMinimized).toBe(false);
  });
});
