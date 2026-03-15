
import { UNIT_DEFS } from '../../../data/units';
import { 
    NEWBIE_PROTECTION_THRESHOLD, 
    PVP_RANGE_MAX, 
    PVP_RANGE_MIN, 
    GLOBAL_ATTACK_TRAVEL_TIME_MS, 
    MAP_MISSION_TRAVEL_TIME_MS, 
    MAX_ATTACKS_24H,
    MAX_ATTACKS_1H,
    SALVAGE_TRAVEL_TIME_MS 
} from '../../../constants';
import { GameState, MissionDuration, ResourceType, TechType, UnitType } from '../../../types';
import { calculateRecruitmentCost, calculateRecruitmentTime } from '../../formulas';
import { ActionResult } from './types';

/**
 * Military Actions (Client-side)
 * These functions handle only the INITIATION of missions.
 * The RESOLUTION is handled exclusively by the Remote Battle Server.
 */

// --- SALVAGE ---
export const executeSalvageMission = (state: GameState, lootId: string, drones: number): ActionResult => {
    if (drones <= 0) return { success: false, errorKey: 'insufficient_units' };
    
    if ((state.units[UnitType.SALVAGER_DRONE] || 0) < drones) {
        return { success: false, errorKey: 'insufficient_units' };
    }

    const missionId = `salvage-${Date.now()}`;
    const now = Date.now();
    const endTime = now + SALVAGE_TRAVEL_TIME_MS;

    const newUnits = { ...state.units };
    newUnits[UnitType.SALVAGER_DRONE] -= drones;

    const newState: GameState = {
        ...state,
        units: newUnits,
        activeMissions: [
            ...state.activeMissions,
            {
                id: missionId,
                type: 'SALVAGE',
                startTime: now,
                endTime,
                duration: Math.floor(SALVAGE_TRAVEL_TIME_MS / 60000),
                units: { [UnitType.SALVAGER_DRONE]: drones },
                logisticLootId: lootId
            }
        ]
    };
    return { success: true, newState };
};

export const executeRecruit = (state: GameState, type: UnitType, amount: number): ActionResult => {
    if (amount <= 0) return { success: false };
    if (state.activeRecruitments.length >= 5) return { success: false, errorKey: 'queue_full' };

    const def = UNIT_DEFS[type];
    if (!state.researchedTechs.includes(def.reqTech)) return { success: false, errorKey: 'req_tech' };

    const totalCost = calculateRecruitmentCost(def, amount);
    const totalTime = calculateRecruitmentTime(def, amount);

    if (state.resources[ResourceType.MONEY] < totalCost.money || 
        state.resources[ResourceType.OIL] < totalCost.oil || 
        state.resources[ResourceType.AMMO] < totalCost.ammo) {
        return { success: false, errorKey: 'insufficient_funds' };
    }

    const newState = {
        ...state,
        resources: {
            ...state.resources,
            [ResourceType.MONEY]: state.resources[ResourceType.MONEY] - totalCost.money,
            [ResourceType.OIL]: state.resources[ResourceType.OIL] - totalCost.oil,
            [ResourceType.AMMO]: state.resources[ResourceType.AMMO] - totalCost.ammo,
        },
        activeRecruitments: [
            ...state.activeRecruitments,
            { id: `rec-${Date.now()}`, unitType: type, count: amount, startTime: Date.now(), endTime: Date.now() + totalTime }
        ]
    };
    return { success: true, newState };
};

// --- MISSIONS (PvE Patrols) ---
export const executeStartMission = (state: GameState, units: Partial<Record<UnitType, number>>, duration: MissionDuration): ActionResult => {
    const hasUnits = Object.entries(units).some(([, val]) => val && (val as number) > 0);
    if (!hasUnits) return { success: false, errorKey: 'insufficient_units' };
    
    const canAfford = Object.entries(units).every(([uType, qty]) => (state.units[uType as UnitType] || 0) >= (qty as number));
    if (!canAfford) return { success: false, errorKey: 'insufficient_units' };

    const missionId = Date.now().toString();
    const now = Date.now();
    const endTime = now + (duration * 60 * 1000);

    const newUnits = { ...state.units };
    Object.entries(units).forEach(([uType, qty]) => newUnits[uType as UnitType] -= (qty as number));

    const newState = {
        ...state,
        units: newUnits,
        activeMissions: [ ...state.activeMissions, { id: missionId, type: 'PATROL' as const, startTime: now, endTime, duration, units } ]
    };
    return { success: true, newState };
};

// --- CAMPAIGN ---
export const executeCampaignAttack = (state: GameState, levelId: number, playerUnits: Partial<Record<UnitType, number>>): ActionResult => {
    const now = Date.now();
    const techLevel = state.techLevels[TechType.STRATEGIC_COMMAND] || 0;
    const maxSlots = 1 + techLevel;
    const activeCampaigns = state.activeMissions.filter(m => m.type === 'CAMPAIGN_ATTACK');

    if (activeCampaigns.length >= maxSlots) return { success: false, errorKey: 'campaign_slots_full' };
    if (activeCampaigns.some(m => m.levelId === levelId)) return { success: false, errorKey: 'campaign_busy' };
    
    const canAfford = Object.entries(playerUnits).every(([uType, qty]) => (state.units[uType as UnitType] || 0) >= (qty as number));
    if (!canAfford) return { success: false, errorKey: 'insufficient_units' };

    const missionId = `camp-${Date.now()}`;
    const endTime = now + MAP_MISSION_TRAVEL_TIME_MS; 
    
    const newUnits = { ...state.units };
    Object.entries(playerUnits).forEach(([u, q]) => newUnits[u as UnitType] -= (q as number));

    const newState = {
        ...state,
        units: newUnits,
        activeMissions: [ ...state.activeMissions, { id: missionId, type: 'CAMPAIGN_ATTACK' as const, startTime: now, endTime, duration: Math.floor(MAP_MISSION_TRAVEL_TIME_MS / 60000), units: playerUnits, levelId } ]
    };
    return { success: true, newState };
};

// --- PvP & WAR ---
export const executePvpAttack = (state: GameState, targetId: string, targetName: string, targetScore: number, playerUnits: Partial<Record<UnitType, number>>, useDiamond: boolean = false): ActionResult => {
    const isPlayerProtected = state.empirePoints <= NEWBIE_PROTECTION_THRESHOLD;
    const isTargetProtected = targetScore <= NEWBIE_PROTECTION_THRESHOLD;

    if (isPlayerProtected || isTargetProtected) return { success: false, errorKey: 'protection_active' };

    let isWarAttack = false;
    let travelTime = GLOBAL_ATTACK_TRAVEL_TIME_MS;

    const now = Date.now();
    let currentCounts = { ...state.targetAttackCounts };
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (now - state.lastAttackResetTime > ONE_DAY) {
        currentCounts = {}; 
    }

    if (state.activeWar) {
        if (state.activeWar.enemyId !== targetId) return { success: false, errorKey: 'war_active_lock' }; 
        if (state.activeWar.playerAttacksLeft <= 0) return { success: false, errorKey: 'campaign_busy' }; 
        isWarAttack = true;
    } else {
        const ratio = targetScore / Math.max(1, state.empirePoints);
        if (ratio < PVP_RANGE_MIN || ratio > PVP_RANGE_MAX) return { success: false, errorKey: 'invalid_mission' };
        
        const count = currentCounts[targetId] || 0;
        if (count >= MAX_ATTACKS_24H) {
            return { success: false, errorKey: 'campaign_busy' };
        }
    }

    if (useDiamond) {
        travelTime = Math.floor(GLOBAL_ATTACK_TRAVEL_TIME_MS * 0.2);
    }

    const hasUnits = Object.entries(playerUnits).some(([, val]) => val && (val as number) > 0);
    if (!hasUnits) return { success: false, errorKey: 'insufficient_units' };
    
    const canAfford = Object.entries(playerUnits).every(([uType, qty]) => (state.units[uType as UnitType] || 0) >= (qty as number));
    if (!canAfford) return { success: false, errorKey: 'insufficient_units' };

    const currentDiamonds = state.resources[ResourceType.DIAMOND] || 0;
    if (useDiamond && currentDiamonds < 1) return { success: false, errorKey: 'missing_diamond' };

    const endTime = now + travelTime;
    const newUnits = { ...state.units };
    Object.entries(playerUnits).forEach(([u, q]) => newUnits[u as UnitType] -= (q as number));

    let newWarState = state.activeWar ? { ...state.activeWar } : null;
    if (isWarAttack && newWarState) {
        newWarState.playerAttacksLeft = Math.max(0, newWarState.playerAttacksLeft - 1);
    } else {
        currentCounts[targetId] = (currentCounts[targetId] || 0) + 1;
    }

    const missionId = `pvp-${Date.now()}`;
    const durationInMinutes = travelTime / 60000;

    const newState = {
        ...state,
        units: newUnits,
        resources: {
            ...state.resources,
            [ResourceType.DIAMOND]: currentDiamonds - (useDiamond ? 1 : 0)
        },
        activeWar: newWarState,
        targetAttackCounts: currentCounts,
        lastAttackResetTime: (now - state.lastAttackResetTime > ONE_DAY) ? now : state.lastAttackResetTime,
        activeMissions: [
            ...state.activeMissions,
            { 
                id: missionId, 
                type: 'PVP_ATTACK' as const, 
                startTime: now, 
                endTime, 
                duration: durationInMinutes,
                units: playerUnits,
                targetId,
                targetName,
                targetScore,
                isWarAttack
            }
        ]
    };
    return { success: true, newState };
};

// WAR DECLARATION IS NOW DELEGATED TO SERVER IN FUTURE, FOR NOW WE KEEP THE WRAPPER BUT IT WILL FAIL UNTIL SERVER IMPLEMENTS IT
export const executeDeclareWar = (_state: GameState, _targetId: string, _targetName: string, _targetScore: number): ActionResult => {
    return { success: false, errorKey: 'invalid_mission' }; // Blocked until server implementation
};

export const executeEspionage = (state: GameState, attackId: string): ActionResult => {
    const incomingIndex = state.incomingAttacks.findIndex(a => a.id === attackId);
    if (incomingIndex === -1) return { success: false, errorKey: 'invalid_mission' }; 
    
    const attack = state.incomingAttacks[incomingIndex];
    if (attack.isScouted) return { success: false };

    const cost = Math.floor(Math.max(100, Math.floor(attack.attackerScore * 64)) / 5);
    
    if (state.resources[ResourceType.GOLD] < cost) return { success: false, errorKey: 'insufficient_funds' };

    const newIncoming = [...state.incomingAttacks];
    newIncoming[incomingIndex] = { ...newIncoming[incomingIndex], isScouted: true };

    const newState = {
        ...state,
        resources: {
            ...state.resources,
            [ResourceType.GOLD]: state.resources[ResourceType.GOLD] - cost
        },
        incomingAttacks: newIncoming,
    };

    return { success: true, newState };
};
