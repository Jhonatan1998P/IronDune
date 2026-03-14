
import { useEffect, useRef } from 'react';
import { GameStatus } from '../types';
import { socket } from '../lib/socket'; // Asumiendo que existe una instancia de socket

/**
 * useGameLoop — ALTA FRECUENCIA (1s Sync)
 * El cliente solicita el estado autoritativo al servidor cada segundo
 * para garantizar fluidez total.
 */
export const useGameLoop = (
  status: GameStatus,
  performAutoSave: (force?: boolean) => Promise<void>,
) => {
  const isLoopRunningRef = useRef<boolean>(false);
  const statusRef = useRef<GameStatus>(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (status !== 'PLAYING') return;

    console.log('[GameLoop] High Frequency Authority Sync Active (1s)');
    isLoopRunningRef.current = true;
    
    // 1. Heartbeat de sincronización rápida (Cada 1 segundo)
    // El servidor responde con engine_sync_update
    const heartbeatInterval = setInterval(() => {
        if (statusRef.current === 'PLAYING' && socket.connected) {
            socket.emit('request_engine_sync');
        }
    }, 1000);

    // 2. Persistencia en DB y Sync de estado pesado (Cada 2 minutos)
    const dbSyncInterval = setInterval(() => {
        if (statusRef.current === 'PLAYING') {
            performAutoSave(true); 
        }
    }, 2 * 60 * 1000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(dbSyncInterval);
      isLoopRunningRef.current = false;
    };
  }, [status, performAutoSave]);

  return { isLoopRunningRef };
};
