
import { BotState } from '../../types/bot';
import { UnitType } from '../../types/enums';
import { Faction } from '../../types/faction';
import {
  CoordinatedOperation, OperationType, OperationPhase,
  OperationStatus, OperationResult, OPERATION_CONFIG
} from '../../types/operations';
import { WorldEvent, WorldEventType } from '../../types/diplomacy';
import { calculateArmyScore } from './botSimulation';

let operationIdCounter = 0;
const generateId = (): string => `op-${++operationIdCounter}-${Date.now()}`;

// ══════════════════════════════════════════
// PLANIFICACIÓN DE OPERACIONES
// ══════════════════════════════════════════

export function planCoordinatedAttack(
  organizerId: string,
  participants: BotState[],
  target: { id: string; type: 'bot' | 'faction' | 'player' },
  operationType: OperationType
): CoordinatedOperation {
  const config = OPERATION_CONFIG[operationType];
  if (!config) {
    throw new Error(`Unknown operation type: ${operationType}`);
  }

  const phases = generateOperationPhases(
    participants,
    operationType,
    config
  );

  const prepTime = 30 * 60 * 1000; // 30 minutes prep

  return {
    id: generateId(),
    type: operationType,
    organizerId,
    participantIds: participants.map(p => p.id),
    targetId: target.id,
    targetType: target.type,
    plannedStartTime: Date.now() + prepTime,
    phases,
    status: 'planning',
    currentPhase: 0,
    results: [],
    detectedByPlayer: false
  };
}

function generateOperationPhases(
  participants: BotState[],
  operationType: OperationType,
  config: typeof OPERATION_CONFIG[string]
): OperationPhase[] {
  const phases: OperationPhase[] = [];
  const numPhases = config.phases;

  for (let i = 0; i < numPhases; i++) {
    const participantIndex = i % participants.length;
    const participant = participants[participantIndex];

    // Allocate portion of army for this phase
    const armyFraction = operationType === OperationType.BLITZKRIEG
      ? 0.8 // All-in for blitzkrieg
      : 0.3 + (0.2 * (i / numPhases)); // Escalating commitment

    const phaseArmy: Partial<Record<UnitType, number>> = {};
    for (const [unitType, count] of Object.entries(participant.army)) {
      if (count && count > 0) {
        phaseArmy[unitType as UnitType] = Math.max(1, Math.floor(count * armyFraction));
      }
    }

    phases.push({
      phaseNumber: i + 1,
      attackerId: participant.id,
      army: phaseArmy,
      delayFromStart: i * config.phaseDelay,
      estimatedDuration: 5 * 60 * 1000, // 5 min per phase
      objective: getPhaseObjective(i, numPhases),
      status: 'pending'
    });
  }

  return phases;
}

function getPhaseObjective(phaseIndex: number, totalPhases: number): OperationPhase['objective'] {
  if (totalPhases === 1) return 'main_assault';
  if (phaseIndex === 0) return 'probe';
  if (phaseIndex === totalPhases - 1) return 'cleanup';
  if (phaseIndex <= totalPhases / 2) return 'weaken';
  return 'main_assault';
}

// ══════════════════════════════════════════
// EJECUCIÓN DE OPERACIONES
// ══════════════════════════════════════════

export function processCoordinatedOperations(
  operations: Record<string, CoordinatedOperation>,
  botStates: Record<string, BotState>,
  currentTime: number
): {
  operations: Record<string, CoordinatedOperation>;
  events: WorldEvent[];
  updatedBots: Record<string, BotState>;
} {
  const updatedOps: Record<string, CoordinatedOperation> = {};
  const events: WorldEvent[] = [];
  let updatedBots = { ...botStates };

  for (const [id, operation] of Object.entries(operations)) {
    if (operation.status === 'completed' || operation.status === 'failed' || operation.status === 'cancelled') {
      updatedOps[id] = operation;
      continue;
    }

    // Planning -> Active transition
    if (operation.status === 'planning' && currentTime >= operation.plannedStartTime) {
      updatedOps[id] = {
        ...operation,
        status: 'active'
      };
      events.push({
        id: `event-op-start-${Date.now()}`,
        type: WorldEventType.MAJOR_BATTLE,
        timestamp: currentTime,
        actors: operation.participantIds,
        description: `A coordinated ${operation.type} operation has begun!`,
        impact: 'critical'
      });
      continue;
    }

    // Process active operation phases
    if (operation.status === 'active') {
      const result = processActiveOperation(operation, updatedBots, currentTime);
      updatedOps[id] = result.operation;
      events.push(...result.events);
      updatedBots = { ...updatedBots, ...result.updatedBots };
      continue;
    }

    updatedOps[id] = operation;
  }

  return { operations: updatedOps, events, updatedBots };
}

function processActiveOperation(
  operation: CoordinatedOperation,
  botStates: Record<string, BotState>,
  currentTime: number
): {
  operation: CoordinatedOperation;
  events: WorldEvent[];
  updatedBots: Record<string, BotState>;
} {
  const events: WorldEvent[] = [];
  const updatedBots: Record<string, BotState> = {};
  let updatedOp = { ...operation };

  // Process each pending phase that should be active
  const updatedPhases = [...operation.phases];
  let allComplete = true;
  let anyFailed = false;

  for (let i = 0; i < updatedPhases.length; i++) {
    const phase = updatedPhases[i];
    if (phase.status === 'completed' || phase.status === 'failed') continue;

    allComplete = false;

    const phaseStartTime = operation.plannedStartTime + phase.delayFromStart;
    const phaseEndTime = phaseStartTime + phase.estimatedDuration;

    if (phase.status === 'pending' && currentTime >= phaseStartTime) {
      updatedPhases[i] = { ...phase, status: 'active' };
    }

    if (phase.status === 'active' && currentTime >= phaseEndTime) {
      // Resolve phase combat (simplified)
      const attacker = botStates[phase.attackerId];
      const defender = botStates[operation.targetId];

      if (!attacker || !defender) {
        updatedPhases[i] = { ...phase, status: 'failed' };
        anyFailed = true;
        continue;
      }

      const attackerScore = calculateArmyScore(phase.army);
      const defenderScore = defender.armyScore;

      // Simple combat resolution
      const attackerAdvantage = attackerScore / Math.max(1, defenderScore);
      const success = attackerAdvantage > 0.8 || (attackerAdvantage > 0.5 && Math.random() < 0.5);

      const result: OperationResult = {
        phaseNumber: phase.phaseNumber,
        success,
        casualties: {
          attacker: {},
          defender: {}
        }
      };

      // Apply casualties
      if (success) {
        // Attacker loses 20-40% of committed forces
        const casualtyRate = 0.2 + Math.random() * 0.2;
        for (const [unitType, count] of Object.entries(phase.army)) {
          if (count) {
            result.casualties.attacker[unitType as UnitType] = Math.floor(count * casualtyRate);
          }
        }
        // Defender loses 30-60%
        const defCasualtyRate = 0.3 + Math.random() * 0.3;
        for (const [unitType, count] of Object.entries(defender.army)) {
          if (count) {
            result.casualties.defender[unitType as UnitType] = Math.floor(count * defCasualtyRate);
          }
        }
      } else {
        // Failed: attacker loses 40-70%
        const casualtyRate = 0.4 + Math.random() * 0.3;
        for (const [unitType, count] of Object.entries(phase.army)) {
          if (count) {
            result.casualties.attacker[unitType as UnitType] = Math.floor(count * casualtyRate);
          }
        }
      }

      updatedPhases[i] = { ...phase, status: success ? 'completed' : 'failed' };
      updatedOp = {
        ...updatedOp,
        results: [...updatedOp.results, result],
        currentPhase: i + 1
      };

      if (!success) anyFailed = true;
    }
  }

  // Check if operation is complete
  const completedPhases = updatedPhases.filter(p => p.status === 'completed').length;
  const failedPhases = updatedPhases.filter(p => p.status === 'failed').length;
  const totalResolved = completedPhases + failedPhases;

  if (totalResolved === updatedPhases.length) {
    const overallSuccess = completedPhases > failedPhases;
    updatedOp = {
      ...updatedOp,
      status: overallSuccess ? 'completed' : 'failed',
      phases: updatedPhases
    };

    events.push({
      id: `event-op-end-${Date.now()}`,
      type: WorldEventType.MAJOR_BATTLE,
      timestamp: currentTime,
      actors: [operation.organizerId, operation.targetId],
      description: `Coordinated operation ${overallSuccess ? 'succeeded' : 'failed'}!`,
      impact: 'major'
    });
  } else {
    updatedOp = { ...updatedOp, phases: updatedPhases };
  }

  return { operation: updatedOp, events, updatedBots };
}

// ══════════════════════════════════════════
// DETECCIÓN POR EL JUGADOR
// ══════════════════════════════════════════

export function checkPlayerDetection(
  operation: CoordinatedOperation,
  botStates: Record<string, BotState>
): { detected: boolean; warningTime: number } {
  const config = OPERATION_CONFIG[operation.type];
  if (!config) return { detected: false, warningTime: 0 };

  let detectionChance = 0.1; // 10% base

  // Aliados que pueden avisar
  const potentialSpies = operation.participantIds.filter(id => {
    const bot = botStates[id];
    return bot && bot.playerReputation > 50;
  });

  detectionChance += potentialSpies.length * 0.15;

  const detected = Math.random() < detectionChance;
  const warningTime = detected ? config.warningTime : 0;

  return { detected, warningTime };
}
