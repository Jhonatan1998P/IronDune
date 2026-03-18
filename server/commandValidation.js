import { ResourceType } from './engine/enums.js';
import { z } from 'zod';

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
  'TUTORIAL_SET_STATE',
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

const numericResourceMapSchema = z.record(z.nativeEnum(ResourceType), z.number().finite().min(0));
const anyActionSchema = z.object({}).passthrough();
const basePayloadSchema = z.object({
  costs: numericResourceMapSchema.optional(),
  gains: numericResourceMapSchema.optional(),
  statePatch: z.object({}).passthrough().optional(),
  action: anyActionSchema.optional(),
}).strict();

const actionSchema = (shape) => z.object(shape).strict();

const COMMAND_ZOD_SCHEMAS = {
  BUILD_START: basePayloadSchema.extend({
    action: actionSchema({
      buildingType: z.string().min(1),
      amount: z.number().int().positive(),
    }),
  }).strict(),
  BUILD_REPAIR: basePayloadSchema.extend({
    costs: numericResourceMapSchema,
    statePatch: z.object({ buildings: z.any() }).passthrough(),
  }).strict(),
  RECRUIT_START: basePayloadSchema.extend({
    action: actionSchema({
      unitType: z.string().min(1),
      amount: z.number().int().positive(),
    }),
  }).strict(),
  RESEARCH_START: basePayloadSchema.extend({
    action: actionSchema({
      techId: z.string().min(1),
    }),
  }).strict(),
  SPEEDUP: basePayloadSchema.extend({
    action: actionSchema({
      targetId: z.string().min(1),
      type: z.string().min(1),
    }).optional(),
  }).strict(),
  TRADE_EXECUTE: basePayloadSchema,
  DIAMOND_EXCHANGE: basePayloadSchema.extend({
    costs: numericResourceMapSchema,
    gains: numericResourceMapSchema,
  }).strict(),
  ESPIONAGE_START: basePayloadSchema.extend({
    costs: numericResourceMapSchema,
  }).strict(),
  BANK_DEPOSIT: basePayloadSchema.extend({
    costs: numericResourceMapSchema,
  }).strict(),
  BANK_WITHDRAW: basePayloadSchema.extend({
    gains: numericResourceMapSchema,
  }).strict(),
  TUTORIAL_SET_STATE: basePayloadSchema,
  TUTORIAL_CLAIM_REWARD: basePayloadSchema,
  GIFT_CODE_REDEEM: basePayloadSchema,
  DIPLOMACY_GIFT: basePayloadSchema.extend({
    costs: numericResourceMapSchema,
  }).strict(),
  DIPLOMACY_PROPOSE_ALLIANCE: basePayloadSchema,
  DIPLOMACY_PROPOSE_PEACE: basePayloadSchema,
};

const hasAnyStatePatchKeys = (payload, requiredKeys) => {
  if (!isNonNullObject(payload.statePatch)) return false;
  return requiredKeys.some((key) => Object.prototype.hasOwnProperty.call(payload.statePatch, key));
};

const hasActionFields = (payload, requiredFields) => {
  if (!isNonNullObject(payload.action)) return false;
  return requiredFields.every((field) => payload.action[field] !== undefined && payload.action[field] !== null);
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
    costs: 'forbidden',
    gains: 'forbidden',
    statePatch: 'forbidden',
    actionRequired: ['buildingType', 'amount'],
  },
  BUILD_REPAIR: {
    costs: 'required',
    gains: 'forbidden',
    statePatchAnyOf: ['buildings'],
  },
  RECRUIT_START: {
    costs: 'forbidden',
    gains: 'forbidden',
    statePatch: 'forbidden',
    actionRequired: ['unitType', 'amount'],
  },
  RESEARCH_START: {
    costs: 'forbidden',
    gains: 'forbidden',
    statePatch: 'forbidden',
    actionRequired: ['techId'],
  },
  SPEEDUP: {
    costs: 'optional',
    gains: 'forbidden',
    statePatch: 'optional',
    actionRequired: ['targetId', 'type'],
    actionOptional: true,
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
  TUTORIAL_SET_STATE: {
    costs: 'forbidden',
    gains: 'forbidden',
    statePatchAnyOf: ['tutorialAccepted', 'isTutorialMinimized'],
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

  const allowedKeys = new Set(['costs', 'gains', 'statePatch', 'action']);
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

  if (payload.action !== undefined && !isNonNullObject(payload.action)) {
    return { ok: false, errorCode: 'INVALID_ACTION_PAYLOAD', message: 'action must be an object' };
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

  if (!hasNonEmptyObject(payload.costs) && !hasNonEmptyObject(payload.gains) && !hasNonEmptyObject(payload.statePatch) && !hasNonEmptyObject(payload.action)) {
    return { ok: false, errorCode: 'EMPTY_COMMAND_PAYLOAD', message: 'Command payload is empty' };
  }

  const contract = COMMAND_CONTRACTS[type] || null;
  if (contract) {
    const costRule = validateFieldRule(payload, 'costs', contract.costs, type);
    if (!costRule.ok) return costRule;

    const gainRule = validateFieldRule(payload, 'gains', contract.gains, type);
    if (!gainRule.ok) return gainRule;

    const patchRule = validateFieldRule(payload, 'statePatch', contract.statePatch, type);
    if (!patchRule.ok) return patchRule;

    const hasActionObject = isNonNullObject(payload.action);
    const hasValidAction = Array.isArray(contract.actionRequired)
      ? hasActionFields(payload, contract.actionRequired)
      : false;
    if (Array.isArray(contract.actionRequired) && !hasValidAction && !contract.actionOptional) {
      return {
        ok: false,
        errorCode: 'INVALID_COMMAND_ACTION',
        message: `Missing action fields for ${type}`,
      };
    }
    if (hasActionObject && Array.isArray(contract.actionRequired) && !hasValidAction) {
      return {
        ok: false,
        errorCode: 'INVALID_COMMAND_ACTION',
        message: `Missing action fields for ${type}`,
      };
    }

    const enforceStatePatchSemantics = !hasValidAction;
    if (enforceStatePatchSemantics && Array.isArray(contract.statePatchAnyOf) && !hasAnyStatePatchKeys(payload, contract.statePatchAnyOf)) {
      return {
        ok: false,
        errorCode: 'INVALID_COMMAND_SEMANTICS',
        message: `Payload does not satisfy semantic rules for ${type}`,
      };
    }
  }

  const zodSchema = COMMAND_ZOD_SCHEMAS[type] || null;
  if (zodSchema) {
    const parsed = zodSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        errorCode: 'INVALID_PAYLOAD_SCHEMA',
        message: parsed.error.issues[0]?.message || 'Payload schema validation failed',
      };
    }
  }

  return { ok: true, payload };
};
