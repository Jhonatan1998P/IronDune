/**
 * MultiplayerProvider - Provider del sistema multijugador
 * 
 * Este archivo contiene la implementación del Provider y se separa del hook
 * para compatibilidad con Vite Fast Refresh.
 * 
 * Basado en MULTIPLAYER_ARCHITECTURE.md
 */

import React, {
  createContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import { joinRoom, Room } from 'trystero/torrent';
import type {
  PlayerPresence,
  MultiplayerAction,
  MultiplayerActionType,
  GiftGoldPayload,
} from '../types/multiplayer';
import { gameEventBus } from '../utils/eventBus';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const APP_ID = 'shadowbound-multiplayer-v1';
const PRESENCE_BROADCAST_INTERVAL = 5000;

// ============================================================================
// TIPOS
// ============================================================================

interface PendingTimeouts {
  presenceTimeout: ReturnType<typeof setTimeout> | null;
  uiTimeout: ReturnType<typeof setTimeout> | null;
  broadcastTimeout: ReturnType<typeof setTimeout> | null;
}

export interface MultiplayerContextType {
  isInitialized: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  peers: string[];
  localPlayerId: string | null;
  remotePlayers: PlayerPresence[];
  currentRoomId: string | null;
  syncPlayer: (player: { name: string; level: number }) => void;
  syncPlayerWithData: (playerName: string, empirePoints: number) => void;
  broadcastAction: (action: MultiplayerAction) => void;
  sendToPeer: (peerId: string, action: MultiplayerAction) => void;
  onRemoteAction: (callback: (action: MultiplayerAction) => void) => void;
  createRoom: () => string;
  joinRoomById: (roomId: string) => boolean;
  leave: () => void;
  reconnect: () => boolean;
}

export const MultiplayerContext = createContext<MultiplayerContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export interface MultiplayerProviderProps {
  children: ReactNode;
}

export const MultiplayerProvider: React.FC<MultiplayerProviderProps> = ({ children }) => {
  // ESTADO REACT
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [peers, setPeers] = useState<string[]>([]);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<PlayerPresence[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  // REFS
  const roomRef = useRef<Room | null>(null);
  const sendActionRef = useRef<ReturnType<Room['makeAction']>[0] | null>(null);
  const getActionRef = useRef<ReturnType<Room['makeAction']>[1] | null>(null);
  const actionsCallbackRef = useRef<((action: MultiplayerAction) => void) | null>(null);
  const playersRef = useRef<Map<string, PlayerPresence>>(new Map());
  const localPlayerIdRef = useRef<string | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const isConnectedRef = useRef(false);
  const pendingTimeoutsRef = useRef<PendingTimeouts>({
    presenceTimeout: null,
    uiTimeout: null,
    broadcastTimeout: null,
  });

  // UTILIDADES
  const generatePlayerId = useCallback(() => {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const clearAllTimeouts = useCallback(() => {
    const timeouts = pendingTimeoutsRef.current;
    if (timeouts.presenceTimeout) clearTimeout(timeouts.presenceTimeout);
    if (timeouts.uiTimeout) clearTimeout(timeouts.uiTimeout);
    if (timeouts.broadcastTimeout) clearTimeout(timeouts.broadcastTimeout);
    pendingTimeoutsRef.current = { presenceTimeout: null, uiTimeout: null, broadcastTimeout: null };
  }, []);

  const updateRemotePlayers = useCallback(() => {
    const currentId = localPlayerIdRef.current;
    const allPlayers = Array.from(playersRef.current.values());
    const filtered = currentId ? allPlayers.filter(p => p.id !== currentId) : allPlayers;
    setRemotePlayers(filtered);
  }, []);

  // COMUNICACIÓN
  const broadcastPresence = useCallback((usePlayerId?: string) => {
    const idToUse = usePlayerId || localPlayerIdRef.current;
    if (!sendActionRef.current || !idToUse || !isConnectedRef.current) return;

    const playerData = playersRef.current.get(idToUse);
    if (playerData) {
      try {
        sendActionRef.current({
          type: 'PRESENCE_UPDATE' as MultiplayerActionType,
          payload: playerData as any,
          playerId: idToUse,
          timestamp: Date.now(),
        } as any);
      } catch (e) {
        console.warn('Error broadcasting presence:', e);
      }
    }
  }, []);

  const broadcastAction = useCallback((action: MultiplayerAction) => {
    if (!sendActionRef.current || !localPlayerIdRef.current || !isConnectedRef.current) return;

    const actionWithPlayer = {
      ...action,
      playerId: localPlayerIdRef.current,
      timestamp: Date.now(),
    };

    try {
      sendActionRef.current(actionWithPlayer as any);
    } catch (e) {
      console.warn('Error broadcasting action:', e);
    }
  }, []);

  const sendToPeer = useCallback((peerId: string, action: MultiplayerAction) => {
    if (!sendActionRef.current || !localPlayerIdRef.current || !isConnectedRef.current) return;

    const actionWithPlayer = {
      ...action,
      playerId: localPlayerIdRef.current,
      timestamp: Date.now(),
    };

    try {
      sendActionRef.current(actionWithPlayer as any, peerId);
    } catch (e) {
      console.warn('Error sending to peer:', e);
    }
  }, []);

  const onRemoteAction = useCallback((callback: (action: MultiplayerAction) => void) => {
    actionsCallbackRef.current = callback;
  }, []);

  const syncPlayer = useCallback((player: { name: string; level: number }) => {
    const currentId = localPlayerIdRef.current;
    if (!currentId || !isConnectedRef.current) return;

    const playerData: PlayerPresence = {
      id: currentId,
      name: player.name,
      level: player.level,
      lastSeen: Date.now(),
    };

    playersRef.current.set(currentId, playerData);
    broadcastPresence();
  }, [broadcastPresence]);

  const syncPlayerWithData = useCallback((playerName: string, empirePoints: number) => {
    const currentId = localPlayerIdRef.current;
    if (!currentId || !isConnectedRef.current) return;

    const playerData: PlayerPresence = {
      id: currentId,
      name: playerName,
      level: empirePoints,
      lastSeen: Date.now(),
    };

    playersRef.current.set(currentId, playerData);
    broadcastPresence();
  }, [broadcastPresence]);

  // CLEANUP
  const cleanupRoom = useCallback(() => {
    clearAllTimeouts();
    if (roomRef.current) {
      try {
        roomRef.current.leave();
      } catch (e) {
        console.warn('Error leaving room:', e);
      }
      roomRef.current = null;
    }
    sendActionRef.current = null;
    getActionRef.current = null;
    playersRef.current.clear();
    setIsConnected(false);
    setIsConnecting(false);
    setPeers([]);
    setRemotePlayers([]);
  }, [clearAllTimeouts]);

  // INICIALIZACIÓN
  const initRoom = useCallback((roomId: string): boolean => {
    if (isConnecting || (isConnected && currentRoomIdRef.current === roomId)) {
      console.warn('Already connecting or connected to this room');
      return false;
    }

    if (roomRef.current) {
      cleanupRoom();
    }

    setIsConnecting(true);
    setConnectionError(null);
    setPeers([]);
    setRemotePlayers([]);
    playersRef.current.clear();

    const playerId = generatePlayerId();
    setLocalPlayerId(playerId);
    localPlayerIdRef.current = playerId;
    currentRoomIdRef.current = roomId;

    let room: Room | null = null;
    try {
      room = joinRoom({ appId: APP_ID }, roomId);
      roomRef.current = room;
    } catch (error) {
      console.error('Error connecting to room:', error);
      if (room) {
        try { room.leave(); } catch (e) {}
      }
      roomRef.current = null;
      setIsConnecting(false);
      setIsConnected(false);
      setConnectionError('Error de conexión. Intenta de nuevo.');
      isConnectedRef.current = false;
      return false;
    }

    const [sendAction, getAction] = room.makeAction('gameAction');
    sendActionRef.current = sendAction;
    getActionRef.current = getAction;

    // Peer Join
    room.onPeerJoin((peerId: string) => {
      console.log('[Multiplayer] Peer joined:', peerId);
      setPeers(prev => [...new Set([...prev, peerId])]);
      
      // Registrar el peer en playersRef inmediatamente
      playersRef.current.set(peerId, {
        id: peerId,
        name: 'Jugador',
        level: 0,
        lastSeen: Date.now(),
      });
      updateRemotePlayers();
      
      // Enviar REQUEST_PRESENCE al nuevo peer
      try {
        sendAction({ type: 'REQUEST_PRESENCE', payload: null, playerId, timestamp: Date.now() } as any, peerId);
      } catch (e) {
        console.warn('Error sending REQUEST_PRESENCE:', e);
      }
      
      // Broadcast inmediato de nuestra presencia al peer nuevo (unicast)
      try {
        const playerData = playersRef.current.get(playerId);
        if (playerData) {
          sendAction({
            type: 'PRESENCE_UPDATE',
            payload: playerData,
            playerId: playerId,
            timestamp: Date.now(),
          } as any, peerId);
        }
      } catch (e) {
        console.warn('Error sending presence to new peer:', e);
      }
      
      // Broadcast general a todos los peers
      broadcastPresence(playerId);
      pendingTimeoutsRef.current.uiTimeout = setTimeout(() => updateRemotePlayers(), 300);
    });

    // Peer Leave
    room.onPeerLeave((peerId: string) => {
      console.log('[Multiplayer] Peer left:', peerId);
      setPeers(prev => prev.filter(p => p !== peerId));
      playersRef.current.delete(peerId);
      updateRemotePlayers();
    });

    // Recepción de Acciones
    getAction((action: any, peerId: string) => {
      if (action.playerId === playerId) return;
      console.log('[Multiplayer] Action received:', action.type, 'from:', peerId, 'action:', action);

      switch (action.type) {
        case 'PRESENCE_UPDATE':
          const playerData = action.payload as PlayerPresence;
          if (playerData) {
            // Actualizar o crear la entrada del peer
            const existing = playersRef.current.get(peerId);
            playersRef.current.set(peerId, {
              id: peerId,
              name: playerData.name || existing?.name || 'Jugador',
              level: playerData.level ?? existing?.level ?? 0,
              lastSeen: Date.now(),
            });
            console.log('[Multiplayer] Updated player presence:', peerId, playersRef.current.get(peerId));
            updateRemotePlayers();
          }
          break;
        case 'REQUEST_PRESENCE':
          // Enviar nuestra presencia inmediatamente
          broadcastPresence(playerId);
          break;
        case 'GIFT_GOLD':
          const giftData = action.payload as GiftGoldPayload;
          if (giftData && giftData.amount > 0) {
            gameEventBus.emit('RECEIVE_GOLD' as any, { amount: giftData.amount });
            gameEventBus.emit('SHOW_TOAST' as any, { message: `¡Recibiste ${giftData.amount} oro!`, type: 'success' });
          }
          break;
        default:
          if (actionsCallbackRef.current) {
            actionsCallbackRef.current(action);
          }
      }
    });

    setIsConnected(true);
    setIsConnecting(false);
    setIsInitialized(true);
    isConnectedRef.current = true;

    const playerData: PlayerPresence = { id: playerId, name: 'Player', level: 0, lastSeen: Date.now() };
    playersRef.current.set(playerId, playerData);
    
    // Broadcast inicial inmediato y repetido para asegurar que todos los peers lo reciban
    // El primer broadcast puede perderse si los peers aún no están completamente conectados
    pendingTimeoutsRef.current.broadcastTimeout = setTimeout(() => {
      console.log('[Multiplayer] Initial presence broadcast');
      broadcastPresence(playerId);
    }, 50);
    
    // Segundo broadcast para asegurar
    setTimeout(() => {
      console.log('[Multiplayer] Second presence broadcast');
      broadcastPresence(playerId);
    }, 200);
    
    // Broadcast periódico
    pendingTimeoutsRef.current.presenceTimeout = setInterval(() => broadcastPresence(), PRESENCE_BROADCAST_INTERVAL);

    return true;
  }, [isConnecting, broadcastPresence, cleanupRoom, generatePlayerId, updateRemotePlayers]);

  // FUNCIONES PÚBLICAS
  const createRoom = useCallback((): string => {
    const roomId = `sb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    console.log('[Multiplayer] Creating room:', roomId);
    if (initRoom(roomId)) return roomId;
    return '';
  }, [initRoom]);

  const joinRoomById = useCallback((roomId: string): boolean => {
    if (!roomId || roomId.trim() === '') {
      gameEventBus.emit('SHOW_TOAST' as any, { message: 'Código inválido', type: 'error' });
      return false;
    }
    console.log('[Multiplayer] Joining room:', roomId);
    return initRoom(roomId.trim());
  }, [initRoom]);

  const leave = useCallback(() => {
    console.log('[Multiplayer] Leaving room');
    cleanupRoom();
    setCurrentRoomId(null);
    setLocalPlayerId(null);
    currentRoomIdRef.current = null;
    localPlayerIdRef.current = null;
    isConnectedRef.current = false;
  }, [cleanupRoom]);

  const reconnect = useCallback((): boolean => {
    if (!currentRoomIdRef.current) {
      gameEventBus.emit('SHOW_TOAST' as any, { message: 'No hay sala para reconectar', type: 'error' });
      return false;
    }
    if (isConnectedRef.current) {
      gameEventBus.emit('SHOW_TOAST' as any, { message: 'Ya estás conectado', type: 'info' });
      return false;
    }
    console.log('[Multiplayer] Reconnecting to room:', currentRoomIdRef.current);
    return initRoom(currentRoomIdRef.current);
  }, [initRoom]);

  // CLEANUP AL DESMONTAR
  useEffect(() => {
    console.log('[Multiplayer] Provider mounted');
    return () => {
      console.log('[Multiplayer] Provider unmounting - cleaning up room');
      cleanupRoom();
      isConnectedRef.current = false;
      localPlayerIdRef.current = null;
      currentRoomIdRef.current = null;
    };
  }, [cleanupRoom]);

  // RENDER
  return (
    <MultiplayerContext.Provider
      value={{
        isInitialized,
        isConnected,
        isConnecting,
        connectionError,
        peers,
        localPlayerId,
        remotePlayers,
        currentRoomId,
        syncPlayer,
        syncPlayerWithData,
        broadcastAction,
        sendToPeer,
        onRemoteAction,
        createRoom,
        joinRoomById,
        leave,
        reconnect,
      }}
    >
      {children}
    </MultiplayerContext.Provider>
  );
};
