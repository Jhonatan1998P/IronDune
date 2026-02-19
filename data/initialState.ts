
import { GameState, ResourceType, BuildingType } from '../types';
import { SAVE_VERSION } from '../constants';
import { INITIAL_BUILDINGS } from './buildings';
import { INITIAL_UNITS } from './units';
import { TUTORIAL_STEPS } from './tutorial';
import { initializeRankingState } from '../utils/engine/rankings';

// Recursos iniciales ajustados para empezar desde abajo (Start from scratch feeling)
// Dinero ligeramente aumentado para asegurar la compra del primer edificio sin problemas
export const INITIAL_RESOURCES: Record<ResourceType, number> = {
  [ResourceType.MONEY]: 5000, 
  [ResourceType.OIL]: 200,
  [ResourceType.AMMO]: 100,
  [ResourceType.GOLD]: 0,
  [ResourceType.DIAMOND]: 0,
};

// Almacenamiento Base Inicial (Antes del Banco)
// 1M Dinero, 50K Munición, 10K Petróleo, 1K Oro.
export const INITIAL_MAX_RESOURCES: Record<ResourceType, number> = {
  [ResourceType.MONEY]: 1000000,
  [ResourceType.AMMO]: 50000,
  [ResourceType.OIL]: 10000,
  [ResourceType.GOLD]: 1000,
  [ResourceType.DIAMOND]: 10, // Small base cap for starters
};

// Initialize buildings: Diamond Mine Lv1 AND Bank Lv1
const initBuildings = { ...INITIAL_BUILDINGS };
initBuildings[BuildingType.DIAMOND_MINE] = { level: 1 };
initBuildings[BuildingType.BANK] = { level: 1 }; // New Requirement: Bank always starts at level 1

export const INITIAL_GAME_STATE: GameState = {
  saveVersion: SAVE_VERSION,
  resources: INITIAL_RESOURCES,
  maxResources: INITIAL_MAX_RESOURCES,
  buildings: initBuildings,
  units: INITIAL_UNITS,
  researchedTechs: [],
  techLevels: {}, // Initialize empty
  activeResearch: null,
  activeMissions: [],
  activeRecruitments: [], // Initialize empty
  activeConstructions: [], // Initialize empty
  bankBalance: 0,
  currentInterestRate: 0.05, // Start at 5% (Middle of 2-10% range)
  nextRateChangeTime: Date.now() + (60 * 60 * 1000), // 1 Hour
  lastInterestPayoutTime: Date.now(),
  empirePoints: 0,
  lastSaveTime: Date.now(),
  campaignProgress: 1, // Starts at Level 1
  lastCampaignMissionFinishedTime: 0,
  
  // Market Defaults
  marketOffers: [],
  activeMarketEvent: null,
  marketNextRefreshTime: 0, // Will trigger immediate refresh on first loop

  // Tutorial
  completedTutorials: [],
  currentTutorialId: TUTORIAL_STEPS[0].id, // Start with first tutorial
  tutorialClaimable: false,
  tutorialAccepted: false, // Start unaccepted (User must accept briefing)
  isTutorialMinimized: false,

  // Threat System & War
  threatLevel: 0,
  warCooldownEndTime: 0,
  incomingAttacks: [],
  activeWar: null,
  grudges: [], // Init empty
  
  // PvP Limits
  targetAttackCounts: {},
  lastAttackResetTime: Date.now(),

  // Ranking System (Moved to State for Persistence)
  rankingData: initializeRankingState(),

  // Stats for Rankings
  lifetimeStats: {
    enemiesKilled: 0,
    unitsLost: 0,
    resourcesMined: 0,
    missionsCompleted: 0,
    highestRankAchieved: 9999
  },

  // Logs
  logs: []
};
