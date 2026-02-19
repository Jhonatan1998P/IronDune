import React, { useState, useEffect } from 'react';
import { GameState, IncomingAttack, ResourceType, UnitType } from '../../types';
import { UNIT_DEFS } from '../../data/units';
import { useLanguage } from '../../context/LanguageContext';
import { GlassButton, Icons } from '../UIComponents';
import { formatNumber, formatDuration } from '../../utils';

interface TacticalInterceptModalProps {
    attack: IncomingAttack;
    gameState: GameState;
    onClose: () => void;
    onDecrypt: (attackId: string) => void;
}

export const TacticalInterceptModal: React.FC<TacticalInterceptModalProps> = ({ attack, gameState, onClose, onDecrypt }) => {
    const { t } = useLanguage();
    const [timeLeft, setTimeLeft] = useState(Math.max(0, attack.endTime - Date.now()));

    useEffect(() => {
        const timer = setInterval(() => {
            const next = Math.max(0, attack.endTime - Date.now());
            setTimeLeft(next);
            if (next === 0) onClose(); 
        }, 1000);
        return () => clearInterval(timer);
    }, [attack.endTime, onClose]);

    const isEncrypted = !attack.isScouted;
    const espionageCost = Math.max(100, Math.floor(attack.attackerScore * 64));
    const canAfford = gameState.resources[ResourceType.GOLD] >= espionageCost;

    const getSuggestedDefense = (enemyUnits: Partial<Record<UnitType, number>>) => {
        const suggestions: Set<UnitType> = new Set();
        
        Object.keys(enemyUnits).forEach((uKey) => {
            const uType = uKey as UnitType;
            
            Object.values(UNIT_DEFS).forEach(def => {
                if (gameState.researchedTechs.includes(def.reqTech)) {
                    if (def.rapidFire && def.rapidFire[uType]) {
                        suggestions.add(def.id);
                    }
                }
            });
        });

        return Array.from(suggestions).slice(0, 3); 
    };

    const counters = isEncrypted ? [] : getSuggestedDefense(attack.units);

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none bg-red-950/80 backdrop-blur-xl animate-[fadeIn_0.2s_ease-out] p-4 pt-20 pb-20 md:p-6">
            <div className="pointer-events-auto w-full max-w-2xl bg-black border-2 border-red-500/50 shadow-[0_0_100px_rgba(220,38,38,0.4)] rounded-lg flex flex-col overflow-hidden relative max-h-full">
                
                <div className="absolute inset-0 pointer-events-none opacity-10 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] z-0"></div>
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-red-500/5 to-transparent z-0"></div>

                <div className="flex justify-between items-center p-4 border-b border-red-500/30 bg-red-950/50 relative z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center animate-pulse">
                            <Icons.Warning className="text-black w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-tech text-lg md:text-xl text-red-500 uppercase tracking-[0.2em] leading-none mb-1">{t.common.ui.intercept_title}</h2>
                            <div className="text-[10px] font-mono text-red-300">ID: {attack.id.split('-')[1]}...</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-red-400 uppercase tracking-widest mb-1">{t.common.ui.impact_t_minus}</div>
                        <div className="font-mono text-2xl md:text-3xl font-bold text-white tabular-nums tracking-widest">{formatDuration(timeLeft)}</div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col md:flex-row relative z-10 overflow-y-auto custom-scrollbar">
                    
                    <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-red-500/20 p-6 flex flex-col bg-black/40 shrink-0">
                        <div className="w-24 h-24 mx-auto bg-slate-800 rounded-full border-2 border-red-500 flex items-center justify-center mb-4 overflow-hidden relative">
                            <div className="text-4xl">☠️</div>
                        </div>
                        
                        <div className="text-center mb-6">
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.common.ui.aggressor}</div>
                            <h3 className="font-tech text-lg text-white uppercase tracking-widest truncate">{attack.attackerName}</h3>
                            <div className="text-red-400 font-mono text-sm">{t.common.ui.threat_score}: {formatNumber(attack.attackerScore)}</div>
                        </div>

                        <div className="mt-auto space-y-2">
                            <div className="bg-red-900/20 p-3 rounded border border-red-500/20">
                                <div className="text-[9px] text-red-400 uppercase tracking-widest mb-1">{t.common.ui.threat_assessment}</div>
                                <div className="text-xs text-red-200 leading-tight">
                                    {(attack.attackerScore > gameState.empirePoints * 1.5) ? t.common.ui.threat_extreme : t.common.ui.threat_standard}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-2/3 p-6 flex flex-col bg-slate-900/50 relative">
                        {isEncrypted ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-8">
                                <div className="w-full max-w-xs h-32 border border-red-500/30 bg-black/50 rounded-lg flex items-center justify-center relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[url('https://media.giphy.com/media/Yy26NRbpB9lCGM', 'https://c.tenor.com/28DffV_unJ8AAAAC/static-tv.gif')] opacity-20 bg-cover"></div>
                                    <span className="font-mono text-red-500 animate-pulse text-lg tracking-widest">{t.common.ui.signal_encrypted}</span>
                                </div>
                                
                                <div className="max-w-sm">
                                    <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                                        {t.common.ui.encryption_desc}
                                    </p>
                                    
                                    <GlassButton 
                                        onClick={() => onDecrypt(attack.id)}
                                        disabled={!canAfford}
                                        variant="primary"
                                        className="w-full py-4 text-xs md:text-sm font-bold tracking-[0.2em] shadow-[0_0_30px_rgba(6,182,212,0.2)] border-cyan-500/50 whitespace-normal h-auto min-h-[50px]"
                                    >
                                        {canAfford ? `${t.common.actions.decrypt} (${formatNumber(espionageCost)} GOLD)` : `${t.common.actions.decrypt} (Req: ${formatNumber(espionageCost)})`}
                                    </GlassButton>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col animate-[fadeIn_0.5s_ease-out]">
                                <div className="flex justify-between items-end mb-4 border-b border-white/10 pb-2">
                                    <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold flex items-center gap-2">
                                        <Icons.Radar /> {t.common.ui.signal_decrypted}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                        {t.common.ui.total}: {Object.values(attack.units).reduce((a: number, b: number | undefined) => a + (b || 0), 0)}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-4 min-h-[150px]">
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(attack.units).map(([uType, count]) => {
                                            const def = UNIT_DEFS[uType as UnitType];
                                            const name = t.units[def.translationKey]?.name || uType;
                                            return (
                                                <div key={uType} className="bg-red-950/30 border border-red-500/20 p-2 rounded flex justify-between items-center">
                                                    <span className="text-xs text-red-200 font-bold truncate mr-2">{name}</span>
                                                    <span className="font-mono text-white bg-red-900/50 px-2 py-0.5 rounded text-xs">{count}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {counters.length > 0 && (
                                    <div className="bg-cyan-950/30 border border-cyan-500/30 rounded p-3 mt-auto shrink-0">
                                        <div className="text-[9px] text-cyan-400 uppercase tracking-widest mb-2 font-bold">{t.common.ui.recommended_counters}</div>
                                        <div className="flex flex-wrap gap-2">
                                            {counters.map(cId => {
                                                const def = UNIT_DEFS[cId];
                                                return (
                                                    <div key={cId} className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded border border-cyan-500/20 text-xs text-cyan-100">
                                                        <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                                                        {t.units[def.translationKey]?.name}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-slate-950 border-t border-white/10 flex justify-end gap-4 relative z-10 shrink-0">
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                    >
                        {t.common.actions.close}
                    </button>
                </div>
            </div>
        </div>
    );
};