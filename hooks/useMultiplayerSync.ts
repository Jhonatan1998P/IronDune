/**
 * Hook para sincronización automática del jugador con el sistema multijugador
 * 
 * Este hook escucha los cambios en el nombre y nivel del jugador
 * y los sincroniza automáticamente con los peers remotos.
 */

import { useEffect } from 'react';
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

  useEffect(() => {
    if (!enabled || !isConnected) return;

    // Sincronizar inmediatamente cuando hay cambios
    syncPlayerWithData(playerName, empirePoints);
  }, [enabled, isConnected, playerName, empirePoints, syncPlayerWithData]);
};
