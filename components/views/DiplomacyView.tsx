import React, { useState, useMemo, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { RankingCategory, getFlagEmoji, BotEvent } from '../../utils/engine/rankings';
import { BotPersonality, ResourceType } from '../../types/enums';
import { Search, Shield, Zap, Target, Gift, Handshake, Heart, Loader2, TrendingUp, TrendingDown, Clock, Users, Skull, Crown, Info } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Icons, SmartTooltip } from '../UIComponents';
import { calculateGiftCost, calculateDecayMultiplier } from '../../utils/engine/diplomacy';
import { formatNumber } from '../../utils';

const DiplomacyView: React.FC = () => {
    const { gameState: state, sendDiplomaticGift, proposeDiplomaticAlliance, proposeDiplomaticPeace } = useGame();
    const { t } = useLanguage();
    const [search, setSearch] = useState('');
    const [personalityFilter, setPersonalityFilter] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<'REPUTATION' | 'SCORE' | 'NAME'>('REPUTATION');
    const [currentPage, setCurrentPage] = useState(1);
    const [isMobile, setIsMobile] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    
    const ui = t.common.ui as any;

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
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

    const canSendGift = (botId: string): { allowed: boolean; remainingMs: number } => {
        const actions = state.diplomaticActions[botId];
        const cooldownMs = 60 * 60 * 1000;
        const lastTime = actions?.lastGiftTime ?? 0;
        const remaining = Math.max(0, cooldownMs - (Date.now() - lastTime));
        return { allowed: remaining === 0, remainingMs: remaining };
    };

    const canProposeAlliance = (botId: string): { allowed: boolean; remainingMs: number } => {
        const actions = state.diplomaticActions[botId];
        const cooldownMs = 4 * 60 * 60 * 1000;
        const lastTime = actions?.lastAllianceTime ?? 0;
        const remaining = Math.max(0, cooldownMs - (Date.now() - lastTime));
        return { allowed: remaining === 0, remainingMs: remaining };
    };

    const canProposePeace = (botId: string): { allowed: boolean; remainingMs: number } => {
        const actions = state.diplomaticActions[botId];
        const cooldownMs = 4 * 60 * 60 * 1000;
        const lastTime = actions?.lastPeaceTime ?? 0;
        const remaining = Math.max(0, cooldownMs - (Date.now() - lastTime));
        return { allowed: remaining === 0, remainingMs: remaining };
    };

    const hasEnoughResources = (bot: any): boolean => {
        const cost = calculateGiftCost(bot);
        return (state.resources[ResourceType.MONEY] ?? 0) >= (cost.MONEY ?? 0) &&
               (state.resources[ResourceType.OIL] ?? 0) >= (cost.OIL ?? 0) &&
               (state.resources[ResourceType.AMMO] ?? 0) >= (cost.AMMO ?? 0) &&
               (state.resources[ResourceType.GOLD] ?? 0) >= (cost.GOLD ?? 0);
    };

    const getGiftCost = (bot: any) => calculateGiftCost(bot);

    const getCooldownText = (remainingMs: number): string => {
        if (remainingMs === 0) return '';
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    const getDecayTooltip = (rep: number): React.ReactNode => {
        if (rep >= 75) {
            return (
                <div className="space-y-1.5 text-xs">
                    <div className="font-bold text-green-400 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> {t.common.ui.tooltip_no_decay || 'Reputación Estable'}</div>
                    <div className="text-slate-400">{t.common.ui.tooltip_no_decay_desc || 'Por encima de 75, la reputación no decae automáticamente'}</div>
                </div>
            );
        }
        if (rep < 40) {
            const multiplier = calculateDecayMultiplier(rep);
            const decayPerCycle = Math.floor(2 * multiplier);
            return (
                <div className="space-y-1.5 text-xs">
                    <div className="font-bold text-red-400 flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5" /> {t.common.ui.tooltip_accelerated_decay || 'Decaimiento Acelerado'}</div>
                    <div className="text-slate-400">{t.common.ui.tooltip_decay_multiplier || 'Multiplicador'}: x{multiplier.toFixed(1)}</div>
                    <div className="text-slate-400">{t.common.ui.tooltip_decay_loss || 'Pérdida por ciclo'}: -{decayPerCycle}</div>
                    <div className="text-slate-500">{t.common.ui.tooltip_decay_info || 'Bajo 40 de reputación, el decaimiento es más rápido'}</div>
                </div>
            );
        }
        return (
            <div className="space-y-1.5 text-xs">
                <div className="font-bold text-yellow-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {t.common.ui.tooltip_normal_decay || 'Decaimiento Normal'}</div>
                <div className="text-slate-400">{t.common.ui.tooltip_decay_interval || 'Intervalo'}: 4 horas</div>
                <div className="text-slate-400">{t.common.ui.tooltip_decay_amount || 'Pérdida'}: -2 por ciclo</div>
                <div className="text-slate-500">{t.common.ui.tooltip_decay_normal_desc || 'Zona estable (40-74): decaimiento normal'}</div>
            </div>
        );
    };

    const getDecayIcon = (rep: number) => {
        if (rep >= 75) return <TrendingUp className="w-3 h-3 text-green-400" />;
        if (rep < 40) return <TrendingDown className="w-3 h-3 text-red-400" />;
        return <Clock className="w-3 h-3 text-yellow-400" />;
    };

    const handleGift = async (botId: string) => {
        setActionLoading(botId);
        await sendDiplomaticGift(botId);
        setActionLoading(null);
    };

    const handleAlliance = async (botId: string) => {
        setActionLoading(botId);
        await proposeDiplomaticAlliance(botId);
        setActionLoading(null);
    };

    const handlePeace = async (botId: string) => {
        setActionLoading(botId);
        await proposeDiplomaticPeace(botId);
        setActionLoading(null);
    };

    const statsTooltip = (
        <div className="space-y-2 text-xs min-w-[200px]">
            <div className="font-bold text-cyan-400 border-b border-slate-700 pb-1.5 mb-1">{t.common.ui.diplomacy_stats || 'Estadísticas de Diplomacia'}</div>
            <div className="flex justify-between"><span className="text-slate-400">{t.common.ui.performance || 'Promedio'}:</span><span className="text-blue-400 font-bold">{Math.floor(stats.avgRep)}%</span></div>
            <div className="flex justify-between"><span className="text-slate-400">{t.common.ui.diplomacy_allies || 'Aliados'} (&gt;70):</span><span className="text-green-400 font-bold">{stats.allies}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">{t.common.ui.diplomacy_enemies || 'Enemigos'} (&lt;30):</span><span className="text-red-400 font-bold">{stats.enemies}</span></div>
            <div className="text-slate-500 pt-1 border-t border-slate-700">{t.common.ui.diplomacy_stats_desc || 'Actualizado en tiempo real'}</div>
        </div>
    );

    return (
        <div className="flex flex-col min-h-full text-white pb-4">
            <div className="bg-gray-800 p-3 md:p-4 rounded-lg border border-gray-700 shadow-lg">
                <div className="flex items-center justify-between mb-2 md:mb-3">
                    <h1 className="text-lg md:text-2xl font-bold flex items-center gap-2">
                        <Shield className="text-blue-400 w-5 h-5 md:w-6 md:h-6" /> 
                        <span className="hidden sm:inline">{t.common.ui.diplomacy || 'Diplomacy'}</span>
                    </h1>
                    <SmartTooltip content={statsTooltip} triggerMode="hover" placement="bottom">
                        <div className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 cursor-pointer transition-colors">
                            <Info className="w-4 h-4 text-slate-400" />
                        </div>
                    </SmartTooltip>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <SmartTooltip 
                        content={<div className="text-xs"><span className="text-blue-400 font-bold">{Math.floor(stats.avgRep)}%</span><br/>{t.common.ui.tooltip_avg_rep || 'Reputación promedio de todos los comandantes'}</div>}
                        triggerMode="hover"
                    >
                        <div className="bg-gray-700 p-2 rounded-lg cursor-help hover:bg-gray-600 transition-colors">
                            <div className="text-gray-400 italic text-[9px] md:text-[10px] uppercase">{t.common.ui.performance || 'Average'}</div>
                            <div className="font-bold text-blue-400 text-sm md:text-base">{Math.floor(stats.avgRep)}%</div>
                        </div>
                    </SmartTooltip>
                    <SmartTooltip 
                        content={<div className="text-xs"><span className="text-green-400 font-bold">{stats.allies}</span> {t.common.ui.tooltip_allies || 'comandantes'}<br/>{t.common.ui.tooltip_allies_desc || 'Con reputación mayor a 70%'}</div>}
                        triggerMode="hover"
                    >
                        <div className="bg-gray-700 p-2 rounded-lg cursor-help hover:bg-gray-600 transition-colors">
                            <div className="text-gray-400 italic text-[9px] md:text-[10px] uppercase">{t.common.ui.diplomacy_allies || 'Allies'}</div>
                            <div className="font-bold text-green-400 text-sm md:text-base">{stats.allies}</div>
                        </div>
                    </SmartTooltip>
                    <SmartTooltip 
                        content={<div className="text-xs"><span className="text-red-400 font-bold">{stats.enemies}</span> {t.common.ui.tooltip_enemies || 'comandantes'}<br/>{t.common.ui.tooltip_enemies_desc || 'Con reputación menor a 30%'}</div>}
                        triggerMode="hover"
                    >
                        <div className="bg-gray-700 p-2 rounded-lg cursor-help hover:bg-gray-600 transition-colors">
                            <div className="text-gray-400 italic text-[9px] md:text-[10px] uppercase">{t.common.ui.diplomacy_enemies || 'Enemies'}</div>
                            <div className="font-bold text-red-400 text-sm md:text-base">{stats.enemies}</div>
                        </div>
                    </SmartTooltip>
                </div>
            </div>

            <div className="flex flex-col space-y-2 mt-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder={t.common.ui.diplomacy_search_placeholder || "Search commander..."}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:border-blue-500 text-sm md:text-base"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <select 
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 md:py-1 text-xs md:text-sm focus:outline-none whitespace-nowrap"
                        value={personalityFilter}
                        onChange={(e) => setPersonalityFilter(e.target.value)}
                    >
                        <option value="ALL">{t.common.ui.diplomacy_filter_all || 'All Personalities'}</option>
                        {Object.values(BotPersonality).map(p => (
                            <option key={p} value={p}>{getPersonalityLabel(p)}</option>
                        ))}
                    </select>
                    <select 
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 md:py-1 text-xs md:text-sm focus:outline-none whitespace-nowrap"
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
                            className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 flex items-center justify-center border border-gray-600 transition-all active:scale-95 text-gray-300"
                        >
                            <Icons.ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-mono font-bold text-blue-400 w-12 md:w-14 text-center">
                            {currentPage} <span className="text-gray-500">/ {totalPages}</span>
                        </span>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 flex items-center justify-center border border-gray-600 transition-all active:scale-95 text-gray-300"
                        >
                            <Icons.ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-col space-y-2 md:space-y-3 mt-3 md:mt-4">
                {displayedBots.map((bot) => {
                    const giftCheck = canSendGift(bot.id);
                    const allianceCheck = canProposeAlliance(bot.id);
                    const peaceCheck = canProposePeace(bot.id);
                    const giftCost = getGiftCost(bot);
                    const resourceCheck = hasEnoughResources(bot);
                    
                    return (
                        <div key={bot.id} className="bg-gray-800 border border-gray-700 rounded-xl p-3 md:p-4 flex flex-col space-y-2 md:space-y-3 shadow-md">
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-700 rounded-full flex items-center justify-center border-2 border-gray-600 overflow-hidden shrink-0">
                                        <img src={`/assets/avatars/bot_${bot.avatarId}.png`} alt="Avatar" className="w-full h-full object-cover" onError={(e) => {
                                            (e.target as any).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${bot.id}`;
                                        }} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-sm md:text-lg flex items-center gap-1.5 truncate">
                                            <span className="shrink-0">{getFlagEmoji(bot.country)}</span>
                                            <span className="truncate">{bot.name}</span>
                                        </div>
                                        <div className="text-xs text-gray-400 uppercase tracking-wider truncate">{getPersonalityLabel(bot.personality)}</div>
                                    </div>
                                </div>
                                <div className={`text-right shrink-0 ${getReputationColor(bot.reputation ?? 50)}`}>
                                    <div className="text-xl md:text-2xl font-black">{(bot.reputation ?? 50).toFixed(0)}</div>
                                    <div className="text-[9px] md:text-[10px] font-bold uppercase">{getReputationLabel(bot.reputation ?? 50)}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 md:gap-4">
                                <SmartTooltip 
                                    content={
                                        <div className="space-y-1 text-xs">
                                            <div className="font-bold text-orange-400">{t.common.ui.est_power || 'Poder Estimado'}</div>
                                            <div className="text-slate-400">{t.common.ui.tooltip_score_desc || 'Puntos de imperio del comandante'}</div>
                                            <div className="text-slate-500">{formatNumber(bot.stats[RankingCategory.DOMINION])} pts</div>
                                        </div>
                                    }
                                    triggerMode="hover"
                                >
                                    <div className="flex items-center gap-2 text-sm text-gray-300 cursor-help hover:text-white transition-colors">
                                        <Target className="w-4 h-4 text-orange-400 shrink-0" />
                                        <span className="truncate">{formatNumber(bot.stats[RankingCategory.DOMINION])} pts</span>
                                    </div>
                                </SmartTooltip>
                                <SmartTooltip 
                                    content={
                                        <div className="space-y-1 text-xs">
                                            <div className="font-bold text-yellow-400">{t.common.ui.bot_event || 'Evento Actual'}</div>
                                            <div className="text-slate-400">{getEventLabel(bot.currentEvent)}</div>
                                            <div className="text-slate-500">{t.common.ui.tooltip_event_desc || 'Estado actual del comandante'}</div>
                                        </div>
                                    }
                                    triggerMode="hover"
                                >
                                    <div className="flex items-center gap-2 text-sm text-gray-300 cursor-help hover:text-white transition-colors">
                                        <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
                                        <span className="truncate">{getEventLabel(bot.currentEvent)}</span>
                                    </div>
                                </SmartTooltip>
                            </div>

                            <SmartTooltip content={getDecayTooltip(bot.reputation ?? 50)} triggerMode="hover">
                                <div className="w-full bg-gray-900 rounded-full h-2 mt-1 overflow-hidden relative cursor-help group">
                                    <div 
                                        className={`h-full transition-all duration-500 ${(bot.reputation ?? 50) > 70 ? 'bg-green-500' : (bot.reputation ?? 50) < 30 ? 'bg-red-500' : 'bg-yellow-500'}`}
                                        style={{ width: `${bot.reputation ?? 50}%` }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-end pr-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {getDecayIcon(bot.reputation ?? 50)}
                                    </div>
                                </div>
                            </SmartTooltip>

                            <div className="flex gap-1.5 md:gap-2 mt-2 md:mt-3">
                                <SmartTooltip 
                                    content={
                                        !giftCheck.allowed ? (
                                            <div className="space-y-1 text-xs">
                                                <div className="font-bold text-yellow-400">{t.common.ui.diplomacy_send_gift || 'Regalo'}</div>
                                                <div className="text-slate-400">{t.common.ui.tooltip_cooldown || 'En cooldown'}</div>
                                                <div className="text-red-400">{getCooldownText(giftCheck.remainingMs)}</div>
                                            </div>
                                        ) : !resourceCheck ? (
                                            <div className="space-y-1 text-xs">
                                                <div className="font-bold text-blue-400">{t.common.ui.diplomacy_send_gift || 'Regalo'}</div>
                                                <div className="text-slate-400">{t.common.ui.tooltip_cost || 'Costo'}:</div>
                                                <div className="text-red-400">{t.common.ui.tooltip_insufficient_resources || 'Recursos insuficientes'}</div>
                                                <div className="text-slate-500 flex items-center gap-1">{giftCost.MONEY?.toLocaleString()}<Icons.Resources.Money className="w-3 h-3 text-emerald-400" /> {giftCost.OIL?.toLocaleString()}<Icons.Resources.Oil className="w-3 h-3 text-purple-400" /> {giftCost.AMMO?.toLocaleString()}<Icons.Resources.Ammo className="w-3 h-3 text-orange-400" /> {giftCost.GOLD?.toLocaleString()}<Icons.Resources.Gold className="w-3 h-3 text-yellow-400" /> </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1 text-xs min-w-[180px]">
                                                <div className="font-bold text-blue-400 flex items-center gap-1.5"><Gift className="w-3.5 h-3.5" /> {t.common.ui.diplomacy_send_gift || 'Enviar Regalo'}</div>
                                                <div className="text-green-400">+8 {t.common.ui.reputation || 'reputación'}</div>
                                                <div className="text-slate-400 border-t border-slate-700 pt-1 mt-1">{t.common.ui.tooltip_cost || 'Costo'}:</div>
                                                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                                                    {giftCost.MONEY > 0 && <span className="flex items-center gap-0.5">{giftCost.MONEY?.toLocaleString()}<Icons.Resources.Money className="w-3 h-3 text-emerald-400" /> </span>}
                                                    {giftCost.OIL > 0 && <span className="flex items-center gap-0.5">{giftCost.OIL?.toLocaleString()}<Icons.Resources.Oil className="w-3 h-3 text-purple-400" /> </span>}
                                                    {giftCost.AMMO > 0 && <span className="flex items-center gap-0.5">{giftCost.AMMO?.toLocaleString()}<Icons.Resources.Ammo className="w-3 h-3 text-orange-400" /> </span>}
                                                    {giftCost.GOLD > 0 && <span className="flex items-center gap-0.5">{giftCost.GOLD?.toLocaleString()}<Icons.Resources.Gold className="w-3 h-3 text-yellow-400" /> </span>}
                                                </div>
                                                <div className="text-slate-500 text-[10px] border-t border-slate-700 pt-1 mt-1">{t.common.ui.tooltip_gift_cooldown || 'Cooldown: 1 hora'}</div>
                                            </div>
                                        )
                                    }
                                    triggerMode="hover"
                                    placement="top"
                                >
                                    <button
                                        onClick={() => handleGift(bot.id)}
                                        disabled={actionLoading === bot.id || !giftCheck.allowed || !resourceCheck}
                                        className="flex-1 flex items-center justify-center gap-1 px-1.5 py-2 md:px-2 md:py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-all active:scale-95"
                                    >
                                        {actionLoading === bot.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Gift className="w-3 h-3" />
                                        )}
                                        <span className="hidden sm:inline">{t.common.ui.diplomacy_gift || 'Regalo'}</span>
                                    </button>
                                </SmartTooltip>
                                
                                <SmartTooltip 
                                    content={
                                        !allianceCheck.allowed ? (
                                            <div className="space-y-1 text-xs">
                                                <div className="font-bold text-green-400">{t.common.ui.diplomacy_propose_alliance || 'Alianza'}</div>
                                                <div className="text-slate-400">{t.common.ui.tooltip_cooldown || 'En cooldown'}</div>
                                                <div className="text-yellow-400">{getCooldownText(allianceCheck.remainingMs)}</div>
                                            </div>
                                        ) : (bot.reputation ?? 50) < 50 ? (
                                            <div className="space-y-1 text-xs">
                                                <div className="font-bold text-green-400">{t.common.ui.diplomacy_propose_alliance || 'Alianza'}</div>
                                                <div className="text-red-400">{t.common.ui.tooltip_reputation_low || 'Reputación muy baja'}</div>
                                                <div className="text-slate-400">{t.common.ui.tooltip_alliance_req || 'Requiere'}: 50%+</div>
                                                <div className="text-slate-500">{t.common.ui.current || 'Actual'}: {(bot.reputation ?? 50).toFixed(0)}%</div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1 text-xs min-w-[180px]">
                                                <div className="font-bold text-green-400 flex items-center gap-1.5"><Handshake className="w-3.5 h-3.5" /> {t.common.ui.diplomacy_propose_alliance || 'Proponer Alianza'}</div>
                                                <div className="text-green-400">+5 {t.common.ui.reputation || 'reputación'}</div>
                                                <div className="text-slate-400 border-t border-slate-700 pt-1 mt-1">{t.common.ui.tooltip_requirement || 'Requisito'}:</div>
                                                <div className="text-slate-300">≥50% {t.common.ui.reputation || 'reputación'}</div>
                                                <div className="text-slate-500 text-[10px] border-t border-slate-700 pt-1 mt-1">{t.common.ui.tooltip_alliance_cooldown || 'Cooldown: 4 horas'}</div>
                                            </div>
                                        )
                                    }
                                    triggerMode="hover"
                                    placement="top"
                                >
                                    <button
                                        onClick={() => handleAlliance(bot.id)}
                                        disabled={actionLoading === bot.id || !allianceCheck.allowed || (bot.reputation ?? 50) < 50}
                                        className="flex-1 flex items-center justify-center gap-1 px-1.5 py-2 md:px-2 md:py-1.5 bg-green-700 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-all active:scale-95"
                                    >
                                        {actionLoading === bot.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Handshake className="w-3 h-3" />
                                        )}
                                        <span className="hidden sm:inline">{t.common.ui.diplomacy_alliance || 'Alianza'}</span>
                                    </button>
                                </SmartTooltip>
                                
                                <SmartTooltip 
                                    content={
                                        !peaceCheck.allowed ? (
                                            <div className="space-y-1 text-xs">
                                                <div className="font-bold text-purple-400">{t.common.ui.diplomacy_propose_peace || 'Paz'}</div>
                                                <div className="text-slate-400">{t.common.ui.tooltip_cooldown || 'En cooldown'}</div>
                                                <div className="text-yellow-400">{getCooldownText(peaceCheck.remainingMs)}</div>
                                            </div>
                                        ) : (bot.reputation ?? 50) >= 50 ? (
                                            <div className="space-y-1 text-xs">
                                                <div className="font-bold text-purple-400">{t.common.ui.diplomacy_propose_peace || 'Paz'}</div>
                                                <div className="text-yellow-400">{t.common.ui.tooltip_peace_unnecessary || 'No necesario'}</div>
                                                <div className="text-slate-400">{t.common.ui.tooltip_peace_desc || 'Ya no es hostil'}</div>
                                                <div className="text-slate-500">{t.common.ui.current || 'Actual'}: {(bot.reputation ?? 50).toFixed(0)}%</div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1 text-xs min-w-[180px]">
                                                <div className="font-bold text-purple-400 flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" /> {t.common.ui.diplomacy_propose_peace || 'Proponer Paz'}</div>
                                                <div className="text-green-400">+5-10 {t.common.ui.reputation || 'reputación'}</div>
                                                <div className="text-slate-400 border-t border-slate-700 pt-1 mt-1">{t.common.ui.tooltip_requirement || 'Requisito'}:</div>
                                                <div className="text-slate-300">&lt;50% {t.common.ui.reputation || 'reputación'}</div>
                                                <div className="text-slate-500 text-[10px] border-t border-slate-700 pt-1 mt-1">{t.common.ui.tooltip_peace_cooldown || 'Cooldown: 4 horas'}</div>
                                                <div className="text-slate-600 text-[10px]">{t.common.ui.tooltip_peace_bonus || 'Más bonus si el enemigo es muy hostil'}</div>
                                            </div>
                                        )
                                    }
                                    triggerMode="hover"
                                    placement="top"
                                >
                                    <button
                                        onClick={() => handlePeace(bot.id)}
                                        disabled={actionLoading === bot.id || !peaceCheck.allowed || (bot.reputation ?? 50) >= 50}
                                        className="flex-1 flex items-center justify-center gap-1 px-1.5 py-2 md:px-2 md:py-1.5 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-all active:scale-95"
                                    >
                                        {actionLoading === bot.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Heart className="w-3 h-3" />
                                        )}
                                        <span className="hidden sm:inline">{t.common.ui.diplomacy_peace || 'Paz'}</span>
                                    </button>
                                </SmartTooltip>
                            </div>
                        </div>
                    );
                })}
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
