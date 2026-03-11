import { BattleResult, LogisticLootField, ResourceType } from '../../types';
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
} from '../../constants';
import { calculateResourceCost } from './missions';

// ─── Generación de Botín Logístico (Escombros) ──────────────────────────

export const generateLogisticLootFromCombat = (
    battleResult: BattleResult,
    origin: LogisticLootField['origin'],
    battleId: string,
    participants: {
        attackerId: string;
        attackerName: string;
        defenderId: string;
        defenderName: string;
    },
    warId?: string,
    waveNumber?: number
): LogisticLootField | null => {
    
    const now = Date.now();
    
    // Calcular coste de todas las bajas
    const attackerCasualtyResources = calculateResourceCost(battleResult.totalPlayerCasualties);
    const defenderCasualtyResources = calculateResourceCost(battleResult.totalEnemyCasualties);
    
    // Calcular coste de bajas aliadas (si existen)
    let allyCasualtyResources: Record<ResourceType, number> = {
        [ResourceType.MONEY]: 0, [ResourceType.OIL]: 0, [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0, [ResourceType.DIAMOND]: 0
    };
    
    if (battleResult.totalAllyCasualties) {
        for (const allyCasualties of Object.values(battleResult.totalAllyCasualties)) {
            const allyRes = calculateResourceCost(allyCasualties);
            for (const res of Object.keys(allyRes) as ResourceType[]) {
                allyCasualtyResources[res] += allyRes[res];
            }
        }
    }
    
    // Aplicar ratio de escombros SOLO a recursos elegibles
    const debrisResources: Partial<Record<ResourceType, number>> = {};
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
    
    // No generar campo si el valor es insignificante (reducido a 10 para pruebas)
    if (totalValue < 10) return null;
    
    // Calcular expiración según origen
    const expiryMap = {
        'WAR': now + DEBRIS_EXPIRY_WAR_BUFFER_MS + (130 * 60 * 1000), // Fin de guerra + buffer
        'RAID': now + DEBRIS_EXPIRY_RAID_MS,
        'P2P': now + DEBRIS_EXPIRY_P2P_MS,
        'CAMPAIGN': now + DEBRIS_EXPIRY_CAMPAIGN_MS
    };
    
    return {
        id: `logistic-loot-${battleId}-${now}`,
        battleId,
        origin,
        resources: debrisResources,
        createdAt: now,
        expiresAt: expiryMap[origin],
        totalValue,
        attackerId: participants.attackerId,
        attackerName: participants.attackerName,
        defenderId: participants.defenderId,
        defenderName: participants.defenderName,
        isPartiallyHarvested: false,
        harvestedBy: [],
        isP2P: origin === 'P2P',
        p2pBroadcasted: false,
        warId,
        waveNumber
    };
};

// ─── Procesamiento de Tick ────────────────────────────────────────────

export const processLogisticLootTick = (
    lootFields: LogisticLootField[],
    now: number
): { active: LogisticLootField[]; expired: LogisticLootField[]; autoSalvageValue: number } => {
    const active: LogisticLootField[] = [];
    const expired: LogisticLootField[] = [];
    let autoSalvageValue = 0;
    
    for (const field of lootFields) {
        // Eliminar campos vacíos inmediatamente
        if (field.totalValue <= 0) {
            continue;
        }

        if (field.expiresAt <= now) {
            expired.push(field);
            // Auto-salvage: 10% del valor en MONEY va al banco
            autoSalvageValue += Math.floor((field.resources[ResourceType.MONEY] || 0) * 0.10);
        } else {
            active.push(field);
        }
    }
    
    // Limitar campos activos
    while (active.length > DEBRIS_MAX_ACTIVE) {
        const oldest = active.shift();
        if (oldest) {
            expired.push(oldest);
            autoSalvageValue += Math.floor((oldest.resources[ResourceType.MONEY] || 0) * 0.10);
        }
    }
    
    return { active, expired, autoSalvageValue };
};

// ─── Fusión de Botín Logístico de Guerra ────────────────────────────────────

export const mergeWarLogisticLoot = (
    lootFields: LogisticLootField[],
    warId: string
): LogisticLootField | null => {
    const warLoot = lootFields.filter(d => d.warId === warId);
    
    if (warLoot.length === 0) return null;
    
    const merged: Partial<Record<ResourceType, number>> = {};
    let totalValue = 0;
    
    for (const field of warLoot) {
        for (const [res, amount] of Object.entries(field.resources)) {
            merged[res as ResourceType] = (merged[res as ResourceType] || 0) + (amount || 0);
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
        createdAt: now,
        expiresAt: now + DEBRIS_EXPIRY_WAR_BUFFER_MS,
        totalValue,
        attackerId: firstLoot.attackerId,
        attackerName: firstLoot.attackerName,
        defenderId: firstLoot.defenderId,
        defenderName: firstLoot.defenderName,
        isPartiallyHarvested: false,
        harvestedBy: [],
        isP2P: false,
        p2pBroadcasted: false,
        warId
    };
};

// ─── Harvest (recolectar parcialmente) ────────────────────────────────

export const harvestLogisticLootField = (
    field: LogisticLootField,
    droneCount: number,
    cargoCapacityPerDrone: number
): { harvested: Partial<Record<ResourceType, number>>; remaining: LogisticLootField } => {
    const totalCapacity = droneCount * cargoCapacityPerDrone;
    const CARGO_RATES: Record<ResourceType, number> = {
        [ResourceType.MONEY]: 1,
        [ResourceType.OIL]: 10,
        [ResourceType.AMMO]: 5,
        [ResourceType.GOLD]: 50,
        [ResourceType.DIAMOND]: 500
    };
    
    const harvested: Partial<Record<ResourceType, number>> = {};
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
    
    const newField: LogisticLootField = {
        ...field,
        resources: remaining,
        isPartiallyHarvested: true,
        totalValue: Object.values(remaining).reduce((a, b) => a + (b || 0), 0)
    };
    
    return { harvested, remaining: newField };
};
