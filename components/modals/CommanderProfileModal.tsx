
import React from 'react';
import { GameState, TranslationDictionary } from '../../types';
import { RankingEntry, getFlagEmoji } from '../../utils/engine/rankings';
import { Icons, GlassButton } from '../UIComponents';
import { formatNumber } from '../../utils';
import { PVP_RANGE_MAX, PVP_RANGE_MIN, NEWBIE_PROTECTION_THRESHOLD } from '../../constants';
import { BotPersonality } from '../../types/enums';

interface ProfileModalProps {
    entry: RankingEntry;
    gameState: GameState;
    t: TranslationDictionary;
    onClose: () => void;
    onDeclareWar: () => void;
    onAttack: () => void;
}

export const CommanderProfileModal: React.FC<ProfileModalProps> = ({ entry, gameState, t, onClose, onDeclareWar, onAttack }) => {
    const ratio = entry.score / Math.max(1, gameState.empirePoints);
    const inRange = ratio >= PVP_RANGE_MIN && ratio <= PVP_RANGE_MAX;
    const percentage = Math.round(ratio * 100);
    
    // Logic States
    const isMe = entry.isPlayer;
    const hasActiveWar = !!gameState.activeWar;
    const isWarTarget = gameState.activeWar?.enemyId === entry.id;
    const isNewbie = gameState.empirePoints < NEWBIE_PROTECTION_THRESHOLD;

    let statusText = t.common.ui.status_unlocked;
    let statusColor = "text-emerald-400";
    
    if (isMe) {
        statusText = t.features.rankings.commander.toUpperCase();
        statusColor = "text-cyan-400";
    } else if (hasActiveWar && !isWarTarget) {
        statusText = "BUSY (WAR)";
        statusColor = "text-slate-500";
    } else if (isWarTarget) {
        statusText = t.reports.hostile.toUpperCase();
        statusColor = "text-red-500 animate-pulse";
    } else if (!inRange) {
        statusText = t.features.rankings.range_error.split('.')[0].toUpperCase();
        statusColor = "text-orange-500";
    }

    const getPersonalityInfo = (type: BotPersonality) => {
        switch(type) {
            case BotPersonality.WARLORD: return { color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30', icon: '⚔️', title: t.features.rankings.types.WARLORD, desc: t.features.rankings.types.WARLORD_DESC };
            case BotPersonality.TURTLE: return { color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/30', icon: '🛡️', title: t.features.rankings.types.TURTLE, desc: t.features.rankings.types.TURTLE_DESC };
            case BotPersonality.TYCOON: return { color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: '💰', title: t.features.rankings.types.TYCOON, desc: t.features.rankings.types.TYCOON_DESC };
            case BotPersonality.ROGUE: return { color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/30', icon: '🕵️', title: t.features.rankings.types.ROGUE, desc: t.features.rankings.types.ROGUE_DESC };
            default: return { color: 'text-slate-500', bg: 'bg-slate-500/10', icon: '?', title: 'Unknown', desc: '' };
        }
    };

    const pInfo = entry.personality ? getPersonalityInfo(entry.personality) : null;

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
                onClick={onClose}
            ></div>

            {/* Slide-over Panel (Desktop) / Bottom Sheet (Mobile) */}
            <div className={`
                fixed z-[101] bg-slate-900 border border-white/10 shadow-2xl
                
                md:inset-y-0 md:right-0 md:w-full md:max-w-sm md:border-l md:border-t-0 md:animate-in md:slide-in-from-right
                
                inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl animate-in slide-in-from-bottom border-t overflow-y-auto custom-scrollbar
            `}>
                
                {/* Close Button - Sticky */}
                <button onClick={onClose} className="sticky top-4 left-4 p-2 bg-black/40 rounded-full text-slate-400 hover:text-white z-20 border border-white/5 active:scale-95 transition-transform float-left">
                    <Icons.Close />
                </button>

                {/* Profile Content - All scrollable together */}
                <div className="pt-20 md:pt-0">
                    {/* Cover Image Area */}
                    <div className="relative h-40 md:h-48 bg-gradient-to-br from-slate-800 to-black p-6 flex items-center justify-center shrink-0 overflow-hidden">
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                        <div className="text-8xl drop-shadow-2xl transform scale-125 filter grayscale-[30%]">{getFlagEmoji(entry.country)}</div>
                        <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-slate-900 to-transparent"></div>
                    </div>

                    {/* Content Body */}
                    <div className="p-6 -mt-8 relative z-10">
                        <div className="bg-slate-900/90 backdrop-blur border border-white/10 rounded-xl p-6 shadow-xl space-y-6">
                        
                        <div className="text-center">
                            <h2 className="font-tech text-2xl text-white uppercase tracking-widest truncate shadow-glow">{entry.name}</h2>
                            <div className={`text-xs font-bold uppercase tracking-[0.3em] mt-1 ${statusColor}`}>{statusText}</div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="bg-black/30 p-3 rounded-lg border border-white/5 flex flex-col items-center">
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.features.rankings.score}</div>
                                <div className="font-mono font-bold text-lg text-white">{formatNumber(entry.score)}</div>
                            </div>
                            <div className="bg-black/30 p-3 rounded-lg border border-white/5 flex flex-col items-center">
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.features.rankings.rank}</div>
                                <div className="font-mono font-bold text-lg text-cyan-400">#{entry.rank}</div>
                            </div>
                        </div>

                        {/* Personality Matrix */}
                        {pInfo && !isMe && (
                            <div className={`p-3 rounded-lg border ${pInfo.bg}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] uppercase tracking-widest font-bold opacity-70">{t.features.rankings.personality}</span>
                                    <span className="text-lg">{pInfo.icon}</span>
                                </div>
                                <div className={`font-tech text-lg font-bold uppercase tracking-wide ${pInfo.color}`}>{pInfo.title}</div>
                                <div className="text-[10px] leading-tight mt-1 opacity-80">{pInfo.desc}</div>
                            </div>
                        )}

                        {/* Stats Breakdown */}
                        <div className="space-y-3 pt-2">
                            <h3 className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-white/10 pb-1">{t.common.ui.performance}</h3>
                            
                            <div className="flex justify-between text-xs p-2 bg-white/5 rounded">
                                <span className="text-slate-400">{t.common.ui.trend}</span>
                                <span className={`font-bold ${entry.trend > 0 ? "text-emerald-400" : entry.trend < 0 ? "text-red-400" : "text-slate-500"}`}>
                                    {entry.trend > 0 ? '▲' : entry.trend < 0 ? '▼' : '-'} {Math.abs(entry.trend)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs p-2 bg-white/5 rounded">
                                <span className="text-slate-400">{t.common.ui.tier_class}</span>
                                <span className="text-white font-tech font-bold">{entry.tier}{t.features.rankings.class_suffix}</span>
                            </div>
                        </div>

                        {/* Range Indicator */}
                        {!isMe && (
                            <div className="mt-4 p-3 bg-black/40 rounded-lg border border-white/5">
                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>{t.common.ui.power_ratio}</span>
                                    <span>{percentage}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full ${inRange ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, percentage/2)}%` }}></div>
                                </div>
                                <p className="text-[9px] text-slate-500 mt-1 text-center uppercase tracking-wide">{t.common.ui.range_label}: 50% - 200%</p>
                            </div>
                        )}

                        {/* Footer Actions */}
                        {!isMe && (
                            <div className="p-6 bg-slate-950 border-t border-white/10 shrink-0 space-y-3 safe-area-bottom">
                                {isWarTarget ? (
                                    <GlassButton 
                                        onClick={onAttack} 
                                        variant="danger" 
                                        className="w-full py-4 shadow-[0_0_20px_rgba(220,38,38,0.4)] text-sm tracking-widest font-bold"
                                    >
                                        {t.common.actions.attack}
                                    </GlassButton>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <GlassButton 
                                            onClick={onAttack} 
                                            disabled={!inRange || isNewbie}
                                            variant="primary" 
                                            className="w-full py-3 text-sm tracking-widest font-bold"
                                        >
                                            {t.common.actions.attack}
                                        </GlassButton>

                                        <GlassButton 
                                            onClick={onDeclareWar} 
                                            disabled={hasActiveWar || !inRange || isNewbie}
                                            variant="neutral" 
                                            className={`w-full py-3 border-red-500/30 text-red-300 hover:bg-red-900/20 text-sm tracking-widest font-bold ${(hasActiveWar || !inRange || isNewbie) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                                        >
                                            {t.common.war.declare_title}
                                        </GlassButton>
                                    </div>
                                )}
                                
                                <div className="text-center h-4">
                                    {isNewbie && <p className="text-[10px] text-cyan-500">{t.errors.protection_active}</p>}
                                    {hasActiveWar && !isWarTarget && <p className="text-[10px] text-red-400">{t.common.war.already_war}</p>}
                                </div>
                            </div>
                        )}
                    </div>
                    </div>
                </div>
            </div>
        </>
    );
};