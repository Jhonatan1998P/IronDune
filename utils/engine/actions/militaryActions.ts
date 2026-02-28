
import { UNIT_DEFS } from '../../../data/units';
import { NEWBIE_PROTECTION_THRESHOLD, PVP_RANGE_MAX, PVP_RANGE_MIN, PVP_TRAVEL_TIME_MS, MAX_ATTACKS_PER_TARGET } from '../../../constants';
import { GameState, LogEntry, MissionDuration, ResourceType, TechType, UnitType } from '../../../types';
import { startWar } from '../war';
import { calculateRecruitmentCost, calculateRecruitmentTime } from '../../formulas';
import { ActionResult } from './types';

// --- RECRUITMENT ---
export const executeRecruit = (state: GameState, type: UnitType, amount: number): ActionResult => {
    if (amount <= 0) return { success: false };
    if (state.activeRecruitments.length >= 3) return { success: false, errorKey: 'queue_full' };

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
    const hasUnits = Object.entries(units).some(([, val]) => val && val > 0);
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
    
    // NEW LOGIC: Slots based on Tech
    const techLevel = state.techLevels[TechType.STRATEGIC_COMMAND] || 0;
    const maxSlots = 1 + techLevel;
    const activeCampaigns = state.activeMissions.filter(m => m.type === 'CAMPAIGN_ATTACK');

    if (activeCampaigns.length >= maxSlots) return { success: false, errorKey: 'campaign_slots_full' };
    
    // Prevent attacking the same level simultaneously
    if (activeCampaigns.some(m => m.levelId === levelId)) return { success: false, errorKey: 'campaign_busy' };
    
    const canAfford = Object.entries(playerUnits).every(([uType, qty]) => (state.units[uType as UnitType] || 0) >= (qty as number));
    if (!canAfford) return { success: false, errorKey: 'insufficient_units' };

    const missionId = `camp-${Date.now()}`;
    // Use standard 15m travel time like PvP for consistency and balance
    const endTime = now + PVP_TRAVEL_TIME_MS; 
    
    const newUnits = { ...state.units };
    Object.entries(playerUnits).forEach(([u, q]) => newUnits[u as UnitType] -= (q as number));

    const newState = {
        ...state,
        units: newUnits,
        activeMissions: [ ...state.activeMissions, { id: missionId, type: 'CAMPAIGN_ATTACK' as const, startTime: now, endTime, duration: 15, units: playerUnits, levelId } ]
    };
    return { success: true, newState };
};

// --- PvP & WAR ---
export const executePvpAttack = (state: GameState, targetId: string, targetName: string, targetScore: number, playerUnits: Partial<Record<UnitType, number>>, useDiamond: boolean = false): ActionResult => {
    if (state.empirePoints <= NEWBIE_PROTECTION_THRESHOLD) return { success: false, errorKey: 'protection_active' };

    let isWarAttack = false;
    let travelTime = PVP_TRAVEL_TIME_MS; // Default 15 min

    // Check reset time for limits
    const now = Date.now();
    let currentCounts = { ...state.targetAttackCounts };
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (now - state.lastAttackResetTime > ONE_DAY) {
        currentCounts = {}; // Reset counts
    }

    if (state.activeWar) {
        // Prevent raiding other targets during war
        if (state.activeWar.enemyId !== targetId) return { success: false, errorKey: 'war_active_lock' }; 
        if (state.activeWar.playerAttacksLeft <= 0) return { success: false, errorKey: 'campaign_busy' }; 
        isWarAttack = true;
    } else {
        const ratio = targetScore / Math.max(1, state.empirePoints);
        if (ratio < PVP_RANGE_MIN || ratio > PVP_RANGE_MAX) return { success: false, errorKey: 'invalid_mission' };
        
        // Check attack limit for normal raids
        const count = currentCounts[targetId] || 0;
        if (count >= MAX_ATTACKS_PER_TARGET) {
            return { success: false, errorKey: 'campaign_busy' }; // Reuse generic busy or create specific
        }
    }

    // Apply Diamond Acceleration
    if (useDiamond) {
        travelTime = Math.floor(PVP_TRAVEL_TIME_MS * 0.2); // 80% Reduction
    }

    const hasUnits = Object.entries(playerUnits).some(([, val]) => val && val > 0);
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
        // Increment non-war attack count
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

export const executeDeclareWar = (state: GameState, targetId: string, targetName: string, targetScore: number): ActionResult => {
    if (state.activeWar) return { success: false, errorKey: 'campaign_busy' };
    if (state.empirePoints <= NEWBIE_PROTECTION_THRESHOLD) return { success: false, errorKey: 'protection_active' };

    const newState = startWar(state, targetId, targetName, targetScore);
    return { success: true, newState };
};

export const executeEspionage = (state: GameState, attackId: string): ActionResult => {
    // Find specific attack by ID in incoming list
    const incomingIndex = state.incomingAttacks.findIndex(a => a.id === attackId);
    
    if (incomingIndex === -1) return { success: false, errorKey: 'invalid_mission' }; 
    
    const attack = state.incomingAttacks[incomingIndex];
    if (attack.isScouted) return { success: false }; // Already scouted

    // Cost Formula: (EnemyScore * 64) / 5
    const baseCost = Math.max(100, Math.floor(attack.attackerScore * 64));
    const cost = Math.floor(baseCost / 5);
    
    if (state.resources[ResourceType.GOLD] < cost) return { success: false, errorKey: 'insufficient_funds' };

    const newIncoming = [...state.incomingAttacks];
    newIncoming[incomingIndex] = { ...newIncoming[incomingIndex], isScouted: true };

    const now = Date.now();
    
    // Determine context for log parameters
    const waveNum = attack.isWarWave && state.activeWar ? state.activeWar.currentWave : undefined;

    // CREATE INTEL REPORT
    const intelLog: LogEntry = {
        id: `intel-${now}`,
        messageKey: 'log_intel_acquired',
        type: 'intel',
        timestamp: now,
        params: {
            targetName: attack.attackerName,
            units: attack.units,
            score: attack.attackerScore,
            wave: waveNum
        }
    };

    const newState = {
        ...state,
        resources: {
            ...state.resources,
            [ResourceType.GOLD]: state.resources[ResourceType.GOLD] - cost
        },
        incomingAttacks: newIncoming,
        logs: [intelLog, ...state.logs].slice(0, 100)
    };

    return { success: true, newState };
};
