
import { ResourceType } from './enums';

// ══════════════════════════════════════════
// FACCIONES Y ALIANZAS
// ══════════════════════════════════════════

export interface Faction {
  // ══════════════════════════════════════════
  // IDENTIDAD
  // ══════════════════════════════════════════
  id: string;
  name: string;
  tag: string;
  motto: string;
  color: string;
  iconId: number;

  // ══════════════════════════════════════════
  // MEMBRESÍA
  // ══════════════════════════════════════════
  leaderId: string;
  officerIds: string[];
  memberIds: string[];
  pendingInvites: string[];

  // ══════════════════════════════════════════
  // CARACTERÍSTICAS
  // ══════════════════════════════════════════
  ideology: FactionIdeology;
  founded: number;

  // ══════════════════════════════════════════
  // RECURSOS COMPARTIDOS
  // ══════════════════════════════════════════
  treasury: Partial<Record<ResourceType, number>>;
  contributionHistory: Contribution[];

  // ══════════════════════════════════════════
  // RELACIONES EXTERNAS
  // ══════════════════════════════════════════
  allies: string[];
  enemies: string[];
  neutrals: string[];
  activeWars: FactionWar[];

  // ══════════════════════════════════════════
  // MÉTRICAS
  // ══════════════════════════════════════════
  power: number;
  territory: number;
  stability: number;
  reputation: number;

  // ══════════════════════════════════════════
  // HISTORIAL
  // ══════════════════════════════════════════
  history: FactionEvent[];
}

export enum FactionIdeology {
  MILITARIST = 'MILITARIST',
  MERCANTILE = 'MERCANTILE',
  EXPANSIONIST = 'EXPANSIONIST',
  ISOLATIONIST = 'ISOLATIONIST',
  OPPORTUNIST = 'OPPORTUNIST'
}

export interface FactionWar {
  id: string;
  enemyFactionId: string;
  startTime: number;
  reason: WarReason;
  battles: WarBattle[];
  currentScore: { us: number; them: number };
  status: 'active' | 'won' | 'lost' | 'draw' | 'ceasefire';
}

export enum WarReason {
  TERRITORIAL = 'TERRITORIAL',
  REVENGE = 'REVENGE',
  BETRAYAL = 'BETRAYAL',
  IDEOLOGY = 'IDEOLOGY',
  OPPORTUNISTIC = 'OPPORTUNISTIC',
  DEFENSE_OF_ALLY = 'DEFENSE_OF_ALLY'
}

export interface WarBattle {
  timestamp: number;
  attackerId: string;
  defenderId: string;
  winner: string;
  casualties: { attacker: number; defender: number };
}

export interface Contribution {
  memberId: string;
  resource: ResourceType;
  amount: number;
  timestamp: number;
}

export interface FactionEvent {
  type: FactionEventType;
  timestamp: number;
  actorId: string;
  details: string;
}

export enum FactionEventType {
  FOUNDED = 'FOUNDED',
  MEMBER_JOINED = 'MEMBER_JOINED',
  MEMBER_LEFT = 'MEMBER_LEFT',
  MEMBER_KICKED = 'MEMBER_KICKED',
  OFFICER_PROMOTED = 'OFFICER_PROMOTED',
  LEADER_CHANGED = 'LEADER_CHANGED',
  WAR_DECLARED = 'WAR_DECLARED',
  WAR_WON = 'WAR_WON',
  WAR_LOST = 'WAR_LOST',
  ALLIANCE_FORMED = 'ALLIANCE_FORMED',
  ALLIANCE_BROKEN = 'ALLIANCE_BROKEN',
  BETRAYAL = 'BETRAYAL'
}

export const FACTION_LIMITS = {
  MIN_MEMBERS: 2,
  MAX_MEMBERS: 15,
  MAX_OFFICERS: 3,
  MAX_ALLIES: 2,
  MAX_ACTIVE_FACTIONS: 8,
  STABILITY_DECAY_RATE: 0.1,
  WAR_DURATION_MIN: 2 * 60 * 60 * 1000,
  WAR_DURATION_MAX: 24 * 60 * 60 * 1000
};
