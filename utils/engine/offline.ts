import { GameState, ResourceType, BuildingType, OfflineReport, LogEntry } from '../../types';
import { calculateTechMultipliers, calculateMaxStorage, calculateProductionRates, calculateUpkeepCosts } from './modifiers';
import { 
    OFFLINE_PRODUCTION_LIMIT_MS,
    ATTACK_COOLDOWN_MIN_MS,
    ATTACK_COOLDOWN_MAX_MS,
    calculateMaxBankCapacity,
    calculateInterestEarned
} from '../../constants';
import { processRankingEvolution, GROWTH_INTERVAL_MS } from './rankings';
import { processReputationDecay } from './diplomacy';
import { processNemesisTick } from './nemesis';
import { processEnemyAttackCheck } from './enemyAttack';
import { processAttackQueue } from './attackQueue';

// Overflow factor for inflation detection (must match migration.ts)
const OVERFLOW_FACTOR = 10;

const createResourceLog = (title: string, resources: Record<ResourceType, number> | Partial<Record<ResourceType, number>>, type: LogEntry['type'] = 'economy', offsetMs: number = 0): LogEntry => {
    const resourceNames: Record<ResourceType, string> = {
        [ResourceType.MONEY]: 'Dinero',
        [ResourceType.OIL]: 'Petróleo',
        [ResourceType.AMMO]: 'Munición',
        [ResourceType.GOLD]: 'Oro',
        [ResourceType.DIAMOND]: 'Diamante'
    };

    const parts = Object.entries(resources)
        .map(([res, val]) => `${resourceNames[res as ResourceType]}: ${Math.floor(val as number).toLocaleString()}`);
    
    const message = `${title}: ${parts.join(' | ')}`;

    return {
        id: `offline-log-${Date.now()}-${Math.random()}`,
        messageKey: 'raw_message',
        params: { message },
        timestamp: Date.now() + offsetMs,
        type,
    };
};

export const calculateOfflineProgress = (state: GameState): { newState: GameState, report: OfflineReport, newLogs: LogEntry[] } => {
    const now = Date.now();
    const timeElapsed = now - state.lastSaveTime;

    const report: OfflineReport = {
        timeElapsed,
        resourcesGained: {
            [ResourceType.MONEY]: 0,
            [ResourceType.OIL]: 0,
            [ResourceType.AMMO]: 0,
            [ResourceType.GOLD]: 0,
            [ResourceType.DIAMOND]: 0,
        },
        resourcesConsumed: {
            [ResourceType.MONEY]: 0,
            [ResourceType.OIL]: 0,
            [ResourceType.AMMO]: 0,
            [ResourceType.GOLD]: 0,
            [ResourceType.DIAMOND]: 0,
        },
        bankInterestEarned: 0,
        completedResearch: [],
        completedMissions: [],
        queuedAttackResults: [],
    };

    const newLogs: LogEntry[] = [];

    // Log 1: Cantidad base de recursos (más antiguo en el bloque)
    newLogs.push(createResourceLog('CANTIDAD BASE DE RECURSOS (PRE-OFFLINE)', state.resources, 'economy', -3));

    // CRITICAL FIX: Validate time elapsed to prevent exploitation and bugs
    const MAX_OFFLINE_MS = 24 * 60 * 60 * 1000; // 24 hours absolute maximum
    if (timeElapsed < 0) {
        console.error('[Offline] CRITICAL: Negative time elapsed detected!', {
            now,
            lastSaveTime: state.lastSaveTime,
            timeElapsed
        });
        return { newState: state, report, newLogs };
    }

    if (timeElapsed > MAX_OFFLINE_MS) {
        console.warn('[Offline] Excessive time elapsed detected! Capping to 24 hours.', {
            timeElapsed,
            timeElapsedHours: timeElapsed / (60 * 60 * 1000),
            lastSaveTime: state.lastSaveTime,
            now
        });
    }

    if (timeElapsed < 60000) {
        // Incluso si ha pasado poco tiempo, mostramos los logs de estado actual si el usuario lo requiere al importar/continuar
        newLogs.push(createResourceLog('PRODUCCIÓN OFFLINE GENERADA', {}, 'economy', -2));
        newLogs.push(createResourceLog('RECURSOS TRAS AÑADIR PRODUCCIÓN OFFLINE', state.resources, 'economy', -1));
        newLogs.push(createResourceLog('ESTADO FINAL DE RECURSOS EN LA CUENTA', state.resources, 'economy', 0));
        return { newState: state, report, newLogs };
    }

    let newState = { ...state };

    // CRITICAL FIX: Log the exact offline duration for debugging
    console.log('[Offline] Starting offline calculation', {
        timeElapsedMs: timeElapsed,
        timeElapsedHours: timeElapsed / (60 * 60 * 1000),
        lastSaveTime: state.lastSaveTime,
        now,
        saveVersion: state.saveVersion
    });

    const effectiveTimeMs = Math.min(timeElapsed, OFFLINE_PRODUCTION_LIMIT_MS);
    const effectiveTimeSecs = effectiveTimeMs / 1000;

    // CRITICAL FIX: Log if time was capped
    if (timeElapsed > OFFLINE_PRODUCTION_LIMIT_MS) {
        console.log('[Offline] Time capped to 6 hours maximum', {
            originalTimeHours: timeElapsed / (60 * 60 * 1000),
            cappedTimeHours: effectiveTimeMs / (60 * 60 * 1000)
        });
    }

    const multipliers = calculateTechMultipliers(newState.researchedTechs, newState.techLevels);
    const prodRates = calculateProductionRates(newState.buildings, multipliers);
    const upkeepCosts = calculateUpkeepCosts(newState.units);
    const maxStorage = calculateMaxStorage(newState.buildings, multipliers, newState.empirePoints);

    // CRITICAL FIX: Log production rates and storage caps for debugging
    console.log('[Offline] Production rates and caps', {
        prodRates,
        upkeepCosts,
        maxStorage,
        resourcesBefore: { ...newState.resources }
    });

    Object.values(ResourceType).forEach((res) => {
        const prod = (prodRates[res] || 0) * effectiveTimeSecs;
        const upkeep = (upkeepCosts[res] || 0) * effectiveTimeSecs;
        const netChange = prod - upkeep;

        if (res === ResourceType.DIAMOND) {
            const diamondMine = newState.buildings[BuildingType.DIAMOND_MINE];
            if (diamondMine && diamondMine.level > 0 && diamondMine.isDamaged) {
                // No hay producción de diamantes si la mina está dañada
                const prevDiamond = newState.resources[res];
                newState.resources[res] = Math.max(0, newState.resources[res] - upkeep);
                report.resourcesConsumed[res] = Math.floor(prevDiamond) - Math.floor(newState.resources[res]);
                console.log(`[Offline] ${res}: Mine damaged - consuming ${report.resourcesConsumed[res]}`);
                return;
            }
        }

        const prevAmount = newState.resources[res];

        // CRITICAL FIX: Detect and log potential inflation
        if (prevAmount > maxStorage[res] * OVERFLOW_FACTOR) {
            console.warn(`[Offline] ${res}: Potential inflation detected!`, {
                current: prevAmount,
                maxStorage: maxStorage[res],
                overflowFactor: OVERFLOW_FACTOR,
                ratio: prevAmount / maxStorage[res]
            });
        }

        if (netChange > 0) {
            // Permitir conservar el desbordamiento (overflow) si ya existía,
            // pero solo añadir producción si hay espacio bajo el cap.
            const availableSpace = Math.max(0, maxStorage[res] - prevAmount);
            const actualGain = Math.min(netChange, availableSpace);
            newState.resources[res] = prevAmount + actualGain;
            report.resourcesGained[res] = Math.floor(newState.resources[res]) - Math.floor(prevAmount);
            
            // CRITICAL FIX: Log if overflow is being preserved
            if (prevAmount > maxStorage[res]) {
                console.log(`[Offline] ${res}: Preserving overflow - prev=${prevAmount}, cap=${maxStorage[res]}, gain=${actualGain}`);
            }
        } else if (netChange < 0) {
            // El mantenimiento siempre se resta
            newState.resources[res] = Math.max(0, prevAmount + netChange);
            report.resourcesConsumed[res] = Math.floor(prevAmount) - Math.floor(newState.resources[res]);
        }

        if (report.resourcesGained[res] > 0 || report.resourcesConsumed[res] > 0) {
            console.log(`[Offline] ${res}: current=${prevAmount.toFixed(2)} cap=${maxStorage[res]} netChange=${netChange.toFixed(2)} gain=${report.resourcesGained[res]} consumed=${report.resourcesConsumed[res]}`);
        }
    });

    // Log 2: Producción offline generada
    const netProduction: Partial<Record<ResourceType, number>> = {};
    Object.values(ResourceType).forEach(res => {
        netProduction[res] = (report.resourcesGained[res] || 0) - (report.resourcesConsumed[res] || 0);
    });
    newLogs.push(createResourceLog('PRODUCCIÓN OFFLINE GENERADA', netProduction, 'economy', -2));

    // Log 3: Cantidad final después de añadir producción
    newLogs.push(createResourceLog('RECURSOS TRAS AÑADIR PRODUCCIÓN OFFLINE', newState.resources, 'economy', -1));

    if (newState.bankBalance > 0 && newState.buildings[BuildingType.BANK].level > 0) {
        const maxBankCapacity = calculateMaxBankCapacity(newState.empirePoints, newState.buildings[BuildingType.BANK].level);
        if (newState.bankBalance < maxBankCapacity) {
            const interestEarned = calculateInterestEarned(newState.bankBalance, newState.currentInterestRate, effectiveTimeMs);
            
            const actualInterest = Math.min(maxBankCapacity - newState.bankBalance, interestEarned);
            
            const prevBank = newState.bankBalance;
            newState.bankBalance += actualInterest;
            
            // Reportamos el aumento entero
            report.bankInterestEarned = Math.floor(newState.bankBalance) - Math.floor(prevBank);
        }
    }

    const remainingConstructions: typeof newState.activeConstructions = [];
    for (const c of newState.activeConstructions) {
        if (now >= c.endTime) {
            newState.buildings[c.buildingType] = { 
                ...newState.buildings[c.buildingType],
                level: newState.buildings[c.buildingType].level + c.count 
            };
        } else {
            remainingConstructions.push(c);
        }
    }
    newState.activeConstructions = remainingConstructions;

    const remainingRecruitments: typeof newState.activeRecruitments = [];
    for (const r of newState.activeRecruitments) {
        if (now >= r.endTime) {
            newState.units[r.unitType] = (newState.units[r.unitType] || 0) + r.count;
        } else {
            remainingRecruitments.push(r);
        }
    }
    newState.activeRecruitments = remainingRecruitments;

    if (newState.activeResearch && now >= newState.activeResearch.endTime) {
        const techId = newState.activeResearch.techId;
        newState.techLevels[techId] = (newState.techLevels[techId] || 0) + 1;
        if (!newState.researchedTechs.includes(techId)) {
            newState.researchedTechs.push(techId);
        }
        report.completedResearch.push(techId);
        newState.activeResearch = null;
    }

    let nextAttackTime = newState.nextAttackTime || 0;
    if (now > nextAttackTime) {
        const wait = ATTACK_COOLDOWN_MIN_MS + Math.random() * (ATTACK_COOLDOWN_MAX_MS - ATTACK_COOLDOWN_MIN_MS);
        nextAttackTime = now + wait;
    }
    newState.nextAttackTime = nextAttackTime;

    if (now - newState.rankingData.lastUpdateTime >= GROWTH_INTERVAL_MS) {
        const { bots: updatedBots, cycles } = processRankingEvolution(
            newState.rankingData.bots, 
            now - newState.rankingData.lastUpdateTime
        );
        newState.rankingData = {
            bots: updatedBots,
            lastUpdateTime: newState.rankingData.lastUpdateTime + (cycles * GROWTH_INTERVAL_MS)
        };
    }

    // Reputation Decay Offline
    const { updatedBots: decayedBots, newLastDecayTime } = processReputationDecay(
        newState.rankingData.bots,
        newState.lastReputationDecayTime,
        now
    );
    newState.rankingData = {
        ...newState.rankingData,
        bots: decayedBots
    };
    newState.lastReputationDecayTime = newLastDecayTime;

    // Process Nemesis System (Grudges & Retaliation) Offline - BEFORE attack queue
    const { stateUpdates: nemesisUpdates, logs: nemesisLogs } = processNemesisTick(newState, now);
    if (nemesisUpdates.grudges) {
        newState.grudges = nemesisUpdates.grudges;
    }
    if (nemesisUpdates.incomingAttacks) {
        newState.incomingAttacks = nemesisUpdates.incomingAttacks;
    }
    newLogs.push(...nemesisLogs);

    // Process Enemy Attack System Offline (30min checks) - BEFORE attack queue
    const { stateUpdates: enemyAttackUpdates, logs: enemyAttackLogs } = processEnemyAttackCheck(newState, now);
    if (enemyAttackUpdates.enemyAttackCounts) {
        newState.enemyAttackCounts = enemyAttackUpdates.enemyAttackCounts;
    }
    if (enemyAttackUpdates.lastEnemyAttackCheckTime) {
        newState.lastEnemyAttackCheckTime = enemyAttackUpdates.lastEnemyAttackCheckTime;
    }
    if (enemyAttackUpdates.lastEnemyAttackResetTime) {
        newState.lastEnemyAttackResetTime = enemyAttackUpdates.lastEnemyAttackResetTime;
    }
    if (enemyAttackUpdates.incomingAttacks) {
        newState.incomingAttacks = enemyAttackUpdates.incomingAttacks;
    }
    newLogs.push(...enemyAttackLogs);

    // Process ALL attacks in chronological order (includes new attacks from nemesis/enemyAttack)
    const { newState: queueState, queuedResults, newLogs: queueLogs } = processAttackQueue(newState, now);
    newState = queueState;
    report.queuedAttackResults = queuedResults;
    newLogs.push(...queueLogs);

    for (const result of queuedResults) {
        if (result.type === 'OUTGOING' && result.result.logKey) {
            const isSuccess = result.result.logKey === 'log_battle_win' || result.result.logKey.includes('patrol_battle_win') || result.result.logKey.includes('contraband');
            report.completedMissions.push({
                id: result.missionId || result.id,
                success: isSuccess,
                loot: result.result.logParams?.loot || {}
            });
        }
    }

    // CRITICAL FIX: Update lastSaveTime to prevent duplicate offline calculation
    // Without this, the offline progress can be calculated multiple times,
    // causing resources to be added repeatedly (the "millions of resources" bug)
    newState.lastSaveTime = now;

    // CRITICAL FIX: Log final state for debugging
    console.log('[Offline] Calculation completed', {
        timeElapsedHours: timeElapsed / (60 * 60 * 1000),
        effectiveTimeHours: effectiveTimeMs / (60 * 60 * 1000),
        resourcesAfter: { ...newState.resources },
        resourcesGained: report.resourcesGained,
        resourcesConsumed: report.resourcesConsumed,
        bankInterestEarned: report.bankInterestEarned
    });

    // Log 4: Cantidad final de recursos en la cuenta (el más reciente)
    newLogs.push(createResourceLog('ESTADO FINAL DE RECURSOS EN LA CUENTA', newState.resources, 'economy', 0));

    return { newState, report, newLogs };
};
