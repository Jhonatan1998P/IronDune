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
  ChatMessagePayload,
} from '../types/multiplayer';
import { gameEventBus } from '../utils/eventBus';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const APP_ID = 'shadowbound-multiplayer-v1';
const PRESENCE_BROADCAST_INTERVAL = 60000; // 1 minuto, para actualizar ranking y tarjetas P2P

// Sala global: ID fijo compartido por todos los jugadores al iniciar el juego
export const GLOBAL_ROOM_ID = 'iron-dune-global-v1';

// Configuración de Trystero con trackers adicionales para mejor conectividad
const TRYSTERO_CONFIG = {
  appId: APP_ID,
  // Trackers adicionales para mejorar la conectividad
  trackerUrls: [
    'wss://tracker.btorrent.xyz',
    'wss://tracker.webtorrent.dev',
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.files.fm:7073',
    'wss://tracker.novage.com.ua',
  ],
};

// ============================================================================
// TIPOS
// ============================================================================

interface PendingTimeouts {
  presenceTimeout: ReturnType<typeof setTimeout> | null;
  uiTimeout: ReturnType<typeof setTimeout> | null;
  broadcastTimeout: ReturnType<typeof setTimeout> | null;
  statusInterval?: ReturnType<typeof setInterval>;
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
  isGlobalRoom: boolean;
  syncPlayer: (player: { name: string; level: number; flag?: string }) => void;
  syncPlayerWithData: (playerName: string, empirePoints: number, playerFlag?: string) => void;
  broadcastAction: (action: MultiplayerAction) => void;
  sendToPeer: (peerId: string, action: MultiplayerAction) => void;
  onRemoteAction: (callback: (action: MultiplayerAction) => void) => void;
  createRoom: () => string;
  joinRoomById: (roomId: string) => boolean;
  leave: () => void;
  reconnect: () => boolean;
  returnToGlobalRoom: () => boolean;
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
  const [isGlobalRoom, setIsGlobalRoom] = useState(false);

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
    if (timeouts.statusInterval) clearInterval(timeouts.statusInterval);
    pendingTimeoutsRef.current = { 
      presenceTimeout: null, 
      uiTimeout: null, 
      broadcastTimeout: null, 
      statusInterval: undefined 
    };
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
    if (!sendActionRef.current || !idToUse || !isConnectedRef.current) {
      return;
    }

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
    }
  }, []);

  const onRemoteAction = useCallback((callback: (action: MultiplayerAction) => void) => {
    actionsCallbackRef.current = callback;
  }, []);

  const syncPlayer = useCallback((player: { name: string; level: number; flag?: string }) => {
    const currentId = localPlayerIdRef.current;
    if (!currentId || !isConnectedRef.current) return;

    const playerData: PlayerPresence = {
      id: currentId,
      name: player.name,
      level: player.level,
      flag: player.flag,
      lastSeen: Date.now(),
    };

    playersRef.current.set(currentId, playerData);
    broadcastPresence();
  }, [broadcastPresence]);

  const syncPlayerWithData = useCallback((playerName: string, empirePoints: number, playerFlag?: string) => {
    const currentId = localPlayerIdRef.current;
    if (!currentId || !isConnectedRef.current) {
      return;
    }

    const playerData: PlayerPresence = {
      id: currentId,
      name: playerName,
      level: empirePoints,
      flag: playerFlag,
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
      // Usar configuración con múltiples trackers para mejor conectividad
      room = joinRoom(TRYSTERO_CONFIG, roomId);
      roomRef.current = room;
    } catch (error) {
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
      }
      
      // Broadcast general a todos los peers
      broadcastPresence(playerId);
      pendingTimeoutsRef.current.uiTimeout = setTimeout(() => updateRemotePlayers(), 300);
    });

    // Peer Leave - Limpieza completa del jugador que se sale
    room.onPeerLeave((peerId: string) => {
      setPeers(prev => prev.filter(p => p !== peerId));
      // Eliminar completamente del playersRef - NO mantener datos residuales
      playersRef.current.delete(peerId);
      updateRemotePlayers();
    });

    // Obtener lista inicial de peers (solo para conexiones iniciales, NO reconexiones)
    const initialPeersObj = room.getPeers();
    const initialPeers = Object.keys(initialPeersObj);
    if (initialPeers.length > 0) {
      // Ya hay peers en la sala - registrarlos temporalmente
      initialPeers.forEach((peerId: string) => {
        playersRef.current.set(peerId, {
          id: peerId,
          name: 'Jugador',
          level: 0,
          lastSeen: Date.now(),
        });
      });
      setPeers(initialPeers);
      updateRemotePlayers();
      
      // Solicitar presencia a todos los peers existentes
      setTimeout(() => {
        try {
          sendAction({ type: 'REQUEST_PRESENCE', payload: null, playerId, timestamp: Date.now() } as any);
        } catch (e) {
        }
      }, 100);
    }

    // Recepción de Acciones
    getAction((action: any, peerId: string) => {
      if (action.playerId === playerId) {
        return;
      }

      switch (action.type) {
        case 'PRESENCE_UPDATE':
          const playerData = action.payload as PlayerPresence;
          if (playerData) {
            // Actualizar datos del peer
            playersRef.current.set(peerId, {
              id: peerId,
              name: playerData.name || 'Jugador',
              level: playerData.level ?? 0,
              flag: playerData.flag,
              lastSeen: Date.now(),
            });
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
        case 'GIFT_RESOURCE':
          const giftResData = action.payload as { resource: string; amount: number; senderName: string };
          if (giftResData && giftResData.amount > 0 && giftResData.resource) {
            gameEventBus.emit('RECEIVE_P2P_RESOURCE' as any, {
              resource: giftResData.resource,
              amount: giftResData.amount,
              senderName: giftResData.senderName || 'Aliado',
            });
          }
          break;
        case 'P2P_ATTACK':
          // Augment payload with sender's Trystero peerId so downstream handlers
          // can reply to the correct peer (localPlayerId ≠ Trystero peerId)
          gameEventBus.emit('INCOMING_P2P_ATTACK' as any, { ...action.payload, _senderPeerId: peerId });
          break;
        case 'P2P_BATTLE_RESULT':
          gameEventBus.emit('P2P_BATTLE_RESULT' as any, { ...action.payload, _senderPeerId: peerId });
          break;
        case 'P2P_BATTLE_REQUEST_TROOPS':
          gameEventBus.emit('P2P_BATTLE_REQUEST_TROOPS' as any, { ...action.payload, _senderPeerId: peerId });
          break;
        case 'P2P_BATTLE_DEFENDER_TROOPS':
          gameEventBus.emit('P2P_BATTLE_DEFENDER_TROOPS' as any, { ...action.payload, _senderPeerId: peerId });
          break;
        case 'P2P_SPY_REQUEST':
          console.log(`[P2P-SPY] Red: Recibida solicitud de ${peerId}`, action.payload);
          gameEventBus.emit('P2P_SPY_REQUEST' as any, { ...action.payload, _senderPeerId: peerId });
          break;
        case 'P2P_SPY_RESPONSE':
          console.log(`[P2P-SPY] Red: Recibida respuesta de ${peerId}`, action.payload);
          gameEventBus.emit('P2P_SPY_RESPONSE' as any, { ...action.payload, _senderPeerId: peerId });
          break;
        case 'CHAT_MESSAGE':
          const chatPayload = action.payload as ChatMessagePayload;
          gameEventBus.emit('P2P_CHAT_MESSAGE' as any, { 
            ...chatPayload, 
            _senderPeerId: peerId,
            playerId: action.playerId,
            timestamp: action.timestamp
          });
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
    setCurrentRoomId(roomId);
    currentRoomIdRef.current = roomId;
    setIsGlobalRoom(roomId === GLOBAL_ROOM_ID);

    const playerData: PlayerPresence = { id: playerId, name: 'Player', level: 0, lastSeen: Date.now() };
    playersRef.current.set(playerId, playerData);

    // Broadcast inicial para que otros peers nos vean
    pendingTimeoutsRef.current.broadcastTimeout = setTimeout(() => {
      broadcastPresence(playerId);
    }, 100);

    // Segundo broadcast + REQUEST_PRESENCE a todos los peers existentes
    setTimeout(() => {
      broadcastPresence(playerId);
      try {
        sendAction({ type: 'REQUEST_PRESENCE', payload: null, playerId, timestamp: Date.now() } as any);
      } catch (e) {
      }
    }, 300);

    // Broadcast periódico
    pendingTimeoutsRef.current.presenceTimeout = setInterval(() => broadcastPresence(), PRESENCE_BROADCAST_INTERVAL);

    // Log periódico del estado de la sala (para debugging)
    const statusInterval = setInterval(() => {
    }, 10000);

    // Guardar el interval ID para cleanup
    (pendingTimeoutsRef.current as any).statusInterval = statusInterval;

    return true;
  }, [isConnecting, broadcastPresence, cleanupRoom, generatePlayerId, updateRemotePlayers]);

  // ============================================================================
  // AUTO-SYNC: Forzar sync cuando isConnected cambia
  // ============================================================================
  // Este efecto se ejecuta CADA vez que isConnected cambia a true
  // Es CRÍTICO para sincronizar después de una reconexión
  useEffect(() => {
    if (!isConnected || !localPlayerIdRef.current) return;

    // Pequeño delay para asegurar que sendActionRef esté listo
    const timeout = setTimeout(() => {
      const playerData = playersRef.current.get(localPlayerIdRef.current!);
      // Si los datos son por defecto, forzamos un broadcast de todos modos
      // useMultiplayerSync debería ejecutar syncPlayerWithData pronto
      if (playerData && (playerData.name === 'Player' || playerData.level === 0)) {
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [isConnected]);

  // FUNCIONES PÚBLICAS
  const createRoom = useCallback((roomId?: string): string => {
    const id = roomId || `sb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    if (initRoom(id)) return id;
    return '';
  }, [initRoom]);

  const joinRoomById = useCallback((roomId: string): boolean => {
    if (!roomId || roomId.trim() === '') {
      gameEventBus.emit('SHOW_TOAST' as any, { message: 'Código inválido', type: 'error' });
      return false;
    }
    return initRoom(roomId.trim());
  }, [initRoom]);

  const leave = useCallback(() => {
    cleanupRoom();
    setCurrentRoomId(null);
    setLocalPlayerId(null);
    setIsGlobalRoom(false);
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
    return initRoom(currentRoomIdRef.current);
  }, [initRoom]);

  const returnToGlobalRoom = useCallback((): boolean => {
    if (isConnectedRef.current && currentRoomIdRef.current === GLOBAL_ROOM_ID) {
      gameEventBus.emit('SHOW_TOAST' as any, { message: 'Ya estás en la sala global', type: 'info' });
      return false;
    }
    if (roomRef.current) {
      cleanupRoom();
      setCurrentRoomId(null);
      setLocalPlayerId(null);
      setIsGlobalRoom(false);
      currentRoomIdRef.current = null;
      localPlayerIdRef.current = null;
      isConnectedRef.current = false;
    }
    return initRoom(GLOBAL_ROOM_ID);
  }, [cleanupRoom, initRoom]);

  // CLEANUP AL DESMONTAR
  useEffect(() => {
    // Auto-join sala global al montar
    initRoom(GLOBAL_ROOM_ID);
    return () => {
      cleanupRoom();
      isConnectedRef.current = false;
      localPlayerIdRef.current = null;
      currentRoomIdRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        isGlobalRoom,
        syncPlayer,
        syncPlayerWithData,
        broadcastAction,
        sendToPeer,
        onRemoteAction,
        createRoom,
        joinRoomById,
        leave,
        reconnect,
        returnToGlobalRoom,
      }}
    >
      {children}
    </MultiplayerContext.Provider>
  );
};
