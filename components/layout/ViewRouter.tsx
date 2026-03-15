/**
 * ViewRouter - Enrutador de Vistas
 *
 * Maneja la renderización de las diferentes vistas del juego basándose en la pestaña activa.
 * Cada case del switch renderiza el componente correspondiente a cada sección del juego.
 */

import React, { useEffect, Suspense, lazy, useMemo, useCallback, useRef } from 'react';
import { TabType } from '../GameSidebar';
import { useGame } from '../../context/GameContext';
import { UnitType, GameState } from '../../types';

// Lazy load all views for better code splitting
const BuildingsView = lazy(() => import('../views/BuildingsView').then(m => ({ default: m.BuildingsView })));
const UnitsView = lazy(() => import('../views/UnitsView').then(m => ({ default: m.UnitsView })));
const MissionsView = lazy(() => import('../views/MissionsView').then(m => ({ default: m.MissionsView })));
const ResearchView = lazy(() => import('../views/ResearchView').then(m => ({ default: m.ResearchView })));
const FinanceView = lazy(() => import('../views/FinanceView').then(m => ({ default: m.FinanceView })));
const ReportsView = lazy(() => import('../views/ReportsView').then(m => ({ default: m.ReportsView })));
const BattleSimulatorView = lazy(() => import('../views/BattleSimulatorView').then(m => ({ default: m.BattleSimulatorView })));
const CampaignView = lazy(() => import('../views/CampaignView').then(m => ({ default: m.CampaignView })));
const MarketView = lazy(() => import('../views/MarketView').then(m => ({ default: m.MarketView })));
const RankingsView = lazy(() => import('../views/RankingsView').then(m => ({ default: m.RankingsView })));
const WarView = lazy(() => import('../views/WarView').then(m => ({ default: m.WarView })));
const SettingsView = lazy(() => import('../views/SettingsView').then(m => ({ default: m.SettingsView })));
const DiplomacyView = lazy(() => import('../views/DiplomacyView').then(m => ({ default: m.default })));
const MultiplayerChatView = lazy(() => import('../views/MultiplayerChatView').then(m => ({ default: m.MultiplayerChatView })));
const SalvageZoneView = lazy(() => import('../views/SalvageZoneView').then(m => ({ default: m.SalvageZoneView })));

const ViewLoader: React.FC = React.memo(() => (
    <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
            <span className="text-cyan-400/70 text-sm font-mono animate-pulse">CARGANDO...</span>
        </div>
    </div>
));

interface ViewRouterProps {
    activeTab: TabType;
    simEnemyArmy: Partial<Record<UnitType, number>> | null;
    simPlayerArmy: Partial<Record<UnitType, number>> | null;
    onSimulateRequest: (enemyUnits: Partial<Record<UnitType, number>>, playerUnits: Partial<Record<UnitType, number>>) => void;
}

const VIEW_COMPONENTS: Record<TabType, React.LazyExoticComponent<React.FC<any>>> = {
    buildings: BuildingsView,
    units: UnitsView,
    missions: MissionsView,
    research: ResearchView,
    finance: FinanceView,
    market: MarketView,
    reports: ReportsView,
    simulator: BattleSimulatorView,
    campaign: CampaignView,
    rankings: RankingsView,
    war: WarView,
    diplomacy: DiplomacyView,
    settings: SettingsView,
    chat: MultiplayerChatView,
    salvage: SalvageZoneView
};

// Optimización: Memoizar props por tipo de vista
const useViewProps = (
    activeTab: TabType,
    gameState: GameState,
    logs: any[],
    simEnemyArmy: Partial<Record<UnitType, number>> | null,
    simPlayerArmy: Partial<Record<UnitType, number>> | null,
    actions: any,
    onSimulateRequest: (enemyUnits: Partial<Record<UnitType, number>>, playerUnits: Partial<Record<UnitType, number>>) => void
) => {
    const actionsRef = useRef(actions);
    actionsRef.current = actions;

    return useMemo(() => {
        switch (activeTab) {
            case 'buildings':
                return { gameState, onAction: actionsRef.current.build, onSpeedUp: actionsRef.current.speedUp, onRepair: actionsRef.current.repair };
            case 'units':
                return { gameState, onAction: actionsRef.current.recruit, onSpeedUp: actionsRef.current.speedUp };
            case 'missions':
                return { gameState, onStartMission: actionsRef.current.startMission };
            case 'research':
                return { gameState, onAction: actionsRef.current.research, onSpeedUp: actionsRef.current.speedUp };
            case 'finance':
                return { gameState, onBankAction: actionsRef.current.handleBankTransaction };
            case 'market':
                return { gameState, onExecuteTrade: actionsRef.current.executeTrade, onDiamondExchange: actionsRef.current.executeDiamondExchange };
            case 'reports':
                return { logs, onDelete: actionsRef.current.deleteLogs, onArchive: actionsRef.current.archiveLogs, onSimulate: onSimulateRequest };
            case 'simulator':
                return { initialEnemyArmy: simEnemyArmy, initialPlayerArmy: simPlayerArmy };
            case 'campaign':
                return { gameState, onExecuteBattle: actionsRef.current.executeCampaignBattle, onSpeedUp: actionsRef.current.speedUp };
            case 'rankings':
                return { gameState, onAttack: (_target: any, newState: GameState) => {
                    // Si viene un newState, lo aplicamos
                    if (newState) {
                        (window as any)._updateGameState?.(newState);
                    }
                }, onUpdateState: (newState: GameState) => {
                    (window as any)._updateGameState?.(newState);
                }};
            case 'war':
                return { gameState, onSpy: actionsRef.current.spyOnAttacker, onSimulate: onSimulateRequest };
            case 'diplomacy':
                return {};
            case 'settings':
                return { gameState, changePlayerName: actionsRef.current.changePlayerName, redeemGiftCode: actionsRef.current.redeemGiftCode, resetGame: actionsRef.current.resetGame };
            case 'p2p':
                return { playerName: gameState.playerName, playerScore: gameState.empirePoints, playerFlag: gameState.playerFlag };
            case 'chat':
                return { gameState };
            case 'salvage':
                return { gameState, onStartMission: actionsRef.current.startSalvageMission };
            default:
                return {};
        }
    }, [
        activeTab,
        gameState,
        logs,
        simEnemyArmy,
        simPlayerArmy,
        onSimulateRequest
    ]);
};

export const ViewRouter: React.FC<ViewRouterProps> = React.memo(({ activeTab, simEnemyArmy, simPlayerArmy, onSimulateRequest }) => {
    const {
        gameState, logs,
        build, recruit, research, handleBankTransaction,
        startMission, startSalvageMission, executeCampaignBattle, executeTrade, executeDiamondExchange,
        speedUp, spyOnAttacker, repair,
        deleteLogs, archiveLogs, markReportsRead,
        resetGame, saveGame, exportSave, changePlayerName, redeemGiftCode
    } = useGame();

    const handleSimulate = useCallback((enemy: Partial<Record<UnitType, number>>, player: Partial<Record<UnitType, number>>) => {
        onSimulateRequest(enemy, player);
    }, [onSimulateRequest]);

    const actions = useMemo(() => ({
        build, recruit, research, handleBankTransaction,
        startMission, startSalvageMission, executeCampaignBattle, executeTrade, executeDiamondExchange,
        speedUp, spyOnAttacker, repair,
        deleteLogs, archiveLogs,
        resetGame, saveGame, exportSave, changePlayerName, redeemGiftCode
    }), [
        build, recruit, research, handleBankTransaction,
        startMission, startSalvageMission, executeCampaignBattle, executeTrade, executeDiamondExchange,
        speedUp, spyOnAttacker, repair,
        deleteLogs, archiveLogs,
        resetGame, saveGame, exportSave, changePlayerName, redeemGiftCode
    ]);

    useEffect(() => {
        if (activeTab === 'reports') markReportsRead();
    }, [activeTab, markReportsRead]);

    const viewProps = useViewProps(
        activeTab,
        gameState,
        logs,
        simEnemyArmy,
        simPlayerArmy,
        actions,
        handleSimulate
    );

    const LazyComponent = VIEW_COMPONENTS[activeTab];

    if (!LazyComponent) {
        return null;
    }

    return (
        <Suspense fallback={<ViewLoader />}>
            <LazyComponent {...viewProps} />
        </Suspense>
    );
});
