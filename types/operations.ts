
import { UnitType, ResourceType } from './enums';
import { BattleResult } from './state';

// ══════════════════════════════════════════
// SISTEMA DE OPERACIONES MILITARES COORDINADAS
// ══════════════════════════════════════════

export enum OperationType {
  // Operaciones Ofensivas
  PINCER_ATTACK = 'PINCER_ATTACK',
  WAVE_ASSAULT = 'WAVE_ASSAULT',
  BLITZKRIEG = 'BLITZKRIEG',
  SIEGE = 'SIEGE',

  // Operaciones Defensivas
  MUTUAL_DEFENSE = 'MUTUAL_DEFENSE',
  COUNTER_OFFENSIVE = 'COUNTER_OFFENSIVE'
}

export interface CoordinatedOperation {
  id: string;
  type: OperationType;

  organizerId: string;
  participantIds: string[];

  targetId: string;
  targetType: 'bot' | 'faction' | 'player';

  plannedStartTime: number;
  phases: OperationPhase[];

  status: OperationStatus;
  currentPhase: number;
  results: OperationResult[];

  detectedByPlayer: boolean;
  detectionTime?: number;
}

export type OperationStatus =
  | 'planning'
  | 'mobilizing'
  | 'active'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface OperationPhase {
  phaseNumber: number;
  attackerId: string;

  army: Partial<Record<UnitType, number>>;

  delayFromStart: number;
  estimatedDuration: number;

  objective: PhaseObjective;

  status: 'pending' | 'active' | 'completed' | 'failed';
  result?: BattleResult;
}

export type PhaseObjective =
  | 'probe'
  | 'weaken'
  | 'main_assault'
  | 'cleanup'
  | 'occupy';

export interface OperationResult {
  phaseNumber: number;
  success: boolean;
  casualties: {
    attacker: Partial<Record<UnitType, number>>;
    defender: Partial<Record<UnitType, number>>;
  };
  resourcesLooted?: Partial<Record<ResourceType, number>>;
}

// ══════════════════════════════════════════
// CONFIGURACIÓN DE OPERACIONES
// ══════════════════════════════════════════

export const OPERATION_CONFIG: Record<string, {
  minParticipants: number;
  maxParticipants: number;
  phases: number;
  phaseDelay: number;
  warningTime: number;
  description: string;
}> = {
  [OperationType.PINCER_ATTACK]: {
    minParticipants: 3,
    maxParticipants: 5,
    phases: 3,
    phaseDelay: 5 * 60 * 1000,
    warningTime: 15 * 60 * 1000,
    description: "Multiple attackers strike simultaneously from different angles"
  },
  [OperationType.WAVE_ASSAULT]: {
    minParticipants: 4,
    maxParticipants: 8,
    phases: 6,
    phaseDelay: 10 * 60 * 1000,
    warningTime: 30 * 60 * 1000,
    description: "Relentless waves that wear down defenses over time"
  },
  [OperationType.BLITZKRIEG]: {
    minParticipants: 2,
    maxParticipants: 4,
    phases: 1,
    phaseDelay: 0,
    warningTime: 5 * 60 * 1000,
    description: "Sudden, overwhelming strike with minimal warning"
  },
  [OperationType.SIEGE]: {
    minParticipants: 3,
    maxParticipants: 6,
    phases: 10,
    phaseDelay: 30 * 60 * 1000,
    warningTime: 60 * 60 * 1000,
    description: "Prolonged campaign to force surrender or destruction"
  },
  [OperationType.MUTUAL_DEFENSE]: {
    minParticipants: 2,
    maxParticipants: 6,
    phases: 1,
    phaseDelay: 0,
    warningTime: 0,
    description: "Coordinated defense of an ally under attack"
  },
  [OperationType.COUNTER_OFFENSIVE]: {
    minParticipants: 2,
    maxParticipants: 4,
    phases: 2,
    phaseDelay: 5 * 60 * 1000,
    warningTime: 10 * 60 * 1000,
    description: "Counter-attack after successful defense"
  }
};
