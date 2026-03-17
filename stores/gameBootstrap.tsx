import React, { useEffect } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { useGameStore } from './gameStore';
import { useResourceStore } from './resourceStore';

export const GameBootstrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const gameEngine = useGameEngine();
  const setSnapshot = useGameStore((state) => state.setSnapshot);

  useEffect(() => {
    setSnapshot(gameEngine);
  }, [gameEngine, setSnapshot]);

  useEffect(() => {
    const unsubscribe = useResourceStore.subscribe((resourceState) => {
      setSnapshot((prev) => ({
        ...prev,
        gameState: {
          ...prev.gameState,
          resources: resourceState.resources,
          maxResources: resourceState.maxResources,
          bankBalance: resourceState.bankBalance,
          currentInterestRate: resourceState.interestRate,
        },
      }));
    });

    return unsubscribe;
  }, [setSnapshot]);

  return <>{children}</>;
};
