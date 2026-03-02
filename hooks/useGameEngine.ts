
import { useState, useCallback, useEffect } from 'react';
import { GameState, GameStatus, LogEntry, GameEventType, OfflineReport } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { calculateCombatStats, simulateCombat } from '../utils/engine/combat';
import { useEventSubscription } from './useEventSubscription';
import { addGameLog } from '../utils';
import { createDebugAllyAttackTest } from '../utils/debug';

// Modular Hooks
import { useGameLoop } from './useGameLoop';
import { usePersistence } from './usePersistence';
import { useGameActions } from './useGameActions';

// Re-export for UI components that use them
export { calculateCombatStats, simulateCombat };

declare global {
    interface Window {
        _updateGameState?: (newState: GameState) => void;
    }
}

export const useGameEngine = () => {
  const [status, setStatus] = useState<GameStatus>('MENU');
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [offlineReport, setOfflineReport] = useState<OfflineReport | null>(null);
  const [hasNewReports, setHasNewReports] = useState(false);

  // --- 1. CORE LOOP ---
  const { lastTickRef } = useGameLoop(status, setGameState, setHasNewReports);

  // --- 2. LOGGING (Shared Dependency) ---
  const addLog = useCallback((messageKey: string, type: LogEntry['type'] = 'info', params?: any) => {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random().toString().slice(2, 5),
      messageKey,
      params,
      timestamp: Date.now(),
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

  // --- 4. PERSISTENCE ---
  const persistence = usePersistence(
      gameState, 
      setGameState,
      status,
      setStatus, 
      setOfflineReport, 
      setHasNewReports, 
      lastTickRef
  );

  // --- 5. EVENT BUS ---
  useEventSubscription(GameEventType.ADD_LOG, (payload) => {
      addLog(payload.messageKey, payload.type, payload.params);
  });

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

  // Auto-Save Effect (Orchestrated here)
  useEffect(() => {
    // Don't run auto-save if not actively playing
    if (status !== 'PLAYING') return;
    
    persistence.performAutoSave();
  }, [status, persistence.performAutoSave]);

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
    build: actions.build, 
    recruit: actions.recruit, 
    research: actions.research, 
    handleBankTransaction: actions.handleBankTransaction, 
    startMission: actions.startMission, 
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
