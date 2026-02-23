
import { ResourceType, BuildingType, UnitType, TechType, BotPersonality } from './enums';
import { RankingCategory } from '../utils/engine/rankings';

// ══════════════════════════════════════════
// BOT STATE - Estado Persistente Completo
// ══════════════════════════════════════════

export interface BotState {
  // ══════════════════════════════════════════
  // IDENTIDAD (migrado del sistema existente)
  // ══════════════════════════════════════════
  id: string;
  name: string;
  avatarId: number;
  country: string;
  personality: BotPersonality;

  // ══════════════════════════════════════════
  // ECONOMÍA SIMULADA
  // ══════════════════════════════════════════
  resources: Record<ResourceType, number>;
  buildings: Partial<Record<BuildingType, number>>;
  techs: TechType[];
  productionRate: Partial<Record<ResourceType, number>>;

  // ══════════════════════════════════════════
  // MILITAR PERSISTENTE
  // ══════════════════════════════════════════
  army: Partial<Record<UnitType, number>>;
  armyScore: number;
  militaryCapacity: number;
  recruitmentQueue: RecruitmentOrder[];

  // ══════════════════════════════════════════
  // ESTADO POLÍTICO
  // ══════════════════════════════════════════
  factionId: string | null;
  factionRole: FactionRole;
  reputation: Record<string, number>;
  playerReputation: number;

  // ══════════════════════════════════════════
  // MEMORIA Y COMPORTAMIENTO
  // ══════════════════════════════════════════
  memory: BotMemory;
  currentGoal: BotGoal;
  goalProgress: number;
  lastDecisionTime: number;
  lastUpdateTime: number;

  // ══════════════════════════════════════════
  // RANKING (migrado)
  // ══════════════════════════════════════════
  stats: Record<RankingCategory, number>;
  ambition: number;
  lastRank?: number;
}

export interface RecruitmentOrder {
  unitType: UnitType;
  count: number;
  startTime: number;
  endTime: number;
}

export interface BotMemory {
  recentAttackers: AttackMemory[];
  recentAllies: AllyMemory[];
  betrayals: BetrayalMemory[];
  playerActions: PlayerActionMemory[];
  playerThreatLevel: number;
  warsParticipated: WarMemory[];
  pendingProposals: string[];
}

export interface AttackMemory {
  attackerId: string;
  timestamp: number;
  damageReceived: number;
  wasProvoked: boolean;
}

export interface AllyMemory {
  allyId: string;
  helpType: 'defense' | 'attack' | 'resources';
  timestamp: number;
  value: number;
}

export interface BetrayalMemory {
  traitorId: string;
  context: string;
  timestamp: number;
  severity: number;
}

export interface PlayerActionMemory {
  action: 'attack' | 'help' | 'trade' | 'betray' | 'alliance';
  timestamp: number;
  impact: number;
}

export interface WarMemory {
  warId: string;
  side: 'attacker' | 'defender';
  outcome: 'victory' | 'defeat' | 'draw';
  contribution: number;
}

export enum BotGoal {
  EXPAND_ECONOMY = 'EXPAND_ECONOMY',
  BUILD_ARMY = 'BUILD_ARMY',
  SEEK_ALLIANCE = 'SEEK_ALLIANCE',
  REVENGE = 'REVENGE',
  DEFEND_ALLY = 'DEFEND_ALLY',
  BETRAY_FACTION = 'BETRAY_FACTION',
  DOMINATE_RANKING = 'DOMINATE_RANKING',
  SURVIVE = 'SURVIVE',
  RECRUIT_MEMBERS = 'RECRUIT_MEMBERS',
  CONSOLIDATE_POWER = 'CONSOLIDATE_POWER'
}

export enum FactionRole {
  NONE = 'NONE',
  MEMBER = 'MEMBER',
  OFFICER = 'OFFICER',
  LEADER = 'LEADER'
}
