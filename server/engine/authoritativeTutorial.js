import { BuildingType, ResourceType, TechType, UnitType } from './enums.js';

const TUTORIAL_SET_STATE_ACTIONS = new Set(['ACCEPT_STEP', 'TOGGLE_MINIMIZED']);
const CLAIM_REWARD_ACTION = 'CLAIM_REWARD';

const TUTORIAL_STEPS = [
  {
    id: 'tut_welcome',
    reward: {
      [ResourceType.MONEY]: 10000,
      [ResourceType.OIL]: 1000,
      [ResourceType.AMMO]: 500,
    },
    isComplete: () => true,
  },
  {
    id: 'tut_build_house',
    reward: {
      [ResourceType.MONEY]: 20000,
      [ResourceType.OIL]: 2000,
      [ResourceType.AMMO]: 1000,
    },
    buildingReward: {
      [BuildingType.HOUSE]: 2,
    },
    isComplete: (state) => getBuildingLevel(state, BuildingType.HOUSE) >= 1,
  },
  {
    id: 'tut_build_oil',
    reward: {
      [ResourceType.MONEY]: 25000,
      [ResourceType.OIL]: 2500,
      [ResourceType.AMMO]: 1500,
    },
    buildingReward: {
      [BuildingType.OIL_RIG]: 1,
    },
    isComplete: (state) => getBuildingLevel(state, BuildingType.OIL_RIG) >= 1,
  },
  {
    id: 'tut_build_ammo',
    reward: {
      [ResourceType.MONEY]: 35000,
      [ResourceType.OIL]: 3000,
      [ResourceType.AMMO]: 3000,
    },
    buildingReward: {
      [BuildingType.MUNITIONS_FACTORY]: 1,
    },
    isComplete: (state) => getBuildingLevel(state, BuildingType.MUNITIONS_FACTORY) >= 1,
  },
  {
    id: 'tut_build_gold',
    reward: {
      [ResourceType.MONEY]: 80000,
      [ResourceType.OIL]: 8000,
      [ResourceType.AMMO]: 4000,
    },
    buildingReward: {
      [BuildingType.GOLD_MINE]: 1,
    },
    isComplete: (state) => getBuildingLevel(state, BuildingType.GOLD_MINE) >= 1,
  },
  {
    id: 'tut_build_university',
    reward: {
      [ResourceType.MONEY]: 60000,
      [ResourceType.AMMO]: 4000,
      [ResourceType.OIL]: 4000,
    },
    isComplete: (state) => getBuildingLevel(state, BuildingType.UNIVERSITY) >= 1,
  },
  {
    id: 'tut_research_basic',
    reward: {
      [ResourceType.MONEY]: 80000,
      [ResourceType.AMMO]: 5000,
      [ResourceType.OIL]: 5000,
    },
    isComplete: (state) => hasResearchedTech(state, TechType.BASIC_TRAINING),
  },
  {
    id: 'tut_build_barracks',
    reward: {
      [ResourceType.MONEY]: 70000,
      [ResourceType.AMMO]: 3000,
      [ResourceType.OIL]: 3000,
    },
    buildingReward: {
      [BuildingType.BARRACKS]: 1,
    },
    isComplete: (state) => getBuildingLevel(state, BuildingType.BARRACKS) >= 1,
  },
  {
    id: 'tut_unlock_soldier',
    reward: {
      [ResourceType.MONEY]: 120000,
      [ResourceType.AMMO]: 7000,
      [ResourceType.OIL]: 5000,
    },
    isComplete: (state) => hasResearchedTech(state, TechType.UNLOCK_CYBER_MARINE),
  },
  {
    id: 'tut_recruit_soldier',
    reward: {
      [ResourceType.MONEY]: 30000,
      [ResourceType.OIL]: 5000,
      [ResourceType.AMMO]: 3000,
    },
    unitReward: {
      [UnitType.CYBER_MARINE]: 5,
    },
    isComplete: (state) => getUnitCount(state, UnitType.CYBER_MARINE) >= 1,
  },
  {
    id: 'tut_patrol',
    reward: {
      [ResourceType.GOLD]: 100,
      [ResourceType.DIAMOND]: 1,
    },
    isComplete: (state) => hasMissionType(state, 'PATROL'),
  },
  {
    id: 'tut_campaign',
    reward: {
      [ResourceType.MONEY]: 100000,
      [ResourceType.GOLD]: 50,
    },
    isComplete: (state) => Number(state?.campaignProgress || 1) > 1,
  },
];

const TUTORIAL_STEP_BY_ID = new Map(TUTORIAL_STEPS.map((step) => [step.id, step]));

const isNonNullObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const asArray = (value) => (Array.isArray(value) ? value : []);

const cloneState = (value) => JSON.parse(JSON.stringify(value || {}));

const getBuildingLevel = (state, buildingType) => {
  const buildings = isNonNullObject(state?.buildings) ? state.buildings : {};
  const buildingState = isNonNullObject(buildings[buildingType]) ? buildings[buildingType] : null;
  return Number(buildingState?.level || 0);
};

const getUnitCount = (state, unitType) => {
  const units = isNonNullObject(state?.units) ? state.units : {};
  return Number(units[unitType] || 0);
};

const hasResearchedTech = (state, techId) => asArray(state?.researchedTechs).includes(techId);

const hasMissionType = (state, missionType) => asArray(state?.activeMissions).some((mission) => mission?.type === missionType);

const normalizeCompletedTutorials = (value) => {
  const seen = new Set();
  const ordered = [];

  for (const rawId of asArray(value)) {
    if (typeof rawId !== 'string') {
      continue;
    }
    const id = rawId.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ordered.push(id);
  }

  return ordered;
};

const resolveCurrentTutorialId = (completedTutorials, preferredId) => {
  const completedSet = new Set(completedTutorials);
  if (
    typeof preferredId === 'string'
    && preferredId
    && TUTORIAL_STEP_BY_ID.has(preferredId)
    && !completedSet.has(preferredId)
  ) {
    return preferredId;
  }

  for (const step of TUTORIAL_STEPS) {
    if (!completedSet.has(step.id)) {
      return step.id;
    }
  }

  return null;
};

const resolveTutorialClaimable = (step, state) => {
  if (!step) {
    return false;
  }

  try {
    return Boolean(step.isComplete(state));
  } catch {
    return false;
  }
};

const reconcileTutorialState = (stateInput) => {
  const state = stateInput;
  state.completedTutorials = normalizeCompletedTutorials(state.completedTutorials);
  state.currentTutorialId = resolveCurrentTutorialId(state.completedTutorials, state.currentTutorialId);
  state.tutorialAccepted = Boolean(state.tutorialAccepted);
  state.isTutorialMinimized = Boolean(state.isTutorialMinimized);

  const currentStep = state.currentTutorialId ? TUTORIAL_STEP_BY_ID.get(state.currentTutorialId) || null : null;
  if (!currentStep) {
    state.currentTutorialId = null;
    state.tutorialClaimable = false;
    state.tutorialAccepted = false;
    state.isTutorialMinimized = false;
    return { state, currentStep: null };
  }

  state.tutorialClaimable = resolveTutorialClaimable(currentStep, state);
  return { state, currentStep };
};

const normalizeRewardMap = (rewardInput) => {
  const reward = isNonNullObject(rewardInput) ? rewardInput : {};
  const normalized = {};

  for (const key of Object.values(ResourceType)) {
    const value = Number(reward[key] || 0);
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }
    normalized[key] = value;
  }

  return normalized;
};

const applyBuildingRewards = (state, rewardInput) => {
  const reward = isNonNullObject(rewardInput) ? rewardInput : {};
  if (Object.keys(reward).length === 0) {
    return;
  }

  const buildings = isNonNullObject(state.buildings) ? { ...state.buildings } : {};

  Object.entries(reward).forEach(([buildingType, rawAmount]) => {
    const amount = Math.floor(Number(rawAmount || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    const current = isNonNullObject(buildings[buildingType])
      ? buildings[buildingType]
      : { level: 0, isDamaged: false };
    buildings[buildingType] = {
      ...current,
      level: Number(current.level || 0) + amount,
    };
  });

  state.buildings = buildings;
};

const applyUnitRewards = (state, rewardInput) => {
  const reward = isNonNullObject(rewardInput) ? rewardInput : {};
  if (Object.keys(reward).length === 0) {
    return;
  }

  const units = isNonNullObject(state.units) ? { ...state.units } : {};

  Object.entries(reward).forEach(([unitType, rawAmount]) => {
    const amount = Math.floor(Number(rawAmount || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    units[unitType] = Number(units[unitType] || 0) + amount;
  });

  state.units = units;
};

const invalidActionResult = {
  handled: true,
  ok: false,
  status: 400,
  errorCode: 'INVALID_COMMAND_ACTION',
  error: 'Invalid tutorial action payload',
};

export const buildAuthoritativeTutorialCommandResult = (type, stateInput, actionInput) => {
  if (type !== 'TUTORIAL_SET_STATE' && type !== 'TUTORIAL_CLAIM_REWARD') {
    return { handled: false };
  }

  const state = cloneState(stateInput);
  const action = isNonNullObject(actionInput) ? actionInput : {};
  const actionType = typeof action.type === 'string' ? action.type : '';

  reconcileTutorialState(state);

  if (type === 'TUTORIAL_SET_STATE') {
    if (!TUTORIAL_SET_STATE_ACTIONS.has(actionType)) {
      return invalidActionResult;
    }

    if (actionType === 'ACCEPT_STEP') {
      if (!state.currentTutorialId) {
        return {
          handled: true,
          ok: false,
          status: 400,
          errorCode: 'TUTORIAL_ALREADY_COMPLETED',
          error: 'Tutorial already completed',
        };
      }
      state.tutorialAccepted = true;
      state.isTutorialMinimized = false;
    } else if (actionType === 'TOGGLE_MINIMIZED') {
      state.isTutorialMinimized = !Boolean(state.isTutorialMinimized);
    }

    reconcileTutorialState(state);
    return {
      handled: true,
      ok: true,
      nextState: state,
      costs: {},
      gains: {},
    };
  }

  if (actionType !== CLAIM_REWARD_ACTION) {
    return invalidActionResult;
  }

  const { currentStep } = reconcileTutorialState(state);
  if (!currentStep) {
    return {
      handled: true,
      ok: false,
      status: 400,
      errorCode: 'TUTORIAL_ALREADY_COMPLETED',
      error: 'Tutorial already completed',
    };
  }

  const requestedTutorialId = typeof action.tutorialId === 'string' ? action.tutorialId.trim() : '';
  if (requestedTutorialId && requestedTutorialId !== currentStep.id) {
    return {
      handled: true,
      ok: false,
      status: 409,
      errorCode: 'TUTORIAL_STEP_MISMATCH',
      error: 'Tutorial step mismatch. Refresh state and try again.',
    };
  }

  if (!state.tutorialClaimable) {
    return {
      handled: true,
      ok: false,
      status: 400,
      errorCode: 'TUTORIAL_OBJECTIVE_NOT_MET',
      error: 'Tutorial objective is not completed',
    };
  }

  const gains = normalizeRewardMap(currentStep.reward);
  applyBuildingRewards(state, currentStep.buildingReward);
  applyUnitRewards(state, currentStep.unitReward);

  if (!state.completedTutorials.includes(currentStep.id)) {
    state.completedTutorials.push(currentStep.id);
  }
  state.tutorialAccepted = false;
  state.isTutorialMinimized = false;
  reconcileTutorialState(state);

  return {
    handled: true,
    ok: true,
    nextState: state,
    costs: {},
    gains,
  };
};
