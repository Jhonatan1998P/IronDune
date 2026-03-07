
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
  const hasNewReportsRef = useRef<boolean>(false);

  useEffect(() => {
    if (status !== 'PLAYING') return;

    lastTickRef.current = Date.now();

    const timer = setInterval(() => {
      const now = Date.now();
      const deltaTimeMs = now - lastTickRef.current;
      
      lastTickRef.current = now;

      if (deltaTimeMs < 10) return;

      // Detectar si el primer tick tiene un delta anormalmente grande (bug de doble producción)
      if (deltaTimeMs > 5000) {
        console.warn(`[GameLoop] Large deltaTime detected: ${(deltaTimeMs / 1000).toFixed(1)}s — possible overlap with offline calculation`);
      }

      setGameState((prev) => {
        const { newState, newLogs } = calculateNextTick(prev, deltaTimeMs);
        
        if (newLogs.length > 0) {
            newState.logs = [...newLogs, ...newState.logs].slice(0, 100);
            hasNewReportsRef.current = true;
        }

        if (newState === prev && newLogs.length === 0) {
          return prev;
        }
        
        return newState;
      });
    }, TICK_RATE_MS);
    
    return () => clearInterval(timer);
  }, [status, setGameState]);

  useEffect(() => {
    if (status !== 'PLAYING') return;
    
    const reportTimer = setInterval(() => {
      if (hasNewReportsRef.current) {
        setHasNewReports(true);
        hasNewReportsRef.current = false;
      }
    }, 100);
    
    return () => clearInterval(reportTimer);
  }, [status, setHasNewReports]);

  return { lastTickRef };
};