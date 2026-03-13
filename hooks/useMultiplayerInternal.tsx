import React, {
  createContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  PlayerPresence,
  MultiplayerAction,
  MultiplayerActionType,
  GiftGoldPayload,
  ChatMessagePayload,
} from '../types/multiplayer';
import { gameEventBus } from '../utils/eventBus';

const SOCKET_SERVER_URL =
  (import.meta as any).env?.VITE_SOCKET_SERVER_URL || 'http://localhost:10000';

const PRESENCE_BROADCAST_INTERVAL = 60000;

export const GLOBAL_ROOM_ID = 'iron-dune-global-v1';

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
  syncPlayer: (player: { name: string; level: number; flag?: string }) => void;
  syncPlayerWithData: (playerName: string, empirePoints: number, playerFlag?: string) => void;
  broadcastAction: (action: MultiplayerAction) => void;
  sendToPeer: (peerId: string, action: MultiplayerAction) => void;
  onRemoteAction: (callback: (action: MultiplayerAction) => void) => void;
}

export const MultiplayerContext = createContext<MultiplayerContextType | null>(null);

export interface MultiplayerProviderProps {
  children: ReactNode;
}

export const MultiplayerProvider: React.FC<MultiplayerProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [peers, setPeers] = useState<string[]>([]);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<PlayerPresence[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const actionsCallbackRef = useRef<((action: MultiplayerAction) => void) | null>(null);
  const playersRef = useRef<Map<string, PlayerPresence>>(new Map());
  const localPlayerIdRef = useRef<string | null>(null);
  const isConnectedRef = useRef(false);
  const pendingTimeoutsRef = useRef<PendingTimeouts>({
    presenceTimeout: null,
    uiTimeout: null,
    broadcastTimeout: null,
  });

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
      statusInterval: undefined,
    };
  }, []);

  const updateRemotePlayers = useCallback(() => {
    const currentId = localPlayerIdRef.current;
    const allPlayers = Array.from(playersRef.current.values());
    const filtered = currentId ? allPlayers.filter(p => p.id !== currentId) : allPlayers;
    setRemotePlayers(filtered);
  }, []);

  const broadcastPresence = useCallback((usePlayerId?: string) => {
    const idToUse = usePlayerId || localPlayerIdRef.current;
    if (!socketRef.current || !idToUse || !isConnectedRef.current) return;

    const playerData = playersRef.current.get(idToUse);
    if (playerData) {
      try {
        socketRef.current.emit('presence_update', { playerData });
        socketRef.current.emit('broadcast_action', {
          action: {
            type: 'PRESENCE_UPDATE' as MultiplayerActionType,
            payload: playerData as any,
            playerId: idToUse,
            timestamp: Date.now(),
          },
        });
      } catch (e) {
      }
    }
  }, []);

  const broadcastAction = useCallback((action: MultiplayerAction) => {
    if (!socketRef.current || !localPlayerIdRef.current || !isConnectedRef.current) return;

    const actionWithPlayer = {
      ...action,
      playerId: localPlayerIdRef.current,
      timestamp: Date.now(),
    };

    try {
      socketRef.current.emit('broadcast_action', { action: actionWithPlayer });
    } catch (e) {
    }
  }, []);

  const sendToPeer = useCallback((peerId: string, action: MultiplayerAction) => {
    if (!socketRef.current || !localPlayerIdRef.current || !isConnectedRef.current) return;

    const actionWithPlayer = {
      ...action,
      playerId: localPlayerIdRef.current,
      timestamp: Date.now(),
    };

    try {
      socketRef.current.emit('send_to_peer', { targetPeerId: peerId, action: actionWithPlayer });
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
    if (!currentId || !isConnectedRef.current) return;

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

  const cleanupRoom = useCallback(() => {
    clearAllTimeouts();
    playersRef.current.clear();
    setIsConnected(false);
    setIsConnecting(false);
    setPeers([]);
    setRemotePlayers([]);
  }, [clearAllTimeouts]);

  const handleRemoteAction = useCallback((data: { action: any; fromPeerId: string }) => {
    const { action, fromPeerId } = data;
    const playerId = localPlayerIdRef.current;

    if (action.playerId === playerId) return;

    const peerId = fromPeerId;

    switch (action.type) {
      case 'PRESENCE_UPDATE': {
        const playerData = action.payload as PlayerPresence;
        if (playerData) {
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
      }
      case 'REQUEST_PRESENCE':
        broadcastPresence(playerId || undefined);
        break;
      case 'GIFT_GOLD': {
        const giftData = action.payload as GiftGoldPayload;
        if (giftData && giftData.amount > 0) {
          gameEventBus.emit('RECEIVE_GOLD' as any, { amount: giftData.amount });
          gameEventBus.emit('SHOW_TOAST' as any, { message: `¡Recibiste ${giftData.amount} oro!`, type: 'success' });
        }
        break;
      }
      case 'GIFT_RESOURCE': {
        const giftResData = action.payload as { resource: string; amount: number; senderName: string };
        if (giftResData && giftResData.amount > 0 && giftResData.resource) {
          gameEventBus.emit('RECEIVE_P2P_RESOURCE' as any, {
            resource: giftResData.resource,
            amount: giftResData.amount,
            senderName: giftResData.senderName || 'Aliado',
          });
        }
        break;
      }
      case 'P2P_ATTACK':
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
      case 'CHAT_MESSAGE': {
        const chatPayload = action.payload as ChatMessagePayload;
        gameEventBus.emit('P2P_CHAT_MESSAGE' as any, {
          ...chatPayload,
          _senderPeerId: peerId,
          playerId: action.playerId,
          timestamp: action.timestamp,
        });
        break;
      }
      default:
        if (actionsCallbackRef.current) {
          actionsCallbackRef.current(action);
        }
    }
  }, [broadcastPresence, updateRemotePlayers]);

  const handleRemoteActionRef = useRef(handleRemoteAction);
  useEffect(() => {
    handleRemoteActionRef.current = handleRemoteAction;
  }, [handleRemoteAction]);

  const initConnection = useCallback((): boolean => {
    if (isConnecting || isConnected) {
      return false;
    }

    setIsConnecting(true);
    setConnectionError(null);
    setPeers([]);
    setRemotePlayers([]);
    playersRef.current.clear();

    const playerId = generatePlayerId();
    setLocalPlayerId(playerId);
    localPlayerIdRef.current = playerId;

    let socket = socketRef.current;

    if (!socket || socket.disconnected) {
      try {
        socket = io(SOCKET_SERVER_URL, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 10000,
        });
        socketRef.current = socket;
      } catch (error) {
        setIsConnecting(false);
        setIsConnected(false);
        setConnectionError('Error de conexión. Intenta de nuevo.');
        isConnectedRef.current = false;
        return false;
      }

      socket.on('remote_action', (data: { action: any; fromPeerId: string }) => {
        handleRemoteActionRef.current(data);
      });

      socket.on('peer_join', ({ peerId: newPeerId }: { peerId: string }) => {
        setPeers(prev => [...new Set([...prev, newPeerId])]);

        playersRef.current.set(newPeerId, {
          id: newPeerId,
          name: 'Jugador',
          level: 0,
          lastSeen: Date.now(),
        });
        updateRemotePlayers();

        const myId = localPlayerIdRef.current;
        if (myId && socketRef.current) {
          try {
            socketRef.current.emit('send_to_peer', {
              targetPeerId: newPeerId,
              action: { type: 'REQUEST_PRESENCE', payload: null, playerId: myId, timestamp: Date.now() },
            });
          } catch (e) {
          }

          const playerData = playersRef.current.get(myId);
          if (playerData) {
            try {
              socketRef.current.emit('send_to_peer', {
                targetPeerId: newPeerId,
                action: {
                  type: 'PRESENCE_UPDATE',
                  payload: playerData,
                  playerId: myId,
                  timestamp: Date.now(),
                },
              });
            } catch (e) {
            }
          }
        }

        broadcastPresence(localPlayerIdRef.current || undefined);
        pendingTimeoutsRef.current.uiTimeout = setTimeout(() => updateRemotePlayers(), 300);
      });

      socket.on('peer_leave', ({ peerId: leftPeerId }: { peerId: string }) => {
        setPeers(prev => prev.filter(p => p !== leftPeerId));
        playersRef.current.delete(leftPeerId);
        updateRemotePlayers();
      });

      socket.on('connect_error', () => {
        setConnectionError('Error de conexión con el servidor.');
        setIsConnecting(false);
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
        isConnectedRef.current = false;
      });

      socket.on('connect', () => {
        const pid = localPlayerIdRef.current;
        if (pid && socketRef.current) {
          socketRef.current.emit('join_room', { peerId: pid });
        }
      });
    }

    socket.off('room_joined');
    socket.on('room_joined', ({ peers: existingPeers }: { roomId: string; peers: string[] }) => {
      if (existingPeers.length > 0) {
        existingPeers.forEach((pid: string) => {
          playersRef.current.set(pid, {
            id: pid,
            name: 'Jugador',
            level: 0,
            lastSeen: Date.now(),
          });
        });
        setPeers(existingPeers);
        updateRemotePlayers();

        setTimeout(() => {
          const myId = localPlayerIdRef.current;
          if (myId && socketRef.current) {
            try {
              socketRef.current.emit('broadcast_action', {
                action: { type: 'REQUEST_PRESENCE', payload: null, playerId: myId, timestamp: Date.now() },
              });
            } catch (e) {
            }
          }
        }, 100);
      }

      setIsConnected(true);
      setIsConnecting(false);
      setIsInitialized(true);
      isConnectedRef.current = true;

      clearAllTimeouts();

      const myId = localPlayerIdRef.current;
      if (myId) {
        const playerData: PlayerPresence = { id: myId, name: 'Player', level: 0, lastSeen: Date.now() };
        playersRef.current.set(myId, playerData);

        pendingTimeoutsRef.current.broadcastTimeout = setTimeout(() => {
          broadcastPresence(myId);
        }, 100);

        setTimeout(() => {
          broadcastPresence(myId);
          if (socketRef.current) {
            try {
              socketRef.current.emit('broadcast_action', {
                action: { type: 'REQUEST_PRESENCE', payload: null, playerId: myId, timestamp: Date.now() },
              });
            } catch (e) {
            }
          }
        }, 300);
      }

      pendingTimeoutsRef.current.presenceTimeout = setInterval(() => broadcastPresence(), PRESENCE_BROADCAST_INTERVAL);
    });

    if (socket.connected) {
      socket.emit('join_room', { peerId: playerId });
    }

    return true;
  }, [isConnecting, broadcastPresence, generatePlayerId, updateRemotePlayers, clearAllTimeouts, isConnected]);

  useEffect(() => {
    if (!isConnected || !localPlayerIdRef.current) return;

    const timeout = setTimeout(() => {
      const playerData = playersRef.current.get(localPlayerIdRef.current!);
      if (playerData && (playerData.name === 'Player' || playerData.level === 0)) {
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [isConnected]);

  useEffect(() => {
    initConnection();
    return () => {
      cleanupRoom();
      isConnectedRef.current = false;
      localPlayerIdRef.current = null;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        syncPlayer,
        syncPlayerWithData,
        broadcastAction,
        sendToPeer,
        onRemoteAction,
      }}
    >
      {children}
    </MultiplayerContext.Provider>
  );
};
