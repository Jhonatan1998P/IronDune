
import { BattleResult, BattleRoundLog, UnitType, UnitPerformanceStats } from '../../types';
import { UNIT_DEFS } from '../../data/units';

// --- CONFIGURACIÓN ---
const MAX_ROUNDS = 12;
const CRITICAL_HP_THRESHOLD = 0.30; // 30%

// ORDEN DE INICIATIVA DE COMBATE (ESTRICTO)
// Las unidades disparan en este orden exacto dentro de su bando.
const UNIT_PRIORITY: UnitType[] = [
    UnitType.SOLDIER,       // T1 Ground - Primero en disparar
    UnitType.SNIPER,        // T2 Ground
    UnitType.MORTAR,        // T1 Arty
    UnitType.LIGHT_TANK,    // T1 Tank
    UnitType.PATROL_BOAT,   // T1 Naval
    UnitType.COMMANDO,      // T3 Ground
    UnitType.HOWITZER,      // T2 Arty
    UnitType.HELICOPTER,    // T1 Air
    UnitType.TANK,          // T2 Tank
    UnitType.MLRS,          // T3 Arty
    UnitType.DESTROYER,     // T2 Naval
    UnitType.FIGHTER_JET,   // T2 Air
    UnitType.HEAVY_TANK,    // T3 Tank
    UnitType.SUBMARINE,     // T3 Naval
    UnitType.BOMBER         // T3 Air - Último en disparar
];

// --- MODELO INTERNO ---

interface BattleEntity {
    id: number;
    type: UnitType;
    hp: number;
    maxHp: number;
    defense: number;
    maxDefense: number;
    isDead: boolean;
    def: typeof UNIT_DEFS[UnitType]; // Referencia estática para stats
}

interface ArmyGroup {
    units: BattleEntity[];
    initialCount: number;
}

// --- HELPERS ---

const createArmyEntities = (army: Partial<Record<UnitType, number>>): ArmyGroup => {
    const entities: BattleEntity[] = [];
    let idCounter = 0;

    // Iteramos según prioridad para que el array quede ordenado implícitamente.
    UNIT_PRIORITY.forEach(uType => {
        const count = army[uType] || 0;
        if (count > 0) {
            const def = UNIT_DEFS[uType];
            for (let i = 0; i < count; i++) {
                entities.push({
                    id: idCounter++,
                    type: uType,
                    hp: def.hp,
                    maxHp: def.hp,
                    defense: def.defense,
                    maxDefense: def.defense,
                    isDead: false,
                    def: def
                });
            }
        }
    });

    return { units: entities, initialCount: entities.length };
};

// --- LÓGICA DE DAÑO (Single Shot) ---

const applyDamage = (
    target: BattleEntity, 
    damage: number, 
    onKill: (victimType: UnitType) => void
) => {
    // IMPORTANTE: La defensa se degrada SIEMPRE, incluso si el objetivo ya está muerto.
    // Esto simula la destrucción del blindaje.
    const currentDef = target.defense;
    
    // 1. Degradación de Defensa (Destructible Armor)
    // Si el daño es 20 y la defensa 40, la defensa baja a 20.
    target.defense = Math.max(0, target.defense - damage);

    // Si el objetivo ya estaba muerto al recibir el disparo, es "Overkill".
    // Consumimos el daño (y la defensa), pero no procesamos muerte de nuevo.
    if (target.isDead) return;

    // 2. Cálculo de Daño Neto
    // El daño a HP es lo que sobra después de la defensa ORIGINAL (al momento del impacto).
    // Mínimo 1 de daño siempre (Chip damage).
    const netDamage = Math.max(1, damage - currentDef); 

    // 3. Aplicar Daño a HP
    if (target.hp <= netDamage) {
        target.hp = 0;
        target.isDead = true;
        onKill(target.type);
    } else {
        target.hp -= netDamage;

        // 4. Mecánica de Probabilidad de Muerte (Critical Failure)
        // Si HP baja del 30%, hay chance de destrucción catastrófica.
        const threshold = target.maxHp * CRITICAL_HP_THRESHOLD;
        
        if (target.hp <= threshold) {
            // Chance = Daño Neto / Umbral 30%
            const chance = netDamage / threshold;
            if (Math.random() < chance) {
                target.hp = 0;
                target.isDead = true;
                onKill(target.type);
            }
        }
    }
};

// --- SIMULACIÓN PRINCIPAL ---

export const simulateCombat = (
    initialPlayerArmy: Partial<Record<UnitType, number>>,
    initialEnemyArmy: Partial<Record<UnitType, number>>,
    playerDamageMultiplier: number = 1.0
): BattleResult => {

    // 1. Expandir ejércitos a Entidades Individuales (YA ORDENADAS POR PRIORIDAD)
    let playerArmy = createArmyEntities(initialPlayerArmy);
    let enemyArmy = createArmyEntities(initialEnemyArmy);

    // Stats para el reporte
    const playerTotalHpStart = playerArmy.units.reduce((acc, u) => acc + u.maxHp, 0);
    const enemyTotalHpStart = enemyArmy.units.reduce((acc, u) => acc + u.maxHp, 0);
    let playerDamageDealt = 0;
    let enemyDamageDealt = 0;

    // Performance Matrix Initialization
    const playerPerformance: Partial<Record<UnitType, UnitPerformanceStats>> = {};
    const enemyPerformance: Partial<Record<UnitType, UnitPerformanceStats>> = {};

    const initPerformance = (matrix: Partial<Record<UnitType, UnitPerformanceStats>>, type: UnitType) => {
        if (!matrix[type]) {
            matrix[type] = { kills: {}, deathsBy: {}, damageDealt: 0 };
        }
    };

    const rounds: BattleRoundLog[] = [];

    // --- LOOP DE RONDAS ---
    for (let round = 1; round <= MAX_ROUNDS; round++) {
        // Verificar si hay combatientes vivos AL INICIO de la ronda
        // (Aunque estén marcados como isDead dentro de la lógica de la ronda anterior,
        // al inicio del loop ya habrán sido filtrados por la fase 4, así que aquí solo llegan vivos)
        const playerAliveCount = playerArmy.units.length;
        const enemyAliveCount = enemyArmy.units.length;

        if (playerAliveCount === 0 || enemyAliveCount === 0) break;

        const roundLog: BattleRoundLog = {
            round,
            playerUnitsStart: playerAliveCount,
            enemyUnitsStart: enemyAliveCount,
            playerUnitsLost: 0,
            enemyUnitsLost: 0,
            details: []
        };

        // 1. Resetear Defensas (Inicio de Ronda)
        playerArmy.units.forEach(u => { u.defense = u.maxDefense; });
        enemyArmy.units.forEach(u => { u.defense = u.maxDefense; });

        // 2. FASE DE ATAQUE: JUGADOR
        for (const attacker of playerArmy.units) {
            // NOTA: Fuego Simultáneo. 
            // Aunque el atacante muera "técnicamente" durante esta fase (por fuego de reacción o lógica futura),
            // siempre dispara si empezó la ronda vivo.
            
            let keepShooting = true;
            
            // --- RAPID FIRE LOOP ---
            while (keepShooting) {
                const potentialTargets = enemyArmy.units; 
                
                if (potentialTargets.length === 0) {
                    keepShooting = false;
                    break;
                }

                // Selección totalmente aleatoria
                const targetIndex = Math.floor(Math.random() * potentialTargets.length);
                const target = potentialTargets[targetIndex];

                const finalAtk = Math.floor(attacker.def.attack * playerDamageMultiplier);

                playerDamageDealt += finalAtk; 
                
                initPerformance(playerPerformance, attacker.type);
                playerPerformance[attacker.type]!.damageDealt += finalAtk;

                applyDamage(target, finalAtk, (victimType) => {
                    playerPerformance[attacker.type]!.kills[victimType] = (playerPerformance[attacker.type]!.kills[victimType] || 0) + 1;
                    initPerformance(enemyPerformance, victimType);
                    enemyPerformance[victimType]!.deathsBy[attacker.type] = (enemyPerformance[victimType]!.deathsBy[attacker.type] || 0) + 1;
                });

                const rfChance = attacker.def.rapidFire[target.type];
                if (rfChance && Math.random() < rfChance) {
                    keepShooting = true;
                } else {
                    keepShooting = false;
                }
            }
        }

        // 3. FASE DE ATAQUE: ENEMIGO (FUEGO SIMULTÁNEO)
        for (const attacker of enemyArmy.units) {
            // CRÍTICO: NO verificamos `if (attacker.isDead) continue;`
            // Esto permite que las unidades que murieron en la Fase 2 (Ataque Jugador) 
            // devuelvan el fuego antes de ser retiradas en la Fase 4.
            
            let keepShooting = true;

            // --- RAPID FIRE LOOP ---
            while (keepShooting) {
                const potentialTargets = playerArmy.units;
                
                if (potentialTargets.length === 0) {
                    keepShooting = false;
                    break;
                }

                const targetIndex = Math.floor(Math.random() * potentialTargets.length);
                const target = potentialTargets[targetIndex];

                const finalAtk = attacker.def.attack; 

                enemyDamageDealt += finalAtk;

                initPerformance(enemyPerformance, attacker.type);
                enemyPerformance[attacker.type]!.damageDealt += finalAtk;

                applyDamage(target, finalAtk, (victimType) => {
                    enemyPerformance[attacker.type]!.kills[victimType] = (enemyPerformance[attacker.type]!.kills[victimType] || 0) + 1;
                    initPerformance(playerPerformance, victimType);
                    playerPerformance[victimType]!.deathsBy[attacker.type] = (playerPerformance[victimType]!.deathsBy[attacker.type] || 0) + 1;
                });

                const rfChance = attacker.def.rapidFire[target.type];
                if (rfChance && Math.random() < rfChance) {
                    keepShooting = true;
                } else {
                    keepShooting = false;
                }
            }
        }

        // 4. FASE DE LIMPIEZA (FIN DE RONDA)
        // Aquí es donde se hace efectiva la muerte y se retiran las unidades.
        
        const playerDeadCount = playerArmy.units.filter(u => u.isDead).length;
        const enemyDeadCount = enemyArmy.units.filter(u => u.isDead).length;
        
        roundLog.playerUnitsLost = playerDeadCount;
        roundLog.enemyUnitsLost = enemyDeadCount;

        // Remover muertos para la siguiente ronda
        playerArmy.units = playerArmy.units.filter(u => !u.isDead);
        enemyArmy.units = enemyArmy.units.filter(u => !u.isDead);

        rounds.push(roundLog);
    }

    // --- RESULTADOS ---

    const compileArmy = (entities: BattleEntity[]) => {
        const army: Partial<Record<UnitType, number>> = {};
        entities.forEach(u => {
            army[u.type] = (army[u.type] || 0) + 1;
        });
        return army;
    };

    const finalPlayerArmy = compileArmy(playerArmy.units);
    const finalEnemyArmy = compileArmy(enemyArmy.units);

    // Calcular bajas totales
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

    const playerTotalHpEnd = playerArmy.units.reduce((acc, u) => acc + u.hp, 0);
    const enemyTotalHpEnd = enemyArmy.units.reduce((acc, u) => acc + u.hp, 0);

    const pLostCount = playerArmy.initialCount - playerArmy.units.length;
    const eLostCount = enemyArmy.initialCount - enemyArmy.units.length;

    let winner: BattleResult['winner'] = 'DRAW';
    
    if (playerArmy.units.length > 0 && enemyArmy.units.length === 0) winner = 'PLAYER';
    else if (enemyArmy.units.length > 0 && playerArmy.units.length === 0) winner = 'ENEMY';
    else {
        // Tie-breaker por % de bajas
        if (pLostCount < eLostCount) winner = 'PLAYER';
        else if (eLostCount < pLostCount) winner = 'ENEMY';
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
