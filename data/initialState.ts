
import { GameState, ResourceType, BuildingType } from '../types';
import { SAVE_VERSION, UNLIMITED_CAPACITY, BANK_INTEREST_RATE_MIN, BANK_RATE_CHANGE_INTERVAL_MS } from '../constants';
import { INITIAL_BUILDINGS } from './buildings';
import { INITIAL_UNITS } from './units';
import { TUTORIAL_STEPS } from './tutorial';
import { initializeRankingState } from '../utils/engine/rankings';

export const INITIAL_RESOURCES: Record<ResourceType, number> = {
  [ResourceType.MONEY]: 5000, 
  [ResourceType.OIL]: 2500,
  [ResourceType.AMMO]: 1500,
  [ResourceType.GOLD]: 500,
  [ResourceType.DIAMOND]: 5,
};

export const INITIAL_MAX_RESOURCES: Record<ResourceType, number> = {
  [ResourceType.MONEY]: UNLIMITED_CAPACITY,
  [ResourceType.AMMO]: UNLIMITED_CAPACITY,
  [ResourceType.OIL]: UNLIMITED_CAPACITY,
  [ResourceType.GOLD]: UNLIMITED_CAPACITY,
  [ResourceType.DIAMOND]: 10,
};

const initBuildings = { ...INITIAL_BUILDINGS };
initBuildings[BuildingType.DIAMOND_MINE] = { level: 1, isDamaged: false };
initBuildings[BuildingType.BANK] = { level: 1, isDamaged: false };

export const INITIAL_GAME_STATE: GameState = {
  saveVersion: SAVE_VERSION,
  gameId: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  playerName: 'Commander',
  peerId: null,
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
  currentInterestRate: BANK_INTEREST_RATE_MIN,
  nextRateChangeTime: Date.now() + BANK_RATE_CHANGE_INTERVAL_MS,
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
  attackQueue: [],
  lastProcessedAttackTime: 0,
  incomingAttacks: [],
  activeWar: null,
  allyReinforcements: [],
  grudges: [],
  enemyAttackCounts: {},
  lastEnemyAttackCheckTime: Date.now(),
  lastEnemyAttackResetTime: Date.now(),
  spyReports: [],
  targetAttackCounts: {},
  lastAttackResetTime: Date.now(),
  rankingData: initializeRankingState(),
  diplomaticActions: {},
  lastReputationDecayTime: Date.now(),
  
  // Reputation History System (New)
  reputationHistory: {},
  interactionRecords: {},
  
  // Botín Logístico (Logistic Loot System)
  logisticLootFields: [],
  visibleLogisticLootFields: [],
  lifetimeLogisticStats: {
      totalGenerated: 0,
      totalHarvested: 0,
      totalExpired: 0,
      totalDisputed: 0,
      totalDisputeWins: 0,
      fieldsCreated: 0,
      fieldsHarvested: 0,
  },
  
  lifetimeStats: {
    enemiesKilled: 0,
    unitsLost: 0,
    resourcesMined: 0,
    missionsCompleted: 0,
    highestRankAchieved: 9999
  },
  redeemedGiftCodes: [],
  giftCodeCooldowns: {},
  logs: []
};
