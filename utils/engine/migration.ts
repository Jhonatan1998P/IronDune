
import { BuildingType, GameState, ResourceType, TechType, UnitType } from '../../types';
import { SAVE_VERSION, WAR_DURATION_MS, WAR_PLAYER_ATTACKS, WAR_TOTAL_WAVES } from '../../constants';
import { INITIAL_GAME_STATE } from '../../data/initialState';
import { initializeRankingState } from './rankings';

// Key for old deprecated local storage ranking system
const LEGACY_STORAGE_KEY = 'ironDune_static_rankings_v3';

export const sanitizeAndMigrateSave = (saved: any): GameState => {
    // 1. Deep Clone Initial State to ensure full structure exists
    const cleanState: GameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));

    if (!saved) return cleanState;

    // 2. Migrate Primitives & Simple Arrays
    if (typeof saved.bankBalance === 'number' && !isNaN(saved.bankBalance)) cleanState.bankBalance = saved.bankBalance;
    if (typeof saved.currentInterestRate === 'number') cleanState.currentInterestRate = saved.currentInterestRate;
    if (typeof saved.nextRateChangeTime === 'number') cleanState.nextRateChangeTime = saved.nextRateChangeTime;
    if (typeof saved.lastInterestPayoutTime === 'number') cleanState.lastInterestPayoutTime = saved.lastInterestPayoutTime;
    if (typeof saved.empirePoints === 'number') cleanState.empirePoints = saved.empirePoints;
    if (typeof saved.lastSaveTime === 'number') cleanState.lastSaveTime = saved.lastSaveTime;
    if (typeof saved.campaignProgress === 'number') cleanState.campaignProgress = saved.campaignProgress;
    if (typeof saved.lastCampaignMissionFinishedTime === 'number') cleanState.lastCampaignMissionFinishedTime = saved.lastCampaignMissionFinishedTime;
    if (typeof saved.isTutorialMinimized === 'boolean') cleanState.isTutorialMinimized = saved.isTutorialMinimized;
    if (typeof saved.tutorialAccepted === 'boolean') cleanState.tutorialAccepted = saved.tutorialAccepted;
    
    // Threat System Persistence (Fix)
    if (typeof saved.threatLevel === 'number') cleanState.threatLevel = saved.threatLevel;
    if (typeof saved.warCooldownEndTime === 'number') cleanState.warCooldownEndTime = saved.warCooldownEndTime;
    if (Array.isArray(saved.incomingAttacks)) cleanState.incomingAttacks = saved.incomingAttacks;
    if (Array.isArray(saved.grudges)) cleanState.grudges = saved.grudges;
    
    // Attack Counts Migration
    if (saved.targetAttackCounts) cleanState.targetAttackCounts = saved.targetAttackCounts;
    if (saved.lastAttackResetTime) cleanState.lastAttackResetTime = saved.lastAttackResetTime;

    // WAR MIGRATION: Ensure new fields exist if war is active
    if (saved.activeWar) {
        cleanState.activeWar = saved.activeWar;
        if (!cleanState.activeWar!.playerResourceLosses) {
            cleanState.activeWar!.playerResourceLosses = { [ResourceType.MONEY]: 0, [ResourceType.OIL]: 0, [ResourceType.AMMO]: 0, [ResourceType.GOLD]: 0, [ResourceType.DIAMOND]: 0 };
        }
        if (!cleanState.activeWar!.enemyResourceLosses) {
            cleanState.activeWar!.enemyResourceLosses = { [ResourceType.MONEY]: 0, [ResourceType.OIL]: 0, [ResourceType.AMMO]: 0, [ResourceType.GOLD]: 0, [ResourceType.DIAMOND]: 0 };
        }
        if (typeof cleanState.activeWar!.playerUnitLosses !== 'number') cleanState.activeWar!.playerUnitLosses = 0;
        if (typeof cleanState.activeWar!.enemyUnitLosses !== 'number') cleanState.activeWar!.enemyUnitLosses = 0;
        
        // V3 Overtime & Duration Fix Migration
        // Force update duration if it looks like the old default, otherwise trust save state (in case of mid-overtime)
        if (typeof cleanState.activeWar!.duration !== 'number' || cleanState.activeWar!.duration === 110 * 60 * 1000) {
             cleanState.activeWar!.duration = WAR_DURATION_MS;
        }
        if (typeof cleanState.activeWar!.totalWaves !== 'number' || cleanState.activeWar!.totalWaves === 7) {
             cleanState.activeWar!.totalWaves = WAR_TOTAL_WAVES;
        }
        // Fix potential bug where old attacks left might be undefined
        if (typeof cleanState.activeWar!.playerAttacksLeft !== 'number') cleanState.activeWar!.playerAttacksLeft = WAR_PLAYER_ATTACKS;

        // V4 Garrison Persistence Migration
        if (!cleanState.activeWar!.currentEnemyGarrison) {
            cleanState.activeWar!.currentEnemyGarrison = {};
        }
    }

    // 3. Migrate Techs
    if (Array.isArray(saved.researchedTechs)) {
        cleanState.researchedTechs = saved.researchedTechs.filter((id: string) => Object.values(TechType).includes(id as TechType));
    }
    
    // Migrate Tech Levels (New in version 2 or this feature update)
    if (saved.techLevels && typeof saved.techLevels === 'object') {
        cleanState.techLevels = saved.techLevels;
    }

    // 4. Migrate Resources
    if (saved.resources) {
        Object.keys(cleanState.resources).forEach(key => {
            const k = key as ResourceType;
            if (typeof saved.resources[k] === 'number' && !isNaN(saved.resources[k])) {
                cleanState.resources[k] = saved.resources[k];
            }
        });
    }

    if (saved.maxResources) {
        Object.keys(cleanState.maxResources).forEach(key => {
            const k = key as ResourceType;
            if (typeof saved.maxResources[k] === 'number' && !isNaN(saved.maxResources[k])) {
                cleanState.maxResources[k] = saved.maxResources[k];
            }
        });
    }

    // 5. Migrate Units
    if (saved.units) {
        Object.keys(cleanState.units).forEach(key => {
            const k = key as UnitType;
            if (typeof saved.units[k] === 'number' && !isNaN(saved.units[k])) {
                cleanState.units[k] = saved.units[k];
            }
        });
    }

    // 6. Migrate Buildings
    if (saved.buildings) {
        Object.keys(cleanState.buildings).forEach(key => {
            const k = key as BuildingType;
            if (saved.buildings[k] && typeof saved.buildings[k].level === 'number') {
                cleanState.buildings[k].level = saved.buildings[k].level;
            }
        });
    }

    // --- CRITICAL FIX: Ensure Diamond Mine is at least Level 1 ---
    if (!cleanState.buildings[BuildingType.DIAMOND_MINE] || cleanState.buildings[BuildingType.DIAMOND_MINE].level < 1) {
        cleanState.buildings[BuildingType.DIAMOND_MINE] = { level: 1 };
    }

    // 7. Migrate Missions
    if (Array.isArray(saved.activeMissions)) {
        cleanState.activeMissions = saved.activeMissions.filter((m: any) => 
            m && 
            typeof m.id === 'string' && 
            typeof m.endTime === 'number' && 
            m.units
        );
    }

    if (saved.activeResearch) {
        cleanState.activeResearch = saved.activeResearch;
    }
    
    // Migrate Active Recruitments (NEW)
    if (Array.isArray(saved.activeRecruitments)) {
        cleanState.activeRecruitments = saved.activeRecruitments;
    }

    // Migrate Active Constructions (NEW for this request)
    if (Array.isArray(saved.activeConstructions)) {
        cleanState.activeConstructions = saved.activeConstructions;
    }
    
    // Market Migration
    if (Array.isArray(saved.marketOffers)) {
        cleanState.marketOffers = saved.marketOffers;
    }
    if (saved.activeMarketEvent) {
        cleanState.activeMarketEvent = saved.activeMarketEvent;
    }
    if (typeof saved.marketNextRefreshTime === 'number') {
        cleanState.marketNextRefreshTime = saved.marketNextRefreshTime;
    }

    // Tutorial State
    if (Array.isArray(saved.completedTutorials)) {
        cleanState.completedTutorials = saved.completedTutorials;
    }
    if (typeof saved.currentTutorialId === 'string' || saved.currentTutorialId === null) {
        cleanState.currentTutorialId = saved.currentTutorialId;
    }
    if (typeof saved.tutorialClaimable === 'boolean') {
        cleanState.tutorialClaimable = saved.tutorialClaimable;
    }

    // Rankings Migration (NEW V1.2.0 Fix)
    if (saved.rankingData && Array.isArray(saved.rankingData.bots)) {
        // Safe migration: use existing data from save file
        cleanState.rankingData = saved.rankingData;
    } else {
        // LEGACY MIGRATION: Try to rescue data from localStorage if it exists
        // This ensures existing players don't lose their "universe" when this update hits
        try {
            const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacyData) {
                const parsedLegacy = JSON.parse(legacyData);
                if (parsedLegacy && Array.isArray(parsedLegacy.bots)) {
                    cleanState.rankingData = {
                        bots: parsedLegacy.bots,
                        lastUpdateTime: parsedLegacy.lastUpdateTime || Date.now()
                    };
                    console.log("Migrated rankings from LocalStorage to GameState.");
                } else {
                    cleanState.rankingData = initializeRankingState();
                }
            } else {
                cleanState.rankingData = initializeRankingState();
            }
        } catch (e) {
            cleanState.rankingData = initializeRankingState();
        }
    }

    // Migrate Lifetime Stats (New)
    if (saved.lifetimeStats) {
        cleanState.lifetimeStats = saved.lifetimeStats;
    }

    // Logs Migration (New)
    if (Array.isArray(saved.logs)) {
        cleanState.logs = saved.logs;
    } else {
        cleanState.logs = [];
    }

    // Force update version
    cleanState.saveVersion = SAVE_VERSION;
    
    return cleanState;
};
