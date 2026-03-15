/**
 * useP2PAttackLimits
 *
 * Gestiona las reglas de combate P2P:
 *  1. Límite de 6 ataques normales por día contra el mismo jugador (reset 24h).
 *     Persistencia en localStorage para sobrevivir recargas.
 *     No aplica en guerras totales (isWarAttack = true).
 *  2. Validación de rango de puntos: solo se puede atacar a jugadores entre
 *     50% y 150% de los puntos propios.
 */

import { useCallback } from 'react';
import {
  P2P_MAX_ATTACKS_PER_TARGET_PER_DAY,
  P2P_ATTACK_RESET_INTERVAL_MS,
  P2P_ATTACK_COUNTS_STORAGE_KEY,
  PVP_RANGE_MIN,
  PVP_RANGE_MAX,
} from '../constants';

// ============================================================================
// Types
// ============================================================================

export interface P2PAttackRecord {
  count: number;
  lastResetTime: number;
}

export type P2PAttackCountsStore = Record<string, P2PAttackRecord>;

// ============================================================================
// Helpers — localStorage persistence
// ============================================================================

const loadAttackCounts = (): P2PAttackCountsStore => {
  try {
    const raw = localStorage.getItem(P2P_ATTACK_COUNTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as P2PAttackCountsStore) : {};
  } catch {
    return {};
  }
};

const saveAttackCounts = (store: P2PAttackCountsStore): void => {
  try {
    localStorage.setItem(P2P_ATTACK_COUNTS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage not available — continue silently
  }
};

/** Returns the record for a target, resetting the count if 24h have elapsed. */
const getOrResetRecord = (
  store: P2PAttackCountsStore,
  targetId: string,
  now: number
): P2PAttackRecord => {
  const existing = store[targetId];
  if (!existing) {
    return { count: 0, lastResetTime: now };
  }
  if (now - existing.lastResetTime >= P2P_ATTACK_RESET_INTERVAL_MS) {
    // 24 hours elapsed — reset
    return { count: 0, lastResetTime: now };
  }
  return existing;
};

// ============================================================================
// Hook
// ============================================================================

export const useP2PAttackLimits = () => {
  /**
   * Returns how many normal attacks the local player has already launched
   * against `targetId` today (accounting for 24h reset).
   */
  const getAttackCount = useCallback((targetId: string): number => {
    const store = loadAttackCounts();
    const now = Date.now();
    const record = getOrResetRecord(store, targetId, now);
    return record.count;
  }, []);

  /**
   * Returns how many attacks remain (out of 6) against `targetId` today.
   */
  const getRemainingAttacks = useCallback((targetId: string): number => {
    const used = getAttackCount(targetId);
    return Math.max(0, P2P_MAX_ATTACKS_PER_TARGET_PER_DAY - used);
  }, [getAttackCount]);

  /**
   * Returns whether a normal P2P attack (not a war) is allowed:
   *  - Player must have attacks remaining (< 6).
   */
  const canAttack = useCallback(
    (targetId: string, isWarAttack = false): boolean => {
      // Wars have no daily attack limit
      if (isWarAttack) return true;
      return getRemainingAttacks(targetId) > 0;
    },
    [getRemainingAttacks]
  );

  /**
   * Registers one attack against `targetId`. Call this AFTER the attack is
   * confirmed (not in war mode). Returns the updated count.
   */
  const registerAttack = useCallback(
    (targetId: string, isWarAttack = false): number => {
      if (isWarAttack) return 0; // war attacks are not counted
      const store = loadAttackCounts();
      const now = Date.now();
      const record = getOrResetRecord(store, targetId, now);
      const updated: P2PAttackRecord = {
        count: record.count + 1,
        lastResetTime: record.lastResetTime,
      };
      store[targetId] = updated;
      saveAttackCounts(store);
      return updated.count;
    },
    []
  );

  /**
   * Milliseconds remaining until the next 24h reset for `targetId`.
   * Returns 0 if already reset or no record exists.
   */
  const msUntilReset = useCallback((targetId: string): number => {
    const store = loadAttackCounts();
    const now = Date.now();
    const existing = store[targetId];
    if (!existing) return 0;
    const elapsed = now - existing.lastResetTime;
    if (elapsed >= P2P_ATTACK_RESET_INTERVAL_MS) return 0;
    return P2P_ATTACK_RESET_INTERVAL_MS - elapsed;
  }, []);

  /**
   * Validates whether `attackerScore` is within the allowed range to attack
   * `targetScore` (50% to 150% of own score).
   */
  const isInPointRange = useCallback(
    (attackerScore: number, targetScore: number): boolean => {
      if (attackerScore <= 0) return false;
      const minAllowed = attackerScore * PVP_RANGE_MIN; // 50%
      const maxAllowed = attackerScore * PVP_RANGE_MAX; // 150%
      return targetScore >= minAllowed && targetScore <= maxAllowed;
    },
    []
  );

  return {
    canAttack,
    registerAttack,
    getAttackCount,
    getRemainingAttacks,
    msUntilReset,
    isInPointRange,
    maxAttacksPerDay: P2P_MAX_ATTACKS_PER_TARGET_PER_DAY,
  };
};
