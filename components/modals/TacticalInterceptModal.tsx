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
    const espionageCost = Math.floor(Math.max(100, Math.floor(attack.attackerScore * 64)) / 5);
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
    const totalEnemyUnits = Object.values(attack.units).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
    const isExtremeThreat = attack.attackerScore > gameState.empirePoints * 1.5;

    return (
        <div 
            className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full h-full md:h-auto md:max-h-[90dvh] md:my-auto max-w-4xl bg-slate-950 border border-red-500/50 shadow-2xl rounded-none md:rounded-lg flex flex-col m-0 md:m-4 pt-[68px] pb-[78px] md:pt-4 md:pb-4">
                
                {/* Close Button - Fixed at top right */}
                <button 
                    onClick={onClose}
                    className="absolute top-[72px] right-3 md:top-4 md:right-4 z-10 w-10 h-10 flex items-center justify-center bg-slate-800/90 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
                >
                    <Icons.Close className="w-5 h-5 text-slate-300" />
                </button>
                
                {/* Header - Fixed at top */}
                <header className="flex-shrink-0 bg-gradient-to-r from-red-900/60 to-slate-900 px-4 pb-4 md:px-6 md:pb-6 border-b border-red-500/30 -mt-2 md:mt-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Icons.Warning className="text-black w-6 h-6 md:w-7 md:h-7" />
                            </div>
                            <div>
                                <h2 className="font-tech text-lg md:text-2xl text-red-500 uppercase tracking-wider">{t.common.ui.intercept_title}</h2>
                                <div className="text-[10px] text-red-400/70 font-mono mt-0.5">ID: {attack.id.split('-')[1]}...</div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-red-950/50 px-3 py-2 md:px-4 md:py-3 rounded-lg border border-red-500/30">
                            <div className="text-right">
                                <div className="text-[8px] md:text-[10px] text-red-400 uppercase tracking-widest">{t.common.ui.impact_t_minus}</div>
                                <div className="font-mono text-xl md:text-3xl font-bold text-white tabular-nums">{formatDuration(timeLeft)}</div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-4 md:space-y-6 custom-scrollbar">
                    
                    {/* Attacker Info Section */}
                    <section className="bg-slate-900/80 rounded-xl p-3 md:p-6 border border-red-500/20">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            {/* Avatar */}
                            <div className="w-16 h-16 md:w-24 md:h-24 bg-slate-800 rounded-full border-2 border-red-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-3xl md:text-5xl">☠️</span>
                            </div>
                            
                            {/* Info */}
                            <div className="flex-1 text-center sm:text-left">
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.common.ui.aggressor}</div>
                                <h3 className="font-tech text-xl md:text-2xl text-white uppercase tracking-wider mb-1">{attack.attackerName}</h3>
                                <div className="text-red-400 font-mono text-xs md:text-sm">
                                    {t.common.ui.threat_score}: {formatNumber(attack.attackerScore)}
                                </div>
                            </div>
                            
                            {/* Threat Badge */}
                            <div className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg border ${
                                isExtremeThreat 
                                    ? 'bg-red-900/40 border-red-500 text-red-400' 
                                    : 'bg-yellow-900/40 border-yellow-500 text-yellow-400'
                            }`}>
                                <div className="text-[8px] md:text-[10px] uppercase tracking-widest mb-0.5">{t.common.ui.threat_assessment}</div>
                                <div className="text-xs font-bold">
                                    {isExtremeThreat ? t.common.ui.threat_extreme : t.common.ui.threat_standard}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Enemy Units or Encrypted Signal */}
                    {isEncrypted ? (
                        <section className="bg-slate-900/80 rounded-xl p-3 md:p-6 border border-red-500/20">
                            <div className="text-center space-y-4">
                                <div className="w-full h-24 md:h-32 border border-red-500/30 bg-black/30 rounded-lg flex items-center justify-center">
                                    <span className="font-mono text-red-500 animate-pulse text-sm md:text-lg tracking-widest">{t.common.ui.signal_encrypted}</span>
                                </div>
                                
                                <div className="max-w-sm mx-auto space-y-3">
                                    <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                                        {t.common.ui.encryption_desc}
                                    </p>
                                    
                                    <GlassButton 
                                        onClick={() => onDecrypt(attack.id)}
                                        disabled={!canAfford}
                                        variant="primary"
                                        className="w-full py-3 md:py-4 text-xs md:text-sm font-bold tracking-wider border-cyan-500/50"
                                    >
                                        {canAfford 
                                            ? `${t.common.actions.decrypt} (${formatNumber(espionageCost)} GOLD)` 
                                            : `${t.common.actions.decrypt} (Req: ${formatNumber(espionageCost)})`
                                        }
                                    </GlassButton>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section className="space-y-3 md:space-y-4">
                            {/* Section Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-emerald-400 text-[10px] md:text-xs uppercase tracking-widest font-bold">
                                    <Icons.Radar className="w-3 h-3 md:w-4 md:h-4" /> {t.common.ui.signal_decrypted}
                                </div>
                                <div className="text-[10px] md:text-xs text-slate-500">
                                    {t.common.ui.total}: {totalEnemyUnits}
                                </div>
                            </div>

                            {/* Units Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                                {Object.entries(attack.units).map(([uType, count]) => {
                                    const def = UNIT_DEFS[uType as UnitType];
                                    const name = t.units[def.translationKey]?.name || uType;
                                    return (
                                        <div 
                                            key={uType} 
                                            className="bg-red-950/20 border border-red-500/20 p-2 md:p-3 rounded-lg flex justify-between items-center"
                                        >
                                            <span className="text-xs md:text-sm text-red-200 font-medium truncate mr-2">{name}</span>
                                            <span className="font-mono text-white bg-red-900/50 px-2 md:px-3 py-1 rounded text-xs md:text-sm">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Counter Suggestions */}
                            {counters.length > 0 && (
                                <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-3 md:p-4">
                                    <div className="text-[10px] md:text-xs text-cyan-400 uppercase tracking-widest mb-2 md:mb-3 font-bold">
                                        {t.common.ui.recommended_counters}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {counters.map(cId => {
                                            const def = UNIT_DEFS[cId];
                                            return (
                                                <div 
                                                    key={cId} 
                                                    className="flex items-center gap-2 bg-black/40 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-cyan-500/20 text-xs md:text-sm text-cyan-100"
                                                >
                                                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-cyan-500 rounded-full"></span>
                                                    {t.units[def.translationKey]?.name}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* Footer - Fixed at bottom */}
                <footer className="flex-shrink-0 px-3 pb-3 md:px-4 md:pb-4 pt-2 bg-slate-950 border-t border-white/10">
                    <button 
                        onClick={onClose}
                        className="w-full py-3 md:py-4 text-xs md:text-sm font-bold uppercase tracking-widest text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        {t.common.actions.close}
                    </button>
                </footer>
            </div>
        </div>
    );
};
