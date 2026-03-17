import { create } from 'zustand';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { useGameEngine } from '../hooks/useGameEngine';

export type GameEngineSnapshot = ReturnType<typeof useGameEngine>;

const noop = (() => {}) as any;
const noopAsync = (async () => {}) as any;

const initialSnapshot: GameEngineSnapshot = {
  status: 'LOADING',
  gameState: INITIAL_GAME_STATE,
  logs: INITIAL_GAME_STATE.logs,
  hasSave: false,
  offlineReport: null,
  hasNewReports: false,
  clearOfflineReport: noop,
  startNewGame: noopAsync,
  loadGame: noop,
  saveGame: noopAsync,
  importSave: (() => false) as any,
  exportSave: noop,
  resetGame: noopAsync,
  addP2PIncomingAttack: noop,
  addP2PMission: noop,
  applyP2PBattleResult: noop,
  receiveP2PResource: noop,
  deductLocalResource: noop,
  build: noop,
  recruit: noop,
  research: noop,
  handleBankTransaction: noop,
  startMission: noop,
  startSalvageMission: noop,
  speedUp: noop,
  executeCampaignBattle: (() => null) as any,
  executeTrade: noop,
  executeDiamondExchange: noop,
  acceptTutorialStep: noop,
  claimTutorialReward: noop,
  toggleTutorialMinimize: noop,
  spyOnAttacker: noop,
  changePlayerName: noop,
  repair: noop,
  sendDiplomaticGift: noop,
  proposeDiplomaticAlliance: noop,
  proposeDiplomaticPeace: noop,
  redeemGiftCode: noop,
  deleteLogs: noop,
  archiveLogs: noop,
  markReportsRead: noop,
};

interface GameStoreState {
  snapshot: GameEngineSnapshot;
  setSnapshot: (snapshotOrUpdater: GameEngineSnapshot | ((prev: GameEngineSnapshot) => GameEngineSnapshot)) => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  snapshot: initialSnapshot,
  setSnapshot: (snapshotOrUpdater) => set((state) => ({
    snapshot: typeof snapshotOrUpdater === 'function'
      ? (snapshotOrUpdater as (prev: GameEngineSnapshot) => GameEngineSnapshot)(state.snapshot)
      : snapshotOrUpdater,
  })),
}));

export const useGameStoreSelector = <T,>(selector: (state: GameEngineSnapshot) => T): T => {
  return useGameStore((state) => selector(state.snapshot));
};
