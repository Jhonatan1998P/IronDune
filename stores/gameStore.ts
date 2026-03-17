import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { GameState, GameStatus, OfflineReport } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';

export interface GameStoreState {
  status: GameStatus;
  gameState: GameState;
  offlineReport: OfflineReport | null;
  hasNewReports: boolean;
  hasSave: boolean;

  clearOfflineReport: () => void;
  startNewGame: () => void;
  loadGame: () => void;
  saveGame: () => void;
  importSave: () => boolean;
  exportSave: () => void;
  resetGame: () => void;
  addP2PIncomingAttack: (...args: any[]) => void;
  addP2PMission: (...args: any[]) => void;
  applyP2PBattleResult: (...args: any[]) => void;
  receiveP2PResource: (...args: any[]) => void;
  deductLocalResource: (...args: any[]) => void;
  build: (...args: any[]) => void;
  recruit: (...args: any[]) => void;
  research: (...args: any[]) => void;
  handleBankTransaction: (...args: any[]) => void;
  startMission: (...args: any[]) => void;
  startSalvageMission: (...args: any[]) => void;
  speedUp: (...args: any[]) => void;
  executeCampaignBattle: (...args: any[]) => any;
  executeTrade: (...args: any[]) => void;
  executeDiamondExchange: (...args: any[]) => void;
  acceptTutorialStep: () => void;
  claimTutorialReward: () => void;
  toggleTutorialMinimize: () => void;
  spyOnAttacker: (...args: any[]) => void;
  changePlayerName: (...args: any[]) => any;
  repair: (...args: any[]) => void;
  sendDiplomaticGift: (...args: any[]) => any;
  proposeDiplomaticAlliance: (...args: any[]) => any;
  proposeDiplomaticPeace: (...args: any[]) => any;
  redeemGiftCode: (...args: any[]) => any;
  deleteLogs: (...args: any[]) => void;
  archiveLogs: (...args: any[]) => void;
  markReportsRead: () => void;

  _syncFromEngine: (patch: Partial<GameStoreState>) => void;
}

const noop = () => {};
const noopBool = () => false;

export const useGameStore = create<GameStoreState>()(
  subscribeWithSelector((set) => ({
    status: 'LOADING' as GameStatus,
    gameState: INITIAL_GAME_STATE,
    offlineReport: null,
    hasNewReports: false,
    hasSave: false,

    clearOfflineReport: noop,
    startNewGame: noop,
    loadGame: noop,
    saveGame: noop,
    importSave: noopBool,
    exportSave: noop,
    resetGame: noop,
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
    executeCampaignBattle: noop,
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

    _syncFromEngine: (patch) => set(patch),
  }))
);
