import React from 'react';
import { OfflineReport, GameState } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatDuration, formatNumber } from '../utils';
import { Icons, GlassButton } from './UIComponents';
import { TECH_DEFS } from '../data/techs';

interface OfflineWelcomeProps {
    report: OfflineReport;
    gameState: GameState;
    onClose: () => void;
}

export const OfflineWelcome: React.FC<OfflineWelcomeProps> = ({ report, gameState, onClose }) => {
    const { t, language } = useLanguage();
    
    // Determinar saludo basado en si el jugador tiene nombre personalizado
    const playerName = gameState.playerName?.trim();
    const hasCustomName = playerName && playerName.length > 0 && playerName !== 'Commander';
    
    // Construir saludo personalizado
    const greeting = hasCustomName 
        ? (language === 'es' ? `Bienvenido, ${playerName}` : `Welcome Back, ${playerName}`)
        : t.offline.welcome_back;

    return (
        <div 
            className="fixed inset-0 z-[120] flex items-end md:items-center justify-center bg-black/90 backdrop-blur-xl animate-[fadeIn_0.3s_ease-out] md:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="offline-welcome-title"
        >
            <div 
                className="w-full md:max-w-lg bg-slate-900 border-t md:border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden flex flex-col max-h-[90dvh] md:max-h-[85vh] md:rounded-2xl rounded-t-2xl"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header - Responsivo con padding ajustable */}
                <div className="p-4 sm:p-5 md:p-6 border-b border-white/10 bg-cyan-950/20 text-center relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20"></div>
                    <div className="relative z-10">
                        {/* Icono animado - Tamaño responsivo */}
                        <div className="w-10 h-10 sm:w-12 md:w-14 mx-auto bg-cyan-500/10 rounded-full flex items-center justify-center mb-3 border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse">
                            <svg 
                                className="w-5 h-5 sm:w-6 md:w-7 text-cyan-400" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                                aria-hidden="true"
                            >
                                <path 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    strokeWidth={2} 
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                                />
                            </svg>
                        </div>
                        
                        {/* Título principal - Texto responsivo con clamp */}
                        <h2 
                            id="offline-welcome-title"
                            className="font-tech text-lg sm:text-xl md:text-2xl lg:text-3xl text-white uppercase tracking-widest mb-2 px-2 break-words"
                        >
                            {greeting}
                        </h2>
                        
                        {/* Subtítulo con tiempo offline - Texto más pequeño en móvil */}
                        <p className="text-cyan-400 font-mono text-xs sm:text-sm tracking-wider px-2">
                            <span className="hidden sm:inline">{t.offline.time_away}: </span>
                            <span className="sm:hidden">{t.offline.time_away.split(' ')[0]}: </span>
                            <span className="font-bold">{formatDuration(report.timeElapsed)}</span>
                        </p>
                    </div>
                </div>

                {/* Body - Scroll suave con padding responsivo */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 md:space-y-6 custom-scrollbar">

                    {/* Resource Summary - Grid responsivo */}
                    <div>
                        <h3 className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="w-1 h-3 sm:h-4 bg-emerald-500 rounded-full"></span>
                            <span className="break-words">{t.offline.production_summary}</span>
                        </h3>
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            {Object.entries(report.resourcesGained).map(([res, val]) => {
                                const amount = val as number;
                                if (amount === 0) return null;
                                return (
                                    <div 
                                        key={res} 
                                        className="bg-black/30 p-2 sm:p-3 rounded-lg flex justify-between items-center border border-white/5 hover:border-emerald-500/30 transition-colors"
                                    >
                                        <span className="text-[10px] sm:text-xs text-slate-400 uppercase truncate pr-2">
                                            {t.common.resources[res]}
                                        </span>
                                        <span 
                                            className={`font-mono font-bold text-sm sm:text-base md:text-lg whitespace-nowrap ${
                                                amount > 0 ? 'text-emerald-400' : 'text-red-400'
                                            }`}
                                        >
                                            {amount > 0 ? '+' : ''}{formatNumber(amount)}
                                        </span>
                                    </div>
                                );
                            })}
                            {/* Mensaje si no hay producción */}
                            {Object.values(report.resourcesGained).every(val => val === 0) && (
                                <div className="col-span-2 bg-black/20 p-3 rounded-lg border border-white/5 text-center">
                                    <p className="text-xs sm:text-sm text-slate-400">
                                        {language === 'es' ? 'Sin producción durante la ausencia' : 'No production while away'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bank Interest - Alerta responsiva */}
                    {report.bankInterestEarned > 0 && (
                        <div className="bg-gradient-to-r from-amber-900/20 to-transparent p-3 sm:p-4 rounded-lg border-l-2 border-amber-500">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] sm:text-xs text-amber-200 uppercase tracking-wider">
                                    {t.offline.bank_interest}
                                </span>
                                <span className="text-amber-400 font-mono font-bold text-base sm:text-lg md:text-xl">
                                    +${formatNumber(report.bankInterestEarned)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Events: Research - Lista vertical */}
                    {report.completedResearch.length > 0 && (
                        <div>
                            <h3 className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-1 h-3 sm:h-4 bg-cyan-500 rounded-full"></span>
                                <span className="break-words">{t.offline.research_completed}</span>
                            </h3>
                            <div className="space-y-2">
                                {report.completedResearch.map(techId => (
                                    <div 
                                        key={techId} 
                                        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-cyan-900/10 rounded-lg border border-cyan-500/20"
                                    >
                                        <div className="text-cyan-400 shrink-0">
                                            <Icons.Science className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </div>
                                        <span className="text-xs sm:text-sm text-cyan-100 break-words">
                                            {t.techs[TECH_DEFS[techId]?.translationKey ?? '']?.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Events: Missions - Lista con estados */}
                    {report.completedMissions.length > 0 && (
                        <div>
                            <h3 className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-1 h-3 sm:h-4 bg-purple-500 rounded-full"></span>
                                <span className="break-words">{t.offline.missions_completed}</span>
                            </h3>
                            <div className="space-y-2">
                                {report.completedMissions.map((m, i) => (
                                    <div 
                                        key={i} 
                                        className={`p-2 sm:p-3 rounded-lg border flex justify-between items-center ${
                                            m.success 
                                                ? 'bg-emerald-900/10 border-emerald-500/20' 
                                                : 'bg-red-900/10 border-red-500/20'
                                        }`}
                                    >
                                        <span className="text-[10px] sm:text-xs text-slate-300 font-mono">
                                            Op #{m.id.slice(-4)}
                                        </span>
                                        <span 
                                            className={`text-[10px] sm:text-xs font-bold uppercase ${
                                                m.success ? 'text-emerald-400' : 'text-red-400'
                                            }`}
                                        >
                                            {m.success ? 'SUCCESS' : 'FAILURE'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer - Botón grande y accesible */}
                <div className="p-3 sm:p-4 md:p-5 border-t border-white/10 bg-black/40 shrink-0 safe-area-bottom">
                    <GlassButton 
                        onClick={onClose} 
                        variant="primary" 
                        className="w-full py-3 sm:py-4 text-sm sm:text-base font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-shadow"
                        aria-label={t.offline.claim}
                    >
                        {t.offline.claim}
                    </GlassButton>
                </div>
            </div>
        </div>
    );
};
