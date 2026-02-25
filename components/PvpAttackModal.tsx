import React, { useState } from 'react';
import { GameState, ResourceType, UnitType } from '../types';
import { UNIT_DEFS } from '../data/units';
import { Icons } from './UIComponents';
import { useLanguage } from '../context/LanguageContext';
import { formatNumber, formatDuration } from '../utils';
import { executePvpAttack } from '../utils/engine/actions';
import { PVP_TRAVEL_TIME_MS, MAX_ATTACKS_PER_TARGET } from '../constants';

interface PvpAttackModalProps {
    target: { id: string; name: string; score: number };
    gameState: GameState;
    onClose: () => void;
    onAttackSent: (newState: GameState) => void;
}

export const PvpAttackModal: React.FC<PvpAttackModalProps> = ({ target, gameState, onClose, onAttackSent }) => {
    const { t } = useLanguage();
    const [selectedUnits, setSelectedUnits] = useState<Partial<Record<UnitType, number>>>({});
    const [useDiamond, setUseDiamond] = useState(false);

    const activeWar = gameState.activeWar;
    const isWarTarget = activeWar && activeWar.enemyId === target.id;
    const isWarActiveWithSomeoneElse = activeWar && !isWarTarget;
    
    const attackCount = gameState.targetAttackCounts[target.id] || 0;
    const attacksRemaining = Math.max(0, MAX_ATTACKS_PER_TARGET - attackCount);
    const limitReached = attacksRemaining === 0;

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

    const handleLaunch = () => {
        const result = executePvpAttack(gameState, target.id, target.name, target.score, selectedUnits, useDiamond);
        if (result.success && result.newState) {
            onAttackSent(result.newState);
            onClose();
        } else {
            const errorKey = (result.errorKey || 'invalid_mission') as keyof typeof t.errors;
            alert(t.errors[errorKey] || t.errors.insufficient_funds);
        }
    };

    const availableUnits = (Object.entries(gameState.units) as [UnitType, number][]).filter(([, count]) => count > 0);
    const totalSelected = Object.values(selectedUnits).reduce((a: number, b) => a + ((b as number) || 0), 0);
    
    let travelTime = PVP_TRAVEL_TIME_MS;
    if (useDiamond) travelTime = PVP_TRAVEL_TIME_MS * 0.2;
    
    const hasDiamonds = gameState.resources[ResourceType.DIAMOND] >= 1;

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out] md:p-4">
            <div 
                className={`
                    w-full md:max-w-lg glass-panel rounded-t-2xl md:rounded-2xl border flex flex-col
                    ${isWarTarget ? 'border-red-500/30' : 'border-white/10'}
                    h-[90dvh] md:h-[85vh] md:max-h-[700px]
                `}
            >
                <div className={`shrink-0 p-3 md:p-4 border-b border-white/10 flex items-center justify-between ${isWarTarget ? 'bg-red-950/30' : 'bg-black/40'}`}>
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <div className={`p-2 rounded-lg md:rounded-xl shrink-0 ${isWarTarget ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            <Icons.Army className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div className="min-w-0">
                            <span className={`text-[8px] md:text-[9px] uppercase tracking-widest font-bold ${isWarTarget ? 'text-red-400' : 'text-yellow-400'}`}>
                                {isWarTarget ? t.common.war.title : t.common.ui.tactical_op}
                            </span>
                            <h2 className="font-tech text-sm md:text-base text-white uppercase tracking-wide truncate max-w-[140px] md:max-w-[200px] lg:max-w-[250px]">
                                {target.name}
                            </h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg bg-black/40 hover:bg-white/10 text-slate-500 hover:text-white transition-colors shrink-0">
                        <Icons.Close className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-3 md:p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2 md:gap-3">
                            <div className="glass-panel p-2 md:p-3 rounded-lg md:rounded-xl border border-white/5 flex flex-col items-center justify-center">
                                <div className="text-[8px] md:text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-0.5 md:mb-1">{t.common.ui.est_power}</div>
                                <div className="font-mono text-sm md:text-lg text-yellow-400 font-bold">{formatNumber(target.score)}</div>
                            </div>
                            <div className="glass-panel p-2 md:p-3 rounded-lg md:rounded-xl border border-white/5 flex flex-col items-center justify-center">
                                <div className="text-[8px] md:text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-0.5 md:mb-1">{t.common.ui.travel_time}</div>
                                <div className={`font-mono text-sm md:text-lg font-bold ${useDiamond ? 'text-cyan-400' : 'text-white'}`}>
                                    {formatDuration(travelTime)}
                                </div>
                            </div>
                        </div>

                        <div 
                            onClick={() => hasDiamonds && setUseDiamond(!useDiamond)}
                            className={`flex items-center justify-between p-2 md:p-3 rounded-lg md:rounded-xl border cursor-pointer transition-all touch-manipulation ${useDiamond ? 'bg-cyan-950/30 border-cyan-500/30' : 'bg-black/40 border-white/5 hover:border-white/20'} ${!hasDiamonds ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <div className="flex items-center gap-2 md:gap-3">
                                <div className={`w-4 h-4 md:w-5 md:h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${useDiamond ? 'bg-cyan-500 border-cyan-500' : 'border-slate-600'}`}>
                                    {useDiamond && <Icons.Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-black" />}
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-cyan-100 uppercase tracking-wider">{t.common.actions.rapid_deployment}</div>
                                    <div className="text-[9px] md:text-[10px] text-slate-500 hidden sm:block">{t.common.ui.instant_arrival_desc || "Reduce travel time by 80%"}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 bg-cyan-950/50 px-1.5 md:px-2 py-1 rounded-md md:rounded-lg border border-cyan-500/30 shrink-0">
                                <Icons.Resources.Diamond className="w-3 h-3 md:w-3.5 md:h-3.5 text-cyan-400" />
                                <span className="text-xs font-bold text-cyan-300">1</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t.missions.patrol.select_units}</h3>
                                <span className="text-[9px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">
                                    {t.reports.deployed}: {formatNumber(totalSelected)}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-1.5 md:gap-2">
                                {availableUnits.length === 0 ? (
                                    <div className="text-center text-slate-500 text-xs py-6 md:py-8 bg-black/20 rounded-lg md:rounded-xl border border-dashed border-white/10">
                                        {t.errors.insufficient_units}
                                    </div>
                                ) : (
                                    availableUnits.map(([uTypeString, max]) => {
                                        const uType = uTypeString as UnitType;
                                        const current = selectedUnits[uType] || 0;
                                        const def = UNIT_DEFS[uType];
                                        const name = t.units[def.translationKey]?.name || uType;
                                        return (
                                            <div key={uType} className="flex items-center justify-between p-2 md:p-2.5 bg-black/20 hover:bg-white/[0.03] border border-white/5 rounded-lg md:rounded-xl transition-all">
                                                <div className="flex-1 min-w-0 pr-2 md:pr-3">
                                                    <div className="text-xs font-bold text-slate-200 truncate">{name}</div>
                                                    <div className="text-[9px] text-slate-500 font-mono">{formatNumber(max)}</div>
                                                </div>
                                                
                                                <div className="flex items-center gap-0.5 bg-black/40 p-0.5 md:p-1 rounded-md md:rounded-lg border border-white/5">
                                                    <button 
                                                        onClick={() => handleUnitChange(uType, -1)} 
                                                        className="w-7 h-7 md:w-8 md:h-8 bg-white/5 hover:bg-red-500/20 rounded-md text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors text-base md:text-sm active:scale-95"
                                                    >
                                                        −
                                                    </button>
                                                    
                                                    <input 
                                                        type="number"
                                                        value={current === 0 ? '' : current}
                                                        onChange={(e) => handleUnitSet(uType, parseInt(e.target.value) || 0)}
                                                        placeholder="0"
                                                        className="w-10 md:w-12 bg-transparent text-center font-mono text-xs md:text-sm font-bold text-yellow-400 focus:outline-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0"
                                                    />

                                                    <button 
                                                        onClick={() => handleUnitChange(uType, 1)} 
                                                        className="w-7 h-7 md:w-8 md:h-8 bg-white/5 hover:bg-emerald-500/20 rounded-md text-slate-400 hover:text-emerald-400 flex items-center justify-center transition-colors text-base md:text-sm active:scale-95"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 p-3 md:p-4 border-t border-white/10 bg-black/40 space-y-2 md:space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">{t.common.ui.total_troops}</span>
                        <span className="text-sm font-mono text-white font-bold">{formatNumber(totalSelected)}</span>
                    </div>

                    {!isWarTarget ? (
                        <button 
                            onClick={handleLaunch} 
                            disabled={totalSelected === 0 || limitReached || !!isWarActiveWithSomeoneElse}
                            className={`
                                w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-[0.98]
                                ${(totalSelected === 0 || limitReached || isWarActiveWithSomeoneElse)
                                    ? 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'
                                    : 'bg-yellow-500 hover:bg-yellow-400 text-black'}
                            `}
                        >
                            {isWarActiveWithSomeoneElse 
                                ? t.common.actions.locked_war
                                : limitReached 
                                    ? `${t.common.actions.limit_reached} (0/3)` 
                                    : `${t.common.actions.launch_raid} (${attacksRemaining}/3)`}
                        </button>
                    ) : (
                        <button 
                            onClick={handleLaunch} 
                            disabled={totalSelected === 0}
                            className={`
                                w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-[0.98]
                                ${totalSelected === 0
                                    ? 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'
                                    : 'bg-red-600 hover:bg-red-500 text-white'}
                            `}
                        >
                            {t.common.actions.launch_war}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
