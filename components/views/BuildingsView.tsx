
import React, { useState, useEffect, useMemo } from 'react';
import { BUILDING_DEFS } from '../../data/buildings';
import { GameState, ResourceType, BuildingType, BuildingDef, TranslationDictionary } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { Card, GlassButton, CostDisplay, QuantitySelector, Icons } from '../UIComponents';
import { GameTooltip } from '../GameTooltip';
import { formatDuration } from '../../utils';
import { calculateConstructionCost, calculateConstructionTime, calculateMaxAffordableBuildings, calculateRepairCost } from '../../utils/formulas';
import { TUTORIAL_STEPS } from '../../data/tutorial';

interface ViewProps {
  gameState: GameState;
  onAction: (id: BuildingType, amount: number) => void;
  onSpeedUp: (targetId: string, type: 'BUILD' | 'RECRUIT' | 'RESEARCH' | 'MISSION') => void;
  onRepair?: (id: BuildingType) => void;
}

// --- SUB-COMPONENT: BUILDING CARD ---
const BuildingCard: React.FC<{ def: BuildingDef, gameState: GameState, onAction: (id: BuildingType, amount: number) => void, onRepair?: (id: BuildingType) => void, t: TranslationDictionary }> = ({ def, gameState, onAction, onRepair, t }) => {
    const buildingState = gameState.buildings[def.id];
    const qty = buildingState?.level || 0;
    const isDamaged = buildingState?.isDamaged || false;
    const [buildAmount, setBuildAmount] = useState(1);
    
    // Calculate queued quantity for effective level calculation
    const queuedQty = gameState.activeConstructions
        .filter(c => c.buildingType === def.id)
        .reduce((sum, c) => sum + c.count, 0);

    const effectiveLevel = qty + queuedQty;

    const info = t.buildings[def.translationKey] || { name: def.id, description: '...' };
    const isQuantityMode = def.buildMode === 'QUANTITY';

    const effectiveAmount = isQuantityMode ? buildAmount : 1;
    
    // REPAIR OR BUILD COST
    let totalCost: { money: number, oil: number, ammo: number };
    let totalTime = 0;
    let canAfford = false;

    if (isDamaged) {
        totalCost = calculateRepairCost(def, qty);
        // Repair is instant or handled differently, no time calculation needed for display purposes here
        // If we want instant, time is 0.
        totalTime = 0; 
    } else {
        totalCost = calculateConstructionCost(def, effectiveLevel, effectiveAmount);
        totalTime = calculateConstructionTime(def, effectiveLevel, effectiveAmount);
    }

    canAfford = 
      totalCost.money <= gameState.resources[ResourceType.MONEY] && 
      totalCost.oil <= gameState.resources[ResourceType.OIL] &&
      totalCost.ammo <= gameState.resources[ResourceType.AMMO];

    const nextLevelProduction: Partial<Record<ResourceType, number>> = {};
    if (def.productionRate && !isDamaged) {
       Object.entries(def.productionRate).forEach(([r, rate]) => {
           nextLevelProduction[r as ResourceType] = rate as number; 
       });
    }

    let actionLabel = t.common.actions.construct;
    if (isDamaged) {
        actionLabel = t.common.actions.repair;
    } else if (!isQuantityMode && qty > 0) {
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
            footer={isDamaged ? t.common.ui.status_damaged : (canAfford ? undefined : t.errors.insufficient_funds)}
        />
    );

    return (
      <Card 
        title={`${info.name}`} 
        className={`h-full flex flex-col ${isDamaged ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}`} 
        tooltip={tooltipContent}
      >
        <div className="flex-1 flex flex-col gap-3 md:gap-4">
          <div>
            <div className="flex justify-between items-center mb-1 md:mb-2">
               <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${isDamaged ? 'text-red-400 bg-red-950/30 border-red-500/50 animate-pulse' : 'text-cyan-400 bg-cyan-950/30 border-cyan-500/20'}`}>
                  {isDamaged ? t.common.ui.status_damaged : (isQuantityMode ? t.common.ui.quantity : t.common.ui.level) + ': ' + qty}
                  {!isDamaged && queuedQty > 0 && <span className="text-emerald-400 ml-1 text-[10px] animate-pulse">(+{queuedQty})</span>}
               </span>
            </div>
            <p className="text-xs text-slate-400 leading-snug line-clamp-2 md:line-clamp-3 min-h-[2.5em] md:min-h-[3.5em]">{info.description}</p>
          </div>
          
          <div className="mt-auto">
              <div className={`p-2.5 rounded-lg border mb-3 ${isDamaged ? 'bg-red-950/20 border-red-500/30' : 'bg-slate-950/50 border-white/5'}`}>
                <div className="text-[10px] text-slate-500 uppercase mb-1 tracking-widest flex justify-between font-bold">
                    <span>{isDamaged ? t.common.actions.repair + ' Cost' : t.common.ui.next_cost + (isQuantityMode && effectiveAmount > 1 ? ` (x${effectiveAmount})` : '')}</span>
                    {!isDamaged && <span className="text-blue-400 flex items-center gap-1"><Icons.Clock className="w-3 h-3" />{formatDuration(totalTime)}</span>}
                </div>
                <CostDisplay cost={totalCost} currentResources={gameState.resources} t={t} />
              </div>

              <div className="space-y-3">
                    {isQuantityMode && !isDamaged && (
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
                          if (isDamaged && onRepair) {
                              onRepair(def.id);
                          } else {
                              onAction(def.id, effectiveAmount);
                              setBuildAmount(1);
                          }
                      }} 
                      variant={isDamaged ? 'danger' : 'primary'} 
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

export const BuildingsView: React.FC<ViewProps & { onRepair?: (id: BuildingType) => void }> = ({ gameState, onAction, onSpeedUp: _onSpeedUp, onRepair }) => {
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
  const activeTutorialStep = TUTORIAL_STEPS.find(s => s.id === gameState.currentTutorialId);
  let hijackNextButtonId: string | undefined = undefined;
  let hijackPrevButtonId: string | undefined = undefined;

  if (isMobile && activeTutorialStep && activeTutorialStep.targetElementId) {
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
    <div className="flex flex-col min-h-full relative">
        
        {/* COMPACT TOP PAGINATION (Solo Móviles) */}
        {isMobile && totalPages > 1 && (
            <div className="flex justify-between items-center shrink-0 p-1.5 mb-3 bg-slate-900/50 rounded-xl border border-white/10 shadow-sm">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold ml-3">
                    {t.common.ui.nav_base}
                </span>
                <div className="flex items-center gap-2">
                    <button 
                        id={hijackPrevButtonId}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center border border-white/10 transition-all active:scale-95 text-slate-300"
                    >
                        <Icons.ChevronLeft />
                    </button>
                    <span className="text-xs font-mono font-bold text-cyan-400 w-12 text-center">
                        {currentPage} <span className="text-slate-600">/ {totalPages}</span>
                    </span>
                    <button 
                        id={hijackNextButtonId}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center border border-white/10 transition-all active:scale-95 text-slate-300"
                    >
                        <Icons.ChevronRight />
                    </button>
                </div>
            </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6 md:p-2">
              {displayedBuildings.map((def) => (
                  <BuildingCard 
                      key={def.id} 
                      def={def} 
                      gameState={gameState} 
                      onAction={onAction}
                      onRepair={onRepair}
                      t={t} 
                  />
              ))}
            </div>
        </div>
    </div>
  );
};
