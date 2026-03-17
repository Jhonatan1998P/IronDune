import { create } from 'zustand';
import type { MultiplayerAction, PlayerPresence } from '../types/multiplayer';

export interface MultiplayerSnapshot {
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

const noop = (() => {}) as any;

const initialSnapshot: MultiplayerSnapshot = {
  isInitialized: false,
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  peers: [],
  localPlayerId: null,
  remotePlayers: [],
  syncPlayer: noop,
  syncPlayerWithData: noop,
  broadcastAction: noop,
  sendToPeer: noop,
  onRemoteAction: noop,
};

interface MultiplayerStoreState {
  snapshot: MultiplayerSnapshot;
  setSnapshot: (snapshot: MultiplayerSnapshot) => void;
}

export const useMultiplayerStore = create<MultiplayerStoreState>((set) => ({
  snapshot: initialSnapshot,
  setSnapshot: (snapshot) => set({ snapshot }),
}));

export const useMultiplayerStoreSelector = <T,>(selector: (state: MultiplayerSnapshot) => T): T => {
  return useMultiplayerStore((state) => selector(state.snapshot));
};
