
import React, { useState, useEffect } from 'react';
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
    WarView
} from '../GameViews';
import { GlassButton, Card } from '../UIComponents';
import { useLanguage } from '../../context/LanguageContext';
import { DiplomacyPanel } from '../Diplomacy/DiplomacyPanel';
import { FactionPanel } from '../Factions/FactionPanel';
import { IntelPanel } from '../Intelligence/IntelPanel';

interface ViewRouterProps {
    activeTab: TabType;
    simEnemyArmy: Partial<Record<UnitType, number>> | null;
    onSimulateRequest: (enemyUnits: Partial<Record<UnitType, number>>) => void;
}

export const ViewRouter: React.FC<ViewRouterProps> = ({ activeTab, simEnemyArmy, onSimulateRequest }) => {
    const { 
        gameState, logs, 
        build, recruit, research, handleBankTransaction, 
        startMission, executeCampaignBattle, executeTrade, executeDiamondExchange,
        speedUp, spyOnAttacker, 
        deleteLogs, archiveLogs, markReportsRead,
        resetGame, saveGame, exportSave 
    } = useGame();
    
    const { t, setLanguage, language } = useLanguage();

    // Effect to mark reports read when tab is opened
    useEffect(() => {
        if (activeTab === 'reports') markReportsRead();
    }, [activeTab, markReportsRead]);

    switch (activeTab) {
        case 'buildings':
            return <BuildingsView gameState={gameState} onAction={build} onSpeedUp={speedUp} />;
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
            return <DiplomacyPanel isOpen={true} onClose={() => {}} />;
        case 'factions':
            return <FactionPanel isOpen={true} onClose={() => {}} />;
        case 'intelligence':
            return <IntelPanel isOpen={true} onClose={() => {}} />;
        case 'settings':
            return (
                <Card title={t.common.ui.settings} className="max-w-md mx-auto mt-4">
                   <div className="space-y-6">
                      <div className="flex justify-between items-center pb-4 border-b border-white/10">
                         <span className="text-sm font-mono text-slate-300">{t.common.ui.language}</span>
                         <div className="flex gap-2 bg-black/20 p-1 rounded-lg">
                            {(['en', 'es'] as const).map((lang) => (
                               <button key={lang} onClick={() => setLanguage(lang)} className={`px-3 py-1 rounded text-xs font-bold transition-all ${language === lang ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{lang.toUpperCase()}</button>
                            ))}
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <GlassButton onClick={exportSave} className="text-xs">{t.common.menu.export_save}</GlassButton>
                          <GlassButton onClick={saveGame} variant="neutral" className="text-xs border-emerald-500/30 text-emerald-400 bg-emerald-900/20">{t.common.menu.save_exit}</GlassButton>
                      </div>
                      <div className="pt-2 border-t border-white/10">
                         <p className="text-xs text-slate-500 mb-3 uppercase tracking-widest text-center">{t.common.ui.reset_confirm}</p>
                         <GlassButton onClick={resetGame} variant="danger" className="w-full">{t.common.ui.reset}</GlassButton>
                      </div>
                   </div>
                </Card>
            );
        default:
            return null;
    }
};
