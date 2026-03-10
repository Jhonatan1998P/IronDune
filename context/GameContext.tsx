
import React, { createContext, useContext, useMemo, useRef, useSyncExternalStore } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';

type GameContextType = ReturnType<typeof useGameEngine>;

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const gameEngine = useGameEngine();

  const gameStateRef = useRef(gameEngine.gameState);
  gameStateRef.current = gameEngine.gameState;

  const contextValue = useMemo(() => gameEngine, [
    gameEngine.status,
    gameEngine.gameState,
    gameEngine.offlineReport,
    gameEngine.hasNewReports,
    gameEngine.hasSave,
    gameEngine.logs,
    gameEngine.offlineReport,
    gameEngine.clearOfflineReport,
    gameEngine.startNewGame,
    gameEngine.loadGame,
    gameEngine.saveGame,
    gameEngine.importSave,
    gameEngine.exportSave,
    gameEngine.resetGame,
    gameEngine.addP2PIncomingAttack,
    gameEngine.addP2PMission,
    gameEngine.applyP2PBattleResult,
    gameEngine.receiveP2PResource,
    gameEngine.deductLocalResource,
    gameEngine.build,
    gameEngine.recruit,
    gameEngine.research,
    gameEngine.handleBankTransaction,
    gameEngine.startMission,
    gameEngine.speedUp,
    gameEngine.executeCampaignBattle,
    gameEngine.executeTrade,
    gameEngine.executeDiamondExchange,
    gameEngine.acceptTutorialStep,
    gameEngine.claimTutorialReward,
    gameEngine.toggleTutorialMinimize,
    gameEngine.spyOnAttacker,
    gameEngine.changePlayerName,
    gameEngine.repair,
    gameEngine.sendDiplomaticGift,
    gameEngine.proposeDiplomaticAlliance,
    gameEngine.proposeDiplomaticPeace,
    gameEngine.redeemGiftCode,
    gameEngine.deleteLogs,
    gameEngine.archiveLogs,
    gameEngine.markReportsRead
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

