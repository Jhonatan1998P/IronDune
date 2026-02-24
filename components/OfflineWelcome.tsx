
import React from 'react';
import { OfflineReport } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatDuration, formatNumber } from '../utils';
import { Icons, GlassButton } from './UIComponents';
import { TECH_DEFS } from '../data/techs';

interface OfflineWelcomeProps {
    report: OfflineReport;
    onClose: () => void;
}

export const OfflineWelcome: React.FC<OfflineWelcomeProps> = ({ report, onClose }) => {
    const { t } = useLanguage();

    return (
        <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center bg-black/90 backdrop-blur-xl animate-[fadeIn_0.5s_ease-out] md:p-4">
            <div className="w-full md:max-w-lg bg-slate-900 border-t md:border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden flex flex-col max-h-[85vh] md:rounded-xl rounded-t-2xl">
                
                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-cyan-950/20 text-center relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20"></div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 mx-auto bg-cyan-500/10 rounded-full flex items-center justify-center mb-3 border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse">
                            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="font-tech text-2xl text-white uppercase tracking-widest mb-1">{t.offline.welcome_back}</h2>
                        <p className="text-cyan-400 font-mono text-sm tracking-wider">
                            {t.offline.time_away}: {formatDuration(report.timeElapsed)}
                        </p>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    
                    {/* Resource Summary */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
                            {t.offline.production_summary}
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(report.resourcesGained).map(([res, val]) => {
                                const amount = val as number;
                                if (amount === 0) return null;
                                return (
                                    <div key={res} className="bg-black/30 p-2 rounded flex justify-between items-center border border-white/5">
                                        <span className="text-xs text-slate-400 uppercase">{t.common.resources[res]}</span>
                                        <span className={`font-mono font-bold ${amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {amount > 0 ? '+' : ''}{formatNumber(amount)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bank Interest */}
                    {report.bankInterestEarned > 0 && (
                        <div className="bg-gradient-to-r from-amber-900/20 to-transparent p-3 rounded border-l-2 border-amber-500">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-amber-200 uppercase tracking-wider">{t.offline.bank_interest}</span>
                                <span className="text-amber-400 font-mono font-bold text-lg">+${formatNumber(report.bankInterestEarned)}</span>
                            </div>
                        </div>
                    )}

                    {/* Events: Research */}
                    {report.completedResearch.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-1 h-4 bg-cyan-500 rounded-full"></span>
                                {t.offline.research_completed}
                            </h3>
                            <div className="space-y-2">
                                {report.completedResearch.map(techId => (
                                    <div key={techId} className="flex items-center gap-3 p-2 bg-cyan-900/10 rounded border border-cyan-500/20">
                                        <div className="text-cyan-400"><Icons.Science /></div>
                                        <span className="text-sm text-cyan-100">{t.techs[TECH_DEFS[techId]?.translationKey ?? '']?.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Events: Missions */}
                    {report.completedMissions.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
                                {t.offline.missions_completed}
                            </h3>
                            <div className="space-y-2">
                                {report.completedMissions.map((m, i) => (
                                    <div key={i} className={`p-2 rounded border flex justify-between items-center ${m.success ? 'bg-emerald-900/10 border-emerald-500/20' : 'bg-red-900/10 border-red-500/20'}`}>
                                        <span className="text-xs text-slate-300">Op #{m.id.slice(-4)}</span>
                                        <span className={`text-xs font-bold uppercase ${m.success ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {m.success ? 'SUCCESS' : 'FAILURE'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-black/40 shrink-0 safe-area-bottom">
                    <GlassButton onClick={onClose} variant="primary" className="w-full py-4 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                        {t.offline.claim}
                    </GlassButton>
                </div>
            </div>
        </div>
    );
};
