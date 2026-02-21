
import React, { createContext, useContext, useMemo } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';

// Infer the type from the hook directly to ensure 100% type safety with the engine
type GameContextType = ReturnType<typeof useGameEngine>;

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const gameEngine = useGameEngine();

  // Memoize the context value to prevent unnecessary re-renders of all consumers
  // only when the identity of the gameEngine object changes (which it will when state updates)
  // but we ensure the structure is stable.
  const value = useMemo(() => gameEngine, [
    gameEngine.status,
    gameEngine.gameState,
    gameEngine.offlineReport,
    gameEngine.hasNewReports,
    gameEngine.hasSave
  ]);

  return (
    <GameContext.Provider value={value}>
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
