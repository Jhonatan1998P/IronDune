
import { GameState, ResourceType, BuildingType } from '../types';
import { SAVE_VERSION } from '../constants';
import { INITIAL_BUILDINGS } from './buildings';
import { INITIAL_UNITS } from './units';
import { TUTORIAL_STEPS } from './tutorial';
import { initializeRankingState } from '../utils/engine/rankings';

export const INITIAL_RESOURCES: Record<ResourceType, number> = {
  [ResourceType.MONEY]: 5000, 
  [ResourceType.OIL]: 200,
  [ResourceType.AMMO]: 100,
  [ResourceType.GOLD]: 0,
  [ResourceType.DIAMOND]: 0,
};

export const INITIAL_MAX_RESOURCES: Record<ResourceType, number> = {
  [ResourceType.MONEY]: 1000000,
  [ResourceType.AMMO]: 50000,
  [ResourceType.OIL]: 10000,
  [ResourceType.GOLD]: 1000,
  [ResourceType.DIAMOND]: 10,
};

const initBuildings = { ...INITIAL_BUILDINGS };
initBuildings[BuildingType.DIAMOND_MINE] = { level: 1 };
initBuildings[BuildingType.BANK] = { level: 1 };

export const INITIAL_GAME_STATE: GameState = {
  saveVersion: SAVE_VERSION,
  playerName: 'Commander',
  hasChangedName: false,
  resources: INITIAL_RESOURCES,
  maxResources: INITIAL_MAX_RESOURCES,
  buildings: initBuildings,
  units: INITIAL_UNITS,
  researchedTechs: [],
  techLevels: {},
  activeResearch: null,
  activeMissions: [],
  activeRecruitments: [],
  activeConstructions: [],
  bankBalance: 0,
  currentInterestRate: 0.05,
  nextRateChangeTime: Date.now() + (24 * 60 * 60 * 1000),
  lastInterestPayoutTime: Date.now(),
  empirePoints: 0,
  lastSaveTime: Date.now(),
  campaignProgress: 1,
  lastCampaignMissionFinishedTime: 0,
  marketOffers: [],
  activeMarketEvent: null,
  marketNextRefreshTime: 0,
  completedTutorials: [],
  currentTutorialId: TUTORIAL_STEPS[0].id,
  tutorialClaimable: false,
  tutorialAccepted: false,
  isTutorialMinimized: false,
  nextAttackTime: Date.now() + (3 * 60 * 60 * 1000),
  incomingAttacks: [],
  activeWar: null,
  grudges: [],
  targetAttackCounts: {},
  lastAttackResetTime: Date.now(),
  rankingData: initializeRankingState(),
  lifetimeStats: {
    enemiesKilled: 0,
    unitsLost: 0,
    resourcesMined: 0,
    missionsCompleted: 0,
    highestRankAchieved: 9999
  },
  logs: []
};
