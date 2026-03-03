import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';

export type PeerMessage = 
  | { type: 'challenge'; payload: { from: string; score: number } }
  | { type: 'accept'; payload: { army: Record<string, number> } }
  | { type: 'decline'; payload: { reason?: string } }
  | { type: 'attack'; payload: { army: Record<string, number> } }
  | { type: 'result'; payload: { winner: 'PLAYER' | 'ENEMY'; army: Record<string, number> } }
  | { type: 'score_update'; payload: { score: number } }
  | { type: 'player_info'; payload: { id: string; name: string; score: number } }
  | { type: 'sync_state'; payload: { gameState: any } }
  | { type: 'request_sync'; payload: { requestId: string } }
  | { type: 'heartbeat'; payload: { timestamp: number } }
  | { type: 'chat'; payload: { message: string; timestamp: number } }
  | { type: 'typing'; payload: { isTyping: boolean } };

export interface ChatMessage {
  id: string;
  from: string;
  fromName: string;
  message: string;
  timestamp: number;
  isOwn: boolean;
}

export interface P2PState {
  peerId: string | null;
  isConnected: boolean;
  connectedPeers: Map<string, DataConnection>;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: string | null;
}

export interface PeerInfo {
  id: string;
  name: string;
  score: number;
  lastSeen: number;
  isOnline: boolean;
}

export interface ChatMessage {
  id: string;
  from: string;
  fromName: string;
  message: string;
  timestamp: number;
  isOwn: boolean;
}

interface P2PContextType extends P2PState {
  connectToPeer: (remotePeerId: string) => Promise<DataConnection>;
  sendToPeer: (peerId: string, message: PeerMessage) => boolean;
  broadcast: (message: PeerMessage) => void;
  clearSession: () => void;
  removePeer: (peerId: string) => void;
  playerName: string;
  playerScore: number;
  knownPeers: Map<string, PeerInfo>;
  chatMessages: Map<string, ChatMessage[]>;
  sendChat: (peerId: string, message: string) => void;
  broadcastChat: (message: string) => void;
  clearChat: (peerId?: string) => void;
}

const P2PContext = createContext<P2PContextType | null>(null);

const STORAGE_KEY = 'p2p_session';
const HEARTBEAT_INTERVAL = 10000;
const PEER_TIMEOUT = 30000;

const SHORT_ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const generateShortId = (prefix: string = 'id', length: number = 5): string => {
  let result = prefix ? `${prefix}_` : '';
  for (let i = 0; i < length; i++) {
    result += SHORT_ID_CHARS.charAt(Math.floor(Math.random() * SHORT_ID_CHARS.length));
  }
  return result;
};

const savePeerId = (id: string): void => {
  localStorage.setItem('p2p_peer_id', id);
};

export const P2PProvider: React.FC<{ 
  children: React.ReactNode; 
  playerName: string;
  playerScore: number;
}> = ({ children, playerName, playerScore }) => {
  const [state, setState] = useState<P2PState>({
    peerId: null,
    isConnected: false,
    connectedPeers: new Map(),
    status: 'disconnected',
    error: null,
  });
  
  const [knownPeers, setKnownPeers] = useState<Map<string, PeerInfo>>(new Map());
  const [chatMessages, setChatMessages] = useState<Map<string, ChatMessage[]>>(new Map());
  
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const initializedRef = useRef(false);
  const playerInfoRef = useRef({ name: playerName, score: playerScore });
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingConnectionsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    playerInfoRef.current = { name: playerName, score: playerScore };
  }, [playerName, playerScore]);

  const saveSession = useCallback((remotePeerId: string) => {
    const peerId = peerRef.current?.id;
    if (!peerId || !remotePeerId) return;
    
    const session = {
      peerId,
      remotePeerId,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const removePeer = useCallback((peerId: string) => {
    const conn = connectionsRef.current.get(peerId);
    if (conn) {
      conn.close();
      connectionsRef.current.delete(peerId);
    }
    
    setKnownPeers(prev => {
      const newMap = new Map(prev);
      newMap.delete(peerId);
      return newMap;
    });
    
    setState(prev => {
      const newPeers = new Map(prev.connectedPeers);
      newPeers.delete(peerId);
      return {
        ...prev,
        connectedPeers: newPeers,
        isConnected: newPeers.size > 0,
      };
    });
  }, []);

  const sendToPeer = useCallback((peerId: string, message: PeerMessage) => {
    const conn = connectionsRef.current.get(peerId);
    if (conn && conn.open) {
      conn.send(message);
      return true;
    }
    return false;
  }, []);

  const broadcast = useCallback((message: PeerMessage) => {
    connectionsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send(message);
      }
    });
  }, []);

  const broadcastPlayerInfo = useCallback(() => {
    const info = playerInfoRef.current;
    const peerId = peerRef.current?.id;
    if (!peerId) return;
    
    broadcast({
      type: 'player_info',
      payload: { id: peerId, name: info.name, score: info.score }
    });
  }, [broadcast]);

  const sendChat = useCallback((peerId: string, message: string) => {
    const info = playerInfoRef.current;
    const msg: PeerMessage = {
      type: 'chat',
      payload: { message, timestamp: Date.now() }
    };
    
    if (sendToPeer(peerId, msg)) {
      setChatMessages(prev => {
        const newMap = new Map(prev);
        const peerMessages = newMap.get(peerId) || [];
        const newMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          from: peerRef.current?.id || '',
          fromName: info.name,
          message,
          timestamp: Date.now(),
          isOwn: true,
        };
        newMap.set(peerId, [...peerMessages, newMessage]);
        return newMap;
      });
    }
  }, [broadcast, sendToPeer]);

  const broadcastChat = useCallback((message: string) => {
    const info = playerInfoRef.current;
    const msg: PeerMessage = {
      type: 'chat',
      payload: { message, timestamp: Date.now() }
    };
    
    broadcast(msg);
    
    connectionsRef.current.forEach((_, peerId) => {
      setChatMessages(prev => {
        const newMap = new Map(prev);
        const peerMessages = newMap.get(peerId) || [];
        const newMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          from: peerRef.current?.id || '',
          fromName: info.name,
          message,
          timestamp: Date.now(),
          isOwn: true,
        };
        newMap.set(peerId, [...peerMessages, newMessage]);
        return newMap;
      });
    });
  }, [broadcast]);

  const clearChat = useCallback((peerId?: string) => {
    if (peerId) {
      setChatMessages(prev => {
        const newMap = new Map(prev);
        newMap.delete(peerId);
        return newMap;
      });
    } else {
      setChatMessages(new Map());
    }
  }, []);

  const updateKnownPeer = useCallback((peerId: string, name: string, score: number) => {
    setKnownPeers(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(peerId);
      newMap.set(peerId, {
        id: peerId,
        name,
        score,
        lastSeen: Date.now(),
        isOnline: existing ? existing.isOnline : connectionsRef.current.has(peerId),
      });
      return newMap;
    });
  }, []);

  const handleIncomingData = useCallback((from: string, data: PeerMessage) => {
    console.log('[P2P] Received data from', from, data);
    
    if (data.type === 'player_info') {
      updateKnownPeer(from, data.payload.name, data.payload.score);
    }
    
    if (data.type === 'chat') {
      const peerName = knownPeers.get(from)?.name || from;
      setChatMessages(prev => {
        const newMap = new Map(prev);
        const peerMessages = newMap.get(from) || [];
        const newMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          from,
          fromName: peerName,
          message: data.payload.message,
          timestamp: data.payload.timestamp,
          isOwn: false,
        };
        newMap.set(from, [...peerMessages, newMessage]);
        return newMap;
      });
    }
    
    window.dispatchEvent(new CustomEvent('p2p-message', { 
      detail: { from, ...data } 
    }));
  }, [updateKnownPeer, knownPeers]);

  const checkPeerStatus = useCallback(() => {
    const now = Date.now();
    setKnownPeers(prev => {
      const newMap = new Map(prev);
      let changed = false;
      
      newMap.forEach((peer, id) => {
        const wasOnline = peer.isOnline;
        const isOnline = connectionsRef.current.has(id) && 
                        connectionsRef.current.get(id)?.open === true;
        
        if (wasOnline !== isOnline) {
          newMap.set(id, { ...peer, isOnline });
          changed = true;
        }
        
        if (isOnline && now - peer.lastSeen > PEER_TIMEOUT) {
          newMap.set(id, { ...peer, isOnline: false });
          changed = true;
        }
      });
      
      return changed ? newMap : prev;
    });
  }, []);

  const connectToPeer = useCallback((remotePeerId: string): Promise<DataConnection> => {
    return new Promise((resolve, reject) => {
      const peer = peerRef.current;
      if (!peer) {
        reject(new Error('Peer not initialized. Please refresh the page.'));
        return;
      }

      const myId = peer.id;
      if (remotePeerId === myId) {
        reject(new Error('No puedes conectarte a ti mismo.'));
        return;
      }

      const existingConn = connectionsRef.current.get(remotePeerId);
      if (existingConn && existingConn.open) {
        console.log('[P2P] Already connected to this peer');
        resolve(existingConn);
        return;
      }

      if (pendingConnectionsRef.current.has(remotePeerId)) {
        reject(new Error('Ya te estás conectando a este jugador.'));
        return;
      }

      console.log('[P2P] Attempting to connect to:', remotePeerId);
      pendingConnectionsRef.current.add(remotePeerId);

      const conn = peer.connect(remotePeerId, {
        reliable: true,
        serialization: 'json',
      });

      const timeout = setTimeout(() => {
        pendingConnectionsRef.current.delete(remotePeerId);
        if (conn.open) conn.close();
        console.log('[P2P] Connection timeout');
        reject(new Error('Tiempo de conexión agotado. Asegúrate de que el otro jugador esté en línea.'));
      }, 20000);

      conn.on('open', () => {
        clearTimeout(timeout);
        pendingConnectionsRef.current.delete(remotePeerId);
        console.log('[P2P] Connection established with:', remotePeerId);
        connectionsRef.current.set(remotePeerId, conn);
        
        setState(prev => {
          const newPeers = new Map(prev.connectedPeers);
          newPeers.set(remotePeerId, conn);
          return {
            ...prev,
            connectedPeers: newPeers,
            isConnected: newPeers.size > 0,
          };
        });

        const info = playerInfoRef.current;
        conn.send({
          type: 'player_info',
          payload: { id: peer.id || '', name: info.name, score: info.score }
        });

        setKnownPeers(prev => {
          const newMap = new Map(prev);
          newMap.set(remotePeerId, {
            id: remotePeerId,
            name: info.name,
            score: info.score,
            lastSeen: Date.now(),
            isOnline: true,
          });
          return newMap;
        });

        resolve(conn);
      });

      conn.on('data', (data) => {
        handleIncomingData(remotePeerId, data as PeerMessage);
      });

      conn.on('close', () => {
        console.log('[P2P] Connection closed with:', remotePeerId);
        pendingConnectionsRef.current.delete(remotePeerId);
        connectionsRef.current.delete(remotePeerId);
        
        setState(prev => {
          const newPeers = new Map(prev.connectedPeers);
          newPeers.delete(remotePeerId);
          return {
            ...prev,
            connectedPeers: newPeers,
            isConnected: newPeers.size > 0,
          };
        });

        setKnownPeers(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(remotePeerId);
          if (existing) {
            newMap.set(remotePeerId, { ...existing, isOnline: false });
          }
          return newMap;
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        pendingConnectionsRef.current.delete(remotePeerId);
        console.error('[P2P] Connection error:', err);
        reject(err);
      });
    });
  }, [handleIncomingData]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initialPeerId = generateShortId('dune', 6);
    savePeerId(initialPeerId);

    console.log('[P2P] Initializing PeerJS with ID:', initialPeerId);

    const createPeer = (peerId: string, onReady?: () => void) => {
      console.log('[P2P] Creating peer with ID:', peerId);
      const peer = new Peer(peerId, {
        debug: 1,
        secure: true,
      });

      peer.on('open', (id) => {
        console.log('[P2P] My peer ID:', id);
        
        setState(prev => ({
          ...prev,
          peerId: id,
          status: 'connected',
          error: null,
        }));

        window.dispatchEvent(new CustomEvent('p2p-peer-id-changed', { 
          detail: { peerId: id } 
        }));

        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
        }
        heartbeatTimerRef.current = setInterval(() => {
          if (peer.open) {
            broadcast({
              type: 'heartbeat',
              payload: { timestamp: Date.now() }
            });
            
            connectionsRef.current.forEach((conn, peerId) => {
              if (conn.open) {
                conn.send({ type: 'heartbeat', payload: { timestamp: Date.now() } });
              } else {
                console.log('[P2P] Connection to', peerId, 'is closed, removing');
                connectionsRef.current.delete(peerId);
              }
            });
          }
          checkPeerStatus();
          broadcastPlayerInfo();
        }, HEARTBEAT_INTERVAL);
        
        if (onReady) onReady();
      });

      peer.on('connection', (conn) => {
        console.log('[P2P] Incoming connection from:', conn.peer);
        
        const existingConn = connectionsRef.current.get(conn.peer);
        if (existingConn && existingConn.open) {
          console.log('[P2P] Already connected to this peer, closing duplicate');
          conn.close();
          return;
        }
        
        conn.on('open', () => {
          console.log('[P2P] Incoming connection established!');
          connectionsRef.current.set(conn.peer, conn);
          saveSession(conn.peer);
          
          setState(prev => {
            const newPeers = new Map(prev.connectedPeers);
            newPeers.set(conn.peer, conn);
            return {
              ...prev,
              connectedPeers: newPeers,
              isConnected: newPeers.size > 0,
            };
          });

          const info = playerInfoRef.current;
          conn.send({
            type: 'player_info',
            payload: { id: peer.id || '', name: info.name, score: info.score }
          });

          setKnownPeers(prev => {
            const newMap = new Map(prev);
            newMap.set(conn.peer, {
              id: conn.peer,
              name: info.name,
              score: info.score,
              lastSeen: Date.now(),
              isOnline: true,
            });
            return newMap;
          });
        });

        conn.on('data', (data) => {
          handleIncomingData(conn.peer, data as PeerMessage);
        });

        conn.on('close', () => {
          console.log('[P2P] Connection closed by remote peer:', conn.peer);
          connectionsRef.current.delete(conn.peer);
          setState(prev => {
            const newPeers = new Map(prev.connectedPeers);
            newPeers.delete(conn.peer);
            return {
              ...prev,
              connectedPeers: newPeers,
              isConnected: newPeers.size > 0,
            };
          });

          setKnownPeers(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(conn.peer);
            if (existing) {
              newMap.set(conn.peer, { ...existing, isOnline: false });
            }
            return newMap;
          });
        });
      });

      peer.on('error', (err) => {
        console.error('[P2P] Peer error:', err.type, err.message);
        
        const errorType = err.type;
        
        if (errorType === 'peer-unavailable') {
          console.log('[P2P] Remote peer unavailable - player is offline');
          return;
        }
        
        console.log('[P2P] Error occurred, resetting...');
        setState(prev => ({
          ...prev,
          status: 'error',
          error: 'Error de conexión. Crea una nueva partida.',
        }));
      });

      return peer;
    };

    const peer = createPeer(initialPeerId);
    peerRef.current = peer;

    const handleBeforeUnload = () => {
      console.log('[P2P] User leaving, disconnecting...');
      peer.disconnect();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
      console.log('[P2P] Cleaning up');
      peer.disconnect();
      initializedRef.current = false;
    };
  }, [saveSession, handleIncomingData, checkPeerStatus, broadcastPlayerInfo]);

  useEffect(() => {
    if (state.status === 'connected' && state.peerId) {
      broadcastPlayerInfo();
    }
  }, [state.status, state.peerId, playerName, playerScore, broadcastPlayerInfo]);

  return (
    <P2PContext.Provider value={{
      ...state,
      connectToPeer,
      sendToPeer,
      broadcast,
      clearSession,
      removePeer,
      playerName,
      playerScore,
      knownPeers,
      chatMessages,
      sendChat,
      broadcastChat,
      clearChat,
    }}>
      {children}
    </P2PContext.Provider>
  );
};

export const useP2P = () => {
  const context = useContext(P2PContext);
  if (!context) {
    throw new Error('useP2P must be used within a P2PProvider');
  }
  return context;
};
