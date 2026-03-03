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
  const lastSyncRef = useRef<{ name: string; level: number } | null>(null);

  useEffect(() => {
    if (!enabled || !isConnected) return;

    // Evitar sync duplicado si los datos no han cambiado
    const last = lastSyncRef.current;
    if (last && last.name === playerName && last.level === empirePoints) {
      return;
    }

    // Sincronizar cuando los datos cambian
    console.log('[MultiplayerSync] Syncing player:', playerName, empirePoints);
    syncPlayerWithData(playerName, empirePoints);
    lastSyncRef.current = { name: playerName, level: empirePoints };
  }, [enabled, isConnected, playerName, empirePoints, syncPlayerWithData]);
};
