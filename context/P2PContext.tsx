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
  idTakenCountdown: number | null;
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

const getStoredPeerId = (): string | null => {
  return localStorage.getItem('p2p_peer_id');
};

const savePeerId = (id: string): void => {
  localStorage.setItem('p2p_peer_id', id);
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
  const [idTakenCountdown, setIdTakenCountdown] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<Map<string, ChatMessage[]>>(new Map());
  
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const initializedRef = useRef(false);
  const playerInfoRef = useRef({ name: playerName, score: playerScore });
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReconnectingRef = useRef(false);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingConnectionsRef = useRef<Set<string>>(new Set());
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 3;
  const COUNTDOWN_SECONDS = 75;
  
  const idRetryPhaseRef = useRef<'initial' | 'retry5s' | 'retry75s' | 'newId'>('initial');
  const originalPeerIdRef = useRef<string | null>(null);
  
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

    const storedId = getStoredPeerId();
    let initialPeerId = storedId || generateShortId('dune', 6);
    
    if (!storedId) {
      savePeerId(initialPeerId);
    }
    
    originalPeerIdRef.current = initialPeerId;
    idRetryPhaseRef.current = 'initial';

    console.log('[P2P] Initializing PeerJS with ID:', initialPeerId);

    const createPeer = (peerId: string) => {
      console.log('[P2P] Creating peer with ID:', peerId);
      const peer = new Peer(peerId, {
        debug: 1,
      });

      peer.on('open', (id) => {
        console.log('[P2P] My peer ID:', id);
        reconnectAttemptsRef.current = 0;
        idRetryPhaseRef.current = 'initial';
        setIdTakenCountdown(null);
        setState(prev => ({
          ...prev,
          peerId: id,
          status: 'connected',
          error: null,
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
        console.log('[P2P] Peer disconnected, attempt:', reconnectAttemptsRef.current + 1);
        
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          console.log('[P2P] Max reconnect attempts reached');
          setState(prev => ({ 
            ...prev, 
            status: 'error', 
            error: 'No se pudo reconectar. Recarga la página para intentar de nuevo.' 
          }));
          return;
        }
        
        reconnectAttemptsRef.current += 1;
        setState(prev => ({ 
          ...prev, 
          status: 'connecting', 
          error: `Reconectando... (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})` 
        }));
        
        setTimeout(() => {
          peer.reconnect();
        }, 3000);
      });

      peer.on('error', (err) => {
        console.error('[P2P] Peer error:', err);
        
        const errorType = err.type;
        
        if (errorType === 'unavailable-id') {
          handleIdTaken(peer);
          return;
        }
        
        if (errorType === 'network' || errorType === 'socket-error' || errorType === 'socket-closed') {
          console.log('[P2P] Network error, attempt:', reconnectAttemptsRef.current + 1);
          
          if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.log('[P2P] Max network error attempts reached');
            setState(prev => ({ 
              ...prev, 
              status: 'error', 
              error: 'Conexión inestable. Recarga la página para intentar de nuevo.' 
            }));
            return;
          }
          
          reconnectAttemptsRef.current += 1;
          setState(prev => ({ 
            ...prev, 
            status: 'connecting', 
            error: `Conexión perdida. Reconectando... (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})` 
          }));
          
          setTimeout(() => peer.reconnect(), 3000);
          return;
        }
        
        let errorMsg = 'Connection error';
        if (errorType === 'peer-unavailable') {
          errorMsg = 'Player not found. Check the ID and try again.';
        } else if (errorType === 'server-error') {
          errorMsg = 'Server error. Try again in a few seconds.';
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

      return peer;
    };

    const handleIdTaken = (currentPeer: Peer) => {
      const phase = idRetryPhaseRef.current;
      
      console.log(`[P2P] ID taken, current phase: ${phase}`);
      
      if (phase === 'initial') {
        console.log('[P2P] Phase 1: Waiting 5s then retry with same ID');
        idRetryPhaseRef.current = 'retry5s';
        setState(prev => ({ ...prev, status: 'connecting', error: 'ID en uso. Reintentando en 5s...' }));
        
        setTimeout(() => {
          console.log('[P2P] Retrying with same ID after 5s...');
          currentPeer.reconnect();
        }, 5000);
        return;
      }
      
      if (phase === 'retry5s') {
        console.log('[P2P] Phase 2: Disconnecting and waiting 75s then retry');
        idRetryPhaseRef.current = 'retry75s';
        
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        
        currentPeer.disconnect();
        
        let remaining = COUNTDOWN_SECONDS;
        setIdTakenCountdown(remaining);
        setState(prev => ({ ...prev, status: 'connecting', error: `ID en uso. Esperando ${remaining}s...` }));
        
        countdownIntervalRef.current = setInterval(() => {
          remaining -= 1;
          setIdTakenCountdown(remaining);
          
          if (remaining <= 0) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            
            console.log('[P2P] Retrying with same ID after 75s wait...');
            setIdTakenCountdown(null);
            setState(prev => ({ ...prev, error: 'Reconectando...' }));
            currentPeer.reconnect();
          }
        }, 1000);
        return;
      }
      
      if (phase === 'retry75s') {
        console.log('[P2P] Phase 3: All retries failed, generating new ID');
        idRetryPhaseRef.current = 'newId';
        
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        
        const newPeerId = generateShortId('dune', 6);
        originalPeerIdRef.current = newPeerId;
        savePeerId(newPeerId);
        setIdTakenCountdown(null);
        
        console.log('[P2P] Generated new ID:', newPeerId);
        setState(prev => ({ ...prev, error: 'Generando nuevo ID...' }));
        
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        return;
      }
    };

    const peer = createPeer(initialPeerId);
    peerRef.current = peer;

    const handleBeforeUnload = () => {
      console.log('[P2P] User leaving, disconnecting gracefully...');
      peer.disconnect();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      peer.disconnect();
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
      removePeer,
      playerName,
      playerScore,
      knownPeers,
      idTakenCountdown,
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
