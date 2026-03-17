import React, { useEffect } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { useGameStore } from './gameStore';

export const GameBootstrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const gameEngine = useGameEngine();
  const setSnapshot = useGameStore((state) => state.setSnapshot);

  useEffect(() => {
    setSnapshot(gameEngine);
  }, [gameEngine, setSnapshot]);

  return <>{children}</>;
};
