
import { ResourceType } from './enums';

// ══════════════════════════════════════════
// ACCIONES DIPLOMÁTICAS
// ══════════════════════════════════════════

export enum DiplomaticAction {
  // Propuestas amistosas
  PROPOSE_ALLIANCE = 'PROPOSE_ALLIANCE',
  PROPOSE_NON_AGGRESSION = 'PROPOSE_NON_AGGRESSION',
  PROPOSE_TRADE_DEAL = 'PROPOSE_TRADE_DEAL',
  PROPOSE_JOINT_ATTACK = 'PROPOSE_JOINT_ATTACK',
  OFFER_TRIBUTE = 'OFFER_TRIBUTE',
  REQUEST_AID = 'REQUEST_AID',
  INVITE_TO_FACTION = 'INVITE_TO_FACTION',

  // Respuestas
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  COUNTER_OFFER = 'COUNTER_OFFER',

  // Acciones hostiles
  DECLARE_WAR = 'DECLARE_WAR',
  BREAK_ALLIANCE = 'BREAK_ALLIANCE',
  BETRAY = 'BETRAY',
  EMBARGO = 'EMBARGO',
  EXPEL_FROM_FACTION = 'EXPEL_FROM_FACTION',

  // Acciones especiales
  SURRENDER = 'SURRENDER',
  DEMAND_TRIBUTE = 'DEMAND_TRIBUTE',
  THREATEN = 'THREATEN',
  OFFER_CEASEFIRE = 'OFFER_CEASEFIRE'
}

// ══════════════════════════════════════════
// PROPUESTAS DIPLOMÁTICAS
// ══════════════════════════════════════════

export interface DiplomaticProposal {
  id: string;
  type: DiplomaticAction;

  fromId: string;
  fromType: 'bot' | 'faction' | 'player';
  toId: string;
  toType: 'bot' | 'faction' | 'player';

  terms: DealTerms;

  status: ProposalStatus;
  createdAt: number;
  expiresAt: number;
  respondedAt?: number;
  response?: string;
}

export type ProposalStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'withdrawn'
  | 'countered';

export interface DealTerms {
  resourcesOffered?: Partial<Record<ResourceType, number>>;
  resourcesRequested?: Partial<Record<ResourceType, number>>;
  duration?: number;
  targetId?: string;
  targetType?: 'bot' | 'faction' | 'player';
  tributePercentage?: number;
  tributeFrequency?: number;
  conditions?: DealCondition[];
}

export interface DealCondition {
  type: 'mutual_defense' | 'no_expansion' | 'exclusive_trade' | 'intelligence_sharing';
  description: string;
}

// ══════════════════════════════════════════
// TRATADOS ACTIVOS
// ══════════════════════════════════════════

export interface ActiveTreaty {
  id: string;
  type: TreatyType;
  parties: string[];
  terms: DealTerms;
  startedAt: number;
  expiresAt: number | null;
  violations: TreatyViolation[];
}

export enum TreatyType {
  ALLIANCE = 'ALLIANCE',
  NON_AGGRESSION = 'NON_AGGRESSION',
  TRADE_AGREEMENT = 'TRADE_AGREEMENT',
  MUTUAL_DEFENSE = 'MUTUAL_DEFENSE',
  CEASEFIRE = 'CEASEFIRE',
  TRIBUTE = 'TRIBUTE'
}

export interface TreatyViolation {
  violatorId: string;
  timestamp: number;
  description: string;
  severity: 'minor' | 'major' | 'critical';
}

// ══════════════════════════════════════════
// ESTADO DIPLOMÁTICO DEL JUEGO
// ══════════════════════════════════════════

export interface DiplomacyState {
  proposals: Record<string, DiplomaticProposal>;
  treaties: Record<string, ActiveTreaty>;
  worldEvents: WorldEvent[];
}

export interface WorldEvent {
  id: string;
  type: WorldEventType;
  timestamp: number;
  actors: string[];
  description: string;
  impact: 'minor' | 'major' | 'critical';
}

export enum WorldEventType {
  WAR_DECLARED = 'WAR_DECLARED',
  WAR_ENDED = 'WAR_ENDED',
  ALLIANCE_FORMED = 'ALLIANCE_FORMED',
  ALLIANCE_BROKEN = 'ALLIANCE_BROKEN',
  FACTION_FORMED = 'FACTION_FORMED',
  FACTION_DISSOLVED = 'FACTION_DISSOLVED',
  BETRAYAL = 'BETRAYAL',
  MAJOR_BATTLE = 'MAJOR_BATTLE',
  POWER_SHIFT = 'POWER_SHIFT'
}
