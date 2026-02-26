
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
import DiplomacyView from '../views/DiplomacyView';
import { GlassButton, Card } from '../UIComponents';
import { useLanguage } from '../../context/LanguageContext';

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
        resetGame, saveGame, exportSave, changePlayerName
    } = useGame();
    
    const { t, setLanguage, language } = useLanguage();
    const [newName, setNewName] = useState('');
    const [nameError, setNameError] = useState<string | null>(null);
    const [nameSuccess, setNameSuccess] = useState(false);

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
            return <DiplomacyView />;
        case 'settings':
            const handleNameChange = () => {
                setNameError(null);
                setNameSuccess(false);
                const result = changePlayerName(newName);
                if (result.success) {
                    setNameSuccess(true);
                    setNewName('');
                    setTimeout(() => setNameSuccess(false), 3000);
                } else if (result.errorKey) {
                    setNameError(result.errorKey);
                }
            };
            
            const isFreeChange = !gameState.hasChangedName;
            const nameChangeCost = isFreeChange ? 'FREE' : '💎 20';
            const canAfford = isFreeChange || gameState.resources.DIAMOND >= 20;
            
            return (
                <div className="overflow-y-auto custom-scrollbar">
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
                      
                      <div className="pb-4 border-b border-white/10">
                         <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-mono text-slate-300">{t.common.ui.commander_name}</span>
                            <div className="flex items-center gap-2">
                               <span className="text-cyan-400 font-bold">{gameState.playerName}</span>
                               {isFreeChange && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">{t.common.ui.first_change_free}</span>}
                            </div>
                         </div>
                         <div className="flex gap-2">
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => { setNewName(e.target.value); setNameError(null); }}
                                placeholder={t.common.ui.new_name_placeholder}
                                maxLength={20}
                                className="flex-1 bg-black/30 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                            />
                            <button
                                onClick={handleNameChange}
                                disabled={!newName.trim() || newName.trim() === gameState.playerName || !canAfford}
                                className={`px-3 py-2 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                                    isFreeChange 
                                        ? 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700' 
                                        : 'bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700'
                                } disabled:text-slate-500`}
                            >
                                {nameChangeCost}
                            </button>
                         </div>
                          {nameError && (
                             <p className="text-red-400 text-xs mt-2">{(t.common.ui as Record<string, string>)[nameError] || nameError}</p>
                          )}
                         {nameSuccess && (
                            <p className="text-emerald-400 text-xs mt-2">{t.common.ui.name_changed_success}</p>
                         )}
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
                </div>
            );
        default:
            return null;
    }
};
