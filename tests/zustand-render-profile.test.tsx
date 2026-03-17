import React, { Profiler } from 'react';
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { useGame } from '../context/GameContext';
import { useGameStore, useGameStoreSelector } from '../stores/gameStore';
import {
  selectActiveWar,
  selectGameState,
  selectHasNewReports,
  selectLogs,
  selectOfflineReport,
  selectStatus,
} from '../stores/selectors/gameSelectors';

type ProfileResult = {
  commits: number;
  durationMs: number;
};

const LegacyGameLayoutConsumer: React.FC = () => {
  const { status, gameState, offlineReport, clearOfflineReport } = useGame();
  return (
    <div>
      <span>{status}</span>
      <span>{gameState.playerName}</span>
      <span>{offlineReport ? '1' : '0'}</span>
      <button onClick={clearOfflineReport}>x</button>
    </div>
  );
};

const SelectorGameLayoutConsumer: React.FC = () => {
  const status = useGameStoreSelector(selectStatus);
  const gameState = useGameStoreSelector(selectGameState);
  const offlineReport = useGameStoreSelector(selectOfflineReport);
  const clearOfflineReport = useGameStoreSelector((state) => state.clearOfflineReport);
  return (
    <div>
      <span>{status}</span>
      <span>{gameState.playerName}</span>
      <span>{offlineReport ? '1' : '0'}</span>
      <button onClick={clearOfflineReport}>x</button>
    </div>
  );
};

const LegacyViewRouterConsumer: React.FC = () => {
  const {
    gameState,
    logs,
    build,
    recruit,
    research,
    handleBankTransaction,
    startMission,
    startSalvageMission,
    executeCampaignBattle,
    executeTrade,
    executeDiamondExchange,
    speedUp,
    spyOnAttacker,
    repair,
    deleteLogs,
    archiveLogs,
    markReportsRead,
    resetGame,
    saveGame,
    exportSave,
    changePlayerName,
    redeemGiftCode,
  } = useGame();

  return (
    <div>
      {gameState.playerName}
      {logs.length}
      {String(!!build && !!recruit && !!research && !!handleBankTransaction && !!startMission && !!startSalvageMission)}
      {String(!!executeCampaignBattle && !!executeTrade && !!executeDiamondExchange && !!speedUp && !!spyOnAttacker && !!repair)}
      {String(!!deleteLogs && !!archiveLogs && !!markReportsRead && !!resetGame && !!saveGame && !!exportSave)}
      {String(!!changePlayerName && !!redeemGiftCode)}
    </div>
  );
};

const SelectorViewRouterConsumer: React.FC = () => {
  const gameState = useGameStoreSelector(selectGameState);
  const logs = useGameStoreSelector(selectLogs);
  const build = useGameStoreSelector((state) => state.build);
  const recruit = useGameStoreSelector((state) => state.recruit);
  const research = useGameStoreSelector((state) => state.research);
  const handleBankTransaction = useGameStoreSelector((state) => state.handleBankTransaction);
  const startMission = useGameStoreSelector((state) => state.startMission);
  const startSalvageMission = useGameStoreSelector((state) => state.startSalvageMission);
  const executeCampaignBattle = useGameStoreSelector((state) => state.executeCampaignBattle);
  const executeTrade = useGameStoreSelector((state) => state.executeTrade);
  const executeDiamondExchange = useGameStoreSelector((state) => state.executeDiamondExchange);
  const speedUp = useGameStoreSelector((state) => state.speedUp);
  const spyOnAttacker = useGameStoreSelector((state) => state.spyOnAttacker);
  const repair = useGameStoreSelector((state) => state.repair);
  const deleteLogs = useGameStoreSelector((state) => state.deleteLogs);
  const archiveLogs = useGameStoreSelector((state) => state.archiveLogs);
  const markReportsRead = useGameStoreSelector((state) => state.markReportsRead);
  const resetGame = useGameStoreSelector((state) => state.resetGame);
  const saveGame = useGameStoreSelector((state) => state.saveGame);
  const exportSave = useGameStoreSelector((state) => state.exportSave);
  const changePlayerName = useGameStoreSelector((state) => state.changePlayerName);
  const redeemGiftCode = useGameStoreSelector((state) => state.redeemGiftCode);

  return (
    <div>
      {gameState.playerName}
      {logs.length}
      {String(!!build && !!recruit && !!research && !!handleBankTransaction && !!startMission && !!startSalvageMission)}
      {String(!!executeCampaignBattle && !!executeTrade && !!executeDiamondExchange && !!speedUp && !!spyOnAttacker && !!repair)}
      {String(!!deleteLogs && !!archiveLogs && !!markReportsRead && !!resetGame && !!saveGame && !!exportSave)}
      {String(!!changePlayerName && !!redeemGiftCode)}
    </div>
  );
};

const LegacyGameHeaderConsumer: React.FC = () => {
  const { gameState } = useGame();
  return <div>{gameState.playerName}</div>;
};

const SelectorGameHeaderConsumer: React.FC = () => {
  const gameState = useGameStoreSelector(selectGameState);
  return <div>{gameState.playerName}</div>;
};

const LegacyGameSidebarConsumer: React.FC = () => {
  const { hasNewReports, gameState } = useGame();
  return <div>{String(hasNewReports)}-{String(!!gameState.activeWar)}</div>;
};

const SelectorGameSidebarConsumer: React.FC = () => {
  const hasNewReports = useGameStoreSelector(selectHasNewReports);
  const activeWar = useGameStoreSelector(selectActiveWar);
  return <div>{String(hasNewReports)}-{String(!!activeWar)}</div>;
};

const runProfile = async (
  Consumer: React.FC,
  mutateSnapshot: (i: number) => void,
  iterations: number
): Promise<ProfileResult> => {
  let commits = 0;
  let durationMs = 0;

  const { unmount } = render(
    <Profiler
      id="profile"
      onRender={(_id, _phase, actualDuration) => {
        commits += 1;
        durationMs += actualDuration;
      }}
    >
      <Consumer />
    </Profiler>
  );

  for (let i = 0; i < iterations; i += 1) {
    await act(async () => {
      mutateSnapshot(i);
    });
  }

  unmount();
  return { commits, durationMs };
};

describe('Zustand render profile', () => {
  it('reduces renders for critical views when updates are unrelated', async () => {
    const base = useGameStore.getState().snapshot;
    const iterations = 120;

    const runCase = async (legacy: React.FC, selector: React.FC, mutate: (i: number) => void) => {
      useGameStore.getState().setSnapshot(base);
      const legacyResult = await runProfile(legacy, mutate, iterations);

      useGameStore.getState().setSnapshot(base);
      const selectorResult = await runProfile(selector, mutate, iterations);

      return { legacyResult, selectorResult };
    };

    const mutateUnrelatedStatus = (i: number) => {
      const snapshot = useGameStore.getState().snapshot;
      useGameStore.getState().setSnapshot({
        ...snapshot,
        hasSave: i % 2 === 0,
      });
    };

    const layout = await runCase(LegacyGameLayoutConsumer, SelectorGameLayoutConsumer, mutateUnrelatedStatus);
    const router = await runCase(LegacyViewRouterConsumer, SelectorViewRouterConsumer, mutateUnrelatedStatus);
    const header = await runCase(LegacyGameHeaderConsumer, SelectorGameHeaderConsumer, mutateUnrelatedStatus);
    const sidebar = await runCase(LegacyGameSidebarConsumer, SelectorGameSidebarConsumer, mutateUnrelatedStatus);

    expect(layout.selectorResult.commits).toBeLessThan(layout.legacyResult.commits);
    expect(router.selectorResult.commits).toBeLessThan(router.legacyResult.commits);
    expect(header.selectorResult.commits).toBeLessThan(header.legacyResult.commits);
    expect(sidebar.selectorResult.commits).toBeLessThan(sidebar.legacyResult.commits);

    console.log('\n[render-profile] iterations:', iterations);
    console.log('[render-profile] GameLayout legacy vs selector:', layout.legacyResult, layout.selectorResult);
    console.log('[render-profile] ViewRouter legacy vs selector:', router.legacyResult, router.selectorResult);
    console.log('[render-profile] GameHeader legacy vs selector:', header.legacyResult, header.selectorResult);
    console.log('[render-profile] GameSidebar legacy vs selector:', sidebar.legacyResult, sidebar.selectorResult);
  });
});
