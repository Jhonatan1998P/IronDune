
import { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, GameStatus, LogEntry, GameEventType, OfflineReport } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { useEventSubscription } from './useEventSubscription';
import { addGameLog } from '../utils';
import { createDebugAllyAttackTest } from '../utils/debug';
import { TimeSyncService } from '../lib/timeSync';

// Modular Hooks
import { useGameLoop } from './useGameLoop';
import { usePersistence } from './usePersistence';
import { useGameActions } from './useGameActions';
import { battleService } from '../src/services/battleService';
import { useResourceRealtime } from './useResourceRealtime';
import { useResourceInterpolation } from './useResourceInterpolation';

declare global {
    interface Window {
        _updateGameState?: (newState: GameState) => void;
        USE_SERVER_BATTLES?: boolean;
    }
}

// Enable Server Battles
if (typeof window !== 'undefined') {
    window.USE_SERVER_BATTLES = true;
}

export const useGameEngine = () => {
  const [status, setStatus] = useState<GameStatus>('LOADING');
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [offlineReport, setOfflineReport] = useState<OfflineReport | null>(null);
  const [hasNewReports, setHasNewReports] = useState(false);

  useResourceRealtime();
  useResourceInterpolation();

  // --- 1. SHARED REFS ---
  const lastTickRef = useRef<number>(TimeSyncService.getServerTime());
  const isLoopRunningRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number>();

  // --- 2. PERSISTENCE ---
  const persistence = usePersistence(
    gameState,
    setGameState,
    status,
    setStatus,
    setOfflineReport,
    setHasNewReports,
    lastTickRef
  );

  // --- 3. CORE LOOP ---
  useGameLoop(
    status,
    setGameState,
    setHasNewReports,
    persistence.performAutoSave,
    lastTickRef,
    isLoopRunningRef,
    animationFrameRef
  );

  // --- 4. LOGGING ---
  const addLog = useCallback((messageKey: string, type: LogEntry['type'] = 'info', params?: any) => {
    const newLog: LogEntry = {
      id: TimeSyncService.getServerTime().toString() + Math.random().toString().slice(2, 5),
      messageKey,
      params,
      timestamp: TimeSyncService.getServerTime(),
      type,
      archived: false
    };

    setGameState(prev => {
        // Usar función con persistencia y límites
        const updatedLogs = addGameLog(prev.logs || [], newLog);
        return {
            ...prev,
            logs: updatedLogs
        };
    });
    
    if (type === 'combat' || type === 'mission' || type === 'intel' || type === 'war') {
        setHasNewReports(true);
    }
  }, []);

  // --- 3. ACTIONS ---
  const actions = useGameActions(gameState, setGameState, addLog);

  // --- 4. PERSISTENCE (Moved Up) ---

  // --- 5. EVENT BUS ---
  useEventSubscription(GameEventType.ADD_LOG, (payload) => {
      addLog(payload.messageKey, payload.type, payload.params);
  });

  useEventSubscription(GameEventType.TRIGGER_SAVE, (payload) => {
      persistence.performAutoSave(payload.force);
  });

  // --- 5b. REMOTE BATTLE ENGINE SYNC ---
  useEffect(() => {
    if (status !== 'PLAYING') return;

    let isSyncing = false;

    const checkAndSync = async () => {
        if (isSyncing) return;
        
        try {
            const now = TimeSyncService.getServerTime();
            
            // Check if any mission or attack is ending soon
            const hasEvents = gameState.activeMissions.some(m => m.endTime <= now) || 
                              gameState.incomingAttacks.some(a => a.endTime <= now) ||
                              (gameState.activeWar && gameState.activeWar.nextWaveTime <= now);

            if (hasEvents) {
                isSyncing = true;
                console.log('[BattleSync] Processing events on server...');
                const result = await battleService.processQueue(gameState, now);
                
                setGameState(prev => {
                    const newState = { ...result.newState };
                    if (result.newLogs.length > 0) {
                        newState.logs = [...result.newLogs, ...prev.logs].slice(0, 100);
                        setHasNewReports(true);
                    }
                    return newState;
                });
                isSyncing = false;
            }
        } catch (error) {
            console.error('[BattleSync] Sync failed:', error);
            isSyncing = false;
        }
    };

    // Run check every second for immediate response
    const syncInterval = setInterval(checkAndSync, 1000);

    // Periodic checks for Bot Attacks and Grudges (every 60s)
    const periodicCheck = setInterval(async () => {
        try {
            const now = TimeSyncService.getServerTime();
            
            const enemyAttackResult = await battleService.processEnemyAttackCheck(gameState, now);
            if (enemyAttackResult.logs.length > 0 || Object.keys(enemyAttackResult.stateUpdates).length > 0) {
                setGameState(prev => ({
                    ...prev,
                    ...enemyAttackResult.stateUpdates,
                    logs: [...enemyAttackResult.logs, ...prev.logs].slice(0, 100)
                }));
                if (enemyAttackResult.logs.length > 0) setHasNewReports(true);
            }

            const nemesisResult = await battleService.processNemesisTick(gameState, now);
            if (nemesisResult.logs.length > 0 || Object.keys(nemesisResult.stateUpdates).length > 0) {
                setGameState(prev => ({
                    ...prev,
                    ...nemesisResult.stateUpdates,
                    logs: [...nemesisResult.logs, ...prev.logs].slice(0, 100)
                }));
                if (nemesisResult.logs.length > 0) setHasNewReports(true);
            }
        } catch (e) {
            console.error('[BattlePeriodic] Failed:', e);
        }
    }, 60000);

    return () => {
        clearInterval(syncInterval);
        clearInterval(periodicCheck);
    };
  }, [status, gameState, setHasNewReports]);

  // Hacky exposure for RankingsView
  useEffect(() => {
      window._updateGameState = (newState: GameState) => {
          setGameState(newState);
      };
      return () => { delete window._updateGameState; }
  }, []);

  // Debug: Expose ally attack test function to browser console
  const debugTestAllyAttack = createDebugAllyAttackTest(setGameState);
  useEffect(() => {
      window.debugTestAllyAttack = debugTestAllyAttack;
      return () => { delete window.debugTestAllyAttack; }
  }, [debugTestAllyAttack]);

  // --- 6. LOG MANAGEMENT UTILS ---
  const deleteLogs = useCallback((ids: string[]) => {
      setGameState(prev => ({
          ...prev,
          logs: prev.logs.filter(log => !ids.includes(log.id))
      }));
  }, []);

  const archiveLogs = useCallback((ids: string[], archive: boolean = true) => {
      setGameState(prev => ({
          ...prev,
          logs: prev.logs.map(log => 
            ids.includes(log.id) ? { ...log, archived: archive } : log
          )
      }));
  }, []);

  const markReportsRead = useCallback(() => {
      setHasNewReports(false);
  }, []);

  const clearOfflineReport = useCallback(() => setOfflineReport(null), []);

  return {
    status, 
    bootstrapLoadStatus: persistence.bootstrapLoadStatus,
    gameState, 
    logs: gameState.logs, 
    hasSave: persistence.hasSave, 
    offlineReport, 
    hasNewReports,
    clearOfflineReport, 
    
    // Persistence
    startNewGame: persistence.startNewGame, 
    loadGame: persistence.loadGame, 
    saveGame: persistence.saveGame, 
    importSave: persistence.importSave, 
    exportSave: persistence.exportSave,
    resetGame: persistence.resetGame,

    // Actions
    addP2PIncomingAttack: actions.addP2PIncomingAttack,
    addP2PMission: actions.addP2PMission,
    applyP2PBattleResult: actions.applyP2PBattleResult,
    receiveP2PResource: actions.receiveP2PResource,
    deductLocalResource: actions.deductLocalResource,
    build: actions.build, 
    recruit: actions.recruit, 
    research: actions.research, 
    handleBankTransaction: actions.handleBankTransaction, 
    startMission: actions.startMission,
    startSalvageMission: actions.startSalvageMission,
    speedUp: actions.speedUp,
    executeCampaignBattle: actions.executeCampaignBattle, 
    executeTrade: actions.executeTrade,
    executeDiamondExchange: actions.executeDiamondExchange, // <--- RE-ADDED THIS MISSING EXPORT
    acceptTutorialStep: actions.acceptTutorialStep, 
    claimTutorialReward: actions.claimTutorialReward,
    toggleTutorialMinimize: actions.toggleTutorialMinimize, 
    spyOnAttacker: actions.spyOnAttacker,
    changePlayerName: actions.changePlayerName,
    repair: actions.repair,
    sendDiplomaticGift: actions.sendDiplomaticGift,
    proposeDiplomaticAlliance: actions.proposeDiplomaticAlliance,
    proposeDiplomaticPeace: actions.proposeDiplomaticPeace,
    redeemGiftCode: actions.redeemGiftCode,

    // Logs
    deleteLogs, 
    archiveLogs, 
    markReportsRead
  };
};
