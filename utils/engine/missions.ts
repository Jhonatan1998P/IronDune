
import { ActiveMission, LogEntry, ResourceType, TechType, UnitCategory, UnitType, WarState, UnitPerformanceStats } from '../../types';
import { CAMPAIGN_LEVELS } from '../../data/campaigns';
import { UNIT_DEFS } from '../../data/units';
import { simulateCombat } from './combat';
import { PVP_LOOT_FACTOR, WAR_PLAYER_ATTACKS, SCORE_TO_RESOURCE_VALUE, BOT_BUDGET_RATIO, TIER_THRESHOLDS } from '../../constants';
import { BASE_PRICES } from './market';
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

// --- RVE SYSTEM: COMBAT POWER CALCULATION ---
const calculateUnitCP = (uType: UnitType): number => {
    const def = UNIT_DEFS[uType];
    // Calculated based on market value of resources required
    const moneyVal = def.cost.money * BASE_PRICES[ResourceType.MONEY];
    const oilVal = def.cost.oil * BASE_PRICES[ResourceType.OIL];
    const ammoVal = def.cost.ammo * BASE_PRICES[ResourceType.AMMO];
    const goldVal = (def.cost.diamond || 0) * BASE_PRICES[ResourceType.DIAMOND]; 
    return moneyVal + oilVal + ammoVal + goldVal;
};

// --- TIER DEFINITIONS (STRICT GATING) ---
const UNITS_BY_TIER = {
    1: [UnitType.SOLDIER, UnitType.SNIPER, UnitType.MORTAR, UnitType.LIGHT_TANK, UnitType.PATROL_BOAT], // Basic
    2: [UnitType.TANK, UnitType.HOWITZER, UnitType.HELICOPTER, UnitType.DESTROYER], // Intermediate
    3: [UnitType.HEAVY_TANK, UnitType.MLRS, UnitType.FIGHTER_JET, UnitType.SUBMARINE], // Advanced
    4: [UnitType.BOMBER, UnitType.COMMANDO] // Elite
};

const getAvailableUnitsForScore = (score: number): UnitType[] => {
    let pool: UnitType[] = [...UNITS_BY_TIER[1]];
    
    if (score >= TIER_THRESHOLDS.TIER_1) { // 15k
        pool = [...pool, ...UNITS_BY_TIER[2]];
    }
    if (score >= TIER_THRESHOLDS.TIER_2) { // 100k
        pool = [...pool, ...UNITS_BY_TIER[3]];
    }
    if (score >= TIER_THRESHOLDS.TIER_3) { // 500k
        pool = [...pool, ...UNITS_BY_TIER[4]];
    }
    
    return pool;
};

// --- PERSONALITY DOCTRINES (STRICT BUCKETS) ---

const UNIT_POOLS = {
    MASS: [UnitType.SOLDIER, UnitType.LIGHT_TANK, UnitType.PATROL_BOAT],
    SUPPORT: [UnitType.MORTAR, UnitType.HOWITZER, UnitType.MLRS, UnitType.SNIPER, UnitType.HELICOPTER],
    DEFENSIVE: [UnitType.TANK, UnitType.HEAVY_TANK, UnitType.DESTROYER, UnitType.HOWITZER, UnitType.SOLDIER],
    ELITE: [UnitType.HEAVY_TANK, UnitType.BOMBER, UnitType.SUBMARINE, UnitType.DESTROYER, UnitType.FIGHTER_JET],
    ASSASSIN: [UnitType.SNIPER, UnitType.COMMANDO, UnitType.SUBMARINE, UnitType.BOMBER, UnitType.MLRS],
    FAST: [UnitType.LIGHT_TANK, UnitType.HELICOPTER, UnitType.FIGHTER_JET, UnitType.PATROL_BOAT, UnitType.COMMANDO]
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
        
        // Pick random unit from pool
        const uType = pool[Math.floor(Math.random() * pool.length)];
        const unitCost = calculateUnitCP(uType);

        if (unitCost > remainingBudget) continue;

        // Buy in clusters (5-15% of remaining budget) to avoid spamming 1 unit
        const spendChunk = Math.max(unitCost, remainingBudget * (0.05 + Math.random() * 0.10));
        const count = Math.max(1, Math.floor(spendChunk / unitCost));

        army[uType] = (army[uType] || 0) + count;
        remainingBudget -= (count * unitCost);
    }
};

/**
 * Generates an army based on specific BUDGET BUCKETS defined by personality.
 * STRICTLY respects Tier limits and Distribution Percentages.
 */
export const generateBotArmy = (
    targetScore: number, 
    budgetMultiplier: number = 1.0, 
    personality: BotPersonality = BotPersonality.TYCOON
): Partial<Record<UnitType, number>> => {
    
    // 1. Calculate Real Budget
    const totalEmpireValue = targetScore * SCORE_TO_RESOURCE_VALUE;
    const totalBudget = totalEmpireValue * BOT_BUDGET_RATIO * budgetMultiplier;

    // 2. Get Legally Available Units (Tier Gating)
    const allowedUnits = getAvailableUnitsForScore(targetScore);
    
    const army: Partial<Record<UnitType, number>> = {};

    // 3. Define Doctrines (Buckets)
    // Structure: { poolName: string, ratio: number }
    let buckets: { poolName: keyof typeof UNIT_POOLS | 'ALL', ratio: number }[] = [];

    switch (personality) {
        case BotPersonality.WARLORD:
            // 70% Masa (Cheap), 30% Apoyo (Artillery/Air)
            buckets = [
                { poolName: 'MASS', ratio: 0.7 },
                { poolName: 'SUPPORT', ratio: 0.3 }
            ];
            break;
        case BotPersonality.ROGUE:
            // 50% Assassin (High DMG/Init), 50% Fast
            buckets = [
                { poolName: 'ASSASSIN', ratio: 0.5 },
                { poolName: 'FAST', ratio: 0.5 }
            ];
            break;
        case BotPersonality.TURTLE:
            // 60% Defensive (High HP/Cost), 40% Support
            buckets = [
                { poolName: 'DEFENSIVE', ratio: 0.6 },
                { poolName: 'SUPPORT', ratio: 0.4 }
            ];
            break;
        case BotPersonality.TYCOON:
        default:
            // 100% Elite/Quality (Sorted by Cost Descending handled via pool filter logic or generic ALL)
            buckets = [
                { poolName: 'ELITE', ratio: 1.0 }
            ];
            break;
    }

    // 4. Execute Spending per Bucket
    buckets.forEach(bucket => {
        const bucketBudget = totalBudget * bucket.ratio;
        
        let poolUnits: UnitType[] = [];
        
        if (bucket.poolName === 'ALL') {
            poolUnits = allowedUnits;
        } else {
            // Intersect Allowed Units with Bucket Definition
            const definition = UNIT_POOLS[bucket.poolName];
            poolUnits = allowedUnits.filter(u => definition.includes(u));
        }

        // FALLBACK: If intersection is empty (e.g. Low level Tycoon has no Elite units),
        // fallback to generic allowed units to ensure budget is spent.
        if (poolUnits.length === 0) {
            poolUnits = allowedUnits;
        }

        // Tycoon Special Logic: Sort by Cost Descending to prioritize quality
        if (personality === BotPersonality.TYCOON) {
            poolUnits.sort((a, b) => calculateUnitCP(b) - calculateUnitCP(a));
            // Take top 50% only to ensure high quality
            const cutoff = Math.ceil(poolUnits.length * 0.5);
            poolUnits = poolUnits.slice(0, cutoff);
        }

        spendBudgetOnPool(bucketBudget, poolUnits, army);
    });

    // 5. Emergency Fallback: If army is empty (math error or extremely low budget), add 1 soldier
    if (Object.keys(army).length === 0) {
        army[UnitType.SOLDIER] = Math.max(1, Math.floor(totalBudget / calculateUnitCP(UnitType.SOLDIER)));
    }

    return army;
};

export const generateEnemyForce = (playerUnits: Partial<Record<UnitType, number>>, patrolLevel: number = 1): Partial<Record<UnitType, number>> => {
    // Legacy support for Patrols, using a simplified logic based on player strength
    const enemies: Partial<Record<UnitType, number>> = {};
    const playerUnitTypes = Object.keys(playerUnits) as UnitType[];
    if (playerUnitTypes.length === 0) return enemies;
    
    let totalPlayerCount = 0;
    Object.values(playerUnits).forEach(c => totalPlayerCount += (c || 0));
    
    let count = Math.ceil(totalPlayerCount * (0.8 + (patrolLevel * 0.1)));
    
    // Mix in special units (Sniper, Commando, Mortar)
    // 25% Chance to encounter specialized resistance
    if (count > 5 && Math.random() < 0.25) {
        const specialRoll = Math.random();
        
        if (specialRoll < 0.33) {
            // Add Snipers (10% of force)
            const snipers = Math.max(1, Math.floor(count * 0.1));
            enemies[UnitType.SNIPER] = snipers;
            count = Math.max(1, count - snipers);
        } else if (specialRoll < 0.66) {
            // Add Mortars (5% of force)
            const mortars = Math.max(1, Math.floor(count * 0.05));
            enemies[UnitType.MORTAR] = mortars;
            count = Math.max(1, count - mortars);
        } else {
            // Add Commandos (Very rare, 2% of force)
            const commandos = Math.max(1, Math.floor(count * 0.02));
            enemies[UnitType.COMMANDO] = commandos;
            count = Math.max(1, count - commandos);
        }
    }

    enemies[UnitType.SOLDIER] = count;
    return enemies;
};

const calculatePvpLoot = (targetScore: number, bonusMultiplier: number = 1.0): Partial<Record<ResourceType, number>> => {
    // REGLA: El bot tiene un budget de Puntos x 12500.
    const totalEmpireValue = targetScore * SCORE_TO_RESOURCE_VALUE;
    
    // REGLA: Robo del 15% de las existencias.
    // Asumimos que "existencias" del bot son proporcionales a su valor total.
    const lootableValue = totalEmpireValue * PVP_LOOT_FACTOR * bonusMultiplier;
    
    const loot: Partial<Record<ResourceType, number>> = {};
    
    // Distribución definida para bots:
    // Dinero: 40%, Petróleo: 20%, Munición: 20%, Oro: 20%
    const moneyValue = lootableValue * 0.40;
    const oilValue = lootableValue * 0.20;
    const ammoValue = lootableValue * 0.20;
    const goldValue = lootableValue * 0.20;

    loot[ResourceType.MONEY] = Math.floor(moneyValue / BASE_PRICES[ResourceType.MONEY]);
    loot[ResourceType.OIL] = Math.floor(oilValue / BASE_PRICES[ResourceType.OIL]);
    loot[ResourceType.AMMO] = Math.floor(ammoValue / BASE_PRICES[ResourceType.AMMO]);
    loot[ResourceType.GOLD] = Math.floor(goldValue / BASE_PRICES[ResourceType.GOLD]);

    return loot;
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
    empirePoints: number = 0 // Added Empire Points for reward calc
): { 
    resources: Record<ResourceType, number>, 
    unitsToAdd: Partial<Record<UnitType, number>>,
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
    let logKey = '';
    let logType: LogEntry['type'] = 'mission'; 
    let logParams: any = {};
    let newCampaignProgress = currentCampaignProgress;
    
    let warLootAdded: Partial<Record<ResourceType, number>> | undefined;
    let warVictory = false;
    let warDefeat = false;
    let newGrudge: any = undefined;

    if (mission.type === 'PVP_ATTACK' && mission.targetScore !== undefined) {
        
        // --- FETCH PERSONALITY ---
        let personality = BotPersonality.TYCOON;
        const targetBot = rankingBots.find(b => b.id === mission.targetId);
        if (targetBot) personality = targetBot.personality;

        let botArmy: Partial<Record<UnitType, number>> = {};
        const isWarAttack = mission.isWarAttack && activeWar && (activeWar.enemyId === mission.targetId);

        if (isWarAttack && activeWar) {
            // --- WAR MODE LOGIC ---
            // Calculate Attack Number (1 to 8)
            const attackNum = WAR_PLAYER_ATTACKS - activeWar.playerAttacksLeft + 1;
            
            if (attackNum === 6) {
                // RESET CONDITION: Attack 6 triggers full resupply.
                const fullBudgetMultiplier = 1.0 / BOT_BUDGET_RATIO;
                botArmy = generateBotArmy(mission.targetScore, fullBudgetMultiplier, personality);
            } else {
                // PERSISTENCE CONDITION: Use existing garrison.
                botArmy = activeWar.currentEnemyGarrison || {};
            }
        } else {
            // --- RAID MODE LOGIC ---
            botArmy = generateBotArmy(mission.targetScore, 1.0, personality);
        }

        // --- EXECUTE COMBAT ---
        const battleResult = simulateCombat(mission.units, botArmy, 1.0);
        
        logType = 'combat';
        unitsToReturn = battleResult.finalPlayerArmy;

        if (isWarAttack && activeWar) {
            // --- WAR POST-BATTLE UPDATE ---
            activeWar.currentEnemyGarrison = battleResult.finalEnemyArmy;

            const pResLoss = calculateResourceCost(battleResult.totalPlayerCasualties);
            const eResLoss = calculateResourceCost(battleResult.totalEnemyCasualties);
            
            Object.keys(pResLoss).forEach(k => {
                const r = k as ResourceType;
                activeWar.playerResourceLosses[r] += pResLoss[r];
                activeWar.enemyResourceLosses[r] += eResLoss[r];
            });
            
            const pCount = Object.values(battleResult.totalPlayerCasualties).reduce((a:any, b:any) => a + b, 0);
            const eCount = Object.values(battleResult.totalEnemyCasualties).reduce((a:any, b:any) => a + b, 0);
            
            activeWar.playerUnitLosses += (pCount as number);
            activeWar.enemyUnitLosses += (eCount as number);

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
                const raidingLevel = techLevels[TechType.LOGISTICS_RAIDING] || 0;
                const lootBonus = 1 + (raidingLevel * 0.01); 
                // New logic: 15% of Bot's simulated resources based on Score
                const loot = calculatePvpLoot(mission.targetScore, lootBonus);
                
                Object.entries(loot).forEach(([r, qty]) => {
                    const res = r as ResourceType;
                    resultResources[res] = Math.min(maxResources[res], resultResources[res] + (qty as number));
                });
                logParams = { combatResult: battleResult, loot, targetName: mission.targetName };

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
            const survivorsCount = Object.values(battleResult.finalPlayerArmy).reduce((a,b) => a + (b || 0), 0);
            if (survivorsCount === 0) logKey = 'log_wipeout';
            
            if (isWarAttack) {
                warDefeat = true; 
            }

            logParams = { combatResult: battleResult, targetName: mission.targetName };
        }

        return { resources: resultResources, unitsToAdd: unitsToReturn, logKey, logType, logParams, newCampaignProgress, warLootAdded, warVictory, warDefeat, newGrudge };
    }

    if (mission.type === 'CAMPAIGN_ATTACK' && mission.levelId) {
        const level = CAMPAIGN_LEVELS.find(l => l.id === mission.levelId);
        const initialEnemyForces = level ? level.enemyArmy : {};
        const battleResult = simulateCombat(mission.units, initialEnemyForces, 1.0);
        
        logType = 'combat';
        logParams = { combatResult: battleResult, loot: {} };
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
            const survivorsCount = Object.values(battleResult.finalPlayerArmy).reduce((a,b) => a + (b || 0), 0);
            if (survivorsCount === 0) logKey = 'log_wipeout';
        }
        
        return { resources: resultResources, unitsToAdd: unitsToReturn, logKey, logType, logParams, newCampaignProgress };
    }

    if (mission.type === 'PATROL') {
        const patrolLevel = getPatrolLevel(mission.duration);
        const roll = Math.random() * 100; 

        if (roll < 50) {
            logKey = 'log_patrol_nothing';
            unitsToReturn = mission.units; 
        } 
        else if (roll < 55) {
            logKey = 'log_patrol_ambush';
            logType = 'combat';
            unitsToReturn = {}; 
            // Fix for crash: Clone units to avoid ref issues and ensure performance objects exist
            const clonedUnits = { ...mission.units };
            
            // FIX: Initialize performance objects to prevent UI crash when reading undefined properties
            const playerPerf: Partial<Record<UnitType, UnitPerformanceStats>> = {};
            Object.keys(clonedUnits).forEach(u => {
                playerPerf[u as UnitType] = { kills: {}, deathsBy: {}, damageDealt: 0 };
            });

            logParams = {
                combatResult: {
                    winner: 'ENEMY',
                    rounds: [], 
                    initialPlayerArmy: clonedUnits,
                    initialEnemyArmy: {}, 
                    finalPlayerArmy: {},
                    finalEnemyArmy: {}, 
                    totalPlayerCasualties: clonedUnits,
                    totalEnemyCasualties: {},
                    playerTotalHpStart: 100, playerTotalHpLost: 100, 
                    enemyTotalHpStart: 0, enemyTotalHpLost: 0,
                    playerDamageDealt: 0, enemyDamageDealt: 0,
                    playerPerformance: playerPerf, // Pass initialized perf object
                    enemyPerformance: {}
                }
            };
        } 
        else if (roll < 70) {
            let damageMultiplier = 1.0;
            const patrolTechLevel = techLevels[TechType.PATROL_TRAINING] || 0;
            if (patrolTechLevel > 0) damageMultiplier += (patrolTechLevel * 0.05);

            const enemyForces = generateEnemyForce(mission.units, patrolLevel);
            const battleResult = simulateCombat(mission.units, enemyForces, damageMultiplier);
            
            unitsToReturn = battleResult.finalPlayerArmy;
            logType = 'combat';
            
            if (battleResult.winner === 'PLAYER') {
                logKey = 'log_patrol_battle_win';
                
                const loot: Partial<Record<ResourceType, number>> = { 
                    [ResourceType.MONEY]: 500 * patrolLevel, 
                    [ResourceType.OIL]: 100 * patrolLevel 
                };

                Object.entries(loot).forEach(([r, qty]) => {
                    const res = r as ResourceType;
                    resultResources[res] = Math.min(maxResources[res], resultResources[res] + (qty as number));
                });
                logParams = { combatResult: battleResult, loot };
            } else {
                logKey = 'log_patrol_battle_loss';
                const survivorsCount = Object.values(battleResult.finalPlayerArmy).reduce((a,b) => a + (b || 0), 0);
                if (survivorsCount === 0) logKey = 'log_wipeout';
                logParams = { combatResult: battleResult };
            }
        } 
        else {
            logKey = 'log_patrol_contraband';
            unitsToReturn = mission.units; 
            
            // Formula: EmpirePoints * 10 * PatrolLevel (Min 1000)
            const rewardAmount = Math.max(1000, Math.floor(empirePoints * 10 * patrolLevel));

            const loot: Partial<Record<ResourceType, number>> = {
                [ResourceType.MONEY]: rewardAmount
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
