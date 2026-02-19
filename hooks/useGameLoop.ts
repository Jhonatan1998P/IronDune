
import React, { useEffect, useRef } from 'react';
import { GameState, GameStatus } from '../types';
import { calculateNextTick } from '../utils/engine/loop';
import { TICK_RATE_MS } from '../constants';

export const useGameLoop = (
  status: GameStatus,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  setHasNewReports: (has: boolean) => void
) => {
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    if (status !== 'PLAYING') return;

    lastTickRef.current = Date.now();

    const timer = setInterval(() => {
      const now = Date.now();
      const deltaTimeMs = now - lastTickRef.current;
      
      lastTickRef.current = now;

      if (deltaTimeMs < 10) return;

      setGameState((prev) => {
        const { newState, newLogs } = calculateNextTick(prev, deltaTimeMs);
        
        if (newLogs.length > 0) {
            newState.logs = [...newLogs, ...newState.logs].slice(0, 100);
            setHasNewReports(true);
        }
        return newState;
      });
    }, TICK_RATE_MS);
    
    return () => clearInterval(timer);
  }, [status, setGameState, setHasNewReports]);

  return { lastTickRef };
};