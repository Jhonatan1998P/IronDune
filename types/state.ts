
import { BuildingType, ResourceType, TechType, UnitType, BotPersonality } from './enums';
import type { MarketEvent, MarketOffer } from './defs';
import { StaticBot } from '../utils/engine/rankings'; // Import StaticBot type

export interface BuildingState {
  level: number;
  isDamaged?: boolean; // New: Diamond Mine damage state
}

export type GameStatus = 'MENU' | 'PLAYING';

export type MissionDuration = 5 | 15 | 30 | 60; 

export interface ActiveMission {
  id: string;
  type: 'PATROL' | 'CAMPAIGN_ATTACK' | 'PVP_ATTACK';
  startTime: number;
  endTime: number;
  duration: number; // in minutes
  units: Partial<Record<UnitType, number>>; 
  levelId?: number; // For Campaign
  targetId?: string; // For PvP
  targetName?: string; // For PvP
  targetScore?: number; // For PvP (to calculate army size)
  isWarAttack?: boolean; // Flag for War specific attacks
}

export interface IncomingAttack {
  id: string;
  attackerName: string;
  attackerScore: number;
  units: Partial<Record<UnitType, number>>;
  startTime: number;
  endTime: number; // Impact time
  delayCount?: number; // Track how many times grace period was applied
  isWarWave?: boolean; // Flag to identify war waves
  isScouted?: boolean; // Flag if player paid to reveal composition
}

export interface Grudge {
    id: string;
    botId: string;
    botName: string;
    botPersonality: BotPersonality;
    botScore: number; // Score at time of grudge
    createdAt: number;
    retaliationTime: number; // When they plan to strike back
    notified: boolean; // Has the player been warned?
}

export interface ActiveRecruitment {
  id: string;
  unitType: UnitType;
  count: number;
  startTime: number;
  endTime: number;
}

export interface ActiveConstruction {
  id: string;
  buildingType: BuildingType;
  count: number; // Levels to add or Quantity to build
  startTime: number;
  endTime: number;
}

export interface ActiveResearch {
  techId: TechType;
  startTime: number;
  endTime: number;
}

// Log Params Definitions for Type Safety
export interface CombatLogParams {
  combatResult?: any; // Keeping as any for now due to complexity, but typed in usage
  loot?: Partial<Record<ResourceType, number>>;
  buildingLoot?: Partial<Record<BuildingType, number>>; // New V1.3: Building Theft
  attacker?: string;
  targetName?: string;
}

export interface MarketLogParams {
  type: 'BUY' | 'SELL';
  amount: number;
  resource: ResourceType;
  event?: string;
}

export interface DesertionLogParams {
  unit: UnitType;
  reasons: string[];
}

export interface IntelLogParams {
  targetName: string;
  units: Partial<Record<UnitType, number>>;
  score: number;
  wave?: number;
}

export interface LogEntry {
  id: string;
  messageKey: string; 
  // Union type for safer access, defaulting to any for backwards compat where strictly needed
  params?: Partial<CombatLogParams> & Partial<MarketLogParams> & Partial<DesertionLogParams> & Partial<IntelLogParams> & { [key: string]: any }; 
  timestamp: number;
  type: 'info' | 'combat' | 'build' | 'research' | 'finance' | 'mission' | 'market' | 'tutorial' | 'economy' | 'war' | 'intel';
  archived?: boolean; 
}

export interface LifetimeStats {
  enemiesKilled: number;
  unitsLost: number;
  resourcesMined: number; // Total value
  missionsCompleted: number;
  highestRankAchieved: number;
}

export interface WarState {
    id: string;
    enemyId: string;
    enemyName: string;
    enemyScore: number;
    startTime: number;
    duration: number; // Mutable duration to handle Overtime
    nextWaveTime: number;
    currentWave: number; // 1 to 8 (can exceed 8 in Overtime)
    totalWaves: number; // Mutable total waves
    playerVictories: number;
    enemyVictories: number;
    playerAttacksLeft: number; // Max 8 (can increase in Overtime)
    lootPool: Record<ResourceType, number>; // The accumulated 50% pot
    
    // Detailed Statistics
    playerResourceLosses: Record<ResourceType, number>;
    enemyResourceLosses: Record<ResourceType, number>;
    playerUnitLosses: number;
    enemyUnitLosses: number;

    // Persistence for Total War logic
    currentEnemyGarrison: Partial<Record<UnitType, number>>;
}

export interface StaticBot {
    id: string;
    name: string;
    avatarId: number;
    country: string;
    stats: Record<RankingCategory, number>;
    ambition: number;
    personality: BotPersonality;
    lastRank?: number;
    currentEvent: BotEvent;
    eventTurnsRemaining: number;
    growthModifier: number;
    reputation: number; // 0 to 100, 50 is neutral
}

export interface RankingData {
    bots: StaticBot[];
    lastUpdateTime: number;
}

export interface GameState {
  saveVersion: number; 
  playerName: string;
  hasChangedName: boolean;
  resources: Record<ResourceType, number>;
  maxResources: Record<ResourceType, number>; 
  buildings: Record<BuildingType, BuildingState>;
  units: Record<UnitType, number>;
  researchedTechs: TechType[];
  techLevels: Partial<Record<TechType, number>>;
  activeResearch: ActiveResearch | null; 
  activeMissions: ActiveMission[]; 
  activeRecruitments: ActiveRecruitment[]; 
  activeConstructions: ActiveConstruction[]; 
  bankBalance: number; 
  currentInterestRate: number; 
  nextRateChangeTime: number; 
  lastInterestPayoutTime: number; 
  empirePoints: number;
  lastSaveTime: number;
  campaignProgress: number; 
  lastCampaignMissionFinishedTime: number; 
  
  marketOffers: MarketOffer[];
  marketNextRefreshTime: number;
  activeMarketEvent: MarketEvent | null;

  completedTutorials: string[];
  currentTutorialId: string | null;
  tutorialClaimable: boolean; 
  tutorialAccepted: boolean;
  isTutorialMinimized: boolean; 

  // Attack System (New V1.4)
  nextAttackTime: number; // Timestamp for the next scheduled bot attack
  incomingAttacks: IncomingAttack[];
  activeWar: WarState | null; // New War System
  
  // Grudge System (New)
  grudges: Grudge[];

  // PvP Limits
  targetAttackCounts: Record<string, number>; // TargetID -> Count
  lastAttackResetTime: number; // For daily resets

  // Ranking System (Moved to State for Persistence)
  rankingData: RankingData;

  lifetimeStats: LifetimeStats; 

  logs: LogEntry[]; 
}

export interface BattleRoundLog {
  round: number;
  playerUnitsStart: number;
  enemyUnitsStart: number;
  playerUnitsLost: number;
  enemyUnitsLost: number;
  details: string[]; 
}

export interface UnitPerformanceStats {
    kills: Partial<Record<UnitType, number>>;
    deathsBy: Partial<Record<UnitType, number>>;
    damageDealt: number;
    criticalKills: number; // New: Number of kills via 70% HP rule
    criticalDeaths: number; // New: Number of times this unit died via 70% HP rule
}

export interface BattleResult {
  winner: 'PLAYER' | 'ENEMY' | 'DRAW';
  rounds: BattleRoundLog[];
  initialPlayerArmy: Partial<Record<UnitType, number>>; 
  initialEnemyArmy: Partial<Record<UnitType, number>>; 
  finalPlayerArmy: Partial<Record<UnitType, number>>;
  finalEnemyArmy: Partial<Record<UnitType, number>>;
  totalPlayerCasualties: Partial<Record<UnitType, number>>;
  totalEnemyCasualties: Partial<Record<UnitType, number>>;
  playerTotalHpStart: number;
  playerTotalHpLost: number;
  enemyTotalHpStart: number;
  enemyTotalHpLost: number;
  playerDamageDealt: number;
  enemyDamageDealt: number;
  
  // New: Detailed performance tracking
  playerPerformance?: Partial<Record<UnitType, UnitPerformanceStats>>;
  enemyPerformance?: Partial<Record<UnitType, UnitPerformanceStats>>;
}

export interface OfflineReport {
    timeElapsed: number; 
    resourcesGained: Record<ResourceType, number>;
    bankInterestEarned: number;
    completedResearch: TechType[];
    completedMissions: {
        id: string;
        success: boolean;
        loot: Partial<Record<ResourceType, number>>;
    }[];
}
