import { ResourceType } from './engine/enums.js';

const RESOURCE_KEYS = new Set(Object.values(ResourceType));

export const COMMAND_TYPES = new Set([
  'BUILD_START',
  'BUILD_REPAIR',
  'RECRUIT_START',
  'RESEARCH_START',
  'SPEEDUP',
  'TRADE_EXECUTE',
  'DIAMOND_EXCHANGE',
  'ESPIONAGE_START',
  'BANK_DEPOSIT',
  'BANK_WITHDRAW',
  'TUTORIAL_CLAIM_REWARD',
  'GIFT_CODE_REDEEM',
  'DIPLOMACY_GIFT',
  'DIPLOMACY_PROPOSE_ALLIANCE',
  'DIPLOMACY_PROPOSE_PEACE',
]);

export const PATCH_ALLOW_LIST = new Set([
  'buildings',
  'units',
  'activeConstructions',
  'activeRecruitments',
  'activeResearch',
  'techLevels',
  'researchedTechs',
  'marketOffers',
  'marketNextRefreshTime',
  'activeMarketEvent',
  'spyReports',
  'empirePoints',
  'logs',
  'rankingData',
  'diplomaticActions',
  'redeemedGiftCodes',
  'giftCodeCooldowns',
  'completedTutorials',
  'currentTutorialId',
  'tutorialClaimable',
  'tutorialAccepted',
  'isTutorialMinimized',
]);

const isNonNullObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasNonEmptyObject = (value) => isNonNullObject(value) && Object.keys(value).length > 0;

const hasAnyStatePatchKeys = (payload, requiredKeys) => {
  if (!isNonNullObject(payload.statePatch)) return false;
  return requiredKeys.some((key) => Object.prototype.hasOwnProperty.call(payload.statePatch, key));
};

const validateNumericMap = (value) => {
  if (!isNonNullObject(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > RESOURCE_KEYS.size) return false;
  for (const [key, amount] of entries) {
    if (!RESOURCE_KEYS.has(key)) return false;
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric < 0) return false;
  }
  return true;
};

const normalizeCommandPayload = (payload) => {
  if (!isNonNullObject(payload)) return payload;
  const normalized = {};

  for (const [key, value] of Object.entries(payload)) {
    if ((key === 'costs' || key === 'gains' || key === 'statePatch') && isNonNullObject(value) && Object.keys(value).length === 0) {
      continue;
    }
    normalized[key] = value;
  }

  return normalized;
};

const COMMAND_CONTRACTS = {
  BUILD_START: {
    costs: 'required',
    gains: 'forbidden',
    statePatchAnyOf: ['activeConstructions', 'buildings'],
  },
  BUILD_REPAIR: {
    costs: 'required',
    gains: 'forbidden',
    statePatchAnyOf: ['buildings'],
  },
  RECRUIT_START: {
    costs: 'required',
    gains: 'forbidden',
    statePatchAnyOf: ['activeRecruitments', 'units'],
  },
  RESEARCH_START: {
    costs: 'required',
    gains: 'forbidden',
    statePatchAnyOf: ['activeResearch', 'techLevels', 'researchedTechs'],
  },
  SPEEDUP: {
    costs: 'required',
    gains: 'forbidden',
    statePatchAnyOf: ['activeConstructions', 'activeRecruitments', 'activeResearch'],
  },
  TRADE_EXECUTE: {
    costs: 'optional',
    gains: 'optional',
    statePatchAnyOf: ['marketOffers', 'marketNextRefreshTime', 'activeMarketEvent', 'logs'],
  },
  DIAMOND_EXCHANGE: {
    costs: 'required',
    gains: 'required',
  },
  ESPIONAGE_START: {
    costs: 'required',
    gains: 'forbidden',
    statePatchAnyOf: ['spyReports'],
  },
  BANK_DEPOSIT: {
    costs: 'required',
    gains: 'forbidden',
  },
  BANK_WITHDRAW: {
    costs: 'forbidden',
    gains: 'required',
  },
  TUTORIAL_CLAIM_REWARD: {
    costs: 'forbidden',
    gains: 'optional',
    statePatchAnyOf: ['completedTutorials', 'tutorialClaimable', 'currentTutorialId'],
  },
  GIFT_CODE_REDEEM: {
    costs: 'forbidden',
    gains: 'optional',
    statePatchAnyOf: ['redeemedGiftCodes', 'giftCodeCooldowns'],
  },
  DIPLOMACY_GIFT: {
    costs: 'required',
    gains: 'forbidden',
    statePatchAnyOf: ['diplomaticActions', 'rankingData'],
  },
  DIPLOMACY_PROPOSE_ALLIANCE: {
    costs: 'forbidden',
    gains: 'forbidden',
    statePatchAnyOf: ['diplomaticActions', 'rankingData'],
  },
  DIPLOMACY_PROPOSE_PEACE: {
    costs: 'forbidden',
    gains: 'forbidden',
    statePatchAnyOf: ['diplomaticActions', 'rankingData'],
  },
};

const validateFieldRule = (payload, field, rule, type) => {
  if (!rule) return { ok: true };
  const hasField = payload[field] !== undefined;
  const hasValue = hasNonEmptyObject(payload[field]);

  if (rule === 'forbidden' && hasField) {
    return {
      ok: false,
      errorCode: 'COMMAND_FIELD_FORBIDDEN',
      message: `${field} is not allowed for ${type}`,
    };
  }

  if (rule === 'required' && !hasValue) {
    return {
      ok: false,
      errorCode: 'COMMAND_FIELD_REQUIRED',
      message: `${field} is required for ${type}`,
    };
  }

  return { ok: true };
};

export const validateCommandPayload = (type, payloadInput) => {
  if (!isNonNullObject(payloadInput)) {
    return { ok: false, errorCode: 'INVALID_PAYLOAD', message: 'Payload must be an object' };
  }

  const payload = normalizeCommandPayload(payloadInput);
  const keys = Object.keys(payload);
  if (keys.length > 8) {
    return { ok: false, errorCode: 'INVALID_PAYLOAD', message: 'Payload has too many keys' };
  }

  const allowedKeys = new Set(['costs', 'gains', 'statePatch']);
  for (const key of keys) {
    if (!allowedKeys.has(key)) {
      return { ok: false, errorCode: 'INVALID_PAYLOAD_KEY', message: `Unsupported payload key: ${key}` };
    }
  }

  if (payload.costs !== undefined && !validateNumericMap(payload.costs)) {
    return { ok: false, errorCode: 'INVALID_PAYLOAD_COSTS', message: 'Payload costs are invalid' };
  }

  if (payload.gains !== undefined && !validateNumericMap(payload.gains)) {
    return { ok: false, errorCode: 'INVALID_PAYLOAD_GAINS', message: 'Payload gains are invalid' };
  }

  if (payload.statePatch !== undefined && !isNonNullObject(payload.statePatch)) {
    return { ok: false, errorCode: 'INVALID_STATE_PATCH', message: 'statePatch must be an object' };
  }

  if (isNonNullObject(payload.statePatch)) {
    const patchKeys = Object.keys(payload.statePatch);
    if (patchKeys.length > PATCH_ALLOW_LIST.size) {
      return { ok: false, errorCode: 'INVALID_STATE_PATCH', message: 'statePatch has too many keys' };
    }
    for (const key of patchKeys) {
      if (!PATCH_ALLOW_LIST.has(key)) {
        return { ok: false, errorCode: 'INVALID_STATE_PATCH_KEY', message: `Unsupported statePatch key: ${key}` };
      }
    }
  }

  if (!hasNonEmptyObject(payload.costs) && !hasNonEmptyObject(payload.gains) && !hasNonEmptyObject(payload.statePatch)) {
    return { ok: false, errorCode: 'EMPTY_COMMAND_PAYLOAD', message: 'Command payload is empty' };
  }

  const contract = COMMAND_CONTRACTS[type] || null;
  if (contract) {
    const costRule = validateFieldRule(payload, 'costs', contract.costs, type);
    if (!costRule.ok) return costRule;

    const gainRule = validateFieldRule(payload, 'gains', contract.gains, type);
    if (!gainRule.ok) return gainRule;

    if (Array.isArray(contract.statePatchAnyOf) && !hasAnyStatePatchKeys(payload, contract.statePatchAnyOf)) {
      return {
        ok: false,
        errorCode: 'INVALID_COMMAND_SEMANTICS',
        message: `Payload does not satisfy semantic rules for ${type}`,
      };
    }
  }

  return { ok: true, payload };
};
