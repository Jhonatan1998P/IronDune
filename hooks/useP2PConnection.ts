import { useState, useEffect, useCallback, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';

export type PeerMessage = 
  | { type: 'challenge'; payload: { from: string; score: number } }
  | { type: 'accept'; payload: { army: Record<string, number> } }
  | { type: 'attack'; payload: { army: Record<string, number> } }
  | { type: 'result'; payload: { winner: 'PLAYER' | 'ENEMY'; army: Record<string, number> } }
  | { type: 'score_update'; payload: { score: number } }
  | { type: 'player_info'; payload: { id: string; name: string; score: number } };

export interface P2PState {
  peerId: string | null;
  isConnected: boolean;
  connectedPeers: Map<string, DataConnection>;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: string | null;
}

export function useP2PConnection(playerName: string, playerScore: number) {
  const [state, setState] = useState<P2PState>({
    peerId: null,
    isConnected: false,
    connectedPeers: new Map(),
    status: 'disconnected',
    error: null,
  });
  
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const initializedRef = useRef(false);
  const playerInfoRef = useRef({ name: playerName, score: playerScore });

  useEffect(() => {
    playerInfoRef.current = { name: playerName, score: playerScore };
  }, [playerName, playerScore]);

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

  const connectToPeer = useCallback((remotePeerId: string): Promise<DataConnection> => {
    return new Promise((resolve, reject) => {
      const peer = peerRef.current;
      if (!peer) {
        reject(new Error('Peer not initialized. Please refresh the page.'));
        return;
      }

      console.log('[P2P] Attempting to connect to:', remotePeerId);

      const conn = peer.connect(remotePeerId, {
        reliable: true,
        serialization: 'json',
      });

      const timeout = setTimeout(() => {
        conn.close();
        console.log('[P2P] Connection timeout');
        reject(new Error('Connection timeout. Make sure the other player is online and in the Battle lobby.'));
      }, 15000);

      conn.on('open', () => {
        clearTimeout(timeout);
        console.log('[P2P] Connection established!');
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
        resolve(conn);
      });

      conn.on('data', (data) => {
        console.log('[P2P] Received data from', remotePeerId);
        window.dispatchEvent(new CustomEvent('p2p-message', { 
          detail: { from: remotePeerId, ...data as PeerMessage } 
        }));
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
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[P2P] Connection error:', err);
        reject(err);
      });
    });
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    console.log('[P2P] Initializing PeerJS...');

    const peer = new Peer({
      debug: 1,
    });

    peer.on('open', (id) => {
      console.log('[P2P] My peer ID:', id);
      setState(prev => ({
        ...prev,
        peerId: id,
        status: 'connected',
      }));
    });

    peer.on('connection', (conn) => {
      console.log('[P2P] Incoming connection from:', conn.peer);
      
      conn.on('open', () => {
        console.log('[P2P] Incoming connection established!');
        connectionsRef.current.set(conn.peer, conn);
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
      });

      conn.on('data', (data) => {
        console.log('[P2P] Received data from incoming:', conn.peer);
        window.dispatchEvent(new CustomEvent('p2p-message', { 
          detail: { from: conn.peer, ...data as PeerMessage } 
        }));
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
      });
    });

    peer.on('error', (err) => {
      console.error('[P2P] Peer error:', err);
      let errorMsg = 'Connection error';
      
      const errorType = err.type;
      if (errorType === 'peer-unavailable' || errorType === 'unavailable-id') {
        errorMsg = 'Player not found. Check the ID and try again.';
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
      peer.destroy();
      initializedRef.current = false;
    };
  }, []);

  return {
    ...state,
    connectToPeer,
    sendToPeer,
    broadcast,
  };
}
