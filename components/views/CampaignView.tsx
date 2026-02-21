
import React, { useState, useEffect } from 'react';
import { CAMPAIGN_TRAVEL_TIME } from '../../constants';
import { CAMPAIGN_LEVELS } from '../../data/campaigns';
import { UNIT_DEFS } from '../../data/units';
import { GameState, ResourceType, TechType, UnitType } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { GlassButton, Icons, SpeedUpButton } from '../UIComponents';
import { formatNumber, formatDuration } from '../../utils';

interface CampaignProps {
    gameState: GameState;
    onExecuteBattle: (levelId: number, units: Partial<Record<UnitType, number>>) => boolean | null;
    onSpeedUp: (targetId: string, type: 'BUILD' | 'RECRUIT' | 'RESEARCH' | 'MISSION') => void;
}

export const CampaignView: React.FC<CampaignProps> = ({ gameState, onExecuteBattle, onSpeedUp }) => {
    const { t } = useLanguage();
    const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
    const [selectedUnits, setSelectedUnits] = useState<Partial<Record<UnitType, number>>>({});

    const activeCampaignMissions = gameState.activeMissions.filter(m => m.type === 'CAMPAIGN_ATTACK');
    const techLevel = gameState.techLevels[TechType.STRATEGIC_COMMAND] || 0;
    const maxSlots = 1 + techLevel;
    const availableSlots = maxSlots - activeCampaignMissions.length;

    // FIX: Auto-select next available level ONLY on desktop and when progress changes.
    // Removed selectedLevelId from dependencies to prevent the "trap" bug on mobile.
    useEffect(() => {
        const isDesktop = window.matchMedia("(min-width: 768px)").matches;
        if (isDesktop) {
            setSelectedLevelId(gameState.campaignProgress);
        }
    }, [gameState.campaignProgress]);

    // Handle back logic perfectly for vertical flow
    const handleBackToMap = () => {
        setSelectedLevelId(null);
        setSelectedUnits({});
    };

    const handleLevelSelect = (id: number) => {
        setSelectedLevelId(id);
        setSelectedUnits({});
    };

    const selectedLevel = CAMPAIGN_LEVELS.find(l => l.id === selectedLevelId);
    const availableUnits = (Object.entries(gameState.units) as [UnitType, number][]).filter(([, count]) => count > 0);
    
    const handleUnitChange = (type: UnitType, change: number) => {
        setSelectedUnits(prev => {
            const currentVal = prev[type] || 0;
            const maxVal = gameState.units[type];
            const newVal = Math.max(0, Math.min(maxVal, currentVal + change));
            if (newVal === 0) {
                const newUnits = { ...prev };
                delete newUnits[type];
                return newUnits;
            }
            return { ...prev, [type]: newVal };
        });
    };

    const handleUnitSet = (type: UnitType, val: number) => {
        setSelectedUnits(prev => {
            const maxVal = gameState.units[type];
            const newVal = Math.max(0, Math.min(maxVal, val));
            if (newVal === 0) {
                const newUnits = { ...prev };
                delete newUnits[type];
                return newUnits;
            }
            return { ...prev, [type]: newVal };
        });
    };

    const handleAttack = () => {
        if (selectedLevelId) {
            const success = onExecuteBattle(selectedLevelId, selectedUnits);
            if (success) {
                setSelectedUnits({});
                setSelectedLevelId(null); // Return to list view
            }
        }
    };

    const totalSelected = Object.values(selectedUnits).reduce((a: number, b) => a + ((b as number) || 0), 0);

    const getResIcon = (res: string) => {
        switch(res) {
            case ResourceType.MONEY: return <Icons.Resources.Money className="w-3.5 h-3.5 text-emerald-400" />;
            case ResourceType.OIL: return <Icons.Resources.Oil className="w-3.5 h-3.5 text-purple-400" />;
            case ResourceType.AMMO: return <Icons.Resources.Ammo className="w-3.5 h-3.5 text-orange-400" />;
            case ResourceType.GOLD: return <Icons.Resources.Gold className="w-3.5 h-3.5 text-yellow-400" />;
            case ResourceType.DIAMOND: return <Icons.Resources.Diamond className="w-3.5 h-3.5 text-cyan-400" />;
            default: return null;
        }
    };

    const now = Date.now();

    return (
        <div className="flex flex-col min-h-full animate-[fadeIn_0.3s_ease-out] relative">
            
            {/* TOP HEADER: SLOTS & ACTIVE OPS */}
            <div className="shrink-0 glass-panel p-4 rounded-xl border border-white/10 flex flex-col gap-3 shadow-lg mb-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                        <Icons.Radar className="text-cyan-400" />
                        <span className="font-tech text-sm text-white uppercase tracking-widest">{t.common.ui.cmd_slots}</span>
                    </div>
                    <div className="font-mono text-xs">
                        <span className={availableSlots > 0 ? "text-cyan-400 font-bold" : "text-red-400 font-bold"}>{availableSlots}</span>
                        <span className="text-slate-500"> / {maxSlots}</span>
                    </div>
                </div>

                {activeCampaignMissions.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                        {activeCampaignMissions.map(m => {
                            const timeRem = Math.max(0, m.endTime - now);
                            const progress = 100 - (timeRem / (15 * 60 * 1000) * 100);
                            return (
                                <div key={m.id} className="min-w-[200px] flex-1 bg-cyan-950/20 p-2 rounded-lg border border-cyan-500/30 relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]"></div>
                                    <div className="flex justify-between items-start mb-2 pl-2">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">{t.campaign.level_prefix}-{m.levelId}</span>
                                            <span className="text-[9px] text-slate-400">{t.campaign.mission_in_progress}</span>
                                        </div>
                                        <div className="flex items-center gap-1 bg-black/40 px-1 py-0.5 rounded">
                                            <span className="font-mono text-[10px] font-bold text-white">{formatDuration(timeRem)}</span>
                                        </div>
                                    </div>
                                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden ml-2 mb-1">
                                        <div className="h-full bg-cyan-500 transition-all duration-1000 linear" style={{ width: `${progress}%` }}></div>
                                    </div>
                                    <div className="pl-2">
                                        <SpeedUpButton onClick={() => onSpeedUp(m.id, 'MISSION')} disabled={gameState.resources.DIAMOND < 1} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex flex-col bg-black/20 rounded-xl border border-white/5">
                
                {/* LEFT: LIST OF LEVELS */}
                <div className={`
                    w-full flex flex-col border-b md:border-b-0 md:border-r border-white/5
                    ${selectedLevelId !== null ? 'hidden md:flex' : 'flex'}
                `}>
                    <div className="p-3 bg-black/40 border-b border-white/10 shrink-0 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {t.common.ui.mission_list}
                    </div>
                    <div className="p-2 space-y-1">
                        {CAMPAIGN_LEVELS.map((level) => {
                            const isLocked = level.id > gameState.campaignProgress;
                            const isCompleted = level.id < gameState.campaignProgress;
                            const isCurrent = level.id === gameState.campaignProgress;
                            const isSelected = selectedLevelId === level.id;
                            const isActive = activeCampaignMissions.some(m => m.levelId === level.id);

                            return (
                                <button
                                    key={level.id}
                                    onClick={() => !isLocked && handleLevelSelect(level.id)}
                                    disabled={isLocked}
                                    className={`
                                        w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left relative min-h-[64px]
                                        ${isSelected ? 'bg-cyan-900/30 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'border-transparent hover:bg-white/5'}
                                        ${isLocked ? 'opacity-40 cursor-not-allowed grayscale' : ''}
                                    `}
                                >
                                    <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center border ${
                                        isActive ? 'bg-orange-500/20 border-orange-500 text-orange-400 animate-pulse' :
                                        isCompleted ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                                        isCurrent ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_#06b6d4]' :
                                        'bg-slate-800 border-slate-600 text-slate-500'
                                    }`}>
                                        {isLocked ? <Icons.Lock /> : isActive ? <Icons.Radar /> : isCompleted ? <Icons.Crown /> : <span className="text-xs font-bold">{level.id}</span>}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className={`text-xs font-bold uppercase tracking-wider truncate ${isCurrent ? 'text-cyan-300' : 'text-slate-300'}`}>
                                            {t.campaign.levels[level.nameKey]?.title || level.nameKey}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                            {t.campaign.difficulty[level.difficulty] || level.difficulty}
                                        </div>
                                    </div>
                                    
                                    <div className="md:hidden text-slate-600 shrink-0">
                                        <Icons.ChevronRight />
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* RIGHT/FULL: LEVEL DETAILS */}
                <div className={`
                    w-full flex flex-col relative
                    ${selectedLevelId !== null ? 'flex' : 'hidden md:flex'}
                `}>
                    {selectedLevel ? (
                        <>
                            {/* Detail Header */}
                            <div className="p-4 md:p-6 border-b border-white/10 bg-slate-900/80 shrink-0 z-10 flex gap-4">
                                 <button 
                                    onClick={handleBackToMap}
                                    className="md:hidden shrink-0 mt-1 w-8 h-8 flex items-center justify-center bg-black/40 rounded-full text-slate-400 hover:text-white border border-white/10 transition-colors"
                                 >
                                    <Icons.ArrowLeft />
                                 </button>

                                 <div className="flex-1 min-w-0">
                                     <div className="flex items-center gap-2 mb-1.5">
                                        <span className="bg-cyan-950 text-cyan-400 text-[10px] font-bold px-2 py-0.5 rounded border border-cyan-500/30 uppercase tracking-widest">{t.campaign.level_prefix}-{selectedLevel.id}</span>
                                        <span className="text-[10px] text-slate-500 font-mono bg-black/30 px-2 py-0.5 rounded border border-white/5">{t.campaign.difficulty[selectedLevel.difficulty] || selectedLevel.difficulty}</span>
                                     </div>
                                     <h2 className="font-tech text-xl md:text-2xl text-white uppercase tracking-widest shadow-glow leading-tight mb-2">
                                         {t.campaign.levels[selectedLevel.nameKey]?.title || selectedLevel.nameKey}
                                     </h2>
                                     <p className="text-xs text-slate-400 leading-relaxed font-sans opacity-90 max-w-xl">
                                         {t.campaign.levels[selectedLevel.nameKey]?.desc || selectedLevel.descriptionKey}
                                     </p>
                                 </div>
                            </div>

                            {/* Scrollable Detail Content */}
                            <div className="p-4 md:p-6 pb-6">
                                 <div className="grid grid-cols-1 gap-6">
                                     
                                     {/* Intelligence & Rewards */}
                                     <div className="space-y-6">
                                         {/* Rewards */}
                                         <div className="glass-panel p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10">
                                            <h3 className="flex items-center gap-2 text-[10px] text-emerald-400 uppercase tracking-widest border-b border-emerald-500/20 pb-2 mb-3 font-bold">
                                                <Icons.Crown /> {t.campaign.rewards}
                                            </h3>
                                            <div className="grid grid-cols-2 gap-2">
                                                {Object.entries(selectedLevel.reward).map(([res, amount]) => {
                                                    if (!amount) return null;
                                                    return (
                                                        <div key={res} className="flex justify-between items-center text-xs bg-black/40 p-2.5 rounded border border-white/5">
                                                            <div className="flex items-center gap-2">
                                                                {getResIcon(res)}
                                                                <span className="text-[10px] uppercase font-bold tracking-wide text-slate-300">{t.common.resources[res]}</span>
                                                            </div>
                                                            <span className="font-mono font-bold text-emerald-300">+{formatNumber(amount as number)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                         </div>

                                         {/* Intel */}
                                         <div className="glass-panel p-4 rounded-xl border border-red-500/20 bg-red-950/10">
                                            <h3 className="flex items-center gap-2 text-[10px] text-red-400 uppercase tracking-widest border-b border-red-500/20 pb-2 mb-3 font-bold">
                                                <Icons.Radar /> {t.campaign.enemy_forces}
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {Object.entries(selectedLevel.enemyArmy).map(([u, count]) => {
                                                    const def = UNIT_DEFS[u as UnitType];
                                                    return (
                                                        <div key={u} className="flex justify-between items-center text-xs bg-black/40 p-2 rounded border border-white/5">
                                                            <span className="truncate text-slate-300 mr-2">{t.units[def.translationKey]?.name}</span>
                                                            <span className="font-mono font-bold text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">{count}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                         </div>
                                     </div>

                                     {/* Unit Selector (Modernized) */}
                                     <div className="flex flex-col bg-slate-900/60 rounded-xl border border-white/10 shadow-lg overflow-hidden h-max">
                                         <div className="p-4 bg-gradient-to-r from-cyan-950/50 to-transparent border-b border-white/10 flex justify-between items-center">
                                             <h3 className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-2">
                                                <Icons.Army /> {t.common.ui.strike_force}
                                             </h3>
                                             <span className="text-[10px] text-slate-300 bg-black/50 px-2 py-1 rounded border border-white/5">{t.common.ui.total}: {totalSelected}</span>
                                         </div>
                                         
                                         <div className="p-2 space-y-1">
                                             {availableUnits.length === 0 ? (
                                                <div className="text-center text-slate-500 text-xs py-10 flex flex-col items-center gap-2">
                                                    <Icons.Warning className="w-8 h-8 opacity-20" />
                                                    {t.errors.insufficient_units}
                                                </div>
                                             ) : (
                                                availableUnits.map(([uTypeString, max]) => {
                                                    const uType = uTypeString as UnitType;
                                                    const current = selectedUnits[uType] || 0;
                                                    const def = UNIT_DEFS[uType];
                                                    const name = t.units[def.translationKey]?.name || uType;
                                                    
                                                    const isSelected = current > 0;
                                                    
                                                    return (
                                                        <div key={uType} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 border-b border-white/5 last:border-0 rounded transition-colors gap-3 ${isSelected ? 'bg-cyan-900/20 border-cyan-500/20' : 'hover:bg-white/5'}`}>
                                                            <div className="flex justify-between sm:flex-col sm:justify-start">
                                                                <div className={`text-xs font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-300'}`}>{name}</div>
                                                                <div className="text-[10px] text-slate-500 font-mono">Max: {formatNumber(max)}</div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 bg-black/50 rounded-lg p-1 border border-white/5 sm:w-auto w-full justify-center">
                                                                <button onClick={() => handleUnitChange(uType, -5)} className="text-[10px] font-mono text-slate-500 hover:text-white px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded active:scale-95 transition-all">-5</button>
                                                                <button onClick={() => handleUnitChange(uType, -1)} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded text-slate-300 flex items-center justify-center font-bold active:scale-95 transition-all">-</button>
                                                                <input 
                                                                    type="number"
                                                                    value={current === 0 ? '' : current}
                                                                    onChange={(e) => handleUnitSet(uType, parseInt(e.target.value) || 0)}
                                                                    placeholder="0"
                                                                    className={`w-14 bg-transparent text-center font-mono text-sm font-bold focus:outline-none border-b border-transparent focus:border-cyan-500/50 transition-colors ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`}
                                                                />
                                                                <button onClick={() => handleUnitChange(uType, 1)} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded text-white flex items-center justify-center font-bold active:scale-95 transition-all">+</button>
                                                                <button onClick={() => handleUnitChange(uType, 5)} className="text-[10px] font-mono text-slate-500 hover:text-white px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded active:scale-95 transition-all">+5</button>
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                             )}
                                         </div>
                                     </div>
                                 </div>
                            </div>

                            {/* Action Bar */}
                            <div className="mt-auto md:mt-0 p-4 border-t border-white/10 bg-slate-950/95 backdrop-blur-xl md:bg-black/40 shrink-0 z-20 md:border-0 md:shadow-none">
                                 {availableSlots <= 0 ? (
                                     <div className="w-full py-4 text-center text-xs font-bold tracking-widest text-red-400 bg-red-950/30 border border-red-500/30 rounded-lg uppercase flex items-center justify-center gap-2">
                                         <Icons.Warning /> {t.errors.campaign_slots_full || "No Command Slots Available"}
                                     </div>
                                 ) : (
                                     <GlassButton 
                                        onClick={handleAttack} 
                                        disabled={totalSelected === 0 || activeCampaignMissions.some(m => m.levelId === selectedLevel.id)}
                                        variant="primary"
                                        className="w-full py-4 text-sm font-bold tracking-[0.2em] shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_40px_rgba(6,182,212,0.5)] transition-all"
                                     >
                                         {activeCampaignMissions.some(m => m.levelId === selectedLevel.id) 
                                            ? t.errors.campaign_busy 
                                            : `${t.campaign.launch_assault} (15m)`}
                                     </GlassButton>
                                 )}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm font-tech uppercase tracking-widest opacity-50 bg-[url('https://www.transparenttextures.com/patterns/tactical-grid.png')]">
                            <div className="w-20 h-20 border border-slate-700 rounded-full flex items-center justify-center mb-4 border-dashed bg-black/50">
                                <Icons.Map />
                            </div>
                            <div>{t.common.ui.select_op}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
