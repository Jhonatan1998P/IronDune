
import { ActiveMission, LogEntry, ResourceType, TechType, UnitType, WarState, UnitPerformanceStats, BuildingType, SpyReport } from '../../types';
import { CAMPAIGN_LEVELS } from '../../data/campaigns';
import { UNIT_DEFS } from '../../data/units';
import { simulateCombat } from './combat';
import { PVP_LOOT_FACTOR, WAR_PLAYER_ATTACKS, SCORE_TO_RESOURCE_VALUE, BOT_BUDGET_RATIO, TIER_THRESHOLDS, PLUNDERABLE_BUILDINGS, PLUNDER_RATES, BOT_BUILDINGS_PER_SCORE, REPUTATION_ATTACK_PENALTY, REPUTATION_DEFEAT_PENALTY, REPUTATION_WIN_BONUS, REPUTATION_DEFEND_BONUS, SPY_RESOURCE_RATIOS } from '../../constants';
import { BASE_PRICES, calculateTotalUnitCost } from './market';
import { calculateRetaliationTime, getRetaliationChance } from './nemesis';
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

interface UnitMetrics {
    type: UnitType;
    cost: number;
    dps: number;
    hp: number;
    effectiveHP: number;
    attack: number;
    defense: number;
    tier: number;
    category: string;
    dpsPerCost: number;
    hpPerCost: number;
    synergyScore: number;
}

const calculateUnitMetrics = (uType: UnitType, tier: number): UnitMetrics => {
    const def = UNIT_DEFS[uType];
    const cost = calculateUnitCP(uType);
    const dps = def.attack * (1 + (def.rapidFire ? Object.values(def.rapidFire).reduce((a, b) => a + b, 0) * 0.1 : 0));
    const effectiveHP = def.hp + (def.defense * 2);
    
    return {
        type: uType,
        cost,
        dps,
        hp: def.hp,
        effectiveHP,
        attack: def.attack,
        defense: def.defense,
        tier,
        category: def.category,
        dpsPerCost: dps / cost,
        hpPerCost: def.hp / cost,
        synergyScore: 0
    };
};

const PERSONALITY_STRATEGY = {
    [BotPersonality.WARLORD]: {
        offense: {
            primaryRole: 'DAMAGE_DEALER',
            tierFocus: [3, 4, 2, 1],
            categories: ['AIR', 'TANK', 'NAVAL'],
            ratio: { heavy: 0.50, medium: 0.30, light: 0.20 },
            eliteThreshold: 0.15,
            dpsWeight: 0.7,
            tankWeight: 0.3
        },
        defense: {
            primaryRole: 'TANK',
            tierFocus: [2, 3, 1],
            categories: ['TANK', 'NAVAL', 'GROUND'],
            ratio: { heavy: 0.30, medium: 0.40, light: 0.30 },
            eliteThreshold: 0.10,
            dpsWeight: 0.4,
            tankWeight: 0.6
        }
    },
    [BotPersonality.TURTLE]: {
        offense: {
            primaryRole: 'COUNTER',
            tierFocus: [2, 3, 1],
            categories: ['TANK', 'NAVAL'],
            ratio: { heavy: 0.40, medium: 0.40, light: 0.20 },
            eliteThreshold: 0.08,
            dpsWeight: 0.5,
            tankWeight: 0.5
        },
        defense: {
            primaryRole: 'FORTIFY',
            tierFocus: [4, 3, 2],
            categories: ['NAVAL', 'TANK'],
            ratio: { heavy: 0.55, medium: 0.30, light: 0.15 },
            eliteThreshold: 0.20,
            dpsWeight: 0.3,
            tankWeight: 0.7
        }
    },
    [BotPersonality.TYCOON]: {
        offense: {
            primaryRole: 'EFFICIENCY',
            tierFocus: [2, 3, 1],
            categories: ['TANK', 'GROUND', 'AIR'],
            ratio: { heavy: 0.25, medium: 0.45, light: 0.30 },
            eliteThreshold: 0.05,
            dpsWeight: 0.6,
            tankWeight: 0.4
        },
        defense: {
            primaryRole: 'BALANCED',
            tierFocus: [2, 3, 1],
            categories: ['TANK', 'NAVAL', 'AIR'],
            ratio: { heavy: 0.35, medium: 0.40, light: 0.25 },
            eliteThreshold: 0.10,
            dpsWeight: 0.4,
            tankWeight: 0.6
        }
    },
    [BotPersonality.ROGUE]: {
        offense: {
            primaryRole: 'SURPRISE',
            tierFocus: [3, 2, 1],
            categories: ['AIR', 'GROUND'],
            ratio: { heavy: 0.20, medium: 0.35, light: 0.45 },
            eliteThreshold: 0.12,
            dpsWeight: 0.75,
            tankWeight: 0.25
        },
        defense: {
            primaryRole: 'RESPONSE',
            tierFocus: [2, 3, 1],
            categories: ['TANK', 'AIR'],
            ratio: { heavy: 0.25, medium: 0.35, light: 0.40 },
            eliteThreshold: 0.08,
            dpsWeight: 0.5,
            tankWeight: 0.5
        }
    }
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

const SYNERGY_BONUS: Record<string, UnitType[]> = {
    'AIR+TANK': [UnitType.WRAITH_GUNSHIP, UnitType.TITAN_MBT],
    'NAVAL+AIR': [UnitType.AEGIS_DESTROYER, UnitType.ACE_FIGHTER],
    'TANK+GROUND': [UnitType.TITAN_MBT, UnitType.HEAVY_COMMANDO],
    'GROUND+AIR': [UnitType.CYBER_MARINE, UnitType.ACE_FIGHTER]
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
    if (score < 500) {
        return UNIT_ByScore.slice(0, 1);
    } else if (score < 1500) {
        return UNIT_ByScore.slice(0, 2);
    } else if (score < 3000) {
        return UNIT_ByScore.slice(0, 3);
    } else if (score < 6000) {
        return UNIT_ByScore.slice(0, 4);
    } else if (score < 15000) {
        return UNIT_ByScore.slice(0, 5);
    } else if (score < 30000) {
        return UNIT_ByScore.slice(0, 6);
    } else if (score < 60000) {
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

const PERSONALITY_BUDGET_SPLIT: Record<BotPersonality, { attackRatio: number; defenseRatio: number }> = {
    [BotPersonality.WARLORD]: { attackRatio: 0.70, defenseRatio: 0.30 },
    [BotPersonality.TURTLE]: { attackRatio: 0.30, defenseRatio: 0.70 },
    [BotPersonality.TYCOON]: { attackRatio: 0.50, defenseRatio: 0.50 },
    [BotPersonality.ROGUE]: { attackRatio: 0.60, defenseRatio: 0.40 }
};

const getSmartUnitComposition = (
    budget: number,
    personality: BotPersonality,
    isDefense: boolean,
    availableUnits: UnitType[]
): Partial<Record<UnitType, number>> => {
    const army: Partial<Record<UnitType, number>> = {};
    const strategy = PERSONALITY_STRATEGY[personality][isDefense ? 'defense' : 'offense'];
    
    const unitMetricsList: UnitMetrics[] = availableUnits.map((uType, idx) => {
        return calculateUnitMetrics(uType, idx + 1);
    });

    const getTierCategory = (tier: number): 'heavy' | 'medium' | 'light' => {
        if (tier >= 4) return 'heavy';
        if (tier >= 2) return 'medium';
        return 'light';
    };

    unitMetricsList.forEach(metric => {
        let score = 0;
        
        const tierIdx = strategy.tierFocus.indexOf(metric.tier);
        if (tierIdx !== -1) {
            score += (strategy.tierFocus.length - tierIdx) * 10;
        }
        
        if (strategy.categories.includes(metric.category)) {
            score += 15;
        }
        
        if (isDefense) {
            score += (metric.hpPerCost * 100);
            score += (metric.defense * 0.5);
        } else {
            score += (metric.dpsPerCost * 100);
            score += (metric.attack * 0.3);
        }
        
        if (metric.tier === 4 && Math.random() < strategy.eliteThreshold) {
            score += 20;
        }
        
        metric.synergyScore = score;
    });

    const sortedUnits = [...unitMetricsList].sort((a, b) => b.synergyScore - a.synergyScore);

    const tierRatios = strategy.ratio;
    const budgetByTier = {
        heavy: budget * tierRatios.heavy,
        medium: budget * tierRatios.medium,
        light: budget * tierRatios.light
    };

    const allocatedUnits: Set<UnitType> = new Set();

    const allocateByTier = (tier: 'heavy' | 'medium' | 'light') => {
        const tierBudget = budgetByTier[tier];
        if (tierBudget < 100) return;

        const tierUnits = sortedUnits.filter(u => 
            getTierCategory(u.tier) === tier && 
            !allocatedUnits.has(u.type) &&
            strategy.categories.includes(u.category)
        );

        if (tierUnits.length === 0) return;

        const primaryUnit = tierUnits[0];
        const remainingBudget = tierBudget;

        let count = Math.max(1, Math.floor(remainingBudget * 0.6 / primaryUnit.cost));
        const cost = count * primaryUnit.cost;

        if (cost <= remainingBudget) {
            army[primaryUnit.type] = count;
            allocatedUnits.add(primaryUnit.type);
            budgetByTier[tier] -= cost;
        }

        if (tierBudget - cost > primaryUnit.cost * 5 && tierUnits.length > 1) {
            const secondaryUnit = tierUnits[1];
            const secondaryCount = Math.max(1, Math.floor((tierBudget - cost) * 0.4 / secondaryUnit.cost));
            const secondaryCost = secondaryCount * secondaryUnit.cost;
            
            if (secondaryCost <= tierBudget - cost) {
                army[secondaryUnit.type] = (army[secondaryUnit.type] || 0) + secondaryCount;
                allocatedUnits.add(secondaryUnit.type);
                budgetByTier[tier] -= secondaryCost;
            }
        }
    };

    allocateByTier('heavy');
    allocateByTier('medium');
    allocateByTier('light');

    const leftoverBudget = Object.values(budgetByTier).reduce((a, b) => a + b, 0);
    if (leftoverBudget > 500) {
        const affordableUnits = sortedUnits
            .filter(u => !allocatedUnits.has(u.type) && u.cost <= leftoverBudget)
            .slice(0, 2);
        
        affordableUnits.forEach(u => {
            const count = Math.max(1, Math.floor(leftoverBudget * 0.3 / u.cost));
            army[u.type] = (army[u.type] || 0) + count;
        });
    }

    const counterUnits = new Set<UnitType>();
    Object.keys(army).forEach(uType => {
        const counters = UNIT_COUNTERS[uType as UnitType] || [];
        counters.forEach(c => {
            if (availableUnits.includes(c)) counterUnits.add(c);
        });
    });

    counterUnits.forEach(cType => {
        if (!army[cType] && availableUnits.includes(cType)) {
            const cMetric = unitMetricsList.find(m => m.type === cType);
            if (cMetric && cMetric.cost <= budget * 0.05) {
                army[cType] = 1;
            }
        }
    });

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

    // Unified formula: score * 4000 * multiplier for all military calculations
    const totalBudget = targetScore * 4000 * budgetMultiplier;

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
    const totalBuildings = Math.max(10, Math.floor(score / BOT_BUILDINGS_PER_SCORE));

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
            } else if (targetBot) {
                botArmy = getBotDefensiveArmy(targetBot, spyReports, now);
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
                    // Roll for retaliation based on personality
                    const retaliationChance = getRetaliationChance(targetBot.personality);
                    const willRetaliate = Math.random() < retaliationChance;

                    if (willRetaliate) {
                        newGrudge = {
                            id: `grudge-${now}`,
                            botId: targetBot.id,
                            botName: targetBot.name,
                            botPersonality: targetBot.personality,
                            botScore: targetBot.stats.DOMINION,
                            createdAt: now,
                            retaliationTime: calculateRetaliationTime(now),
                            notified: false
                        };
                    }
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
        
        // Si se creó una venganza, agregar el log correspondiente
        if (newGrudge) {
            logParams.grudgeData = {
                attacker: newGrudge.botName,
                retaliationTime: newGrudge.retaliationTime
            };
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
    const minCost = 5000;
    const maxCost = botScore * 10;
    return Math.floor(Math.random() * (maxCost - minCost) + minCost);
};

export const generateSpyReport = (
    bot: StaticBot,
    now: number
): SpyReport => {
    const personality = bot.personality || BotPersonality.WARLORD;
    const defenseRatio = PERSONALITY_BUDGET_SPLIT[personality].defenseRatio;
    
    // Unified formula: score * 4000 for all military calculations
    const defenseBudget = bot.stats.DOMINION * 4000 * defenseRatio;

    const fullMilitaryBudget = bot.stats.DOMINION * 4000;
    const resourceRatios = SPY_RESOURCE_RATIOS[personality];
    const moneyBudget = fullMilitaryBudget * resourceRatios.money;
    const oilBudget = fullMilitaryBudget * resourceRatios.oil;
    const goldBudget = fullMilitaryBudget * resourceRatios.gold;
    const ammoBudget = fullMilitaryBudget * resourceRatios.ammo;

    const estimatedResources: Partial<Record<ResourceType, number>> = {
        [ResourceType.MONEY]: Math.floor(moneyBudget),
        [ResourceType.OIL]: Math.floor(oilBudget / BASE_PRICES[ResourceType.OIL]),
        [ResourceType.GOLD]: Math.floor(goldBudget / BASE_PRICES[ResourceType.GOLD]),
        [ResourceType.AMMO]: Math.floor(ammoBudget / BASE_PRICES[ResourceType.AMMO]),
        [ResourceType.DIAMOND]: Math.floor(bot.stats.DOMINION * 0.1 + Math.random() * bot.stats.DOMINION * 0.05)
    };

    const availableUnits = getUnitsByScoreRange(bot.stats.DOMINION);

    const defenseArmy = getSmartUnitComposition(
        defenseBudget,
        personality,
        true,
        availableUnits
    );

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
    
    const personality = bot.personality || BotPersonality.WARLORD;
    const defenseRatio = PERSONALITY_BUDGET_SPLIT[personality].defenseRatio;
    const defenseBudget = bot.stats.DOMINION * 4000 * defenseRatio;
    const availableUnits = getUnitsByScoreRange(bot.stats.DOMINION);
    return getSmartUnitComposition(defenseBudget, personality, true, availableUnits);
};
