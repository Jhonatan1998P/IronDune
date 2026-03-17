import React, { useEffect, useRef } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { useGameStore } from '../stores/gameStore';

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const engine = useGameEngine();
  const sync = useGameStore((s) => s._syncFromEngine);
  const engineRef = useRef(engine);
  engineRef.current = engine;

  useEffect(() => {
    sync({
      status: engine.status,
      gameState: engine.gameState,
      offlineReport: engine.offlineReport,
      hasNewReports: engine.hasNewReports,
      hasSave: engine.hasSave,
      clearOfflineReport: engine.clearOfflineReport,
      startNewGame: engine.startNewGame,
      loadGame: engine.loadGame,
      saveGame: engine.saveGame,
      importSave: engine.importSave,
      exportSave: engine.exportSave,
      resetGame: engine.resetGame,
      addP2PIncomingAttack: engine.addP2PIncomingAttack,
      addP2PMission: engine.addP2PMission,
      applyP2PBattleResult: engine.applyP2PBattleResult,
      receiveP2PResource: engine.receiveP2PResource,
      deductLocalResource: engine.deductLocalResource,
      build: engine.build,
      recruit: engine.recruit,
      research: engine.research,
      handleBankTransaction: engine.handleBankTransaction,
      startMission: engine.startMission,
      startSalvageMission: engine.startSalvageMission,
      speedUp: engine.speedUp,
      executeCampaignBattle: engine.executeCampaignBattle,
      executeTrade: engine.executeTrade,
      executeDiamondExchange: engine.executeDiamondExchange,
      acceptTutorialStep: engine.acceptTutorialStep,
      claimTutorialReward: engine.claimTutorialReward,
      toggleTutorialMinimize: engine.toggleTutorialMinimize,
      spyOnAttacker: engine.spyOnAttacker,
      changePlayerName: engine.changePlayerName,
      repair: engine.repair,
      sendDiplomaticGift: engine.sendDiplomaticGift,
      proposeDiplomaticAlliance: engine.proposeDiplomaticAlliance,
      proposeDiplomaticPeace: engine.proposeDiplomaticPeace,
      redeemGiftCode: engine.redeemGiftCode,
      deleteLogs: engine.deleteLogs,
      archiveLogs: engine.archiveLogs,
      markReportsRead: engine.markReportsRead,
    });
  });

  return <>{children}</>;
};

export const useGame = () => {
  const store = useGameStore();
  return {
    status: store.status,
    gameState: store.gameState,
    logs: store.gameState.logs,
    hasSave: store.hasSave,
    offlineReport: store.offlineReport,
    hasNewReports: store.hasNewReports,
    clearOfflineReport: store.clearOfflineReport,
    startNewGame: store.startNewGame,
    loadGame: store.loadGame,
    saveGame: store.saveGame,
    importSave: store.importSave,
    exportSave: store.exportSave,
    resetGame: store.resetGame,
    addP2PIncomingAttack: store.addP2PIncomingAttack,
    addP2PMission: store.addP2PMission,
    applyP2PBattleResult: store.applyP2PBattleResult,
    receiveP2PResource: store.receiveP2PResource,
    deductLocalResource: store.deductLocalResource,
    build: store.build,
    recruit: store.recruit,
    research: store.research,
    handleBankTransaction: store.handleBankTransaction,
    startMission: store.startMission,
    startSalvageMission: store.startSalvageMission,
    speedUp: store.speedUp,
    executeCampaignBattle: store.executeCampaignBattle,
    executeTrade: store.executeTrade,
    executeDiamondExchange: store.executeDiamondExchange,
    acceptTutorialStep: store.acceptTutorialStep,
    claimTutorialReward: store.claimTutorialReward,
    toggleTutorialMinimize: store.toggleTutorialMinimize,
    spyOnAttacker: store.spyOnAttacker,
    changePlayerName: store.changePlayerName,
    repair: store.repair,
    sendDiplomaticGift: store.sendDiplomaticGift,
    proposeDiplomaticAlliance: store.proposeDiplomaticAlliance,
    proposeDiplomaticPeace: store.proposeDiplomaticPeace,
    redeemGiftCode: store.redeemGiftCode,
    deleteLogs: store.deleteLogs,
    archiveLogs: store.archiveLogs,
    markReportsRead: store.markReportsRead,
  };
};
