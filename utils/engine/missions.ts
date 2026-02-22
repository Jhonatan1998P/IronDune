
import { ActiveMission, LogEntry, ResourceType, TechType, UnitType, WarState, UnitPerformanceStats, BuildingType } from '../../types';
import { CAMPAIGN_LEVELS } from '../../data/campaigns';
import { UNIT_DEFS } from '../../data/units';
import { simulateCombat } from './combat';
import { PVP_LOOT_FACTOR, WAR_PLAYER_ATTACKS, SCORE_TO_RESOURCE_VALUE, BOT_BUDGET_RATIO, TIER_THRESHOLDS, PLUNDERABLE_BUILDINGS, PLUNDER_RATES } from '../../constants';
import { BASE_PRICES, calculateTotalUnitCost } from './market';
import { calculateRetaliationTime } from './nemesis';
import { BotPersonality } from '../../types/enums';
import { StaticBot } from './rankings';

export const calculateResourceCost = (units: Partial<Record<UnitType, number>>): Record<ResourceType, number> => {
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

const calculateUnitCP = (uType: UnitType): number => {
    const def = UNIT_DEFS[uType];
    const moneyVal = def.cost.money * BASE_PRICES[ResourceType.MONEY];
    const oilVal = def.cost.oil * BASE_PRICES[ResourceType.OIL];
    const ammoVal = def.cost.ammo * BASE_PRICES[ResourceType.AMMO];
    const goldVal = (def.cost.diamond || 0) * BASE_PRICES[ResourceType.DIAMOND]; 
    return moneyVal + oilVal + ammoVal + goldVal;
};

const UNITS_BY_TIER = {
    1: [UnitType.CYBER_MARINE, UnitType.SCOUT_TANK, UnitType.AEGIS_DESTROYER],
    2: [UnitType.HEAVY_COMMANDO, UnitType.TITAN_MBT, UnitType.WRAITH_GUNSHIP],
    3: [UnitType.ACE_FIGHTER, UnitType.PHANTOM_SUB, UnitType.TITAN_MBT, UnitType.WRAITH_GUNSHIP],
    4: [UnitType.PHANTOM_SUB, UnitType.ACE_FIGHTER]
};

const getAvailableUnitsForScore = (score: number): UnitType[] => {
    let pool: UnitType[] = [...UNITS_BY_TIER[1]];
    
    if (score >= TIER_THRESHOLDS.TIER_1) {
        pool = [...pool, ...UNITS_BY_TIER[2]];
    }
    if (score >= TIER_THRESHOLDS.TIER_2) {
        pool = [...pool, ...UNITS_BY_TIER[3]];
    }
    if (score >= TIER_THRESHOLDS.TIER_3) {
        pool = [...pool, ...UNITS_BY_TIER[4]];
    }
    
    return pool;
};

const UNIT_POOLS = {
    MASS: [UnitType.CYBER_MARINE, UnitType.SCOUT_TANK, UnitType.AEGIS_DESTROYER],
    SUPPORT: [UnitType.HEAVY_COMMANDO, UnitType.TITAN_MBT, UnitType.WRAITH_GUNSHIP, UnitType.CYBER_MARINE],
    DEFENSIVE: [UnitType.TITAN_MBT, UnitType.AEGIS_DESTROYER, UnitType.SCOUT_TANK, UnitType.HEAVY_COMMANDO],
    ELITE: [UnitType.TITAN_MBT, UnitType.PHANTOM_SUB, UnitType.AEGIS_DESTROYER, UnitType.WRAITH_GUNSHIP, UnitType.ACE_FIGHTER],
    ASSASSIN: [UnitType.HEAVY_COMMANDO, UnitType.PHANTOM_SUB, UnitType.WRAITH_GUNSHIP, UnitType.ACE_FIGHTER],
    FAST: [UnitType.SCOUT_TANK, UnitType.WRAITH_GUNSHIP, UnitType.ACE_FIGHTER, UnitType.AEGIS_DESTROYER, UnitType.HEAVY_COMMANDO]
};

const spendBudgetOnPool = (
    budget: number, 
    pool: UnitType[], 
    army: Partial<Record<UnitType, number>>
) => {
    if (pool.length === 0 || budget < 50000) return;

    let remainingBudget = budget;
    let safetyCounter = 0;

    while (remainingBudget > 50000 && safetyCounter < 200) {
        safetyCounter++;
        
        const uType = pool[Math.floor(Math.random() * pool.length)];
        const unitCost = calculateUnitCP(uType);

        if (unitCost > remainingBudget) continue;

        const spendChunk = Math.max(unitCost, remainingBudget * (0.05 + Math.random() * 0.10));
        const count = Math.max(1, Math.floor(spendChunk / unitCost));

        army[uType] = (army[uType] || 0) + count;
        remainingBudget -= (count * unitCost);
    }
};

export const generateBotArmy = (
    targetScore: number, 
    budgetMultiplier: number = 1.0, 
    personality: BotPersonality = BotPersonality.TYCOON
): Partial<Record<UnitType, number>> => {
    
    const totalBudget = targetScore * 1500 * budgetMultiplier;

    const allowedUnits = getAvailableUnitsForScore(targetScore);
    
    const army: Partial<Record<UnitType, number>> = {};

    let buckets: { poolName: keyof typeof UNIT_POOLS | 'ALL', ratio: number }[] = [];

    switch (personality) {
        case BotPersonality.WARLORD:
            buckets = [
                { poolName: 'MASS', ratio: 0.7 },
                { poolName: 'SUPPORT', ratio: 0.3 }
            ];
            break;
        case BotPersonality.ROGUE:
            buckets = [
                { poolName: 'ASSASSIN', ratio: 0.5 },
                { poolName: 'FAST', ratio: 0.5 }
            ];
            break;
        case BotPersonality.TURTLE:
            buckets = [
                { poolName: 'DEFENSIVE', ratio: 0.6 },
                { poolName: 'SUPPORT', ratio: 0.4 }
            ];
            break;
        case BotPersonality.TYCOON:
        default:
            buckets = [
                { poolName: 'ELITE', ratio: 1.0 }
            ];
            break;
    }

    buckets.forEach(bucket => {
        const bucketBudget = totalBudget * bucket.ratio;
        
        let poolUnits: UnitType[] = [];
        
        if (bucket.poolName === 'ALL') {
            poolUnits = allowedUnits;
        } else {
            const definition = UNIT_POOLS[bucket.poolName];
            poolUnits = allowedUnits.filter(u => definition.includes(u));
        }

        if (poolUnits.length === 0) {
            poolUnits = allowedUnits;
        }

        if (personality === BotPersonality.TYCOON) {
            poolUnits.sort((a, b) => calculateUnitCP(b) - calculateUnitCP(a));
            const cutoff = Math.ceil(poolUnits.length * 0.5);
            poolUnits = poolUnits.slice(0, cutoff);
        }

        spendBudgetOnPool(bucketBudget, poolUnits, army);
    });

    if (Object.keys(army).length === 0) {
        army[UnitType.CYBER_MARINE] = Math.max(1, Math.floor(totalBudget / calculateUnitCP(UnitType.CYBER_MARINE)));
    }

    return army;
};

export const generateBotBuildings = (score: number): Partial<Record<BuildingType, number>> => {
    const totalBuildings = Math.max(10, Math.floor(score / 10));
    
    const weights = {
        [BuildingType.HOUSE]: 50,
        [BuildingType.FACTORY]: 20,
        [BuildingType.OIL_RIG]: 10,
        [BuildingType.MUNITIONS_FACTORY]: 10,
        [BuildingType.GOLD_MINE]: 8,
        [BuildingType.SKYSCRAPER]: 2
    };

    const buildings: Partial<Record<BuildingType, number>> = {};
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

    let remaining = totalBuildings;
    
    PLUNDERABLE_BUILDINGS.forEach(bType => {
        const weight = weights[bType as keyof typeof weights] || 0;
        const count = Math.floor(totalBuildings * (weight / totalWeight));
        buildings[bType] = count;
        remaining -= count;
    });

    buildings[BuildingType.HOUSE] = (buildings[BuildingType.HOUSE] || 0) + remaining;

    return buildings;
};

export const generateEnemyForce = (playerUnits: Partial<Record<UnitType, number>>, patrolLevel: number = 1, isAmbush: boolean = false): Partial<Record<UnitType, number>> => {
    // 1. Calculate Monetary Value of Patrol
    const playerBudget = calculateTotalUnitCost(playerUnits);
    if (playerBudget <= 0) return { [UnitType.CYBER_MARINE]: 1 };

    // 2. Scale enemy force. Ambush is significantly stronger.
    const baseMultiplier = isAmbush ? (1.2 + (patrolLevel * 0.15)) : (0.4 + (patrolLevel * 0.15));
    const enemyBudget = playerBudget * baseMultiplier;

    // Convert budget back to faux "Score" for bot generation
    const targetScore = Math.max(10, enemyBudget / SCORE_TO_RESOURCE_VALUE);

    // Generate army using the Warlord profile (Aggressive)
    return generateBotArmy(targetScore, 1.0, BotPersonality.WARLORD);
};

const getPatrolLevel = (duration: number): number => {
    if (duration <= 5) return 1;
    if (duration <= 15) return 2;
    if (duration <= 30) return 3;
    return 4; 
};

export const resolveMission = (
    mission: ActiveMission, 
    currentResources: Record<ResourceType, number>, 
    maxResources: Record<ResourceType, number>,
    currentCampaignProgress: number,
    techLevels: Partial<Record<TechType, number>> = {},
    activeWar: WarState | null = null,
    now: number = Date.now(),
    rankingBots: StaticBot[] = [],
    empirePoints: number = 0,
    buildings: Record<BuildingType, { level: number }> = {} as any,
    attackCounts: Record<string, number> = {}
): { 
    resources: Record<ResourceType, number>, 
    unitsToAdd: Partial<Record<UnitType, number>>,
    buildingsToAdd?: Partial<Record<BuildingType, number>>,
    logKey: string,
    logType: LogEntry['type'],
    logParams: any, 
    newCampaignProgress?: number,
    warLootAdded?: Partial<Record<ResourceType, number>>, 
    warVictory?: boolean,
    warDefeat?: boolean,
    newGrudge?: any
} => {
    
    let resultResources = { ...currentResources };
    let unitsToReturn: Partial<Record<UnitType, number>> = {};
    let buildingsToAdd: Partial<Record<BuildingType, number>> = {};
    let logKey = '';
    let logType: LogEntry['type'] = 'mission'; 
    let logParams: any = {};
    let newCampaignProgress = currentCampaignProgress;
    
    let warLootAdded: Partial<Record<ResourceType, number>> | undefined;
    let warVictory = false;
    let warDefeat = false;
    let newGrudge: any = undefined;

    if (mission.type === 'PVP_ATTACK' && mission.targetScore !== undefined) {
        
        let personality = BotPersonality.TYCOON;
        const targetBot = rankingBots.find(b => b.id === mission.targetId);
        if (targetBot) personality = targetBot.personality;

        let botArmy: Partial<Record<UnitType, number>> = {};
        const isWarAttack = mission.isWarAttack && activeWar && (activeWar.enemyId === mission.targetId);

        if (isWarAttack && activeWar) {
            const attackNum = WAR_PLAYER_ATTACKS - activeWar.playerAttacksLeft + 1;
            
            if (attackNum === 6) {
                const fullBudgetMultiplier = 1.0 / BOT_BUDGET_RATIO;
                botArmy = generateBotArmy(mission.targetScore, fullBudgetMultiplier, personality);
            } else {
                botArmy = activeWar.currentEnemyGarrison || {};
            }
        } else {
            botArmy = generateBotArmy(mission.targetScore, 1.0, personality);
        }

        const battleResult = simulateCombat(mission.units, botArmy, 1.0);
        
        logType = 'combat';
        unitsToReturn = battleResult.finalPlayerArmy;

        if (isWarAttack && activeWar) {
            activeWar.currentEnemyGarrison = battleResult.finalEnemyArmy;

            const pResLoss = calculateResourceCost(battleResult.totalPlayerCasualties);
            const eResLoss = calculateResourceCost(battleResult.totalEnemyCasualties);
            
            Object.keys(pResLoss).forEach(k => {
                const r = k as ResourceType;
                activeWar.playerResourceLosses[r] += pResLoss[r];
                activeWar.enemyResourceLosses[r] += eResLoss[r];
            });
            
            const pCount = Object.values(battleResult.totalPlayerCasualties).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
            const eCount = Object.values(battleResult.totalEnemyCasualties).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
            
            activeWar.playerUnitLosses += pCount;
            activeWar.enemyUnitLosses += eCount;

            warLootAdded = {
                [ResourceType.MONEY]: pResLoss[ResourceType.MONEY] + eResLoss[ResourceType.MONEY],
                [ResourceType.OIL]: pResLoss[ResourceType.OIL] + eResLoss[ResourceType.OIL],
                [ResourceType.AMMO]: pResLoss[ResourceType.AMMO] + eResLoss[ResourceType.AMMO],
                [ResourceType.GOLD]: pResLoss[ResourceType.GOLD] + eResLoss[ResourceType.GOLD],
                [ResourceType.DIAMOND]: pResLoss[ResourceType.DIAMOND] + eResLoss[ResourceType.DIAMOND]
            };
        }

        if (battleResult.winner === 'PLAYER') {
            logKey = 'log_battle_win'; 
            
            if (isWarAttack) {
                warVictory = true;
                logParams = { combatResult: battleResult, targetName: mission.targetName };
            } else {
                const count = (attackCounts[mission.targetId || ''] || 1) - 1;
                const safeCount = Math.max(0, Math.min(count, 2)); 
                
                const plunderPercentage = PLUNDER_RATES[safeCount];
                
                const botBuildings = generateBotBuildings(mission.targetScore);
                
                const stolenBuildings: Partial<Record<BuildingType, number>> = {};
                
                PLUNDERABLE_BUILDINGS.forEach(bType => {
                    const totalQty = botBuildings[bType] || 0;
                    
                    let baseForCalculation = totalQty;
                    if (safeCount === 1) baseForCalculation = Math.floor(totalQty * (1 - PLUNDER_RATES[0]));
                    if (safeCount === 2) {
                        const afterFirst = Math.floor(totalQty * (1 - PLUNDER_RATES[0]));
                        baseForCalculation = Math.floor(afterFirst * (1 - PLUNDER_RATES[1]));
                    }

                    const stolenAmount = Math.floor(baseForCalculation * plunderPercentage);
                    
                    if (stolenAmount > 0) {
                        stolenBuildings[bType] = stolenAmount;
                        buildingsToAdd[bType] = stolenAmount;
                    }
                });

                logParams = { 
                    combatResult: battleResult, 
                    buildingLoot: stolenBuildings, 
                    loot: {}, 
                    targetName: mission.targetName 
                };

                if (targetBot) {
                    newGrudge = {
                        id: `grudge-${now}`,
                        botId: targetBot.id,
                        botName: targetBot.name,
                        botPersonality: targetBot.personality,
                        botScore: targetBot.stats.DOMINION,
                        createdAt: now,
                        retaliationTime: calculateRetaliationTime(targetBot.personality, now),
                        notified: false
                    };
                }
            }
        } else {
            logKey = 'log_battle_loss';
            const survivorsCount = Object.values(battleResult.finalPlayerArmy).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
            if (survivorsCount === 0) logKey = 'log_wipeout';
            
            if (isWarAttack) {
                warDefeat = true; 
            }

            logParams = { combatResult: battleResult, targetName: mission.targetName };
        }

        return { resources: resultResources, unitsToAdd: unitsToReturn, buildingsToAdd, logKey, logType, logParams, newCampaignProgress, warLootAdded, warVictory, warDefeat, newGrudge };
    }

    if (mission.type === 'CAMPAIGN_ATTACK' && mission.levelId) {
        const level = CAMPAIGN_LEVELS.find(l => l.id === mission.levelId);
        const initialEnemyForces = level ? level.enemyArmy : {};
        const battleResult = simulateCombat(mission.units, initialEnemyForces, 1.0);
        
        logType = 'combat';
        logParams = { 
            combatResult: battleResult, 
            loot: {},
            targetName: `OP-${mission.levelId}` 
        };
        unitsToReturn = battleResult.finalPlayerArmy;

        if (battleResult.winner === 'PLAYER') {
            logKey = 'log_battle_win';
            
            if (level) {
               Object.entries(level.reward).forEach(([r, qty]) => {
                   const res = r as ResourceType;
                   resultResources[res] = Math.min(maxResources[res], resultResources[res] + (qty as number));
               });
               logParams.loot = level.reward;

               if (mission.levelId === currentCampaignProgress) {
                   newCampaignProgress = mission.levelId + 1;
               }
           }
        } else {
            logKey = 'log_battle_loss';
            const survivorsCount = Object.values(battleResult.finalPlayerArmy).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
            if (survivorsCount === 0) logKey = 'log_wipeout';
        }
        
        return { resources: resultResources, unitsToAdd: unitsToReturn, logKey, logType, logParams, newCampaignProgress };
    }

    if (mission.type === 'PATROL') {
        const patrolLevel = getPatrolLevel(mission.duration);
        const roll = Math.random() * 100; 
        
        // Carga máxima escala con el valor invertido en la patrulla y la duración
        const fleetValue = calculateTotalUnitCost(mission.units);
        const baseLootCapacity = fleetValue * 0.05 * patrolLevel;

        if (roll < 45) {
            // RETORNO SEGURO (45%)
            logKey = 'log_patrol_nothing';
            unitsToReturn = mission.units; 
        } 
        else if (roll < 55) {
            // EMBOSCADA CRÍTICA (10%)
            logKey = 'log_patrol_ambush';
            logType = 'combat';
            
            const enemyForces = generateEnemyForce(mission.units, patrolLevel, true);
            // El jugador es sorprendido (modificador de daño de 0.7 para el jugador)
            const battleResult = simulateCombat(mission.units, enemyForces, 0.7);
            
            unitsToReturn = battleResult.finalPlayerArmy;
            
            if (battleResult.winner === 'PLAYER') {
                logKey = 'log_patrol_battle_win';
                // Si sobrevive, el botín es gigantesco por el riesgo
                const survivingValue = calculateTotalUnitCost(unitsToReturn);
                const lootAmount = survivingValue * 0.15 * patrolLevel; 
                
                const loot: Partial<Record<ResourceType, number>> = { 
                    [ResourceType.MONEY]: Math.floor(lootAmount),
                    [ResourceType.OIL]: Math.floor(lootAmount * 0.1)
                };

                Object.entries(loot).forEach(([r, qty]) => {
                    const res = r as ResourceType;
                    resultResources[res] = Math.min(maxResources[res], resultResources[res] + (qty as number));
                });
                logParams = { combatResult: battleResult, loot };
            } else {
                logKey = 'log_patrol_battle_loss';
                const survivorsCount = Object.values(battleResult.finalPlayerArmy).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
                if (survivorsCount === 0) logKey = 'log_wipeout';
                logParams = { combatResult: battleResult };
            }
        } 
        else if (roll < 75) {
            // BATALLA ESTÁNDAR (20%)
            let damageMultiplier = 1.0;
            const patrolTechLevel = techLevels[TechType.PATROL_TRAINING] || 0;
            if (patrolTechLevel > 0) damageMultiplier += (patrolTechLevel * 0.05);

            const enemyForces = generateEnemyForce(mission.units, patrolLevel, false);
            const battleResult = simulateCombat(mission.units, enemyForces, damageMultiplier);
            
            unitsToReturn = battleResult.finalPlayerArmy;
            logType = 'combat';
            
            if (battleResult.winner === 'PLAYER') {
                logKey = 'log_patrol_battle_win';
                
                // Loot proporcional a la fuerza que sobrevivió
                const survivingValue = calculateTotalUnitCost(unitsToReturn);
                const lootAmount = survivingValue * 0.05 * patrolLevel;
                
                const loot: Partial<Record<ResourceType, number>> = { 
                    [ResourceType.MONEY]: Math.floor(lootAmount),
                    [ResourceType.OIL]: Math.floor(lootAmount * 0.05)
                };

                Object.entries(loot).forEach(([r, qty]) => {
                    const res = r as ResourceType;
                    resultResources[res] = Math.min(maxResources[res], resultResources[res] + (qty as number));
                });
                logParams = { combatResult: battleResult, loot };
            } else {
                logKey = 'log_patrol_battle_loss';
                const survivorsCount = Object.values(battleResult.finalPlayerArmy).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
                if (survivorsCount === 0) logKey = 'log_wipeout';
                logParams = { combatResult: battleResult };
            }
        } 
        else {
            // CONTRABANDO (25%)
            logKey = 'log_patrol_contraband';
            unitsToReturn = mission.units; 
            
            const loot: Partial<Record<ResourceType, number>> = {
                [ResourceType.MONEY]: Math.floor(baseLootCapacity),
                [ResourceType.AMMO]: Math.floor(baseLootCapacity * 0.1)
            };

            Object.entries(loot).forEach(([r, qty]) => {
                const res = r as ResourceType;
                resultResources[res] = Math.min(maxResources[res], resultResources[res] + (qty as number));
            });
            logParams = { loot };
        }
    }

    return { 
        resources: resultResources, 
        unitsToAdd: unitsToReturn,
        buildingsToAdd,
        logKey, 
        logType, 
        logParams, 
        newCampaignProgress, 
        warLootAdded, 
        warVictory, 
        warDefeat, 
        newGrudge 
    };
};
