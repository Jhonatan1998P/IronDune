// ============================================================
// COMBAT ENGINE - Mirror of utils/engine/combat.ts
// ============================================================

import { UNIT_DEFS } from './units.js';
import { UnitType } from './enums.js';

const MAX_ROUNDS = 6;
const EXPLOSION_THRESHOLD_PCT = 0.70;
const SHIELD_PENETRATION_THRESHOLD = 0.01;

const TARGETING_TIER_CHANCE = {
  1: 0.01,
  2: 0.02,
  3: 0.04,
  4: 0.06,
  5: 0.06,
};

const UNIT_TIER_MAP = {
  [UnitType.CYBER_MARINE]: 1,
  [UnitType.HEAVY_COMMANDO]: 2,
  [UnitType.SCOUT_TANK]: 3,
  [UnitType.TITAN_MBT]: 3,
  [UnitType.WRAITH_GUNSHIP]: 3,
  [UnitType.ACE_FIGHTER]: 4,
  [UnitType.AEGIS_DESTROYER]: 4,
  [UnitType.PHANTOM_SUB]: 5,
  [UnitType.SALVAGER_DRONE]: 1,
};

const selectSmartTarget = (attacker, targets) => {
  const validTargets = targets.filter(t => t && !t.isDead);
  if (validTargets.length === 0) return null;

  const attackerTier = UNIT_TIER_MAP[attacker.type];
  const targetingChance = TARGETING_TIER_CHANCE[attackerTier] || 0;
  const rfMap = attacker.def.rapidFire;

  if (!rfMap || targetingChance === 0) {
    return validTargets[Math.floor(Math.random() * validTargets.length)] || null;
  }

  if (Math.random() < targetingChance) {
    const counterTargets = validTargets.filter(t => rfMap[t.type] !== undefined);
    if (counterTargets.length > 0) {
      return counterTargets[Math.floor(Math.random() * counterTargets.length)];
    }
  }

  return validTargets[Math.floor(Math.random() * validTargets.length)] || null;
};

export const UNIT_PRIORITY = [
  UnitType.CYBER_MARINE, UnitType.HEAVY_COMMANDO, UnitType.SCOUT_TANK,
  UnitType.TITAN_MBT, UnitType.WRAITH_GUNSHIP, UnitType.ACE_FIGHTER,
  UnitType.AEGIS_DESTROYER, UnitType.PHANTOM_SUB, UnitType.SALVAGER_DRONE,
];

const getOrInitPerf = (matrix, type) => {
  let slot = matrix[type];
  if (!slot) {
    slot = { kills: {}, deathsBy: {}, damageDealt: 0, criticalKills: 0, criticalDeaths: 0 };
    matrix[type] = slot;
  }
  return slot;
};

const createArmyEntities = (army, side, startId, allyId) => {
  const entities = [];
  let idCounter = startId;
  for (const [uKey, count] of Object.entries(army)) {
    if (!count || count <= 0) continue;
    const def = UNIT_DEFS[uKey];
    if (!def) continue;
    for (let i = 0; i < count; i++) {
      entities.push({
        id: idCounter++,
        type: uKey,
        side,
        allyId: side === 'ALLY' ? allyId : undefined,
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

export const simulateCombat = (
  initialPlayerArmy,
  initialEnemyArmy,
  playerDamageMultiplier = 1.0,
  initialAllyArmies,
  playerHpMultiplier = 1.0,
  playerDefenseMultiplier = 1.0
) => {
  const playerEntities = [];
  let idCounter = 0;

  for (const [uKey, count] of Object.entries(initialPlayerArmy)) {
    if (!count || count <= 0) continue;
    const def = UNIT_DEFS[uKey];
    if (!def) continue;
    for (let i = 0; i < count; i++) {
      const hp = def.hp * playerHpMultiplier;
      const defense = def.defense * playerDefenseMultiplier;
      playerEntities.push({
        id: idCounter++,
        type: uKey,
        side: 'PLAYER',
        hp, maxHp: hp, defense, maxDefense: defense,
        isDead: false, markedForDeath: false, def,
      });
    }
  }

  let allyEntities = [];
  let currentId = playerEntities.length;
  const allyArmiesMap = {};

  if (initialAllyArmies) {
    for (const [allyId, army] of Object.entries(initialAllyArmies)) {
      const entities = createArmyEntities(army, 'ALLY', currentId, allyId);
      allyArmiesMap[allyId] = entities;
      allyEntities = allyEntities.concat(entities);
      currentId += entities.length;
    }
  }

  const enemyEntities = createArmyEntities(initialEnemyArmy, 'ENEMY', currentId);
  const allUnits = [...playerEntities, ...allyEntities, ...enemyEntities];

  let playerTotalHpStart = 0, enemyTotalHpStart = 0;
  for (const u of allUnits) {
    if (u.side === 'PLAYER' || u.side === 'ALLY') playerTotalHpStart += u.maxHp;
    else enemyTotalHpStart += u.maxHp;
  }

  let playerDamageDealt = 0, enemyDamageDealt = 0;
  const allyDamageDealt = {};
  const playerPerformance = {};
  const enemyPerformance = {};
  const allyPerformance = {};

  if (initialAllyArmies) {
    for (const allyId of Object.keys(initialAllyArmies)) {
      allyPerformance[allyId] = {};
      allyDamageDealt[allyId] = 0;
    }
  }

  const rounds = [];
  const playerTargets = [];
  const enemyTargets = [];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    playerTargets.length = 0;
    enemyTargets.length = 0;

    for (const u of allUnits) {
      if (u.isDead) continue;
      u.defense = u.maxDefense;
      u.markedForDeath = false;
      if (u.side === 'PLAYER' || u.side === 'ALLY') playerTargets.push(u);
      else enemyTargets.push(u);
    }

    let pTargetCount = playerTargets.length;
    let eTargetCount = enemyTargets.length;

    if (pTargetCount === 0 || eTargetCount === 0) break;

    const roundLog = {
      round,
      playerUnitsStart: pTargetCount,
      enemyUnitsStart: eTargetCount,
      playerUnitsLost: 0,
      enemyUnitsLost: 0,
      details: [],
    };

    const shooters = [...playerTargets, ...enemyTargets];
    for (let i = shooters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shooters[i]; shooters[i] = shooters[j]; shooters[j] = tmp;
    }

    for (const attacker of shooters) {
      const isPlayer = attacker.side === 'PLAYER';
      const isAlly = attacker.side === 'ALLY';
      const isFriendly = isPlayer || isAlly;

      const targets = isFriendly ? enemyTargets : playerTargets;
      let targetCount = isFriendly ? eTargetCount : pTargetCount;

      const baseDamage = isFriendly
        ? Math.floor(attacker.def.attack * playerDamageMultiplier)
        : attacker.def.attack;

      let attackerPerf;
      if (isPlayer) attackerPerf = playerPerformance;
      else if (isAlly && attacker.allyId) attackerPerf = allyPerformance[attacker.allyId] || {};
      else attackerPerf = enemyPerformance;

      const aPerfSlot = getOrInitPerf(attackerPerf, attacker.type);
      const rfMap = attacker.def.rapidFire;
      let keepShooting = true;

      while (keepShooting) {
        keepShooting = false;
        if (targetCount <= 0 || targets.length === 0) break;

        const target = selectSmartTarget(attacker, targets);
        if (!target || target.isDead) break;

        aPerfSlot.damageDealt += baseDamage;
        if (isPlayer) playerDamageDealt += baseDamage;
        else if (isAlly && attacker.allyId) allyDamageDealt[attacker.allyId] += baseDamage;
        else enemyDamageDealt += baseDamage;

        if (baseDamage > target.maxDefense * SHIELD_PENETRATION_THRESHOLD) {
          let hullDamage;
          if (target.defense > 0) {
            if (baseDamage <= target.defense) {
              target.defense -= baseDamage;
              hullDamage = 0;
            } else {
              hullDamage = baseDamage - target.defense;
              target.defense = 0;
            }
          } else {
            hullDamage = baseDamage;
          }

          if (hullDamage > 0) {
            const hpBeforeHit = target.hp;
            target.hp -= hullDamage;
            let died = false;

            if (target.hp <= 0) {
              target.hp = 0;
              died = true;
              let victimPerf;
              if (target.side === 'PLAYER') victimPerf = playerPerformance;
              else if (target.side === 'ALLY' && target.allyId) victimPerf = allyPerformance[target.allyId];
              else victimPerf = enemyPerformance;
              const vPerfSlot = getOrInitPerf(victimPerf, target.type);
              aPerfSlot.kills[target.type] = (aPerfSlot.kills[target.type] || 0) + 1;
              vPerfSlot.deathsBy[attacker.type] = (vPerfSlot.deathsBy[attacker.type] || 0) + 1;
            } else if (target.hp < target.maxHp * EXPLOSION_THRESHOLD_PCT) {
              const explosionChance = hullDamage / hpBeforeHit;
              if (Math.random() < explosionChance) {
                target.hp = 0;
                died = true;
                let victimPerf;
                if (target.side === 'PLAYER') victimPerf = playerPerformance;
                else if (target.side === 'ALLY' && target.allyId) victimPerf = allyPerformance[target.allyId];
                else victimPerf = enemyPerformance;
                const vPerfSlot = getOrInitPerf(victimPerf, target.type);
                aPerfSlot.kills[target.type] = (aPerfSlot.kills[target.type] || 0) + 1;
                aPerfSlot.criticalKills++;
                vPerfSlot.deathsBy[attacker.type] = (vPerfSlot.deathsBy[attacker.type] || 0) + 1;
                vPerfSlot.criticalDeaths++;
              }
            }

            if (died) {
              target.markedForDeath = true;
              const targetIndex = targets.indexOf(target);
              if (targetCount > 0 && targetIndex >= 0 && targetIndex < targets.length) {
                targets[targetIndex] = targets[targetCount - 1];
              }
              targetCount--;
              if (isFriendly) eTargetCount = targetCount;
              else pTargetCount = targetCount;
            }
          }
        }

        if (rfMap) {
          const rfChance = rfMap[target.type];
          if (rfChance && rfChance > 0 && Math.random() < rfChance) {
            keepShooting = true;
          }
        }
      }
    }

    let pLostThisRound = 0, eLostThisRound = 0;
    for (const u of allUnits) {
      if (u.markedForDeath && !u.isDead) {
        u.isDead = true;
        if (u.side === 'PLAYER') pLostThisRound++;
        else eLostThisRound++;
      }
    }

    roundLog.playerUnitsLost = pLostThisRound;
    roundLog.enemyUnitsLost = eLostThisRound;
    rounds.push(roundLog);
  }

  let playerHpEnd = 0, enemyHpEnd = 0;
  const allyHpEnd = {};
  const finalPlayerArmy = {};
  const finalEnemyArmy = {};
  const finalAllyArmies = {};

  if (initialAllyArmies) {
    for (const allyId of Object.keys(initialAllyArmies)) {
      allyHpEnd[allyId] = 0;
      finalAllyArmies[allyId] = {};
    }
  }

  for (const u of allUnits) {
    if (u.isDead) continue;
    if (u.side === 'PLAYER') {
      playerHpEnd += u.hp;
      finalPlayerArmy[u.type] = (finalPlayerArmy[u.type] || 0) + 1;
    } else if (u.side === 'ALLY' && u.allyId) {
      allyHpEnd[u.allyId] += u.hp;
      finalAllyArmies[u.allyId][u.type] = (finalAllyArmies[u.allyId][u.type] || 0) + 1;
    } else {
      enemyHpEnd += u.hp;
      finalEnemyArmy[u.type] = (finalEnemyArmy[u.type] || 0) + 1;
    }
  }

  const totalPlayerCasualties = calculateCasualties(initialPlayerArmy, finalPlayerArmy);
  const totalEnemyCasualties = calculateCasualties(initialEnemyArmy, finalEnemyArmy);
  const totalAllyCasualties = {};

  if (initialAllyArmies) {
    for (const [allyId, army] of Object.entries(initialAllyArmies)) {
      totalAllyCasualties[allyId] = calculateCasualties(army, finalAllyArmies[allyId] || {});
    }
  }

  const combinedFinalArmy = { ...finalPlayerArmy };
  if (initialAllyArmies) {
    for (const allyArmy of Object.values(finalAllyArmies)) {
      for (const [uType, count] of Object.entries(allyArmy)) {
        combinedFinalArmy[uType] = (combinedFinalArmy[uType] || 0) + (count || 0);
      }
    }
  }

  const winner = determineWinner(initialPlayerArmy, initialEnemyArmy, combinedFinalArmy, finalEnemyArmy);

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
    enemyPerformance,
    initialAllyArmies: initialAllyArmies ? { ...initialAllyArmies } : undefined,
    finalAllyArmies: initialAllyArmies ? finalAllyArmies : undefined,
    totalAllyCasualties: initialAllyArmies ? totalAllyCasualties : undefined,
    allyDamageDealt: initialAllyArmies ? allyDamageDealt : undefined,
    allyPerformance: initialAllyArmies ? allyPerformance : undefined,
  };
};

const calculateCasualties = (initial, final) => {
  const casualties = {};
  for (const key of Object.keys(initial)) {
    const lost = (initial[key] || 0) - (final[key] || 0);
    if (lost > 0) casualties[key] = lost;
  }
  return casualties;
};

const determineWinner = (startP, startE, endP, endE) => {
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

export const calculateCombatStats = (army) => {
  let totalAttack = 0, totalDefense = 0, totalHp = 0;
  for (const [uType, count] of Object.entries(army)) {
    if (!count || count <= 0) continue;
    const def = UNIT_DEFS[uType];
    if (!def) continue;
    totalAttack += def.attack * count;
    totalDefense += def.defense * count;
    totalHp += def.hp * count;
  }
  return { attack: totalAttack, defense: totalDefense, hp: totalHp };
};
