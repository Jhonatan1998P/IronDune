
import { DiplomaticAction } from '../../types/diplomacy';

/**
 * Sistema de Reputación
 * 
 * La reputación va de -100 (odiado) a +100 (adorado)
 * Afecta las decisiones de IA y las opciones diplomáticas disponibles
 */

// ══════════════════════════════════════════
// MODIFICADORES DE REPUTACIÓN
// ══════════════════════════════════════════

export const REPUTATION_MODIFIERS = {
  // Acciones positivas
  HONOR_ALLIANCE: +10,
  PROVIDE_AID_SMALL: +5,
  PROVIDE_AID_LARGE: +15,
  WIN_JOINT_WAR: +25,
  ACCEPT_SURRENDER: +5,
  DEFEND_ALLY: +20,
  GENEROUS_TRADE: +8,
  KEEP_PROMISE: +5,

  // Acciones negativas
  ATTACK_UNPROVOKED: -15,
  ATTACK_ALLY: -30,
  BREAK_ALLIANCE: -40,
  BREAK_NON_AGGRESSION: -25,
  BETRAY_IN_WAR: -80,
  REFUSE_AID_REQUEST: -10,
  REFUSE_SURRENDER: -10,
  UNFAIR_TRADE: -5,
  BREAK_PROMISE: -20,
  ATTACK_WEAK_TARGET: -5,

  // Acciones neutrales con contexto
  ATTACK_ENEMY: 0,
  REFUSE_ENEMY_PROPOSAL: 0,

  // Decay
  REPUTATION_DECAY_RATE: -0.5
};

// ══════════════════════════════════════════
// UMBRALES DE REPUTACIÓN
// ══════════════════════════════════════════

export const REPUTATION_THRESHOLDS = {
  TRUSTED_ALLY: 75,
  FRIENDLY: 50,
  POSITIVE: 25,
  NEUTRAL: 0,
  SUSPICIOUS: -25,
  HOSTILE: -50,
  HATED: -75
};

// ══════════════════════════════════════════
// FUNCIONES DE REPUTACIÓN
// ══════════════════════════════════════════

export interface ReputationContext {
  duringWar?: boolean;
  wasProvoked?: boolean;
  targetIsWeak?: boolean;
  isGenerous?: boolean;
  brokePromise?: boolean;
}

/**
 * Calcula el cambio de reputación por una acción
 */
export function calculateReputationChange(
  action: DiplomaticAction,
  context: ReputationContext
): number {
  switch (action) {
    case DiplomaticAction.BREAK_ALLIANCE:
      return context.duringWar
        ? REPUTATION_MODIFIERS.BETRAY_IN_WAR
        : REPUTATION_MODIFIERS.BREAK_ALLIANCE;

    case DiplomaticAction.OFFER_TRIBUTE:
      return context.isGenerous
        ? REPUTATION_MODIFIERS.PROVIDE_AID_LARGE
        : REPUTATION_MODIFIERS.PROVIDE_AID_SMALL;

    case DiplomaticAction.DECLARE_WAR:
      if (context.wasProvoked) return REPUTATION_MODIFIERS.ATTACK_ENEMY;
      if (context.targetIsWeak) return REPUTATION_MODIFIERS.ATTACK_WEAK_TARGET;
      return REPUTATION_MODIFIERS.ATTACK_UNPROVOKED;

    case DiplomaticAction.PROPOSE_ALLIANCE:
      return 2; // Minor positive gesture

    case DiplomaticAction.PROPOSE_TRADE_DEAL:
      return 1;

    case DiplomaticAction.BETRAY:
      return context.duringWar
        ? REPUTATION_MODIFIERS.BETRAY_IN_WAR
        : REPUTATION_MODIFIERS.BREAK_ALLIANCE;

    case DiplomaticAction.SURRENDER:
      return REPUTATION_MODIFIERS.ACCEPT_SURRENDER;

    case DiplomaticAction.OFFER_CEASEFIRE:
      return 3;

    case DiplomaticAction.REQUEST_AID:
      return 0;

    case DiplomaticAction.DEMAND_TRIBUTE:
      return -5;

    case DiplomaticAction.THREATEN:
      return -8;

    case DiplomaticAction.EMBARGO:
      return -12;

    default:
      return 0;
  }
}

/**
 * Determina las opciones diplomáticas disponibles basado en reputación
 */
export function getAvailableDiplomaticActions(
  fromReputation: number,
  currentRelation: 'ally' | 'neutral' | 'enemy' | 'faction_member'
): DiplomaticAction[] {
  const actions: DiplomaticAction[] = [];

  // Siempre disponibles
  actions.push(DiplomaticAction.OFFER_TRIBUTE);
  actions.push(DiplomaticAction.REQUEST_AID);

  if (currentRelation === 'ally') {
    actions.push(DiplomaticAction.PROPOSE_JOINT_ATTACK);
    actions.push(DiplomaticAction.BREAK_ALLIANCE);
  }

  if (currentRelation === 'neutral') {
    if (fromReputation >= REPUTATION_THRESHOLDS.POSITIVE) {
      actions.push(DiplomaticAction.PROPOSE_ALLIANCE);
    }
    actions.push(DiplomaticAction.PROPOSE_NON_AGGRESSION);
    actions.push(DiplomaticAction.PROPOSE_TRADE_DEAL);
    actions.push(DiplomaticAction.DECLARE_WAR);
    actions.push(DiplomaticAction.THREATEN);
  }

  if (currentRelation === 'enemy') {
    actions.push(DiplomaticAction.OFFER_CEASEFIRE);
    actions.push(DiplomaticAction.SURRENDER);
    actions.push(DiplomaticAction.DEMAND_TRIBUTE);
  }

  if (currentRelation === 'faction_member') {
    actions.push(DiplomaticAction.PROPOSE_JOINT_ATTACK);
    actions.push(DiplomaticAction.PROPOSE_TRADE_DEAL);
  }

  return actions;
}

/**
 * Aplica decay de reputación hacia neutral
 */
export function applyReputationDecay(
  reputation: number,
  hoursElapsed: number
): number {
  const decay = Math.abs(REPUTATION_MODIFIERS.REPUTATION_DECAY_RATE) * hoursElapsed;

  if (reputation > 0) {
    return Math.max(0, reputation - decay);
  } else if (reputation < 0) {
    return Math.min(0, reputation + decay);
  }

  return 0;
}

/**
 * Clamps reputation to valid range
 */
export function clampReputation(value: number): number {
  return Math.max(-100, Math.min(100, value));
}

/**
 * Gets a human-readable label for a reputation level
 */
export function getReputationLabel(reputation: number): string {
  if (reputation >= REPUTATION_THRESHOLDS.TRUSTED_ALLY) return 'Trusted Ally';
  if (reputation >= REPUTATION_THRESHOLDS.FRIENDLY) return 'Friendly';
  if (reputation >= REPUTATION_THRESHOLDS.POSITIVE) return 'Positive';
  if (reputation >= REPUTATION_THRESHOLDS.NEUTRAL) return 'Neutral';
  if (reputation >= REPUTATION_THRESHOLDS.SUSPICIOUS) return 'Suspicious';
  if (reputation >= REPUTATION_THRESHOLDS.HOSTILE) return 'Hostile';
  return 'Hated';
}
