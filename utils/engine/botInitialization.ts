
import { BotState, BotGoal, FactionRole } from '../../types/bot';
import { BotPersonality, ResourceType, BuildingType, UnitType, TechType } from '../../types/enums';
import { StaticBot, RankingCategory } from './rankings';
import { calculateArmyScore } from './botSimulation';

/**
 * Sistema de Inicialización de Bots
 * 
 * Convierte los StaticBots existentes en BotStates completos
 * con economía, ejército y memoria.
 */

/**
 * Genera el estado inicial de un bot basado en su posición en el ranking
 */
export function initializeBotState(
  staticBot: StaticBot,
  rankPosition: number
): BotState {
  const powerLevel = calculatePowerLevel(rankPosition);

  const army = generateInitialArmy(powerLevel, staticBot.personality);
  const buildings = generateInitialBuildings(powerLevel);

  return {
    // Migrar datos existentes
    id: staticBot.id,
    name: staticBot.name,
    avatarId: staticBot.avatarId,
    country: staticBot.country,
    personality: staticBot.personality,
    stats: staticBot.stats,
    ambition: staticBot.ambition,
    lastRank: staticBot.lastRank,

    // Generar economía inicial
    resources: generateInitialResources(powerLevel),
    buildings,
    techs: generateInitialTechs(powerLevel),
    productionRate: {},

    // Generar ejército inicial
    army,
    armyScore: calculateArmyScore(army),
    militaryCapacity: calculateMilitaryCapacity(powerLevel),
    recruitmentQueue: [],

    // Estado político inicial
    factionId: null,
    factionRole: FactionRole.NONE,
    reputation: {},
    playerReputation: 0,

    // Memoria vacía
    memory: {
      recentAttackers: [],
      recentAllies: [],
      betrayals: [],
      playerActions: [],
      playerThreatLevel: 0,
      warsParticipated: [],
      pendingProposals: []
    },

    // Objetivo inicial basado en personalidad
    currentGoal: getInitialGoal(staticBot.personality),
    goalProgress: 0,
    lastDecisionTime: Date.now(),
    lastUpdateTime: Date.now()
  };
}

function calculatePowerLevel(rankPosition: number): number {
  // Rank 1 = power 100, Rank 200 = power 1
  return Math.max(1, 100 - (rankPosition * 0.5));
}

function getInitialGoal(personality: BotPersonality): BotGoal {
  switch (personality) {
    case BotPersonality.WARLORD:
      return BotGoal.BUILD_ARMY;
    case BotPersonality.TURTLE:
      return BotGoal.EXPAND_ECONOMY;
    case BotPersonality.TYCOON:
      return BotGoal.EXPAND_ECONOMY;
    case BotPersonality.ROGUE:
      return BotGoal.SEEK_ALLIANCE;
    default:
      return BotGoal.EXPAND_ECONOMY;
  }
}

function generateInitialResources(powerLevel: number): Record<ResourceType, number> {
  const multiplier = powerLevel / 10;
  return {
    [ResourceType.MONEY]: Math.floor(5000 * multiplier + Math.random() * 2000 * multiplier),
    [ResourceType.OIL]: Math.floor(1000 * multiplier + Math.random() * 500 * multiplier),
    [ResourceType.AMMO]: Math.floor(800 * multiplier + Math.random() * 400 * multiplier),
    [ResourceType.GOLD]: Math.floor(100 * multiplier + Math.random() * 50 * multiplier),
    [ResourceType.DIAMOND]: Math.floor(5 * multiplier + Math.random() * 3 * multiplier),
  };
}

function generateInitialBuildings(powerLevel: number): Partial<Record<BuildingType, number>> {
  const tier = Math.ceil(powerLevel / 25); // 1-4
  const buildings: Partial<Record<BuildingType, number>> = {};

  // Economic buildings scale with power
  buildings[BuildingType.HOUSE] = Math.floor(3 + powerLevel * 0.2);
  buildings[BuildingType.FACTORY] = Math.floor(2 + powerLevel * 0.15);
  buildings[BuildingType.OIL_RIG] = Math.floor(1 + powerLevel * 0.1);
  buildings[BuildingType.GOLD_MINE] = Math.floor(1 + powerLevel * 0.08);
  buildings[BuildingType.MUNITIONS_FACTORY] = Math.floor(1 + powerLevel * 0.1);

  if (tier >= 2) {
    buildings[BuildingType.SKYSCRAPER] = Math.floor(powerLevel * 0.05);
    buildings[BuildingType.BARRACKS] = Math.floor(1 + powerLevel * 0.05);
  }

  if (tier >= 3) {
    buildings[BuildingType.TANK_FACTORY] = Math.floor(powerLevel * 0.03);
    buildings[BuildingType.UNIVERSITY] = Math.floor(1 + powerLevel * 0.02);
  }

  if (tier >= 4) {
    buildings[BuildingType.SHIPYARD] = Math.floor(powerLevel * 0.02);
    buildings[BuildingType.AIRFIELD] = Math.floor(powerLevel * 0.02);
  }

  return buildings;
}

function generateInitialArmy(powerLevel: number, personality: BotPersonality): Partial<Record<UnitType, number>> {
  const army: Partial<Record<UnitType, number>> = {};
  const tier = Math.ceil(powerLevel / 25);

  // Personality multipliers for army size
  const armyMultiplier = personality === BotPersonality.WARLORD ? 1.5
    : personality === BotPersonality.TURTLE ? 0.8
    : personality === BotPersonality.TYCOON ? 0.6
    : 1.0; // ROGUE

  // Base army - everyone gets marines
  army[UnitType.CYBER_MARINE] = Math.floor((20 + powerLevel * 2) * armyMultiplier);

  if (powerLevel > 15) {
    army[UnitType.HEAVY_COMMANDO] = Math.floor((5 + powerLevel * 0.8) * armyMultiplier);
  }

  if (tier >= 2) {
    army[UnitType.SCOUT_TANK] = Math.floor((3 + powerLevel * 0.4) * armyMultiplier);
  }

  if (tier >= 3) {
    army[UnitType.TITAN_MBT] = Math.floor((1 + powerLevel * 0.2) * armyMultiplier);
    army[UnitType.WRAITH_GUNSHIP] = Math.floor((1 + powerLevel * 0.15) * armyMultiplier);
  }

  if (tier >= 4) {
    army[UnitType.ACE_FIGHTER] = Math.floor((powerLevel * 0.1) * armyMultiplier);
    army[UnitType.AEGIS_DESTROYER] = Math.floor((powerLevel * 0.05) * armyMultiplier);
    if (powerLevel > 85) {
      army[UnitType.PHANTOM_SUB] = Math.floor((powerLevel * 0.03) * armyMultiplier);
    }
  }

  return army;
}

function generateInitialTechs(powerLevel: number): TechType[] {
  const techs: TechType[] = [];
  const tier = Math.ceil(powerLevel / 25);

  // Everyone gets basic techs
  techs.push(TechType.UNLOCK_CYBER_MARINE);
  techs.push(TechType.BASIC_TRAINING);

  if (powerLevel > 15) {
    techs.push(TechType.UNLOCK_HEAVY_COMMANDO);
    techs.push(TechType.PATROL_TRAINING);
    techs.push(TechType.EFFICIENT_WORKFLOWS);
  }

  if (tier >= 2) {
    techs.push(TechType.UNLOCK_SCOUT_TANK);
    techs.push(TechType.COMBUSTION_ENGINE);
    techs.push(TechType.DEEP_DRILLING);
    techs.push(TechType.BALLISTICS);
  }

  if (tier >= 3) {
    techs.push(TechType.UNLOCK_TITAN_MBT);
    techs.push(TechType.UNLOCK_WRAITH_GUNSHIP);
    techs.push(TechType.HEAVY_PLATING);
    techs.push(TechType.RESOURCE_MANAGEMENT);
    techs.push(TechType.GOLD_REFINING);
    techs.push(TechType.EXPLOSIVE_CHEMISTRY);
    techs.push(TechType.AERODYNAMICS);
  }

  if (tier >= 4) {
    techs.push(TechType.UNLOCK_ACE_FIGHTER);
    techs.push(TechType.UNLOCK_AEGIS_DESTROYER);
    techs.push(TechType.JET_ENGINES);
    techs.push(TechType.NAVAL_ENGINEERING);
    techs.push(TechType.MASS_PRODUCTION);
    techs.push(TechType.STRATEGIC_COMMAND);
    if (powerLevel > 85) {
      techs.push(TechType.UNLOCK_PHANTOM_SUB);
      techs.push(TechType.STEALTH_HULL);
      techs.push(TechType.SONAR_TECH);
      techs.push(TechType.PRECISION_BOMBING);
    }
  }

  return techs;
}

function calculateMilitaryCapacity(powerLevel: number): number {
  return Math.floor(100 + powerLevel * 5);
}

/**
 * Asigna personalidades diversas a los bots (reemplaza el WARLORD para todos)
 */
export function assignBotPersonality(index: number): BotPersonality {
  // Distribución: 30% WARLORD, 25% TURTLE, 25% TYCOON, 20% ROGUE
  const roll = ((index * 7 + 13) % 100); // Pseudo-deterministic based on index
  if (roll < 30) return BotPersonality.WARLORD;
  if (roll < 55) return BotPersonality.TURTLE;
  if (roll < 80) return BotPersonality.TYCOON;
  return BotPersonality.ROGUE;
}

/**
 * Inicializa todos los bot states a partir de los StaticBots existentes
 */
export function initializeAllBotStates(
  staticBots: StaticBot[]
): Record<string, BotState> {
  const botStates: Record<string, BotState> = {};

  // Sort by dominion score to determine rank position
  const sortedBots = [...staticBots].sort(
    (a, b) => b.stats[RankingCategory.DOMINION] - a.stats[RankingCategory.DOMINION]
  );

  for (let i = 0; i < sortedBots.length; i++) {
    const bot = sortedBots[i];
    // Assign diverse personality if still default WARLORD
    const enrichedBot = {
      ...bot,
      personality: assignBotPersonality(i)
    };
    botStates[bot.id] = initializeBotState(enrichedBot, i + 1);
  }

  return botStates;
}
