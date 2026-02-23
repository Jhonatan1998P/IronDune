
import { BotPersonality } from '../../types/enums';
import { BotState } from '../../types/bot';
import {
  Faction, FactionIdeology, FactionEventType, FactionWar,
  WarReason, FACTION_LIMITS
} from '../../types/faction';
import { WorldEvent, WorldEventType } from '../../types/diplomacy';
import { FACTION_TEMPLATES, DYNAMIC_FACTION_NAMES, DYNAMIC_FACTION_MOTTOS, DYNAMIC_FACTION_COLORS } from '../../data/factions';

let factionIdCounter = 0;
const generateFactionId = (): string => `faction-${++factionIdCounter}-${Date.now()}`;

// ══════════════════════════════════════════
// FORMACIÓN DE FACCIONES
// ══════════════════════════════════════════

/**
 * Determina si un bot debería intentar formar/unirse a una facción
 */
export function shouldSeekFaction(bot: BotState, factions: Record<string, Faction>): boolean {
  if (bot.factionId) return false;

  const FACTION_TENDENCY: Record<string, number> = {
    [BotPersonality.WARLORD]: 0.6,
    [BotPersonality.TURTLE]: 0.4,
    [BotPersonality.TYCOON]: 0.7,
    [BotPersonality.ROGUE]: 0.5
  };

  const tendency = FACTION_TENDENCY[bot.personality] || 0.5;
  const recentAttacks = bot.memory.recentAttackers.length;
  const vulnerabilityBonus = recentAttacks * 0.1;
  const ambitionBonus = bot.ambition * 0.2;

  return Math.random() < (tendency + vulnerabilityBonus + ambitionBonus);
}

/**
 * Encuentra la mejor facción para que un bot se una
 */
export function findBestFaction(
  bot: BotState,
  factions: Record<string, Faction>,
  botStates: Record<string, BotState>
): Faction | null {
  const candidates = Object.values(factions).filter(f => {
    if (f.memberIds.length >= FACTION_LIMITS.MAX_MEMBERS) return false;
    if (bot.memory.betrayals.some(b => f.memberIds.includes(b.traitorId))) return false;
    return isIdeologyCompatible(bot.personality, f.ideology);
  });

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    const scoreA = calculateFactionCompatibility(bot, a, botStates);
    const scoreB = calculateFactionCompatibility(bot, b, botStates);
    return scoreB - scoreA;
  })[0];
}

function isIdeologyCompatible(
  personality: BotPersonality,
  ideology: FactionIdeology
): boolean {
  const COMPATIBILITY: Record<string, FactionIdeology[]> = {
    [BotPersonality.WARLORD]: [FactionIdeology.MILITARIST, FactionIdeology.EXPANSIONIST],
    [BotPersonality.TURTLE]: [FactionIdeology.ISOLATIONIST, FactionIdeology.MERCANTILE],
    [BotPersonality.TYCOON]: [FactionIdeology.MERCANTILE, FactionIdeology.OPPORTUNIST],
    [BotPersonality.ROGUE]: [FactionIdeology.OPPORTUNIST, FactionIdeology.EXPANSIONIST]
  };

  return (COMPATIBILITY[personality] || []).includes(ideology);
}

function calculateFactionCompatibility(
  bot: BotState,
  faction: Faction,
  botStates: Record<string, BotState>
): number {
  let score = 0;

  // Power similarity (prefer factions at similar level)
  const factionAvgScore = faction.memberIds.reduce((sum, id) => {
    const member = botStates[id];
    return sum + (member ? member.armyScore : 0);
  }, 0) / Math.max(1, faction.memberIds.length);

  const powerRatio = bot.armyScore / Math.max(1, factionAvgScore);
  score += powerRatio > 0.5 && powerRatio < 2.0 ? 30 : 0;

  // Reputation with faction members
  const avgReputation = faction.memberIds.reduce((sum, id) => {
    return sum + (bot.reputation[id] || 0);
  }, 0) / Math.max(1, faction.memberIds.length);
  score += avgReputation;

  // Stability preference
  score += faction.stability * 0.3;

  // Size preference (not too small, not too full)
  if (faction.memberIds.length >= 3 && faction.memberIds.length <= 10) {
    score += 15;
  }

  return score;
}

// ══════════════════════════════════════════
// GESTIÓN DE MEMBRESÍA
// ══════════════════════════════════════════

export function addMemberToFaction(
  faction: Faction,
  botId: string
): Faction {
  return {
    ...faction,
    memberIds: [...faction.memberIds, botId],
    power: faction.power, // Will be recalculated
    history: [...faction.history, {
      type: FactionEventType.MEMBER_JOINED,
      timestamp: Date.now(),
      actorId: botId,
      details: `New member joined`
    }]
  };
}

export function removeMemberFromFaction(
  faction: Faction,
  botId: string,
  reason: 'left' | 'kicked' | 'betrayed'
): Faction {
  const eventType = reason === 'kicked'
    ? FactionEventType.MEMBER_KICKED
    : reason === 'betrayed'
      ? FactionEventType.BETRAYAL
      : FactionEventType.MEMBER_LEFT;

  let newLeaderId = faction.leaderId;
  if (botId === faction.leaderId) {
    newLeaderId = faction.officerIds[0] || faction.memberIds.find(id => id !== botId) || '';
  }

  return {
    ...faction,
    leaderId: newLeaderId,
    officerIds: faction.officerIds.filter(id => id !== botId),
    memberIds: faction.memberIds.filter(id => id !== botId),
    stability: Math.max(0, faction.stability - (reason === 'betrayed' ? 30 : 10)),
    history: [...faction.history, {
      type: eventType,
      timestamp: Date.now(),
      actorId: botId,
      details: `Member ${reason}`
    }]
  };
}

// ══════════════════════════════════════════
// GUERRAS ENTRE FACCIONES
// ══════════════════════════════════════════

export function declareWar(
  attacker: Faction,
  defender: Faction,
  reason: WarReason
): { attacker: Faction; defender: Faction; war: FactionWar; events: WorldEvent[] } {
  const warId = `war-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  const war: FactionWar = {
    id: warId,
    enemyFactionId: defender.id,
    startTime: Date.now(),
    reason,
    battles: [],
    currentScore: { us: 0, them: 0 },
    status: 'active'
  };

  const events: WorldEvent[] = [{
    id: `event-${Date.now()}`,
    type: WorldEventType.WAR_DECLARED,
    timestamp: Date.now(),
    actors: [attacker.id, defender.id],
    description: `${attacker.name} declared war on ${defender.name}!`,
    impact: 'major'
  }];

  return {
    attacker: {
      ...attacker,
      enemies: [...attacker.enemies, defender.id],
      activeWars: [...attacker.activeWars, war],
      history: [...attacker.history, {
        type: FactionEventType.WAR_DECLARED,
        timestamp: Date.now(),
        actorId: attacker.leaderId,
        details: `War declared against ${defender.name}`
      }]
    },
    defender: {
      ...defender,
      enemies: [...defender.enemies, attacker.id],
      activeWars: [...defender.activeWars, {
        ...war,
        enemyFactionId: attacker.id
      }]
    },
    war,
    events
  };
}

// ══════════════════════════════════════════
// ESTABILIDAD Y FRAGMENTACIÓN
// ══════════════════════════════════════════

export function updateFactionStability(faction: Faction): Faction {
  let stabilityChange = 0;

  // Factores positivos
  const winningWars = faction.activeWars.filter(w =>
    w.status === 'active' && w.currentScore.us > w.currentScore.them
  );
  if (winningWars.length > 0) {
    stabilityChange += 5;
  }

  const treasuryValue = Object.values(faction.treasury).reduce((sum, v) => sum + (v || 0), 0);
  if (treasuryValue > 10000) {
    stabilityChange += 2;
  }

  // Factores negativos
  const losingWars = faction.activeWars.filter(w =>
    w.status === 'active' && w.currentScore.us < w.currentScore.them
  );
  if (losingWars.length > 0) {
    stabilityChange -= 10;
  }

  if (faction.memberIds.length < FACTION_LIMITS.MIN_MEMBERS) {
    stabilityChange -= 20;
  }

  // Decay natural
  stabilityChange -= FACTION_LIMITS.STABILITY_DECAY_RATE;

  return {
    ...faction,
    stability: Math.max(0, Math.min(100, faction.stability + stabilityChange))
  };
}

export function shouldFactionDissolve(faction: Faction): boolean {
  return faction.stability <= 0 ||
    faction.memberIds.length < FACTION_LIMITS.MIN_MEMBERS;
}

/**
 * Recalcula el poder total de una facción
 */
export function recalculateFactionPower(
  faction: Faction,
  botStates: Record<string, BotState>
): number {
  return faction.memberIds.reduce((sum, id) => {
    const bot = botStates[id];
    return sum + (bot ? bot.armyScore : 0);
  }, 0);
}

// ══════════════════════════════════════════
// INICIALIZACIÓN DE FACCIONES
// ══════════════════════════════════════════

/**
 * Crea las facciones iniciales y asigna bots a ellas
 */
export function initializeFactions(
  botStates: Record<string, BotState>
): { factions: Record<string, Faction>; updatedBots: Record<string, BotState> } {
  const factions: Record<string, Faction> = {};
  const updatedBots = { ...botStates };

  // Sort bots by army score (strongest first)
  const sortedBotIds = Object.keys(botStates).sort(
    (a, b) => (botStates[b].armyScore) - (botStates[a].armyScore)
  );

  // Create initial factions from templates
  FACTION_TEMPLATES.forEach((template, index) => {
    const id = `faction-init-${index}`;
    factionIdCounter = Math.max(factionIdCounter, index + 1);

    const faction: Faction = {
      id,
      name: template.name!,
      tag: template.tag!,
      motto: template.motto!,
      color: template.color!,
      iconId: template.iconId!,
      ideology: template.ideology!,
      leaderId: '',
      officerIds: [],
      memberIds: [],
      pendingInvites: [],
      founded: Date.now(),
      treasury: {},
      contributionHistory: [],
      allies: [],
      enemies: [],
      neutrals: [],
      activeWars: [],
      power: 0,
      territory: 0,
      stability: 75,
      reputation: 50,
      history: [{
        type: FactionEventType.FOUNDED,
        timestamp: Date.now(),
        actorId: 'system',
        details: `${template.name} was founded`
      }]
    };

    factions[id] = faction;
  });

  // Assign top bots to factions based on personality/ideology compatibility
  const factionIds = Object.keys(factions);
  let assignedCount = 0;
  const maxPerFaction = 12; // Start with reasonable faction sizes

  for (const botId of sortedBotIds) {
    if (assignedCount >= factionIds.length * maxPerFaction) break;

    const bot = updatedBots[botId];

    // Find compatible faction that isn't full
    for (const factionId of factionIds) {
      const faction = factions[factionId];
      if (faction.memberIds.length >= maxPerFaction) continue;
      if (!isIdeologyCompatible(bot.personality, faction.ideology)) continue;

      // Assign bot to faction
      if (faction.memberIds.length === 0) {
        faction.leaderId = botId;
        updatedBots[botId] = { ...bot, factionId, factionRole: 'LEADER' as any };
      } else if (faction.officerIds.length < FACTION_LIMITS.MAX_OFFICERS && faction.memberIds.length < 4) {
        faction.officerIds.push(botId);
        updatedBots[botId] = { ...bot, factionId, factionRole: 'OFFICER' as any };
      } else {
        updatedBots[botId] = { ...bot, factionId, factionRole: 'MEMBER' as any };
      }

      faction.memberIds.push(botId);
      assignedCount++;
      break;
    }
  }

  // Recalculate faction power
  for (const factionId of factionIds) {
    factions[factionId].power = recalculateFactionPower(factions[factionId], updatedBots);
  }

  return { factions, updatedBots };
}

/**
 * Procesamiento de tick de facciones (estabilidad, guerras, etc.)
 */
export function processFactionTick(
  factions: Record<string, Faction>,
  botStates: Record<string, BotState>,
  currentTime: number
): { factions: Record<string, Faction>; events: WorldEvent[] } {
  const updatedFactions: Record<string, Faction> = {};
  const events: WorldEvent[] = [];

  for (const [id, faction] of Object.entries(factions)) {
    let updated = updateFactionStability(faction);
    updated.power = recalculateFactionPower(updated, botStates);

    // Check for dissolution
    if (shouldFactionDissolve(updated)) {
      events.push({
        id: `event-dissolve-${Date.now()}`,
        type: WorldEventType.FACTION_DISSOLVED,
        timestamp: currentTime,
        actors: [id],
        description: `${updated.name} has dissolved!`,
        impact: 'major'
      });
      // Don't add to updated factions (effectively removing it)
      continue;
    }

    // Process active wars - check for war end conditions
    updated = {
      ...updated,
      activeWars: updated.activeWars.map(war => {
        if (war.status !== 'active') return war;

        const warDuration = currentTime - war.startTime;
        if (warDuration >= FACTION_LIMITS.WAR_DURATION_MAX) {
          // War expired
          const won = war.currentScore.us > war.currentScore.them;
          const lost = war.currentScore.them > war.currentScore.us;
          return {
            ...war,
            status: won ? 'won' as const : lost ? 'lost' as const : 'draw' as const
          };
        }
        return war;
      })
    };

    updatedFactions[id] = updated;
  }

  return { factions: updatedFactions, events };
}
