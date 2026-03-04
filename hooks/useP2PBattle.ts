/**
 * useP2PBattle - Hook principal del sistema de batalla P2P
 * 
 * Maneja el flujo completo de batalla entre jugadores:
 * 1. Desafío (challenge/accept/decline)
 * 2. Preparación (selección de ejército)
 * 3. Confirmación (lock de ejército)
 * 4. Resolución (combate determinístico)
 * 5. Resultado (sincronización de resultado)
 * 
 * Usa Trystero para comunicación P2P y Yjs + y-indexeddb para
 * persistencia local del historial de batallas.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMultiplayer } from './useMultiplayer';
import { useYjsSync } from './useYjsSync';
import { simulateCombat } from '../utils/engine/combat';
import { calculateCombatStats } from '../utils/engine/combat';
import type { UnitType } from '../types/enums';
import type {
  P2PBattleState,
  P2PBattleStatus,
  P2PBattleRecord,
  BattleChallengePayload,
  BattleAcceptPayload,
  BattleDeclinePayload,
  BattleArmyLockPayload,
  BattleResultSyncPayload,
  BattleCancelPayload,
  MultiplayerAction,
  PlayerPresence,
} from '../types/multiplayer';
import { MultiplayerActionType } from '../types/multiplayer';

// ============================================================================
// CONSTANTS
// ============================================================================

const CHALLENGE_TIMEOUT_MS = 30_000; // 30 seconds to accept/decline
const ARMY_LOCK_TIMEOUT_MS = 120_000; // 2 minutes to select & lock army
const BATTLE_HISTORY_DB = 'p2p-battle-history';
const MAX_HISTORY = 50;

// ============================================================================
// HELPERS
// ============================================================================

const generateBattleId = (): string =>
  `battle_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

/**
 * Generate a deterministic seed from battleId for reproducible combat
 */
const generateSeed = (battleId: string): number => {
  let hash = 0;
  for (let i = 0; i < battleId.length; i++) {
    const char = battleId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
};

/**
 * Convert Record<string, number> to Partial<Record<UnitType, number>>
 */
const toUnitRecord = (army: Record<string, number>): Partial<Record<UnitType, number>> => {
  const result: Partial<Record<UnitType, number>> = {};
  for (const [key, value] of Object.entries(army)) {
    if (value > 0) {
      result[key as UnitType] = value;
    }
  }
  return result;
};

// ============================================================================
// INITIAL STATE
// ============================================================================

const INITIAL_BATTLE_STATE: P2PBattleState = {
  battleId: '',
  status: 'IDLE',
  opponentPeerId: '',
  opponentName: '',
  opponentScore: 0,
  isChallenger: false,
  myArmy: null,
  opponentArmy: null,
  myArmyLocked: false,
  opponentArmyLocked: false,
  result: null,
  startedAt: 0,
  resolvedAt: null,
};

// ============================================================================
// HOOK
// ============================================================================

export const useP2PBattle = (playerName: string, empirePoints: number, _playerUnits?: Record<UnitType, number>) => {
  const {
    isConnected,
    localPlayerId,
    remotePlayers,
    sendToPeer,
    onRemoteAction,
  } = useMultiplayer();

  // Battle state
  const [battle, setBattle] = useState<P2PBattleState>(INITIAL_BATTLE_STATE);
  const [history, setHistory] = useState<P2PBattleRecord[]>([]);
  const [pendingChallenge, setPendingChallenge] = useState<BattleChallengePayload | null>(null);

  // Refs for timeout management
  const challengeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armyLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const battleRef = useRef<P2PBattleState>(INITIAL_BATTLE_STATE);

  // Yjs for battle history persistence
  const yjs = useYjsSync({ dbName: BATTLE_HISTORY_DB, enablePersistence: true });

  // Keep ref in sync with state
  useEffect(() => {
    battleRef.current = battle;
  }, [battle]);

  // Load history from Yjs on mount
  useEffect(() => {
    if (yjs.isReady && yjs.doc) {
      try {
        const historyMap = yjs.getMap<string>('history');
        const records: P2PBattleRecord[] = [];
        historyMap.forEach((value: string) => {
          try {
            records.push(JSON.parse(value));
          } catch { /* skip corrupted entries */ }
        });
        records.sort((a, b) => b.timestamp - a.timestamp);
        setHistory(records.slice(0, MAX_HISTORY));
        console.log('[P2PBattle] Loaded', records.length, 'history records from IndexedDB');
      } catch (e) {
        console.warn('[P2PBattle] Failed to load history:', e);
      }
    }
  }, [yjs.isReady, yjs.doc]);

  // ============================================================================
  // CLEANUP
  // ============================================================================

  const clearTimeouts = useCallback(() => {
    if (challengeTimeoutRef.current) {
      clearTimeout(challengeTimeoutRef.current);
      challengeTimeoutRef.current = null;
    }
    if (armyLockTimeoutRef.current) {
      clearTimeout(armyLockTimeoutRef.current);
      armyLockTimeoutRef.current = null;
    }
  }, []);

  const resetBattle = useCallback(() => {
    clearTimeouts();
    setBattle(INITIAL_BATTLE_STATE);
    setPendingChallenge(null);
  }, [clearTimeouts]);

  // ============================================================================
  // SAVE BATTLE TO HISTORY
  // ============================================================================

  const saveBattleToHistory = useCallback((record: P2PBattleRecord) => {
    setHistory(prev => {
      const updated = [record, ...prev].slice(0, MAX_HISTORY);
      return updated;
    });

    // Persist to IndexedDB via Yjs
    if (yjs.isReady && yjs.doc) {
      try {
        yjs.transact(() => {
          const historyMap = yjs.getMap<string>('history');
          historyMap.set(record.battleId, JSON.stringify(record));

          // Prune old entries
          const keys: string[] = [];
          historyMap.forEach((_: string, key: string) => keys.push(key));
          if (keys.length > MAX_HISTORY) {
            const allRecords: P2PBattleRecord[] = [];
            historyMap.forEach((value: string) => {
              try { allRecords.push(JSON.parse(value)); } catch { /* skip */ }
            });
            allRecords.sort((a, b) => b.timestamp - a.timestamp);
            const toRemove = allRecords.slice(MAX_HISTORY);
            toRemove.forEach(r => historyMap.delete(r.battleId));
          }
        });
      } catch (e) {
        console.warn('[P2PBattle] Failed to persist history:', e);
      }
    }
  }, [yjs]);

  // ============================================================================
  // RESOLVE COMBAT
  // ============================================================================

  const resolveCombat = useCallback((
    battleId: string,
    myArmy: Record<string, number>,
    opponentArmy: Record<string, number>,
    isChallenger: boolean,
    opponentName: string,
    opponentScore: number,
    opponentPeerId: string
  ) => {
    console.log('[P2PBattle] Resolving combat for battle:', battleId);

    const attackerArmy = isChallenger ? myArmy : opponentArmy;
    const defenderArmy = isChallenger ? opponentArmy : myArmy;

    // Run combat simulation using existing combat engine
    const result = simulateCombat(
      toUnitRecord(attackerArmy),
      toUnitRecord(defenderArmy)
    );

    // Determine winner from local player perspective
    let winner: 'PLAYER' | 'ENEMY' | 'DRAW';
    if (result.winner === 'DRAW') {
      winner = 'DRAW';
    } else if (isChallenger) {
      winner = result.winner; // PLAYER = challenger won
    } else {
      // We are the defender: invert result
      winner = result.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER';
    }

    const attackerSurvivors: Record<string, number> = {};
    const defenderSurvivors: Record<string, number> = {};
    Object.entries(result.finalPlayerArmy).forEach(([k, v]) => {
      if (v && v > 0) attackerSurvivors[k] = v;
    });
    Object.entries(result.finalEnemyArmy).forEach(([k, v]) => {
      if (v && v > 0) defenderSurvivors[k] = v;
    });

    const attackerCasualties: Record<string, number> = {};
    const defenderCasualties: Record<string, number> = {};
    Object.entries(result.totalPlayerCasualties).forEach(([k, v]) => {
      if (v && v > 0) attackerCasualties[k] = v;
    });
    Object.entries(result.totalEnemyCasualties).forEach(([k, v]) => {
      if (v && v > 0) defenderCasualties[k] = v;
    });

    const seed = generateSeed(battleId);

    const resultPayload: BattleResultSyncPayload = {
      battleId,
      winner: result.winner,
      attackerArmy,
      defenderArmy,
      attackerSurvivors,
      defenderSurvivors,
      attackerCasualties,
      defenderCasualties,
      rounds: result.rounds.length,
      seed,
    };

    // Update battle state
    setBattle(prev => ({
      ...prev,
      status: 'RESULT' as P2PBattleStatus,
      result: resultPayload,
      resolvedAt: Date.now(),
    }));

    // Save to history
    const myCasualties = isChallenger ? attackerCasualties : defenderCasualties;
    const oppCasualties = isChallenger ? defenderCasualties : attackerCasualties;

    saveBattleToHistory({
      battleId,
      opponentName,
      opponentScore,
      winner,
      myArmy,
      opponentArmy,
      myCasualties,
      opponentCasualties: oppCasualties,
      timestamp: Date.now(),
    });

    // Broadcast result to opponent
    sendToPeer(opponentPeerId, {
      type: MultiplayerActionType.BATTLE_RESULT_SYNC,
      payload: resultPayload as any,
      playerId: localPlayerId || '',
      timestamp: Date.now(),
    });

    return resultPayload;
  }, [localPlayerId, sendToPeer, saveBattleToHistory]);

  // ============================================================================
  // PUBLIC API: CHALLENGE
  // ============================================================================

  const challengePlayer = useCallback((targetPeerId: string) => {
    if (!isConnected || !localPlayerId) return;
    if (battle.status !== 'IDLE') {
      console.warn('[P2PBattle] Cannot challenge: already in battle');
      return;
    }

    const battleId = generateBattleId();
    const payload: BattleChallengePayload = {
      battleId,
      challengerName: playerName,
      challengerScore: empirePoints,
      challengerPeerId: localPlayerId,
    };

    // Find opponent name
    const opponent = remotePlayers.find((p: PlayerPresence) => p.id === targetPeerId);
    const opponentName = opponent?.name || 'Unknown';
    const opponentScore = opponent?.level || 0;

    setBattle({
      battleId,
      status: 'CHALLENGING',
      opponentPeerId: targetPeerId,
      opponentName,
      opponentScore,
      isChallenger: true,
      myArmy: null,
      opponentArmy: null,
      myArmyLocked: false,
      opponentArmyLocked: false,
      result: null,
      startedAt: Date.now(),
      resolvedAt: null,
    });

    sendToPeer(targetPeerId, {
      type: MultiplayerActionType.BATTLE_CHALLENGE,
      payload: payload as any,
      playerId: localPlayerId,
      timestamp: Date.now(),
    });

    // Timeout: auto-cancel if no response
    challengeTimeoutRef.current = setTimeout(() => {
      if (battleRef.current.status === 'CHALLENGING') {
        console.log('[P2PBattle] Challenge timed out');
        resetBattle();
      }
    }, CHALLENGE_TIMEOUT_MS);

    console.log('[P2PBattle] Challenge sent to:', targetPeerId, 'battleId:', battleId);
  }, [isConnected, localPlayerId, playerName, empirePoints, battle.status, remotePlayers, sendToPeer, resetBattle]);

  // ============================================================================
  // PUBLIC API: ACCEPT / DECLINE CHALLENGE
  // ============================================================================

  const acceptChallenge = useCallback(() => {
    if (!pendingChallenge || !localPlayerId) return;

    const { battleId, challengerPeerId, challengerName, challengerScore } = pendingChallenge;

    const acceptPayload: BattleAcceptPayload = {
      battleId,
      accepterName: playerName,
      accepterScore: empirePoints,
      accepterPeerId: localPlayerId,
    };

    setBattle({
      battleId,
      status: 'PREPARING',
      opponentPeerId: challengerPeerId,
      opponentName: challengerName,
      opponentScore: challengerScore,
      isChallenger: false,
      myArmy: null,
      opponentArmy: null,
      myArmyLocked: false,
      opponentArmyLocked: false,
      result: null,
      startedAt: Date.now(),
      resolvedAt: null,
    });

    sendToPeer(challengerPeerId, {
      type: MultiplayerActionType.BATTLE_ACCEPT,
      payload: acceptPayload as any,
      playerId: localPlayerId,
      timestamp: Date.now(),
    });

    setPendingChallenge(null);

    // Start army lock timeout
    armyLockTimeoutRef.current = setTimeout(() => {
      if (battleRef.current.status === 'PREPARING' || battleRef.current.status === 'WAITING_LOCK') {
        console.log('[P2PBattle] Army lock timed out - cancelling');
        cancelBattle('Tiempo de preparación agotado');
      }
    }, ARMY_LOCK_TIMEOUT_MS);

    console.log('[P2PBattle] Challenge accepted:', battleId);
  }, [pendingChallenge, localPlayerId, playerName, empirePoints, sendToPeer]);

  const declineChallenge = useCallback(() => {
    if (!pendingChallenge || !localPlayerId) return;

    const declinePayload: BattleDeclinePayload = {
      battleId: pendingChallenge.battleId,
      reason: 'Desafío rechazado',
    };

    sendToPeer(pendingChallenge.challengerPeerId, {
      type: MultiplayerActionType.BATTLE_DECLINE,
      payload: declinePayload as any,
      playerId: localPlayerId,
      timestamp: Date.now(),
    });

    setPendingChallenge(null);
    console.log('[P2PBattle] Challenge declined:', pendingChallenge.battleId);
  }, [pendingChallenge, localPlayerId, sendToPeer]);

  // ============================================================================
  // PUBLIC API: ARMY SELECTION & LOCK
  // ============================================================================

  const setMyArmy = useCallback((army: Record<string, number>) => {
    if (battle.status !== 'PREPARING') return;
    setBattle(prev => ({ ...prev, myArmy: army }));
  }, [battle.status]);

  const lockArmy = useCallback(() => {
    if (battle.status !== 'PREPARING' || !battle.myArmy || !localPlayerId) return;

    const totalPower = calculateCombatStats(toUnitRecord(battle.myArmy));
    const lockPayload: BattleArmyLockPayload = {
      battleId: battle.battleId,
      army: battle.myArmy,
      totalPower: totalPower.attack + totalPower.hp,
    };

    sendToPeer(battle.opponentPeerId, {
      type: MultiplayerActionType.BATTLE_ARMY_LOCK,
      payload: lockPayload as any,
      playerId: localPlayerId,
      timestamp: Date.now(),
    });

    const newStatus: P2PBattleStatus = battle.opponentArmyLocked ? 'RESOLVING' : 'WAITING_LOCK';

    setBattle(prev => ({
      ...prev,
      myArmyLocked: true,
      status: newStatus,
    }));

    // If both locked, resolve combat
    if (battle.opponentArmyLocked && battle.opponentArmy) {
      setTimeout(() => {
        const currentBattle = battleRef.current;
        if (currentBattle.myArmy && currentBattle.opponentArmy) {
          resolveCombat(
            currentBattle.battleId,
            currentBattle.myArmy,
            currentBattle.opponentArmy,
            currentBattle.isChallenger,
            currentBattle.opponentName,
            currentBattle.opponentScore,
            currentBattle.opponentPeerId
          );
        }
      }, 500);
    }

    console.log('[P2PBattle] Army locked, status:', newStatus);
  }, [battle, localPlayerId, sendToPeer, resolveCombat]);

  // ============================================================================
  // PUBLIC API: CANCEL
  // ============================================================================

  const cancelBattle = useCallback((reason: string = 'Batalla cancelada') => {
    if (!localPlayerId) return;
    if (battle.status === 'IDLE' || battle.status === 'RESULT') return;

    const cancelPayload: BattleCancelPayload = {
      battleId: battle.battleId,
      reason,
    };

    if (battle.opponentPeerId) {
      sendToPeer(battle.opponentPeerId, {
        type: MultiplayerActionType.BATTLE_CANCEL,
        payload: cancelPayload as any,
        playerId: localPlayerId,
        timestamp: Date.now(),
      });
    }

    resetBattle();
    console.log('[P2PBattle] Battle cancelled:', reason);
  }, [battle, localPlayerId, sendToPeer, resetBattle]);

  // ============================================================================
  // INCOMING ACTION HANDLER
  // ============================================================================

  useEffect(() => {
    onRemoteAction((action: MultiplayerAction) => {
      switch (action.type) {
        case MultiplayerActionType.BATTLE_CHALLENGE: {
          const payload = action.payload as unknown as BattleChallengePayload;
          if (!payload?.battleId) return;

          // Only accept challenges if we're IDLE
          if (battleRef.current.status !== 'IDLE') {
            // Auto-decline if busy
            if (localPlayerId) {
              sendToPeer(payload.challengerPeerId, {
                type: MultiplayerActionType.BATTLE_DECLINE,
                payload: {
                  battleId: payload.battleId,
                  reason: 'Jugador ocupado en otra batalla',
                } as any,
                playerId: localPlayerId,
                timestamp: Date.now(),
              });
            }
            return;
          }

          setPendingChallenge(payload);
          console.log('[P2PBattle] Received challenge from:', payload.challengerName);
          break;
        }

        case MultiplayerActionType.BATTLE_ACCEPT: {
          const payload = action.payload as unknown as BattleAcceptPayload;
          if (!payload?.battleId) return;
          if (battleRef.current.battleId !== payload.battleId) return;

          clearTimeouts();

          setBattle(prev => ({
            ...prev,
            status: 'PREPARING',
            opponentName: payload.accepterName,
            opponentScore: payload.accepterScore,
          }));

          // Start army lock timeout
          armyLockTimeoutRef.current = setTimeout(() => {
            if (battleRef.current.status === 'PREPARING' || battleRef.current.status === 'WAITING_LOCK') {
              cancelBattle('Tiempo de preparación agotado');
            }
          }, ARMY_LOCK_TIMEOUT_MS);

          console.log('[P2PBattle] Challenge accepted by:', payload.accepterName);
          break;
        }

        case MultiplayerActionType.BATTLE_DECLINE: {
          const payload = action.payload as unknown as BattleDeclinePayload;
          if (!payload?.battleId) return;
          if (battleRef.current.battleId !== payload.battleId) return;

          resetBattle();
          console.log('[P2PBattle] Challenge declined:', payload.reason);
          break;
        }

        case MultiplayerActionType.BATTLE_ARMY_LOCK: {
          const payload = action.payload as unknown as BattleArmyLockPayload;
          if (!payload?.battleId) return;
          if (battleRef.current.battleId !== payload.battleId) return;

          const myLocked = battleRef.current.myArmyLocked;
          const newStatus: P2PBattleStatus = myLocked ? 'RESOLVING' : 'PREPARING';

          setBattle(prev => ({
            ...prev,
            opponentArmy: payload.army,
            opponentArmyLocked: true,
            status: newStatus,
          }));

          // If both locked, resolve combat (only challenger resolves to avoid double)
          if (myLocked && battleRef.current.isChallenger) {
            setTimeout(() => {
              const currentBattle = battleRef.current;
              if (currentBattle.myArmy && payload.army) {
                resolveCombat(
                  currentBattle.battleId,
                  currentBattle.myArmy,
                  payload.army,
                  currentBattle.isChallenger,
                  currentBattle.opponentName,
                  currentBattle.opponentScore,
                  currentBattle.opponentPeerId
                );
              }
            }, 500);
          }

          console.log('[P2PBattle] Opponent army locked, status:', newStatus);
          break;
        }

        case MultiplayerActionType.BATTLE_RESULT_SYNC: {
          const payload = action.payload as unknown as BattleResultSyncPayload;
          if (!payload?.battleId) return;
          if (battleRef.current.battleId !== payload.battleId) return;

          // Determine winner from our perspective
          let localWinner: 'PLAYER' | 'ENEMY' | 'DRAW';
          if (payload.winner === 'DRAW') {
            localWinner = 'DRAW';
          } else if (battleRef.current.isChallenger) {
            localWinner = payload.winner;
          } else {
            localWinner = payload.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER';
          }

          setBattle(prev => ({
            ...prev,
            status: 'RESULT',
            result: payload,
            opponentArmy: prev.opponentArmy || (prev.isChallenger ? payload.defenderArmy : payload.attackerArmy),
            resolvedAt: Date.now(),
          }));

          // Save to history
          const currentBattle = battleRef.current;
          const myCasualties = currentBattle.isChallenger ? payload.attackerCasualties : payload.defenderCasualties;
          const oppCasualties = currentBattle.isChallenger ? payload.defenderCasualties : payload.attackerCasualties;

          saveBattleToHistory({
            battleId: payload.battleId,
            opponentName: currentBattle.opponentName,
            opponentScore: currentBattle.opponentScore,
            winner: localWinner,
            myArmy: currentBattle.myArmy || {},
            opponentArmy: currentBattle.isChallenger ? payload.defenderArmy : payload.attackerArmy,
            myCasualties,
            opponentCasualties: oppCasualties,
            timestamp: Date.now(),
          });

          console.log('[P2PBattle] Result synced, winner:', localWinner);
          break;
        }

        case MultiplayerActionType.BATTLE_CANCEL: {
          const payload = action.payload as unknown as BattleCancelPayload;
          if (!payload?.battleId) return;
          if (battleRef.current.battleId !== payload.battleId) return;

          resetBattle();
          console.log('[P2PBattle] Battle cancelled by opponent:', payload.reason);
          break;
        }
      }
    });
  }, [onRemoteAction, localPlayerId, sendToPeer, clearTimeouts, resetBattle, resolveCombat, saveBattleToHistory, cancelBattle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeouts();
    };
  }, [clearTimeouts]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const myArmyStats = battle.myArmy
    ? calculateCombatStats(toUnitRecord(battle.myArmy))
    : { attack: 0, defense: 0, hp: 0 };

  const opponentArmyStats = battle.opponentArmy
    ? calculateCombatStats(toUnitRecord(battle.opponentArmy))
    : { attack: 0, defense: 0, hp: 0 };

  const canChallenge = isConnected && battle.status === 'IDLE' && remotePlayers.length > 0;
  const canLockArmy = battle.status === 'PREPARING' && battle.myArmy !== null &&
    Object.values(battle.myArmy).some(v => v > 0);

  const wins = history.filter(r => r.winner === 'PLAYER').length;
  const losses = history.filter(r => r.winner === 'ENEMY').length;
  const draws = history.filter(r => r.winner === 'DRAW').length;

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    battle,
    pendingChallenge,
    history,
    myArmyStats,
    opponentArmyStats,

    // Computed
    canChallenge,
    canLockArmy,
    stats: { wins, losses, draws, total: history.length },

    // Actions
    challengePlayer,
    acceptChallenge,
    declineChallenge,
    setMyArmy,
    lockArmy,
    cancelBattle,
    resetBattle,

    // Available opponents (connected remote players)
    opponents: remotePlayers,
  };
};

export type UseP2PBattleReturn = ReturnType<typeof useP2PBattle>;
