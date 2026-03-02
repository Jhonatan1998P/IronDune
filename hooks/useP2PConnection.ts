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
        reject(new Error('Peer not initialized'));
        return;
      }

      const conn = peer.connect(remotePeerId, {
        reliable: true,
        serialization: 'json',
      });

      const timeout = setTimeout(() => {
        conn.close();
        reject(new Error('Connection timeout'));
      }, 10000);

      conn.on('open', () => {
        clearTimeout(timeout);
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
        window.dispatchEvent(new CustomEvent('p2p-message', { 
          detail: { from: remotePeerId, ...data as PeerMessage } 
        }));
      });

      conn.on('close', () => {
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
        reject(err);
      });
    });
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const peer = new Peer({
      debug: 0,
    });

    peer.on('open', (id) => {
      setState(prev => ({
        ...prev,
        peerId: id,
        status: 'connected',
      }));
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
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
        window.dispatchEvent(new CustomEvent('p2p-message', { 
          detail: { from: conn.peer, ...data as PeerMessage } 
        }));
      });

      conn.on('close', () => {
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
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err.message,
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
