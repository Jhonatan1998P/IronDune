
import React, { useState, useMemo, useEffect } from 'react';
import { TECH_DEFS } from '../../data/techs';
import { BUILDING_DEFS } from '../../data/buildings';
import { BuildingType, GameState, ResourceType, TechCategory, TechDef } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { Card, GlassButton, Icons, CostDisplay } from '../UIComponents';
import { GameTooltip } from '../GameTooltip';
import { formatDuration, formatNumber } from '../../utils';
import { calculateResearchCost } from '../../utils/formulas';
import { TUTORIAL_STEPS } from '../../data/tutorial';

interface ViewProps {
  gameState: GameState;
  onAction: (id: any) => void;
  onSpeedUp: (targetId: string, type: 'BUILD' | 'RECRUIT' | 'RESEARCH' | 'MISSION') => void;
}

const getTechComplexityScore = (def: TechDef): number => {
    let score = 0;
    score += def.reqUniversityLevel * 1000000;
    if (def.reqBuildings) {
        Object.values(def.reqBuildings).forEach(lvl => score += lvl * 10000);
    }
    score += def.cost.money;
    return score;
};

export const ResearchView: React.FC<ViewProps> = ({ gameState, onAction, onSpeedUp }) => {
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<TechCategory | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);

  useEffect(() => {
    const handleResize = () => {
        if (window.innerWidth >= 1280) setItemsPerPage(12); // XL Screens
        else if (window.innerWidth >= 1024) setItemsPerPage(9); // Desktop
        else if (window.innerWidth >= 640) setItemsPerPage(6); // Tablets
        else setItemsPerPage(6); // Mobile (scrolling vertically is fine)
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
      setCurrentPage(1);
  }, [activeCategory]);

  const categories = [
    { id: 'ALL', label: t.common.ui.all },
    { id: TechCategory.MILITARY_GROUND, label: t.common.categories[TechCategory.MILITARY_GROUND] },
    { id: TechCategory.MILITARY_MECH, label: t.common.categories[TechCategory.MILITARY_MECH] },
    { id: TechCategory.MILITARY_NAVAL, label: t.common.categories[TechCategory.MILITARY_NAVAL] },
    { id: TechCategory.MILITARY_AIR, label: t.common.categories[TechCategory.MILITARY_AIR] },
    { id: TechCategory.LOGISTICS, label: t.common.categories[TechCategory.LOGISTICS] },
    { id: TechCategory.PRODUCTIVE, label: t.common.categories[TechCategory.PRODUCTIVE] },
  ];

  const { processedTechs, categoryProgress } = useMemo(() => {
      const allTechs = Object.values(TECH_DEFS);
      
      const progressMap: Record<string, { total: number, unlocked: number }> = {};
      
      allTechs.forEach(tech => {
          if (!progressMap[tech.category]) progressMap[tech.category] = { total: 0, unlocked: 0 };
          progressMap[tech.category].total++;
          if (gameState.researchedTechs.includes(tech.id)) {
              progressMap[tech.category].unlocked++;
          }
      });

      let filtered = allTechs.filter(tech => 
        activeCategory === 'ALL' || tech.category === activeCategory
      );

      filtered.sort((a, b) => {
          const aActive = gameState.activeResearch?.techId === a.id;
          const bActive = gameState.activeResearch?.techId === b.id;
          if (aActive && !bActive) return -1;
          if (!aActive && bActive) return 1;
          return getTechComplexityScore(a) - getTechComplexityScore(b);
      });

      return { processedTechs: filtered, categoryProgress: progressMap };
  }, [gameState.researchedTechs, gameState.activeResearch, activeCategory]);

  const totalPages = Math.ceil(processedTechs.length / itemsPerPage);
  const paginatedTechs = processedTechs.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  );

  // --- TUTORIAL NAVIGATION LOGIC ---
  const activeTutorialStep = TUTORIAL_STEPS.find(s => s.id === gameState.currentTutorialId);
  let hijackNextButtonId: string | undefined = undefined;
  let hijackPrevButtonId: string | undefined = undefined;

  if (activeTutorialStep && activeTutorialStep.targetElementId) {
      // Find the tech related to this button ID in the CURRENTLY FILTERED list
      // If the tech is not in the current category, this won't work (which is correct behavior as user should switch category)
      // Ideally, tutorial steps should force 'ALL' category or handle category switching, but for pagination:
      const targetTechIndex = processedTechs.findIndex(t => `btn-research-${t.id}` === activeTutorialStep.targetElementId);
      
      if (targetTechIndex !== -1) {
          const targetPage = Math.floor(targetTechIndex / itemsPerPage) + 1;
          
          if (targetPage > currentPage) {
              hijackNextButtonId = activeTutorialStep.targetElementId;
          } else if (targetPage < currentPage) {
              hijackPrevButtonId = activeTutorialStep.targetElementId;
          }
      }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      
      {/* Fixed Top Section: Categories */}
      <div className="shrink-0 space-y-4 mb-2 pb-2 border-b border-white/5">
          {/* Category Tabs - Scrollable */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mask-image-sides touch-pan-x items-stretch">
            {categories.map(cat => {
              const prog = categoryProgress[cat.id];
              const percent = prog ? (prog.unlocked / prog.total) * 100 : 0;
              
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as any)}
                  className={`
                    relative min-h-[44px] px-4 rounded-lg text-[10px] md:text-xs font-tech uppercase tracking-wider border transition-all flex flex-col items-center justify-center gap-1 shrink-0 w-auto
                    ${activeCategory === cat.id 
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                      : 'bg-slate-800/50 border-white/5 text-slate-500 hover:text-slate-300 active:bg-white/5'}
                  `}
                >
                  <span className="relative z-10 whitespace-nowrap text-center leading-tight">{cat.label}</span>
                  {cat.id !== 'ALL' && (
                      <div className="w-full h-0.5 bg-black/50 rounded-full overflow-hidden mt-1">
                          <div className={`h-full ${activeCategory === cat.id ? 'bg-cyan-400' : 'bg-slate-600'}`} style={{ width: `${percent}%` }}></div>
                      </div>
                  )}
                </button>
              );
            })}
          </div>
      </div>

      {/* Scrollable Tech Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pb-24 pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {paginatedTechs.map(def => {
                const info = t.techs[def.translationKey] || { name: def.id, description: 'Loading...' };
                const isResearched = gameState.researchedTechs.includes(def.id);
                const isBeingResearched = gameState.activeResearch?.techId === def.id;
                
                const currentLevel = gameState.techLevels?.[def.id] || 0;
                const maxLevel = def.maxLevel || 1;
                const isMaxed = currentLevel >= maxLevel;

                const universityLvl = gameState.buildings[BuildingType.UNIVERSITY].level;
                const universityMet = universityLvl >= def.reqUniversityLevel;
                const universityName = t.buildings[BUILDING_DEFS[BuildingType.UNIVERSITY].translationKey]?.name;
                
                const reqList = [{ label: `${universityName} Lv.${def.reqUniversityLevel}`, met: universityMet }];

                if (def.reqBuildings) {
                    Object.entries(def.reqBuildings).forEach(([bType, lvl]) => {
                        const bDef = BUILDING_DEFS[bType as BuildingType];
                        const bName = bDef && t.buildings[bDef.translationKey] ? t.buildings[bDef.translationKey].name : bType;
                        const met = gameState.buildings[bType as BuildingType].level >= (lvl as number);
                        reqList.push({ label: `${bName} Lv.${lvl}`, met });
                    });
                }
                if (def.reqTechs) {
                    def.reqTechs.forEach(tId => {
                        const tDef = TECH_DEFS[tId];
                        const tName = tDef && t.techs[tDef.translationKey] ? t.techs[tDef.translationKey].name : t.common.ui.unknown_tech;
                        const met = gameState.researchedTechs.includes(tId);
                        reqList.push({ label: tName, met });
                    });
                }

                const locked = reqList.some(r => !r.met);
                const busy = gameState.activeResearch !== null;
                
                // Use centralized formula
                const calculatedCost = calculateResearchCost(def, currentLevel);

                const canAfford = 
                    calculatedCost.money <= gameState.resources[ResourceType.MONEY] &&
                    calculatedCost.oil <= gameState.resources[ResourceType.OIL] &&
                    calculatedCost.ammo <= gameState.resources[ResourceType.AMMO];

                const showAsResearched = (maxLevel === 1 && isResearched) || isMaxed;

                const tooltipContent = (
                    <GameTooltip 
                        title={info.name}
                        description={info.description}
                        cost={!showAsResearched ? calculatedCost : undefined}
                        resources={gameState.resources}
                        requirements={!showAsResearched ? reqList : undefined}
                        stats={[
                            { label: t.common.stats.research_time, value: formatDuration(def.researchTime), color: 'text-blue-300' },
                            ...(maxLevel > 1 ? [{ label: t.common.ui.level, value: `${currentLevel} / ${maxLevel}`, color: 'text-purple-400' }] : [])
                        ]}
                        footer={showAsResearched ? t.common.ui.tech_acquired : locked ? t.common.ui.req_not_met : undefined}
                    />
                );

                const titleNode = (
                    <div className="flex items-start gap-2 w-full">
                        <span className="flex-1 leading-tight text-sm font-bold truncate">{info.name}</span>
                        <div className="flex gap-1 shrink-0 pt-0.5">
                            {showAsResearched && <div className="text-emerald-500 bg-black/50 rounded-full p-0.5"><Icons.Crown /></div>}
                            {locked && !isResearched && <div className="text-red-500/80 bg-black/50 rounded-full p-0.5"><Icons.Lock /></div>}
                            {isBeingResearched && <div className="animate-spin text-cyan-400"><Icons.Science /></div>}
                        </div>
                    </div>
                );

                return (
                    <Card 
                        key={def.id} 
                        title={titleNode} 
                        className={`
                            transition-all duration-300 flex flex-col min-h-0 relative overflow-hidden
                            ${showAsResearched ? 'border-emerald-500/30 bg-emerald-900/10' : ''} 
                            ${isBeingResearched ? 'border-cyan-500/50 bg-cyan-900/10 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : ''} 
                            ${locked && !isResearched ? 'opacity-70 border-slate-700 bg-slate-900/50 grayscale-[0.3]' : ''}
                        `}
                        tooltip={tooltipContent}
                    >
                        <div className="flex-1 flex flex-col justify-between gap-3">
                            <div>
                                {maxLevel > 1 && (
                                    <div className="inline-block px-1.5 py-0.5 rounded bg-purple-900/30 border border-purple-500/20 text-[9px] font-mono font-bold text-purple-400 mb-1.5">
                                        LVL {currentLevel}/{maxLevel}
                                    </div>
                                )}
                                <p className="text-[10px] sm:text-xs text-slate-400 leading-snug mb-2 line-clamp-2">
                                    {info.description}
                                </p>
                                
                                {!showAsResearched && (
                                    <div className="flex flex-col gap-2 mt-auto">
                                        <div className="flex items-center gap-1 text-[9px] text-slate-400 bg-black/30 w-max px-2 py-1 rounded border border-white/5">
                                            <Icons.Clock className="w-3 h-3" />
                                            {formatDuration(def.researchTime)}
                                        </div>
                                        
                                        <div className="bg-black/20 p-1.5 rounded border border-white/5">
                                            <CostDisplay cost={calculatedCost} currentResources={gameState.resources} t={t} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <GlassButton 
                                id={`btn-research-${def.id}`}
                                onClick={() => onAction(def.id)}
                                variant={showAsResearched ? 'neutral' : (isBeingResearched ? 'primary' : 'primary')}
                                disabled={showAsResearched || locked || !canAfford || (busy && !isBeingResearched) || isBeingResearched}
                                className={`w-full text-xs font-bold tracking-wider ${showAsResearched ? 'text-emerald-400 border-emerald-500/30' : ''}`}
                            >
                                {showAsResearched ? t.common.actions.researched : 
                                    isBeingResearched ? t.common.actions.researching : 
                                    locked ? t.common.ui.status_locked : 
                                    (maxLevel > 1 && currentLevel > 0 ? t.common.actions.upgrade : t.common.actions.research)}
                            </GlassButton>
                        </div>
                    </Card>
                );
            })}
        </div>

        {/* Fixed Bottom Pagination */}
        {totalPages > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-6 z-20 pointer-events-none pb-20 md:pb-0">
                <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md rounded-full px-4 py-2 border border-white/10 shadow-lg flex items-center gap-4">
                    <button 
                        id={hijackPrevButtonId}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 transition-all active:scale-95 active:bg-cyan-500/20"
                    >
                        <Icons.ChevronLeft />
                    </button>
                    
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">{t.common.ui.page}</span>
                        <span className="text-sm font-mono font-bold text-cyan-400">{currentPage} <span className="text-slate-600">/ {totalPages}</span></span>
                    </div>

                    <button 
                        id={hijackNextButtonId}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 transition-all active:scale-95 active:bg-cyan-500/20"
                    >
                        <Icons.ChevronRight />
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
