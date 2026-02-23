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

const ITEMS_PER_PAGE_MOBILE = 8;

export const RankingsView: React.FC<RankingsViewProps> = ({ gameState, onAttack }) => {
    const { t } = useLanguage();
    const [category, setCategory] = useState<RankingCategory>(RankingCategory.DOMINION);
    const [currentPage, setCurrentPage] = useState(1);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    
    const [profileEntry, setProfileEntry] = useState<RankingEntry | null>(null);
    const [attackTarget, setAttackTarget] = useState<{id: string, name: string, score: number} | null>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fullRankings = useMemo(() => {
        return getCurrentStandings(gameState, gameState.rankingData.bots, category);
    }, [gameState.empirePoints, gameState.lifetimeStats, gameState.campaignProgress, category, gameState.rankingData.bots]);

    const playerEntry = fullRankings.find(e => e.isPlayer);
    
    const totalPages = useMemo(() => {
        if (!isMobile) return 1;
        return Math.ceil(fullRankings.length / ITEMS_PER_PAGE_MOBILE);
    }, [isMobile, fullRankings.length]);

    useEffect(() => {
        setCurrentPage(1);
    }, [category]);

    const paginatedData = useMemo(() => {
        if (!isMobile) return fullRankings;
        const start = (currentPage - 1) * ITEMS_PER_PAGE_MOBILE;
        return fullRankings.slice(start, start + ITEMS_PER_PAGE_MOBILE);
    }, [fullRankings, currentPage, isMobile]);

    const categories = [
        { id: RankingCategory.DOMINION, label: t.common.stats.empire_points, icon: Icons.Crown },
        { id: RankingCategory.MILITARY, label: t.reports.filter_military, icon: Icons.Army },
        { id: RankingCategory.ECONOMY, label: t.common.ui.nav_economy, icon: Icons.Base },
        { id: RankingCategory.CAMPAIGN, label: t.common.ui.nav_campaign, icon: Icons.Radar },
    ];

    const getTierInfo = (tier: string) => {
        switch(tier) {
            case 'S': return { color: 'text-yellow-400', bg: 'bg-yellow-950/40', border: 'border-yellow-500/50', shadow: 'shadow-yellow-500/20' };
            case 'A': return { color: 'text-purple-400', bg: 'bg-purple-950/40', border: 'border-purple-500/50', shadow: 'shadow-purple-500/20' };
            case 'B': return { color: 'text-cyan-400', bg: 'bg-cyan-950/40', border: 'border-cyan-500/50', shadow: 'shadow-cyan-500/20' };
            case 'C': return { color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-500/50', shadow: 'shadow-emerald-500/20' };
            default: return { color: 'text-slate-400', bg: 'bg-slate-950/40', border: 'border-slate-500/50', shadow: 'shadow-slate-500/20' };
        }
    };

    const getRankStyle = (rank: number) => {
        if (rank === 1) return { bg: 'bg-yellow-900/30', border: 'border-yellow-500/40', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.2)]' };
        if (rank === 2) return { bg: 'bg-slate-700/30', border: 'border-slate-400/40', glow: 'shadow-[0_0_15px_rgba(148,163,184,0.15)]' };
        if (rank === 3) return { bg: 'bg-orange-900/30', border: 'border-orange-500/40', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]' };
        return { bg: 'bg-slate-900/40', border: 'border-white/5', glow: '' };
    };

    const jumpToPlayer = () => {
        if (playerEntry) {
            const playerPage = Math.ceil(playerEntry.rank / ITEMS_PER_PAGE_MOBILE);
            setCurrentPage(playerPage);
        }
    };

    const handleDeclareWar = () => {
        if (!profileEntry) return;
        if (confirm(`${t.common.war.declare_title}: ${profileEntry.name}?\n\n${t.common.war.declare_desc}`)) {
            const result = executeDeclareWar(gameState, profileEntry.id, profileEntry.name, profileEntry.score);
            if (result.success && result.newState && onAttack) {
                onAttack(null, result.newState);
                setProfileEntry(null);
            }
        }
    };

    const handlePrepareAttack = () => {
        if (!profileEntry) return;
        setAttackTarget({ id: profileEntry.id, name: profileEntry.name, score: profileEntry.score });
        setProfileEntry(null);
    };

    const RankingCard: React.FC<{ entry: RankingEntry }> = ({ entry }) => {
        const tierInfo = getTierInfo(entry.tier);
        const rankStyle = getRankStyle(entry.rank);
        const ratio = entry.score / Math.max(1, gameState.empirePoints);
        const inRange = ratio >= 0.5 && ratio <= 1.5;

        return (
            <div 
                onClick={() => setProfileEntry(entry)}
                className={`
                    relative glass-panel p-4 rounded-xl border transition-all cursor-pointer
                    flex flex-col gap-3 h-full
                    hover:border-white/20 hover:bg-white/5
                    md:hover:shadow-[0_8px_30px_rgba(6,182,212,0.15)] md:hover:-translate-y-0.5
                    ${entry.isPlayer ? 'bg-cyan-900/20 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.15)]' : `${rankStyle.bg} ${rankStyle.border} ${rankStyle.glow}`}
                `}
            >
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`
                            flex items-center justify-center w-8 h-8 rounded-lg shrink-0 font-bold text-sm
                            ${entry.rank <= 3 
                                ? entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' 
                                : entry.rank === 2 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/50'
                                : 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                                : 'bg-black/40 text-slate-500 border border-white/10'
                            }
                        `}>
                            {entry.rank}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-lg shrink-0">{getFlagEmoji(entry.country)}</span>
                                <span className={`font-bold text-sm truncate ${entry.isPlayer ? 'text-cyan-300' : 'text-white'}`}>
                                    {entry.name}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className={`flex flex-col items-center justify-center px-2 py-1 rounded-lg ${tierInfo.bg} ${tierInfo.border} border shrink-0`}>
                        <span className={`text-xs font-bold ${tierInfo.color}`}>{entry.tier}</span>
                        <span className="text-[8px] text-slate-500 uppercase">{t.features.rankings.class_suffix}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">{t.features.rankings.score}</div>
                        <div className="font-mono font-bold text-white text-lg">{formatNumber(entry.score)}</div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {entry.trend !== 0 && (
                            <div className={`flex items-center text-xs font-bold ${entry.trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {entry.trend > 0 ? <Icons.TrendUp className="w-4 h-4" /> : <Icons.TrendDown className="w-4 h-4" />}
                                <span>{Math.abs(entry.trend)}</span>
                            </div>
                        )}
                        {entry.trend === 0 && <span className="text-slate-600 text-xs">—</span>}
                    </div>
                </div>

                {!entry.isPlayer && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <div className={`text-[9px] font-bold px-2 py-1 rounded border uppercase tracking-widest
                            ${inRange 
                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' 
                                : 'text-red-400 bg-red-500/10 border-red-500/30'
                            }`}
                        >
                            {inRange ? t.common.ui.in_range : t.common.ui.out_range}
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setProfileEntry(entry); }}
                            className="text-[10px] text-slate-400 hover:text-cyan-400 uppercase tracking-wider font-bold transition-colors"
                        >
                            {t.common.actions.inspect}
                        </button>
                    </div>
                )}

                {entry.isPlayer && (
                    <div className="flex items-center justify-center pt-2 border-t border-cyan-500/30">
                        <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-1">
                            <Icons.Crown className="w-3 h-3" /> {t.common.ui.you}
                        </span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col min-h-full relative animate-[fadeIn_0.3s_ease-out]">
            
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

            <div className="shrink-0 mb-3 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 -mx-3 px-3 md:mx-0 md:px-0 md:bg-transparent md:backdrop-blur-none md:border-b-0 pt-1">
                
                <div className="md:hidden flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <h2 className="font-tech text-white uppercase tracking-widest text-sm flex items-center gap-2">
                            <Icons.Crown className="text-yellow-400" /> {t.features.rankings.title}
                        </h2>
                        {playerEntry && (
                            <button 
                                onClick={jumpToPlayer}
                                className="text-[10px] text-cyan-400 font-bold flex items-center gap-1"
                            >
                                #{playerEntry.rank} <span className="text-slate-500">({t.common.actions.locate})</span>
                            </button>
                        )}
                    </div>
                    
                    <div className="relative">
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as RankingCategory)}
                            className="w-full appearance-none bg-slate-900/90 border border-white/10 rounded-xl pl-3 pr-8 py-2 text-[10px] sm:text-xs font-tech uppercase tracking-widest text-cyan-300 focus:outline-none focus:border-cyan-500 shadow-sm"
                        >
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id} className="bg-slate-900 text-white">
                                    {cat.label}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-500">
                            <Icons.ChevronDown className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                <div className="hidden md:block space-y-3">
                    <div className="glass-panel p-4 rounded-xl border border-white/10">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-tech text-xl text-white uppercase tracking-widest flex items-center gap-2">
                                <Icons.Crown className="text-yellow-400" /> {t.features.rankings.title}
                            </h2>
                            {playerEntry && (
                                <button 
                                    onClick={jumpToPlayer}
                                    className="text-xs font-mono text-cyan-400 bg-black/30 px-3 py-1.5 rounded-full border border-cyan-500/20 hover:bg-cyan-900/20 hover:border-cyan-400 transition-colors flex items-center gap-2"
                                >
                                    <span>{t.features.rankings.current_rank}:</span>
                                    <span className="text-white font-bold">#{playerEntry.rank}</span>
                                    <span className="text-slate-500 text-[10px]">({t.common.actions.locate})</span>
                                </button>
                            )}
                        </div>

                        <div className="flex gap-2 overflow-x-auto no-scrollbar mask-image-sides">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setCategory(cat.id)}
                                    className={`
                                        relative min-h-[44px] px-4 rounded-lg text-xs font-tech uppercase tracking-wider border transition-all flex items-center justify-center gap-2 shrink-0
                                        ${category === cat.id 
                                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                                            : 'bg-slate-800/50 border-white/5 text-slate-500 hover:text-slate-300 active:bg-white/5'}
                                    `}
                                >
                                    <cat.icon className="w-4 h-4" />
                                    <span className="whitespace-nowrap">{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {isMobile && totalPages > 1 && (
                <div className="flex justify-between items-center shrink-0 p-1.5 mb-3 bg-slate-900/50 rounded-xl border border-white/10 shadow-sm">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold ml-3">
                        {t.common.ui.page} {currentPage}/{totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center border border-white/10 transition-all active:scale-95 text-slate-300"
                        >
                            <Icons.ChevronLeft />
                        </button>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center border border-white/10 transition-all active:scale-95 text-slate-300"
                        >
                            <Icons.ChevronRight />
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pb-24 pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4 md:p-2">
                    {paginatedData.map((entry) => (
                        <RankingCard key={entry.id} entry={entry} />
                    ))}
                </div>
            </div>
        </div>
    );
};