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
    console.log('[Multiplayer] updateRemotePlayers - total:', allPlayers.length, 'filtered:', filtered.length, 'remotePlayers:', filtered);
    setRemotePlayers(filtered);
  }, []);

  // COMUNICACIÓN
  const broadcastPresence = useCallback((usePlayerId?: string) => {
    const idToUse = usePlayerId || localPlayerIdRef.current;
    if (!sendActionRef.current || !idToUse || !isConnectedRef.current) {
      console.warn('[Multiplayer] broadcastPresence skipped:', { 
        hasSendAction: !!sendActionRef.current, 
        idToUse, 
        isConnected: isConnectedRef.current 
      });
      return;
    }

    const playerData = playersRef.current.get(idToUse);
    console.log('[Multiplayer] broadcastPresence:', playerData);
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
    if (!currentId || !isConnectedRef.current) {
      console.warn('[Multiplayer] syncPlayerWithData skipped:', { currentId, isConnected: isConnectedRef.current });
      return;
    }

    const playerData: PlayerPresence = {
      id: currentId,
      name: playerName,
      level: empirePoints,
      lastSeen: Date.now(),
    };

    console.log('[Multiplayer] syncPlayerWithData:', playerData);
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
      // Usar configuración con múltiples trackers para mejor conectividad
      room = joinRoom(TRYSTERO_CONFIG, roomId);
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
      console.log('[Multiplayer] ✅ PEER JOINED:', peerId, 'at', new Date().toLocaleTimeString());
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
        console.log('[Multiplayer] Sent REQUEST_PRESENCE to:', peerId);
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
          console.log('[Multiplayer] Sent PRESENCE_UPDATE to:', peerId, playerData);
        }
      } catch (e) {
        console.warn('Error sending presence to new peer:', e);
      }
      
      // Broadcast general a todos los peers
      broadcastPresence(playerId);
      pendingTimeoutsRef.current.uiTimeout = setTimeout(() => updateRemotePlayers(), 300);
    });

    // Peer Leave - Limpieza completa del jugador que se sale
    room.onPeerLeave((peerId: string) => {
      console.log('[Multiplayer] ❌ PEER LEFT:', peerId, 'at', new Date().toLocaleTimeString());
      setPeers(prev => prev.filter(p => p !== peerId));
      // Eliminar completamente del playersRef - NO mantener datos residuales
      playersRef.current.delete(peerId);
      console.log('[Multiplayer] Deleted peer from playersRef, remaining:', playersRef.current.size);
      updateRemotePlayers();
    });

    // Obtener lista inicial de peers (solo para conexiones iniciales, NO reconexiones)
    const initialPeers = room.getPeers();
    console.log('[Multiplayer] Initial peers in room:', initialPeers);
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
        console.log('[Multiplayer] Requesting presence from existing peers:', initialPeers);
        try {
          sendAction({ type: 'REQUEST_PRESENCE', payload: null, playerId, timestamp: Date.now() } as any);
        } catch (e) {
          console.warn('Error requesting presence:', e);
        }
      }, 100);
    }

    // Recepción de Acciones
    getAction((action: any, peerId: string) => {
      if (action.playerId === playerId) {
        console.log('[Multiplayer] Ignoring own action:', action.type);
        return;
      }
      console.log('[Multiplayer] 📩 Action received:', action.type, 'from:', peerId, 'payload:', action.payload);

      switch (action.type) {
        case 'PRESENCE_UPDATE':
          const playerData = action.payload as PlayerPresence;
          if (playerData) {
            // Actualizar datos del peer
            playersRef.current.set(peerId, {
              id: peerId,
              name: playerData.name || 'Jugador',
              level: playerData.level ?? 0,
              lastSeen: Date.now(),
            });
            console.log('[Multiplayer] ✅ Updated player presence:', peerId, playersRef.current.get(peerId));
            updateRemotePlayers();
          }
          break;
        case 'REQUEST_PRESENCE':
          console.log('[Multiplayer] Sending presence in response to REQUEST_PRESENCE from:', peerId);
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
          console.log('[Multiplayer] Received P2P_ATTACK from peerId:', peerId);
          // Augment payload with sender's Trystero peerId so downstream handlers
          // can reply to the correct peer (localPlayerId ≠ Trystero peerId)
          gameEventBus.emit('INCOMING_P2P_ATTACK' as any, { ...action.payload, _senderPeerId: peerId });
          break;
        case 'P2P_BATTLE_RESULT':
          console.log('[Multiplayer] Received P2P_BATTLE_RESULT from peerId:', peerId);
          gameEventBus.emit('P2P_BATTLE_RESULT' as any, { ...action.payload, _senderPeerId: peerId });
          break;
        case 'P2P_BATTLE_REQUEST_TROOPS':
          console.log('[Multiplayer] Received P2P_BATTLE_REQUEST_TROOPS from peerId:', peerId);
          gameEventBus.emit('P2P_BATTLE_REQUEST_TROOPS' as any, { ...action.payload, _senderPeerId: peerId });
          break;
        case 'P2P_BATTLE_DEFENDER_TROOPS':
          console.log('[Multiplayer] Received P2P_BATTLE_DEFENDER_TROOPS from peerId:', peerId);
          gameEventBus.emit('P2P_BATTLE_DEFENDER_TROOPS' as any, { ...action.payload, _senderPeerId: peerId });
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

    const playerData: PlayerPresence = { id: playerId, name: 'Player', level: 0, lastSeen: Date.now() };
    playersRef.current.set(playerId, playerData);

    console.log('[Multiplayer] Connected to room:', roomId, 'with playerId:', playerId);

    // Broadcast inicial para que otros peers nos vean
    pendingTimeoutsRef.current.broadcastTimeout = setTimeout(() => {
      console.log('[Multiplayer] Initial presence broadcast');
      broadcastPresence(playerId);
    }, 100);

    // Segundo broadcast + REQUEST_PRESENCE a todos los peers existentes
    setTimeout(() => {
      console.log('[Multiplayer] Second broadcast + requesting presence from peers');
      broadcastPresence(playerId);
      try {
        sendAction({ type: 'REQUEST_PRESENCE', payload: null, playerId, timestamp: Date.now() } as any);
      } catch (e) {
        console.warn('Error sending REQUEST_PRESENCE:', e);
      }
    }, 300);

    // Broadcast periódico
    pendingTimeoutsRef.current.presenceTimeout = setInterval(() => broadcastPresence(), PRESENCE_BROADCAST_INTERVAL);

    // Log periódico del estado de la sala (para debugging)
    const statusInterval = setInterval(() => {
      console.log('[Multiplayer] 📊 Room status:', {
        roomId,
        peers: peers.length,
        remotePlayers: remotePlayers.length,
        isConnected: isConnectedRef.current,
      });
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
    if (isConnected && localPlayerIdRef.current) {
      console.log('[Multiplayer] isConnected changed to true - checking if sync is needed');
      // Pequeño delay para asegurar que sendActionRef esté listo
      const timeout = setTimeout(() => {
        const playerData = playersRef.current.get(localPlayerIdRef.current!);
        console.log('[Multiplayer] Current player data in playersRef:', playerData);
        // Si los datos son por defecto, forzamos un broadcast de todos modos
        // useMultiplayerSync debería ejecutar syncPlayerWithData pronto
        if (playerData && (playerData.name === 'Player' || playerData.level === 0)) {
          console.log('[Multiplayer] Player data is default, waiting for useMultiplayerSync...');
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isConnected]);

  // FUNCIONES PÚBLICAS
  const createRoom = useCallback((roomId?: string): string => {
    const id = roomId || `sb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    console.log('[Multiplayer] Creating room:', id);
    if (initRoom(id)) return id;
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
    console.log('[Multiplayer] Provider mounted - instance:', Math.random().toString(36).substr(2, 5));
    return () => {
      console.log('[Multiplayer] Provider unmounting - cleaning up room, isConnected:', isConnectedRef.current);
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
