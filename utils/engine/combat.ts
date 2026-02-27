import { BattleResult, BattleRoundLog, UnitType, UnitPerformanceStats } from '../../types';
import { UNIT_DEFS } from '../../data/units';

const MAX_ROUNDS = 6;
const EXPLOSION_THRESHOLD_PCT = 0.70;
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
    isDead: boolean;
    markedForDeath: boolean;
    def: typeof UNIT_DEFS[UnitType];
}

// ─── Helpers de Performance ────────────────────────────────────────────────────

/**
 * Garantiza que el slot exista y devuelve la referencia directamente.
 * Evita doble lookup (has + get) que ocurría con initPerformance + operador !.
 */
const getOrInitPerf = (
    matrix: Partial<Record<UnitType, UnitPerformanceStats>>,
    type: UnitType
): UnitPerformanceStats => {
    let slot = matrix[type];
    if (!slot) {
        slot = { kills: {}, deathsBy: {}, damageDealt: 0, criticalKills: 0, criticalDeaths: 0 };
        matrix[type] = slot;
    }
    return slot;
};

// ─── Creación de Ejércitos ─────────────────────────────────────────────────────

const createArmyEntities = (
    army: Partial<Record<UnitType, number>>,
    side: 'PLAYER' | 'ENEMY',
    startId: number
): BattleEntity[] => {
    const entities: BattleEntity[] = [];
    let idCounter = startId;

    for (const [uKey, count] of Object.entries(army)) {
        if (!count || count <= 0) continue;
        const uType = uKey as UnitType;
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
                def,
            });
        }
    }
    return entities;
};

// ─── Motor Principal ───────────────────────────────────────────────────────────

export const simulateCombat = (
    initialPlayerArmy: Partial<Record<UnitType, number>>,
    initialEnemyArmy: Partial<Record<UnitType, number>>,
    playerDamageMultiplier: number = 1.0
): BattleResult => {

    const playerEntities = createArmyEntities(initialPlayerArmy, 'PLAYER', 0);
    const enemyEntities  = createArmyEntities(initialEnemyArmy,  'ENEMY',  playerEntities.length);

    // Mantenemos dos arrays segregados como fuente de verdad permanente
    // (no necesitamos allUnits para el combate, solo para resultados finales)
    const allUnits: BattleEntity[] = [...playerEntities, ...enemyEntities];

    // HP totales iniciales — calculado UNA SOLA VEZ con un único recorrido
    let playerTotalHpStart = 0;
    let enemyTotalHpStart  = 0;
    for (const u of allUnits) {
        if (u.side === 'PLAYER') playerTotalHpStart += u.maxHp;
        else                     enemyTotalHpStart  += u.maxHp;
    }

    let playerDamageDealt = 0;
    let enemyDamageDealt  = 0;

    const playerPerformance: Partial<Record<UnitType, UnitPerformanceStats>> = {};
    const enemyPerformance:  Partial<Record<UnitType, UnitPerformanceStats>> = {};

    const rounds: BattleRoundLog[] = [];

    // Arrays de trabajo reutilizables entre rondas (evita re-asignación de memoria)
    // Se llenan al inicio de cada ronda y se gestionan con Swap-and-Pop
    const playerTargets: BattleEntity[] = [];
    const enemyTargets:  BattleEntity[] = [];

    // ─── BUCLE DE RONDAS ──────────────────────────────────────────────────────
    for (let round = 1; round <= MAX_ROUNDS; round++) {

        // 1. Restaurar escudos y poblar arrays de vivos para esta ronda
        playerTargets.length = 0;
        enemyTargets.length  = 0;

        for (const u of allUnits) {
            if (u.isDead) continue;
            // Restaurar escudo al inicio de la ronda
            u.defense        = u.maxDefense;
            u.markedForDeath = false;
            if (u.side === 'PLAYER') playerTargets.push(u);
            else                     enemyTargets.push(u);
        }

        let pTargetCount = playerTargets.length;
        let eTargetCount = enemyTargets.length;

        // 2. Verificar si la batalla continúa
        if (pTargetCount === 0 || eTargetCount === 0) break;

        const roundLog: BattleRoundLog = {
            round,
            playerUnitsStart: pTargetCount,
            enemyUnitsStart:  eTargetCount,
            playerUnitsLost:  0,
            enemyUnitsLost:   0,
            details: [],
        };

        // 3. Fase de Fuego Simultáneo
        // Combinamos ambos bandos en un único array de disparadores y los mezclamos.
        // Fisher-Yates en O(N) — garantiza imparcialidad de orden de disparo.
        const shooters: BattleEntity[] = [...playerTargets, ...enemyTargets];
        for (let i = shooters.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            // Destructuring swap — el motor V8 lo optimiza a un intercambio de punteros
            const tmp    = shooters[i];
            shooters[i]  = shooters[j];
            shooters[j]  = tmp;
        }

        for (const attacker of shooters) {
            const isPlayer = attacker.side === 'PLAYER';

            // Cache de referencia al array enemigo y su contador
            // (evita evaluar la condición isPlayer en cada iteración interna)
            const targets     = isPlayer ? enemyTargets  : playerTargets;
            let   targetCount = isPlayer ? eTargetCount  : pTargetCount;

            // Precalcular daño base del atacante (constante para toda su ráfaga)
            const baseDamage  = isPlayer
                ? Math.floor(attacker.def.attack * playerDamageMultiplier)
                : attacker.def.attack;

            // Cache del slot de rendimiento del atacante
            const attackerPerf  = isPlayer ? playerPerformance : enemyPerformance;
            const aPerfSlot     = getOrInitPerf(attackerPerf, attacker.type);

            // Mapa de rapidFire del atacante (undefined si no tiene)
            const rfMap = attacker.def.rapidFire;

            let keepShooting = true;
            while (keepShooting) {
                keepShooting = false;

                if (targetCount === 0) break;

                // Seleccionar objetivo aleatorio en O(1)
                const targetIndex = Math.floor(Math.random() * targetCount);
                const target      = targets[targetIndex];

                // ── Registrar daño ──────────────────────────────────────────
                aPerfSlot.damageDealt += baseDamage;
                if (isPlayer) playerDamageDealt += baseDamage;
                else          enemyDamageDealt  += baseDamage;

                // ── Lógica de Impacto ───────────────────────────────────────
                // 1. Verificar rebote de escudo
                if (baseDamage > target.maxDefense * SHIELD_PENETRATION_THRESHOLD) {

                    // 2. Absorción del escudo → calcula daño de casco
                    let hullDamage: number;
                    if (target.defense > 0) {
                        if (baseDamage <= target.defense) {
                            target.defense -= baseDamage;
                            hullDamage = 0;
                        } else {
                            hullDamage     = baseDamage - target.defense;
                            target.defense = 0;
                        }
                    } else {
                        hullDamage = baseDamage;
                    }

                    if (hullDamage > 0) {
                        const hpBeforeHit = target.hp;
                        target.hp        -= hullDamage;

                        let died = false;

                        // CASO A: Muerte Directa
                        if (target.hp <= 0) {
                            target.hp = 0;
                            died      = true;

                            const vPerfSlot = getOrInitPerf(
                                target.side === 'PLAYER' ? playerPerformance : enemyPerformance,
                                target.type
                            );
                            aPerfSlot.kills[target.type]          = (aPerfSlot.kills[target.type]          || 0) + 1;
                            vPerfSlot.deathsBy[attacker.type]     = (vPerfSlot.deathsBy[attacker.type]     || 0) + 1;
                        }
                        // CASO B: Tirada de Explosión / Desangrado
                        else if (target.hp < target.maxHp * EXPLOSION_THRESHOLD_PCT) {
                            // Fórmula idéntica al original: hullDamage / hpBeforeHit
                            const explosionChance = hullDamage / hpBeforeHit;

                            if (Math.random() < explosionChance) {
                                target.hp = 0;
                                died      = true;

                                const vPerfSlot = getOrInitPerf(
                                    target.side === 'PLAYER' ? playerPerformance : enemyPerformance,
                                    target.type
                                );
                                aPerfSlot.kills[target.type]          = (aPerfSlot.kills[target.type]          || 0) + 1;
                                aPerfSlot.criticalKills++;
                                vPerfSlot.deathsBy[attacker.type]     = (vPerfSlot.deathsBy[attacker.type]     || 0) + 1;
                                vPerfSlot.criticalDeaths++;
                            }
                        }

                        // Swap-and-Pop O(1) si la unidad muere
                        if (died) {
                            target.markedForDeath    = true;
                            targets[targetIndex]     = targets[targetCount - 1];
                            targetCount--;

                            // Sincronizar el contador del bando correspondiente
                            if (isPlayer) eTargetCount = targetCount;
                            else          pTargetCount = targetCount;
                        }
                    }
                }

                // ── Fuego Rápido ────────────────────────────────────────────
                // Consultamos el mapa pre-cacheado (evita acceso a def en cada disparo)
                if (rfMap) {
                    const rfChance = rfMap[target.type];
                    if (rfChance && rfChance > 0 && Math.random() < rfChance) {
                        keepShooting = true;
                    }
                }
            }
        }

        // 4. Limpieza Final de Ronda — único recorrido de allUnits por ronda
        let pLostThisRound = 0;
        let eLostThisRound = 0;

        for (const u of allUnits) {
            if (u.markedForDeath && !u.isDead) {
                u.isDead = true;
                if (u.side === 'PLAYER') pLostThisRound++;
                else                     eLostThisRound++;
            }
        }

        roundLog.playerUnitsLost = pLostThisRound;
        roundLog.enemyUnitsLost  = eLostThisRound;
        rounds.push(roundLog);
    }

    // ─── RESULTADOS ───────────────────────────────────────────────────────────
    // Calcular HP final en un único recorrido (evita dos filter + reduce del original)
    let playerHpEnd = 0;
    let enemyHpEnd  = 0;

    const finalPlayerArmy: Partial<Record<UnitType, number>> = {};
    const finalEnemyArmy:  Partial<Record<UnitType, number>> = {};

    for (const u of allUnits) {
        if (u.isDead) continue;
        if (u.side === 'PLAYER') {
            playerHpEnd += u.hp;
            finalPlayerArmy[u.type] = (finalPlayerArmy[u.type] || 0) + 1;
        } else {
            enemyHpEnd += u.hp;
            finalEnemyArmy[u.type] = (finalEnemyArmy[u.type] || 0) + 1;
        }
    }

    const totalPlayerCasualties = calculateCasualties(initialPlayerArmy, finalPlayerArmy);
    const totalEnemyCasualties  = calculateCasualties(initialEnemyArmy,  finalEnemyArmy);

    const winner = determineWinner(initialPlayerArmy, initialEnemyArmy, finalPlayerArmy, finalEnemyArmy);

    return {
        winner,
        rounds,
        initialPlayerArmy: { ...initialPlayerArmy },
        initialEnemyArmy:  { ...initialEnemyArmy },
        finalPlayerArmy,
        finalEnemyArmy,
        totalPlayerCasualties,
        totalEnemyCasualties,
        playerTotalHpStart,
        playerTotalHpLost: Math.max(0, playerTotalHpStart - playerHpEnd),
        enemyTotalHpStart,
        enemyTotalHpLost:  Math.max(0, enemyTotalHpStart  - enemyHpEnd),
        playerDamageDealt,
        enemyDamageDealt,
        playerPerformance,
        enemyPerformance,
    };
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const calculateCasualties = (
    initial: Partial<Record<UnitType, number>>,
    final:   Partial<Record<UnitType, number>>
) => {
    const casualties: Partial<Record<UnitType, number>> = {};
    for (const key of Object.keys(initial)) {
        const u    = key as UnitType;
        const lost = (initial[u] || 0) - (final[u] || 0);
        if (lost > 0) casualties[u] = lost;
    }
    return casualties;
};

const determineWinner = (
    startP: Partial<Record<UnitType, number>>,
    startE: Partial<Record<UnitType, number>>,
    endP:   Partial<Record<UnitType, number>>,
    endE:   Partial<Record<UnitType, number>>
): BattleResult['winner'] => {
    let pCount = 0, eCount = 0;
    for (const v of Object.values(endP)) pCount += v || 0;
    for (const v of Object.values(endE)) eCount += v || 0;

    if (pCount > 0 && eCount === 0) return 'PLAYER';
    if (eCount > 0 && pCount === 0) return 'ENEMY';

    let startPCount = 0, startECount = 0;
    for (const v of Object.values(startP)) startPCount += v || 0;
    for (const v of Object.values(startE)) startECount += v || 0;

    const pLossPct = startPCount === 0 ? 1 : (startPCount - pCount) / startPCount;
    const eLossPct = startECount === 0 ? 1 : (startECount - eCount) / startECount;

    if (pLossPct < eLossPct) return 'PLAYER';
    if (eLossPct < pLossPct) return 'ENEMY';
    return 'DRAW';
};

export const calculateCombatStats = (army: Partial<Record<UnitType, number>>) => {
    let totalAttack  = 0;
    let totalDefense = 0;
    let totalHp      = 0;

    for (const [uType, count] of Object.entries(army)) {
        if (!count || count <= 0) continue;
        const def     = UNIT_DEFS[uType as UnitType];
        totalAttack  += def.attack  * count;
        totalDefense += def.defense * count;
        totalHp      += def.hp      * count;
    }

    return { attack: totalAttack, defense: totalDefense, hp: totalHp };
};
