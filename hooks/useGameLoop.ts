
import React, { useEffect, useRef, useCallback } from 'react';
import { GameState, GameStatus } from '../types';
import { calculateNextTick } from '../utils/engine/loop';
import { TICK_RATE_MS } from '../constants';

// Optimización: FPS dinámicos según dispositivo
const getTargetFPS = () => {
  if (typeof window === 'undefined') return 30;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return isMobile ? 20 : 30; // Reducir FPS en móviles para mejor rendimiento
};

// Optimización: Throttle para evitar actualizaciones demasiado frecuentes
const useThrottle = <T>(value: T, delay: number): T => {
  const throttledValue = useRef<T>(value);
  const lastUpdate = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdate.current >= delay) {
      throttledValue.current = value;
      lastUpdate.current = now;
    }
  }, [value, delay]);

  return throttledValue.current;
};

export const useGameLoop = (
  status: GameStatus,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  setHasNewReports: (has: boolean) => void
) => {
  const lastTickRef = useRef<number>(Date.now());
  const hasNewReportsRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number>();
  const targetFPS = useRef<number>(getTargetFPS());
  const frameInterval = useRef<number>(1000 / targetFPS.current);
  const lastFrameTime = useRef<number>(0);
  const isLoopRunningRef = useRef<boolean>(false);
  const statusRef = useRef<GameStatus>(status);
  const setGameStateRef = useRef(setGameState);
  setGameStateRef.current = setGameState;

  // Keep status ref updated
  useEffect(() => {
    statusRef.current = status;
    if (status === 'PLAYING') {
      console.log('[GameLoop] Status changed to PLAYING - initializing loop');
    }
  }, [status]);

  // Optimización: Game loop con requestAnimationFrame y throttling
  useEffect(() => {
    if (status !== 'PLAYING') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      isLoopRunningRef.current = false;
      console.log('[GameLoop] Status not PLAYING, loop disabled');
      return;
    }

    console.log('[GameLoop] Starting game loop - status:', status);
    lastTickRef.current = Date.now();
    lastFrameTime.current = performance.now();
    isLoopRunningRef.current = true;
    
    let overlap = 0;
    let tickCount = 0;

    const gameLoop = (currentTime: number) => {
      if (statusRef.current !== 'PLAYING') {
        isLoopRunningRef.current = false;
        return;
      }

      const deltaTime = currentTime - lastFrameTime.current;

      if (deltaTime >= frameInterval.current) {
        lastFrameTime.current = currentTime - (deltaTime % frameInterval.current);

        const now = Date.now();
        const deltaTimeMs = now - lastTickRef.current + overlap;
        lastTickRef.current = now;

        if (deltaTimeMs >= TICK_RATE_MS) {
          tickCount++;
          if (tickCount % 10 === 0) {
            console.log('[GameLoop] Tick update - deltaTimeMs:', deltaTimeMs, 'tickCount:', tickCount);
          }
          
          setGameStateRef.current((prev) => {
            const { newState, newLogs } = calculateNextTick(prev, deltaTimeMs);

            if (newLogs.length > 0) {
              newState.logs = [...newLogs, ...newState.logs].slice(0, 100);
              hasNewReportsRef.current = true;
            }

            if (newState === prev && newLogs.length === 0) {
              overlap = deltaTimeMs;
              return prev;
            }

            overlap = 0;
            return newState;
          });
        } else {
          overlap = deltaTimeMs;
        }
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      isLoopRunningRef.current = false;
      console.log('[GameLoop] Cleanup - total ticks before cleanup:', tickCount);
    };
  }, [status, setGameState, setHasNewReports]);

  // Optimización: Report throttled a 200ms
  useEffect(() => {
    if (status !== 'PLAYING') return;

    const reportTimer = setInterval(() => {
      if (hasNewReportsRef.current) {
        setHasNewReports(true);
        hasNewReportsRef.current = false;
      }
    }, 200);

    return () => clearInterval(reportTimer);
  }, [status, setHasNewReports]);

  return { lastTickRef, isLoopRunningRef, animationFrameRef };
};