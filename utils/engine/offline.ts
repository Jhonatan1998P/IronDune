import { BUILDING_DEFS } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
import { TECH_DEFS } from '../../data/techs';
import { GameState, ResourceType, TechType, BuildingType, OfflineReport, LogEntry, IncomingAttack, WarState, UnitType } from '../../types';
import { resolveMission } from './missions';
import { calculateTechMultipliers, calculateMaxStorage, calculateProductionRates, calculateUpkeepCosts, calculateMaxBankCapacity } from './modifiers';
import { 
    THREAT_OFFLINE_FACTOR, 
    THREAT_THRESHOLD,
    WAR_TOTAL_WAVES,
    WAR_WAVE_INTERVAL_MS,
    THREAT_PER_DIAMOND_LEVEL_PER_MINUTE,
    WAR_PLAYER_ATTACKS,
    PVP_TRAVEL_TIME_MS,
    OFFLINE_PRODUCTION_LIMIT_MS
} from '../../constants';
import { RankingCategory } from './rankings';
import { distributeWarLoot, generateWarWave, startWar } from './war';
import { simulateCombat } from './combat';

const calculateResourceCost = (units: Partial<Record<UnitType, number>>): Record<ResourceType, number> => {
    const cost: Record<ResourceType, number> = {
        [ResourceType.MONEY]: 0,
        [ResourceType.OIL]: 0,
        [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0,
        [ResourceType.DIAMOND]: 0
    };
    
    Object.entries(units).forEach(([uType, count]) => {
        const def = UNIT_DEFS[uType as UnitType];
        if (def && count) {
            cost[ResourceType.MONEY] += def.cost.money * (count as number);
            cost[ResourceType.OIL] += def.cost.oil * (count as number);
            cost[ResourceType.AMMO] += def.cost.ammo * (count as number);
            if (def.cost.diamond) cost[ResourceType.DIAMOND] += def.cost.diamond * (count as number);
        }
    });
    return cost;
};

interface TimelineEvent {
    time: number;
    type: 'RESEARCH_COMPLETE' | 'MISSION_COMPLETE' | 'CONSTRUCTION_COMPLETE' | 'RECRUITMENT_COMPLETE' | 'WAR_WAVE_HIT';
    id: string;
    data?: any;
}

export const calculateOfflineProgress = (initialState: GameState): { newState: GameState, report: OfflineReport, newLogs: LogEntry[] } => {
    const now = Date.now();
    const timeElapsed = now - initialState.lastSaveTime;
    
    if (timeElapsed < 5000) {
        return { 
            newState: { ...initialState, lastSaveTime: now }, 
            report: createEmptyReport(timeElapsed),
            newLogs: []
        };
    }

    let currentState = JSON.parse(JSON.stringify(initialState)) as GameState;
    if (!currentState.techLevels) currentState.techLevels = {};
    if (currentState.threatLevel === undefined) currentState.threatLevel = 0;
    if (!currentState.incomingAttacks) currentState.incomingAttacks = [];

    const originalResources = { ...initialState.resources };
    const report = createEmptyReport(timeElapsed);
    const newLogs: LogEntry[] = [];

    const events: TimelineEvent[] = [];
    const processedConstructionIds: string[] = [];
    const processedRecruitmentIds: string[] = [];

    if (currentState.activeResearch && currentState.activeResearch.endTime <= now) {
        events.push({ time: currentState.activeResearch.endTime, type: 'RESEARCH_COMPLETE', id: currentState.activeResearch.techId });
    }
    currentState.activeMissions.forEach(mission => {
        if (mission.endTime <= now) {
            events.push({ time: mission.endTime, type: 'MISSION_COMPLETE', id: mission.id });
        }
    });
    currentState.activeConstructions.forEach(c => {
        if (c.endTime <= now) {
            events.push({ time: c.endTime, type: 'CONSTRUCTION_COMPLETE', id: c.id, data: c });
        }
    });
    currentState.activeRecruitments.forEach(r => {
        if (r.endTime <= now) {
            events.push({ time: r.endTime, type: 'RECRUITMENT_COMPLETE', id: r.id, data: r });
        }
    });

    if (currentState.activeWar) {
        let nextTime = currentState.activeWar.nextWaveTime;
        let waveNum = currentState.activeWar.currentWave;
        // Use the saved totalWaves. If overtime happens, the online loop will catch it at the boundary.
        const maxWaves = currentState.activeWar.totalWaves; 

        // CRITICAL FIX: Only generate waves strictly within the defined Total Waves cap.
        // Do NOT simulate Overtime decision here. Let the game loop handle the "End of War" check naturally.
        while (nextTime <= now && waveNum <= maxWaves) {
            const wave = generateWarWave(currentState, waveNum, currentState.activeWar, nextTime);
            
            events.push({
                time: nextTime,
                type: 'WAR_WAVE_HIT',
                id: `retro-wave-${waveNum}`,
                data: { wave, waveNum }
            });

            nextTime += WAR_WAVE_INTERVAL_MS;
            waveNum++;
        }
    } 
    else {
        const diamondLevel = currentState.buildings[BuildingType.DIAMOND_MINE]?.level || 0;
        
        if (diamondLevel > 0) {
            const growthPerMinute = (diamondLevel * THREAT_PER_DIAMOND_LEVEL_PER_MINUTE) * THREAT_OFFLINE_FACTOR;
            const minutesPassed = timeElapsed / 60000;
            currentState.threatLevel = Math.min(100, currentState.threatLevel + (growthPerMinute * minutesPassed));
        }
    }

    events.sort((a, b) => a.time - b.time);

    let simulationTime = currentState.lastSaveTime;
    let accumulatedEconomyTime = 0; // Track how much production has occurred
    
    events.push({ time: now, type: 'RESEARCH_COMPLETE', id: 'FINAL_TICK' }); 

    for (const event of events) {
        if (event.time <= simulationTime) continue; 

        const deltaTime = event.time - simulationTime;
        
        // --- PRODUCTION CAP LOGIC ---
        // Calculate remaining budget for resource generation/upkeep
        const remainingCap = Math.max(0, OFFLINE_PRODUCTION_LIMIT_MS - accumulatedEconomyTime);
        // Effective time is the smaller of: actual gap OR remaining budget
        const effectiveEconomyTime = Math.min(deltaTime, remainingCap);

        // Process chunk with effective time for Economy (Resources/Bank)
        currentState = processChunk(currentState, effectiveEconomyTime, report);
        
        accumulatedEconomyTime += effectiveEconomyTime;

        if (event.id !== 'FINAL_TICK') {
            
            if (event.type === 'WAR_WAVE_HIT') {
                if (currentState.activeWar) {
                    const { wave, waveNum } = event.data;
                    
                    const result = simulateCombat(currentState.units, wave.units, 1.0);
                    
                    currentState.units = result.finalPlayerArmy as Record<UnitType, number>;

                    const pResLoss = calculateResourceCost(result.totalPlayerCasualties);
                    const eResLoss = calculateResourceCost(result.totalEnemyCasualties);
                    const pLostCount = Object.values(result.totalPlayerCasualties).reduce((a:any, b:any) => a + b, 0) as number;
                    const eLostCount = Object.values(result.totalEnemyCasualties).reduce((a:any, b:any) => a + b, 0) as number;

                    currentState.activeWar.playerUnitLosses += pLostCount;
                    currentState.activeWar.enemyUnitLosses += eLostCount;
                    
                    Object.keys(pResLoss).forEach(k => {
                        const r = k as ResourceType;
                        currentState.activeWar!.playerResourceLosses[r] += pResLoss[r];
                        currentState.activeWar!.enemyResourceLosses[r] += eResLoss[r];
                        
                        currentState.activeWar!.lootPool[r] += (pResLoss[r] + eResLoss[r]);
                    });

                    if (result.winner === 'PLAYER') {
                        currentState.activeWar.playerVictories++;
                        newLogs.push({
                            id: `off-war-win-${waveNum}-${event.time}`,
                            messageKey: 'log_defense_win',
                            type: 'combat',
                            timestamp: event.time,
                            params: { combatResult: result, attacker: wave.attackerName }
                        });
                    } else {
                        currentState.activeWar.enemyVictories++;
                        newLogs.push({
                            id: `off-war-loss-${waveNum}-${event.time}`,
                            messageKey: 'log_defense_loss',
                            type: 'combat',
                            timestamp: event.time,
                            params: { combatResult: result, attacker: wave.attackerName }
                        });
                    }

                    currentState.activeWar.currentWave = waveNum + 1;
                    currentState.activeWar.nextWaveTime = event.time + WAR_WAVE_INTERVAL_MS;
                }
            }
            else if (event.type === 'RESEARCH_COMPLETE') {
                if (currentState.activeResearch && currentState.activeResearch.techId === event.id) {
                    const techId = event.id as TechType;
                    currentState.techLevels[techId] = (currentState.techLevels[techId] || 0) + 1;
                    if (!currentState.researchedTechs.includes(techId)) currentState.researchedTechs.push(techId);
                    report.completedResearch.push(techId);
                    currentState.activeResearch = null;
                }
            } 
            else if (event.type === 'MISSION_COMPLETE') {
                const missionIndex = currentState.activeMissions.findIndex(m => m.id === event.id);
                if (missionIndex !== -1) {
                    const mission = currentState.activeMissions[missionIndex];
                    currentState.activeMissions.splice(missionIndex, 1);
                    
                    const outcome = resolveMission(
                        mission, 
                        currentState.resources, 
                        currentState.maxResources, 
                        currentState.campaignProgress, 
                        currentState.techLevels, 
                        currentState.activeWar, 
                        simulationTime, 
                        currentState.rankingData.bots,
                        currentState.empirePoints // Passed empire points
                    );
                    
                    Object.assign(currentState.resources, outcome.resources);
                    Object.entries(outcome.unitsToAdd).forEach(([uType, qty]) => {
                        currentState.units[uType as UnitType] = (currentState.units[uType as UnitType] || 0) + (qty as number);
                    });

                    if (currentState.activeWar && outcome.warLootAdded) {
                        Object.entries(outcome.warLootAdded).forEach(([r, v]) => {
                            currentState.activeWar!.lootPool[r as ResourceType] += v;
                        });
                        if (outcome.warVictory) currentState.activeWar.playerVictories++;
                        if (outcome.warDefeat) currentState.activeWar.enemyVictories++;
                    }

                    if (mission.type === 'CAMPAIGN_ATTACK') {
                        currentState.lastCampaignMissionFinishedTime = event.time;
                        if (outcome.newCampaignProgress) currentState.campaignProgress = Math.max(currentState.campaignProgress, outcome.newCampaignProgress);
                    }

                    report.completedMissions.push({ id: mission.id, success: outcome.logKey === 'log_battle_win', loot: outcome.logParams?.loot || {} });
                    
                    newLogs.push({
                        id: `off-mis-${mission.id}`,
                        messageKey: outcome.logKey,
                        type: outcome.logType,
                        timestamp: event.time,
                        params: outcome.logParams
                    });
                }
            }
            else if (event.type === 'CONSTRUCTION_COMPLETE') {
                const c = event.data;
                const currentLvl = currentState.buildings[c.buildingType as BuildingType].level;
                currentState.buildings[c.buildingType as BuildingType].level = currentLvl + c.count;
                processedConstructionIds.push(c.id);
            }
            else if (event.type === 'RECRUITMENT_COMPLETE') {
                const r = event.data;
                currentState.units[r.unitType as UnitType] = (currentState.units[r.unitType as UnitType] || 0) + r.count;
                processedRecruitmentIds.push(r.id);
            }
        }

        simulationTime = event.time;
    }

    currentState.activeConstructions = currentState.activeConstructions.filter(c => !processedConstructionIds.includes(c.id));
    currentState.activeRecruitments = currentState.activeRecruitments.filter(r => !processedRecruitmentIds.includes(r.id));

    Object.keys(currentState.resources).forEach(k => {
        const r = k as ResourceType;
        report.resourcesGained[r] = currentState.resources[r] - originalResources[r];
    });

    if (currentState.incomingAttacks && currentState.incomingAttacks.length > 0) {
        const minArrivalTime = now + 60000;
        currentState.incomingAttacks = currentState.incomingAttacks.filter(a => !a.isWarWave).map(attack => {
            if (attack.endTime < minArrivalTime) {
                return { ...attack, endTime: minArrivalTime };
            }
            return attack;
        });
    }

    if (currentState.activeWar) {
        // Filter out old waves that were processed offline
        currentState.incomingAttacks = currentState.incomingAttacks.filter(a => !a.isWarWave);
        
        // Final State Check: The game loop (calculateNextTick) will handle the War End / Overtime transition 
        // on the very first frame online. We do NOT simulate the final resolution here to avoid logic duplication.
        // However, if we are still mid-war, we queue the NEXT wave if applicable.
        
        if (now < currentState.activeWar.startTime + currentState.activeWar.duration) {
             if (currentState.activeWar.currentWave <= currentState.activeWar.totalWaves) {
                const nextWave = generateWarWave(
                    currentState, 
                    currentState.activeWar.currentWave, 
                    currentState.activeWar, 
                    currentState.activeWar.nextWaveTime 
                );
                currentState.incomingAttacks.push(nextWave);
            }
        }
    }

    let points = 0;
    (Object.keys(currentState.buildings) as BuildingType[]).forEach((bType) => {
        const qty = currentState.buildings[bType].level;
        const def = BUILDING_DEFS[bType];
        if (qty > 0) points += qty * (def.score || 0);
    });
    (Object.keys(currentState.units) as UnitType[]).forEach((uType) => {
        const count = currentState.units[uType];
        if (count > 0) {
             const def = UNIT_DEFS[uType];
             points += count * (def.score || 0);
        }
    });
    currentState.researchedTechs.forEach(techId => {
        const def = TECH_DEFS[techId];
        points += (def.score || 0);
    });
    points += Math.floor(currentState.bankBalance / 100000);
    currentState.empirePoints = points;

    const finalMultipliers = calculateTechMultipliers(currentState.researchedTechs, currentState.techLevels);
    currentState.maxResources = calculateMaxStorage(currentState.buildings, finalMultipliers, currentState.empirePoints);

    currentState.lastSaveTime = now;

    return { newState: currentState, report, newLogs };
};

const processChunk = (state: GameState, durationMs: number, report: OfflineReport): GameState => {
    const minutes = durationMs / 60000;
    const seconds = durationMs / 1000;
    
    if (seconds <= 0) return state;

    const multipliers = calculateTechMultipliers(state.researchedTechs, state.techLevels);
    state.maxResources = calculateMaxStorage(state.buildings, multipliers, state.empirePoints);

    const productionRates = calculateProductionRates(state.buildings, multipliers);
    const upkeepCosts = calculateUpkeepCosts(state.units);

    const bankLevel = state.buildings[BuildingType.BANK].level;
    if (state.bankBalance > 0 && bankLevel > 0) {
        const maxBankBalance = calculateMaxBankCapacity(state.empirePoints, bankLevel);
        if (state.bankBalance < maxBankBalance) {
            const minuteRate = state.currentInterestRate / 360; 
            const interestEarned = state.bankBalance * minuteRate * minutes;
            const oldBalance = state.bankBalance;
            state.bankBalance = Math.min(maxBankBalance, state.bankBalance + interestEarned);
            report.bankInterestEarned += (state.bankBalance - oldBalance);
        }
    }

    Object.values(ResourceType).forEach((res) => {
        let prod = (productionRates[res] || 0) * seconds;
        const upkeep = (upkeepCosts[res] || 0) * seconds;
        const netChange = prod - upkeep;
        state.resources[res] = Math.max(0, Math.min(state.maxResources[res], state.resources[res] + netChange));
    });

    return state;
};

const createEmptyReport = (time: number): OfflineReport => ({
    timeElapsed: time,
    resourcesGained: {
        [ResourceType.MONEY]: 0,
        [ResourceType.OIL]: 0,
        [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0,
        [ResourceType.DIAMOND]: 0
    },
    bankInterestEarned: 0,
    completedResearch: [],
    completedMissions: []
});