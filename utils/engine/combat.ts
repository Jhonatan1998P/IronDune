import { BattleResult, BattleRoundLog, UnitType, UnitPerformanceStats } from '../../types';
import { UNIT_DEFS } from '../../data/units';

const MAX_ROUNDS = 12;
const CRITICAL_HP_THRESHOLD_PCT = 0.70; 
const CRITICAL_KILL_CHANCE = 0.10; 
const DEFENSE_THRESHOLD_PCT = 0.20; 

export const UNIT_PRIORITY: UnitType[] = [
    UnitType.SOLDIER,        
    UnitType.SNIPER,        
    UnitType.COMMANDO,      

    UnitType.MORTAR,        
    UnitType.PATROL_BOAT,   

    UnitType.LIGHT_TANK,    
    UnitType.TANK,          
    UnitType.HEAVY_TANK,    

    UnitType.HOWITZER,      
    UnitType.DESTROYER,     
    UnitType.SUBMARINE,     
    UnitType.MLRS,          

    UnitType.HELICOPTER,    
    UnitType.BOMBER,        
    UnitType.FIGHTER_JET    
];

interface BattleEntity {
    id: number;
    type: UnitType;
    side: 'PLAYER' | 'ENEMY';
    hp: number;
    maxHp: number;
    defense: number;
    maxDefense: number;
    
    isDead: boolean; 
    isDying: boolean; 
    
    def: typeof UNIT_DEFS[UnitType]; 
}

const createArmyEntities = (army: Partial<Record<UnitType, number>>, side: 'PLAYER' | 'ENEMY', startId: number): BattleEntity[] => {
    const entities: BattleEntity[] = [];
    let idCounter = startId;

    Object.entries(army).forEach(([uKey, count]) => {
        const uType = uKey as UnitType;
        if (count && count > 0) {
            const def = UNIT_DEFS[uType];
            for (let i = 0; i < count; i++) {
                entities.push({
                    id: idCounter++,
                    type: uType,
                    side,
                    hp: def.hp,
                    maxHp: def.hp,
                    defense: def.defense,
                    maxDefense: def.defense,
                    isDead: false,
                    isDying: false,
                    def: def
                });
            }
        }
    });

    return entities;
};

export const simulateCombat = (
    initialPlayerArmy: Partial<Record<UnitType, number>>,
    initialEnemyArmy: Partial<Record<UnitType, number>>,
    playerDamageMultiplier: number = 1.0
): BattleResult => {

    const playerEntities = createArmyEntities(initialPlayerArmy, 'PLAYER', 0);
    const enemyEntities = createArmyEntities(initialEnemyArmy, 'ENEMY', playerEntities.length);
    
    let allUnits: BattleEntity[] = [...playerEntities, ...enemyEntities];

    const playerTotalHpStart = playerEntities.reduce((acc, u) => acc + u.maxHp, 0);
    const enemyTotalHpStart = enemyEntities.reduce((acc, u) => acc + u.maxHp, 0);
    
    let playerDamageDealt = 0;
    let enemyDamageDealt = 0;

    const playerPerformance: Partial<Record<UnitType, UnitPerformanceStats>> = {};
    const enemyPerformance: Partial<Record<UnitType, UnitPerformanceStats>> = {};

    const initPerformance = (matrix: Partial<Record<UnitType, UnitPerformanceStats>>, type: UnitType) => {
        if (!matrix[type]) {
            matrix[type] = { kills: {}, deathsBy: {}, damageDealt: 0, criticalKills: 0, criticalDeaths: 0 };
        }
    };

    const playerPenetrationMap = new Map<UnitType, Set<UnitType>>();
    const enemyPenetrationMap = new Map<UnitType, Set<UnitType>>();

    const playerUnitTypes = Object.keys(initialPlayerArmy) as UnitType[];
    const enemyUnitTypes = Object.keys(initialEnemyArmy) as UnitType[];

    playerUnitTypes.forEach(pType => {
        const pAtk = Math.floor(UNIT_DEFS[pType].attack * playerDamageMultiplier);
        const validTargets = new Set<UnitType>();
        enemyUnitTypes.forEach(eType => {
            const eDef = UNIT_DEFS[eType].defense;
            if (pAtk > eDef * DEFENSE_THRESHOLD_PCT) {
                validTargets.add(eType);
            }
        });
        playerPenetrationMap.set(pType, validTargets);
    });

    enemyUnitTypes.forEach(eType => {
        const eAtk = UNIT_DEFS[eType].attack;
        const validTargets = new Set<UnitType>();
        playerUnitTypes.forEach(pType => {
            const pDef = UNIT_DEFS[pType].defense;
            if (eAtk > pDef * DEFENSE_THRESHOLD_PCT) {
                validTargets.add(pType);
            }
        });
        enemyPenetrationMap.set(eType, validTargets);
    });

    const rounds: BattleRoundLog[] = [];

    for (let round = 1; round <= MAX_ROUNDS; round++) {
        
        let playerAliveCount = 0;
        let enemyAliveCount = 0;

        allUnits.forEach(u => {
            if (u.isDying) {
                u.isDead = true;
                u.isDying = false; 
            }
            u.defense = u.maxDefense;

            if (!u.isDead) {
                if (u.side === 'PLAYER') playerAliveCount++;
                else enemyAliveCount++;
            }
        });

        if (playerAliveCount === 0 || enemyAliveCount === 0) break;

        const roundLog: BattleRoundLog = {
            round,
            playerUnitsStart: playerAliveCount,
            enemyUnitsStart: enemyAliveCount,
            playerUnitsLost: 0,
            enemyUnitsLost: 0,
            details: []
        };

        const activeCombatants = allUnits.filter(u => !u.isDead);

        activeCombatants.sort((a, b) => {
            const prioA = UNIT_PRIORITY.indexOf(a.type);
            const prioB = UNIT_PRIORITY.indexOf(b.type);
            if (prioA !== prioB) return prioA - prioB;
            return Math.random() - 0.5;
        });

        for (const attacker of activeCombatants) {
            if (attacker.isDead) continue;

            let keepShooting = true;
            let isRapidFire = false; 

            while (keepShooting) {
                keepShooting = false; 

                const potentialTargets = allUnits.filter(u => {
                    if (u.side === attacker.side) return false; 
                    if (u.isDead) return false; 
                    
                    if (isRapidFire) {
                        if (u.isDying) return false;
                    }
                    return true;
                });

                if (potentialTargets.length === 0) break;

                let currentTarget: BattleEntity | undefined = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
                
                let baseAttackPower = attacker.def.attack;
                if (attacker.side === 'PLAYER') baseAttackPower = Math.floor(baseAttackPower * playerDamageMultiplier);
                
                let damagePool = baseAttackPower;

                if (attacker.side === 'PLAYER') {
                    playerDamageDealt += damagePool;
                    initPerformance(playerPerformance, attacker.type);
                    playerPerformance[attacker.type]!.damageDealt += damagePool;
                } else {
                    enemyDamageDealt += damagePool;
                    initPerformance(enemyPerformance, attacker.type);
                    enemyPerformance[attacker.type]!.damageDealt += damagePool;
                }

                const penetrationMatrix = attacker.side === 'PLAYER' ? playerPenetrationMap : enemyPenetrationMap;
                const canDamageSet = penetrationMatrix.get(attacker.type);

                while (damagePool > 0 && currentTarget) {
                    
                    if (!canDamageSet?.has(currentTarget.type)) {
                        damagePool = 0;
                        break; 
                    }

                    const effectiveDefense = currentTarget.defense;
                    let netDamage = Math.max(1, damagePool - effectiveDefense);
                    
                    if (currentTarget.isDying || currentTarget.isDead) {
                        damagePool -= (effectiveDefense / 2); 
                    } 
                    else if (currentTarget.hp <= netDamage) {
                        const damageConsumed = currentTarget.hp + effectiveDefense; 
                        
                        const killerPerf = attacker.side === 'PLAYER' ? playerPerformance : enemyPerformance;
                        const victimPerf = currentTarget.side === 'PLAYER' ? playerPerformance : enemyPerformance;
                        initPerformance(killerPerf, attacker.type);
                        killerPerf[attacker.type]!.kills[currentTarget.type] = (killerPerf[attacker.type]!.kills[currentTarget.type] || 0) + 1;
                        initPerformance(victimPerf, currentTarget.type);
                        victimPerf[currentTarget.type]!.deathsBy[attacker.type] = (victimPerf[currentTarget.type]!.deathsBy[attacker.type] || 0) + 1;

                        currentTarget.hp = 0;
                        currentTarget.isDying = true;
                        
                        damagePool -= damageConsumed;

                    } else {
                        currentTarget.hp -= netDamage;
                        damagePool = 0; 
                        
                        const criticalThreshold = currentTarget.maxHp * CRITICAL_HP_THRESHOLD_PCT;
                        if (currentTarget.hp < criticalThreshold && Math.random() < CRITICAL_KILL_CHANCE) {
                            currentTarget.hp = 0;
                            currentTarget.isDying = true;
                            
                            const killerPerf = attacker.side === 'PLAYER' ? playerPerformance : enemyPerformance;
                            const victimPerf = currentTarget.side === 'PLAYER' ? playerPerformance : enemyPerformance;
                            
                            initPerformance(killerPerf, attacker.type);
                            killerPerf[attacker.type]!.criticalKills++;
                            
                            initPerformance(victimPerf, currentTarget.type);
                            victimPerf[currentTarget.type]!.criticalDeaths++;
                            victimPerf[currentTarget.type]!.deathsBy[attacker.type] = (victimPerf[currentTarget.type]!.deathsBy[attacker.type] || 0) + 1;
                        }
                    }

                    if (damagePool > 0) {
                        const nextTarget = allUnits.find(u => 
                            u.side === currentTarget!.side &&
                            u.type === currentTarget!.type &&
                            !u.isDead && !u.isDying &&
                            u.id !== currentTarget!.id
                        );
                        currentTarget = nextTarget; 
                    } else {
                        currentTarget = undefined; 
                    }
                }

                const potentialNext = allUnits.find(u => u.side !== attacker.side && !u.isDead && !u.isDying);
                if (potentialNext) {
                    const rfChance = attacker.def.rapidFire[potentialNext.type];
                    if (rfChance && Math.random() < rfChance) {
                        keepShooting = true;
                        isRapidFire = true;
                    }
                }
            }
        }

        const playerDying = allUnits.filter(u => u.side === 'PLAYER' && u.isDying).length;
        const enemyDying = allUnits.filter(u => u.side === 'ENEMY' && u.isDying).length;
        
        roundLog.playerUnitsLost = playerDying;
        roundLog.enemyUnitsLost = enemyDying;
        
        rounds.push(roundLog);
    }

    const compileArmy = (side: 'PLAYER' | 'ENEMY') => {
        const army: Partial<Record<UnitType, number>> = {};
        allUnits.filter(u => u.side === side && !u.isDead && !u.isDying).forEach(u => {
            army[u.type] = (army[u.type] || 0) + 1;
        });
        return army;
    };

    const finalPlayerArmy = compileArmy('PLAYER');
    const finalEnemyArmy = compileArmy('ENEMY');

    const calculateCasualties = (initial: Partial<Record<UnitType, number>>, final: Partial<Record<UnitType, number>>) => {
        const casualties: Partial<Record<UnitType, number>> = {};
        Object.keys(initial).forEach(key => {
            const u = key as UnitType;
            const start = initial[u] || 0;
            const end = final[u] || 0;
            const lost = start - end;
            if (lost > 0) casualties[u] = lost;
        });
        return casualties;
    };

    const totalPlayerCasualties = calculateCasualties(initialPlayerArmy, finalPlayerArmy);
    const totalEnemyCasualties = calculateCasualties(initialEnemyArmy, finalEnemyArmy);

    // --- FIX DISCREPANCY: Account for units that died without a specific killer (e.g. at end of rounds or environmental) ---
    const reconcileKills = (matrix: Partial<Record<UnitType, UnitPerformanceStats>>, side: 'PLAYER' | 'ENEMY', totalCasualties: Partial<Record<UnitType, number>>) => {
        Object.entries(totalCasualties).forEach(([uType, count]) => {
            const type = uType as UnitType;
            let recordedDeaths = 0;
            // Count all deaths of this unit type recorded across all enemy attackers
            const oppositeMatrix = side === 'PLAYER' ? enemyPerformance : playerPerformance;
            Object.values(oppositeMatrix).forEach(stats => {
                recordedDeaths += (stats!.kills[type] || 0);
            });

            if (recordedDeaths < count!) {
                const diff = count! - recordedDeaths;
                // Credit the "unknown" kills to an environmental/extra category or distribute among attackers
                // For forensic analysis simplicity, we'll add them to an 'environmental' key in the performance record 
                // of the unit that dealt the most damage of that side, or just ensure they appear.
                // Alternatively, we can add a specialized "Bleed out / Collateral" entry.
                const attackers = Object.keys(oppositeMatrix) as UnitType[];
                if (attackers.length > 0) {
                    // Credit to the first attacker for simplicity in this forensic view
                    const leadAttacker = attackers[0];
                    oppositeMatrix[leadAttacker]!.kills[type] = (oppositeMatrix[leadAttacker]!.kills[type] || 0) + diff;
                }
            }
        });
    };

    reconcileKills(playerPerformance, 'PLAYER', totalPlayerCasualties);
    reconcileKills(enemyPerformance, 'ENEMY', totalEnemyCasualties);

    const playerTotalHpEnd = allUnits.filter(u => u.side === 'PLAYER' && !u.isDead && !u.isDying).reduce((acc, u) => acc + u.hp, 0);
    const enemyTotalHpEnd = allUnits.filter(u => u.side === 'ENEMY' && !u.isDead && !u.isDying).reduce((acc, u) => acc + u.hp, 0);

    const pAlive = Object.values(finalPlayerArmy).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
    const eAlive = Object.values(finalEnemyArmy).reduce((a: number, b: number | undefined) => a + (b || 0), 0);

    let winner: BattleResult['winner'] = 'DRAW';
    
    if (pAlive > 0 && eAlive === 0) winner = 'PLAYER';
    else if (eAlive > 0 && pAlive === 0) winner = 'ENEMY';
    else {
        const pStartCount = playerEntities.length;
        const eStartCount = enemyEntities.length;
        const pLossPct = pStartCount === 0 ? 1 : (pStartCount - pAlive) / pStartCount;
        const eLossPct = eStartCount === 0 ? 1 : (eStartCount - eAlive) / eStartCount;

        if (pLossPct < eLossPct) winner = 'PLAYER';
        else if (eLossPct < pLossPct) winner = 'ENEMY';
        else winner = 'DRAW';
    }

    return {
        winner,
        rounds,
        initialPlayerArmy: { ...initialPlayerArmy },
        initialEnemyArmy: { ...initialEnemyArmy },
        finalPlayerArmy,
        finalEnemyArmy,
        totalPlayerCasualties,
        totalEnemyCasualties,
        playerTotalHpStart,
        playerTotalHpLost: Math.max(0, playerTotalHpStart - playerTotalHpEnd),
        enemyTotalHpStart,
        enemyTotalHpLost: Math.max(0, enemyTotalHpStart - enemyTotalHpEnd),
        playerDamageDealt,
        enemyDamageDealt,
        playerPerformance,
        enemyPerformance
    };
};

export const calculateCombatStats = (
    army: Partial<Record<UnitType, number>>
) => {
    let totalAttack = 0;
    let totalDefense = 0;
    let totalHp = 0;

    Object.entries(army).forEach(([uType, count]) => {
        const qty = count as number;
        if (qty <= 0) return;
        const def = UNIT_DEFS[uType as UnitType];
        totalAttack += def.attack * qty;
        totalDefense += def.defense * qty;
        totalHp += def.hp * qty;
    });

    return { attack: totalAttack, defense: totalDefense, hp: totalHp };
};