
import React, { useState, useEffect, useMemo } from 'react';
import { BUILDING_DEFS } from '../../data/buildings';
import { GameState, ResourceType, BuildingType, BuildingDef, TranslationDictionary } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { Card, GlassButton, CostDisplay, QuantitySelector, Icons } from '../UIComponents';
import { GameTooltip } from '../GameTooltip';
import { formatDuration } from '../../utils';
import { calculateConstructionCost, calculateConstructionTime, calculateMaxAffordableBuildings } from '../../utils/formulas';
import { TUTORIAL_STEPS } from '../../data/tutorial';

interface ViewProps {
  gameState: GameState;
  onAction: (id: BuildingType, amount: number) => void;
  onSpeedUp: (targetId: string, type: 'BUILD' | 'RECRUIT' | 'RESEARCH' | 'MISSION') => void;
}

// --- SUB-COMPONENT: BUILDING CARD ---
const BuildingCard: React.FC<{ def: BuildingDef, gameState: GameState, onAction: (id: BuildingType, amount: number) => void, t: TranslationDictionary }> = ({ def, gameState, onAction, t }) => {
    const qty = gameState.buildings[def.id]?.level || 0;
    const [buildAmount, setBuildAmount] = useState(1);
    
    // Calculate queued quantity for effective level calculation
    const queuedQty = gameState.activeConstructions
        .filter(c => c.buildingType === def.id)
        .reduce((sum, c) => sum + c.count, 0);

    const effectiveLevel = qty + queuedQty;

    const info = t.buildings[def.translationKey] || { name: def.id, description: '...' };
    const isQuantityMode = def.buildMode === 'QUANTITY';

    const effectiveAmount = isQuantityMode ? buildAmount : 1;
    
    // USE CENTRALIZED FORMULAS HERE
    const totalCost = calculateConstructionCost(def, effectiveLevel, effectiveAmount);
    const totalTime = calculateConstructionTime(def, effectiveLevel, effectiveAmount);

    const canAfford = 
      totalCost.money <= gameState.resources[ResourceType.MONEY] && 
      totalCost.oil <= gameState.resources[ResourceType.OIL] &&
      totalCost.ammo <= gameState.resources[ResourceType.AMMO];

    const nextLevelProduction: Partial<Record<ResourceType, number>> = {};
    if (def.productionRate) {
       Object.entries(def.productionRate).forEach(([r, rate]) => {
           nextLevelProduction[r as ResourceType] = rate as number; 
       });
    }

    let actionLabel = t.common.actions.construct;
    if (!isQuantityMode && qty > 0) {
        actionLabel = t.common.actions.upgrade;
    }

    const tooltipContent = (
        <GameTooltip
            title={info.name}
            description={info.description}
            cost={def.baseCost as unknown as Record<string, number>} 
            resources={gameState.resources}
            production={nextLevelProduction}
            stats={[
               { label: t.common.ui.level, value: `${qty} ${queuedQty > 0 ? `(+${queuedQty})` : ''}`, color: 'text-cyan-400' },
               { label: t.common.ui.type_label, value: isQuantityMode ? t.common.ui.constructible : t.common.ui.upgradeable, color: 'text-slate-400' },
               { label: t.common.ui.time_base, value: formatDuration(def.buildTime), color: 'text-blue-300' }
            ]}
            footer={canAfford ? undefined : t.errors.insufficient_funds}
        />
    );

    return (
      <Card 
        title={`${info.name}`} 
        className="h-full flex flex-col" 
        tooltip={tooltipContent}
      >
        <div className="flex-1 flex flex-col gap-3">
          <div>
            <div className="flex justify-between items-center mb-1">
               <span className="text-xs font-mono text-cyan-400 font-bold bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-500/20">
                  {isQuantityMode ? t.common.ui.quantity : t.common.ui.level}: {qty}
                  {queuedQty > 0 && <span className="text-emerald-400 ml-1 text-[10px] animate-pulse">(+{queuedQty})</span>}
               </span>
            </div>
            <p className="text-xs text-slate-400 leading-snug line-clamp-2 min-h-[2.5em]">{info.description}</p>
          </div>
          
          <div className="mt-auto">
              <div className="bg-slate-950/50 p-2.5 rounded-lg border border-white/5 mb-3">
                <div className="text-[10px] text-slate-500 uppercase mb-1 tracking-widest flex justify-between font-bold">
                    <span>{t.common.ui.next_cost} {isQuantityMode && effectiveAmount > 1 && `(x${effectiveAmount})`}</span>
                    <span className="text-blue-400 flex items-center gap-1"><Icons.Clock className="w-3 h-3" />{formatDuration(totalTime)}</span>
                </div>
                <CostDisplay cost={totalCost} currentResources={gameState.resources} t={t} />
              </div>

              <div className="space-y-3">
                    {isQuantityMode && (
                        <QuantitySelector 
                            value={buildAmount}
                            onChange={setBuildAmount}
                            maxAffordable={calculateMaxAffordableBuildings(def, effectiveLevel, gameState.resources)}
                            t={t}
                            presets={[1, 5]}
                        />
                    )}

                    <GlassButton 
                      id={`btn-build-${def.id}`} 
                      onClick={() => {
                          onAction(def.id, effectiveAmount);
                          setBuildAmount(1);
                      }} 
                      variant="primary" 
                      disabled={!canAfford} 
                      className="w-full disabled:opacity-50 text-xs font-bold tracking-wider"
                    >
                        {actionLabel}
                    </GlassButton>
              </div>
          </div>
        </div>
      </Card>
    );
};

export const BuildingsView: React.FC<ViewProps> = ({ gameState, onAction, onSpeedUp }) => {
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const allBuildings = Object.values(BUILDING_DEFS);
  const ITEMS_PER_PAGE_MOBILE = 6;
  const totalPages = Math.ceil(allBuildings.length / ITEMS_PER_PAGE_MOBILE);

  // --- TUTORIAL NAVIGATION LOGIC ---
  // If the tutorial target is on a different page, point to the pagination button instead.
  const activeTutorialStep = TUTORIAL_STEPS.find(s => s.id === gameState.currentTutorialId);
  let hijackNextButtonId: string | undefined = undefined;
  let hijackPrevButtonId: string | undefined = undefined;

  if (isMobile && activeTutorialStep && activeTutorialStep.targetElementId) {
      // Find the building related to this button ID
      const targetBuildingIndex = allBuildings.findIndex(b => `btn-build-${b.id}` === activeTutorialStep.targetElementId);
      
      if (targetBuildingIndex !== -1) {
          const targetPage = Math.floor(targetBuildingIndex / ITEMS_PER_PAGE_MOBILE) + 1;
          
          if (targetPage > currentPage) {
              hijackNextButtonId = activeTutorialStep.targetElementId;
          } else if (targetPage < currentPage) {
              hijackPrevButtonId = activeTutorialStep.targetElementId;
          }
      }
  }

  const displayedBuildings = useMemo(() => {
      if (!isMobile) return allBuildings;
      const start = (currentPage - 1) * ITEMS_PER_PAGE_MOBILE;
      return allBuildings.slice(start, start + ITEMS_PER_PAGE_MOBILE);
  }, [isMobile, currentPage, allBuildings]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pb-24 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {displayedBuildings.map((def) => (
                  <BuildingCard 
                      key={def.id} 
                      def={def} 
                      gameState={gameState} 
                      onAction={onAction} 
                      t={t} 
                  />
              ))}
            </div>

            {/* Mobile Pagination Controls (Inside Scroll View) */}
            {isMobile && totalPages > 1 && (
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
