
import React, { useEffect, useRef } from 'react';
import { GameState, GameStatus } from '../types';
import { calculateNextTick } from '../utils/engine/loop';
import { TICK_RATE_MS } from '../constants';
import { TimeSyncService } from '../lib/timeSync';

// Optimización: FPS dinámicos según dispositivo
const getTargetFPS = () => {
  if (typeof window === 'undefined') return 30;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return isMobile ? 20 : 30; // Reducir FPS en móviles para mejor rendimiento
};

export const useGameLoop = (
  status: GameStatus,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  setHasNewReports: (has: boolean) => void,
  externalLastTickRef?: React.MutableRefObject<number>,
  externalIsLoopRunningRef?: React.MutableRefObject<boolean>,
  externalAnimationFrameRef?: React.MutableRefObject<number | undefined>
) => {
  const localLastTickRef = useRef<number>(TimeSyncService.getServerTime());
  const lastTickRef = externalLastTickRef || localLastTickRef;
  
  const localAnimationFrameRef = useRef<number>();
  const animationFrameRef = externalAnimationFrameRef || localAnimationFrameRef;

  const localIsLoopRunningRef = useRef<boolean>(false);
  const isLoopRunningRef = externalIsLoopRunningRef || localIsLoopRunningRef;

  const hasNewReportsRef = useRef<boolean>(false);
  const targetFPS = useRef<number>(getTargetFPS());
  const frameInterval = useRef<number>(1000 / targetFPS.current);
  const lastFrameTime = useRef<number>(0);
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
    lastTickRef.current = TimeSyncService.getServerTime();
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

        const now = TimeSyncService.getServerTime();
        let deltaTimeMs = now - lastTickRef.current + overlap;
        
        // Anti-cheat: Cap deltaTimeMs to prevent massive jumps
        const MAX_DELTA_MS = 10000; // Cap at 10 seconds per frame
        if (deltaTimeMs > MAX_DELTA_MS) {
          console.warn(`[GameLoop] Delta time too high (\${deltaTimeMs}ms), capping to \${MAX_DELTA_MS}ms`);
          deltaTimeMs = MAX_DELTA_MS;
        }
        
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
