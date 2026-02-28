/**
 * ViewRouter - Enrutador de Vistas
 * 
 * Maneja la renderización de las diferentes vistas del juego basándose en la pestaña activa.
 * Cada case del switch renderiza el componente correspondiente a cada sección del juego.
 */

import React, { useEffect, Suspense, lazy } from 'react';
import { TabType } from '../GameSidebar';
import { useGame } from '../../context/GameContext';
import { UnitType } from '../../types';

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

// Loading fallback component
const ViewLoader: React.FC = () => (
    <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
            <span className="text-cyan-400/70 text-sm font-mono animate-pulse">CARGANDO...</span>
        </div>
    </div>
);

/**
 * ViewRouterProps
 * Interfaz de propiedades del componente ViewRouter
 */
interface ViewRouterProps {
    activeTab: TabType;                                                 // Pestaña activa actualmente
    simEnemyArmy: Partial<Record<UnitType, number>> | null;           // Ejército enemigo para simulación
    onSimulateRequest: (enemyUnits: Partial<Record<UnitType, number>>) => void; // Función para solicitar simulación
}

/**
 * Componente principal de enrutamiento de vistas
 * Renderiza la vista correspondiente según la pestaña activa
 */
export const ViewRouter: React.FC<ViewRouterProps> = ({ activeTab, simEnemyArmy, onSimulateRequest }) => {
    const {
        gameState, logs,
        build, recruit, research, handleBankTransaction,
        startMission, executeCampaignBattle, executeTrade, executeDiamondExchange,
        speedUp, spyOnAttacker, repair,
        deleteLogs, archiveLogs, markReportsRead,
        resetGame, saveGame, exportSave, changePlayerName, redeemGiftCode
    } = useGame();
    
    // Effect to mark reports read when tab is opened
    useEffect(() => {
        if (activeTab === 'reports') markReportsRead();
    }, [activeTab, markReportsRead]);

    const renderView = () => {
        switch (activeTab) {
            case 'buildings':
                return <BuildingsView gameState={gameState} onAction={build} onSpeedUp={speedUp} onRepair={repair} />;
            case 'units':
                return <UnitsView gameState={gameState} onAction={recruit} onSpeedUp={speedUp} />;
            case 'missions':
                return <MissionsView gameState={gameState} onStartMission={startMission} />;
            case 'research':
                return <ResearchView gameState={gameState} onAction={research} onSpeedUp={speedUp} />;
            case 'finance':
                return <FinanceView gameState={gameState} onBankAction={handleBankTransaction} />;
            case 'market':
                return <MarketView gameState={gameState} onExecuteTrade={executeTrade} onDiamondExchange={executeDiamondExchange} />;
            case 'reports':
                return <ReportsView logs={logs} onDelete={deleteLogs} onArchive={archiveLogs} onSimulate={onSimulateRequest} />;
            case 'simulator':
                return <BattleSimulatorView initialEnemyArmy={simEnemyArmy} />;
            case 'campaign':
                return <CampaignView gameState={gameState} onExecuteBattle={executeCampaignBattle} onSpeedUp={speedUp} />;
            case 'rankings':
                return <RankingsView gameState={gameState} onAttack={(_, newState) => (window as any)._updateGameState?.(newState)} />;
            case 'war':
                return <WarView gameState={gameState} onSpy={spyOnAttacker} onSimulate={onSimulateRequest} />;
            case 'diplomacy':
                return <DiplomacyView />;
            case 'settings':
                return (
                    <SettingsView 
                        gameState={gameState}
                        changePlayerName={changePlayerName}
                        redeemGiftCode={redeemGiftCode}
                        saveGame={saveGame}
                        resetGame={resetGame}
                        exportSave={exportSave}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <Suspense fallback={<ViewLoader />}>
            {renderView()}
        </Suspense>
    );
};
