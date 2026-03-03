/**
 * Hook para sincronización automática del jugador con el sistema multijugador
 * 
 * Este hook escucha los cambios en el nombre y nivel del jugador
 * y los sincroniza automáticamente con los peers remotos.
 */

import { useEffect, useRef } from 'react';
import { useMultiplayer } from './useMultiplayer';

interface UseMultiplayerSyncProps {
  playerName: string;
  empirePoints: number;
  enabled?: boolean;
}

/**
 * Hook para sincronizar automáticamente el estado del jugador
 * 
 * @param playerName - Nombre del jugador
 * @param empirePoints - Nivel del jugador (empire points)
 * @param enabled - Si está habilitada la sincronización (default: true)
 */
export const useMultiplayerSync = ({
  playerName,
  empirePoints,
  enabled = true,
}: UseMultiplayerSyncProps) => {
  const { isConnected, syncPlayerWithData } = useMultiplayer();
  const lastSyncRef = useRef<{ name: string; level: number; timestamp: number } | null>(null);
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    // Detectar reconexión - cuando isConnected cambia de false a true
    if (isConnected && !wasConnectedRef.current) {
      console.log('[MultiplayerSync] Connection established (first time or reconnect)');
      wasConnectedRef.current = true;
      // Resetear para forzar sync inmediato
      lastSyncRef.current = null;
    }
    
    if (!isConnected) {
      wasConnectedRef.current = false;
      return;
    }
    
    if (!enabled) return;

    // Evitar sync duplicado si los datos no han cambiado (con 5s de gracia)
    const last = lastSyncRef.current;
    const now = Date.now();
    if (last && 
        last.name === playerName && 
        last.level === empirePoints &&
        (now - last.timestamp) < 5000) {
      return;
    }

    // Sincronizar cuando los datos cambian o después de reconexión
    console.log('[MultiplayerSync] Syncing player:', playerName, empirePoints);
    syncPlayerWithData(playerName, empirePoints);
    lastSyncRef.current = { name: playerName, level: empirePoints, timestamp: now };
  }, [enabled, isConnected, playerName, empirePoints, syncPlayerWithData]);
};
