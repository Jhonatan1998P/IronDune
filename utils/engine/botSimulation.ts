
import { BotState } from '../../types/bot';
import { ResourceType, BuildingType, UnitType } from '../../types/enums';

/**
 * Sistema de Simulación Económica para Bots
 * 
 * Usa cálculo diferido: en lugar de actualizar cada tick,
 * calculamos el progreso acumulado cuando es necesario.
 */

// Constantes de simulación
export const BOT_UPDATE_INTERVAL = 10 * 60 * 1000;  // 10 minutos
export const BOT_DECISION_INTERVAL = 5 * 60 * 1000; // 5 minutos

// Producción base por edificio (unidades por minuto)
const BUILDING_PRODUCTION: Partial<Record<BuildingType, Partial<Record<ResourceType, number>>>> = {
  [BuildingType.FACTORY]: { [ResourceType.MONEY]: 10 },
  [BuildingType.HOUSE]: { [ResourceType.MONEY]: 5 },
  [BuildingType.SKYSCRAPER]: { [ResourceType.MONEY]: 25 },
  [BuildingType.OIL_RIG]: { [ResourceType.OIL]: 5 },
  [BuildingType.MUNITIONS_FACTORY]: { [ResourceType.AMMO]: 5 },
  [BuildingType.GOLD_MINE]: { [ResourceType.GOLD]: 1 },
  [BuildingType.DIAMOND_MINE]: { [ResourceType.DIAMOND]: 0.1 },
};

// Costo de mantenimiento por unidad (por minuto)
const UNIT_UPKEEP: Partial<Record<UnitType, Partial<Record<ResourceType, number>>>> = {
  [UnitType.CYBER_MARINE]: { [ResourceType.MONEY]: 0.5, [ResourceType.AMMO]: 0.1 },
  [UnitType.HEAVY_COMMANDO]: { [ResourceType.MONEY]: 1, [ResourceType.AMMO]: 0.3 },
  [UnitType.SCOUT_TANK]: { [ResourceType.MONEY]: 2, [ResourceType.OIL]: 0.5 },
  [UnitType.TITAN_MBT]: { [ResourceType.MONEY]: 5, [ResourceType.OIL]: 1.5 },
  [UnitType.WRAITH_GUNSHIP]: { [ResourceType.MONEY]: 4, [ResourceType.OIL]: 1 },
  [UnitType.ACE_FIGHTER]: { [ResourceType.MONEY]: 6, [ResourceType.OIL]: 2 },
  [UnitType.AEGIS_DESTROYER]: { [ResourceType.MONEY]: 8, [ResourceType.OIL]: 3 },
  [UnitType.PHANTOM_SUB]: { [ResourceType.MONEY]: 10, [ResourceType.OIL]: 4 },
};

/**
 * Actualiza la economía de un bot basado en el tiempo transcurrido
 */
export function updateBotEconomy(bot: BotState, currentTime: number): BotState {
  const elapsedTime = currentTime - bot.lastUpdateTime;
  if (elapsedTime < BOT_UPDATE_INTERVAL) return bot;

  const elapsedMinutes = elapsedTime / 60000;

  // 1. Generar recursos basado en edificios
  const newResources = calculateResourceGeneration(bot, elapsedMinutes);

  // 2. Consumir recursos por mantenimiento de ejército
  const afterUpkeep = applyArmyUpkeep(newResources, bot.army, elapsedMinutes);

  // 3. Procesar cola de reclutamiento
  const { army, resources, remainingQueue } = processRecruitmentQueue(
    bot.recruitmentQueue,
    bot.army,
    afterUpkeep,
    currentTime
  );

  // 4. Recalcular army score
  const armyScore = calculateArmyScore(army);

  // 5. Recalcular production rate
  const productionRate = calculateProductionRates(bot);

  return {
    ...bot,
    resources,
    army,
    armyScore,
    productionRate,
    recruitmentQueue: remainingQueue,
    lastUpdateTime: currentTime,
  };
}

/**
 * Calcula producción de recursos basado en edificios del bot
 */
function calculateResourceGeneration(
  bot: BotState,
  minutes: number
): Record<ResourceType, number> {
  const production = { ...bot.resources };

  for (const [building, count] of Object.entries(bot.buildings)) {
    const rates = BUILDING_PRODUCTION[building as BuildingType];
    if (rates && count) {
      for (const [resource, rate] of Object.entries(rates)) {
        if (rate) {
          production[resource as ResourceType] = 
            (production[resource as ResourceType] || 0) + rate * count * minutes;
        }
      }
    }
  }

  return production;
}

/**
 * Aplica costo de mantenimiento del ejército
 */
function applyArmyUpkeep(
  resources: Record<ResourceType, number>,
  army: Partial<Record<UnitType, number>>,
  minutes: number
): Record<ResourceType, number> {
  const result = { ...resources };

  for (const [unitType, count] of Object.entries(army)) {
    const upkeep = UNIT_UPKEEP[unitType as UnitType];
    if (upkeep && count) {
      for (const [resource, cost] of Object.entries(upkeep)) {
        if (cost) {
          result[resource as ResourceType] = Math.max(
            0,
            (result[resource as ResourceType] || 0) - cost * count * minutes
          );
        }
      }
    }
  }

  return result;
}

/**
 * Procesa cola de reclutamiento pendiente
 */
function processRecruitmentQueue(
  queue: BotState['recruitmentQueue'],
  currentArmy: Partial<Record<UnitType, number>>,
  resources: Record<ResourceType, number>,
  currentTime: number
): { army: Partial<Record<UnitType, number>>; resources: Record<ResourceType, number>; remainingQueue: BotState['recruitmentQueue'] } {
  const army = { ...currentArmy };
  const remaining = [...queue];
  const completed: number[] = [];

  for (let i = 0; i < remaining.length; i++) {
    const order = remaining[i];
    if (currentTime >= order.endTime) {
      army[order.unitType] = (army[order.unitType] || 0) + order.count;
      completed.push(i);
    }
  }

  // Remove completed orders (reverse to maintain indices)
  for (let i = completed.length - 1; i >= 0; i--) {
    remaining.splice(completed[i], 1);
  }

  return { army, resources, remainingQueue: remaining };
}

/**
 * Calcula el score militar del ejército de un bot
 */
export function calculateArmyScore(army: Partial<Record<UnitType, number>>): number {
  const UNIT_VALUES: Record<UnitType, number> = {
    [UnitType.CYBER_MARINE]: 10,
    [UnitType.HEAVY_COMMANDO]: 25,
    [UnitType.SCOUT_TANK]: 50,
    [UnitType.TITAN_MBT]: 150,
    [UnitType.WRAITH_GUNSHIP]: 120,
    [UnitType.ACE_FIGHTER]: 200,
    [UnitType.AEGIS_DESTROYER]: 300,
    [UnitType.PHANTOM_SUB]: 400,
  };

  let score = 0;
  for (const [unitType, count] of Object.entries(army)) {
    if (count) {
      score += (UNIT_VALUES[unitType as UnitType] || 0) * count;
    }
  }

  return score;
}

/**
 * Calcula las tasas de producción actuales del bot
 */
function calculateProductionRates(bot: BotState): Partial<Record<ResourceType, number>> {
  const rates: Partial<Record<ResourceType, number>> = {};

  for (const [building, count] of Object.entries(bot.buildings)) {
    const buildingRates = BUILDING_PRODUCTION[building as BuildingType];
    if (buildingRates && count) {
      for (const [resource, rate] of Object.entries(buildingRates)) {
        if (rate) {
          rates[resource as ResourceType] = (rates[resource as ResourceType] || 0) + rate * count;
        }
      }
    }
  }

  return rates;
}

/**
 * Obtiene el total de recursos de un bot (valor agregado)
 */
export function getTotalResources(bot: BotState): number {
  const RESOURCE_VALUES: Record<ResourceType, number> = {
    [ResourceType.MONEY]: 1,
    [ResourceType.OIL]: 3,
    [ResourceType.AMMO]: 2,
    [ResourceType.GOLD]: 10,
    [ResourceType.DIAMOND]: 100,
  };

  let total = 0;
  for (const [resource, amount] of Object.entries(bot.resources)) {
    total += (RESOURCE_VALUES[resource as ResourceType] || 1) * amount;
  }

  return total;
}

/**
 * Procesamiento batch de todos los bots (llamado desde el game loop)
 */
export function processBotSimulationTick(
  botStates: Record<string, BotState>,
  currentTime: number
): Record<string, BotState> {
  const updated: Record<string, BotState> = {};
  let hasChanges = false;

  for (const [id, bot] of Object.entries(botStates)) {
    const updatedBot = updateBotEconomy(bot, currentTime);
    if (updatedBot !== bot) {
      hasChanges = true;
    }
    updated[id] = updatedBot;
  }

  return hasChanges ? updated : botStates;
}
