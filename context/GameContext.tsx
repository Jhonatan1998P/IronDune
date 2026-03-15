
import React, { createContext, useContext, useMemo, useRef, useSyncExternalStore, useCallback } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';

type GameContextType = ReturnType<typeof useGameEngine>;

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const gameEngine = useGameEngine();

  const gameStateRef = useRef(gameEngine.gameState);
  gameStateRef.current = gameEngine.gameState;

  // Optimización: Usar referencias estables para funciones para evitar re-creación
  const stableActionsRef = useRef({
    clearOfflineReport: gameEngine.clearOfflineReport,
    startNewGame: gameEngine.startNewGame,
    loadGame: gameEngine.loadGame,
    saveGame: gameEngine.saveGame,
    importSave: gameEngine.importSave,
    exportSave: gameEngine.exportSave,
    resetGame: gameEngine.resetGame,
    addP2PIncomingAttack: gameEngine.addP2PIncomingAttack,
    addP2PMission: gameEngine.addP2PMission,
    applyP2PBattleResult: gameEngine.applyP2PBattleResult,
    receiveP2PResource: gameEngine.receiveP2PResource,
    deductLocalResource: gameEngine.deductLocalResource,
    build: gameEngine.build,
    recruit: gameEngine.recruit,
    research: gameEngine.research,
    handleBankTransaction: gameEngine.handleBankTransaction,
    startMission: gameEngine.startMission,
    startSalvageMission: gameEngine.startSalvageMission,
    speedUp: gameEngine.speedUp,
    executeCampaignBattle: gameEngine.executeCampaignBattle,
    executeTrade: gameEngine.executeTrade,
    executeDiamondExchange: gameEngine.executeDiamondExchange,
    acceptTutorialStep: gameEngine.acceptTutorialStep,
    claimTutorialReward: gameEngine.claimTutorialReward,
    toggleTutorialMinimize: gameEngine.toggleTutorialMinimize,
    spyOnAttacker: gameEngine.spyOnAttacker,
    changePlayerName: gameEngine.changePlayerName,
    repair: gameEngine.repair,
    sendDiplomaticGift: gameEngine.sendDiplomaticGift,
    proposeDiplomaticAlliance: gameEngine.proposeDiplomaticAlliance,
    proposeDiplomaticPeace: gameEngine.proposeDiplomaticPeace,
    redeemGiftCode: gameEngine.redeemGiftCode,
    deleteLogs: gameEngine.deleteLogs,
    archiveLogs: gameEngine.archiveLogs,
    markReportsRead: gameEngine.markReportsRead,
  });

  // Actualizar referencias solo cuando cambian las funciones
  stableActionsRef.current = {
    clearOfflineReport: gameEngine.clearOfflineReport,
    startNewGame: gameEngine.startNewGame,
    loadGame: gameEngine.loadGame,
    saveGame: gameEngine.saveGame,
    importSave: gameEngine.importSave,
    exportSave: gameEngine.exportSave,
    resetGame: gameEngine.resetGame,
    addP2PIncomingAttack: gameEngine.addP2PIncomingAttack,
    addP2PMission: gameEngine.addP2PMission,
    applyP2PBattleResult: gameEngine.applyP2PBattleResult,
    receiveP2PResource: gameEngine.receiveP2PResource,
    deductLocalResource: gameEngine.deductLocalResource,
    build: gameEngine.build,
    recruit: gameEngine.recruit,
    research: gameEngine.research,
    handleBankTransaction: gameEngine.handleBankTransaction,
    startMission: gameEngine.startMission,
    startSalvageMission: gameEngine.startSalvageMission,
    speedUp: gameEngine.speedUp,
    executeCampaignBattle: gameEngine.executeCampaignBattle,
    executeTrade: gameEngine.executeTrade,
    executeDiamondExchange: gameEngine.executeDiamondExchange,
    acceptTutorialStep: gameEngine.acceptTutorialStep,
    claimTutorialReward: gameEngine.claimTutorialReward,
    toggleTutorialMinimize: gameEngine.toggleTutorialMinimize,
    spyOnAttacker: gameEngine.spyOnAttacker,
    changePlayerName: gameEngine.changePlayerName,
    repair: gameEngine.repair,
    sendDiplomaticGift: gameEngine.sendDiplomaticGift,
    proposeDiplomaticAlliance: gameEngine.proposeDiplomaticAlliance,
    proposeDiplomaticPeace: gameEngine.proposeDiplomaticPeace,
    redeemGiftCode: gameEngine.redeemGiftCode,
    deleteLogs: gameEngine.deleteLogs,
    archiveLogs: gameEngine.archiveLogs,
    markReportsRead: gameEngine.markReportsRead,
  };

  // Optimización: Memoizar solo con dependencias críticas
  const contextValue = useMemo(() => ({
    status: gameEngine.status,
    gameState: gameEngine.gameState,
    logs: gameEngine.logs,
    hasSave: gameEngine.hasSave,
    offlineReport: gameEngine.offlineReport,
    hasNewReports: gameEngine.hasNewReports,
    clearOfflineReport: gameEngine.clearOfflineReport,
    startNewGame: gameEngine.startNewGame,
    loadGame: gameEngine.loadGame,
    saveGame: gameEngine.saveGame,
    importSave: gameEngine.importSave,
    exportSave: gameEngine.exportSave,
    resetGame: gameEngine.resetGame,
    addP2PIncomingAttack: gameEngine.addP2PIncomingAttack,
    addP2PMission: gameEngine.addP2PMission,
    applyP2PBattleResult: gameEngine.applyP2PBattleResult,
    receiveP2PResource: gameEngine.receiveP2PResource,
    deductLocalResource: gameEngine.deductLocalResource,
    build: gameEngine.build,
    recruit: gameEngine.recruit,
    research: gameEngine.research,
    handleBankTransaction: gameEngine.handleBankTransaction,
    startMission: gameEngine.startMission,
    startSalvageMission: gameEngine.startSalvageMission,
    speedUp: gameEngine.speedUp,
    executeCampaignBattle: gameEngine.executeCampaignBattle,
    executeTrade: gameEngine.executeTrade,
    executeDiamondExchange: gameEngine.executeDiamondExchange,
    acceptTutorialStep: gameEngine.acceptTutorialStep,
    claimTutorialReward: gameEngine.claimTutorialReward,
    toggleTutorialMinimize: gameEngine.toggleTutorialMinimize,
    spyOnAttacker: gameEngine.spyOnAttacker,
    changePlayerName: gameEngine.changePlayerName,
    repair: gameEngine.repair,
    sendDiplomaticGift: gameEngine.sendDiplomaticGift,
    proposeDiplomaticAlliance: gameEngine.proposeDiplomaticAlliance,
    proposeDiplomaticPeace: gameEngine.proposeDiplomaticPeace,
    redeemGiftCode: gameEngine.redeemGiftCode,
    deleteLogs: gameEngine.deleteLogs,
    archiveLogs: gameEngine.archiveLogs,
    markReportsRead: gameEngine.markReportsRead,
  }), [
    gameEngine.status,
    gameEngine.gameState,
    gameEngine.logs,
    gameEngine.hasSave,
    gameEngine.offlineReport,
    gameEngine.hasNewReports,
  ]);

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

export const useGameSelector = <T,>(selector: (state: ReturnType<typeof useGameEngine>['gameState']) => T): T => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameSelector must be used within a GameProvider');
  }

  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  return useSyncExternalStore(
    () => () => {},
    () => selectorRef.current(context.gameState),
    () => selectorRef.current(context.gameState)
  );
};
