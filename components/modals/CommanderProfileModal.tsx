import React, { useEffect, useState } from 'react';
import { GameState, TranslationDictionary, SpyReport, ResourceType, UnitType } from '../../types';
import { RankingEntry, getFlagEmoji, StaticBot } from '../../utils/engine/rankings';
import { Icons, GlassButton } from '../UIComponents';
import { formatNumber } from '../../utils';
import { PVP_RANGE_MAX, PVP_RANGE_MIN, NEWBIE_PROTECTION_THRESHOLD } from '../../constants';
import { BotPersonality } from '../../types/enums';
import { calculateSpyCost, generateSpyReport } from '../../utils/engine/missions';

interface ProfileModalProps {
    entry: RankingEntry;
    gameState: GameState;
    t: TranslationDictionary;
    onClose: () => void;
    onDeclareWar: () => void;
    onAttack: () => void;
    onUpdateState?: (updates: Partial<GameState>) => void;
}

const getTierInfo = (tier: string) => {
    switch(tier) {
        case 'S': return { color: 'text-yellow-400', bg: 'bg-yellow-950/40', border: 'border-yellow-500/50' };
        case 'A': return { color: 'text-purple-400', bg: 'bg-purple-950/40', border: 'border-purple-500/50' };
        case 'B': return { color: 'text-cyan-400', bg: 'bg-cyan-950/40', border: 'border-cyan-500/50' };
        case 'C': return { color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-500/50' };
        default: return { color: 'text-slate-400', bg: 'bg-slate-950/40', border: 'border-slate-500/50' };
    }
};

export const CommanderProfileModal: React.FC<ProfileModalProps> = ({ entry, gameState, t, onClose, onDeclareWar, onAttack, onUpdateState }) => {
    const [topBarHeight, setTopBarHeight] = useState(70);
    const [bottomBarHeight, setBottomBarHeight] = useState(70);
    const [showSpyReport, setShowSpyReport] = useState(false);
    const [isSpying, setIsSpying] = useState(false);

    const now = Date.now();
    const activeSpyReport = gameState.spyReports?.find(r => r.botId === entry.id && r.expiresAt > now);
    const spyCost = calculateSpyCost(entry.score);
    const canAffordSpy = gameState.resources[ResourceType.GOLD] >= spyCost;

    const handleSpy = () => {
        if (!canAffordSpy || isSpying) return;
        
        const targetBot = gameState.rankingData.bots.find(b => b.id === entry.id);
        if (!targetBot) return;
        
        setIsSpying(true);
        
        const newReport = generateSpyReport(targetBot, now);
        
        const newSpyReports = [...(gameState.spyReports || []), newReport];
        
        if (onUpdateState) {
            onUpdateState({
                resources: {
                    ...gameState.resources,
                    [ResourceType.GOLD]: gameState.resources[ResourceType.GOLD] - spyCost
                },
                spyReports: newSpyReports
            });
        } else if (typeof (window as any)._updateGameState === 'function') {
            (window as any)._updateGameState({
                resources: {
                    ...gameState.resources,
                    [ResourceType.GOLD]: gameState.resources[ResourceType.GOLD] - spyCost
                },
                spyReports: newSpyReports
            });
        }
        
        setShowSpyReport(true);
        setIsSpying(false);
    };

    useEffect(() => {
        const updateBarHeights = () => {
            const topBar = document.getElementById('game-header');
            const bottomBar = document.getElementById('mobile-navbar');
            
            if (topBar) {
                const rect = topBar.getBoundingClientRect();
                setTopBarHeight(rect.height);
            }
            
            if (bottomBar) {
                const rect = bottomBar.getBoundingClientRect();
                setBottomBarHeight(rect.height);
            }
        };

        updateBarHeights();
        window.addEventListener('resize', updateBarHeights);
        return () => window.removeEventListener('resize', updateBarHeights);
    }, []);

    const modalHeight = `calc(100vh - ${topBarHeight}px - ${bottomBarHeight}px - 24px)`;
    const modalTop = `${topBarHeight + 12}px`;
    const ratio = entry.score / Math.max(1, gameState.empirePoints);
    const inRange = ratio >= 0.5 && ratio <= 1.5;
    const percentage = Math.round(ratio * 100);
    const tierInfo = getTierInfo(entry.tier);
    
    const isMe = entry.isPlayer;
    const hasActiveWar = !!gameState.activeWar;
    const isWarTarget = gameState.activeWar?.enemyId === entry.id;
    const isNewbie = gameState.empirePoints < NEWBIE_PROTECTION_THRESHOLD;

    const getPersonalityInfo = (type: BotPersonality) => {
        switch(type) {
            case BotPersonality.WARLORD: return { color: 'text-red-400', bg: 'bg-red-950/30', border: 'border-red-500/30', icon: Icons.Skull, title: t.features.rankings.types.WARLORD, desc: t.features.rankings.types.WARLORD_DESC };
            case BotPersonality.TURTLE: return { color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-500/30', icon: Icons.Shield, title: t.features.rankings.types.TURTLE, desc: t.features.rankings.types.TURTLE_DESC };
            case BotPersonality.TYCOON: return { color: 'text-yellow-400', bg: 'bg-yellow-950/30', border: 'border-yellow-500/30', icon: Icons.Resources.Money, title: t.features.rankings.types.TYCOON, desc: t.features.rankings.types.TYCOON_DESC };
            case BotPersonality.ROGUE: return { color: 'text-purple-400', bg: 'bg-purple-950/30', border: 'border-purple-500/30', icon: Icons.Crosshair, title: t.features.rankings.types.ROGUE, desc: t.features.rankings.types.ROGUE_DESC };
            default: return { color: 'text-slate-400', bg: 'bg-slate-950/30', border: 'border-slate-500/30', icon: Icons.Info, title: t.common.ui.profile_unknown || 'Unknown', desc: '' };
        }
    };

    const pInfo = entry.personality ? getPersonalityInfo(entry.personality) : null;
    const IconComponent = pInfo?.icon || Icons.Info;

    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <div className={`fixed inset-0 z-[100] flex bg-black/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out] ${isMobile ? 'items-start justify-center pt-0' : 'items-center justify-center p-3 md:p-6'}`} onClick={onClose}>
            <div 
                className="w-full max-w-md glass-panel rounded-2xl border border-white/10 shadow-2xl flex flex-col animate-[slideUp_0.3s_ease-out] overflow-hidden"
                style={isMobile ? { 
                    height: modalHeight,
                    marginTop: '12px',
                    marginBottom: '12px',
                    marginLeft: '12px',
                    marginRight: '12px'
                } : {}}
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40 shrink-0">
                    <div className="flex items-center gap-2">
                        <Icons.Radar className="text-cyan-400" />
                        <h3 className="font-tech text-xs text-cyan-400 tracking-widest uppercase">{t.common.ui.commander_intel}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                        <Icons.Close className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-4 space-y-4">
                        <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-4">
                            <div className="text-5xl md:text-6xl shrink-0">{getFlagEmoji(entry.country)}</div>
                            <div className="flex-1 min-w-0">
                                <h2 className="font-tech text-lg md:text-xl text-white uppercase tracking-wide truncate">{entry.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tierInfo.bg} ${tierInfo.border} ${tierInfo.color} border`}>
                                        {entry.tier}{t.features.rankings.class_suffix}
                                    </span>
                                    <span className="text-slate-500 text-xs font-mono">#{entry.rank}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="glass-panel p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center">
                                <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">{t.features.rankings.score}</div>
                                <div className="font-mono font-bold text-xl text-white">{formatNumber(entry.score)}</div>
                            </div>
                            <div className="glass-panel p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center">
                                <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">{t.common.ui.power_ratio_label}</div>
                                <div className={`font-mono font-bold text-xl ${inRange ? 'text-emerald-400' : 'text-orange-400'}`}>{percentage}%</div>
                            </div>
                        </div>

                        <div className="glass-panel p-3 rounded-xl border border-white/5 space-y-2">
                            <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">{t.common.ui.power_ratio_label}</div>
                            <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all ${inRange ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]'}`}
                                    style={{ width: `${Math.min(100, percentage / 1.5)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                                <span>50%</span>
                                <span className={inRange ? 'text-emerald-400' : 'text-orange-400'}>{inRange ? t.common.ui.in_range : t.common.ui.out_range}</span>
                                <span>150%</span>
                            </div>
                        </div>

                        {pInfo && !isMe && (
                            <div className={`glass-panel p-4 rounded-xl border ${pInfo.bg} ${pInfo.border}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">{t.common.ui.strategic_profile}</span>
                                    <IconComponent className={`w-5 h-5 ${pInfo.color}`} />
                                </div>
                                <div className={`font-tech text-base font-bold uppercase tracking-wide ${pInfo.color}`}>{pInfo.title}</div>
                                <p className="text-xs text-slate-400 leading-relaxed mt-1">{pInfo.desc}</p>
                            </div>
                        )}

                        {isMe && (
                            <div className="glass-panel p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 flex items-center justify-center gap-2">
                                <Icons.Crown className="text-cyan-400" />
                                <span className="text-cyan-400 font-bold uppercase tracking-widest text-sm">{t.features.rankings.commander}</span>
                            </div>
                        )}
                    </div>
                </div>

                {!isMe && (
                    <div className="p-4 border-t border-white/10 bg-black/40 shrink-0 space-y-3">
                        {!isMe && !activeSpyReport && (
                            <GlassButton 
                                onClick={handleSpy} 
                                disabled={!canAffordSpy || isSpying} 
                                variant="neutral" 
                                className="w-full py-2.5 text-xs font-bold tracking-widest uppercase border-yellow-900/50 text-yellow-400 hover:bg-yellow-900/20"
                            >
                                {isSpying ? '...' : t.common.ui.spy_button.replace('{cost}', formatNumber(spyCost))}
                            </GlassButton>
                        )}

                        {activeSpyReport && (
                            <button 
                                onClick={() => setShowSpyReport(!showSpyReport)}
                                className="w-full py-2 text-xs font-bold tracking-widest uppercase border border-cyan-500/50 text-cyan-400 hover:bg-cyan-900/20 rounded-lg flex items-center justify-center gap-2"
                            >
                                <Icons.Radar className="w-4 h-4" />
                                {showSpyReport ? t.common.ui.spy_hide_report : t.common.ui.spy_view_report}
                            </button>
                        )}

                        {showSpyReport && activeSpyReport && (
                            <div className="glass-panel rounded-xl border border-cyan-500/30 bg-cyan-950/20 text-xs max-h-64 overflow-y-auto custom-scrollbar">
                                <div className="p-3 border-b border-cyan-500/20 flex items-center justify-between text-cyan-300 font-bold">
                                    <span>{t.common.ui.spy_report_title}</span>
                                    <span className="text-[10px] text-slate-400">
                                        {Math.max(0, Math.ceil((activeSpyReport.expiresAt - now) / 60000))} {t.common.ui.spy_time_remaining}
                                    </span>
                                </div>
                                
                                <div className="p-3 space-y-3">
                                    <div>
                                        <div className="text-[9px] text-slate-400 uppercase tracking-widest">{t.common.ui.spy_detected_units}</div>
                                        <div className="space-y-1 mt-1">
                                            {Object.entries(activeSpyReport.units).map(([unitType, count]) => (
                                                <div key={unitType} className="flex justify-between text-slate-300">
                                                    <span>{t.common.resources[unitType] || unitType.replace(/_/g, ' ').toLowerCase()}</span>
                                                    <span className="font-mono text-white">{formatNumber(count || 0)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-[9px] text-slate-400 uppercase tracking-widest">{t.common.ui.spy_estimated_resources}</div>
                                        <div className="space-y-1 mt-1">
                                            {Object.entries(activeSpyReport.resources).map(([resType, amount]) => (
                                                <div key={resType} className="flex justify-between text-slate-300">
                                                    <span>{t.common.resources[resType] || resType}</span>
                                                    <span className="font-mono text-white">{formatNumber(amount || 0)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-[9px] text-slate-400 uppercase tracking-widest">{t.common.ui.spy_buildings}</div>
                                        <div className="space-y-1 mt-1">
                                            {Object.entries(activeSpyReport.buildings).slice(0, 4).map(([bType, count]) => (
                                                <div key={bType} className="flex justify-between text-slate-300">
                                                    <span className="text-[10px]">{t.common.resources[bType] || bType.replace(/_/g, ' ').toLowerCase()}</span>
                                                    <span className="font-mono text-white">{formatNumber(count || 0)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <GlassButton 
                            onClick={onAttack} 
                            disabled={!inRange || isNewbie} 
                            variant={isWarTarget ? "danger" : "primary"} 
                            className="w-full py-3 text-sm font-bold tracking-widest uppercase"
                        >
                            {isWarTarget ? t.reports.hostile : t.common.actions.attack}
                        </GlassButton>
                        
                        {!isWarTarget && (
                            <GlassButton 
                                onClick={onDeclareWar} 
                                disabled={hasActiveWar || !inRange || isNewbie} 
                                variant="neutral" 
                                className="w-full py-2.5 text-xs font-bold tracking-widest uppercase border-red-900/50 text-red-400 hover:bg-red-900/20"
                            >
                                {t.common.war.declare_title}
                            </GlassButton>
                        )}

                        <div className="flex flex-col items-center gap-1">
                            {isNewbie && (
                                <p className="text-[9px] text-cyan-400 uppercase font-bold tracking-widest flex items-center gap-1">
                                    <Icons.Shield className="w-3 h-3" /> {t.errors.protection_active}
                                </p>
                            )}
                            {!inRange && (
                                <p className="text-[9px] text-orange-400 uppercase font-bold tracking-widest">
                                    {t.common.ui.target_outside_range}
                                </p>
                            )}
                            {hasActiveWar && !isWarTarget && (
                                <p className="text-[9px] text-red-400 uppercase font-bold tracking-widest">
                                    {t.common.war.already_war}
                                </p>
                            )}
                            {isWarTarget && (
                                <p className="text-[9px] text-red-500 uppercase font-bold tracking-widest animate-pulse flex items-center gap-1">
                                    <Icons.Crosshair className="w-3 h-3" /> {t.common.ui.status_busy}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
