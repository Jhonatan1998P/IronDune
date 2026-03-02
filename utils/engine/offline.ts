import { GameState, ResourceType, BuildingType, OfflineReport, LogEntry } from '../../types';
import { calculateTechMultipliers, calculateMaxStorage, calculateProductionRates, calculateUpkeepCosts, calculateMaxBankCapacity } from './modifiers';
import { 
    OFFLINE_PRODUCTION_LIMIT_MS,
    ATTACK_COOLDOWN_MIN_MS,
    ATTACK_COOLDOWN_MAX_MS
} from '../../constants';
import { processRankingEvolution, GROWTH_INTERVAL_MS } from './rankings';
import { processReputationDecay } from './diplomacy';
import { processNemesisTick } from './nemesis';
import { processEnemyAttackCheck } from './enemyAttack';
import { processAttackQueue } from './attackQueue';

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
        bankInterestEarned: 0,
        completedResearch: [],
        completedMissions: [],
        queuedAttackResults: [],
    };

    const newLogs: LogEntry[] = [];

    if (timeElapsed < 60000) {
        return { newState: state, report, newLogs };
    }

    let newState = { ...state };
    
    const effectiveTimeMs = Math.min(timeElapsed, OFFLINE_PRODUCTION_LIMIT_MS);
    const effectiveTimeSecs = effectiveTimeMs / 1000;

    const multipliers = calculateTechMultipliers(newState.researchedTechs, newState.techLevels);
    const prodRates = calculateProductionRates(newState.buildings, multipliers);
    const upkeepCosts = calculateUpkeepCosts(newState.units);
    const maxStorage = calculateMaxStorage(newState.buildings, multipliers, newState.empirePoints);

    Object.values(ResourceType).forEach((res) => {
        const prod = (prodRates[res] || 0) * effectiveTimeSecs;
        const upkeep = (upkeepCosts[res] || 0) * effectiveTimeSecs;
        let netChange = prod - upkeep;

        if (res === ResourceType.DIAMOND) {
            const diamondMine = newState.buildings[BuildingType.DIAMOND_MINE];
            if (diamondMine && diamondMine.level > 0 && diamondMine.isDamaged) {
                netChange = 0;
            }
        }

        if (netChange > 0) {
            report.resourcesGained[res] = Math.floor(netChange);
        }

        newState.resources[res] = Math.max(0, Math.min(maxStorage[res], newState.resources[res] + netChange));
    });

    if (newState.bankBalance > 0 && newState.buildings[BuildingType.BANK].level > 0) {
        const maxBankCapacity = calculateMaxBankCapacity(newState.empirePoints, newState.buildings[BuildingType.BANK].level);
        if (newState.bankBalance < maxBankCapacity) {
            const minuteRate = newState.currentInterestRate / 360; 
            const timeInMinutes = effectiveTimeMs / 60000;
            const interestEarned = newState.bankBalance * minuteRate * timeInMinutes;
            const actualInterest = Math.min(maxBankCapacity - newState.bankBalance, interestEarned);
            newState.bankBalance += actualInterest;
            report.bankInterestEarned = Math.floor(actualInterest);
        }
    }

    const remainingConstructions: typeof newState.activeConstructions = [];
    for (const c of newState.activeConstructions) {
        if (now >= c.endTime) {
            newState.buildings[c.buildingType] = { level: newState.buildings[c.buildingType].level + c.count };
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

    return { newState, report, newLogs };
};
