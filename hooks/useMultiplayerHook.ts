/**
 * useMultiplayer Hook
 *
 * Hook personalizado para acceder al contexto multijugador.
 * Separado para compatibilidad con Vite Fast Refresh.
 */

import type { UseMultiplayerReturn } from '../types/multiplayer';
import { useMultiplayerStoreSelector } from '../stores/multiplayerStore';

/**
 * Hook principal para usar desde cualquier componente
 */
export const useMultiplayer = (): UseMultiplayerReturn => {
  return {
    isInitialized: useMultiplayerStoreSelector((state) => state.isInitialized),
    isConnected: useMultiplayerStoreSelector((state) => state.isConnected),
    isConnecting: useMultiplayerStoreSelector((state) => state.isConnecting),
    connectionError: useMultiplayerStoreSelector((state) => state.connectionError),
    peers: useMultiplayerStoreSelector((state) => state.peers),
    localPlayerId: useMultiplayerStoreSelector((state) => state.localPlayerId),
    remotePlayers: useMultiplayerStoreSelector((state) => state.remotePlayers),
    syncPlayer: useMultiplayerStoreSelector((state) => state.syncPlayer),
    syncPlayerWithData: useMultiplayerStoreSelector((state) => state.syncPlayerWithData),
    broadcastAction: useMultiplayerStoreSelector((state) => state.broadcastAction),
    sendToPeer: useMultiplayerStoreSelector((state) => state.sendToPeer),
    onRemoteAction: useMultiplayerStoreSelector((state) => state.onRemoteAction),
  };
};
