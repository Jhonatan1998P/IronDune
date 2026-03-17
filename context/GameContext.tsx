import React, { useEffect } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { useGameStore, useGameStoreSelector } from '../stores/gameStore';

type GameContextType = ReturnType<typeof useGameEngine>;

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const gameEngine = useGameEngine();
  const setSnapshot = useGameStore((state) => state.setSnapshot);

  useEffect(() => {
    setSnapshot(gameEngine);
  }, [gameEngine, setSnapshot]);

  return <>{children}</>;
};

export const useGame = (): GameContextType => {
  return useGameStoreSelector((state) => state);
};

export const useGameSelector = <T,>(selector: (state: ReturnType<typeof useGameEngine>['gameState']) => T): T => {
  return useGameStoreSelector((state) => selector(state.gameState));
};
