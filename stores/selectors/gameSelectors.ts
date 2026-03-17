import { GameStoreState } from '../gameStore';
import { GameState, ResourceType } from '../../types';

export const selectStatus = (s: GameStoreState) => s.status;
export const selectGameState = (s: GameStoreState) => s.gameState;
export const selectOfflineReport = (s: GameStoreState) => s.offlineReport;
export const selectHasNewReports = (s: GameStoreState) => s.hasNewReports;
export const selectHasSave = (s: GameStoreState) => s.hasSave;
export const selectLogs = (s: GameStoreState) => s.gameState.logs;

export const selectResources = (s: GameStoreState) => s.gameState.resources;
export const selectMaxResources = (s: GameStoreState) => s.gameState.maxResources;
export const selectBuildings = (s: GameStoreState) => s.gameState.buildings;
export const selectUnits = (s: GameStoreState) => s.gameState.units;
export const selectEmpirePoints = (s: GameStoreState) => s.gameState.empirePoints;
export const selectPlayerName = (s: GameStoreState) => s.gameState.playerName;
export const selectPlayerFlag = (s: GameStoreState) => s.gameState.playerFlag;
export const selectActiveWar = (s: GameStoreState) => s.gameState.activeWar;
export const selectActiveConstructions = (s: GameStoreState) => s.gameState.activeConstructions;
export const selectActiveRecruitments = (s: GameStoreState) => s.gameState.activeRecruitments;
export const selectActiveResearch = (s: GameStoreState) => s.gameState.activeResearch;
export const selectActiveMissions = (s: GameStoreState) => s.gameState.activeMissions;
export const selectIncomingAttacks = (s: GameStoreState) => s.gameState.incomingAttacks;
export const selectNextAttackTime = (s: GameStoreState) => s.gameState.nextAttackTime;
export const selectResearchedTechs = (s: GameStoreState) => s.gameState.researchedTechs;
export const selectTechLevels = (s: GameStoreState) => s.gameState.techLevels;
export const selectBankBalance = (s: GameStoreState) => s.gameState.bankBalance;
export const selectRankingData = (s: GameStoreState) => s.gameState.rankingData;
export const selectCampaign = (s: GameStoreState) => s.gameState.campaign;

export const selectResource = (resource: ResourceType) =>
  (s: GameStoreState) => s.gameState.resources[resource];

export const selectGameActions = (s: GameStoreState) => ({
  clearOfflineReport: s.clearOfflineReport,
  startNewGame: s.startNewGame,
  loadGame: s.loadGame,
  saveGame: s.saveGame,
  importSave: s.importSave,
  exportSave: s.exportSave,
  resetGame: s.resetGame,
  addP2PIncomingAttack: s.addP2PIncomingAttack,
  addP2PMission: s.addP2PMission,
  applyP2PBattleResult: s.applyP2PBattleResult,
  receiveP2PResource: s.receiveP2PResource,
  deductLocalResource: s.deductLocalResource,
  build: s.build,
  recruit: s.recruit,
  research: s.research,
  handleBankTransaction: s.handleBankTransaction,
  startMission: s.startMission,
  startSalvageMission: s.startSalvageMission,
  speedUp: s.speedUp,
  executeCampaignBattle: s.executeCampaignBattle,
  executeTrade: s.executeTrade,
  executeDiamondExchange: s.executeDiamondExchange,
  acceptTutorialStep: s.acceptTutorialStep,
  claimTutorialReward: s.claimTutorialReward,
  toggleTutorialMinimize: s.toggleTutorialMinimize,
  spyOnAttacker: s.spyOnAttacker,
  changePlayerName: s.changePlayerName,
  repair: s.repair,
  sendDiplomaticGift: s.sendDiplomaticGift,
  proposeDiplomaticAlliance: s.proposeDiplomaticAlliance,
  proposeDiplomaticPeace: s.proposeDiplomaticPeace,
  redeemGiftCode: s.redeemGiftCode,
  deleteLogs: s.deleteLogs,
  archiveLogs: s.archiveLogs,
  markReportsRead: s.markReportsRead,
});
