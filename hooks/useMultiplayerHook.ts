/**
 * useMultiplayer Hook
 *
 * Hook personalizado para acceder al contexto multijugador.
 * Separado para compatibilidad con Vite Fast Refresh.
 */

import { useContext } from 'react';
import { MultiplayerContext } from './useMultiplayerInternal';
import type { UseMultiplayerReturn } from '../types/multiplayer';

/**
 * Hook principal para usar desde cualquier componente
 */
export const useMultiplayer = (): UseMultiplayerReturn => {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error('useMultiplayer must be used within MultiplayerProvider');
  }
  return {
    isInitialized: context.isInitialized,
    isConnected: context.isConnected,
    isConnecting: context.isConnecting,
    connectionError: context.connectionError,
    peers: context.peers,
    localPlayerId: context.localPlayerId,
    remotePlayers: context.remotePlayers,
    currentRoomId: context.currentRoomId,
    createRoom: context.createRoom,
    joinRoomById: context.joinRoomById,
    leave: context.leave,
    reconnect: context.reconnect,
    syncPlayer: context.syncPlayer,
    syncPlayerWithData: context.syncPlayerWithData,
    broadcastAction: context.broadcastAction,
    sendToPeer: context.sendToPeer,
    onRemoteAction: context.onRemoteAction,
  };
};
