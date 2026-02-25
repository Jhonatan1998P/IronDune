
import { ActiveMission, LogEntry, ResourceType, TechType, UnitType, WarState, UnitPerformanceStats, BuildingType, SpyReport } from '../../types';
import { CAMPAIGN_LEVELS } from '../../data/campaigns';
import { UNIT_DEFS } from '../../data/units';
import { simulateCombat } from './combat';
import { PVP_LOOT_FACTOR, WAR_PLAYER_ATTACKS, SCORE_TO_RESOURCE_VALUE, BOT_BUDGET_RATIO, TIER_THRESHOLDS, PLUNDERABLE_BUILDINGS, PLUNDER_RATES, REPUTATION_ATTACK_PENALTY, REPUTATION_DEFEAT_PENALTY, REPUTATION_WIN_BONUS, REPUTATION_DEFEND_BONUS } from '../../constants';
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

const UNIT_ByScore: UnitType[] = [
    UnitType.CYBER_MARINE,
    UnitType.HEAVY_COMMANDO,
    UnitType.SCOUT_TANK,
    UnitType.TITAN_MBT,
    UnitType.WRAITH_GUNSHIP,
    UnitType.ACE_FIGHTER,
    UnitType.AEGIS_DESTROYER,
    UnitType.PHANTOM_SUB
];

const getUnitsByScoreRange = (score: number): UnitType[] => {
    if (score < 10000) {
        return UNIT_ByScore.slice(0, 3);
    } else if (score < 25000) {
        return UNIT_ByScore.slice(0, 5);
    } else if (score < 35000) {
        return UNIT_ByScore.slice(0, 7);
    } else {
        return UNIT_ByScore;
    }
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

const UNIT_COUNTERS: Record<UnitType, UnitType[]> = {
    [UnitType.CYBER_MARINE]: [UnitType.CYBER_MARINE, UnitType.HEAVY_COMMANDO],
    [UnitType.HEAVY_COMMANDO]: [UnitType.CYBER_MARINE, UnitType.HEAVY_COMMANDO, UnitType.SCOUT_TANK],
    [UnitType.SCOUT_TANK]: [UnitType.SCOUT_TANK, UnitType.TITAN_MBT],
    [UnitType.TITAN_MBT]: [UnitType.TITAN_MBT, UnitType.WRAITH_GUNSHIP],
    [UnitType.WRAITH_GUNSHIP]: [UnitType.WRAITH_GUNSHIP, UnitType.ACE_FIGHTER],
    [UnitType.ACE_FIGHTER]: [UnitType.ACE_FIGHTER, UnitType.AEGIS_DESTROYER],
    [UnitType.AEGIS_DESTROYER]: [UnitType.AEGIS_DESTROYER, UnitType.PHANTOM_SUB],
    [UnitType.PHANTOM_SUB]: [UnitType.PHANTOM_SUB]
};

const UNIT_QUALITY_BY_PERSONALITY: Record<BotPersonality, { minTier: number; maxTier: number }> = {
    [BotPersonality.WARLORD]: { minTier: 3, maxTier: 8 },
    [BotPersonality.TURTLE]: { minTier: 1, maxTier: 4 },
    [BotPersonality.TYCOON]: { minTier: 2, maxTier: 6 },
    [BotPersonality.ROGUE]: { minTier: 2, maxTier: 7 }
};

const PERSONALITY_BUDGET_SPLIT: Record<BotPersonality, { attackRatio: number; defenseRatio: number }> = {
    [BotPersonality.WARLORD]: { attackRatio: 0.70, defenseRatio: 0.30 },
    [BotPersonality.TURTLE]: { attackRatio: 0.30, defenseRatio: 0.70 },
    [BotPersonality.TYCOON]: { attackRatio: 0.50, defenseRatio: 0.50 },
    [BotPersonality.ROGUE]: { attackRatio: 0.60, defenseRatio: 0.40 }
};

const PERSONALITY_TACTICS: Record<BotPersonality, { offenseFocus: UnitType[]; defenseFocus: UnitType[] }> = {
    [BotPersonality.WARLORD]: {
        offenseFocus: [UnitType.TITAN_MBT, UnitType.WRAITH_GUNSHIP, UnitType.ACE_FIGHTER, UnitType.PHANTOM_SUB],
        defenseFocus: [UnitType.TITAN_MBT, UnitType.AEGIS_DESTROYER, UnitType.WRAITH_GUNSHIP]
    },
    [BotPersonality.TURTLE]: {
        offenseFocus: [UnitType.SCOUT_TANK, UnitType.TITAN_MBT, UnitType.AEGIS_DESTROYER],
        defenseFocus: [UnitType.AEGIS_DESTROYER, UnitType.PHANTOM_SUB, UnitType.TITAN_MBT, UnitType.WRAITH_GUNSHIP]
    },
    [BotPersonality.TYCOON]: {
        offenseFocus: [UnitType.HEAVY_COMMANDO, UnitType.SCOUT_TANK, UnitType.WRAITH_GUNSHIP],
        defenseFocus: [UnitType.SCOUT_TANK, UnitType.TITAN_MBT, UnitType.AEGIS_DESTROYER, UnitType.ACE_FIGHTER]
    },
    [BotPersonality.ROGUE]: {
        offenseFocus: [UnitType.HEAVY_COMMANDO, UnitType.ACE_FIGHTER, UnitType.PHANTOM_SUB, UnitType.WRAITH_GUNSHIP],
        defenseFocus: [UnitType.SCOUT_TANK, UnitType.WRAITH_GUNSHIP, UnitType.ACE_FIGHTER]
    }
};

const getSmartUnitComposition = (
    budget: number,
    personality: BotPersonality,
    isDefense: boolean,
    availableUnits: UnitType[]
): Partial<Record<UnitType, number>> => {
    const army: Partial<Record<UnitType, number>> = {};
    const quality = UNIT_QUALITY_BY_PERSONALITY[personality];
    const tactics = PERSONALITY_TACTICS[personality];
    const focusList = isDefense ? tactics.defenseFocus : tactics.offenseFocus;
    
    const filteredUnits = availableUnits.filter(u => {
        const idx = UNIT_ByScore.indexOf(u);
        return idx >= quality.minTier - 1 && idx <= quality.maxTier - 1;
    });
    
    const prioritizedUnits = focusList.filter(u => filteredUnits.includes(u));
    
    const counterUnits = new Set<UnitType>();
    prioritizedUnits.forEach(u => {
        const counters = UNIT_COUNTERS[u] || [];
        counters.forEach(c => {
            if (filteredUnits.includes(c)) counterUnits.add(c);
        });
    });
    
    const finalPool = [...new Set([...prioritizedUnits, ...counterUnits])].filter(u => availableUnits.includes(u));
    
    if (finalPool.length === 0) {
        return { [availableUnits[0]]: Math.floor(budget / calculateUnitCP(availableUnits[0])) };
    }
    
    let remainingBudget = budget;
    const safetyCounter = 0;
    
    const tierWeights = isDefense 
        ? [0.1, 0.15, 0.25, 0.3, 0.15, 0.05, 0, 0]
        : [0.05, 0.1, 0.2, 0.25, 0.2, 0.15, 0.05, 0];
    
    const shuffledPool = [...finalPool].sort(() => Math.random() - 0.5);
    
    for (const uType of shuffledPool) {
        if (remainingBudget < 50) break;
        
        const unitCost = calculateUnitCP(uType);
        const unitIdx = UNIT_ByScore.indexOf(uType);
        const tierWeight = tierWeights[unitIdx] || 0.1;
        
        const allocation = remainingBudget * tierWeight;
        const count = Math.max(1, Math.floor(allocation / unitCost));
        const actualCost = count * unitCost;
        
        if (actualCost <= remainingBudget) {
            army[uType] = (army[uType] || 0) + count;
            remainingBudget -= actualCost;
        }
    }
    
    if (Object.keys(army).length === 0 && availableUnits.length > 0) {
        army[availableUnits[0]] = Math.max(1, Math.floor(budget / calculateUnitCP(availableUnits[0])));
    }
    
    return army;
};

export const generateBotArmy = (
    targetScore: number, 
    budgetMultiplier: number = 1.0,
    personality?: BotPersonality
): Partial<Record<UnitType, number>> => {
    
    const totalBudget = targetScore * 2250 * budgetMultiplier;

    const availableUnits = getUnitsByScoreRange(targetScore);
    const activePersonality = personality || BotPersonality.WARLORD;
    const budgetSplit = PERSONALITY_BUDGET_SPLIT[activePersonality];

    const attackBudget = totalBudget * budgetSplit.attackRatio;
    const defenseBudget = totalBudget * budgetSplit.defenseRatio;

    const attackArmy = getSmartUnitComposition(
        attackBudget,
        activePersonality,
        false,
        availableUnits
    );

    const defenseArmy = getSmartUnitComposition(
        defenseBudget,
        activePersonality,
        true,
        availableUnits
    );

    const combinedArmy: Partial<Record<UnitType, number>> = { ...attackArmy };
    
    Object.entries(defenseArmy).forEach(([uType, count]) => {
        const key = uType as UnitType;
        combinedArmy[key] = (combinedArmy[key] || 0) + (count || 0);
    });

    return combinedArmy;
};

export const generateBotBuildings = (score: number): Partial<Record<BuildingType, number>> => {
    const totalBuildings = Math.max(10, Math.floor(score / 40));
    
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
    const playerBudget = calculateTotalUnitCost(playerUnits);
    if (playerBudget <= 0) return { [UnitType.CYBER_MARINE]: 1 };

    const baseMultiplier = isAmbush ? (1.2 + (patrolLevel * 0.15)) : (0.4 + (patrolLevel * 0.15));
    const enemyBudget = playerBudget * baseMultiplier;

    const targetScore = Math.max(10, enemyBudget / SCORE_TO_RESOURCE_VALUE);

    return generateBotArmy(targetScore, 1.0);
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
    attackCounts: Record<string, number> = {},
    spyReports: SpyReport[] = []
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
    newGrudge?: any,
    reputationChanges?: { botId: string, change: number }[]
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
    let reputationChanges: { botId: string, change: number }[] = [];

    if (mission.type === 'PVP_ATTACK' && mission.targetScore !== undefined) {
        let botArmy: Partial<Record<UnitType, number>> = {};
        const isWarAttack = mission.isWarAttack && activeWar && (activeWar.enemyId === mission.targetId);
        const targetBot = rankingBots.find(b => b.id === mission.targetId);
        const targetPersonality = targetBot?.personality || BotPersonality.WARLORD;

        if (isWarAttack && activeWar) {
            const attackNum = WAR_PLAYER_ATTACKS - activeWar.playerAttacksLeft + 1;
            if (attackNum === 6) {
                const fullBudgetMultiplier = 1.0 / BOT_BUDGET_RATIO;
                botArmy = generateBotArmy(mission.targetScore, fullBudgetMultiplier, targetPersonality);
            } else {
                botArmy = activeWar.currentEnemyGarrison || {};
            }
        } else {
            const spyReport = spyReports.find(r => r.botId === mission.targetId && r.expiresAt > now);
            if (spyReport) {
                botArmy = spyReport.units;
            } else {
                botArmy = generateBotArmy(mission.targetScore, 1.0, targetPersonality);
            }
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

                const targetBot = rankingBots.find(b => b.id === mission.targetId);
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
                    reputationChanges.push({ botId: targetBot.id, change: REPUTATION_ATTACK_PENALTY });
                }
            }
        } else {
            logKey = 'log_battle_loss';
            const survivorsCount = Object.values(battleResult.finalPlayerArmy).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
            if (survivorsCount === 0) logKey = 'log_wipeout';
            if (isWarAttack) warDefeat = true; 
            logParams = { combatResult: battleResult, targetName: mission.targetName };
            if (!isWarAttack && mission.targetId) {
                reputationChanges.push({ botId: mission.targetId, change: REPUTATION_WIN_BONUS });
            }
        }
        return { resources: resultResources, unitsToAdd: unitsToReturn, buildingsToAdd, logKey, logType, logParams, newCampaignProgress, warLootAdded, warVictory, warDefeat, newGrudge, reputationChanges };
    }

    if (mission.type === 'CAMPAIGN_ATTACK' && mission.levelId) {
        const level = CAMPAIGN_LEVELS.find(l => l.id === mission.levelId);
        const initialEnemyForces = level ? level.enemyArmy : {};
        const battleResult = simulateCombat(mission.units, initialEnemyForces, 1.0);
        logType = 'combat';
        logParams = { combatResult: battleResult, loot: {}, targetName: `OP-${mission.levelId}` };
        unitsToReturn = battleResult.finalPlayerArmy;

        if (battleResult.winner === 'PLAYER') {
            logKey = 'log_battle_win';
            if (level) {
               Object.entries(level.reward).forEach(([r, qty]) => {
                   const res = r as ResourceType;
                   resultResources[res] = Math.min(maxResources[res], resultResources[res] + (qty as number));
               });
               logParams.loot = level.reward;
               if (mission.levelId === currentCampaignProgress) newCampaignProgress = mission.levelId + 1;
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
        const fleetValue = calculateTotalUnitCost(mission.units);
        const baseLootCapacity = fleetValue * 0.05 * patrolLevel;

        if (roll < 45) {
            logKey = 'log_patrol_nothing';
            unitsToReturn = mission.units; 
        } 
        else if (roll < 55) {
            logKey = 'log_patrol_ambush';
            logType = 'combat';
            const enemyForces = generateEnemyForce(mission.units, patrolLevel, true);
            const battleResult = simulateCombat(mission.units, enemyForces, 0.7);
            unitsToReturn = battleResult.finalPlayerArmy;
            if (battleResult.winner === 'PLAYER') {
                logKey = 'log_patrol_battle_win';
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
            let damageMultiplier = 1.0;
            const patrolTechLevel = techLevels[TechType.PATROL_TRAINING] || 0;
            if (patrolTechLevel > 0) damageMultiplier += (patrolTechLevel * 0.05);
            const enemyForces = generateEnemyForce(mission.units, patrolLevel, false);
            const battleResult = simulateCombat(mission.units, enemyForces, damageMultiplier);
            unitsToReturn = battleResult.finalPlayerArmy;
            logType = 'combat';
            if (battleResult.winner === 'PLAYER') {
                logKey = 'log_patrol_battle_win';
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

    return { resources: resultResources, unitsToAdd: unitsToReturn, buildingsToAdd, logKey, logType, logParams, newCampaignProgress, warLootAdded, warVictory, warDefeat, newGrudge, reputationChanges };
};

const SPY_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export const calculateSpyCost = (botScore: number): number => {
    const baseCost = Math.floor(botScore * 0.5);
    return Math.max(1000, Math.min(100000, baseCost));
};

export const generateSpyReport = (
    bot: StaticBot,
    now: number
): SpyReport => {
    const defenseBudget = bot.stats.DOMINION * 2250 * 0.7;
    const availableUnits = getUnitsByScoreRange(bot.stats.DOMINION);
    const personality = bot.personality || BotPersonality.WARLORD;
    
    const defenseArmy = getSmartUnitComposition(
        defenseBudget,
        personality,
        true,
        availableUnits
    );

    const estimatedResources: Partial<Record<ResourceType, number>> = {
        [ResourceType.MONEY]: Math.floor(bot.stats.DOMINION * 100 + Math.random() * bot.stats.DOMINION * 50),
        [ResourceType.OIL]: Math.floor(bot.stats.DOMINION * 20 + Math.random() * bot.stats.DOMINION * 10),
        [ResourceType.AMMO]: Math.floor(bot.stats.DOMINION * 15 + Math.random() * bot.stats.DOMINION * 8),
        [ResourceType.GOLD]: Math.floor(bot.stats.DOMINION * 2 + Math.random() * bot.stats.DOMINION * 1),
        [ResourceType.DIAMOND]: Math.floor(bot.stats.DOMINION * 0.1 + Math.random() * bot.stats.DOMINION * 0.05)
    };

    const totalBuildings = Math.max(10, Math.floor(bot.stats.DOMINION / 10));
    const buildingWeights: Partial<Record<BuildingType, number>> = {
        [BuildingType.HOUSE]: 50,
        [BuildingType.FACTORY]: 20,
        [BuildingType.OIL_RIG]: 10,
        [BuildingType.MUNITIONS_FACTORY]: 10,
        [BuildingType.GOLD_MINE]: 8,
        [BuildingType.SKYSCRAPER]: 2
    };
    const totalWeight = Object.values(buildingWeights).reduce((a, b) => a + b, 0);
    const estimatedBuildings: Partial<Record<BuildingType, number>> = {};
    Object.entries(buildingWeights).forEach(([bType, weight]) => {
        estimatedBuildings[bType as BuildingType] = Math.floor(totalBuildings * (weight / totalWeight));
    });

    return {
        id: `spy-${bot.id}-${now}`,
        botId: bot.id,
        botName: bot.name,
        botScore: bot.stats.DOMINION,
        botPersonality: personality,
        createdAt: now,
        expiresAt: now + SPY_EXPIRY_MS,
        units: defenseArmy,
        resources: estimatedResources,
        buildings: estimatedBuildings
    };
};

export const getSpyReportForBot = (
    botId: string,
    spyReports: SpyReport[],
    now: number
): SpyReport | undefined => {
    return spyReports.find(r => r.botId === botId && r.expiresAt > now);
};

export const getBotDefensiveArmy = (
    bot: StaticBot,
    spyReports: SpyReport[],
    now: number
): Partial<Record<UnitType, number>> => {
    const activeReport = getSpyReportForBot(bot.id, spyReports, now);
    if (activeReport) {
        return activeReport.units;
    }
    return generateBotArmy(bot.stats.DOMINION, 1.0, bot.personality || BotPersonality.WARLORD);
};
