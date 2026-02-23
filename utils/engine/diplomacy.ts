
import { BotState } from '../../types/bot';
import { BotPersonality, ResourceType } from '../../types/enums';
import { Faction } from '../../types/faction';
import {
  DiplomaticAction, DiplomaticProposal, DealTerms, ProposalStatus,
  ActiveTreaty, TreatyType, DiplomacyState,
  WorldEvent, WorldEventType
} from '../../types/diplomacy';
import { GameState } from '../../types/state';

const PROPOSAL_DURATION = 30 * 60 * 1000; // 30 minutos para responder

let proposalIdCounter = 0;
const generateId = (): string => `prop-${++proposalIdCounter}-${Date.now()}`;

// ══════════════════════════════════════════
// CREACIÓN DE PROPUESTAS
// ══════════════════════════════════════════

export function createProposal(
  from: { id: string; type: 'bot' | 'faction' | 'player' },
  to: { id: string; type: 'bot' | 'faction' | 'player' },
  action: DiplomaticAction,
  terms: DealTerms
): DiplomaticProposal {
  return {
    id: generateId(),
    type: action,
    fromId: from.id,
    fromType: from.type,
    toId: to.id,
    toType: to.type,
    terms,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + PROPOSAL_DURATION
  };
}

// ══════════════════════════════════════════
// EVALUACIÓN DE PROPUESTAS (IA)
// ══════════════════════════════════════════

export function evaluateProposal(
  proposal: DiplomaticProposal,
  evaluator: BotState,
  worldState: { factions: Record<string, Faction>; botStates: Record<string, BotState> }
): { decision: 'accept' | 'reject' | 'counter'; reason: string; counterTerms?: DealTerms } {

  const proposerReputation = evaluator.reputation[proposal.fromId] || 0;

  const BASE_ACCEPTANCE: Record<string, number> = {
    [BotPersonality.WARLORD]: 0.3,
    [BotPersonality.TURTLE]: 0.5,
    [BotPersonality.TYCOON]: 0.7,
    [BotPersonality.ROGUE]: 0.4
  };

  let acceptanceChance = BASE_ACCEPTANCE[evaluator.personality] || 0.5;

  // Modificar por reputación
  acceptanceChance += proposerReputation / 200;

  // Modificar por tipo de propuesta
  switch (proposal.type) {
    case DiplomaticAction.PROPOSE_ALLIANCE:
      if (evaluator.memory.betrayals.some(b => b.traitorId === proposal.fromId)) {
        return { decision: 'reject', reason: 'Never forget betrayal' };
      }
      break;

    case DiplomaticAction.PROPOSE_JOINT_ATTACK:
      const targetId = proposal.terms.targetId;
      if (!targetId || evaluator.memory.recentAllies.some(a => a.allyId === targetId)) {
        return { decision: 'reject', reason: 'Will not attack allies' };
      }
      // Warlords more likely to accept joint attacks
      if (evaluator.personality === BotPersonality.WARLORD) {
        acceptanceChance += 0.3;
      }
      break;

    case DiplomaticAction.OFFER_TRIBUTE:
      acceptanceChance += 0.4;
      break;

    case DiplomaticAction.PROPOSE_NON_AGGRESSION:
      if (evaluator.personality === BotPersonality.TURTLE) {
        acceptanceChance += 0.3;
      }
      break;

    case DiplomaticAction.PROPOSE_TRADE_DEAL:
      if (evaluator.personality === BotPersonality.TYCOON) {
        acceptanceChance += 0.3;
      }
      break;

    case DiplomaticAction.OFFER_CEASEFIRE:
      // More likely to accept if losing
      acceptanceChance += 0.2;
      break;

    case DiplomaticAction.DEMAND_TRIBUTE:
      // Very unlikely to accept unless weak
      acceptanceChance -= 0.4;
      if (evaluator.armyScore < 100) {
        acceptanceChance += 0.3;
      }
      break;
  }

  // Decisión final
  if (Math.random() < acceptanceChance) {
    return { decision: 'accept', reason: 'Terms acceptable' };
  }

  // Considerar contraoferta
  if (Math.random() < 0.3) {
    return {
      decision: 'counter',
      reason: 'Better terms required',
      counterTerms: generateCounterTerms(proposal.terms, evaluator)
    };
  }

  return { decision: 'reject', reason: 'Not interested at this time' };
}

function generateCounterTerms(
  originalTerms: DealTerms,
  evaluator: BotState
): DealTerms {
  const counter = { ...originalTerms };

  if (counter.resourcesOffered) {
    const adjusted: Partial<Record<ResourceType, number>> = {};
    for (const [resource, amount] of Object.entries(counter.resourcesOffered)) {
      if (amount) {
        adjusted[resource as ResourceType] = Math.floor(amount * 0.7);
      }
    }
    counter.resourcesOffered = adjusted;
  }

  if (counter.resourcesRequested) {
    const adjusted: Partial<Record<ResourceType, number>> = {};
    for (const [resource, amount] of Object.entries(counter.resourcesRequested)) {
      if (amount) {
        adjusted[resource as ResourceType] = Math.floor(amount * 1.3);
      }
    }
    counter.resourcesRequested = adjusted;
  }

  return counter;
}

// ══════════════════════════════════════════
// PROCESAMIENTO DE TRATADOS
// ══════════════════════════════════════════

export function processTreaties(
  treaties: Record<string, ActiveTreaty>,
  currentTime: number
): {
  updatedTreaties: Record<string, ActiveTreaty>;
  expiredTreaties: ActiveTreaty[];
  events: WorldEvent[]
} {
  const updated: Record<string, ActiveTreaty> = {};
  const expired: ActiveTreaty[] = [];
  const events: WorldEvent[] = [];

  for (const [id, treaty] of Object.entries(treaties)) {
    // Verificar expiración
    if (treaty.expiresAt && currentTime >= treaty.expiresAt) {
      expired.push(treaty);
      events.push({
        id: `event-treaty-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: WorldEventType.ALLIANCE_BROKEN,
        timestamp: currentTime,
        actors: treaty.parties,
        description: `${treaty.type} treaty expired`,
        impact: 'minor'
      });
      continue;
    }

    // Verificar violaciones críticas
    const criticalViolations = treaty.violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      expired.push(treaty);
      events.push({
        id: `event-violation-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: WorldEventType.BETRAYAL,
        timestamp: currentTime,
        actors: [criticalViolations[0].violatorId],
        description: `Treaty violated: ${criticalViolations[0].description}`,
        impact: 'major'
      });
      continue;
    }

    updated[id] = treaty;
  }

  return { updatedTreaties: updated, expiredTreaties: expired, events };
}

/**
 * Crea un tratado a partir de una propuesta aceptada
 */
export function createTreatyFromProposal(proposal: DiplomaticProposal): ActiveTreaty {
  const treatyTypeMap: Partial<Record<DiplomaticAction, TreatyType>> = {
    [DiplomaticAction.PROPOSE_ALLIANCE]: TreatyType.ALLIANCE,
    [DiplomaticAction.PROPOSE_NON_AGGRESSION]: TreatyType.NON_AGGRESSION,
    [DiplomaticAction.PROPOSE_TRADE_DEAL]: TreatyType.TRADE_AGREEMENT,
    [DiplomaticAction.OFFER_CEASEFIRE]: TreatyType.CEASEFIRE,
    [DiplomaticAction.OFFER_TRIBUTE]: TreatyType.TRIBUTE,
  };

  const treatyType = treatyTypeMap[proposal.type] || TreatyType.NON_AGGRESSION;
  const defaultDuration = proposal.terms.duration || (4 * 60 * 60 * 1000); // 4 hours default

  return {
    id: `treaty-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    type: treatyType,
    parties: [proposal.fromId, proposal.toId],
    terms: proposal.terms,
    startedAt: Date.now(),
    expiresAt: defaultDuration > 0 ? Date.now() + defaultDuration : null,
    violations: []
  };
}

// ══════════════════════════════════════════
// ACCIONES DEL JUGADOR
// ══════════════════════════════════════════

export function playerPropose(
  diplomacy: DiplomacyState,
  targetId: string,
  targetType: 'bot' | 'faction',
  action: DiplomaticAction,
  terms: DealTerms
): DiplomacyState {
  const proposal = createProposal(
    { id: 'player', type: 'player' },
    { id: targetId, type: targetType },
    action,
    terms
  );

  return {
    ...diplomacy,
    proposals: {
      ...diplomacy.proposals,
      [proposal.id]: proposal
    }
  };
}

export function playerRespond(
  diplomacy: DiplomacyState,
  proposalId: string,
  response: 'accept' | 'reject' | 'counter',
  counterTerms?: DealTerms
): DiplomacyState {
  const proposal = diplomacy.proposals[proposalId];
  if (!proposal || proposal.status !== 'pending') return diplomacy;

  let newStatus: ProposalStatus;
  let treaty: ActiveTreaty | null = null;

  switch (response) {
    case 'accept':
      newStatus = 'accepted';
      treaty = createTreatyFromProposal(proposal);
      break;
    case 'reject':
      newStatus = 'rejected';
      break;
    case 'counter':
      newStatus = 'countered';
      break;
    default:
      newStatus = 'rejected';
  }

  return {
    ...diplomacy,
    proposals: {
      ...diplomacy.proposals,
      [proposalId]: { ...proposal, status: newStatus, respondedAt: Date.now() }
    },
    treaties: treaty ? {
      ...diplomacy.treaties,
      [treaty.id]: treaty
    } : diplomacy.treaties
  };
}

// ══════════════════════════════════════════
// PROCESAMIENTO DE DIPLOMACIA (TICK)
// ══════════════════════════════════════════

export function processDiplomacyTick(
  diplomacy: DiplomacyState,
  botStates: Record<string, BotState>,
  factions: Record<string, Faction>,
  currentTime: number
): { diplomacy: DiplomacyState; events: WorldEvent[] } {
  let allEvents: WorldEvent[] = [];

  // 1. Expire old proposals
  const updatedProposals: Record<string, DiplomaticProposal> = {};
  for (const [id, proposal] of Object.entries(diplomacy.proposals)) {
    if (proposal.status === 'pending' && currentTime >= proposal.expiresAt) {
      updatedProposals[id] = { ...proposal, status: 'expired' };
    } else {
      updatedProposals[id] = proposal;
    }
  }

  // 2. Process pending proposals (bot evaluations)
  for (const [id, proposal] of Object.entries(updatedProposals)) {
    if (proposal.status !== 'pending') continue;
    if (proposal.toType !== 'bot') continue;

    const evaluator = botStates[proposal.toId];
    if (!evaluator) continue;

    // Bots evaluate proposals periodically
    const timeSinceCreation = currentTime - proposal.createdAt;
    if (timeSinceCreation < 2 * 60 * 1000) continue; // Wait at least 2 minutes before responding

    const result = evaluateProposal(proposal, evaluator, { factions, botStates });

    switch (result.decision) {
      case 'accept': {
        updatedProposals[id] = { ...proposal, status: 'accepted', respondedAt: currentTime, response: result.reason };
        const treaty = createTreatyFromProposal(proposal);
        diplomacy = {
          ...diplomacy,
          treaties: { ...diplomacy.treaties, [treaty.id]: treaty }
        };

        if (proposal.type === DiplomaticAction.PROPOSE_ALLIANCE) {
          allEvents.push({
            id: `event-alliance-${Date.now()}`,
            type: WorldEventType.ALLIANCE_FORMED,
            timestamp: currentTime,
            actors: [proposal.fromId, proposal.toId],
            description: `Alliance formed between parties`,
            impact: 'major'
          });
        }
        break;
      }
      case 'reject':
        updatedProposals[id] = { ...proposal, status: 'rejected', respondedAt: currentTime, response: result.reason };
        break;
      case 'counter':
        updatedProposals[id] = { ...proposal, status: 'countered', respondedAt: currentTime, response: result.reason };
        if (result.counterTerms) {
          const counterProposal = createProposal(
            { id: proposal.toId, type: proposal.toType },
            { id: proposal.fromId, type: proposal.fromType },
            proposal.type,
            result.counterTerms
          );
          updatedProposals[counterProposal.id] = counterProposal;
        }
        break;
    }
  }

  // 3. Process treaties
  const { updatedTreaties, expiredTreaties, events: treatyEvents } = processTreaties(
    diplomacy.treaties,
    currentTime
  );
  allEvents = [...allEvents, ...treatyEvents];

  return {
    diplomacy: {
      proposals: updatedProposals,
      treaties: updatedTreaties,
      worldEvents: [...diplomacy.worldEvents, ...allEvents].slice(-100) // Keep last 100 events
    },
    events: allEvents
  };
}
