// ============================================================
// MISSIONS ENGINE - Mirror of utils/engine/missions.ts
// ============================================================

import { UnitType, ResourceType, TechType, UnitCategory, BotPersonality, BuildingType } from './enums.js';
import { CAMPAIGN_LEVELS } from './campaigns.js';
import { UNIT_DEFS, BASE_PRICES, calculateTotalUnitCost } from './units.js';
import { simulateCombat } from './combat.js';
import { 
    PVP_LOOT_FACTOR, 
    SCORE_TO_RESOURCE_VALUE, 
    BOT_BUDGET_RATIO, 
    TIER_THRESHOLDS, 
    PLUNDERABLE_BUILDINGS, 
    PLUNDER_RATES, 
    BOT_BUILDINGS_PER_SCORE, 
    REPUTATION_ATTACK_PENALTY, 
    REPUTATION_DEFEAT_PENALTY, 
    REPUTATION_WIN_BONUS, 
    REPUTATION_DEFEND_BONUS, 
    SPY_RESOURCE_RATIOS,
    WAR_PLAYER_ATTACKS
} from './constants.js';
import { calculateRetaliationTime, getRetaliationChance } from './nemesis.js';
import { ReputationChangeType } from './reputation.js';
import { generateLogisticLootFromCombat } from './logisticLoot.js';

export const calculateResourceCost = (units) => {
    const cost = {
        [ResourceType.MONEY]: 0,
        [ResourceType.OIL]: 0,
        [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0,
        [ResourceType.DIAMOND]: 0
    };
    Object.entries(units).forEach(([uType, count]) => {
        const def = UNIT_DEFS[uType];
        if (def && count) {
            cost[ResourceType.MONEY] += def.cost.money * count;
            cost[ResourceType.OIL] += def.cost.oil * count;
            cost[ResourceType.AMMO] += def.cost.ammo * count;
            if (def.cost.diamond) cost[ResourceType.DIAMOND] += def.cost.diamond * count;
        }
    });
    return cost;
};

const calculateUnitCP = (uType) => {
    const def = UNIT_DEFS[uType];
    const moneyVal = def.cost.money * BASE_PRICES[ResourceType.MONEY];
    const oilVal = def.cost.oil * BASE_PRICES[ResourceType.OIL];
    const ammoVal = def.cost.ammo * BASE_PRICES[ResourceType.AMMO];
    const goldVal = (def.cost.diamond || 0) * BASE_PRICES[ResourceType.DIAMOND]; 
    return moneyVal + oilVal + ammoVal + goldVal;
};

const calculateUnitMetrics = (uType, tier) => {
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

const UNIT_COUNTERS = {
    [UnitType.CYBER_MARINE]: [UnitType.CYBER_MARINE, UnitType.HEAVY_COMMANDO],
    [UnitType.HEAVY_COMMANDO]: [UnitType.CYBER_MARINE, UnitType.HEAVY_COMMANDO, UnitType.SCOUT_TANK],
    [UnitType.SCOUT_TANK]: [UnitType.SCOUT_TANK, UnitType.TITAN_MBT],
    [UnitType.TITAN_MBT]: [UnitType.TITAN_MBT, UnitType.WRAITH_GUNSHIP],
    [UnitType.WRAITH_GUNSHIP]: [UnitType.WRAITH_GUNSHIP, UnitType.ACE_FIGHTER],
    [UnitType.ACE_FIGHTER]: [UnitType.ACE_FIGHTER, UnitType.AEGIS_DESTROYER],
    [UnitType.AEGIS_DESTROYER]: [UnitType.AEGIS_DESTROYER, UnitType.PHANTOM_SUB],
    [UnitType.PHANTOM_SUB]: [UnitType.PHANTOM_SUB],
    [UnitType.SALVAGER_DRONE]: []
};

const UNITS_BY_TIER = {
    1: [UnitType.CYBER_MARINE, UnitType.SCOUT_TANK, UnitType.AEGIS_DESTROYER],
    2: [UnitType.HEAVY_COMMANDO, UnitType.TITAN_MBT, UnitType.WRAITH_GUNSHIP],
    3: [UnitType.ACE_FIGHTER, UnitType.PHANTOM_SUB, UnitType.TITAN_MBT, UnitType.WRAITH_GUNSHIP],
    4: [UnitType.PHANTOM_SUB, UnitType.ACE_FIGHTER]
};

const UNIT_ByScore = [
    UnitType.CYBER_MARINE,
    UnitType.HEAVY_COMMANDO,
    UnitType.SCOUT_TANK,
    UnitType.TITAN_MBT,
    UnitType.WRAITH_GUNSHIP,
    UnitType.ACE_FIGHTER,
    UnitType.AEGIS_DESTROYER,
    UnitType.PHANTOM_SUB
];

const getUnitsByScoreRange = (score) => {
    if (score < 500) return UNIT_ByScore.slice(0, 1);
    if (score < 1500) return UNIT_ByScore.slice(0, 2);
    if (score < 3000) return UNIT_ByScore.slice(0, 3);
    if (score < 6000) return UNIT_ByScore.slice(0, 4);
    if (score < 15000) return UNIT_ByScore.slice(0, 5);
    if (score < 30000) return UNIT_ByScore.slice(0, 6);
    if (score < 60000) return UNIT_ByScore.slice(0, 7);
    return UNIT_ByScore;
};

const PERSONALITY_BUDGET_SPLIT = {
    [BotPersonality.WARLORD]: { attackRatio: 0.70, defenseRatio: 0.30 },
    [BotPersonality.TURTLE]: { attackRatio: 0.30, defenseRatio: 0.70 },
    [BotPersonality.TYCOON]: { attackRatio: 0.50, defenseRatio: 0.50 },
    [BotPersonality.ROGUE]: { attackRatio: 0.60, defenseRatio: 0.40 }
};

const buildRapidFireCounterMap = (enemyArmy) => {
    const counterMap = {};
    Object.entries(enemyArmy).forEach(([uKey, count]) => {
        if (!count || count <= 0) return;
        Object.values(UnitType).forEach(botUnit => {
            const rf = UNIT_DEFS[botUnit]?.rapidFire;
            if (rf && rf[uKey] !== undefined) {
                counterMap[botUnit] = (counterMap[botUnit] || 0) + count;
            }
        });
    });
    return counterMap;
};

const getSmartUnitComposition = (budget, personality, isDefense, availableUnits, playerArmy) => {
    const army = {};
    const strategy = PERSONALITY_STRATEGY[personality][isDefense ? 'defense' : 'offense'];
    const unitMetricsList = availableUnits.map((uType, idx) => calculateUnitMetrics(uType, idx + 1));

    const getTierCategory = (tier) => {
        if (tier >= 4) return 'heavy';
        if (tier >= 2) return 'medium';
        return 'light';
    };

    const counterMap = playerArmy && Object.keys(playerArmy).length > 0 ? buildRapidFireCounterMap(playerArmy) : null;
    const totalPlayerUnits = playerArmy ? Object.values(playerArmy).reduce((acc, v) => acc + (v || 0), 0) : 0;

    unitMetricsList.forEach(metric => {
        let score = 0;
        const tierIdx = strategy.tierFocus.indexOf(metric.tier);
        if (tierIdx !== -1) score += (strategy.tierFocus.length - tierIdx) * 10;
        if (strategy.categories.includes(metric.category)) score += 15;
        if (isDefense) {
            score += (metric.hpPerCost * 100);
            score += (metric.defense * 0.5);
        } else {
            score += (metric.dpsPerCost * 100);
            score += (metric.attack * 0.3);
        }
        if (metric.tier === 4 && Math.random() < strategy.eliteThreshold) score += 20;
        if (counterMap && totalPlayerUnits > 0) {
            const counteredUnits = counterMap[metric.type] || 0;
            const counterRatio = counteredUnits / totalPlayerUnits;
            score += counterRatio * 50;
        }
        metric.synergyScore = score;
    });

    const sortedUnits = [...unitMetricsList].sort((a, b) => b.synergyScore - a.synergyScore);
    const budgetByTier = {
        heavy: budget * strategy.ratio.heavy,
        medium: budget * strategy.ratio.medium,
        light: budget * strategy.ratio.light
    };

    const allocatedUnits = new Set();
    const allocateByTier = (tier) => {
        const tierBudget = budgetByTier[tier];
        if (tierBudget < 100) return;
        const tierUnits = sortedUnits.filter(u => getTierCategory(u.tier) === tier && !allocatedUnits.has(u.type) && strategy.categories.includes(u.category));
        if (tierUnits.length === 0) return;
        const primaryUnit = tierUnits[0];
        const count = Math.max(1, Math.floor(tierBudget * 0.6 / primaryUnit.cost));
        const cost = count * primaryUnit.cost;
        if (cost <= tierBudget) {
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
        const affordableUnits = sortedUnits.filter(u => !allocatedUnits.has(u.type) && u.cost <= leftoverBudget).slice(0, 2);
        affordableUnits.forEach(u => {
            const count = Math.max(1, Math.floor(leftoverBudget * 0.3 / u.cost));
            army[u.type] = (army[u.type] || 0) + count;
        });
    }

    if (Object.keys(army).length === 0 && availableUnits.length > 0) {
        army[availableUnits[0]] = Math.max(1, Math.floor(budget / calculateUnitCP(availableUnits[0])));
    }
    return army;
};

export const generateBotArmy = (targetScore, budgetMultiplier = 1.0, personality, playerArmy) => {
    const totalBudget = targetScore * 4000 * budgetMultiplier;
    const availableUnits = getUnitsByScoreRange(targetScore);
    const activePersonality = personality || BotPersonality.WARLORD;
    const budgetSplit = PERSONALITY_BUDGET_SPLIT[activePersonality];
    const attackArmy = getSmartUnitComposition(totalBudget * budgetSplit.attackRatio, activePersonality, false, availableUnits, playerArmy);
    const defenseArmy = getSmartUnitComposition(totalBudget * budgetSplit.defenseRatio, activePersonality, true, availableUnits);
    const combinedArmy = { ...attackArmy };
    Object.entries(defenseArmy).forEach(([uType, count]) => {
        combinedArmy[uType] = (combinedArmy[uType] || 0) + (count || 0);
    });
    return combinedArmy;
};

export const generateBotBuildings = (score) => {
    const totalBuildings = Math.max(10, Math.floor(score / BOT_BUILDINGS_PER_SCORE));
    const weights = {
        [BuildingType.HOUSE]: 50, [BuildingType.FACTORY]: 20, [BuildingType.OIL_RIG]: 10,
        [BuildingType.MUNITIONS_FACTORY]: 10, [BuildingType.GOLD_MINE]: 8, [BuildingType.SKYSCRAPER]: 2
    };
    const buildings = {};
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    let remaining = totalBuildings;
    PLUNDERABLE_BUILDINGS.forEach(bType => {
        const weight = weights[bType] || 0;
        const count = Math.floor(totalBuildings * (weight / totalWeight));
        buildings[bType] = count;
        remaining -= count;
    });
    buildings[BuildingType.HOUSE] = (buildings[BuildingType.HOUSE] || 0) + remaining;
    return buildings;
};

export const generateEnemyForce = (playerUnits, patrolLevel = 1, isAmbush = false) => {
    const playerBudget = calculateTotalUnitCost(playerUnits);
    if (playerBudget <= 0) return { [UnitType.CYBER_MARINE]: 1 };
    const baseMultiplier = isAmbush ? (1.2 + (patrolLevel * 0.15)) : (0.4 + (patrolLevel * 0.15));
    const enemyBudget = playerBudget * baseMultiplier;
    const targetScore = Math.max(10, enemyBudget / SCORE_TO_RESOURCE_VALUE);
    return generateBotArmy(targetScore, 1.0);
};

const getPatrolLevel = (duration) => {
    if (duration <= 5) return 1;
    if (duration <= 15) return 2;
    if (duration <= 30) return 3;
    return 4; 
};

export const resolveMission = (
    mission, currentResources, maxResources, currentCampaignProgress,
    techLevels = {}, activeWar = null, now = Date.now(), rankingBots = [],
    empirePoints = 0, buildings = {}, attackCounts = {}, spyReports = [], playerName = 'Player'
) => {
    let resultResources = { ...currentResources };
    let unitsToReturn = {};
    let buildingsToAdd = {};
    let logKey = '';
    let logType = 'mission'; 
    let logParams = {};
    let newCampaignProgress = currentCampaignProgress;
    let warLootAdded;
    let warVictory = false;
    let warDefeat = false;
    let newGrudge;
    let reputationChanges = [];
    let generatedLogisticLoot;

    if (mission.type === 'PVP_ATTACK' && mission.targetScore !== undefined) {
        let botArmy = {};
        const isWarAttack = mission.isWarAttack && activeWar && (activeWar.enemyId === mission.targetId);
        const targetBot = rankingBots.find(b => b.id === mission.targetId);
        const targetPersonality = targetBot?.personality || BotPersonality.WARLORD;

        if (isWarAttack && activeWar) {
            const attackNum = WAR_PLAYER_ATTACKS - activeWar.playerAttacksLeft + 1;
            if (attackNum === 6) {
                botArmy = generateBotArmy(mission.targetScore, 1.0 / BOT_BUDGET_RATIO, targetPersonality);
            } else {
                botArmy = activeWar.currentEnemyGarrison || {};
            }
        } else {
            const spyReport = spyReports.find(r => r.botId === mission.targetId && r.expiresAt > now);
            if (spyReport) {
                botArmy = spyReport.units;
            } else if (targetBot) {
                const defenseRatio = PERSONALITY_BUDGET_SPLIT[targetPersonality].defenseRatio;
                botArmy = getSmartUnitComposition(targetBot.stats.DOMINION * 4000 * defenseRatio, targetPersonality, true, getUnitsByScoreRange(targetBot.stats.DOMINION));
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
                activeWar.playerResourceLosses[k] = (activeWar.playerResourceLosses[k] || 0) + pResLoss[k];
                activeWar.enemyResourceLosses[k] = (activeWar.enemyResourceLosses[k] || 0) + eResLoss[k];
            });
            activeWar.playerUnitLosses += Object.values(battleResult.totalPlayerCasualties).reduce((a, b) => a + (b || 0), 0);
            activeWar.enemyUnitLosses += Object.values(battleResult.totalEnemyCasualties).reduce((a, b) => a + (b || 0), 0);
            warLootAdded = {};
        }

        if (battleResult.winner === 'PLAYER') {
            logKey = 'log_battle_win'; 
            if (isWarAttack) {
                warVictory = true;
                logParams = { combatResult: battleResult, targetName: mission.targetName };
            } else {
                const count = (attackCounts[mission.targetId] || 1) - 1;
                const safeCount = Math.max(0, Math.min(count, 2)); 
                const plunderPercentage = PLUNDER_RATES[safeCount];
                const botBuildings = generateBotBuildings(mission.targetScore);
                const stolenBuildings = {};
                PLUNDERABLE_BUILDINGS.forEach(bType => {
                    const totalQty = botBuildings[bType] || 0;
                    let baseForCalculation = totalQty;
                    if (safeCount === 1) baseForCalculation = Math.floor(totalQty * (1 - PLUNDER_RATES[0]));
                    if (safeCount === 2) {
                        baseForCalculation = Math.floor(Math.floor(totalQty * (1 - PLUNDER_RATES[0])) * (1 - PLUNDER_RATES[1]));
                    }
                    const stolenAmount = Math.floor(baseForCalculation * plunderPercentage);
                    if (stolenAmount > 0) stolenBuildings[bType] = stolenAmount;
                });
                logParams = { combatResult: battleResult, buildingLoot: stolenBuildings, loot: {}, targetName: mission.targetName };
                if (targetBot) {
                    if (Math.random() < getRetaliationChance(targetBot.personality)) {
                        newGrudge = {
                            id: `grudge-${now}`, botId: targetBot.id, botName: targetBot.name,
                            botPersonality: targetBot.personality, botScore: targetBot.stats.DOMINION,
                            createdAt: now, retaliationTime: calculateRetaliationTime(now), notified: false
                        };
                    }
                    reputationChanges.push({ botId: targetBot.id, change: REPUTATION_ATTACK_PENALTY, type: ReputationChangeType.DEFEND_LOSS, reason: 'player_attack_win' });
                }
            }
        } else {
            logKey = 'log_battle_loss';
            if (Object.values(battleResult.finalPlayerArmy).reduce((a, b) => a + (b || 0), 0) === 0) logKey = 'log_wipeout';
            if (isWarAttack) warDefeat = true;
            logParams = { combatResult: battleResult, targetName: mission.targetName };
            if (!isWarAttack && mission.targetId) {
                reputationChanges.push({ botId: mission.targetId, change: REPUTATION_WIN_BONUS, type: ReputationChangeType.DEFEND_WIN, reason: 'player_attack_loss' });
            }
        }
        if (newGrudge) logParams.grudgeData = { attacker: newGrudge.botName, retaliationTime: newGrudge.retaliationTime };
        generatedLogisticLoot = generateLogisticLootFromCombat(battleResult, 'RAID', mission.id, { attackerId: 'PLAYER', attackerName: playerName, defenderId: mission.targetId || 'BOT', defenderName: mission.targetName || 'Unknown' });
    } else if (mission.type === 'CAMPAIGN_ATTACK' && mission.levelId) {
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
                   resultResources[r] = Math.min(maxResources[r], resultResources[r] + qty);
               });
               logParams.loot = level.reward;
               if (mission.levelId === currentCampaignProgress) newCampaignProgress = mission.levelId + 1;
           }
        } else {
            logKey = 'log_battle_loss';
            if (Object.values(battleResult.finalPlayerArmy).reduce((a, b) => a + (b || 0), 0) === 0) logKey = 'log_wipeout';
        }
        generatedLogisticLoot = generateLogisticLootFromCombat(battleResult, 'CAMPAIGN', mission.id, { attackerId: 'PLAYER', attackerName: playerName, defenderId: `CAMPAIGN-${mission.levelId}`, defenderName: `Campaign Target` });
    } else if (mission.type === 'PATROL') {
        const patrolLevel = getPatrolLevel(mission.duration);
        const roll = Math.random() * 100; 
        const fleetValue = calculateTotalUnitCost(mission.units);
        const baseLootCapacity = fleetValue * 0.05 * patrolLevel;
        if (roll < 45) {
            logKey = 'log_patrol_nothing';
            unitsToReturn = mission.units; 
        } else if (roll < 55) {
            logKey = 'log_patrol_ambush';
            logType = 'combat';
            let patrolMultiplier = 1.0 + ((techLevels[TechType.PATROL_TRAINING] || 0) * 0.05);
            const enemyForces = generateEnemyForce(mission.units, patrolLevel, true);
            const battleResult = simulateCombat(mission.units, enemyForces, patrolMultiplier, undefined, patrolMultiplier, patrolMultiplier);
            unitsToReturn = battleResult.finalPlayerArmy;
            if (battleResult.winner === 'PLAYER') {
                logKey = 'log_patrol_battle_win';
                const lootAmount = calculateTotalUnitCost(unitsToReturn) * 0.15 * patrolLevel; 
                const loot = { [ResourceType.MONEY]: Math.floor(lootAmount), [ResourceType.OIL]: Math.floor(lootAmount * 0.1) };
                Object.entries(loot).forEach(([r, qty]) => { resultResources[r] = Math.min(maxResources[r], resultResources[r] + qty); });
                logParams = { combatResult: battleResult, loot };
            } else {
                logKey = 'log_patrol_battle_loss';
                if (Object.values(battleResult.finalPlayerArmy).reduce((a, b) => a + (b || 0), 0) === 0) logKey = 'log_wipeout';
                logParams = { combatResult: battleResult };
            }
        } else if (roll < 75) {
            let patrolMultiplier = 1.0 + ((techLevels[TechType.PATROL_TRAINING] || 0) * 0.05);
            const enemyForces = generateEnemyForce(mission.units, patrolLevel, false);
            const battleResult = simulateCombat(mission.units, enemyForces, patrolMultiplier, undefined, patrolMultiplier, patrolMultiplier);
            unitsToReturn = battleResult.finalPlayerArmy;
            logType = 'combat';
            if (battleResult.winner === 'PLAYER') {
                logKey = 'log_patrol_battle_win';
                const lootAmount = calculateTotalUnitCost(unitsToReturn) * 0.05 * patrolLevel;
                const loot = { [ResourceType.MONEY]: Math.floor(lootAmount), [ResourceType.OIL]: Math.floor(lootAmount * 0.05) };
                Object.entries(loot).forEach(([r, qty]) => { resultResources[r] = Math.min(maxResources[r], resultResources[r] + qty); });
                logParams = { combatResult: battleResult, loot };
            } else {
                logKey = 'log_patrol_battle_loss';
                if (Object.values(battleResult.finalPlayerArmy).reduce((a, b) => a + (b || 0), 0) === 0) logKey = 'log_wipeout';
                logParams = { combatResult: battleResult };
            }
        } else {
            logKey = 'log_patrol_contraband';
            unitsToReturn = mission.units; 
            const loot = { [ResourceType.MONEY]: Math.floor(baseLootCapacity), [ResourceType.AMMO]: Math.floor(baseLootCapacity * 0.1) };
            Object.entries(loot).forEach(([r, qty]) => { resultResources[r] = Math.min(maxResources[r], resultResources[r] + qty); });
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
        newGrudge, 
        reputationChanges, 
        generatedLogisticLoot,
        // NEW: Data for the defender (Perspective Swap)
        defenderUpdates: (mission.type === 'PVP_ATTACK' && mission.targetId && !mission.targetId.startsWith('bot-')) ? {
            targetId: mission.targetId,
            logKey: battleResult.winner === 'PLAYER' ? 'log_defense_loss' : 'log_defense_win',
            logParams: {
                combatResult: {
                    ...battleResult,
                    winner: battleResult.winner === 'PLAYER' ? 'ENEMY' : (battleResult.winner === 'ENEMY' ? 'PLAYER' : 'DRAW'),
                    // Intercambio de Armadas
                    initialPlayerArmy: battleResult.initialEnemyArmy,
                    initialEnemyArmy: battleResult.initialPlayerArmy,
                    finalPlayerArmy: battleResult.finalEnemyArmy,
                    finalEnemyArmy: battleResult.finalPlayerArmy,
                    // Intercambio de Bajas
                    totalPlayerCasualties: battleResult.totalEnemyCasualties,
                    totalEnemyCasualties: battleResult.totalPlayerCasualties,
                    // Intercambio de Rendimiento
                    playerPerformance: battleResult.enemyPerformance,
                    enemyPerformance: battleResult.playerPerformance,
                    // Intercambio de HP
                    playerTotalHpStart: battleResult.enemyTotalHpStart,
                    playerTotalHpLost: battleResult.enemyTotalHpLost,
                    enemyTotalHpStart: battleResult.playerTotalHpStart,
                    enemyTotalHpLost: battleResult.playerTotalHpLost,
                    // Intercambio de Daño
                    playerDamageDealt: battleResult.enemyDamageDealt,
                    enemyDamageDealt: battleResult.playerDamageDealt
                },
                attacker: playerName
            },
            unitsLost: battleResult.totalEnemyCasualties,
            buildingsLost: buildingsToAdd 
        } : null
    };
};
