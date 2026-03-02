import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';

export type PeerMessage = 
  | { type: 'challenge'; payload: { from: string; score: number } }
  | { type: 'accept'; payload: { army: Record<string, number> } }
  | { type: 'attack'; payload: { army: Record<string, number> } }
  | { type: 'result'; payload: { winner: 'PLAYER' | 'ENEMY'; army: Record<string, number> } }
  | { type: 'score_update'; payload: { score: number } }
  | { type: 'player_info'; payload: { id: string; name: string; score: number } }
  | { type: 'sync_state'; payload: { gameState: any } }
  | { type: 'request_sync'; payload: { requestId: string } }
  | { type: 'heartbeat'; payload: { timestamp: number } };

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

interface P2PContextType extends P2PState {
  connectToPeer: (remotePeerId: string) => Promise<DataConnection>;
  sendToPeer: (peerId: string, message: PeerMessage) => boolean;
  broadcast: (message: PeerMessage) => void;
  clearSession: () => void;
  playerName: string;
  playerScore: number;
  knownPeers: Map<string, PeerInfo>;
}

const P2PContext = createContext<P2PContextType | null>(null);

const STORAGE_KEY = 'p2p_session';
const ACCOUNT_ID_KEY = 'p2p_account_id';
const HEARTBEAT_INTERVAL = 10000;
const PEER_TIMEOUT = 30000;

const generateAccountId = (): string => {
  const stored = localStorage.getItem(ACCOUNT_ID_KEY);
  if (stored) return stored;
  
  const newId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  localStorage.setItem(ACCOUNT_ID_KEY, newId);
  return newId;
};

interface StoredSession {
  peerId: string;
  remotePeerId: string;
  timestamp: number;
}

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
  
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const initializedRef = useRef(false);
  const playerInfoRef = useRef({ name: playerName, score: playerScore });
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReconnectingRef = useRef(false);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accountIdRef = useRef(generateAccountId());
  const pendingConnectionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    playerInfoRef.current = { name: playerName, score: playerScore };
  }, [playerName, playerScore]);

  const saveSession = useCallback((remotePeerId: string) => {
    const peerId = peerRef.current?.id;
    if (!peerId || !remotePeerId) return;
    
    const session: StoredSession = {
      peerId,
      remotePeerId,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, []);

  const loadSession = useCallback((): StoredSession | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      
      const session: StoredSession = JSON.parse(stored);
      if (Date.now() - session.timestamp > 30 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
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
    
    window.dispatchEvent(new CustomEvent('p2p-message', { 
      detail: { from, ...data } 
    }));
  }, [updateKnownPeer]);

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

      if (pendingConnectionsRef.current.has(remotePeerId)) {
        reject(new Error('Already connecting to this peer.'));
        return;
      }

      console.log('[P2P] Attempting to connect to:', remotePeerId);
      pendingConnectionsRef.current.add(remotePeerId);

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      const conn = peer.connect(remotePeerId, {
        reliable: true,
        serialization: 'json',
      });

      const timeout = setTimeout(() => {
        pendingConnectionsRef.current.delete(remotePeerId);
        conn.close();
        console.log('[P2P] Connection timeout');
        reject(new Error('Connection timeout. Make sure the other player is online and in the Battle lobby.'));
      }, 15000);

      conn.on('open', () => {
        clearTimeout(timeout);
        pendingConnectionsRef.current.delete(remotePeerId);
        console.log('[P2P] Connection established!');
        connectionsRef.current.set(remotePeerId, conn);
        saveSession(remotePeerId);
        
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
        console.log('[P2P] Connection closed');
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
  }, [saveSession, handleIncomingData]);

  const attemptReconnect = useCallback(async () => {
    const session = loadSession();
    if (!session || isReconnectingRef.current) return;
    
    isReconnectingRef.current = true;
    console.log('[P2P] Attempting to reconnect...');
    
    try {
      await connectToPeer(session.remotePeerId);
      console.log('[P2P] Reconnected successfully!');
    } catch (err) {
      console.log('[P2P] Reconnection failed, will retry...');
      reconnectTimerRef.current = setTimeout(() => {
        isReconnectingRef.current = false;
      }, 5000);
    }
  }, [loadSession, connectToPeer]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    console.log('[P2P] Initializing PeerJS...');

    const peer = new Peer(accountIdRef.current, {
      debug: 1,
    });

    peer.on('open', (id) => {
      console.log('[P2P] My peer ID:', id);
      setState(prev => ({
        ...prev,
        peerId: id,
        status: 'connected',
      }));

      const session = loadSession();
      if (session) {
        console.log('[P2P] Found previous session, attempting reconnect...');
        setTimeout(() => attemptReconnect(), 1000);
      }

      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
      heartbeatTimerRef.current = setInterval(() => {
        broadcast({
          type: 'heartbeat',
          payload: { timestamp: Date.now() }
        });
        checkPeerStatus();
        broadcastPlayerInfo();
      }, HEARTBEAT_INTERVAL);
    });

    peer.on('connection', (conn) => {
      console.log('[P2P] Incoming connection from:', conn.peer);
      
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
        console.log('[P2P] Incoming connection closed');
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

    peer.on('disconnected', () => {
      console.log('[P2P] Peer disconnected, attempting to reconnect...');
      setState(prev => ({ ...prev, status: 'connecting' }));
      peer.reconnect();
    });

    peer.on('error', (err) => {
      console.error('[P2P] Peer error:', err);
      let errorMsg = 'Connection error';
      
      const errorType = err.type;
      if (errorType === 'peer-unavailable' || errorType === 'unavailable-id') {
        if (err.message?.includes('ID')) {
          errorMsg = 'Player not found. Check the ID and try again.';
        } else {
          errorMsg = 'Your account ID is already in use. Clear your browser data or wait a moment.';
        }
      } else if (errorType === 'server-error') {
        errorMsg = 'Server error. Try again in a few seconds.';
      } else if (errorType === 'network' || errorType === 'socket-error' || errorType === 'socket-closed') {
        errorMsg = 'Network error. Check your internet connection.';
      } else if (errorType === 'webrtc') {
        errorMsg = 'WebRTC not supported in this browser.';
      } else if (errorType === 'browser-incompatible') {
        errorMsg = 'Browser not compatible with P2P.';
      } else {
        errorMsg = err.message || 'Unknown error';
      }
      
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMsg,
      }));
    });

    peerRef.current = peer;

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      peer.destroy();
      initializedRef.current = false;
    };
  }, [loadSession, attemptReconnect, saveSession, handleIncomingData, checkPeerStatus, broadcastPlayerInfo]);

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
      playerName,
      playerScore,
      knownPeers,
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
