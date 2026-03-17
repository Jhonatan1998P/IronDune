import { BANK_INTEREST_RATE_MAX, BANK_INTEREST_RATE_MIN, BANK_RATE_CHANGE_INTERVAL_MS, OFFLINE_PRODUCTION_LIMIT_MS, UNLIMITED_CAPACITY, calculateInterestEarned, calculateMaxBankCapacity } from './constants.js';
import { BuildingType, ResourceType, TechType } from './enums.js';
import { BUILDING_DEFS } from './buildings.js';
import { UNIT_DEFS } from './units.js';

const BASE_OFFER_AMOUNTS = {
  [ResourceType.OIL]: 3750,
  [ResourceType.AMMO]: 7500,
  [ResourceType.GOLD]: 1500,
};
const DEFAULT_OFFER_AMOUNT = 1000;

const BASE_PRICES = {
  [ResourceType.MONEY]: 1,
  [ResourceType.GOLD]: 40,
  [ResourceType.OIL]: 10,
  [ResourceType.AMMO]: 5,
  [ResourceType.DIAMOND]: 10000,
};

const MARKET_EVENTS = [
  { id: 'evt_stable', nameKey: 'evt_stable', descriptionKey: 'evt_stable_desc', priceModifiers: {} },
  { id: 'evt_war', nameKey: 'evt_war', descriptionKey: 'evt_war_desc', priceModifiers: { [ResourceType.OIL]: 1.5, [ResourceType.AMMO]: 1.8, [ResourceType.GOLD]: 1.2 } },
  { id: 'evt_peace', nameKey: 'evt_peace', descriptionKey: 'evt_peace_desc', priceModifiers: { [ResourceType.AMMO]: 0.5, [ResourceType.OIL]: 0.8 } },
  { id: 'evt_crash', nameKey: 'evt_crash', descriptionKey: 'evt_crash_desc', priceModifiers: { [ResourceType.GOLD]: 0.6, [ResourceType.OIL]: 0.5, [ResourceType.AMMO]: 0.6 } },
  { id: 'evt_boom', nameKey: 'evt_boom', descriptionKey: 'evt_boom_desc', priceModifiers: { [ResourceType.GOLD]: 1.5, [ResourceType.OIL]: 1.3, [ResourceType.AMMO]: 1.3 } },
  { id: 'evt_drought', nameKey: 'evt_drought', descriptionKey: 'evt_drought_desc', priceModifiers: { [ResourceType.OIL]: 1.8 } },
  { id: 'evt_embargo', nameKey: 'evt_embargo', descriptionKey: 'evt_embargo_desc', priceModifiers: { [ResourceType.OIL]: 2.0, [ResourceType.AMMO]: 1.4 } },
  { id: 'evt_surplus', nameKey: 'evt_surplus', descriptionKey: 'evt_surplus_desc', priceModifiers: { [ResourceType.OIL]: 0.6, [ResourceType.AMMO]: 0.7, [ResourceType.GOLD]: 0.8 } },
  { id: 'evt_gold_rush', nameKey: 'evt_gold_rush', descriptionKey: 'evt_gold_rush_desc', priceModifiers: { [ResourceType.GOLD]: 2.2, [ResourceType.OIL]: 1.1 } },
  { id: 'evt_tech_boom', nameKey: 'evt_tech_boom', descriptionKey: 'evt_tech_boom_desc', priceModifiers: { [ResourceType.AMMO]: 1.6, [ResourceType.OIL]: 1.2 } },
  { id: 'evt_diamond_fever', nameKey: 'evt_diamond_fever', descriptionKey: 'evt_diamond_fever_desc', priceModifiers: { [ResourceType.GOLD]: 1.8, [ResourceType.OIL]: 1.4, [ResourceType.AMMO]: 1.3 } },
  { id: 'evt_recession', nameKey: 'evt_recession', descriptionKey: 'evt_recession_desc', priceModifiers: { [ResourceType.GOLD]: 0.5, [ResourceType.OIL]: 0.4, [ResourceType.AMMO]: 0.5 } },
];

const toNumber = (value, fallback = 0) => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const calculateTechMultipliers = (researchedTechs = [], techLevels = {}) => {
  const researched = new Set(Array.isArray(researchedTechs) ? researchedTechs : []);
  let moneyProdMult = 1.0;
  let oilProdMult = 1.0;
  let ammoProdMult = 1.0;
  let goldProdMult = 1.0;

  if (researched.has(TechType.DEEP_DRILLING)) {
    oilProdMult += (toNumber(techLevels[TechType.DEEP_DRILLING], 1) * 0.05);
  }
  if (researched.has(TechType.MASS_PRODUCTION)) {
    ammoProdMult += (toNumber(techLevels[TechType.MASS_PRODUCTION], 1) * 0.05);
  }
  if (researched.has(TechType.GOLD_REFINING)) {
    goldProdMult += (toNumber(techLevels[TechType.GOLD_REFINING], 1) * 0.05);
  }

  return { moneyProdMult, oilProdMult, ammoProdMult, goldProdMult };
};

export const calculateProductionRates = (buildings = {}, multipliers = {}) => {
  const production = {
    [ResourceType.MONEY]: 0,
    [ResourceType.OIL]: 0,
    [ResourceType.AMMO]: 0,
    [ResourceType.GOLD]: 0,
    [ResourceType.DIAMOND]: 0,
  };

  Object.keys(buildings).forEach((buildingType) => {
    const level = toNumber(buildings[buildingType]?.level, 0);
    if (level <= 0) return;
    const def = BUILDING_DEFS[buildingType];
    if (!def?.productionRate) return;
    Object.entries(def.productionRate).forEach(([resource, rate]) => {
      let finalRate = toNumber(rate, 0) * level;
      if (resource === ResourceType.MONEY) finalRate *= multipliers.moneyProdMult || 1;
      if (resource === ResourceType.OIL) finalRate *= multipliers.oilProdMult || 1;
      if (resource === ResourceType.AMMO) finalRate *= multipliers.ammoProdMult || 1;
      if (resource === ResourceType.GOLD) finalRate *= multipliers.goldProdMult || 1;
      production[resource] += finalRate;
    });
  });

  return production;
};

export const calculateUpkeepCosts = (units = {}) => {
  const upkeep = {
    [ResourceType.MONEY]: 0,
    [ResourceType.OIL]: 0,
    [ResourceType.AMMO]: 0,
    [ResourceType.GOLD]: 0,
    [ResourceType.DIAMOND]: 0,
  };

  Object.keys(units).forEach((unitType) => {
    const qty = toNumber(units[unitType], 0);
    if (qty <= 0) return;
    const def = UNIT_DEFS[unitType];
    if (!def?.upkeep) return;
    Object.entries(def.upkeep).forEach(([resource, rate]) => {
      upkeep[resource] += toNumber(rate, 0) * qty;
    });
  });

  return upkeep;
};

export const calculateMaxStorage = (buildings = {}) => {
  const diamondMineLevel = toNumber(buildings[BuildingType.DIAMOND_MINE]?.level, 0);
  return {
    [ResourceType.MONEY]: UNLIMITED_CAPACITY,
    [ResourceType.OIL]: UNLIMITED_CAPACITY,
    [ResourceType.AMMO]: UNLIMITED_CAPACITY,
    [ResourceType.GOLD]: UNLIMITED_CAPACITY,
    [ResourceType.DIAMOND]: Math.max(10, diamondMineLevel * 10),
  };
};

const generateMarketState = (empirePoints, marketLevel, now) => {
  const eventPool = [MARKET_EVENTS[0], ...MARKET_EVENTS.slice(1), ...MARKET_EVENTS.slice(1)];
  const template = eventPool[Math.floor(Math.random() * eventPool.length)] || MARKET_EVENTS[0];
  const durationMinutes = 30 + Math.floor(Math.random() * 91);
  const event = { ...template, duration: durationMinutes * 60 * 1000 };

  const offers = [];
  const resources = [ResourceType.OIL, ResourceType.AMMO, ResourceType.GOLD];
  const scalingFactor = 1 + (toNumber(empirePoints, 0) / 50);
  const numOffers = 3 + Math.max(1, toNumber(marketLevel, 0));

  let countPlayerSell = Math.round(numOffers * 0.7);
  let countPlayerBuy = numOffers - countPlayerSell;
  if (countPlayerBuy < 1) {
    countPlayerBuy = 1;
    countPlayerSell = numOffers - 1;
  }
  if (countPlayerSell < 1) {
    countPlayerSell = 1;
    countPlayerBuy = numOffers - 1;
  }

  const types = [];
  for (let i = 0; i < countPlayerBuy; i += 1) types.push('BUY');
  for (let i = 0; i < countPlayerSell; i += 1) types.push('SELL');

  for (let i = types.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }

  types.forEach((type, index) => {
    const resource = resources[Math.floor(Math.random() * resources.length)];
    const basePrice = BASE_PRICES[resource];
    const eventMod = event.priceModifiers[resource] || 1;
    const randomFluctuation = 0.9 + (Math.random() * 0.2);
    const spread = type === 'BUY' ? 1.25 : 0.75;
    const finalPrice = Math.max(1, Math.floor(basePrice * eventMod * randomFluctuation * spread));
    const baseAmount = BASE_OFFER_AMOUNTS[resource] || DEFAULT_OFFER_AMOUNT;
    const amount = Math.floor(baseAmount * scalingFactor * (0.8 + Math.random() * 0.4));
    offers.push({
      id: `mkt-${now}-${index}`,
      type,
      resource,
      pricePerUnit: finalPrice,
      totalAmount: amount,
      amountSold: 0,
    });
  });

  return { offers, event, nextRefresh: now + event.duration };
};

export const processServerEconomyTick = (gameState, resourceRow, deltaTimeMs, now, options = {}) => {
  const cappedDelta = options.capOffline ? Math.min(deltaTimeMs, OFFLINE_PRODUCTION_LIMIT_MS) : deltaTimeMs;
  const deltaSeconds = Math.max(0, cappedDelta) / 1000;
  const multipliers = calculateTechMultipliers(gameState?.researchedTechs, gameState?.techLevels);
  const production = calculateProductionRates(gameState?.buildings, multipliers);
  const upkeep = calculateUpkeepCosts(gameState?.units);
  const maxStorage = calculateMaxStorage(gameState?.buildings);

  const currentResources = {
    [ResourceType.MONEY]: toNumber(resourceRow?.money, 0),
    [ResourceType.OIL]: toNumber(resourceRow?.oil, 0),
    [ResourceType.AMMO]: toNumber(resourceRow?.ammo, 0),
    [ResourceType.GOLD]: toNumber(resourceRow?.gold, 0),
    [ResourceType.DIAMOND]: toNumber(resourceRow?.diamond, 0),
  };

  const rates = {
    money_rate: (production[ResourceType.MONEY] || 0) - (upkeep[ResourceType.MONEY] || 0),
    oil_rate: (production[ResourceType.OIL] || 0) - (upkeep[ResourceType.OIL] || 0),
    ammo_rate: (production[ResourceType.AMMO] || 0) - (upkeep[ResourceType.AMMO] || 0),
    gold_rate: (production[ResourceType.GOLD] || 0) - (upkeep[ResourceType.GOLD] || 0),
    diamond_rate: (production[ResourceType.DIAMOND] || 0) - (upkeep[ResourceType.DIAMOND] || 0),
  };

  const nextResources = { ...currentResources };
  let minedIncrement = 0;
  Object.values(ResourceType).forEach((resource) => {
    const prod = (production[resource] || 0) * deltaSeconds;
    const cost = (upkeep[resource] || 0) * deltaSeconds;
    const net = prod - cost;

    if (resource === ResourceType.DIAMOND) {
      const mine = gameState?.buildings?.[BuildingType.DIAMOND_MINE];
      if (mine?.level > 0 && mine?.isDamaged) {
        nextResources[resource] = Math.max(0, nextResources[resource] - cost);
        return;
      }
    }

    if (prod > 0 && resource !== ResourceType.DIAMOND) {
      minedIncrement += prod;
    }

    if (net > 0) {
      const maxAmount = maxStorage[resource];
      const freeSpace = Math.max(0, maxAmount - nextResources[resource]);
      nextResources[resource] += Math.min(net, freeSpace);
      return;
    }
    nextResources[resource] = Math.max(0, nextResources[resource] + net);
  });

  const bankLevel = toNumber(gameState?.buildings?.[BuildingType.BANK]?.level, 0);
  let interestRate = toNumber(resourceRow?.interest_rate, BANK_INTEREST_RATE_MIN);
  let nextRateChange = Math.floor(toNumber(resourceRow?.next_rate_change, 0));
  let bankBalance = toNumber(resourceRow?.bank_balance, 0);

  if (now >= nextRateChange) {
    interestRate = Math.random() * (BANK_INTEREST_RATE_MAX - BANK_INTEREST_RATE_MIN) + BANK_INTEREST_RATE_MIN;
    nextRateChange = now + BANK_RATE_CHANGE_INTERVAL_MS;
  }

  if (bankBalance > 0 && bankLevel > 0) {
    const maxBankCapacity = calculateMaxBankCapacity(toNumber(gameState?.empirePoints, 0), bankLevel);
    if (bankBalance < maxBankCapacity) {
      const earned = calculateInterestEarned(bankBalance, interestRate, cappedDelta);
      bankBalance = Math.min(maxBankCapacity, bankBalance + earned);
    }
  }

  let marketOffers = Array.isArray(gameState?.marketOffers) ? gameState.marketOffers : [];
  let activeMarketEvent = gameState?.activeMarketEvent || null;
  let marketNextRefreshTime = toNumber(gameState?.marketNextRefreshTime, 0);
  if (now >= marketNextRefreshTime) {
    const marketLevel = toNumber(gameState?.buildings?.[BuildingType.MARKET]?.level, 0);
    const marketState = generateMarketState(toNumber(gameState?.empirePoints, 0), marketLevel, now);
    marketOffers = marketState.offers;
    activeMarketEvent = marketState.event;
    marketNextRefreshTime = marketState.nextRefresh;
  }

  return {
    resources: nextResources,
    rates,
    maxStorage: {
      money_max: maxStorage[ResourceType.MONEY],
      oil_max: maxStorage[ResourceType.OIL],
      ammo_max: maxStorage[ResourceType.AMMO],
      gold_max: maxStorage[ResourceType.GOLD],
      diamond_max: maxStorage[ResourceType.DIAMOND],
    },
    bankBalance,
    interestRate,
    nextRateChange,
    marketOffers,
    activeMarketEvent,
    marketNextRefreshTime,
    lifetimeResourcesMined: toNumber(gameState?.lifetimeStats?.resourcesMined, 0) + minedIncrement,
  };
};
