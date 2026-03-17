import type { GameEngineSnapshot } from '../gameStore';

export const selectStatus = (state: GameEngineSnapshot) => state.status;
export const selectBootstrapLoadStatus = (state: GameEngineSnapshot) => state.bootstrapLoadStatus;
export const selectGameState = (state: GameEngineSnapshot) => state.gameState;
export const selectLogs = (state: GameEngineSnapshot) => state.logs;
export const selectOfflineReport = (state: GameEngineSnapshot) => state.offlineReport;
export const selectHasNewReports = (state: GameEngineSnapshot) => state.hasNewReports;

export const selectPlayerName = (state: GameEngineSnapshot) => state.gameState.playerName;
export const selectPlayerFlag = (state: GameEngineSnapshot) => state.gameState.playerFlag;
export const selectEmpirePoints = (state: GameEngineSnapshot) => state.gameState.empirePoints;
export const selectActiveWar = (state: GameEngineSnapshot) => state.gameState.activeWar;
export const selectGameResources = (state: GameEngineSnapshot) => state.gameState.resources;
export const selectGameMaxResources = (state: GameEngineSnapshot) => state.gameState.maxResources;
export const selectGameBankBalance = (state: GameEngineSnapshot) => state.gameState.bankBalance;
