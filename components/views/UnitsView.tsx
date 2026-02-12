
import React, { useState } from 'react';
import { UNIT_DEFS } from '../../data/units';
import { TECH_DEFS } from '../../data/techs';
import { GameState, ResourceType, UnitCategory, UnitType, UnitDef, TranslationDictionary } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { Card, GlassButton, Icons, QuantitySelector, CostDisplay } from '../UIComponents';
import { GameTooltip } from '../GameTooltip';
import { formatNumber, formatDuration } from '../../utils';
import { calculateRecruitmentCost, calculateRecruitmentTime, calculateMaxAffordableUnits } from '../../utils/formulas';
import { calculateProductionRates, calculateUpkeepCosts, calculateTechMultipliers } from '../../utils/engine/modifiers';

interface ViewProps {
  gameState: GameState;
  onAction: (id: UnitType, amount: number) => void;
  onSpeedUp: (targetId: string, type: 'BUILD' | 'RECRUIT' | 'RESEARCH' | 'MISSION') => void;
}

const UnitCard: React.FC<{ def: UnitDef, gameState: GameState, onAction: (id: UnitType, amount: number) => void, t: TranslationDictionary }> = ({ def, gameState, onAction, t }) => {
    const info = t.units[def.translationKey] || { name: def.id, stats: '...' };
    const isUnlocked = gameState.researchedTechs.includes(def.reqTech);
    
    const [recruitAmount, setRecruitAmount] = useState(1);

    const techDef = TECH_DEFS[def.reqTech];
    const techName = techDef && t.techs[techDef.translationKey] 
       ? t.techs[techDef.translationKey].name 
       : t.common.ui.unknown_tech;
    
    const totalCost = calculateRecruitmentCost(def, recruitAmount);
    const totalTime = calculateRecruitmentTime(def, recruitAmount);

    const canAfford = 
        gameState.resources[ResourceType.MONEY] >= totalCost.money &&
        gameState.resources[ResourceType.OIL] >= totalCost.oil &&
        gameState.resources[ResourceType.AMMO] >= totalCost.ammo;

    const renderUpkeep = () => {
        if (!def.upkeep || Object.keys(def.upkeep).length === 0) return <span className="text-slate-500">0</span>;
        
        return (
            <div className="flex flex-wrap gap-2 items-center justify-center">
                {Object.entries(def.upkeep).map(([res, val]) => {
                    // Standardize to 10-minute ticks to match GameHeader and Tooltips
                    const perTenMinutes = (val as number) * 600;
                    if (perTenMinutes === 0) return null;
                    
                    let Icon = Icons.Resources.Money;
                    let color = 'text-emerald-400';
                    if (res === ResourceType.OIL) { Icon = Icons.Resources.Oil; color = 'text-purple-400'; }
                    if (res === ResourceType.AMMO) { Icon = Icons.Resources.Ammo; color = 'text-orange-400'; }
                    if (res === ResourceType.GOLD) { Icon = Icons.Resources.Gold; color = 'text-yellow-400'; }

                    return (
                        <div key={res} className={`flex items-center gap-1 text-[9px] ${color}`}>
                            <Icon className="w-3 h-3" />
                            <span className="font-mono font-bold">-{formatNumber(perTenMinutes)}</span>
                        </div>
                    );
                })}
                <span className="text-[8px] text-slate-500">/10m</span>
            </div>
        );
    };

    // --- LOGISTICS CALCULATION FOR TOOLTIP ---
    let recruitCap = Infinity;
    let hasCost = false;
    Object.entries(def.cost).forEach(([res, cost]) => {
        if ((cost as number) > 0) {
            hasCost = true;
            const resourceKey = res.toUpperCase() as ResourceType;
            const available = gameState.resources[resourceKey] || 0;
            const affordable = Math.floor(available / (cost as number));
            recruitCap = Math.min(recruitCap, affordable);
        }
    });
    if (!hasCost) recruitCap = 0; 

    // 2. Max Sustainable
    const multipliers = calculateTechMultipliers(gameState.researchedTechs, gameState.techLevels);
    const productionRates = calculateProductionRates(gameState.buildings, multipliers);
    const currentUpkeep = calculateUpkeepCosts(gameState.units);
    
    const unitUpkeep = def.upkeep || {};
    let sustainCap = Infinity;
    let hasUpkeep = false;

    Object.entries(unitUpkeep).forEach(([res, costRate]) => {
        const cost = costRate as number;
        if (cost > 0) {
            hasUpkeep = true;
            const netFlow = (productionRates[res as ResourceType] || 0) - (currentUpkeep[res as ResourceType] || 0);
            
            if (netFlow <= 0) {
                sustainCap = 0;
            } else {
                const supportable = Math.floor(netFlow / cost);
                sustainCap = Math.min(sustainCap, supportable);
            }
        }
    });
    
    const displaySustain = hasUpkeep ? (sustainCap === Infinity ? "∞" : formatNumber(sustainCap)) : "∞";
    const displayRecruit = recruitCap === Infinity ? "∞" : formatNumber(recruitCap);

    const tooltipContent = (
        <GameTooltip 
            title={info.name}
            description={info.stats} 
            cost={def.cost as unknown as Record<string, number>}
            resources={gameState.resources}
            stats={[
                { label: t.common.stats.hp, value: def.hp, color: 'text-emerald-400' },
                { label: t.common.stats.attack, value: def.attack, color: 'text-red-400' },
                { label: t.common.stats.defense, value: def.defense, color: 'text-blue-400' },
                { label: t.common.stats.recruit_cap, value: displayRecruit, color: 'text-cyan-300' },
                { label: t.common.stats.sustain_cap, value: displaySustain, color: sustainCap === 0 ? 'text-red-500' : 'text-purple-300' },
                { label: t.common.stats.research_time, value: formatDuration(def.recruitTime), color: 'text-slate-300' }
            ]}
            rapidFire={def.rapidFire as Record<string, number>}
            requirements={!isUnlocked ? [{ label: `${t.common.ui.req_short}: ${techName}`, met: false }] : undefined}
        />
    );

    return (
        <Card 
          title={info.name} 
          tooltip={tooltipContent}
          className={!isUnlocked ? "opacity-75 border-red-500/20" : ""}
        >
          <div className="flex flex-col justify-between flex-1 gap-3">
            <div className="relative">
                {!isUnlocked && (
                <div className="absolute right-0 top-0 text-red-500/50">
                    <Icons.Lock />
                </div>
                )}

                <div className="text-xs space-y-2 text-slate-400 w-full relative z-10">
                    {/* VISIBLE STATS */}
                    <div className="grid grid-cols-3 gap-1 bg-black/20 p-2 rounded border border-white/5">
                        <div className="text-center flex flex-col items-center">
                            <div className="text-emerald-500/70 mb-0.5"><Icons.Stats.Hp className="w-4 h-4" /></div>
                            <div className="font-bold text-emerald-400 text-xs">{formatNumber(def.hp)}</div>
                        </div>
                        <div className="text-center border-l border-white/5 flex flex-col items-center">
                            <div className="text-red-500/70 mb-0.5"><Icons.Stats.Attack className="w-4 h-4" /></div>
                            <div className="font-bold text-red-400 text-xs">{formatNumber(def.attack)}</div>
                        </div>
                        <div className="text-center border-l border-white/5 flex flex-col items-center">
                            <div className="text-blue-500/70 mb-0.5"><Icons.Stats.Defense className="w-4 h-4" /></div>
                            <div className="font-bold text-blue-400 text-xs">{def.defense}</div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center bg-white/5 p-1.5 rounded">
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest">{t.common.ui.active_units}</div>
                        <div className="text-white font-mono font-bold">{formatNumber(gameState.units[def.id] || 0)}</div>
                    </div>
                    
                    <div className="border-t border-white/5 pt-1">
                        <div className="text-[9px] text-slate-500 uppercase text-center mb-1">{t.common.stats.upkeep}</div>
                        {renderUpkeep()}
                    </div>
                </div>
            </div>
            
            <div className="mt-auto">
                <div className="bg-slate-950/50 p-2 rounded-lg border border-white/5 mb-3">
                    <div className="flex justify-between text-[9px] text-slate-500 uppercase mb-1 tracking-widest">
                        <span>Cost</span>
                        <span className="text-cyan-400">{formatDuration(totalTime)}</span>
                    </div>
                    <CostDisplay cost={totalCost} currentResources={gameState.resources} t={t} />
                </div>

                <div className="pt-2 border-t border-white/5">
                    {!isUnlocked ? (
                        <div className="bg-red-950/30 border border-red-500/30 rounded p-3 flex flex-col items-center justify-center gap-1 text-red-300 min-h-[44px]">
                            <span className="block font-bold uppercase tracking-wider text-[10px] flex items-center gap-2">
                                <Icons.Lock /> {t.common.ui.status_locked}
                            </span>
                            <span className="text-[9px]">{t.common.ui.req_short}: {techName}</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <QuantitySelector 
                                value={recruitAmount}
                                onChange={setRecruitAmount}
                                maxAffordable={calculateMaxAffordableUnits(def, gameState.resources)}
                                t={t}
                                presets={[1, 5, 10]}
                            />

                            <div className="w-full">
                                <GlassButton 
                                    id={`btn-recruit-${def.id}`}
                                    onClick={() => {
                                        onAction(def.id, recruitAmount);
                                        setRecruitAmount(1); 
                                    }} 
                                    className="w-full text-xs font-bold tracking-widest" 
                                    variant="primary"
                                    disabled={!canAfford}
                                >
                                {t.common.actions.recruit}
                                </GlassButton>
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </div>
        </Card>
    );
}

export const UnitsView: React.FC<ViewProps> = ({ gameState, onAction, onSpeedUp }) => {
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<UnitCategory | 'ALL'>('ALL');

  const categories = [
    { id: 'ALL', label: t.common.ui.all, icon: null },
    { id: UnitCategory.GROUND, label: t.common.categories[UnitCategory.GROUND], icon: Icons.Infantry },
    { id: UnitCategory.ARTILLERY, label: t.common.categories[UnitCategory.ARTILLERY], icon: Icons.Artillery },
    { id: UnitCategory.TANK, label: t.common.categories[UnitCategory.TANK], icon: Icons.TankIcon },
    { id: UnitCategory.NAVAL, label: t.common.categories[UnitCategory.NAVAL], icon: Icons.Naval },
    { id: UnitCategory.AIR, label: t.common.categories[UnitCategory.AIR], icon: Icons.Air },
  ];

  const filteredUnits = Object.values(UNIT_DEFS).filter(unit => 
    activeCategory === 'ALL' || unit.category === activeCategory
  );

  return (
    <div className="space-y-6 flex flex-col h-full pb-24">
      
      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mask-image-sides shrink-0">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id as any)}
            className={`
              h-[40px] px-4 rounded-lg text-[10px] md:text-xs font-tech uppercase tracking-wider whitespace-nowrap border transition-all flex items-center gap-2 shrink-0
              ${activeCategory === cat.id 
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                : 'bg-slate-800/50 border-white/5 text-slate-500 hover:text-slate-300'}
            `}
          >
            {cat.icon && <cat.icon />}
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {filteredUnits.map((def) => (
            <UnitCard 
                key={def.id} 
                def={def} 
                gameState={gameState} 
                onAction={onAction} 
                t={t} 
            />
        ))}
      </div>
    </div>
  );
};
