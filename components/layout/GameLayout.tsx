import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { MainMenu } from '../MainMenu';
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
  
  // State for Mobile Right Panel Drawer
  const [isStatusPanelOpen, setIsStatusPanelOpen] = useState(false);

  const handleSimulate = (enemyUnits: Partial<Record<UnitType, number>>) => {
      setSimEnemyArmy(enemyUnits);
      setActiveTab('simulator');
  };

  useEffect(() => {
      if (!gameState.activeWar && activeTab === 'war') setActiveTab('buildings');
  }, [gameState.activeWar, activeTab]);

  if (status === 'MENU') {
      return (
          <div className="h-screen w-full bg-slate-950 overflow-hidden relative font-sans transition-opacity duration-700">
             {/* Intro Background */}
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-black"></div>
             <div className="absolute inset-0 bg-grid-pattern opacity-20 animate-pulse-slow"></div>
             <div className="scanlines"></div>
             <MainMenu />
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
          {offlineReport && <OfflineWelcome report={offlineReport} onClose={clearOfflineReport} />}
          <TutorialOverlay activeTab={activeTab} gameState={gameState} />
          <ObjectiveTracker />
          <WarHUD />
          
          {/* 1. FIXED HEADER */}
          <div id="game-header" className="fixed top-0 left-0 right-0 z-40 shrink-0">
              <GameHeader onToggleStatus={() => setIsStatusPanelOpen(true)} />
          </div>

          {/* 2. MAIN SCROLLABLE AREA */}
          <main className="flex-1 flex mb-20 md:overflow-hidden pt-[70px] pb-[65px] relative md:pt-0 md:pb-0 h-full overflow-y-auto">
            
            {/* Left Panel: Navigation (Desktop Only) */}
            <GameSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* Center Panel: Content */}
            <div className="flex-1 relative flex flex-col" id="main-scroll-view">
              <div className="xl:hidden">
                  <ActiveAttacksIndicator />
              </div>
              <div className="w-full min-h-full p-3 md:p-6 flex flex-col max-w-[1920px] mx-auto">
                <div className="flex-1 flex flex-col min-h-0 pb-6">
                  <ViewRouter 
                    activeTab={activeTab} 
                    simEnemyArmy={simEnemyArmy} 
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