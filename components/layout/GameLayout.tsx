import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useMultiplayerSync } from '../../hooks/useMultiplayer';
import { useP2PGameSync } from '../../hooks/useP2PGameSync';
import { useP2PBattleResolver } from '../../hooks/useP2PBattleResolver';
import { OfflineWelcome } from '../OfflineWelcome';
import { UnitType } from '../../types';

import { GameHeader } from '../GameHeader';
import { GameSidebar, TabType, MobileNavBar } from '../GameSidebar';
import { RightStatusPanel } from '../RightStatusPanel';
import { TutorialOverlay } from '../TutorialOverlay';
import { ObjectiveTracker } from '../ObjectiveTracker';
import { ActiveAttacksIndicator } from '../ActiveAttacksIndicator';
import { ViewRouter } from './ViewRouter';
import { WarHUD } from '../WarHUD';

export const GameLayout: React.FC = () => {
  const { status, gameState, offlineReport, clearOfflineReport } = useGame();

  const [activeTab, setActiveTab] = useState<TabType>('buildings');
  const [simEnemyArmy, setSimEnemyArmy] = useState<Partial<Record<UnitType, number>> | null>(null);
  const [simPlayerArmy, setSimPlayerArmy] = useState<Partial<Record<UnitType, number>> | null>(null);

  // State for Mobile Right Panel Drawer
  const [isStatusPanelOpen, setIsStatusPanelOpen] = useState(false);

  // Debug: Log cuando GameLayout se monta
  useEffect(() => {
    console.log('[GameLayout] Mounted, status:', status, 'playerName:', gameState.playerName, 'empirePoints:', gameState.empirePoints);
    return () => {
      console.log('[GameLayout] Unmounting');
    };
  }, []);

  // Auto-sync jugador con el sistema multijugador
  useMultiplayerSync({
    playerName: gameState.playerName,
    playerFlag: gameState.playerFlag,
    empirePoints: gameState.empirePoints,
    enabled: status === 'PLAYING',
  });

  // Sink para ataques P2P asincrónicos (defensor)
  useP2PGameSync();

  // Resolver batallas P2P cuando llega endTime (atacante)
  useP2PBattleResolver();

  const handleSimulate = (enemyUnits: Partial<Record<UnitType, number>>, playerUnits: Partial<Record<UnitType, number>>) => {
      setSimEnemyArmy(enemyUnits);
      setSimPlayerArmy(playerUnits);
      setActiveTab('simulator');
  };

  useEffect(() => {
      if (!gameState.activeWar && activeTab === 'war') setActiveTab('buildings');
  }, [gameState.activeWar, activeTab]);

  if (status === 'LOADING') {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center font-tech p-4 text-center">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-t-4 border-cyan-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 bg-cyan-500/20 rounded-full animate-pulse"></div>
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-cyan-400 text-xl font-bold tracking-[0.2em] uppercase animate-pulse">
            Sincronizando Comandos
          </h2>
          <div className="flex items-center gap-2 justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce"></div>
          </div>
        </div>
        <div className="mt-12 text-[10px] text-slate-700 font-mono tracking-[0.3em] uppercase">
          Enlace Satelital Nvl. 4 // Calibrando Telemetría
        </div>
      </div>
    );
  }

  if (status === 'MENU') {
      return (
          <div className="h-screen w-full bg-slate-950 flex items-center justify-center font-tech">
             <div className="text-cyan-500 animate-pulse tracking-[0.3em] uppercase">
                Synchronizing Command Center...
             </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-[100dvh] text-slate-200 selection:bg-cyan-500/30 overflow-hidden relative font-sans bg-[#020617] animate-in fade-in duration-1000">
      
      {/* --- ATMOSPHERIC LAYERS --- */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {/* Deep Space Gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0f172a] via-[#020617] to-black"></div>
          
          {/* Tactical Grid */}
          <div className="absolute inset-0 opacity-10 animate-drift bg-grid-pattern [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>
          
          {/* Floating Particles/Dots */}
          <div className="hidden md:block absolute inset-0 opacity-20 animate-drift-slow bg-dots-pattern"></div>
          
          {/* CRT Scanlines & Vignette */}
          <div className="scanlines opacity-20"></div>
          <div className="vignette"></div>
          
          {/* Top Glow Line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50 shadow-[0_0_20px_rgba(6,182,212,0.5)]"></div>
      </div>

      {/* --- UI LAYER (Z-INDEX 10+) --- */}
      <div className="relative z-10 flex flex-col h-full">
          {offlineReport && <OfflineWelcome report={offlineReport} gameState={gameState} onClose={clearOfflineReport} />}
          <TutorialOverlay activeTab={activeTab} gameState={gameState} />
          <ObjectiveTracker />
          <WarHUD />
          
          {/* 1. FIXED HEADER */}
          <div id="game-header" className="fixed top-0 left-0 right-0 z-40 shrink-0">
              <GameHeader onToggleStatus={() => setIsStatusPanelOpen(true)} />
          </div>

          {/* 2. MAIN SCROLLABLE AREA */}
            <main className="flex-1 flex overflow-y-auto overflow-x-hidden mb-20 pt-[70px] pb-[65px] md:pt-0 md:pb-0">
            
            {/* Left Panel: Navigation (Desktop Only) */}
            <GameSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* Center Panel: Content */}
            <div className="flex-1 relative flex flex-col" id="main-scroll-view">
              <div className="xl:hidden">
                  <ActiveAttacksIndicator />
              </div>
              <div className={`w-full min-h-full flex flex-col max-w-[1920px] mx-auto ${activeTab === 'chat' ? 'p-0' : 'p-3 md:p-6'}`}>
                <div className={`flex-1 flex flex-col min-h-0 ${activeTab === 'chat' ? 'pb-0' : 'pb-6'}`}>
                  <ViewRouter 
                    activeTab={activeTab} 
                    simEnemyArmy={simEnemyArmy}
                    simPlayerArmy={simPlayerArmy}
                    onSimulateRequest={handleSimulate} 
                  />
                </div>
              </div>
            </div>

            {/* Right Panel: Status (Desktop: Static / Mobile: Drawer) */}
            <RightStatusPanel isOpen={isStatusPanelOpen} onClose={() => setIsStatusPanelOpen(false)} />
          </main>

          {/* 3. FIXED BOTTOM NAVBAR (Mobile Only) */}
          <div id="mobile-navbar" className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[70px]">
              <MobileNavBar activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
      </div>
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};