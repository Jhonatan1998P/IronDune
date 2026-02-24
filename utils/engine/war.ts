
import { BuildingType, GameState, IncomingAttack, LogEntry, ResourceType, UnitType, WarState } from '../../types';
import { RankingCategory } from './rankings';
import { WAR_TOTAL_WAVES, WAR_PLAYER_ATTACKS, PVP_TRAVEL_TIME_MS, WAR_DURATION_MS, WAR_WAVE_INTERVAL_MS, WAR_OVERTIME_MS, WAR_COOLDOWN_MS, NEWBIE_PROTECTION_THRESHOLD, BOT_BUDGET_RATIO, PLUNDERABLE_BUILDINGS, PLUNDER_RATES, ATTACK_COOLDOWN_MIN_MS, ATTACK_COOLDOWN_MAX_MS, REPUTATION_ENEMY_THRESHOLD, REPUTATION_ALLY_THRESHOLD, REPUTATION_ALLY_DEFEND_CHANCE, REPUTATION_DEFEND_BONUS, REPUTATION_MIN, REPUTATION_MAX } from '../../constants';
import { generateBotArmy, calculateResourceCost } from './missions';
import { calculateMaxBankCapacity } from './modifiers';
import { simulateCombat } from './combat';
import { BotPersonality } from '../../types/enums';

export const generateWarWave = (state: GameState, waveNumber: number, warState: WarState, specificEndTime?: number): IncomingAttack => {
    let budgetRatio = 0.05; 
    if (waveNumber === 1) budgetRatio = 0.05;       
    else if (waveNumber === 2) budgetRatio = 0.08;  
    else if (waveNumber === 3) budgetRatio = 0.10;  
    else if (waveNumber === 4) budgetRatio = 0.12;  
    else if (waveNumber <= 7) budgetRatio = 0.15;   
    else if (waveNumber === 8) budgetRatio = 0.20;  

    if (waveNumber > 8) {
        budgetRatio = 0.20 + ((waveNumber - 8) * 0.05); 
    }

    const enemyForce = generateBotArmy(warState.enemyScore, budgetRatio);
    const now = Date.now();
    const endTime = specificEndTime || (now + PVP_TRAVEL_TIME_MS);
    
    return {
        id: `war-wave-${waveNumber}-${now}`,
        attackerName: `${warState.enemyName} (Wave ${waveNumber})`,
        attackerScore: warState.enemyScore,
        units: enemyForce,
        startTime: endTime - PVP_TRAVEL_TIME_MS,
        endTime: endTime, 
        isWarWave: true,
        delayCount: 0
    };
};

export const startWar = (state: GameState, targetId?: string, targetName?: string, targetScore?: number): GameState => {
    let enemyId = targetId || '';
    let enemyName = targetName || '';
    let enemyScore = targetScore || 0;

    if (!enemyId) {
        const bots = state.rankingData.bots;
        const validBots = bots.filter(b => {
            const ratio = b.stats[RankingCategory.DOMINION] / Math.max(1, state.empirePoints);
            return ratio >= 0.5 && ratio <= 1.5;
        });

        if (validBots.length > 0) {
            const bot = validBots[Math.floor(Math.random() * validBots.length)];
            enemyId = bot.id;
            enemyName = bot.name;
            enemyScore = bot.stats[RankingCategory.DOMINION];
        } else {
            enemyId = 'bot-system-rival';
            enemyName = 'Rival Warlord';
            enemyScore = Math.max(1000, state.empirePoints); 
        }
    }

    const now = Date.now();
    const zeroResources = {
        [ResourceType.MONEY]: 0,
        [ResourceType.OIL]: 0,
        [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0,
        [ResourceType.DIAMOND]: 0
    };

    const fullBudgetMultiplier = 1.0 / BOT_BUDGET_RATIO;
    const initialGarrison = generateBotArmy(enemyScore, fullBudgetMultiplier);
    const firstWaveEndTime = now + PVP_TRAVEL_TIME_MS;

    const warState: WarState = {
        id: `war-${now}`,
        enemyId,
        enemyName,
        enemyScore,
        startTime: now,
        duration: WAR_DURATION_MS, 
        nextWaveTime: firstWaveEndTime, 
        currentWave: 1,
        totalWaves: WAR_TOTAL_WAVES, 
        playerVictories: 0,
        enemyVictories: 0,
        playerAttacksLeft: WAR_PLAYER_ATTACKS,
        lootPool: { ...zeroResources },
        playerResourceLosses: { ...zeroResources },
        enemyResourceLosses: { ...zeroResources },
        playerUnitLosses: 0,
        enemyUnitLosses: 0,
        currentEnemyGarrison: initialGarrison 
    };

    const firstWave = generateWarWave(state, 1, warState, firstWaveEndTime);

    return {
        ...state,
        activeWar: warState,
        incomingAttacks: [...state.incomingAttacks, firstWave]
    };
};

export const distributeWarLoot = (
    pool: Record<ResourceType, number>, 
    winner: 'PLAYER' | 'ENEMY' | 'DRAW',
    currentResources: Record<ResourceType, number>,
    maxResources: Record<ResourceType, number>,
    currentBank: number,
    empirePoints: number,
    buildings: Record<BuildingType, { level: number }>
): { newResources: Record<ResourceType, number>, newBank: number, resultKey: string, payoutMessage: string, convertedAmount: number, bankedAmount: number } => {
    
    if (winner !== 'PLAYER') {
        return { 
            newResources: currentResources, 
            newBank: currentBank, 
            resultKey: 'defeat_salvage',
            payoutMessage: 'Defeat. Enemy salvaged the battlefield.',
            convertedAmount: 0,
            bankedAmount: 0
        };
    }

    const payoutFactor = 0.5;
    const nextResources = { ...currentResources };
    let nextBank = currentBank;
    let totalCashToAdd = Math.floor(pool[ResourceType.MONEY] * payoutFactor);
    let convertedCash = 0;

    const physicalResources = [ResourceType.OIL, ResourceType.AMMO, ResourceType.GOLD, ResourceType.DIAMOND];
    const BASE_VALUES: Record<ResourceType, number> = {
        [ResourceType.MONEY]: 1,
        [ResourceType.OIL]: 10,
        [ResourceType.AMMO]: 5,
        [ResourceType.GOLD]: 50,
        [ResourceType.DIAMOND]: 500
    };
    
    physicalResources.forEach(res => {
        const amount = Math.floor(pool[res] * payoutFactor);
        if (amount > 0) {
            const current = nextResources[res];
            const max = maxResources[res];
            
            if (current + amount > max) {
                nextResources[res] = max;
                const excess = (current + amount) - max;
                
                // Base values for conversion fallback
                const conversionFactors: Record<string, number> = {
                    'OIL': 10,
                    'AMMO': 5,
                    'GOLD': 50,
                    'DIAMOND': 500
                };
                
                const conversion = excess * (conversionFactors[res] || 10);
                totalCashToAdd += conversion;
                convertedCash += conversion;
            } else {
                nextResources[res] += amount;
            }
        }
    });

    let bankedAmount = 0;
    const moneyMax = maxResources[ResourceType.MONEY];
    
    if (nextResources[ResourceType.MONEY] + totalCashToAdd > moneyMax) {
        const spaceInWallet = moneyMax - nextResources[ResourceType.MONEY];
        nextResources[ResourceType.MONEY] = moneyMax;
        
        let remainingCash = totalCashToAdd - spaceInWallet;

        const bankLevel = buildings[BuildingType.BANK]?.level || 0;
        if (bankLevel > 0) {
            const bankMax = calculateMaxBankCapacity(empirePoints, bankLevel);
            const spaceInBank = bankMax - nextBank;
            
            if (remainingCash > spaceInBank) {
                nextBank = bankMax;
                bankedAmount = spaceInBank;
            } else {
                nextBank += remainingCash;
                bankedAmount = remainingCash;
            }
        }
    } else {
        nextResources[ResourceType.MONEY] += totalCashToAdd;
    }

    let msg = 'VICTORY! Resources secured.';
    if (convertedCash > 0) msg += ` Overflow converted to $${Math.floor(convertedCash)}.`;
    if (bankedAmount > 0) msg += ` $${Math.floor(bankedAmount)} wired to Bank.`;

    return { newResources: nextResources, newBank: nextBank, resultKey: 'war_victory_secured', payoutMessage: msg, convertedAmount: convertedCash, bankedAmount };
};

export const processWarTick = (state: GameState, now: number): { stateUpdates: Partial<GameState>, logs: LogEntry[] } => {
    const logs: LogEntry[] = [];
    let currentIncomingAttacks = [...state.incomingAttacks];
    let nextAttackTime = state.nextAttackTime || (now + (3 * 60 * 60 * 1000));
    
    if (!state.activeWar) {
        const isProtected = state.empirePoints <= NEWBIE_PROTECTION_THRESHOLD;

        if (!isProtected && now >= nextAttackTime) {
            // Trigger Random Attack
            const bots = state.rankingData.bots;
            
            // Weight bots by reputation - enemies more likely, allies less likely
            const weightedBots = bots.map(bot => {
                const rep = bot.reputation || 50;
                let weight = 1.0;
                if (rep < REPUTATION_ENEMY_THRESHOLD) {
                    weight = 2.0; // Enemies are more aggressive
                } else if (rep >= REPUTATION_ALLY_THRESHOLD) {
                    weight = 0.3; // Allies are less likely to attack
                }
                return { bot, weight };
            });

            const validBots = bots.filter(b => {
                const ratio = b.stats[RankingCategory.DOMINION] / Math.max(1, state.empirePoints);
                return ratio >= 0.5 && ratio <= 1.5; 
            });

            let enemyId = 'bot-system-rival';
            let enemyName = 'Rival Warlord';
            let enemyScore = Math.max(1000, state.empirePoints * 1.1);

            if (validBots.length > 0) {
                // Filter to valid range first, then weight selection
                const weightedValid = weightedBots.filter(w => {
                    const ratio = w.bot.stats[RankingCategory.DOMINION] / Math.max(1, state.empirePoints);
                    return ratio >= 0.5 && ratio <= 1.5;
                });
                
                if (weightedValid.length > 0) {
                    const totalWeight = weightedValid.reduce((sum, w) => sum + w.weight, 0);
                    let random = Math.random() * totalWeight;
                    for (const w of weightedValid) {
                        random -= w.weight;
                        if (random <= 0) {
                            enemyId = w.bot.id;
                            enemyName = w.bot.name;
                            enemyScore = w.bot.stats[RankingCategory.DOMINION];
                            break;
                        }
                    }
                }
            }

            const fullPowerArmy = generateBotArmy(enemyScore, 1.0);
            const arrivalTime = now + PVP_TRAVEL_TIME_MS;

            const raidAttack: IncomingAttack = {
                id: `bot-raid-${now}`,
                attackerName: enemyName,
                attackerScore: enemyScore,
                units: fullPowerArmy,
                startTime: now,
                endTime: arrivalTime,
                isWarWave: false, 
                delayCount: 0
            };

            currentIncomingAttacks.push(raidAttack);
            
            // Set next attack time (1-6 hours)
            const wait = ATTACK_COOLDOWN_MIN_MS + Math.random() * (ATTACK_COOLDOWN_MAX_MS - ATTACK_COOLDOWN_MIN_MS);
            nextAttackTime = now + wait;

            logs.push({ 
                id: `bot-alert-${now}`, 
                messageKey: 'alert_incoming', 
                type: 'combat', 
                timestamp: now, 
                params: { attacker: enemyName } 
            });
        }
    }

    const newUnits = { ...state.units };
    const newResources = { ...state.resources };
    const newBuildings = { ...state.buildings }; 
    const newLifetimeStats = { ...state.lifetimeStats };
    const activeWar = state.activeWar ? { ...state.activeWar } : null;

    const remainingAttacks = currentIncomingAttacks.filter(attack => {
        if (now >= attack.endTime) {
            const result = simulateCombat(newUnits, attack.units, 1.0);
            Object.keys(newUnits).forEach(u => newUnits[u as UnitType] = result.finalPlayerArmy[u as UnitType] || 0);
            
            const pLost = Object.values(result.totalPlayerCasualties).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
            const eLost = Object.values(result.totalEnemyCasualties).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
            newLifetimeStats.unitsLost += pLost;
            newLifetimeStats.enemiesKilled += eLost;

            let stolenBuildingsLog: Partial<Record<BuildingType, number>> = {};

            if (attack.isWarWave && activeWar) {
                const pResLoss = calculateResourceCost(result.totalPlayerCasualties);
                const eResLoss = calculateResourceCost(result.totalEnemyCasualties);
                
                Object.keys(pResLoss).forEach(k => {
                    const r = k as ResourceType;
                    activeWar.playerResourceLosses[r] += pResLoss[r];
                    activeWar.enemyResourceLosses[r] += eResLoss[r];
                    activeWar.lootPool[r] += (pResLoss[r] + eResLoss[r]);
                });
                
                activeWar.playerUnitLosses += pLost;
                activeWar.enemyUnitLosses += eLost;

                if (result.winner === 'PLAYER') activeWar.playerVictories++;
                else activeWar.enemyVictories++;

                logs.push({
                    id: `war-def-${now}-${attack.id}`,
                    messageKey: result.winner === 'PLAYER' ? 'log_defense_win' : 'log_defense_loss',
                    type: 'combat',
                    timestamp: now,
                    params: { combatResult: result, attacker: attack.attackerName }
                });

            } else {
                if (result.winner !== 'PLAYER') {
                    const plunderRate = PLUNDER_RATES[0]; 
                    PLUNDERABLE_BUILDINGS.forEach(bType => {
                        const currentLvl = newBuildings[bType].level;
                        if (currentLvl > 0) {
                            const stolen = Math.floor(currentLvl * plunderRate);
                            if (stolen > 0) {
                                newBuildings[bType] = { ...newBuildings[bType], level: currentLvl - stolen };
                                stolenBuildingsLog[bType] = stolen;
                            }
                        }
                    });

                    if (newBuildings[BuildingType.DIAMOND_MINE].level > 0) {
                        newBuildings[BuildingType.DIAMOND_MINE] = {
                            ...newBuildings[BuildingType.DIAMOND_MINE],
                            isDamaged: true
                        };
                        stolenBuildingsLog[BuildingType.DIAMOND_MINE] = 1; 
                    }
                }
                
                // Ally defense system: allies may help when player defends successfully
                if (result.winner === 'PLAYER' && !attack.isWarWave) {
                    const allies = state.rankingData.bots.filter(b => (b.reputation || 50) >= REPUTATION_ALLY_THRESHOLD);
                    if (allies.length > 0 && Math.random() < REPUTATION_ALLY_DEFEND_CHANCE) {
                        const defender = allies[Math.floor(Math.random() * allies.length)];
                        const allyReinforcement = generateBotArmy(defender.stats[RankingCategory.DOMINION] * 0.5, 1.0);
                        const arrivalTime = now + (5 * 60 * 1000); // 5 minutes
                        
                        const allyAttack: IncomingAttack = {
                            id: `ally-defend-${now}-${defender.id}`,
                            attackerName: `${defender.name} (Reinforcements)`,
                            attackerScore: defender.stats[RankingCategory.DOMINION] * 0.5,
                            units: allyReinforcement,
                            startTime: now,
                            endTime: arrivalTime,
                            isWarWave: false,
                            delayCount: 0
                        };
                        currentIncomingAttacks.push(allyAttack);
                        
                        logs.push({
                            id: `ally-help-${now}`,
                            messageKey: 'log_ally_reinforcement',
                            type: 'combat',
                            timestamp: now,
                            params: { allyName: defender.name }
                        });
                    }
                }
                
                logs.push({
                    id: `raid-def-${now}-${attack.id}`,
                    messageKey: result.winner === 'PLAYER' ? 'log_defense_win' : 'log_defense_loss',
                    type: 'combat',
                    timestamp: now,
                    params: { 
                        combatResult: result, 
                        attacker: attack.attackerName,
                        buildingLoot: stolenBuildingsLog 
                    }
                });
            }
            return false; 
        }
        return true; 
    });

    if (activeWar) {
        const isWaveInFlight = remainingAttacks.some(a => a.isWarWave);
        const isTimeUp = now >= activeWar.startTime + activeWar.duration;

        if (isTimeUp && isWaveInFlight) {
            remainingAttacks.forEach(a => { if (a.isWarWave) a.endTime = now; });
        }

        if (isTimeUp && !isWaveInFlight) {
            if (activeWar.playerVictories === activeWar.enemyVictories) {
                activeWar.duration += WAR_OVERTIME_MS;
                activeWar.totalWaves += 1;
                activeWar.playerAttacksLeft += 1;
                activeWar.nextWaveTime = now;
                logs.push({ id: `war-ot-${now}`, messageKey: 'log_war_overtime', type: 'war', timestamp: now });
            } else {
                const winner = activeWar.playerVictories > activeWar.enemyVictories ? 'PLAYER' : 'ENEMY';
                const resolution = distributeWarLoot(activeWar.lootPool, winner, newResources, state.maxResources, state.bankBalance, state.empirePoints, newBuildings);
                
                logs.push({ 
                    id: `war-end-${now}`, 
                    messageKey: 'log_war_ended', 
                    type: 'war', 
                    timestamp: now, 
                    params: { 
                        resultKey: resolution.resultKey, 
                        result: resolution.payoutMessage, 
                        winner, 
                        warSummary: { ...activeWar, convertedAmount: resolution.convertedAmount, bankedAmount: resolution.bankedAmount } 
                    } 
                });

                return {
                    stateUpdates: {
                        activeWar: null,
                        resources: resolution.newResources,
                        bankBalance: resolution.newBank,
                        units: newUnits,
                        buildings: newBuildings, 
                        lifetimeStats: newLifetimeStats,
                        incomingAttacks: remainingAttacks.filter(a => !a.isWarWave) 
                    },
                    logs
                };
            }
        }

        if (activeWar.currentWave <= activeWar.totalWaves && now >= activeWar.nextWaveTime) {
            const nextWave = generateWarWave(state, activeWar.currentWave, activeWar, now + WAR_WAVE_INTERVAL_MS);
            activeWar.nextWaveTime = now + WAR_WAVE_INTERVAL_MS;
            activeWar.currentWave++;
            remainingAttacks.push(nextWave);
        }
    }

    return {
        stateUpdates: {
            nextAttackTime,
            activeWar, 
            units: newUnits,
            resources: newResources,
            buildings: newBuildings, 
            lifetimeStats: newLifetimeStats,
            incomingAttacks: remainingAttacks
        },
        logs
    };
};
