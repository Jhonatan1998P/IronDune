
import { BotState, BotGoal } from '../../types/bot';
import { BotPersonality } from '../../types/enums';
import { Faction } from '../../types/faction';
import { DiplomacyState } from '../../types/diplomacy';
import { CoordinatedOperation } from '../../types/operations';
import { PERSONALITY_WEIGHTS, PersonalityTraits } from './personalityWeights';
import { selectAttackTarget, shouldTargetPlayer } from './targetSelection';
import { getTotalResources } from '../engine/botSimulation';

// ══════════════════════════════════════════
// TIPOS DE DECISIONES
// ══════════════════════════════════════════

export interface BotDecision {
  type: string;
  targetId?: string;
  targetFaction?: string;
  currentFaction?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  data?: Record<string, any>;
}

export interface WorldState {
  botStates: Record<string, BotState>;
  factions: Record<string, Faction>;
  diplomacy: DiplomacyState;
  operations: Record<string, CoordinatedOperation>;
  incomingAttacks?: { targetId: string; attackerId: string }[];
  playerArmyScore?: number;
  playerFactionId?: string;
}

// ══════════════════════════════════════════
// ANÁLISIS DE CONTEXTO
// ══════════════════════════════════════════

interface BotContext {
  militaryStrength: number;
  economicStrength: number;
  isVulnerable: boolean;

  underAttack: boolean;
  incomingAttacks: string[];
  recentAttackers: string[];

  factionAtWar: boolean;
  factionStability: number;
  allyUnderAttack: string | null;

  canExpand: boolean;
  weakTargets: string[];
  potentialAllies: string[];
  betrayalOpportunity: boolean;

  playerThreatLevel: number;
  playerRelation: 'ally' | 'neutral' | 'enemy';
}

function analyzeContext(bot: BotState, worldState: WorldState): BotContext {
  const avgMilitary = calculateAverageMilitary(worldState);
  const avgEconomic = calculateAverageEconomic(worldState);

  return {
    militaryStrength: bot.armyScore / Math.max(1, avgMilitary),
    economicStrength: getTotalResources(bot) / Math.max(1, avgEconomic),
    isVulnerable: bot.armyScore < avgMilitary * 0.5,

    underAttack: worldState.incomingAttacks?.some(a => a.targetId === bot.id) || false,
    incomingAttacks: worldState.incomingAttacks
      ?.filter(a => a.targetId === bot.id)
      .map(a => a.attackerId) || [],
    recentAttackers: bot.memory.recentAttackers.map(a => a.attackerId),

    factionAtWar: bot.factionId
      ? (worldState.factions[bot.factionId]?.activeWars.some(w => w.status === 'active') || false)
      : false,
    factionStability: bot.factionId
      ? worldState.factions[bot.factionId]?.stability || 0
      : 0,
    allyUnderAttack: findAllyUnderAttack(bot, worldState),

    canExpand: bot.armyScore > avgMilitary * 1.2,
    weakTargets: findWeakTargets(bot, worldState),
    potentialAllies: findPotentialAllies(bot, worldState),
    betrayalOpportunity: assessBetrayalOpportunity(bot, worldState),

    playerThreatLevel: bot.memory.playerThreatLevel,
    playerRelation: determinePlayerRelation(bot, worldState)
  };
}

// ══════════════════════════════════════════
// ÁRBOL DE DECISIONES PRINCIPAL
// ══════════════════════════════════════════

export function makeBotDecision(
  bot: BotState,
  worldState: WorldState
): BotDecision {
  const traits = PERSONALITY_WEIGHTS[bot.personality];
  const context = analyzeContext(bot, worldState);

  // PRIORIDAD 1: SUPERVIVENCIA
  if (context.underAttack) {
    return handleUnderAttack(bot, context, traits);
  }

  // PRIORIDAD 2: VENGANZA
  if (bot.currentGoal === BotGoal.REVENGE && traits.revenge > 0.5) {
    const revenge = planRevenge(bot, context, traits);
    if (revenge) return revenge;
  }

  // PRIORIDAD 3: OBLIGACIONES DE FACCIÓN
  if (bot.factionId && context.factionAtWar) {
    return contributeToFactionWar(bot, context, traits);
  }

  // PRIORIDAD 4: DEFENSA DE ALIADOS
  if (context.allyUnderAttack && traits.loyalty > 0.6) {
    return defendAlly(bot, context, traits);
  }

  // PRIORIDAD 5: TRAICIÓN (si es conveniente)
  if (shouldConsiderBetrayal(bot, context, traits)) {
    const betrayal = planBetrayal(bot, context, traits, worldState);
    if (betrayal) return betrayal;
  }

  // PRIORIDAD 6: EXPANSIÓN
  if (context.canExpand && traits.aggression > 0.5) {
    const expansion = planExpansion(bot, context, traits, worldState);
    if (expansion) return expansion;
  }

  // PRIORIDAD 7: DIPLOMACIA
  if (shouldSeekDiplomacy(bot, context, traits)) {
    return planDiplomacy(bot, context, traits);
  }

  // PRIORIDAD 8: DESARROLLO ECONÓMICO
  return planEconomicDevelopment(bot, context, traits);
}

// ══════════════════════════════════════════
// MANEJADORES DE SITUACIÓN
// ══════════════════════════════════════════

function handleUnderAttack(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): BotDecision {
  if (bot.factionId && traits.loyalty > 0.4) {
    return {
      type: 'request_aid',
      targetId: bot.factionId,
      priority: 'critical',
      reason: 'Under attack, requesting faction support'
    };
  }

  if (context.militaryStrength > 0.8) {
    return {
      type: 'defend',
      priority: 'high',
      reason: 'Defending against incoming attack'
    };
  }

  if (traits.riskTolerance < 0.3 && context.potentialAllies.length > 0) {
    return {
      type: 'seek_emergency_alliance',
      targetId: context.potentialAllies[0],
      priority: 'critical',
      reason: 'Vulnerable, seeking protection'
    };
  }

  return {
    type: 'defend',
    priority: 'high',
    reason: 'Defending despite odds'
  };
}

function planRevenge(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): BotDecision | null {
  if (context.recentAttackers.length === 0) return null;

  const targetId = context.recentAttackers[0];
  const canWin = context.militaryStrength > 0.7;

  if (!canWin && traits.patience > 0.5) {
    return {
      type: 'build_army_for_revenge',
      targetId,
      priority: 'high',
      reason: 'Building strength for revenge'
    };
  }

  if (canWin) {
    return {
      type: 'attack',
      targetId,
      priority: 'high',
      reason: `Revenge against ${targetId}`
    };
  }

  return null;
}

function contributeToFactionWar(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): BotDecision {
  if (context.militaryStrength > 1.0 && traits.aggression > 0.5) {
    return {
      type: 'faction_war_attack',
      priority: 'high',
      reason: 'Contributing to faction war effort'
    };
  }

  return {
    type: 'build_army',
    priority: 'medium',
    reason: 'Building forces for faction war'
  };
}

function defendAlly(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): BotDecision {
  return {
    type: 'defend_ally',
    targetId: context.allyUnderAttack!,
    priority: 'high',
    reason: `Defending ally ${context.allyUnderAttack}`
  };
}

function shouldConsiderBetrayal(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): boolean {
  if (bot.personality !== BotPersonality.ROGUE && Math.random() > 0.1) {
    return false;
  }

  const factors = [
    context.factionStability < 30,
    context.betrayalOpportunity,
    traits.loyalty < 0.3,
    context.factionAtWar && context.militaryStrength < 0.5
  ];

  const betrayalScore = factors.filter(Boolean).length / factors.length;
  return betrayalScore > 0.5;
}

function planBetrayal(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits,
  worldState: WorldState
): BotDecision | null {
  if (!bot.factionId) return null;

  const currentFaction = bot.factionId;
  const enemyFactions = Object.values(worldState.factions)
    .filter(f => f.enemies.includes(currentFaction));

  if (enemyFactions.length === 0) return null;

  const bestOption = enemyFactions.sort((a, b) => b.power - a.power)[0];

  return {
    type: 'betray',
    currentFaction,
    targetFaction: bestOption.id,
    priority: 'high',
    reason: `Switching sides to ${bestOption.name} for better prospects`
  };
}

function planExpansion(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits,
  worldState: WorldState
): BotDecision | null {
  if (context.weakTargets.length === 0) return null;

  const allCandidates = context.weakTargets;
  const target = selectAttackTarget(bot, allCandidates, worldState, traits);

  if (!target || target.score <= 0) return null;

  return {
    type: 'attack',
    targetId: target.targetId,
    priority: 'medium',
    reason: target.reasons.join(', '),
    data: { score: target.score }
  };
}

function shouldSeekDiplomacy(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): boolean {
  if (traits.diplomacy < 0.3) return false;
  if (context.isVulnerable) return true;
  if (!bot.factionId && traits.diplomacy > 0.5) return true;
  if (context.potentialAllies.length > 0 && Math.random() < traits.diplomacy * 0.3) return true;
  return false;
}

function planDiplomacy(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): BotDecision {
  if (context.isVulnerable) {
    return {
      type: 'seek_alliance',
      targetId: context.potentialAllies[0],
      priority: 'high',
      reason: 'Seeking protection through alliance'
    };
  }

  if (!bot.factionId) {
    return {
      type: 'seek_faction',
      priority: 'medium',
      reason: 'Looking for a faction to join'
    };
  }

  return {
    type: 'propose_trade',
    targetId: context.potentialAllies[0],
    priority: 'low',
    reason: 'Seeking trade opportunities'
  };
}

function planEconomicDevelopment(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): BotDecision {
  if (context.economicStrength < 0.5) {
    return {
      type: 'build_economy',
      priority: 'medium',
      reason: 'Economy is below average, focusing on development'
    };
  }

  if (context.militaryStrength < 0.7 && traits.aggression > 0.3) {
    return {
      type: 'build_army',
      priority: 'medium',
      reason: 'Military below threshold, recruiting units'
    };
  }

  return {
    type: 'expand_economy',
    priority: 'low',
    reason: 'Continuing economic expansion'
  };
}

// ══════════════════════════════════════════
// FUNCIONES AUXILIARES
// ══════════════════════════════════════════

function calculateAverageMilitary(worldState: WorldState): number {
  const bots = Object.values(worldState.botStates);
  if (bots.length === 0) return 0;
  return bots.reduce((sum, b) => sum + b.armyScore, 0) / bots.length;
}

function calculateAverageEconomic(worldState: WorldState): number {
  const bots = Object.values(worldState.botStates);
  if (bots.length === 0) return 0;
  return bots.reduce((sum, b) => sum + getTotalResources(b), 0) / bots.length;
}

function findAllyUnderAttack(bot: BotState, worldState: WorldState): string | null {
  if (!bot.factionId) return null;
  const faction = worldState.factions[bot.factionId];
  if (!faction) return null;

  const attacks = worldState.incomingAttacks || [];
  for (const attack of attacks) {
    if (faction.memberIds.includes(attack.targetId) && attack.targetId !== bot.id) {
      return attack.targetId;
    }
  }
  return null;
}

function findWeakTargets(bot: BotState, worldState: WorldState): string[] {
  return Object.keys(worldState.botStates).filter(id => {
    if (id === bot.id) return false;
    const target = worldState.botStates[id];
    if (!target) return false;
    // Weak = less than 60% of our army
    if (target.armyScore >= bot.armyScore * 0.6) return false;
    // Don't target allies
    if (bot.factionId && target.factionId === bot.factionId) return false;
    return true;
  });
}

function findPotentialAllies(bot: BotState, worldState: WorldState): string[] {
  return Object.keys(worldState.botStates).filter(id => {
    if (id === bot.id) return false;
    const candidate = worldState.botStates[id];
    if (!candidate) return false;
    // Not in enemy faction
    if (bot.factionId && candidate.factionId) {
      const myFaction = worldState.factions[bot.factionId];
      if (myFaction?.enemies.includes(candidate.factionId)) return false;
    }
    // Similar power level
    const ratio = bot.armyScore / Math.max(1, candidate.armyScore);
    if (ratio < 0.3 || ratio > 3.0) return false;
    // Not a recent attacker
    if (bot.memory.recentAttackers.some(a => a.attackerId === id)) return false;
    // Not a traitor
    if (bot.memory.betrayals.some(b => b.traitorId === id)) return false;
    return true;
  }).slice(0, 5); // Limit to 5 candidates
}

function assessBetrayalOpportunity(bot: BotState, worldState: WorldState): boolean {
  if (!bot.factionId) return false;
  const faction = worldState.factions[bot.factionId];
  if (!faction) return false;

  // Low stability + losing wars = opportunity
  if (faction.stability < 30) return true;
  const losingWar = faction.activeWars.some(w =>
    w.status === 'active' && w.currentScore.them > w.currentScore.us * 1.5
  );
  return losingWar;
}

function determinePlayerRelation(bot: BotState, worldState: WorldState): 'ally' | 'neutral' | 'enemy' {
  if (bot.playerReputation >= 50) return 'ally';
  if (bot.playerReputation <= -50) return 'enemy';

  // Check faction relations
  if (bot.factionId && worldState.playerFactionId) {
    const faction = worldState.factions[bot.factionId];
    if (faction?.allies.includes(worldState.playerFactionId)) return 'ally';
    if (faction?.enemies.includes(worldState.playerFactionId)) return 'enemy';
  }

  return 'neutral';
}

/**
 * Procesa decisiones de todos los bots que necesitan actualización
 */
export function processBotDecisions(
  botStates: Record<string, BotState>,
  worldState: WorldState,
  currentTime: number
): Record<string, BotState> {
  const BOT_DECISION_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const updated: Record<string, BotState> = { ...botStates };
  let hasChanges = false;

  for (const [id, bot] of Object.entries(botStates)) {
    if (currentTime - bot.lastDecisionTime < BOT_DECISION_INTERVAL) continue;

    const decision = makeBotDecision(bot, worldState);

    // Update bot goal based on decision
    let newGoal = bot.currentGoal;
    switch (decision.type) {
      case 'attack':
      case 'faction_war_attack':
        newGoal = BotGoal.BUILD_ARMY;
        break;
      case 'defend':
      case 'defend_ally':
        newGoal = BotGoal.DEFEND_ALLY;
        break;
      case 'build_army':
      case 'build_army_for_revenge':
        newGoal = decision.type === 'build_army_for_revenge' ? BotGoal.REVENGE : BotGoal.BUILD_ARMY;
        break;
      case 'seek_alliance':
      case 'seek_faction':
        newGoal = BotGoal.SEEK_ALLIANCE;
        break;
      case 'betray':
        newGoal = BotGoal.BETRAY_FACTION;
        break;
      case 'build_economy':
      case 'expand_economy':
        newGoal = BotGoal.EXPAND_ECONOMY;
        break;
    }

    updated[id] = {
      ...bot,
      currentGoal: newGoal,
      lastDecisionTime: currentTime
    };
    hasChanges = true;
  }

  return hasChanges ? updated : botStates;
}
