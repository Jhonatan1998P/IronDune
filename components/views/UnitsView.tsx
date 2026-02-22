
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
}

const DEFENSE_THRESHOLD_PCT = 0.2;

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

    // --- NEW COMBAT STATS CALCULATIONS ---
    const armorThreshold = Math.floor(def.defense * DEFENSE_THRESHOLD_PCT);
    
    const getTierInfo = (defense: number) => {
        if (defense < 20) return { name: 'T0', label: t.common.tiers.soft, color: 'text-slate-400', border: 'border-slate-500', bg: 'bg-slate-950/90' };
        if (defense <= 100) return { name: 'T1', label: t.common.tiers.light, color: 'text-emerald-400', border: 'border-emerald-500', bg: 'bg-emerald-950/90' };
        if (defense <= 300) return { name: 'T2', label: t.common.tiers.armored, color: 'text-yellow-400', border: 'border-yellow-500', bg: 'bg-yellow-950/90' };
        return { name: 'T3', label: t.common.tiers.heavy, color: 'text-purple-400', border: 'border-purple-500', bg: 'bg-purple-950/90' };
    };

    const tier = getTierInfo(def.defense);

    // Calculate Penetration Capability (Visual Aid)
    const maxPenetrableDef = def.attack / DEFENSE_THRESHOLD_PCT;
    let penLabel = "T0";
    if (maxPenetrableDef >= 350) penLabel = t.common.ui.all; 
    else if (maxPenetrableDef >= 150) penLabel = "T2"; 
    else if (maxPenetrableDef >= 50) penLabel = "T1"; 
    
    const renderUpkeep = () => {
        if (!def.upkeep || Object.keys(def.upkeep).length === 0) return <span className="text-slate-500">0</span>;
        
        return (
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 items-center justify-center">
                {Object.entries(def.upkeep).map(([res, val]) => {
                    const perTenMinutes = (val as number) * 600;
                    if (perTenMinutes === 0) return null;
                    
                    let Icon = Icons.Resources.Money;
                    let color = 'text-emerald-400';
                    if (res === ResourceType.OIL) { Icon = Icons.Resources.Oil; color = 'text-purple-400'; }
                    if (res === ResourceType.AMMO) { Icon = Icons.Resources.Ammo; color = 'text-orange-400'; }
                    if (res === ResourceType.GOLD) { Icon = Icons.Resources.Gold; color = 'text-yellow-400'; }

                    return (
                        <div key={res} className={`flex items-center gap-1 text-[9px] ${color}`}>
                            <Icon className="w-3.5 h-3.5" />
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
                { label: t.common.stats.unit_class, value: `${tier.name}: ${tier.label}`, color: tier.color },
                { label: t.common.stats.hp, value: def.hp, color: 'text-emerald-400' },
                { label: t.common.stats.attack, value: `${def.attack} (${t.common.stats.pen_short}: ${penLabel})`, color: 'text-red-400' },
                { label: `${t.common.stats.defense} (${t.common.tiers.armored.toUpperCase()})`, value: `${def.defense} (${t.common.stats.min_dmg}: ${armorThreshold})`, color: 'text-blue-400' },
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
          title={<span className="pl-10">{info.name}</span>} 
          tooltip={tooltipContent}
          className={`${!isUnlocked ? "opacity-75 border-red-500/20" : ""} relative flex flex-col h-full`}
        >
          {/* TIER BADGE - Reposicionado a la esquina interna */}
          <div className="absolute top-0 left-0 z-20 pointer-events-none">
             <div className={`flex flex-col items-center justify-center text-[9px] font-bold min-w-[42px] px-1.5 py-1.5 rounded-tl-xl rounded-br-xl border-b border-r ${tier.border} ${tier.color} ${tier.bg} backdrop-blur-md shadow-[2px_2px_10px_rgba(0,0,0,0.3)]`}>
                 <span className="leading-none">{tier.name}</span>
                 <span className="text-[6px] opacity-80 leading-none tracking-widest uppercase mt-0.5">{tier.label}</span>
             </div>
          </div>

          <div className="flex flex-col justify-between flex-1 gap-4 pt-2">
            <div className="relative">
                {!isUnlocked && (
                <div className="absolute right-0 top-0 text-red-500/50">
                    <Icons.Lock />
                </div>
                )}

                <div className="text-xs space-y-3 md:space-y-4 text-slate-400 w-full relative z-10">
                    {/* VISIBLE STATS GRID */}
                    <div className="grid grid-cols-3 gap-1.5 md:gap-2 w-full">
                        
                        {/* HP */}
                        <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex flex-col items-center justify-center">
                            <div className="text-emerald-500/70 mb-1"><Icons.Stats.Hp className="w-3.5 h-3.5" /></div>
                            <div className="font-bold text-emerald-400 text-xs sm:text-sm leading-none">{formatNumber(def.hp)}</div>
                        </div>

                        {/* ATTACK */}
                        <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex flex-col items-center justify-center">
                            <div className="text-red-500/70 mb-1"><Icons.Stats.Attack className="w-3.5 h-3.5" /></div>
                            <div className="font-bold text-red-400 text-xs sm:text-sm leading-none">{formatNumber(def.attack)}</div>
                            <div className="text-[8px] text-red-500/60 font-mono mt-1 leading-none">{t.common.stats.pen_short}:{penLabel}</div>
                        </div>

                        {/* DEFENSE / ARMOR */}
                        <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex flex-col items-center justify-center">
                            <div className="text-blue-500/70 mb-1"><Icons.Stats.Defense className="w-3.5 h-3.5" /></div>
                            <div className="font-bold text-blue-400 text-xs sm:text-sm leading-none">{def.defense}</div>
                            <div className="text-[8px] text-blue-300/60 font-mono mt-1 leading-none">
                                {t.common.stats.arm_short}:{armorThreshold}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{t.common.ui.active_units}</div>
                        <div className="text-white font-mono font-bold text-sm bg-black/40 px-2 py-0.5 rounded border border-white/5">{formatNumber(gameState.units[def.id] || 0)}</div>
                    </div>
                    
                    <div className="border-t border-white/5 pt-2">
                        <div className="text-[9px] text-slate-500 uppercase text-center mb-1.5 font-bold tracking-widest">{t.common.stats.upkeep}</div>
                        {renderUpkeep()}
                    </div>
                </div>
            </div>
            
            <div className="mt-auto">
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-white/5 mb-3">
                    <div className="flex justify-between items-center text-[9px] text-slate-500 uppercase mb-2 tracking-widest font-bold">
                        <span>{t.common.stats.cost}</span>
                        <span className="text-cyan-400 flex items-center gap-1"><Icons.Clock className="w-3 h-3" />{formatDuration(totalTime)}</span>
                    </div>
                    <CostDisplay cost={totalCost} currentResources={gameState.resources} t={t} />
                </div>

                <div className="pt-2 border-t border-white/5">
                    {!isUnlocked ? (
                        <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-3 flex flex-col items-center justify-center gap-1 text-red-300 min-h-[44px]">
                            <span className="block font-bold uppercase tracking-wider text-[10px] flex items-center gap-2">
                                <Icons.Lock /> {t.common.ui.status_locked}
                            </span>
                            <span className="text-[9px] text-center">{t.common.ui.req_short}: {techName}</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <QuantitySelector 
                                value={recruitAmount}
                                onChange={setRecruitAmount}
                                maxAffordable={calculateMaxAffordableUnits(def, gameState.resources)}
                                t={t}
                                presets={[1, 5]}
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

export const UnitsView: React.FC<{ gameState: GameState; onAction: (id: UnitType, amount: number) => void; onSpeedUp: (targetId: string, type: "BUILD" | "RECRUIT" | "RESEARCH" | "MISSION") => void }> = ({ gameState, onAction, onSpeedUp }) => {
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
    <div className="flex flex-col min-h-full relative">
      
      {/* Categories */}
      <div className="shrink-0 pt-1 pb-3 mb-2 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 -mx-3 px-3 md:mx-0 md:px-0 md:bg-transparent md:backdrop-blur-none md:border-b-0">
          
          {/* MOBILE COMPACT LAYOUT (Dropdown) */}
          <div className="md:hidden flex flex-col gap-2">
              <div className="relative flex-1">
                  <select
                      value={activeCategory}
                      onChange={(e) => setActiveCategory(e.target.value as any)}
                      className="w-full appearance-none bg-slate-900/90 border border-white/10 rounded-xl pl-3 pr-8 py-2 text-[10px] sm:text-xs font-tech uppercase tracking-widest text-cyan-300 focus:outline-none focus:border-cyan-500 shadow-sm"
                  >
                      {categories.map(cat => (
                          <option key={cat.id} value={cat.id} className="bg-slate-900 text-white">
                              {cat.label}
                          </option>
                      ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-500">
                      <Icons.ChevronDown className="w-4 h-4" />
                  </div>
              </div>
          </div>

          {/* DESKTOP LAYOUT (Pills Row) */}
          <div className="hidden md:block space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mask-image-sides items-stretch">
                {categories.map(cat => {
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id as any)}
                      className={`
                        relative min-h-[44px] px-4 rounded-lg text-xs font-tech uppercase tracking-wider border transition-all flex items-center justify-center gap-2 shrink-0 w-auto
                        ${activeCategory === cat.id 
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                          : 'bg-slate-800/50 border-white/5 text-slate-500 hover:text-slate-300 active:bg-white/5'}
                      `}
                    >
                      {cat.icon && <cat.icon className="w-4 h-4" />}
                      <span className="relative z-10 whitespace-nowrap text-center leading-tight">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
          </div>

      </div>

      {/* Unit Grid */}
      <div className="pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6 md:p-2">
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
    </div>
  );
};
