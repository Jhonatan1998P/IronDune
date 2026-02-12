
import React, { useState, useEffect } from 'react';
import { CAMPAIGN_COOLDOWN, CAMPAIGN_TRAVEL_TIME } from '../../constants';
import { CAMPAIGN_LEVELS } from '../../data/campaigns';
import { UNIT_DEFS } from '../../data/units';
import { GameState, ResourceType, UnitType } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { GlassButton, Icons, SpeedUpButton } from '../UIComponents';
import { formatNumber, formatDuration } from '../../utils';
import { BASE_PRICES } from '../../utils/engine/market';

interface CampaignProps {
    gameState: GameState;
    onExecuteBattle: (levelId: number, units: Partial<Record<UnitType, number>>) => boolean | null;
    onSpeedUp: (targetId: string, type: 'BUILD' | 'RECRUIT' | 'RESEARCH' | 'MISSION') => void;
}

export const CampaignView: React.FC<CampaignProps> = ({ gameState, onExecuteBattle, onSpeedUp }) => {
    const { t } = useLanguage();
    const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
    const [selectedUnits, setSelectedUnits] = useState<Partial<Record<UnitType, number>>>({});

    useEffect(() => {
        const isDesktop = window.matchMedia("(min-width: 768px)").matches;
        if (isDesktop && selectedLevelId === null) {
            setSelectedLevelId(gameState.campaignProgress);
        }
    }, []);

    const activeCampaignMission = gameState.activeMissions.find(m => m.type === 'CAMPAIGN_ATTACK');
    const now = Date.now();
    const cooldownRemaining = Math.max(0, (gameState.lastCampaignMissionFinishedTime + CAMPAIGN_COOLDOWN) - now);
    const isCoolingDown = cooldownRemaining > 0 && !activeCampaignMission;
    
    const selectedLevel = CAMPAIGN_LEVELS.find(l => l.id === selectedLevelId);
    const availableUnits = (Object.entries(gameState.units) as [UnitType, number][]).filter(([, count]) => count > 0);
    
    const handleUnitChange = (type: UnitType, change: number) => {
        setSelectedUnits(prev => {
            const currentVal = prev[type] || 0;
            const maxVal = gameState.units[type];
            const newVal = Math.max(0, Math.min(maxVal, currentVal + change));
            if (newVal === 0) {
                const { [type]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [type]: newVal };
        });
    };

    const handleUnitSet = (type: UnitType, val: number) => {
        setSelectedUnits(prev => {
            const maxVal = gameState.units[type];
            const newVal = Math.max(0, Math.min(maxVal, val));
            if (newVal === 0) {
                const { [type]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [type]: newVal };
        });
    };

    const handleAttack = () => {
        if (selectedLevelId) {
            const success = onExecuteBattle(selectedLevelId, selectedUnits);
            if (success) {
                setSelectedUnits({});
            }
        }
    };

    const handleBackToMap = () => {
        setSelectedLevelId(null);
        setSelectedUnits({});
    };

    const totalSelected = Object.values(selectedUnits).reduce((a: number, b) => a + ((b as number) || 0), 0);

    // Calculate Estimated Loot Value Range (1% - 5%)
    const calculateLootPotential = (levelId: number) => {
        const level = CAMPAIGN_LEVELS.find(l => l.id === levelId);
        if (!level) return { min: 0, max: 0 };
        
        let totalValue = 0;
        Object.entries(level.enemyArmy).forEach(([uType, count]) => {
            const def = UNIT_DEFS[uType as UnitType];
            if (def && count) {
                const unitVal = 
                    (def.cost.money * BASE_PRICES[ResourceType.MONEY]) + 
                    (def.cost.oil * BASE_PRICES[ResourceType.OIL]) + 
                    (def.cost.ammo * BASE_PRICES[ResourceType.AMMO]);
                totalValue += unitVal * (count as number);
            }
        });

        // Range 1% to 5%
        return {
            min: Math.floor(totalValue * 0.01),
            max: Math.floor(totalValue * 0.05)
        };
    };

    if (activeCampaignMission) {
        const timeRem = Math.max(0, activeCampaignMission.endTime - now);
        const totalTime = CAMPAIGN_TRAVEL_TIME;
        const progress = 100 - (timeRem / totalTime * 100);
        
        return (
            <div className="h-full flex items-center justify-center animate-[fadeIn_0.3s_ease-out] p-4">
                <div className="glass-panel max-w-2xl w-full p-6 md:p-8 text-center relative overflow-hidden border-cyan-500/50 flex flex-col items-center justify-center min-h-[50vh]">
                    <div className="absolute inset-0 bg-cyan-500/5 animate-pulse"></div>
                    <div className="relative z-10 w-full flex flex-col items-center">
                        <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-cyan-900/30 rounded-full flex items-center justify-center border-2 border-cyan-400/50 shadow-[0_0_30px_rgba(6,182,212,0.3)] mb-6">
                             <Icons.Radar />
                        </div>
                        <h2 className="font-tech text-xl md:text-2xl text-cyan-300 uppercase tracking-[0.2em] mb-2">{t.campaign.mission_in_progress}</h2>
                        <p className="text-slate-400 font-mono text-sm mb-6">OP-{activeCampaignMission.levelId} // {t.common.ui.sat_link}</p>
                        
                        <div className="flex items-center gap-4 mb-8">
                            <div className="text-3xl md:text-4xl font-mono font-bold text-white tracking-wider">{formatDuration(timeRem)}</div>
                            <SpeedUpButton 
                                onClick={() => onSpeedUp(activeCampaignMission.id, 'MISSION')} 
                                disabled={gameState.resources.DIAMOND < 1}
                            />
                        </div>
                        
                        <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">{t.campaign.eta}</div>

                        <div className="h-2 bg-slate-900 rounded-full overflow-hidden max-w-md mx-auto border border-white/10 w-full">
                            <div className="h-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isCoolingDown) {
        const progress = 100 - (cooldownRemaining / CAMPAIGN_COOLDOWN * 100);
        return (
            <div className="h-full flex items-center justify-center animate-[fadeIn_0.3s_ease-out] p-4">
                <div className="glass-panel max-w-xl w-full p-6 md:p-8 text-center relative border-orange-500/30 flex flex-col items-center justify-center min-h-[50vh]">
                    <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-orange-900/20 rounded-full flex items-center justify-center border border-orange-500/50 mb-4">
                        <Icons.Clock className="w-8 h-8 md:w-10 md:h-10 text-orange-400" />
                    </div>
                    <h2 className="font-tech text-lg md:text-xl text-orange-400 uppercase tracking-widest mb-4">{t.campaign.cooldown_msg}</h2>
                    <div className="text-2xl md:text-3xl font-mono text-white mb-6">{formatDuration(cooldownRemaining)}</div>
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                         <div className="h-full bg-orange-500" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4 font-mono">{t.common.ui.resupplying}</p>
                </div>
            </div>
        );
    }

    const lootPotential = selectedLevel ? calculateLootPotential(selectedLevel.id) : { min: 0, max: 0 };

    return (
        <div className="flex h-full flex-col md:flex-row gap-4 animate-[fadeIn_0.3s_ease-out] overflow-hidden relative">
            <div className={`
                w-full md:w-1/3 glass-panel flex flex-col overflow-hidden border-r border-white/5 h-full
                ${selectedLevelId !== null ? 'hidden md:flex' : 'flex'}
            `}>
                <div className="p-4 border-b border-white/10 bg-black/20 shrink-0">
                     <h3 className="font-tech text-cyan-400 uppercase tracking-widest text-sm flex items-center gap-2">
                        <Icons.Menu /> {t.common.ui.mission_list}
                     </h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {CAMPAIGN_LEVELS.map((level, idx) => {
                        const isLocked = level.id > gameState.campaignProgress;
                        const isCompleted = level.id < gameState.campaignProgress;
                        const isCurrent = level.id === gameState.campaignProgress;
                        const isSelected = selectedLevelId === level.id;

                        return (
                            <button
                                key={level.id}
                                onClick={() => !isLocked && setSelectedLevelId(level.id)}
                                disabled={isLocked}
                                className={`
                                    w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left relative group min-h-[60px]
                                    ${isSelected ? 'bg-white/10 border-white/30' : 'border-transparent hover:bg-white/5'}
                                    ${isLocked ? 'opacity-40 cursor-not-allowed grayscale' : ''}
                                `}
                            >
                                {idx < CAMPAIGN_LEVELS.length - 1 && (
                                    <div className="absolute left-[19px] top-8 bottom-[-20px] w-0.5 bg-white/10 -z-10 group-hover:bg-white/20"></div>
                                )}

                                <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center border ${
                                    isCompleted ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                                    isCurrent ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 animate-pulse' :
                                    'bg-slate-800 border-slate-600 text-slate-500'
                                }`}>
                                    {isLocked ? <Icons.Lock /> : isCompleted ? <Icons.Crown /> : <span className="text-xs font-bold">{level.id}</span>}
                                </div>

                                <div className="flex-1">
                                    <div className={`text-xs font-bold uppercase tracking-wider ${isCurrent ? 'text-cyan-300' : 'text-slate-300'}`}>
                                        {t.campaign.levels[level.nameKey]?.title || level.nameKey}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                        {level.difficulty}
                                    </div>
                                </div>
                                
                                <div className="md:hidden text-slate-600">
                                    <Icons.ChevronRight />
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className={`
                w-full md:w-2/3 glass-panel flex flex-col overflow-hidden relative h-full
                ${selectedLevelId !== null ? 'flex' : 'hidden md:flex'}
            `}>
                {selectedLevel ? (
                    <>
                        <div className="p-4 md:p-6 border-b border-white/10 bg-gradient-to-r from-black/40 to-transparent relative shrink-0 z-10">
                             <button 
                                onClick={handleBackToMap}
                                className="md:hidden absolute top-4 right-4 p-2 bg-white/5 rounded-full text-slate-400 hover:text-white border border-white/10"
                             >
                                <Icons.ArrowLeft />
                             </button>

                             <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl md:text-6xl font-tech font-bold text-white pointer-events-none hidden md:block">
                                 OP-{selectedLevel.id}
                             </div>
                             
                             <div className="flex items-center gap-2 mb-1">
                                <span className="bg-cyan-950 text-cyan-400 text-[10px] px-1.5 py-0.5 rounded border border-cyan-500/20">OP-{selectedLevel.id}</span>
                                <h2 className="font-tech text-lg md:text-2xl text-white uppercase tracking-widest shadow-glow truncate">
                                    {t.campaign.levels[selectedLevel.nameKey]?.title || selectedLevel.nameKey}
                                </h2>
                             </div>
                             <p className="text-xs md:text-sm text-cyan-400 font-mono max-w-md line-clamp-2 md:line-clamp-none">
                                 {t.campaign.levels[selectedLevel.nameKey]?.desc || selectedLevel.descriptionKey}
                             </p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
                             <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                 <div className="space-y-4">
                                     <div>
                                        <div className="flex items-center gap-2 text-xs text-red-400 uppercase tracking-widest border-b border-red-500/20 pb-2 mb-2">
                                            <Icons.Radar /> {t.campaign.intel_report}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(selectedLevel.enemyArmy).map(([u, count]) => {
                                                const def = UNIT_DEFS[u as UnitType];
                                                return (
                                                    <div key={u} className="flex justify-between items-center text-xs bg-red-950/20 p-2 rounded border border-red-500/10 text-red-200">
                                                        <span className="truncate mr-2">{t.units[def.translationKey]?.name}</span>
                                                        <span className="font-mono font-bold bg-red-900/40 px-1 rounded">{count}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                     </div>

                                     <div>
                                        <div className="flex items-center gap-2 text-xs text-emerald-400 uppercase tracking-widest border-b border-emerald-500/20 pb-2 mb-2 mt-2">
                                            <Icons.Crown /> {t.campaign.rewards} <span className="text-[10px] text-slate-500 ml-auto lowercase opacity-70">{t.common.ui.loot_reroll}</span>
                                        </div>
                                        
                                        {/* Dynamic Loot Preview (Simplified as requested) */}
                                        <div className="bg-emerald-950/10 p-3 rounded border border-emerald-500/10">
                                            <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">{t.common.ui.loot_estimated}</div>
                                            <div className="text-lg font-mono font-bold text-emerald-300">
                                                ${formatNumber(lootPotential.min)} - ${formatNumber(lootPotential.max)}
                                            </div>
                                        </div>
                                     </div>
                                 </div>

                                 <div className="flex flex-col bg-slate-900/40 rounded-xl border border-white/5 overflow-hidden h-max">
                                     <div className="p-3 bg-black/20 text-xs text-cyan-400 uppercase tracking-widest border-b border-white/5 flex justify-between items-center">
                                         <span>{t.common.ui.strike_force}</span>
                                         <span className="text-[10px] text-slate-500">{t.common.ui.total}: {totalSelected}</span>
                                     </div>
                                     <div className="p-2 space-y-1">
                                         {availableUnits.length === 0 ? (
                                            <div className="text-center text-slate-500 text-xs py-10">{t.errors.insufficient_units}</div>
                                         ) : (
                                            availableUnits.map(([uTypeString, max]) => {
                                                const uType = uTypeString as UnitType;
                                                const current = selectedUnits[uType] || 0;
                                                const def = UNIT_DEFS[uType];
                                                const name = t.units[def.translationKey]?.name || uType;
                                                return (
                                                    <div key={uType} className="flex items-center justify-between p-2 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors rounded">
                                                        <div className="text-xs">
                                                            <div className="text-slate-300 font-medium">{name}</div>
                                                            <div className="text-[10px] text-slate-500">Max: {formatNumber(max)}</div>
                                                        </div>
                                                        <div className="flex items-center gap-3 bg-black/30 rounded px-2 py-1 border border-white/5">
                                                            <button onClick={() => handleUnitChange(uType, -5)} className="text-[10px] text-slate-500 hover:text-white px-1">-5</button>
                                                            <button onClick={() => handleUnitChange(uType, -1)} className="w-6 h-6 bg-white/5 hover:bg-white/10 rounded text-slate-400 flex items-center justify-center">-</button>
                                                            <input 
                                                                type="number"
                                                                value={current === 0 ? '' : current}
                                                                onChange={(e) => handleUnitSet(uType, parseInt(e.target.value) || 0)}
                                                                placeholder="0"
                                                                className="w-10 bg-transparent text-center font-mono text-xs font-bold text-cyan-400 focus:outline-none border-b border-transparent focus:border-cyan-500/50"
                                                            />
                                                            <button onClick={() => handleUnitChange(uType, 1)} className="w-6 h-6 bg-white/5 hover:bg-white/10 rounded text-white flex items-center justify-center">+</button>
                                                            <button onClick={() => handleUnitChange(uType, 5)} className="text-[10px] text-slate-500 hover:text-white px-1">+5</button>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                         )}
                                     </div>
                                 </div>
                             </div>
                             <div className="h-4"></div>
                        </div>

                        <div className="p-4 border-t border-white/10 bg-black/40 backdrop-blur-sm shrink-0 z-20">
                             <GlassButton 
                                onClick={handleAttack} 
                                disabled={totalSelected === 0}
                                variant="danger"
                                className="w-full py-3 md:py-4 text-sm font-bold tracking-[0.2em] shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_40px_rgba(239,68,68,0.5)] transition-all"
                             >
                                 {t.campaign.launch_assault} (7.5m)
                             </GlassButton>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 text-sm font-tech uppercase tracking-widest opacity-50">
                        <div className="w-16 h-16 border-2 border-slate-700 rounded-full flex items-center justify-center mb-4 border-dashed">
                            <Icons.Radar />
                        </div>
                        <div>{t.common.ui.select_op}</div>
                    </div>
                )}
            </div>
        </div>
    );
};
