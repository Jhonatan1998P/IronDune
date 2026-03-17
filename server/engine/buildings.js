import { BuildingType, ResourceType } from './enums.js';

const PER_10_MINUTES = 600;
const rate = (amount) => amount / PER_10_MINUTES;

export const BUILDING_DEFS = {
  [BuildingType.HOUSE]: {
    productionRate: { [ResourceType.MONEY]: rate(500) },
  },
  [BuildingType.FACTORY]: {
    productionRate: { [ResourceType.MONEY]: rate(2500) },
  },
  [BuildingType.SKYSCRAPER]: {
    productionRate: { [ResourceType.MONEY]: rate(12500) },
  },
  [BuildingType.BANK]: {
    productionRate: {},
  },
  [BuildingType.MARKET]: {
    productionRate: {},
  },
  [BuildingType.DIAMOND_MINE]: {
    productionRate: { [ResourceType.DIAMOND]: rate(1 / 6) },
  },
  [BuildingType.OIL_RIG]: {
    productionRate: { [ResourceType.OIL]: rate(200) },
  },
  [BuildingType.GOLD_MINE]: {
    productionRate: { [ResourceType.GOLD]: rate(64) },
  },
  [BuildingType.MUNITIONS_FACTORY]: {
    productionRate: { [ResourceType.AMMO]: rate(700) },
  },
  [BuildingType.UNIVERSITY]: {
    productionRate: {},
  },
  [BuildingType.BARRACKS]: {
    productionRate: {},
  },
  [BuildingType.TANK_FACTORY]: {
    productionRate: {},
  },
  [BuildingType.SHIPYARD]: {
    productionRate: {},
  },
  [BuildingType.AIRFIELD]: {
    productionRate: {},
  },
};
