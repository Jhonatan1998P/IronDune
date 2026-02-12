
import React, { createContext, useContext } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';

// Infer the type from the hook directly to ensure 100% type safety with the engine
type GameContextType = ReturnType<typeof useGameEngine>;

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const gameEngine = useGameEngine();

  return (
    <GameContext.Provider value={gameEngine}>
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
