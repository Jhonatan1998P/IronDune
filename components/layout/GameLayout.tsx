
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
import { TerminalLogs } from '../ui/TerminalLogs';
import { ViewRouter } from './ViewRouter';

export const GameLayout: React.FC = () => {
  const { status, gameState, logs, offlineReport, clearOfflineReport } = useGame();
  
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
          <div className="h-screen w-full bg-slate-950 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black overflow-hidden">
             <MainMenu />
          </div>
      );
  }

  return (
    <div className="flex flex-col h-[100dvh] text-slate-200 selection:bg-cyan-500/30 overflow-hidden relative font-sans bg-slate-950">
      
      {/* --- DYNAMIC BACKGROUND SYSTEM --- */}
      <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#050a14] to-black"></div>
          <div className="absolute inset-0 opacity-30 animate-drift bg-grid-pattern [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>
          <div className="hidden md:block absolute inset-0 opacity-20 animate-drift-slow bg-dots-pattern"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.6)_100%)]"></div>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50"></div>
      </div>

      {/* --- UI LAYER (Z-INDEX 10+) --- */}
      <div className="relative z-10 flex flex-col h-full">
          {offlineReport && <OfflineWelcome report={offlineReport} onClose={clearOfflineReport} />}
          <TutorialOverlay gameState={gameState} activeTab={activeTab} />
          <ObjectiveTracker />
          
          {/* Floating Indicator (Mobile/Tablet Only) - Positioned below fixed header */}
          <div className="xl:hidden fixed top-24 right-4 z-40 pointer-events-none">
            <div className="pointer-events-auto">
                <ActiveAttacksIndicator />
            </div>
          </div>
          
          {/* 1. FIXED HEADER */}
          <div className="fixed top-0 left-0 right-0 z-40 md:relative md:z-30 shrink-0">
              <GameHeader onToggleStatus={() => setIsStatusPanelOpen(true)} />
          </div>

          {/* 2. MAIN SCROLLABLE AREA */}
          {/* Mobile: Padded top/bottom for fixed bars. Desktop: Full flex flow. */}
          <main className="flex-1 flex overflow-hidden relative pt-[70px] pb-[70px] md:pt-0 md:pb-0 h-full">
            
            {/* Left Panel: Navigation (Desktop Only) */}
            <GameSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* Center Panel: Content */}
            <div className="flex-1 overflow-y-auto scroll-smooth relative flex flex-col custom-scrollbar" id="main-scroll-view">
              <div className="w-full min-h-full p-4 md:p-6 flex flex-col">
                <div className="animate-[fadeIn_0.3s_ease-out] flex-1 flex flex-col min-h-0">
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
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[70px]">
              <MobileNavBar activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          <TerminalLogs logs={logs} />
      </div>
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};
