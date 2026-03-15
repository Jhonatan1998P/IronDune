// ============================================================
// SALVAGE ENGINE - Enhanced with Conflicts & Shared Loot
// ============================================================

import { ResourceType, UnitType, TechType } from './enums.js';
import { DEBRIS_ELIGIBLE_RESOURCES, SALVAGER_CARGO_CAPACITY } from './constants.js';
import { simulateCombat } from './combat.js';
import { supabase } from '../lib/supabase.js';

export const resolveSalvageMission = async (mission, lootField, allMissionsAtSameTime, playerTechs = {}) => {
    // 1. Conflict Check: Drone Battle if multiple players arrive at the EXACT SAME SECOND for the same field
    const simultaneousEnemies = allMissionsAtSameTime.filter(m => 
        m.id !== mission.id && 
        m.playerId !== mission.playerId && 
        m.endTime === mission.endTime &&
        m.logisticLootId === mission.logisticLootId
    );
    
    if (simultaneousEnemies.length > 0) {
        return await handleSalvageConflict(mission, lootField, simultaneousEnemies, playerTechs);
    }

    // 2. Regular Harvesting (First-come, first-served handled by arrival loop in attackQueue)
    if (!lootField || lootField.expiresAt < Date.now() || lootField.totalValue <= 0) {
        return { 
            success: false, 
            reason: 'EMPTY_OR_EXPIRED', 
            resources: {},
            dronesReturned: mission.units?.[UnitType.SALVAGER_DRONE] || 0
        };
    }
    
    const dronesCount = mission.units?.[UnitType.SALVAGER_DRONE] || 0;
    if (dronesCount <= 0) return { success: false, reason: 'NO_DRONES', resources: {}, dronesReturned: 0 };
    
    const totalCapacity = dronesCount * SALVAGER_CARGO_CAPACITY;
    const CARGO_CONVERSION_RATES = {
        [ResourceType.MONEY]: 1, [ResourceType.OIL]: 10, [ResourceType.AMMO]: 5,
        [ResourceType.GOLD]: 50, [ResourceType.DIAMOND]: 500,
    };
    
    const harvested = {};
    let capacityUsed = 0;
    const remaining = { ...lootField.resources };
    
    for (const res of DEBRIS_ELIGIBLE_RESOURCES) {
        const available = remaining[res] || 0;
        if (available <= 0) continue;
        const rate = CARGO_CONVERSION_RATES[res];
        const maxCanTake = Math.floor((totalCapacity - capacityUsed) / rate);
        const toTake = Math.min(available, maxCanTake);
        if (toTake > 0) {
            harvested[res] = toTake;
            remaining[res] = available - toTake;
            capacityUsed += toTake * rate;
        }
        if (capacityUsed >= totalCapacity) break;
    }
    
    const updatedLootField = {
        ...lootField,
        resources: remaining,
        isPartiallyHarvested: true,
        harvestCount: (lootField.harvestCount || 0) + 1,
        totalValue: Object.values(remaining).reduce((a, b) => a + (b || 0), 0)
    };

    // Update Global Loot
    await updateGlobalLootField(updatedLootField);
    
    return {
        success: true, reason: 'HARVESTED', resources: harvested,
        dronesReturned: dronesCount, remainingLoot: updatedLootField
    };
};

async function handleSalvageConflict(currentMission, lootField, simultaneousEnemies, playerTechs) {
    // For simplicity, we battle the strongest enemy arriving at the same time
    const enemy = simultaneousEnemies.sort((a, b) => (b.units[UnitType.SALVAGER_DRONE] || 0) - (a.units[UnitType.SALVAGER_DRONE] || 0))[0];
    
    // Drone Battle Stats with Tech Bonus
    const droneTechLevel = playerTechs[TechType.DRONE_BATTLE_TECH] || 0;
    const techMultiplier = 1 + (droneTechLevel * 0.1);

    const playerArmy = { [UnitType.SALVAGER_DRONE]: currentMission.units[UnitType.SALVAGER_DRONE] || 0 };
    const enemyArmy = { [UnitType.SALVAGER_DRONE]: enemy.units[UnitType.SALVAGER_DRONE] || 0 };

    const result = simulateCombat(playerArmy, enemyArmy, techMultiplier);
    
    if (result.winner === 'PLAYER') {
        // Player wins, continues to harvest with survivors
        const survivors = result.finalPlayerArmy[UnitType.SALVAGER_DRONE] || 0;
        if (survivors <= 0) return { 
            success: false, 
            reason: 'ALL_DRONES_LOST', 
            resources: {}, 
            dronesReturned: 0,
            conflictOccurred: true,
            battleResult: result,
            enemyName: enemy.playerName || 'Enemy Salvager'
        };
        
        // Final harvest logic for survivors
        const harvestResult = await resolveSalvageMission({ ...currentMission, units: { [UnitType.SALVAGER_DRONE]: survivors } }, lootField, [], playerTechs);
        return {
            ...harvestResult,
            conflictOccurred: true,
            battleResult: result,
            enemyName: enemy.playerName || 'Enemy Salvager'
        };
    } else {
        // Player lost or draw, drones destroyed
        const survivors = result.finalPlayerArmy[UnitType.SALVAGER_DRONE] || 0;
        return {
            success: false,
            reason: 'LOST_IN_CONFLICT',
            resources: {},
            dronesReturned: survivors,
            conflictOccurred: true,
            battleResult: result,
            enemyName: enemy.playerName || 'Enemy Salvager'
        };
    }
}

async function updateGlobalLootField(field) {
    try {
        if (field.totalValue <= 0) {
            await supabase.from('logistic_loot').delete().eq('id', field.id);
        } else {
            await supabase.from('logistic_loot').update({
                resources: field.resources,
                is_partially_harvested: true,
                harvest_count: field.harvestCount,
                total_value: field.totalValue
            }).eq('id', field.id);
        }
    } catch (e) {
        console.error('[Salvage] Table update failed:', e);
    }
}
