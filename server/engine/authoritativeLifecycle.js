import { ResourceType } from './enums.js';

const BANK_LEVEL_CAPACITIES = [
  0,
  5000000,
  10000000,
  25000000,
  50000000,
  75000000,
  125000000,
  180000000,
  250000000,
  400000000,
  800000000,
  1500000000,
  3500000000,
  8000000000,
  20000000000,
  50000000000,
];

const BUILDING_RULES = {
  HOUSE: { buildMode: 'QUANTITY', baseCost: { money: 1000, oil: 0, ammo: 0 }, costMultiplier: 1.015, buildTime: 30000, maxLevel: 200000 },
  FACTORY: { buildMode: 'QUANTITY', baseCost: { money: 20000, oil: 1000, ammo: 0 }, costMultiplier: 1.015, buildTime: 30000, maxLevel: 200000 },
  SKYSCRAPER: { buildMode: 'QUANTITY', baseCost: { money: 100000, oil: 50000, ammo: 0 }, costMultiplier: 1.015, buildTime: 30000, maxLevel: 200000 },
  BANK: { buildMode: 'LEVEL', baseCost: { money: 500000, oil: 0, ammo: 0 }, costMultiplier: 1, buildTime: 30000, maxLevel: 15 },
  MARKET: { buildMode: 'LEVEL', baseCost: { money: 25000, oil: 0, ammo: 0 }, costMultiplier: 1.5, buildTime: 10000, maxLevel: 5 },
  DIAMOND_MINE: { buildMode: 'LEVEL', baseCost: { money: 10000000, oil: 0, ammo: 0 }, costMultiplier: 5, buildTime: 300000, maxLevel: 5 },
  OIL_RIG: { buildMode: 'QUANTITY', baseCost: { money: 8000, oil: 0, ammo: 2000 }, costMultiplier: 1.015, buildTime: 30000, maxLevel: 200000 },
  GOLD_MINE: { buildMode: 'QUANTITY', baseCost: { money: 15000, oil: 500, ammo: 1500 }, costMultiplier: 1.015, buildTime: 30000, maxLevel: 200000 },
  MUNITIONS_FACTORY: { buildMode: 'QUANTITY', baseCost: { money: 5000, oil: 500, ammo: 0 }, costMultiplier: 1.015, buildTime: 30000, maxLevel: 200000 },
  UNIVERSITY: { buildMode: 'LEVEL', baseCost: { money: 50000, oil: 5000, ammo: 0 }, costMultiplier: 2.05, buildTime: 30000, maxLevel: 15 },
  BARRACKS: { buildMode: 'LEVEL', baseCost: { money: 50000, oil: 0, ammo: 1000 }, costMultiplier: 2.25, buildTime: 15000, maxLevel: 20 },
  TANK_FACTORY: { buildMode: 'LEVEL', baseCost: { money: 500000, oil: 25000, ammo: 10000 }, costMultiplier: 1.9, buildTime: 60000, maxLevel: 15 },
  SHIPYARD: { buildMode: 'LEVEL', baseCost: { money: 1000000, oil: 50000, ammo: 20000 }, costMultiplier: 1.75, buildTime: 90000, maxLevel: 10 },
  AIRFIELD: { buildMode: 'LEVEL', baseCost: { money: 1500000, oil: 100000, ammo: 50000 }, costMultiplier: 1.7, buildTime: 120000, maxLevel: 10 },
};

const UNIT_RULES = {
  CYBER_MARINE: { reqTech: 'UNLOCK_CYBER_MARINE', recruitTime: 60000, cost: { money: 15000, oil: 0, ammo: 50 } },
  HEAVY_COMMANDO: { reqTech: 'UNLOCK_HEAVY_COMMANDO', recruitTime: 120000, cost: { money: 50000, oil: 0, ammo: 250 } },
  SCOUT_TANK: { reqTech: 'UNLOCK_SCOUT_TANK', recruitTime: 180000, cost: { money: 125000, oil: 125, ammo: 750 } },
  TITAN_MBT: { reqTech: 'UNLOCK_TITAN_MBT', recruitTime: 300000, cost: { money: 250000, oil: 500, ammo: 1500 } },
  WRAITH_GUNSHIP: { reqTech: 'UNLOCK_WRAITH_GUNSHIP', recruitTime: 420000, cost: { money: 700000, oil: 1250, ammo: 5000 } },
  ACE_FIGHTER: { reqTech: 'UNLOCK_ACE_FIGHTER', recruitTime: 600000, cost: { money: 2000000, oil: 3000, ammo: 15000 } },
  AEGIS_DESTROYER: { reqTech: 'UNLOCK_AEGIS_DESTROYER', recruitTime: 720000, cost: { money: 6000000, oil: 50000, ammo: 100000 } },
  PHANTOM_SUB: { reqTech: 'UNLOCK_PHANTOM_SUB', recruitTime: 900000, cost: { money: 15000000, oil: 1500000, ammo: 5000000 } },
  SALVAGER_DRONE: { reqTech: 'UNLOCK_SALVAGER_DRONE', recruitTime: 90000, cost: { money: 100000, oil: 500, ammo: 0 } },
};

const TECH_RULES = {
  DEEP_DRILLING: { cost: { money: 10000000, ammo: 500000, oil: 100000, gold: 250000 }, costMultiplier: 3, maxLevel: 20, researchTime: 900000 },
  MASS_PRODUCTION: { cost: { money: 10000000, ammo: 500000, oil: 100000, gold: 250000 }, costMultiplier: 3, maxLevel: 20, researchTime: 1200000 },
  GOLD_REFINING: { cost: { money: 10000000, ammo: 500000, oil: 100000, gold: 250000 }, costMultiplier: 3, maxLevel: 20, researchTime: 2700000 },
  STRATEGIC_COMMAND: { cost: { money: 50000000, oil: 5000000, ammo: 2500000 }, costMultiplier: 10, maxLevel: 3, researchTime: 43200000 },
  UNLOCK_SALVAGER_DRONE: { cost: { money: 200000, oil: 1000, ammo: 500 }, researchTime: 300000 },
  DRONE_BATTLE_TECH: { cost: { money: 1000000, oil: 50000, ammo: 25000 }, costMultiplier: 2, maxLevel: 10, researchTime: 1800000 },
  BASIC_TRAINING: { cost: { money: 15000, oil: 0, ammo: 500 }, researchTime: 120000 },
  UNLOCK_CYBER_MARINE: { cost: { money: 25000, oil: 0, ammo: 1000 }, researchTime: 300000 },
  UNLOCK_HEAVY_COMMANDO: { cost: { money: 250000, oil: 0, ammo: 50000 }, researchTime: 900000 },
  PATROL_TRAINING: { cost: { money: 5000000, oil: 50000, ammo: 50000 }, costMultiplier: 2, maxLevel: 10, researchTime: 7200000 },
  COMBUSTION_ENGINE: { cost: { money: 300000, oil: 25000, ammo: 0 }, researchTime: 1200000 },
  BALLISTICS: { cost: { money: 150000, oil: 5000, ammo: 10000 }, researchTime: 900000 },
  EXPLOSIVE_CHEMISTRY: { cost: { money: 2500000, oil: 50000, ammo: 100000 }, researchTime: 7200000 },
  UNLOCK_SCOUT_TANK: { cost: { money: 500000, oil: 25000, ammo: 10000 }, researchTime: 1800000 },
  HEAVY_PLATING: { cost: { money: 5000000, oil: 200000, ammo: 0 }, researchTime: 7200000 },
  UNLOCK_TITAN_MBT: { cost: { money: 2000000, oil: 100000, ammo: 50000 }, researchTime: 3600000 },
  AERODYNAMICS: { cost: { money: 3000000, oil: 500000, ammo: 0 }, researchTime: 10800000 },
  UNLOCK_WRAITH_GUNSHIP: { cost: { money: 3000000, oil: 100000, ammo: 50000 }, researchTime: 5400000 },
  JET_ENGINES: { cost: { money: 15000000, oil: 2000000, ammo: 0 }, researchTime: 21600000 },
  UNLOCK_ACE_FIGHTER: { cost: { money: 100000000, oil: 500000, ammo: 200000 }, researchTime: 10800000 },
  PRECISION_BOMBING: { cost: { money: 50000000, oil: 1000000, ammo: 2000000 }, researchTime: 36000000 },
  NAVAL_ENGINEERING: { cost: { money: 50000000, oil: 1000000, ammo: 2000000, gold: 250000 }, researchTime: 14400000 },
  SONAR_TECH: { cost: { money: 100000000, oil: 1500000, ammo: 10000000, gold: 450000 }, researchTime: 21600000 },
  UNLOCK_AEGIS_DESTROYER: { cost: { money: 200000000, oil: 1500000, ammo: 7500000, gold: 2500000 }, researchTime: 28800000 },
  STEALTH_HULL: { cost: { money: 105000000, oil: 2500000, ammo: 10000000, gold: 700000 }, researchTime: 43200000 },
  UNLOCK_PHANTOM_SUB: { cost: { money: 600000000, oil: 4000000, ammo: 15000000, gold: 1000000, diamond: 50 }, researchTime: 86400000 },
};

const clone = (value) => JSON.parse(JSON.stringify(value || {}));

const makeQueueId = (prefix, now) => {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${now}-${randomPart}`;
};

const safeArray = (value) => (Array.isArray(value) ? value : []);
const safeObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const normalizeActiveResearch = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const techId = typeof value.techId === 'string' ? value.techId.trim() : '';
  if (!techId || techId.toUpperCase() === 'UNKNOWN' || techId.toUpperCase() === 'UNKNOW') return null;

  return {
    ...value,
    techId,
  };
};

export const normalizeLifecycleState = (stateInput) => {
  const state = clone(stateInput);
  state.buildings = safeObject(state.buildings);
  state.units = safeObject(state.units);
  state.techLevels = safeObject(state.techLevels);
  state.researchedTechs = safeArray(state.researchedTechs);
  state.activeConstructions = safeArray(state.activeConstructions);
  state.activeRecruitments = safeArray(state.activeRecruitments);
  state.activeResearch = normalizeActiveResearch(state.activeResearch);
  return state;
};

export const resolveLifecycleCompletions = (stateInput, now) => {
  const state = normalizeLifecycleState(stateInput);
  let changed = false;

  state.activeConstructions = state.activeConstructions.filter((queueItem) => {
    if (now < Number(queueItem.endTime || 0)) return true;
    const buildingType = queueItem.buildingType;
    const current = state.buildings[buildingType] || { level: 0, isDamaged: false };
    state.buildings[buildingType] = {
      ...current,
      level: Number(current.level || 0) + Number(queueItem.count || 0),
    };
    changed = true;
    return false;
  });

  state.activeRecruitments = state.activeRecruitments.filter((queueItem) => {
    if (now < Number(queueItem.endTime || 0)) return true;
    const unitType = queueItem.unitType;
    state.units[unitType] = Number(state.units[unitType] || 0) + Number(queueItem.count || 0);
    changed = true;
    return false;
  });

  if (state.activeResearch && now >= Number(state.activeResearch.endTime || 0)) {
    const techId = state.activeResearch.techId;
    state.techLevels[techId] = Number(state.techLevels[techId] || 0) + 1;
    if (!state.researchedTechs.includes(techId)) {
      state.researchedTechs.push(techId);
    }
    state.activeResearch = null;
    changed = true;
  }

  return { state, changed };
};

const calculateConstructionCost = (rule, startLevel, count) => {
  if (rule.id === 'BANK') {
    let totalMoney = 0;
    for (let i = 0; i < count; i += 1) {
      const nextLevel = startLevel + i + 1;
      const targetCapacity = nextLevel < BANK_LEVEL_CAPACITIES.length
        ? BANK_LEVEL_CAPACITIES[nextLevel]
        : BANK_LEVEL_CAPACITIES[BANK_LEVEL_CAPACITIES.length - 1];
      totalMoney += Math.floor(targetCapacity * 0.1);
    }
    return { money: totalMoney, oil: 0, ammo: 0 };
  }

  if (rule.buildMode === 'QUANTITY') {
    let money = 0;
    let oil = 0;
    let ammo = 0;
    for (let i = 1; i <= count; i += 1) {
      const multiplier = Math.pow(rule.costMultiplier, startLevel + i);
      money += Math.floor(rule.baseCost.money * multiplier);
      oil += Math.floor(rule.baseCost.oil * multiplier);
      ammo += Math.floor(rule.baseCost.ammo * multiplier);
    }
    return { money, oil, ammo };
  }

  let money = 0;
  let oil = 0;
  let ammo = 0;
  for (let i = 0; i < count; i += 1) {
    const currentLevel = startLevel + i;
    const multiplier = Math.pow(rule.costMultiplier, currentLevel);
    money += Math.floor(rule.baseCost.money * multiplier);
    oil += Math.floor(rule.baseCost.oil * multiplier);
    ammo += Math.floor(rule.baseCost.ammo * multiplier);
  }
  return { money, oil, ammo };
};

const calculateConstructionTime = (rule, startLevel, count) => {
  if (rule.buildMode === 'QUANTITY') return rule.buildTime * count;
  let totalTime = 0;
  for (let i = 0; i < count; i += 1) {
    totalTime += Math.floor(rule.buildTime * Math.pow(1.5, startLevel + i));
  }
  return totalTime;
};

const calculateResearchCost = (rule, currentLevel) => {
  const multiplier = Math.pow(rule.costMultiplier || 1, currentLevel);
  return {
    money: Math.floor((rule.cost.money || 0) * multiplier),
    oil: Math.floor((rule.cost.oil || 0) * multiplier),
    ammo: Math.floor((rule.cost.ammo || 0) * multiplier),
    gold: Math.floor((rule.cost.gold || 0) * multiplier),
    diamond: Math.floor((rule.cost.diamond || 0) * multiplier),
  };
};

const asPositiveInt = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

export const buildAuthoritativeCommandResult = (type, stateInput, actionInput, now) => {
  const state = normalizeLifecycleState(stateInput);
  const action = safeObject(actionInput);

  if (type === 'BUILD_START') {
    const buildingType = typeof action.buildingType === 'string' ? action.buildingType : null;
    const amount = asPositiveInt(action.amount);
    const rule = buildingType ? BUILDING_RULES[buildingType] : null;
    if (!rule || !amount) return { ok: false, status: 400, errorCode: 'INVALID_COMMAND_ACTION', error: 'Invalid build action payload' };
    if (state.activeConstructions.length >= 3) return { ok: false, status: 400, errorCode: 'QUEUE_FULL', error: 'Construction queue is full' };
    const currentBuilding = state.buildings[buildingType] || { level: 0, isDamaged: false };
    if (currentBuilding.isDamaged) return { ok: false, status: 400, errorCode: 'BUILDING_DAMAGED', error: 'Cannot build damaged building' };
    const queuedCount = state.activeConstructions
      .filter((item) => item.buildingType === buildingType)
      .reduce((sum, item) => sum + Number(item.count || 0), 0);
    const startLevel = Number(currentBuilding.level || 0) + queuedCount;
    if (startLevel + amount > Number(rule.maxLevel || 999999)) {
      return { ok: false, status: 400, errorCode: 'MAX_LEVEL_REACHED', error: 'Building max level reached' };
    }
    const cost = calculateConstructionCost({ ...rule, id: buildingType }, startLevel, amount);
    const totalTime = calculateConstructionTime(rule, startLevel, amount);
    state.activeConstructions.push({
      id: makeQueueId('build', now),
      buildingType,
      count: amount,
      startTime: now,
      endTime: now + totalTime,
    });
    return {
      ok: true,
      nextState: state,
      costs: {
        [ResourceType.MONEY]: cost.money,
        [ResourceType.OIL]: cost.oil,
        [ResourceType.AMMO]: cost.ammo,
      },
    };
  }

  if (type === 'RECRUIT_START') {
    const unitType = typeof action.unitType === 'string' ? action.unitType : null;
    const amount = asPositiveInt(action.amount);
    const rule = unitType ? UNIT_RULES[unitType] : null;
    if (!rule || !amount) return { ok: false, status: 400, errorCode: 'INVALID_COMMAND_ACTION', error: 'Invalid recruit action payload' };
    if (state.activeRecruitments.length >= 3) return { ok: false, status: 400, errorCode: 'QUEUE_FULL', error: 'Recruitment queue is full' };
    if (!state.researchedTechs.includes(rule.reqTech)) return { ok: false, status: 400, errorCode: 'REQ_TECH', error: 'Technology requirement not met' };
    state.activeRecruitments.push({
      id: makeQueueId('recruit', now),
      unitType,
      count: amount,
      startTime: now,
      endTime: now + (rule.recruitTime * amount),
    });
    return {
      ok: true,
      nextState: state,
      costs: {
        [ResourceType.MONEY]: Number(rule.cost.money || 0) * amount,
        [ResourceType.OIL]: Number(rule.cost.oil || 0) * amount,
        [ResourceType.AMMO]: Number(rule.cost.ammo || 0) * amount,
      },
    };
  }

  if (type === 'RESEARCH_START') {
    const techId = typeof action.techId === 'string' ? action.techId : null;
    const rule = techId ? TECH_RULES[techId] : null;
    if (!rule) return { ok: false, status: 400, errorCode: 'INVALID_COMMAND_ACTION', error: 'Invalid research action payload' };
    if (state.activeResearch) return { ok: false, status: 400, errorCode: 'RESEARCH_BUSY', error: 'Research queue busy' };

    const currentLevel = Number(state.techLevels[techId] || 0);
    const maxLevel = Number(rule.maxLevel || 1);
    if (currentLevel >= maxLevel) return { ok: false, status: 400, errorCode: 'MAX_LEVEL_REACHED', error: 'Research max level reached' };

    const cost = calculateResearchCost(rule, currentLevel);
    state.activeResearch = {
      techId,
      startTime: now,
      endTime: now + Number(rule.researchTime || 0),
    };
    return {
      ok: true,
      nextState: state,
      costs: {
        [ResourceType.MONEY]: Number(cost.money || 0),
        [ResourceType.OIL]: Number(cost.oil || 0),
        [ResourceType.AMMO]: Number(cost.ammo || 0),
        [ResourceType.GOLD]: Number(cost.gold || 0),
        [ResourceType.DIAMOND]: Number(cost.diamond || 0),
      },
    };
  }

  if (type === 'SPEEDUP') {
    const targetId = typeof action.targetId === 'string' ? action.targetId : null;
    const speedupType = typeof action.type === 'string' ? action.type : null;
    if (!targetId || !speedupType) {
      return { ok: false, status: 400, errorCode: 'INVALID_COMMAND_ACTION', error: 'Invalid speedup action payload' };
    }

    const REDUCTION_MS = 30 * 60 * 1000;
    let found = false;

    if (speedupType === 'BUILD') {
      state.activeConstructions = state.activeConstructions.map((entry) => {
        if (entry.id !== targetId) return entry;
        found = true;
        return {
          ...entry,
          endTime: Math.max(now, Number(entry.endTime || now) - REDUCTION_MS),
        };
      });
    } else if (speedupType === 'RECRUIT') {
      state.activeRecruitments = state.activeRecruitments.map((entry) => {
        if (entry.id !== targetId) return entry;
        found = true;
        return {
          ...entry,
          endTime: Math.max(now, Number(entry.endTime || now) - REDUCTION_MS),
        };
      });
    } else if (speedupType === 'RESEARCH') {
      if (state.activeResearch && state.activeResearch.techId === targetId) {
        found = true;
        state.activeResearch = {
          ...state.activeResearch,
          endTime: Math.max(now, Number(state.activeResearch.endTime || now) - REDUCTION_MS),
        };
      }
    } else {
      return { ok: false, status: 400, errorCode: 'INVALID_COMMAND_ACTION', error: 'Unsupported speedup type for authoritative lifecycle' };
    }

    if (!found) {
      return { ok: false, status: 400, errorCode: 'SPEEDUP_TARGET_NOT_FOUND', error: 'Speedup target not found' };
    }

    const resolved = resolveLifecycleCompletions(state, now);
    return {
      ok: true,
      nextState: resolved.state,
      costs: {
        [ResourceType.DIAMOND]: 1,
      },
    };
  }

  return { ok: false, status: 400, errorCode: 'UNSUPPORTED_COMMAND_TYPE', error: 'Unsupported authoritative command type' };
};
