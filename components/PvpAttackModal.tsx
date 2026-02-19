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
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center sm:p-4 bg-black/90 backdrop-blur-xl animate-[fadeIn_0.2s_ease-out]">
            <div 
                className={`
                    w-full md:max-w-lg bg-slate-900 border-t md:border border-white/10 flex flex-col overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.15)] 
                    rounded-t-2xl md:rounded-xl max-h-[85vh] md:max-h-[90vh]
                    ${isWarTarget ? 'border-red-500/30' : 'border-yellow-500/30'}
                `}
            >
                <div className={`p-4 border-b border-white/10 flex justify-between items-center ${isWarTarget ? 'bg-red-950/20' : 'bg-yellow-950/20'} shrink-0`}>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Icons.Army />
                            <span className={`text-xs uppercase tracking-widest font-bold ${isWarTarget ? 'text-red-500' : 'text-yellow-500'}`}>
                                {isWarTarget ? t.common.war.title : t.common.ui.tactical_op}
                            </span>
                        </div>
                        <h2 className="font-tech text-lg md:text-xl text-white uppercase tracking-wider truncate max-w-[250px]">{target.name}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full bg-black/20 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                        <Icons.Close />
                    </button>
                </div>

                <div className="p-4 bg-black/30 flex flex-col gap-3 border-b border-white/5 shrink-0">
                    <div className="flex justify-between items-center">
                        <div className="text-center flex-1">
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest">{t.common.ui.est_power}</div>
                            <div className="font-mono text-yellow-400 font-bold">{formatNumber(target.score)}</div>
                        </div>
                        <div className="h-8 w-px bg-white/10"></div>
                        <div className="text-center flex-1">
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest">{t.common.ui.travel_time}</div>
                            <div className={`font-mono ${useDiamond ? 'text-cyan-300' : 'text-slate-300'}`}>{formatDuration(travelTime)}</div>
                        </div>
                    </div>

                    <div 
                        onClick={() => hasDiamonds && setUseDiamond(!useDiamond)}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all active:scale-[0.98] ${useDiamond ? 'bg-cyan-900/30 border-cyan-500/50' : 'bg-black/20 border-white/5 hover:bg-white/5'} ${!hasDiamonds ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${useDiamond ? 'bg-cyan-500 border-cyan-500' : 'border-slate-500'}`}>
                                {useDiamond && <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className="text-xs font-bold text-cyan-100">{t.common.actions.rapid_deployment}</span>
                        </div>
                        <span className="text-xs font-bold text-cyan-300 bg-cyan-950/50 px-2 py-1 rounded border border-cyan-500/30 flex items-center gap-1">
                            <Icons.Resources.Diamond className="w-3 h-3" /> 1
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{t.missions.patrol.select_units}</h3>
                    <div className="space-y-1">
                        {availableUnits.length === 0 ? (
                            <div className="text-center text-slate-500 text-xs py-10">{t.errors.insufficient_units}</div>
                        ) : (
                            availableUnits.map(([uTypeString, max]) => {
                                const uType = uTypeString as UnitType;
                                const current = selectedUnits[uType] || 0;
                                const def = UNIT_DEFS[uType];
                                const name = t.units[def.translationKey]?.name || uType;
                                return (
                                    <div key={uType} className="flex items-center justify-between p-2 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors rounded bg-slate-900/40">
                                        <div className="text-xs">
                                            <div className="text-slate-300 font-bold">{name}</div>
                                            <div className="text-[10px] text-slate-500">Max: {formatNumber(max)}</div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-black/30 rounded px-1 py-1 border border-white/5">
                                            <button onClick={() => handleUnitChange(uType, -5)} className="text-[9px] text-slate-500 hover:text-white px-2 py-1 active:bg-white/10 rounded">-5</button>
                                            <button onClick={() => handleUnitChange(uType, -1)} className="w-8 h-8 bg-white/5 hover:bg-white/10 active:bg-white/20 rounded text-slate-400 flex items-center justify-center transition-colors">-</button>
                                            <input 
                                                type="number"
                                                value={current === 0 ? '' : current}
                                                onChange={(e) => handleUnitSet(uType, parseInt(e.target.value) || 0)}
                                                placeholder="0"
                                                className="w-12 bg-transparent text-center font-mono text-xs font-bold text-yellow-400 focus:outline-none border-b border-transparent focus:border-yellow-500/50"
                                            />
                                            <button onClick={() => handleUnitChange(uType, 1)} className="w-8 h-8 bg-white/5 hover:bg-white/10 active:bg-white/20 rounded text-white flex items-center justify-center transition-colors">+</button>
                                            <button onClick={() => handleUnitChange(uType, 5)} className="text-[9px] text-slate-500 hover:text-white px-2 py-1 active:bg-white/10 rounded">+5</button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-white/10 bg-black/40 shrink-0 safe-area-bottom space-y-2">
                    {!isWarTarget && (
                        <div className="space-y-1">
                            <GlassButton 
                                onClick={handleLaunch} 
                                disabled={totalSelected === 0 || limitReached || isWarActiveWithSomeoneElse}
                                variant="primary"
                                className="w-full py-3 text-sm font-bold tracking-[0.2em]"
                            >
                                {isWarActiveWithSomeoneElse 
                                    ? t.common.actions.locked_war
                                    : limitReached 
                                        ? `${t.common.actions.limit_reached} (0/3)` 
                                        : `${t.common.actions.launch_raid} (${attacksRemaining}/3)`}
                            </GlassButton>
                            <p className="text-[10px] text-center text-slate-500">
                                {t.common.ui.raid_capacity_info.replace('{factor}', (PVP_LOOT_FACTOR * 100).toString())}
                            </p>
                        </div>
                    )}

                    {isWarTarget && (
                        <GlassButton 
                            onClick={handleLaunch} 
                            disabled={totalSelected === 0}
                            variant="danger"
                            className="w-full py-4 text-sm font-bold tracking-[0.2em] shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                        >
                            {t.common.actions.launch_war}
                        </GlassButton>
                    )}
                </div>
            </div>
        </div>
    );
};