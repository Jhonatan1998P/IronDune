import React, { useState, useEffect } from 'react';
import { Icons } from './UIComponents';
import { useLanguage } from '../context/LanguageContext';
import { useGame } from '../context/GameContext';

export type TabType = 'buildings' | 'units' | 'missions' | 'research' | 'finance' | 'settings' | 'reports' | 'simulator' | 'campaign' | 'market' | 'rankings' | 'war' | 'diplomacy';

interface GameSidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

// Inline Icons for specific needs
const NavIcons = {
    Map: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Finance: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Market: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    Simulator: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    Diplomacy: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
};

export const GameSidebar: React.FC<GameSidebarProps> = ({ activeTab, setActiveTab }) => {
  const { t } = useLanguage();
  const { hasNewReports, gameState } = useGame();

  const hasActiveWar = !!gameState.activeWar;

  // Configuration for Desktop Groups
  const navGroups = [
      {
          title: t.common.ui.base_command,
          items: [
              { id: 'buildings' as TabType, label: t.common.actions.construct, icon: Icons.Base },
              { id: 'research' as TabType, label: t.common.ui.nav_research, icon: Icons.Science },
              { id: 'finance' as TabType, label: t.common.ui.nav_economy, icon: NavIcons.Finance },
          ]
      },
      {
          title: t.common.ui.operations,
          items: [
              { id: 'units' as TabType, label: t.common.actions.recruit, icon: Icons.Army },
              { id: 'campaign' as TabType, label: t.common.ui.nav_campaign, icon: NavIcons.Map },
              { id: 'missions' as TabType, label: t.missions.patrol.title.split(' ')[0], icon: Icons.Radar },
              { id: 'market' as TabType, label: t.common.ui.nav_market, icon: NavIcons.Market },
          ]
      },
      {
          title: t.common.ui.intelligence,
          items: [
              { id: 'reports' as TabType, label: t.common.ui.nav_reports, icon: Icons.Report },
              { id: 'rankings' as TabType, label: t.features.rankings.title.split(' ')[0], icon: Icons.Crown },
              { id: 'diplomacy' as TabType, label: t.common.ui.diplomacy || 'Diplomacy', icon: NavIcons.Diplomacy },
              { id: 'simulator' as TabType, label: t.common.ui.nav_simulator, icon: NavIcons.Simulator },
          ]
      }
  ];

  return (
    <nav className="hidden md:flex w-64 border-r border-white/10 flex-col shrink-0 z-20 h-full bg-slate-900/60 backdrop-blur-2xl shadow-[5px_0_30px_rgba(0,0,0,0.3)]">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          
          {hasActiveWar && (
              <div className="animate-[fadeIn_0.5s_ease-out]">
                  <div className="text-[10px] text-red-500 font-bold uppercase tracking-widest mb-2 px-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                      Active Conflict
                  </div>
                  <button
                    id="tab-war"
                    onClick={() => setActiveTab('war')}
                    className={`
                      w-full px-4 py-3 rounded-lg flex items-center gap-3 transition-all group relative overflow-hidden border
                      ${activeTab === 'war' 
                        ? 'bg-red-900/30 border-red-500/50 text-red-400 shadow-[inset_0_0_20px_rgba(220,38,38,0.2)]' 
                        : 'bg-red-950/20 text-red-500 hover:text-red-300 hover:bg-red-900/20 border-red-900/30'}
                    `}
                  >
                    <div className="animate-pulse"><Icons.Army /></div>
                    <span className="uppercase font-tech text-xs font-bold tracking-widest relative z-10 flex-1 text-left">
                      {t.common.war.title}
                    </span>
                  </button>
              </div>
          )}

          {navGroups.map((group, groupIdx) => (
              <div key={groupIdx}>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 px-2">{group.title}</div>
                  <div className="space-y-1">
                      {group.items.map(item => (
                        <button
                          key={item.id}
                          id={`tab-${item.id}`} 
                          onClick={() => setActiveTab(item.id)}
                          className={`
                            w-full px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all group relative overflow-hidden
                            ${activeTab === item.id 
                              ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 shadow-[inset_0_0_15px_rgba(6,182,212,0.1)]' 
                              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'}
                          `}
                        >
                          <item.icon />
                          <span className="uppercase font-tech text-xs font-bold tracking-widest relative z-10 text-left flex-1">
                            {item.label}
                          </span>
                          
                          {item.id === 'reports' && hasNewReports && (
                              <span className="flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                              </span>
                          )}

                          {activeTab === item.id && <div className="absolute left-0 top-0 h-full w-0.5 bg-cyan-500 shadow-[0_0_10px_#06b6d4]"></div>}
                        </button>
                      ))}
                  </div>
              </div>
          ))}

          <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 px-2">{t.common.ui.system}</div>
              <button
                  id="tab-settings" 
                  onClick={() => setActiveTab('settings')}
                  className={`
                    w-full px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all group relative overflow-hidden
                    ${activeTab === 'settings' 
                      ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'}
                  `}
                >
                  <Icons.Settings />
                  <span className="uppercase font-tech text-xs font-bold tracking-widest relative z-10 text-left">
                    {t.common.ui.settings}
                  </span>
              </button>
          </div>
        </div>
        
        <div className="p-4 border-t border-white/10 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-2 text-[10px] text-emerald-500/80 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              SYS.ONLINE // v1.3.0
          </div>
        </div>
    </nav>
  );
};

export const MobileNavBar: React.FC<{ activeTab: TabType; setActiveTab: (t: TabType) => void }> = ({ activeTab, setActiveTab }) => {
    const { t } = useLanguage();
    const { hasNewReports, gameState } = useGame();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Track fullscreen status
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    // Primary Tabs (Fixed Bottom Bar)
    const primaryItems = [
        { id: 'buildings' as TabType, icon: Icons.Base, label: t.common.ui.nav_base },
        { id: 'units' as TabType, icon: Icons.Army, label: t.common.ui.nav_army },
        { id: 'diplomacy' as TabType, icon: NavIcons.Diplomacy, label: t.common.ui.diplomacy || 'Diplomacy' },
        { id: 'reports' as TabType, icon: Icons.Report, label: t.common.ui.nav_intel },
    ];

    // Secondary Tabs (Bottom Sheet)
    const secondaryItems = [
        { id: 'missions' as TabType, icon: Icons.Radar, label: t.missions.patrol.title.split(' ')[0] },
        { id: 'campaign' as TabType, icon: NavIcons.Map, label: t.common.ui.nav_map },
        { id: 'war' as TabType, icon: Icons.Army, label: t.common.war.title, activeOnly: !!gameState.activeWar, color: 'text-red-500' },
        { id: 'market' as TabType, icon: NavIcons.Market, label: t.common.ui.nav_market },
        { id: 'finance' as TabType, icon: NavIcons.Finance, label: t.common.ui.nav_economy },
        { id: 'research' as TabType, icon: Icons.Science, label: t.common.ui.nav_research },
        { id: 'rankings' as TabType, icon: Icons.Crown, label: t.features.rankings.title.split(' ')[0] },
        { id: 'simulator' as TabType, icon: NavIcons.Simulator, label: t.common.ui.nav_simulator },
        { id: 'settings' as TabType, icon: Icons.Settings, label: t.common.ui.settings },
    ];

    const handleTabSelect = (tab: TabType) => {
        setActiveTab(tab);
        setIsMenuOpen(false);
    };

    return (
        <>
            {/* BOTTOM SHEET MENU */}
            <div className={`
                fixed inset-0 z-[45] bg-black/60 backdrop-blur-sm transition-opacity duration-300
                ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
            `} onClick={() => setIsMenuOpen(false)}></div>

            <div className={`
                fixed bottom-[70px] left-0 right-0 z-[46] bg-slate-900/95 border-t border-white/10 rounded-t-2xl p-4 transition-transform duration-300 ease-out transform shadow-[0_-10px_40px_rgba(0,0,0,0.5)]
                ${isMenuOpen ? 'translate-y-0' : 'translate-y-[120%]'}
            `}>
                <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-4"></div>
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                    {/* Render standard tabs */}
                    {secondaryItems.map(item => {
                        if (item.activeOnly === false) return null;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleTabSelect(item.id)}
                                className={`
                                    flex flex-col items-center justify-center p-2 rounded-xl border transition-all aspect-square
                                    ${activeTab === item.id 
                                        ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300' 
                                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}
                                `}
                            >
                                <div className={`mb-1 ${item.color || ''} shrink-0`}>
                                    <item.icon />
                                </div>
                                <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-tight text-center leading-tight w-full truncate px-0.5">
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}

                    {/* Manual Render for Fullscreen Toggle */}
                    <button
                        onClick={toggleFullscreen}
                        className={`
                            flex flex-col items-center justify-center p-2 rounded-xl border transition-all aspect-square
                            ${isFullscreen 
                                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                                : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}
                        `}
                    >
                        <div className="mb-1 shrink-0">
                            <Icons.Maximize />
                        </div>
                        <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-tight text-center leading-tight w-full truncate px-0.5">
                            {isFullscreen ? t.common.ui.fs_off : t.common.ui.fs_on}
                        </span>
                    </button>
                </div>
            </div>

            {/* MAIN NAVBAR */}
            <nav className="w-full h-full glass-panel border-t border-white/10 bg-slate-950/95 backdrop-blur-xl flex justify-around items-center px-1 pb-safe shadow-[0_-5px_30px_rgba(0,0,0,0.5)] relative z-50">
                {primaryItems.map(item => {
                    const isActive = activeTab === item.id || (item.id === 'campaign' && activeTab === 'missions'); // Slight heuristic for Map
                    return (
                        <button
                            key={item.id}
                            id={`mobile-tab-${item.id}`}
                            onClick={() => handleTabSelect(item.id)}
                            className={`flex flex-col items-center justify-center p-1 rounded-lg transition-all duration-200 relative group flex-1 h-full min-w-0 ${isActive ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {isActive && (
                                <div className="absolute top-0 w-8 h-0.5 bg-cyan-500 shadow-[0_0_10px_#06b6d4]"></div>
                            )}
                            
                            <div className={`transition-transform duration-300 ${isActive ? '-translate-y-1' : ''} mb-0.5 shrink-0`}>
                                <item.icon />
                            </div>
                            
                            <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-tight text-center w-full truncate px-0.5 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                                {item.label}
                            </span>

                            {item.id === 'reports' && hasNewReports && (
                                <span className="absolute top-3 right-[28%] h-2 w-2 rounded-full bg-red-500 shadow-[0_0_5px_#ef4444] animate-pulse"></span>
                            )}
                        </button>
                    )
                })}

                {/* MENU TRIGGER */}
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className={`flex flex-col items-center justify-center p-1 rounded-lg transition-all duration-200 relative group flex-1 h-full min-w-0 ${isMenuOpen ? 'text-white' : 'text-slate-500'}`}
                >
                    <div className={`transition-transform duration-300 ${isMenuOpen ? 'rotate-90 scale-110' : ''} mb-0.5 shrink-0`}>
                        <Icons.Menu />
                    </div>
                    <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-tight text-center w-full truncate px-0.5 ${isMenuOpen ? 'opacity-100' : 'opacity-60'}`}>
                        {t.common.actions.menu}
                    </span>
                </button>
            </nav>
        </>
    );
};