import React, { useState } from 'react';
import { GameState, ResourceType, UnitType } from '../types';
import { UNIT_DEFS } from '../data/units';
import { GlassButton, Icons } from './UIComponents';
import { useLanguage } from '../context/LanguageContext';
import { formatNumber, formatDuration } from '../utils';
import { executePvpAttack } from '../utils/engine/actions';
import { PVP_TRAVEL_TIME_MS, MAX_ATTACKS_PER_TARGET, PVP_LOOT_FACTOR } from '../constants';

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
            alert(t.errors[result.errorKey || 'invalid_mission']);
        }
    };

    const availableUnits = (Object.entries(gameState.units) as [UnitType, number][]).filter(([, count]) => count > 0);
    const totalSelected = Object.values(selectedUnits).reduce((a: number, b) => a + ((b as number) || 0), 0);
    
    let travelTime = PVP_TRAVEL_TIME_MS;
    if (useDiamond) {
        travelTime = PVP_TRAVEL_TIME_MS * 0.2;
    }
    
    const hasDiamonds = gameState.resources[ResourceType.DIAMOND] >= 1;

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/90 backdrop-blur-xl animate-[fadeIn_0.2s_ease-out]">
            <div 
                className={`
                    w-full md:max-w-xl bg-slate-900 border-t md:border border-white/10 flex flex-col overflow-hidden shadow-[0_0_60px_rgba(234,179,8,0.2)] 
                    rounded-t-[2.5rem] md:rounded-3xl max-h-[95vh] md:max-h-[85vh]
                    ${isWarTarget ? 'border-red-500/40' : 'border-yellow-500/40'}
                `}
            >
                {/* Header - Fixed */}
                <div className={`shrink-0 p-5 md:p-6 border-b border-white/10 flex justify-between items-center ${isWarTarget ? 'bg-red-950/30' : 'bg-yellow-950/30'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${isWarTarget ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                            <Icons.Army className="w-6 h-6" />
                        </div>
                        <div>
                            <span className={`text-[10px] uppercase tracking-[0.2em] font-black ${isWarTarget ? 'text-red-500' : 'text-yellow-500'}`}>
                                {isWarTarget ? t.common.war.title : t.common.ui.tactical_op}
                            </span>
                            <h2 className="font-tech text-xl md:text-2xl text-white uppercase tracking-wider truncate max-w-[200px] md:max-w-[300px] leading-tight">
                                {target.name}
                            </h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-2xl bg-black/40 hover:bg-white/10 text-slate-400 hover:text-white transition-all active:scale-90">
                        <Icons.Close className="w-6 h-6" />
                    </button>
                </div>

                {/* All Content - Scrollable */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8 space-y-8">
                    
                    {/* Stats Card */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">{t.common.ui.est_power}</div>
                            <div className="font-mono text-xl text-yellow-400 font-black">{formatNumber(target.score)}</div>
                        </div>
                        <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">{t.common.ui.travel_time}</div>
                            <div className={`font-mono text-xl font-black ${useDiamond ? 'text-cyan-400' : 'text-slate-300'}`}>
                                {formatDuration(travelTime)}
                            </div>
                        </div>
                    </div>

                    {/* Speed Up Option */}
                    <div 
                        onClick={() => hasDiamonds && setUseDiamond(!useDiamond)}
                        className={`group relative flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all active:scale-[0.98] ${useDiamond ? 'bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]' : 'bg-black/40 border-white/5 hover:border-white/20'} ${!hasDiamonds ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${useDiamond ? 'bg-cyan-500 border-cyan-500' : 'border-slate-700 group-hover:border-slate-500'}`}>
                                {useDiamond && <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <div>
                                <div className="text-xs font-black text-cyan-100 uppercase tracking-wider">{t.common.actions.rapid_deployment}</div>
                                <div className="text-[10px] text-slate-500">{t.common.ui.instant_arrival_desc || "Reduce travel time by 80%"}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 bg-cyan-950/50 px-3 py-1.5 rounded-xl border border-cyan-500/30">
                            <Icons.Resources.Diamond className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm font-black text-cyan-300">1</span>
                        </div>
                    </div>

                    {/* Unit Selection */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{t.missions.patrol.select_units}</h3>
                            <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">
                                {t.reports.deployed}: {formatNumber(totalSelected)}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                            {availableUnits.length === 0 ? (
                                <div className="text-center text-slate-500 text-xs py-12 bg-black/20 rounded-2xl border border-dashed border-white/10">
                                    {t.errors.insufficient_units}
                                </div>
                            ) : (
                                availableUnits.map(([uTypeString, max]) => {
                                    const uType = uTypeString as UnitType;
                                    const current = selectedUnits[uType] || 0;
                                    const def = UNIT_DEFS[uType];
                                    const name = t.units[def.translationKey]?.name || uType;
                                    return (
                                        <div key={uType} className="group flex items-center justify-between p-3 pl-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-2xl transition-all">
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="text-sm font-bold text-slate-200 truncate">{name}</div>
                                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">AVAIL: {formatNumber(max)}</div>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                                                <button 
                                                    onClick={() => handleUnitChange(uType, -10)} 
                                                    className="hidden sm:block text-[10px] text-slate-600 hover:text-white px-2 py-1.5 transition-colors font-bold"
                                                >
                                                    -10
                                                </button>
                                                <button 
                                                    onClick={() => handleUnitChange(uType, -1)} 
                                                    className="w-10 h-10 bg-white/5 hover:bg-red-500/20 active:scale-90 rounded-lg text-slate-400 hover:text-red-400 flex items-center justify-center transition-all"
                                                >
                                                    <span className="text-xl font-light">-</span>
                                                </button>
                                                
                                                <div className="relative w-16 group/input">
                                                    <input 
                                                        type="number"
                                                        value={current === 0 ? '' : current}
                                                        onChange={(e) => handleUnitSet(uType, parseInt(e.target.value) || 0)}
                                                        placeholder="0"
                                                        className="w-full bg-transparent text-center font-mono text-sm font-black text-yellow-400 focus:outline-none"
                                                    />
                                                    <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-yellow-500/20 group-focus-within/input:bg-yellow-500 transition-colors rounded-full"></div>
                                                </div>

                                                <button 
                                                    onClick={() => handleUnitChange(uType, 1)} 
                                                    className="w-10 h-10 bg-white/5 hover:bg-emerald-500/20 active:scale-90 rounded-lg text-slate-400 hover:text-emerald-400 flex items-center justify-center transition-all"
                                                >
                                                    <span className="text-xl font-light">+</span>
                                                </button>
                                                <button 
                                                    onClick={() => handleUnitChange(uType, 10)} 
                                                    className="hidden sm:block text-[10px] text-slate-600 hover:text-white px-2 py-1.5 transition-colors font-bold"
                                                >
                                                    +10
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer - Sticky */}
                <div className="shrink-0 p-5 md:p-8 border-t border-white/10 bg-slate-950/80 backdrop-blur-md safe-area-bottom space-y-3">
                    <div className="flex justify-between items-center px-2 mb-2">
                         <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{t.common.ui.total_troops}</span>
                         <span className="text-sm font-mono text-white font-black">{formatNumber(totalSelected)}</span>
                    </div>

                    {!isWarTarget && (
                        <div className="space-y-3">
                            <button 
                                onClick={handleLaunch} 
                                disabled={totalSelected === 0 || limitReached || isWarActiveWithSomeoneElse}
                                className={`
                                    w-full py-5 rounded-2xl text-sm font-black uppercase tracking-[0.3em] transition-all active:scale-[0.97]
                                    ${(totalSelected === 0 || limitReached || isWarActiveWithSomeoneElse)
                                        ? 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'
                                        : 'bg-gradient-to-r from-yellow-500 to-amber-600 text-black shadow-[0_10px_30px_rgba(245,158,11,0.3)] hover:shadow-[0_15px_40px_rgba(245,158,11,0.4)] hover:-translate-y-0.5'}
                                `}
                            >
                                {isWarActiveWithSomeoneElse 
                                    ? t.common.actions.locked_war
                                    : limitReached 
                                        ? `${t.common.actions.limit_reached} (0/3)` 
                                        : `${t.common.actions.launch_raid} (${attacksRemaining}/3)`}
                            </button>
                            <p className="text-[10px] text-center text-slate-500 font-medium px-4 leading-relaxed">
                                {t.common.ui.raid_capacity_info.replace('{factor}', (PVP_LOOT_FACTOR * 100).toString())}
                            </p>
                        </div>
                    )}

                    {isWarTarget && (
                        <button 
                            onClick={handleLaunch} 
                            disabled={totalSelected === 0}
                            className={`
                                w-full py-5 rounded-2xl text-sm font-black uppercase tracking-[0.3em] transition-all active:scale-[0.97]
                                ${totalSelected === 0
                                    ? 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'
                                    : 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-[0_10px_30px_rgba(225,29,72,0.4)] hover:shadow-[0_15px_40px_rgba(225,29,72,0.5)] hover:-translate-y-0.5'}
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