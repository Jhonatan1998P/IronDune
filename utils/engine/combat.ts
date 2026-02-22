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

    const rounds: BattleRoundLog[] = [];

    // --- BUCLE DE RONDAS ---
    for (let round = 1; round <= MAX_ROUNDS; round++) {

        // 1. Restaurar Escudos y Limpiar estados temporales
        allUnits.forEach(u => {
            if (!u.isDead) {
                u.defense = u.maxDefense;
                u.markedForDeath = false; 
            }
        });

        // 2. Verificar si la batalla continúa
        const activePlayerUnits = allUnits.filter(u => u.side === 'PLAYER' && !u.isDead);
        const activeEnemyUnits = allUnits.filter(u => u.side === 'ENEMY' && !u.isDead);

        if (activePlayerUnits.length === 0 || activeEnemyUnits.length === 0) break;

        const roundLog: BattleRoundLog = {
            round,
            playerUnitsStart: activePlayerUnits.length,
            enemyUnitsStart: activeEnemyUnits.length,
            playerUnitsLost: 0,
            enemyUnitsLost: 0,
            details: []
        };

        // 3. Fase de Fuego Simultáneo
        // Todas las unidades vivas al inicio disparan, incluso si mueren durante el proceso.
        const shooters = [...activePlayerUnits, ...activeEnemyUnits];
        shooters.sort(() => Math.random() - 0.5); 

        for (const attacker of shooters) {

            let keepShooting = true;

            while (keepShooting) {
                keepShooting = false;

                // Seleccionar Objetivo (que no esté ya marcado como muerto en esta ronda)
                const potentialTargets = allUnits.filter(u => 
                    u.side !== attacker.side && 
                    !u.isDead && 
                    !u.markedForDeath 
                );

                if (potentialTargets.length === 0) break; 

                const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];

                // Calcular Daño
                let damage = attacker.def.attack;
                if (attacker.side === 'PLAYER') {
                    damage = Math.floor(damage * playerDamageMultiplier);
                }

                // Registro Stats
                const attackerPerf = attacker.side === 'PLAYER' ? playerPerformance : enemyPerformance;
                initPerformance(attackerPerf, attacker.type);
                attackerPerf[attacker.type]!.damageDealt += damage;

                if (attacker.side === 'PLAYER') playerDamageDealt += damage;
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

                        const killerPerf = attacker.side === 'PLAYER' ? playerPerformance : enemyPerformance;
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
                        // Se activa si la HP restante es < 70% del MaxHP
                        else if (target.hp < target.maxHp * EXPLOSION_THRESHOLD_PCT) {

                            // NUEVA FÓRMULA: Probabilidad = Daño Recibido / Vida Actual (antes del golpe)
                            // Ejemplo: 25 daño / 1750 vida = 0.014 (1.4%)
                            const explosionChance = hullDamage / hpBeforeHit;

                            if (Math.random() < explosionChance) {
                                target.hp = 0; // Explosión crítica
                                died = true;

                                initPerformance(killerPerf, attacker.type);
                                initPerformance(victimPerf, target.type);

                                // Registrar Kill
                                killerPerf[attacker.type]!.kills[target.type] = (killerPerf[attacker.type]!.kills[target.type] || 0) + 1;
                                killerPerf[attacker.type]!.criticalKills++;

                                // Registrar Death
                                victimPerf[target.type]!.deathsBy[attacker.type] = (victimPerf[target.type]!.deathsBy[attacker.type] || 0) + 1;
                                victimPerf[target.type]!.criticalDeaths++;
                            }
                        }

                        if (died) {
                            target.markedForDeath = true;
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
            if (u.markedForDeath) {
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