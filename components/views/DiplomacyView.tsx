import React, { useState, useMemo, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { RankingCategory, getFlagEmoji, BotEvent } from '../../utils/engine/rankings';
import { BotPersonality } from '../../types/enums';
import { Search, Shield, Zap, Target } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Icons } from '../UIComponents';

const DiplomacyView: React.FC = () => {
    const { gameState: state } = useGame();
    const { t } = useLanguage();
    const [search, setSearch] = useState('');
    const [personalityFilter, setPersonalityFilter] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<'REPUTATION' | 'SCORE' | 'NAME'>('REPUTATION');
    const [currentPage, setCurrentPage] = useState(1);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const bots = state.rankingData.bots;

    const filteredBots = useMemo(() => {
        return bots
            .filter(bot => {
                const matchesSearch = bot.name.toLowerCase().includes(search.toLowerCase());
                const matchesPersonality = personalityFilter === 'ALL' || bot.personality === personalityFilter;
                return matchesSearch && matchesPersonality;
            })
            .sort((a, b) => {
                if (sortBy === 'REPUTATION') return b.reputation - a.reputation;
                if (sortBy === 'SCORE') return b.stats[RankingCategory.DOMINION] - a.stats[RankingCategory.DOMINION];
                return a.name.localeCompare(b.name);
            });
    }, [bots, search, personalityFilter, sortBy]);

    const stats = useMemo(() => {
        const totalRep = bots.reduce((acc, b) => acc + (b.reputation || 50), 0);
        const avgRep = totalRep / bots.length;
        const enemies = bots.filter(b => (b.reputation || 50) < 30).length;
        const allies = bots.filter(b => (b.reputation || 50) > 70).length;
        return { avgRep, enemies, allies };
    }, [bots]);

    const ITEMS_PER_PAGE_MOBILE = 10;
    const ITEMS_PER_PAGE_DESKTOP = 20;
    const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE_DESKTOP;
    const totalPages = Math.ceil(filteredBots.length / itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, personalityFilter, sortBy]);

    const displayedBots = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredBots.slice(start, start + itemsPerPage);
    }, [currentPage, filteredBots, itemsPerPage]);

    const getReputationColor = (rep: number = 50) => {
        if (rep > 70) return 'text-green-400';
        if (rep < 30) return 'text-red-400';
        return 'text-yellow-400';
    };

    const getReputationLabel = (rep: number = 50) => {
        if (rep > 85) return t.common.ui.reputation_loyal_ally || 'Aliado Leal';
        if (rep > 70) return t.common.ui.reputation_friendly || 'Amistoso';
        if (rep > 40) return t.common.ui.reputation_neutral || 'Neutral';
        if (rep > 15) return t.common.ui.reputation_hostile || 'Hostil';
        return t.common.ui.reputation_mortal_enemy || 'Enemigo Mortal';
    };

    const getPersonalityLabel = (personality: BotPersonality): string => {
        switch (personality) {
            case BotPersonality.WARLORD: return t.common.ui.personality_warlord || 'Señor de la Guerra';
            case BotPersonality.TURTLE: return t.common.ui.personality_turtle || 'La Tortuga';
            case BotPersonality.TYCOON: return t.common.ui.personality_tycoon || 'Magnate';
            case BotPersonality.ROGUE: return t.common.ui.personality_rogue || 'Oportunista';
            default: return personality;
        }
    };

    const getEventLabel = (event: BotEvent): string => {
        switch (event) {
            case BotEvent.ATTACKED: return t.common.ui.bot_event_attacked || 'Bajo Ataque';
            case BotEvent.SUCCESSFUL_RAID: return t.common.ui.bot_event_successful_raid || 'Saqueo Exitoso';
            case BotEvent.ECONOMIC_BOOM: return t.common.ui.bot_event_economic_boom || 'Auge Económico';
            case BotEvent.RESOURCES_CRISIS: return t.common.ui.bot_event_resources_crisis || 'Crisis de Recursos';
            case BotEvent.MILITARY_BUILDUP: return t.common.ui.bot_event_military_buildup || 'Rearmamento';
            case BotEvent.PEACEFUL_PERIOD: return t.common.ui.bot_event_peaceful_period || 'Período Pacífico';
            default: return event;
        }
    };

    return (
        <div className="flex flex-col min-h-full text-white pb-4">
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg">
                <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    <Shield className="text-blue-400" /> {t.common.ui.diplomacy || 'Diplomacy'}
                </h1>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-gray-700 p-2 rounded">
                        <div className="text-gray-400 italic text-[10px] uppercase">{t.common.ui.performance || 'Average'}</div>
                        <div className="font-bold text-blue-400">{Math.floor(stats.avgRep)}%</div>
                    </div>
                    <div className="bg-gray-700 p-2 rounded">
                        <div className="text-gray-400 italic text-[10px] uppercase">{t.common.ui.diplomacy_allies || 'Allies'}</div>
                        <div className="font-bold text-green-400">{stats.allies}</div>
                    </div>
                    <div className="bg-gray-700 p-2 rounded">
                        <div className="text-gray-400 italic text-[10px] uppercase">{t.common.ui.diplomacy_enemies || 'Enemies'}</div>
                        <div className="font-bold text-red-400">{stats.enemies}</div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col space-y-2 mt-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder={t.common.ui.diplomacy_search_placeholder || "Search commander..."}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:border-blue-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <select 
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm focus:outline-none"
                        value={personalityFilter}
                        onChange={(e) => setPersonalityFilter(e.target.value)}
                    >
                        <option value="ALL">{t.common.ui.diplomacy_filter_all || 'All Personalities'}</option>
                        {Object.values(BotPersonality).map(p => (
                            <option key={p} value={p}>{getPersonalityLabel(p)}</option>
                        ))}
                    </select>
                    <select 
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm focus:outline-none"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                    >
                        <option value="REPUTATION">{t.common.ui.diplomacy_sort_reputation || 'Reputation'}</option>
                        <option value="SCORE">{t.common.ui.diplomacy_sort_score || 'Score'}</option>
                        <option value="NAME">{t.common.ui.diplomacy_sort_name || 'Name'}</option>
                    </select>
                </div>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 mb-2 px-1">
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                        {t.common.ui.nav_base || 'Commanders'}
                    </span>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="w-10 h-10 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 flex items-center justify-center border border-gray-600 transition-all active:scale-95 text-gray-300"
                        >
                            <Icons.ChevronLeft />
                        </button>
                        <span className="text-xs font-mono font-bold text-blue-400 w-12 text-center">
                            {currentPage} <span className="text-gray-500">/ {totalPages}</span>
                        </span>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="w-10 h-10 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 flex items-center justify-center border border-gray-600 transition-all active:scale-95 text-gray-300"
                        >
                            <Icons.ChevronRight />
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-col space-y-3 mt-4">
                {displayedBots.map((bot) => (
                    <div key={bot.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col space-y-3 shadow-md">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center border-2 border-gray-600 overflow-hidden">
                                    <img src={`/assets/avatars/bot_${bot.avatarId}.png`} alt="Avatar" className="w-full h-full object-cover" onError={(e) => {
                                        (e.target as any).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${bot.id}`;
                                    }} />
                                </div>
                                <div>
                                    <div className="font-bold text-lg flex items-center gap-2">
                                        {getFlagEmoji(bot.country)} {bot.name}
                                    </div>
                                    <div className="text-xs text-gray-400 uppercase tracking-wider">{getPersonalityLabel(bot.personality)}</div>
                                </div>
                            </div>
                            <div className={`text-right ${getReputationColor(bot.reputation ?? 50)}`}>
                                <div className="text-2xl font-black">{bot.reputation ?? 50}</div>
                                <div className="text-[10px] font-bold uppercase">{getReputationLabel(bot.reputation ?? 50)}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <Target className="w-4 h-4 text-orange-400" />
                                <span>{bot.stats[RankingCategory.DOMINION].toLocaleString()} pts</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <Zap className="w-4 h-4 text-yellow-400" />
                                <span>{getEventLabel(bot.currentEvent)}</span>
                            </div>
                        </div>

                        <div className="w-full bg-gray-900 rounded-full h-2 mt-1 overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ${(bot.reputation ?? 50) > 70 ? 'bg-green-500' : (bot.reputation ?? 50) < 30 ? 'bg-red-500' : 'bg-yellow-500'}`}
                                style={{ width: `${bot.reputation ?? 50}%` }}
                            />
                        </div>
                    </div>
                ))}
                {filteredBots.length === 0 && (
                    <div className="text-center py-10 text-gray-500 italic">
                        {t.common.ui.diplomacy_no_results || 'No commanders found matching criteria.'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DiplomacyView;
