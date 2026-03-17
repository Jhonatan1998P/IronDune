
/**
 * useP2PBattle - Main hook for the P2P Battle System
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMultiplayer } from './useMultiplayer';
import { useYjsSync } from './useYjsSync';
import { battleService } from '../src/services/battleService';
import type { UnitType } from '../types/enums';
import type {
  P2PBattleState,
  P2PBattleRecord,
  BattleChallengePayload,
  BattleResultSyncPayload,
  MultiplayerAction,
  PlayerPresence,
} from '../types/multiplayer';
import { MultiplayerActionType } from '../types/multiplayer';

// ============================================================================
// CONSTANTS
// ============================================================================

const CHALLENGE_TIMEOUT_MS = 30_000;
const ARMY_LOCK_TIMEOUT_MS = 120_000;
const BATTLE_HISTORY_DB = 'p2p-battle-history';
const MAX_HISTORY = 50;

// ============================================================================
// HELPERS
// ============================================================================

const generateBattleId = (): string =>
  `battle_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

const generateSeed = (battleId: string): number => {
  let hash = 0;
  for (let i = 0; i < battleId.length; i++) {
    const char = battleId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
};

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

export const useP2PBattle = (playerName: string, empirePoints: number) => {
  const {
    isConnected,
    localPlayerId,
    remotePlayers,
    sendToPeer,
    onRemoteAction,
  } = useMultiplayer();

  const [battle, setBattle] = useState<P2PBattleState>(INITIAL_BATTLE_STATE);
  const [history, setHistory] = useState<P2PBattleRecord[]>([]);
  const [pendingChallenge, setPendingChallenge] = useState<BattleChallengePayload | null>(null);

  const challengeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armyLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const battleRef = useRef<P2PBattleState>(INITIAL_BATTLE_STATE);

  const yjs = useYjsSync({ dbName: BATTLE_HISTORY_DB, enablePersistence: true });

  useEffect(() => {
    battleRef.current = battle;
  }, [battle]);

  useEffect(() => {
    if (yjs.isReady && yjs.doc) {
      try {
        const historyMap = yjs.getMap<string>('history');
        const records: P2PBattleRecord[] = [];
        historyMap.forEach((value: string) => {
          try {
            records.push(JSON.parse(value));
          } catch { /* skip */ }
        });
        records.sort((a, b) => b.timestamp - a.timestamp);
        setHistory(records.slice(0, MAX_HISTORY));
      } catch (e) {}
    }
  }, [yjs.isReady, yjs.doc]);

  const clearTimeouts = useCallback(() => {
    if (challengeTimeoutRef.current) clearTimeout(challengeTimeoutRef.current);
    if (armyLockTimeoutRef.current) clearTimeout(armyLockTimeoutRef.current);
    challengeTimeoutRef.current = null;
    armyLockTimeoutRef.current = null;
  }, []);

  const resetBattle = useCallback(() => {
    clearTimeouts();
    setBattle(INITIAL_BATTLE_STATE);
    setPendingChallenge(null);
  }, [clearTimeouts]);

  const saveBattleToHistory = useCallback((record: P2PBattleRecord) => {
    setHistory(prev => [record, ...prev].slice(0, MAX_HISTORY));
    if (yjs.isReady && yjs.doc) {
      try {
        yjs.transact(() => {
          const historyMap = yjs.getMap<string>('history');
          historyMap.set(record.battleId, JSON.stringify(record));
        });
      } catch (e) {}
    }
  }, [yjs]);

  const resolveCombat = useCallback(async (
    battleId: string,
    myArmy: Record<string, number>,
    opponentArmy: Record<string, number>,
    isChallenger: boolean,
    opponentName: string,
    opponentScore: number,
    opponentPeerId: string
  ) => {
    const attackerArmy = isChallenger ? myArmy : opponentArmy;
    const defenderArmy = isChallenger ? opponentArmy : myArmy;

    try {
        const result = await battleService.simulateCombat(
            toUnitRecord(attackerArmy),
            toUnitRecord(defenderArmy)
        );

        let winner: 'PLAYER' | 'ENEMY' | 'DRAW';
        if (result.winner === 'DRAW') {
            winner = 'DRAW';
        } else if (isChallenger) {
            winner = result.winner;
        } else {
            winner = result.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER';
        }

        const attackerSurvivors: Record<string, number> = {};
        const defenderSurvivors: Record<string, number> = {};
        Object.entries(result.finalPlayerArmy || {}).forEach(([k, v]) => {
            if (v && (v as number) > 0) attackerSurvivors[k] = v as number;
        });
        Object.entries(result.finalEnemyArmy || {}).forEach(([k, v]) => {
            if (v && (v as number) > 0) defenderSurvivors[k] = v as number;
        });

        const attackerCasualties: Record<string, number> = {};
        const defenderCasualties: Record<string, number> = {};
        Object.entries(result.totalPlayerCasualties || {}).forEach(([k, v]) => {
            if (v && (v as number) > 0) attackerCasualties[k] = v as number;
        });
        Object.entries(result.totalEnemyCasualties || {}).forEach(([k, v]) => {
            if (v && (v as number) > 0) defenderCasualties[k] = v as number;
        });

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
            seed: generateSeed(battleId),
        };

        setBattle(prev => ({
            ...prev,
            status: 'RESULT',
            result: resultPayload,
            resolvedAt: Date.now(),
        }));

        saveBattleToHistory({
            battleId,
            opponentName,
            opponentScore,
            winner,
            myArmy,
            opponentArmy,
            myCasualties: isChallenger ? attackerCasualties : defenderCasualties,
            opponentCasualties: isChallenger ? defenderCasualties : attackerCasualties,
            timestamp: Date.now(),
        });

        sendToPeer(opponentPeerId, {
            type: MultiplayerActionType.BATTLE_RESULT_SYNC,
            payload: resultPayload as any,
            playerId: localPlayerId || '',
            timestamp: Date.now(),
        });

        return resultPayload;
    } catch (error) {
        console.error('[P2PBattle] Resolve failed:', error);
        return null;
    }
  }, [localPlayerId, sendToPeer, saveBattleToHistory]);

  const challengePlayer = useCallback((targetPeerId: string) => {
    if (!isConnected || !localPlayerId || battle.status !== 'IDLE') return;

    const battleId = generateBattleId();
    const opponent = remotePlayers.find((p: PlayerPresence) => p.id === targetPeerId);
    
    setBattle({
      ...INITIAL_BATTLE_STATE,
      battleId,
      status: 'CHALLENGING',
      opponentPeerId: targetPeerId,
      opponentName: opponent?.name || 'Unknown',
      opponentScore: opponent?.level || 0,
      isChallenger: true,
      startedAt: Date.now(),
    });

    sendToPeer(targetPeerId, {
      type: MultiplayerActionType.BATTLE_CHALLENGE,
      payload: {
        battleId,
        challengerName: playerName,
        challengerScore: empirePoints,
        challengerPeerId: localPlayerId,
      } as any,
      playerId: localPlayerId,
      timestamp: Date.now(),
    });

    challengeTimeoutRef.current = setTimeout(() => {
      if (battleRef.current.status === 'CHALLENGING') resetBattle();
    }, CHALLENGE_TIMEOUT_MS);
  }, [isConnected, localPlayerId, playerName, empirePoints, battle.status, remotePlayers, sendToPeer, resetBattle]);

  const acceptChallenge = useCallback(() => {
    if (!pendingChallenge || !localPlayerId) return;

    const { battleId, challengerPeerId, challengerName, challengerScore } = pendingChallenge;

    setBattle({
      ...INITIAL_BATTLE_STATE,
      battleId,
      status: 'PREPARING',
      opponentPeerId: challengerPeerId,
      opponentName: challengerName,
      opponentScore: challengerScore,
      isChallenger: false,
      startedAt: Date.now(),
    });

    sendToPeer(challengerPeerId, {
      type: MultiplayerActionType.BATTLE_ACCEPT,
      payload: {
        battleId,
        accepterName: playerName,
        accepterScore: empirePoints,
        accepterPeerId: localPlayerId,
      } as any,
      playerId: localPlayerId,
      timestamp: Date.now(),
    });

    setPendingChallenge(null);
    armyLockTimeoutRef.current = setTimeout(() => {
      if (battleRef.current.status === 'PREPARING' || battleRef.current.status === 'WAITING_LOCK') {
        resetBattle();
      }
    }, ARMY_LOCK_TIMEOUT_MS);
  }, [pendingChallenge, localPlayerId, playerName, empirePoints, sendToPeer, resetBattle]);

  const declineChallenge = useCallback(() => {
    if (!pendingChallenge || !localPlayerId) return;
    sendToPeer(pendingChallenge.challengerPeerId, {
      type: MultiplayerActionType.BATTLE_DECLINE,
      payload: { battleId: pendingChallenge.battleId, reason: 'Declined' } as any,
      playerId: localPlayerId,
      timestamp: Date.now(),
    });
    setPendingChallenge(null);
  }, [pendingChallenge, localPlayerId, sendToPeer]);

  const setMyArmy = useCallback((army: Record<string, number>) => {
    if (battle.status === 'PREPARING') setBattle(prev => ({ ...prev, myArmy: army }));
  }, [battle.status]);

  const lockArmy = useCallback(() => {
    if (battle.status !== 'PREPARING' || !battle.myArmy || !localPlayerId) return;

    sendToPeer(battle.opponentPeerId, {
      type: MultiplayerActionType.BATTLE_ARMY_LOCK,
      payload: { battleId: battle.battleId, army: battle.myArmy, totalPower: 0 } as any,
      playerId: localPlayerId,
      timestamp: Date.now(),
    });

    const isBothLocked = battle.opponentArmyLocked;
    setBattle(prev => ({ ...prev, myArmyLocked: true, status: isBothLocked ? 'RESOLVING' : 'WAITING_LOCK' }));

    if (isBothLocked && battle.opponentArmy) {
      resolveCombat(
        battle.battleId,
        battle.myArmy,
        battle.opponentArmy,
        battle.isChallenger,
        battle.opponentName,
        battle.opponentScore,
        battle.opponentPeerId
      );
    }
  }, [battle, localPlayerId, sendToPeer, resolveCombat]);

  const cancelBattle = useCallback(() => {
    if (!localPlayerId || battle.status === 'IDLE' || battle.status === 'RESULT') return;
    if (battle.opponentPeerId) {
      sendToPeer(battle.opponentPeerId, {
        type: MultiplayerActionType.BATTLE_CANCEL,
        payload: { battleId: battle.battleId, reason: 'Cancelled' } as any,
        playerId: localPlayerId,
        timestamp: Date.now(),
      });
    }
    resetBattle();
  }, [battle, localPlayerId, sendToPeer, resetBattle]);

  useEffect(() => {
    return onRemoteAction((action: MultiplayerAction) => {
      switch (action.type) {
        case MultiplayerActionType.BATTLE_CHALLENGE:
          if (battleRef.current.status === 'IDLE') setPendingChallenge(action.payload as any);
          break;
        case MultiplayerActionType.BATTLE_ACCEPT:
          if (battleRef.current.battleId === (action.payload as any).battleId) {
            clearTimeouts();
            setBattle(prev => ({ ...prev, status: 'PREPARING' }));
          }
          break;
        case MultiplayerActionType.BATTLE_DECLINE:
        case MultiplayerActionType.BATTLE_CANCEL:
          if (battleRef.current.battleId === (action.payload as any).battleId) resetBattle();
          break;
        case MultiplayerActionType.BATTLE_ARMY_LOCK:
          if (battleRef.current.battleId === (action.payload as any).battleId) {
            const payload = action.payload as any;
            const myLocked = battleRef.current.myArmyLocked;
            setBattle(prev => ({ ...prev, opponentArmy: payload.army, opponentArmyLocked: true, status: myLocked ? 'RESOLVING' : prev.status }));
            if (myLocked && battleRef.current.isChallenger) {
                resolveCombat(battleRef.current.battleId, battleRef.current.myArmy!, payload.army, true, battleRef.current.opponentName, battleRef.current.opponentScore, battleRef.current.opponentPeerId);
            }
          }
          break;
        case MultiplayerActionType.BATTLE_RESULT_SYNC:
          if (battleRef.current.battleId === (action.payload as any).battleId) {
            const payload = action.payload as any;
            setBattle(prev => ({ ...prev, status: 'RESULT', result: payload, resolvedAt: Date.now() }));
            saveBattleToHistory({
                battleId: payload.battleId,
                opponentName: battleRef.current.opponentName,
                opponentScore: battleRef.current.opponentScore,
                winner: battleRef.current.isChallenger ? payload.winner : (payload.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER'),
                myArmy: battleRef.current.myArmy || {},
                opponentArmy: battleRef.current.isChallenger ? payload.defenderArmy : payload.attackerArmy,
                myCasualties: battleRef.current.isChallenger ? payload.attackerCasualties : payload.defenderCasualties,
                opponentCasualties: battleRef.current.isChallenger ? payload.defenderCasualties : payload.attackerCasualties,
                timestamp: Date.now()
            });
          }
          break;
      }
    });
  }, [onRemoteAction, resetBattle, clearTimeouts, resolveCombat, saveBattleToHistory]);

  return {
    battle,
    pendingChallenge,
    history,
    canChallenge: isConnected && battle.status === 'IDLE',
    canLockArmy: battle.status === 'PREPARING' && !!battle.myArmy,
    challengePlayer,
    acceptChallenge,
    declineChallenge,
    setMyArmy,
    lockArmy,
    cancelBattle,
    resetBattle,
    opponents: remotePlayers,
  };
};
