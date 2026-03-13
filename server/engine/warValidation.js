// ============================================================
// WAR VALIDATION - Mirror of utils/engine/warValidation.ts
// ============================================================

import { UnitType, ResourceType } from './enums.js';
import { 
    WAR_TOTAL_WAVES, WAR_DURATION_MS, WAR_OVERTIME_MS, 
    WAR_WAVE_INTERVAL_MS, SCORE_TO_RESOURCE_VALUE 
} from './constants.js';

export const MAX_WAVE_DELAY_MS = 5 * 60 * 1000;
export const MIN_WAVE_INTERVAL_MS = Math.floor(WAR_WAVE_INTERVAL_MS * 0.5);
export const MAX_WAVE_INTERVAL_MS = Math.floor(WAR_WAVE_INTERVAL_MS * 1.5);
export const MAX_WAVE_NUMBER = 50;
export const MAX_WAR_DURATION_MS = 24 * 60 * 60 * 1000;
export const MIN_WAR_DURATION_MS = 5 * 60 * 1000;
export const MAX_ENEMY_SCORE_RATIO = 10;
export const MIN_ENEMY_SCORE_RATIO = 0.01;

export const isValidResourceRecord = (record) => {
    if (!record || typeof record !== 'object') return false;
    const requiredResources = [ResourceType.MONEY, ResourceType.OIL, ResourceType.AMMO, ResourceType.GOLD, ResourceType.DIAMOND];
    for (const res of requiredResources) if (typeof record[res] !== 'number' || record[res] < 0) return false;
    return true;
};

export const isValidUnitRecord = (record) => {
    if (!record || typeof record !== 'object') return false;
    const unitTypes = Object.values(UnitType);
    for (const [key, value] of Object.entries(record)) {
        if (!unitTypes.includes(key)) return false;
        if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) return false;
    }
    return true;
};

export const isValidWarState = (war) => {
    if (!war) return false;
    if (!war.id || typeof war.id !== 'string') return false;
    if (!war.enemyId || typeof war.enemyId !== 'string') return false;
    if (typeof war.enemyScore !== 'number' || war.enemyScore <= 0) return false;
    if (typeof war.startTime !== 'number' || war.startTime <= 0) return false;
    if (typeof war.duration !== 'number' || war.duration < MIN_WAR_DURATION_MS || war.duration > MAX_WAR_DURATION_MS) return false;
    if (typeof war.currentWave !== 'number' || war.currentWave < 1 || war.currentWave > MAX_WAVE_NUMBER) return false;
    if (!isValidUnitRecord(war.currentEnemyGarrison)) return false;
    return true;
};

export const sanitizeResourceRecord = (record) => {
    const safe = { [ResourceType.MONEY]: 0, [ResourceType.OIL]: 0, [ResourceType.AMMO]: 0, [ResourceType.GOLD]: 0, [ResourceType.DIAMOND]: 0 };
    if (!record || typeof record !== 'object') return safe;
    Object.keys(safe).forEach(key => {
        const value = record[key];
        if (typeof value === 'number' && value >= 0 && Number.isFinite(value)) safe[key] = Math.floor(value);
    });
    return safe;
};

export const sanitizeUnitRecord = (record) => {
    const safe = {};
    if (!record || typeof record !== 'object') return safe;
    const unitTypes = Object.values(UnitType);
    for (const [key, value] of Object.entries(record)) {
        if (unitTypes.includes(key) && typeof value === 'number' && value >= 0 && Number.isFinite(value)) safe[key] = Math.floor(value);
    }
    return safe;
};

export const sanitizeWarState = (war, playerScore) => {
    if (!war) return null;
    const sanitized = { ...war };
    if (!sanitized.id) sanitized.id = `war-repaired-${Date.now()}`;
    if (!sanitized.enemyId) return null;
    if (!sanitized.enemyName) sanitized.enemyName = 'Unknown Enemy';
    
    if (typeof sanitized.enemyScore !== 'number' || sanitized.enemyScore <= 0) sanitized.enemyScore = Math.max(1000, playerScore);
    sanitized.enemyScore = Math.max(playerScore * MIN_ENEMY_SCORE_RATIO, Math.min(playerScore * MAX_ENEMY_SCORE_RATIO, sanitized.enemyScore));

    if (typeof sanitized.duration !== 'number' || sanitized.duration < MIN_WAR_DURATION_MS) sanitized.duration = WAR_DURATION_MS;
    if (typeof sanitized.currentWave !== 'number' || sanitized.currentWave < 1) sanitized.currentWave = 1;
    if (typeof sanitized.totalWaves !== 'number' || sanitized.totalWaves < 1) sanitized.totalWaves = WAR_TOTAL_WAVES;

    sanitized.playerResourceLosses = sanitizeResourceRecord(sanitized.playerResourceLosses);
    sanitized.enemyResourceLosses = sanitizeResourceRecord(sanitized.enemyResourceLosses);
    sanitized.currentEnemyGarrison = sanitizeUnitRecord(sanitized.currentEnemyGarrison);

    return sanitized;
};

export const correctWaveTiming = (war, now) => {
    const corrected = { ...war };
    const expectedNextWaveTime = corrected.startTime + ((corrected.currentWave - 1) * WAR_WAVE_INTERVAL_MS);
    const drift = Math.abs(corrected.nextWaveTime - expectedNextWaveTime);
    const warEndTime = corrected.startTime + corrected.duration;
    
    if (drift > MAX_WAVE_DELAY_MS && now < warEndTime) {
        const dir = corrected.nextWaveTime > expectedNextWaveTime ? -1 : 1;
        corrected.nextWaveTime += dir * Math.min(drift * 0.5, MAX_WAVE_DELAY_MS);
    }
    if (corrected.nextWaveTime > warEndTime) corrected.nextWaveTime = warEndTime;
    return corrected;
};

export const validateWarSystem = (state) => {
    const errors = [];
    const warnings = [];
    if (state.activeWar) {
        if (!isValidWarState(state.activeWar)) {
            errors.push('Active war state is invalid');
        }
    }
    return { valid: errors.length === 0, errors, warnings };
};
