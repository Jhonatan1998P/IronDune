/**
 * ViewRouter - Enrutador de Vistas
 * 
 * Maneja la renderización de las diferentes vistas del juego basándose en la pestaña activa.
 * Cada case del switch renderiza el componente correspondiente a cada sección del juego.
 */

import React, { useEffect } from 'react';
import { TabType } from '../GameSidebar';
import { useGame } from '../../context/GameContext';
import { UnitType } from '../../types';
import { 
    BuildingsView, 
    UnitsView, 
    MissionsView, 
    ResearchView, 
    FinanceView, 
    ReportsView, 
    BattleSimulatorView, 
    CampaignView, 
    MarketView, 
    RankingsView, 
    WarView,
    SettingsView
} from '../GameViews';
import DiplomacyView from '../views/DiplomacyView';

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
    /* ============================================
       VISTA DE INFORMES (REPORTS)
       Muestra los registros/logs del juego
       Permite eliminar, archivar y simular ataques
       ============================================ */
        case 'reports':
            return <ReportsView logs={logs} onDelete={deleteLogs} onArchive={archiveLogs} onSimulate={onSimulateRequest} />;
        
        /* ============================================
       VISTA DEL SIMULADOR DE BATALLA
       Permite simular batallas contra un ejército enemigo
       ============================================ */
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
    /* ============================================
       VISTA DE CONFIGURACIÓN (SETTINGS)
       ============================================ */
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
