// ============================================================
// LOGISTIC LOOT ENGINE - Mirror of utils/engine/logisticLoot.ts
// ============================================================

import { ResourceType, UnitType } from './enums.js';
import {
    DEBRIS_RATIO_ATTACKER,
    DEBRIS_RATIO_DEFENDER,
    DEBRIS_RATIO_ALLY,
    DEBRIS_ELIGIBLE_RESOURCES,
    DEBRIS_EXPIRY_RAID_MS,
    DEBRIS_EXPIRY_WAR_BUFFER_MS,
    DEBRIS_EXPIRY_P2P_MS,
    DEBRIS_EXPIRY_CAMPAIGN_MS,
    DEBRIS_MAX_ACTIVE
} from './constants.js';
import { calculateResourceCost } from './missions.js';
import { supabase } from '../db/lib/supabase.js';

export const saveGlobalLoot = async (loot) => {
    try {
        // Transform camelCase to snake_case for PostgreSQL
        const dbLoot = {
            battle_id: loot.battleId,
            origin: loot.origin,
            resources: loot.resources,
            initial_resources: loot.initialResources,
            attacker_id: loot.attackerId,
            attacker_name: loot.attackerName,
            defender_id: loot.defenderId,
            defender_name: loot.defenderName,
            is_partially_harvested: loot.isPartiallyHarvested,
            harvest_count: loot.harvestCount,
            total_value: loot.totalValue,
            expires_at: new Date(loot.expiresAt).toISOString(),
            war_id: loot.warId,
            wave_number: loot.waveNumber
        };

        await supabase
            .from('salvage_fields')
            .insert(dbLoot);
            
        console.log(`[LogisticLoot] New global loot entry created from ${loot.origin}`);
    } catch (e) {
        console.error('[LogisticLoot] Failed to save global loot to table:', e);
    }
};

export const generateLogisticLootFromCombat = (
    battleResult,
    origin,
    battleId,
    participants,
    warId,
    waveNumber
) => {
    const now = Date.now();
    
    // Camp misiones de campaña no generan botín logístico por diseño
    if (origin === 'CAMPAIGN') return null;
    
    // Calcular coste de todas las bajas
    const attackerCasualtyResources = calculateResourceCost(battleResult.totalPlayerCasualties);
    const defenderCasualtyResources = calculateResourceCost(battleResult.totalEnemyCasualties);
    
    // Calcular coste de bajas aliadas
    let allyCasualtyResources = {
        [ResourceType.MONEY]: 0, [ResourceType.OIL]: 0, [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0, [ResourceType.DIAMOND]: 0
    };
    
    if (battleResult.totalAllyCasualties) {
        for (const allyCasualties of Object.values(battleResult.totalAllyCasualties)) {
            const allyRes = calculateResourceCost(allyCasualties);
            for (const res of Object.keys(allyRes)) {
                allyCasualtyResources[res] = (allyCasualtyResources[res] || 0) + (allyRes[res] || 0);
            }
        }
    }
    
    // Aplicar ratio de escombros SOLO a recursos elegibles
    const debrisResources = {};
    let totalValue = 0;
    
    for (const res of DEBRIS_ELIGIBLE_RESOURCES) {
        const fromAttacker = Math.floor((attackerCasualtyResources[res] || 0) * DEBRIS_RATIO_ATTACKER);
        const fromDefender = Math.floor((defenderCasualtyResources[res] || 0) * DEBRIS_RATIO_DEFENDER);
        const fromAllies = Math.floor((allyCasualtyResources[res] || 0) * DEBRIS_RATIO_ALLY);
        
        const total = fromAttacker + fromDefender + fromAllies;
        if (total > 0) {
            debrisResources[res] = total;
            totalValue += total;
        }
    }
    
    if (totalValue < 10) return null;
    
    const expiryMap = {
        'WAR': now + DEBRIS_EXPIRY_WAR_BUFFER_MS + (130 * 60 * 1000),
        'RAID': now + DEBRIS_EXPIRY_RAID_MS,
        'P2P': now + DEBRIS_EXPIRY_P2P_MS,
        'CAMPAIGN': now + DEBRIS_EXPIRY_CAMPAIGN_MS
    };
    
    return {
        id: `logistic-loot-${battleId}-${now}`,
        battleId,
        origin,
        resources: debrisResources,
        initialResources: { ...debrisResources },
        createdAt: now,
        expiresAt: expiryMap[origin],
        totalValue,
        attackerId: participants.attackerId,
        attackerName: participants.attackerName,
        defenderId: participants.defenderId,
        defenderName: participants.defenderName,
        isPartiallyHarvested: false,
        harvestedBy: [],
        harvestCount: 0,
        isP2P: origin === 'P2P',
        p2pBroadcasted: false,
        warId,
        waveNumber
    };
};

export const processLogisticLootTick = (lootFields, now) => {
    const active = [];
    const expired = [];
    let autoSalvageValue = 0;
    
    for (const field of lootFields) {
        if (field.totalValue <= 0) continue;

        if (field.expiresAt <= now) {
            expired.push(field);
            autoSalvageValue += Math.floor((field.resources[ResourceType.MONEY] || 0) * 0.10);
        } else {
            active.push(field);
        }
    }
    
    while (active.length > DEBRIS_MAX_ACTIVE) {
        const oldest = active.shift();
        if (oldest) {
            expired.push(oldest);
            autoSalvageValue += Math.floor((oldest.resources[ResourceType.MONEY] || 0) * 0.10);
        }
    }
    
    return { active, expired, autoSalvageValue };
};

export const mergeWarLogisticLoot = (lootFields, warId) => {
    const warLoot = lootFields.filter(d => d.warId === warId);
    if (warLoot.length === 0) return null;
    
    const merged = {};
    let totalValue = 0;
    
    for (const field of warLoot) {
        for (const [res, amount] of Object.entries(field.resources)) {
            merged[res] = (merged[res] || 0) + (amount || 0);
            totalValue += amount || 0;
        }
    }
    
    const now = Date.now();
    const firstLoot = warLoot[0];
    
    return {
        id: `mega-logistic-loot-${warId}-${now}`,
        battleId: warId,
        origin: 'WAR',
        resources: merged,
        initialResources: { ...merged },
        createdAt: now,
        expiresAt: now + DEBRIS_EXPIRY_WAR_BUFFER_MS,
        totalValue,
        attackerId: firstLoot.attackerId,
        attackerName: firstLoot.attackerName,
        defenderId: firstLoot.defenderId,
        defenderName: firstLoot.defenderName,
        isPartiallyHarvested: false,
        harvestedBy: [],
        harvestCount: 0,
        isP2P: false,
        p2pBroadcasted: false,
        warId
    };
};

export const harvestLogisticLootField = (field, droneCount, cargoCapacityPerDrone) => {
    const totalCapacity = droneCount * cargoCapacityPerDrone;
    const CARGO_RATES = {
        [ResourceType.MONEY]: 1,
        [ResourceType.OIL]: 10,
        [ResourceType.AMMO]: 5,
        [ResourceType.GOLD]: 50,
        [ResourceType.DIAMOND]: 500
    };
    
    const harvested = {};
    let used = 0;
    const remaining = { ...field.resources };
    
    for (const res of DEBRIS_ELIGIBLE_RESOURCES) {
        const available = remaining[res] || 0;
        if (available <= 0) continue;
        
        const rate = CARGO_RATES[res];
        const maxCanTake = Math.floor((totalCapacity - used) / rate);
        const toTake = Math.min(available, maxCanTake);
        
        if (toTake > 0) {
            harvested[res] = toTake;
            remaining[res] = available - toTake;
            used += toTake * rate;
        }
        if (used >= totalCapacity) break;
    }
    
    return {
        harvested,
        remaining: {
            ...field,
            resources: remaining,
            isPartiallyHarvested: true,
            totalValue: Object.values(remaining).reduce((a, b) => a + (b || 0), 0)
        }
    };
};
