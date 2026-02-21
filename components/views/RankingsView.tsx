
import React, { useState, useMemo, useEffect } from 'react';
import { GameState } from '../../types';
import { getCurrentStandings, RankingCategory, RankingEntry, getFlagEmoji } from '../../utils/engine/rankings';
import { useLanguage } from '../../context/LanguageContext';
import { Icons } from '../UIComponents';
import { formatNumber } from '../../utils';
import { PvpAttackModal } from '../PvpAttackModal';
import { executeDeclareWar } from '../../utils/engine/actions';
import { CommanderProfileModal } from '../modals/CommanderProfileModal';

interface RankingsViewProps {
    gameState: GameState;
    onAttack?: (target: any, newState: GameState) => void;
}

const ITEMS_PER_PAGE = 20;

export const RankingsView: React.FC<RankingsViewProps> = ({ gameState, onAttack }) => {
    const { t } = useLanguage();
    const [category, setCategory] = useState<RankingCategory>(RankingCategory.DOMINION);
    const [currentPage, setCurrentPage] = useState(1);
    
    // Interaction States
    const [profileEntry, setProfileEntry] = useState<RankingEntry | null>(null);
    const [attackTarget, setAttackTarget] = useState<{id: string, name: string, score: number} | null>(null);

    // Get full sorted list (Bots + Player)
    const fullRankings = useMemo(() => {
        return getCurrentStandings(gameState, gameState.rankingData.bots, category);
    }, [gameState.empirePoints, gameState.lifetimeStats, gameState.campaignProgress, category, gameState.rankingData.bots]);

    const playerEntry = fullRankings.find(e => e.isPlayer);
    const totalPages = Math.ceil(fullRankings.length / ITEMS_PER_PAGE);

    useEffect(() => {
        setCurrentPage(1);
    }, [category]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return fullRankings.slice(start, start + ITEMS_PER_PAGE);
    }, [fullRankings, currentPage]);

    const categories = [
        { id: RankingCategory.DOMINION, label: t.common.stats.empire_points, icon: Icons.Crown },
        { id: RankingCategory.MILITARY, label: t.reports.filter_military, icon: Icons.Army },
        { id: RankingCategory.ECONOMY, label: t.common.ui.nav_economy, icon: Icons.Base },
        { id: RankingCategory.CAMPAIGN, label: t.common.ui.nav_campaign, icon: Icons.Radar },
    ];

    const getTierColor = (tier: string) => {
        switch(tier) {
            case 'S': return 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]';
            case 'A': return 'text-purple-400';
            case 'B': return 'text-cyan-400';
            case 'C': return 'text-emerald-400';
            default: return 'text-slate-500';
        }
    };

    const getRowStyle = (entry: RankingEntry) => {
        if (entry.isPlayer) return 'bg-cyan-900/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)] z-10';
        if (entry.rank === 1) return 'bg-yellow-900/10 border-yellow-500/30';
        if (entry.rank === 2) return 'bg-slate-700/20 border-slate-400/30';
        if (entry.rank === 3) return 'bg-orange-900/10 border-orange-500/30';
        return 'bg-transparent border-white/5 hover:bg-white/5'; 
    };

    const jumpToPlayer = () => {
        if (playerEntry) {
            const playerPage = Math.ceil(playerEntry.rank / ITEMS_PER_PAGE);
            setCurrentPage(playerPage);
        }
    };

    // --- ACTIONS ---

    const handleDeclareWar = () => {
        if (!profileEntry) return;
        
        if (confirm(`${t.common.war.declare_title}: ${profileEntry.name}?\n\n${t.common.war.declare_desc}`)) {
            const result = executeDeclareWar(gameState, profileEntry.id, profileEntry.name, profileEntry.score);
            if (result.success && result.newState && onAttack) {
                onAttack(null, result.newState); // Hacky update via parent
                setProfileEntry(null); // Close profile
            }
        }
    };

    const handlePrepareAttack = () => {
        if (!profileEntry) return;
        setAttackTarget({ id: profileEntry.id, name: profileEntry.name, score: profileEntry.score });
        setProfileEntry(null); // Switch modal
    };

    return (
        <div className="flex flex-col min-h-full animate-[fadeIn_0.3s_ease-out] relative">
            
            {/* 1. SLIDEOVER PROFILE (INTERMEDIATE) */}
            {profileEntry && (
                <CommanderProfileModal 
                    entry={profileEntry}
                    gameState={gameState}
                    t={t}
                    onClose={() => setProfileEntry(null)}
                    onDeclareWar={handleDeclareWar}
                    onAttack={handlePrepareAttack}
                />
            )}

            {/* 2. ATTACK MODAL (FINAL) */}
            {attackTarget && onAttack && (
                <PvpAttackModal 
                    target={attackTarget}
                    gameState={gameState}
                    onClose={() => setAttackTarget(null)}
                    onAttackSent={(newState) => {
                        onAttack(attackTarget, newState); 
                    }}
                />
            )}

            {/* Header & Tabs */}
            <div className="glass-panel p-4 rounded-xl border border-white/10 mb-4 shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <h2 className="font-tech text-xl text-white uppercase tracking-widest flex items-center gap-2">
                        <Icons.Crown /> {t.features.rankings.title}
                    </h2>
                    {playerEntry && (
                        <button 
                            onClick={jumpToPlayer}
                            className="text-xs font-mono text-cyan-400 bg-black/30 px-3 py-1 rounded-full border border-cyan-500/20 hover:bg-cyan-900/20 hover:border-cyan-400 transition-colors flex items-center gap-2 group w-full md:w-auto justify-center"
                        >
                            <span>{t.features.rankings.current_rank}:</span>
                            <span className="text-white font-bold text-sm">#{playerEntry.rank}</span>
                            <span className="text-slate-500 text-[10px] group-hover:text-cyan-300">({t.common.actions.locate})</span>
                        </button>
                    )}
                </div>

                {/* Category Tabs */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mask-image-sides">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setCategory(cat.id)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all whitespace-nowrap flex-1 md:flex-none justify-center
                                ${category === cat.id 
                                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/10'}
                            `}
                        >
                            <cat.icon />
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table Container */}
            <div className="glass-panel rounded-xl border border-white/10 flex flex-col relative min-h-0">
                
                {/* Table Header - Hidden on small mobile to save space */}
                <div className="hidden md:grid grid-cols-12 gap-2 p-3 bg-black/40 border-b border-white/10 text-[10px] text-slate-500 uppercase tracking-widest font-bold shrink-0">
                    <div className="col-span-1 text-center">{t.features.rankings.rank}</div>
                    <div className="col-span-1 text-center">{t.common.ui.trend}</div>
                    <div className="col-span-4 pl-2">{t.features.rankings.commander}</div>
                    <div className="col-span-2 text-right">{t.features.rankings.score}</div>
                    <div className="col-span-2 text-center">{t.features.rankings.tier}</div>
                    <div className="col-span-2 text-center">{t.common.ui.action_col}</div>
                </div>

                {/* Table Body */}
                <div className="p-2 space-y-1 pb-4">
                    {paginatedData.map((entry) => (
                        <div 
                            key={entry.id}
                            onClick={() => setProfileEntry(entry)}
                            className={`
                                flex md:grid md:grid-cols-12 gap-2 p-3 md:p-2 rounded-lg items-center border transition-all text-xs cursor-pointer md:cursor-default relative
                                ${getRowStyle(entry)}
                            `}
                        >
                            {/* Mobile Rank Badge */}
                            <div className="md:hidden absolute left-2 top-2">
                                <span className={`text-[10px] font-bold ${entry.rank <= 3 ? 'text-yellow-400' : 'text-slate-500'}`}>#{entry.rank}</span>
                            </div>

                            {/* Rank Column (Desktop) */}
                            <div className="hidden md:flex col-span-1 justify-center">
                                {entry.rank <= 3 ? (
                                    <div className={`w-6 h-6 flex items-center justify-center rounded-full font-bold bg-black/30 ${
                                        entry.rank === 1 ? 'text-yellow-400 border border-yellow-500' :
                                        entry.rank === 2 ? 'text-slate-300 border border-slate-400' :
                                        'text-orange-400 border border-orange-500'
                                    }`}>
                                        {entry.rank}
                                    </div>
                                ) : (
                                    <span className="font-mono text-slate-500 opacity-70">#{entry.rank}</span>
                                )}
                            </div>

                            {/* Trend Column */}
                            <div className="hidden md:flex col-span-1 justify-center">
                                {entry.trend !== 0 && (
                                    <div className={`flex items-center text-[9px] font-bold ${entry.trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {entry.trend > 0 ? <Icons.TrendUp className="w-3 h-3" /> : <Icons.TrendDown className="w-3 h-3" />} {Math.abs(entry.trend)}
                                    </div>
                                )}
                                {entry.trend === 0 && <span className="text-slate-600">-</span>}
                            </div>

                            {/* Name Column */}
                            <div className="flex-1 md:col-span-4 flex items-center gap-3 overflow-hidden pl-6 md:pl-0">
                                <span className="text-xl md:text-base shrink-0" role="img" aria-label={entry.country}>
                                    {getFlagEmoji(entry.country)}
                                </span>
                                <div className="flex flex-col md:block overflow-hidden">
                                    <span className={`font-bold truncate text-sm md:text-xs ${entry.isPlayer ? 'text-cyan-300' : 'text-slate-200'}`}>
                                        {entry.name}
                                    </span>
                                    <div className="md:hidden flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-slate-500">{t.features.rankings.score}:</span>
                                        <span className="text-xs font-mono font-bold text-white">{formatNumber(entry.score)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Score Column (Desktop) */}
                            <div className="hidden md:block col-span-2 text-right font-mono font-bold text-white text-xs">
                                {formatNumber(entry.score)}
                            </div>

                            {/* Tier Column */}
                            <div className="hidden md:block col-span-2 text-center font-tech font-bold">
                                <span className={getTierColor(entry.tier)}>{entry.tier}{t.features.rankings.class_suffix}</span>
                            </div>
                            
                            {/* Action Column */}
                            <div className="hidden md:flex col-span-2 justify-center pr-1">
                                {!entry.isPlayer && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setProfileEntry(entry); }}
                                        className="text-[10px] text-slate-400 hover:text-cyan-400 uppercase tracking-wider font-bold"
                                    >
                                        {t.common.actions.inspect}
                                    </button>
                                )}
                            </div>

                            {/* Mobile Arrow */}
                            <div className="md:hidden text-slate-600">
                                <Icons.ChevronRight />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pagination Controls - Bottom of flex container */}
                <div className="p-3 border-t border-white/10 bg-slate-900/80 flex justify-between items-center shrink-0">
                    <button 
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider border border-white/5 transition-colors"
                    >
                        {t.common.actions.previous}
                    </button>
                    
                    <span className="text-xs font-mono text-slate-400">
                        {t.common.ui.page} <span className="text-white font-bold">{currentPage}</span> / {totalPages}
                    </span>

                    <button 
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider border border-white/5 transition-colors"
                    >
                        {t.common.actions.next}
                    </button>
                </div>
            </div>
        </div>
    );
};
