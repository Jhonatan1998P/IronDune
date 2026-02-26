import { BattleResult, BattleRoundLog, UnitType, UnitPerformanceStats } from '../../types';
import { UNIT_DEFS } from '../../data/units';

const MAX_ROUNDS = 6;
const EXPLOSION_THRESHOLD_PCT = 0.70; // Se activa si la vida baja del 70%
const SHIELD_PENETRATION_THRESHOLD = 0.01;

export const UNIT_PRIORITY: UnitType[] = [
    UnitType.CYBER_MARINE,        
    UnitType.HEAVY_COMMANDO,      
    UnitType.SCOUT_TANK,    
    UnitType.TITAN_MBT,          
    UnitType.WRAITH_GUNSHIP,    
    UnitType.ACE_FIGHTER,        
    UnitType.AEGIS_DESTROYER,     
    UnitType.PHANTOM_SUB,     
];

interface BattleEntity {
    id: number;
    type: UnitType;
    side: 'PLAYER' | 'ENEMY';
    hp: number;
    maxHp: number;
    defense: number;
    maxDefense: number;
    isDead: boolean;        // Muerto en rondas anteriores
    markedForDeath: boolean; // Muerto EN esta ronda
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
                    markedForDeath: false,
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
    const allUnits: BattleEntity[] = [...playerEntities, ...enemyEntities];

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

    const rounds: BattleRoundLog[] = [];

    // --- BUCLE DE RONDAS ---
    for (let round = 1; round <= MAX_ROUNDS; round++) {

        // 1. Restaurar Escudos e inicializar arrays de vivos para la ronda
        const playerTargets: BattleEntity[] = [];
        const enemyTargets: BattleEntity[] = [];

        allUnits.forEach(u => {
            if (!u.isDead) {
                u.defense = u.maxDefense;
                u.markedForDeath = false;
                if (u.side === 'PLAYER') {
                    playerTargets.push(u);
                } else {
                    enemyTargets.push(u);
                }
            }
        });

        let pTargetCount = playerTargets.length;
        let eTargetCount = enemyTargets.length;

        // 2. Verificar si la batalla continúa
        if (pTargetCount === 0 || eTargetCount === 0) break;

        const roundLog: BattleRoundLog = {
            round,
            playerUnitsStart: pTargetCount,
            enemyUnitsStart: eTargetCount,
            playerUnitsLost: 0,
            enemyUnitsLost: 0,
            details: []
        };

        // 3. Fase de Fuego Simultáneo
        // Todas las unidades vivas al inicio disparan, incluso si mueren durante el proceso.
        const shooters = [...playerTargets, ...enemyTargets];
        
        // Fisher-Yates Shuffle para mezclar shooters en O(N) de forma impecable
        for (let i = shooters.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shooters[i], shooters[j]] = [shooters[j], shooters[i]];
        }

        for (const attacker of shooters) {
            let keepShooting = true;
            const isPlayer = attacker.side === 'PLAYER';

            while (keepShooting) {
                keepShooting = false;

                // Seleccionar Objetivo (O(1) usando los arrays locales)
                let targetIndex = -1;
                let target: BattleEntity;

                if (isPlayer) {
                    if (eTargetCount === 0) break; // Fin de posibles objetivos enemigos
                    targetIndex = Math.floor(Math.random() * eTargetCount);
                    target = enemyTargets[targetIndex];
                } else {
                    if (pTargetCount === 0) break; // Fin de posibles objetivos aliados
                    targetIndex = Math.floor(Math.random() * pTargetCount);
                    target = playerTargets[targetIndex];
                }

                // Calcular Daño
                let damage = attacker.def.attack;
                if (isPlayer) {
                    damage = Math.floor(damage * playerDamageMultiplier);
                }

                // Registro Stats
                const attackerPerf = isPlayer ? playerPerformance : enemyPerformance;
                initPerformance(attackerPerf, attacker.type);
                attackerPerf[attacker.type]!.damageDealt += damage;

                if (isPlayer) playerDamageDealt += damage;
                else enemyDamageDealt += damage;

                // Lógica de Impacto
                // 1. Verificar Rebote en Escudo (> 1% del escudo máximo)
                if (damage > target.maxDefense * SHIELD_PENETRATION_THRESHOLD) {

                    let hullDamage = 0;

                    // 2. Absorción del Escudo
                    if (target.defense > 0) {
                        if (damage <= target.defense) {
                            target.defense -= damage;
                            hullDamage = 0;
                        } else {
                            hullDamage = damage - target.defense;
                            target.defense = 0;
                        }
                    } else {
                        hullDamage = damage;
                    }

                    if (hullDamage > 0) {
                        const hpBeforeHit = target.hp; // Guardamos HP actual para la fórmula
                        target.hp -= hullDamage;

                        const killerPerf = isPlayer ? playerPerformance : enemyPerformance;
                        const victimPerf = target.side === 'PLAYER' ? playerPerformance : enemyPerformance;

                        let died = false;

                        // CASO A: Muerte Directa (HP llega a 0)
                        if (target.hp <= 0) {
                            target.hp = 0;
                            died = true;

                            initPerformance(killerPerf, attacker.type);
                            initPerformance(victimPerf, target.type);
                            killerPerf[attacker.type]!.kills[target.type] = (killerPerf[attacker.type]!.kills[target.type] || 0) + 1;
                            victimPerf[target.type]!.deathsBy[attacker.type] = (victimPerf[target.type]!.deathsBy[attacker.type] || 0) + 1;
                        } 
                        // CASO B: Tirada de Explosión / Desangrado
                        else if (target.hp < target.maxHp * EXPLOSION_THRESHOLD_PCT) {
                            const explosionChance = hullDamage / hpBeforeHit;

                            if (Math.random() < explosionChance) {
                                target.hp = 0; // Explosión crítica
                                died = true;

                                initPerformance(killerPerf, attacker.type);
                                initPerformance(victimPerf, target.type);

                                killerPerf[attacker.type]!.kills[target.type] = (killerPerf[attacker.type]!.kills[target.type] || 0) + 1;
                                killerPerf[attacker.type]!.criticalKills++;

                                victimPerf[target.type]!.deathsBy[attacker.type] = (victimPerf[target.type]!.deathsBy[attacker.type] || 0) + 1;
                                victimPerf[target.type]!.criticalDeaths++;
                            }
                        }

                        // Optimización vital: Swap and Pop en O(1)
                        if (died) {
                            target.markedForDeath = true;
                            if (isPlayer) {
                                enemyTargets[targetIndex] = enemyTargets[eTargetCount - 1];
                                eTargetCount--;
                            } else {
                                playerTargets[targetIndex] = playerTargets[pTargetCount - 1];
                                pTargetCount--;
                            }
                        }
                    }
                }

                // Fuego Rápido
                const rfChance = attacker.def.rapidFire ? attacker.def.rapidFire[target.type] : 0;
                if (rfChance && rfChance > 0) {
                    if (Math.random() < rfChance) {
                        keepShooting = true;
                    }
                }
            }
        }

        // 4. Limpieza Final de Ronda
        let pLostThisRound = 0;
        let eLostThisRound = 0;

        allUnits.forEach(u => {
            if (u.markedForDeath && !u.isDead) {
                u.isDead = true; // Confirmar muerte
                if (u.side === 'PLAYER') pLostThisRound++;
                else eLostThisRound++;
            }
        });

        roundLog.playerUnitsLost = pLostThisRound;
        roundLog.enemyUnitsLost = eLostThisRound;
        rounds.push(roundLog);
    }

    // --- RESULTADOS ---
    const finalPlayerArmy = compileArmy(allUnits, 'PLAYER');
    const finalEnemyArmy = compileArmy(allUnits, 'ENEMY');
    const totalPlayerCasualties = calculateCasualties(initialPlayerArmy, finalPlayerArmy);
    const totalEnemyCasualties = calculateCasualties(initialEnemyArmy, finalEnemyArmy);

    const playerHpEnd = allUnits.filter(u => u.side === 'PLAYER' && !u.isDead).reduce((acc, u) => acc + u.hp, 0);
    const enemyHpEnd = allUnits.filter(u => u.side === 'ENEMY' && !u.isDead).reduce((acc, u) => acc + u.hp, 0);

    const winner = determineWinner(initialPlayerArmy, initialEnemyArmy, finalPlayerArmy, finalEnemyArmy);

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
        playerTotalHpLost: Math.max(0, playerTotalHpStart - playerHpEnd),
        enemyTotalHpStart,
        enemyTotalHpLost: Math.max(0, enemyTotalHpStart - enemyHpEnd),
        playerDamageDealt,
        enemyDamageDealt,
        playerPerformance,
        enemyPerformance
    };
};

// --- Helpers ---

const compileArmy = (units: BattleEntity[], side: 'PLAYER' | 'ENEMY') => {
    const army: Partial<Record<UnitType, number>> = {};
    units.filter(u => u.side === side && !u.isDead).forEach(u => {
        army[u.type] = (army[u.type] || 0) + 1;
    });
    return army;
};

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

const determineWinner = (
    startP: Partial<Record<UnitType, number>>, 
    startE: Partial<Record<UnitType, number>>, 
    endP: Partial<Record<UnitType, number>>, 
    endE: Partial<Record<UnitType, number>>
): BattleResult['winner'] => {
    const pCount = Object.values(endP).reduce((a, b) => a + (b || 0), 0);
    const eCount = Object.values(endE).reduce((a, b) => a + (b || 0), 0);

    if (pCount > 0 && eCount === 0) return 'PLAYER';
    if (eCount > 0 && pCount === 0) return 'ENEMY';

    const startPCount = Object.values(startP).reduce((a, b) => a + (b || 0), 0);
    const startECount = Object.values(startE).reduce((a, b) => a + (b || 0), 0);

    const pLossPct = startPCount === 0 ? 1 : (startPCount - pCount) / startPCount;
    const eLossPct = startECount === 0 ? 1 : (startECount - eCount) / startECount;

    if (pLossPct < eLossPct) return 'PLAYER';
    if (eLossPct < pLossPct) return 'ENEMY';

    return 'DRAW';
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