
import { BuildingType, GameState, IncomingAttack, LogEntry, ResourceType, UnitType, WarState } from '../../types';
import { RankingCategory } from './rankings';
import { WAR_TOTAL_WAVES, WAR_PLAYER_ATTACKS, PVP_TRAVEL_TIME_MS, WAR_DURATION_MS, THREAT_PER_DIAMOND_LEVEL_PER_MINUTE, THREAT_THRESHOLD, WAR_WAVE_INTERVAL_MS, WAR_OVERTIME_MS, WAR_COOLDOWN_MS, NEWBIE_PROTECTION_THRESHOLD, BOT_BUDGET_RATIO, PVP_LOOT_FACTOR, PVP_DIAMOND_STEAL_CHANCE } from '../../constants';
import { generateBotArmy, calculateResourceCost } from './missions';
import { BASE_PRICES } from './market';
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

    let personality = BotPersonality.WARLORD; 
    const bot = state.rankingData.bots.find(b => b.id === warState.enemyId);
    if (bot) {
        personality = bot.personality;
    }

    const enemyForce = generateBotArmy(warState.enemyScore, budgetRatio, personality);

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
    let personality = BotPersonality.WARLORD;

    if (!enemyId) {
        const bots = state.rankingData.bots;
        const validBots = bots.filter(b => {
            const ratio = b.stats[RankingCategory.DOMINION] / Math.max(1, state.empirePoints);
            return ratio >= 0.5 && ratio <= 2.0;
        });

        if (validBots.length > 0) {
            const bot = validBots[Math.floor(Math.random() * validBots.length)];
            enemyId = bot.id;
            enemyName = bot.name;
            enemyScore = bot.stats[RankingCategory.DOMINION];
            personality = bot.personality;
        } else {
            enemyId = 'bot-system-rival';
            enemyName = 'Rival Warlord';
            enemyScore = Math.max(1000, state.empirePoints); 
        }
    } else {
        const bot = state.rankingData.bots.find(b => b.id === enemyId);
        if (bot) personality = bot.personality;
    }

    const now = Date.now();
    const zeroResources = {
        [ResourceType.MONEY]: 0,
        [ResourceType.OIL]: 0,
        [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0,
        [ResourceType.DIAMOND]: 0
    };

    // --- GENERATE INITIAL GARRISON (100% BUDGET) ---
    // Calculate multiplier to reach 100% of empire value if ratio < 1.0
    const fullBudgetMultiplier = 1.0 / BOT_BUDGET_RATIO;
    const initialGarrison = generateBotArmy(enemyScore, fullBudgetMultiplier, personality);

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
        currentEnemyGarrison: initialGarrison // Initial Garrison State
    };

    const firstWave = generateWarWave(state, 1, warState, firstWaveEndTime);

    return {
        ...state,
        activeWar: warState,
        threatLevel: 0,
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
    
    physicalResources.forEach(res => {
        const amount = Math.floor(pool[res] * payoutFactor);
        if (amount > 0) {
            const current = nextResources[res];
            const max = maxResources[res];
            
            if (current + amount > max) {
                nextResources[res] = max;
                const excess = (current + amount) - max;
                const conversion = excess * BASE_PRICES[res];
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

    // This is kept for legacy compatibility, but UI should prefer resultKey + computed values
    let msg = 'VICTORY! Resources secured.';
    if (convertedCash > 0) msg += ` Overflow converted to $${Math.floor(convertedCash)}.`;
    if (bankedAmount > 0) msg += ` $${Math.floor(bankedAmount)} wired to Bank.`;

    return { newResources: nextResources, newBank: nextBank, resultKey: 'war_victory_secured', payoutMessage: msg, convertedAmount: convertedCash, bankedAmount };
};

export const processWarTick = (state: GameState, now: number, deltaTimeMs: number): { stateUpdates: Partial<GameState>, logs: LogEntry[] } => {
    const logs: LogEntry[] = [];
    
    // --- 1. LOCAL STATE COPIES ---
    let newThreatLevel = state.threatLevel;
    let newWarCooldownEndTime = state.warCooldownEndTime;
    let currentIncomingAttacks = [...state.incomingAttacks];
    
    // --- 2. THREAT LOGIC (Only in Peace Time) ---
    // This logic runs BEFORE attack processing to potentially spawn a new raid this tick.
    if (!state.activeWar) {
        const isProtected = state.empirePoints <= NEWBIE_PROTECTION_THRESHOLD;
        const inCooldown = now < state.warCooldownEndTime;

        if (isProtected) {
            // Force reset threat if protected
            if (newThreatLevel > 0) newThreatLevel = 0;
        } 
        else if (!inCooldown) {
            // Natural Threat Growth
            const diamondLevel = state.buildings[BuildingType.DIAMOND_MINE]?.level || 0;
            if (diamondLevel > 0) {
                const growth = (diamondLevel * THREAT_PER_DIAMOND_LEVEL_PER_MINUTE) * (deltaTimeMs / 60000);
                newThreatLevel = Math.min(100, newThreatLevel + growth);
            }

            // TRIGGER CONDITION
            if (newThreatLevel >= THREAT_THRESHOLD) {
                // 1. Select Attacker
                let enemyId = 'bot-system-rival';
                let enemyName = 'Rival Warlord';
                let enemyScore = Math.max(1000, state.empirePoints * 1.5);
                let personality = BotPersonality.WARLORD;

                const bots = state.rankingData.bots;
                const validBots = bots.filter(b => {
                    const ratio = b.stats[RankingCategory.DOMINION] / Math.max(1, state.empirePoints);
                    return ratio >= 0.8 && ratio <= 2.5; 
                });

                if (validBots.length > 0) {
                    const bot = validBots[Math.floor(Math.random() * validBots.length)];
                    enemyId = bot.id;
                    enemyName = bot.name;
                    enemyScore = bot.stats[RankingCategory.DOMINION];
                    personality = bot.personality;
                }

                // 2. Generate Raid Army
                const fullPowerArmy = generateBotArmy(enemyScore, 1.0, personality);
                const arrivalTime = now + PVP_TRAVEL_TIME_MS;

                const raidAttack: IncomingAttack = {
                    id: `threat-raid-${now}`,
                    attackerName: enemyName,
                    attackerScore: enemyScore,
                    units: fullPowerArmy,
                    startTime: now,
                    endTime: arrivalTime,
                    isWarWave: false, 
                    delayCount: 0
                };

                // Apply changes
                newThreatLevel = 0;
                newWarCooldownEndTime = now + WAR_COOLDOWN_MS;
                currentIncomingAttacks.push(raidAttack);

                logs.push({ 
                    id: `threat-alert-${now}`, 
                    messageKey: 'alert_incoming', 
                    type: 'combat', 
                    timestamp: now, 
                    params: { attacker: enemyName } 
                });
            }
        }
    }

    // --- 3. ATTACK PROCESSING (ALWAYS RUNS) ---
    // Replaces the bugged early return. Now we process combat regardless of War state.
    
    const newUnits = { ...state.units };
    const newResources = { ...state.resources };
    const newLifetimeStats = { ...state.lifetimeStats };
    const activeWar = state.activeWar ? { ...state.activeWar } : null;

    const remainingAttacks = currentIncomingAttacks.filter(attack => {
        if (now >= attack.endTime) {
            // RESOLVE COMBAT
            const result = simulateCombat(newUnits, attack.units, 1.0);
            
            // Update Player Army
            Object.keys(newUnits).forEach(u => newUnits[u as UnitType] = result.finalPlayerArmy[u as UnitType] || 0);
            
            // Update Stats
            const pLost = Object.values(result.totalPlayerCasualties).reduce((a:any, b:any) => a + b, 0) as number;
            const eLost = Object.values(result.totalEnemyCasualties).reduce((a:any, b:any) => a + b, 0) as number;
            newLifetimeStats.unitsLost += pLost;
            newLifetimeStats.enemiesKilled += eLost;

            let stolenLoot: Partial<Record<ResourceType, number>> = {};

            if (attack.isWarWave && activeWar) {
                // --- WAR LOGIC: POOL ACCUMULATION ---
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
                // --- RAID LOGIC: DIRECT THEFT ---
                if (result.winner !== 'PLAYER') {
                    [ResourceType.MONEY, ResourceType.OIL, ResourceType.AMMO, ResourceType.GOLD].forEach(r => {
                        const lost = Math.floor(newResources[r] * PVP_LOOT_FACTOR);
                        if (lost > 0) {
                            newResources[r] = Math.max(0, newResources[r] - lost);
                            stolenLoot[r] = lost;
                        }
                    });

                    // Diamond Theft
                    if (newResources[ResourceType.DIAMOND] > 0 && Math.random() < PVP_DIAMOND_STEAL_CHANCE) {
                        const diamondsLost = Math.max(1, Math.floor(newResources[ResourceType.DIAMOND] * PVP_LOOT_FACTOR));
                        newResources[ResourceType.DIAMOND] -= diamondsLost;
                        stolenLoot[ResourceType.DIAMOND] = diamondsLost;
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
                        loot: stolenLoot 
                    }
                });
            }
            return false; // Remove processed attack
        }
        return true; // Keep pending attack
    });

    // --- 4. ACTIVE WAR MANAGEMENT (TIMERS & WAVES) ---
    if (activeWar) {
        const isWaveInFlight = remainingAttacks.some(a => a.isWarWave);
        const isTimeUp = now >= activeWar.startTime + activeWar.duration;

        // Force land pending waves if time is up
        if (isTimeUp && isWaveInFlight) {
            remainingAttacks.forEach(a => { if (a.isWarWave) a.endTime = now; });
        }

        // War End Condition
        if (isTimeUp && !isWaveInFlight) {
            if (activeWar.playerVictories === activeWar.enemyVictories) {
                // Overtime
                activeWar.duration += WAR_OVERTIME_MS;
                activeWar.totalWaves += 1;
                activeWar.playerAttacksLeft += 1;
                activeWar.nextWaveTime = now;
                logs.push({ id: `war-ot-${now}`, messageKey: 'log_war_overtime', type: 'war', timestamp: now });
            } else {
                // Final Resolution
                const winner = activeWar.playerVictories > activeWar.enemyVictories ? 'PLAYER' : 'ENEMY';
                const resolution = distributeWarLoot(activeWar.lootPool, winner, newResources, state.maxResources, state.bankBalance, state.empirePoints, state.buildings);
                
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

                // Clear War State
                return {
                    stateUpdates: {
                        activeWar: null,
                        warCooldownEndTime: now + WAR_COOLDOWN_MS,
                        threatLevel: 0,
                        resources: resolution.newResources,
                        bankBalance: resolution.newBank,
                        units: newUnits,
                        lifetimeStats: newLifetimeStats,
                        incomingAttacks: remainingAttacks.filter(a => !a.isWarWave) // Should be none, but safe filter
                    },
                    logs
                };
            }
        }

        // Next Wave Generation
        if (activeWar.currentWave <= activeWar.totalWaves && now >= activeWar.nextWaveTime) {
            const nextWave = generateWarWave(state, activeWar.currentWave, activeWar, now + WAR_WAVE_INTERVAL_MS);
            activeWar.nextWaveTime = now + WAR_WAVE_INTERVAL_MS;
            activeWar.currentWave++;
            remainingAttacks.push(nextWave);
        }
    }

    // --- 5. FINAL RETURN ---
    return {
        stateUpdates: {
            threatLevel: newThreatLevel,
            warCooldownEndTime: newWarCooldownEndTime,
            activeWar, // Can be null or updated object
            units: newUnits,
            resources: newResources,
            lifetimeStats: newLifetimeStats,
            incomingAttacks: remainingAttacks
        },
        logs
    };
};
