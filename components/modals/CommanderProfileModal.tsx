
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
    const inRange = ratio >= 0.5 && ratio <= 1.5;
    const percentage = Math.round(ratio * 100);
    
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
        statusText = "OUT OF RANGE";
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
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={onClose}></div>
            <div className={`fixed z-[101] bg-slate-900 border border-white/10 shadow-2xl md:inset-y-0 md:right-0 md:w-full md:max-w-sm md:border-l inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl md:rounded-none animate-in slide-in-from-bottom md:slide-in-from-right overflow-y-auto custom-scrollbar flex flex-col`}>
                
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20 sticky top-0 z-20 backdrop-blur">
                    <h3 className="font-tech text-sm text-slate-400 tracking-widest uppercase">Commander Intel</h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors"><Icons.Close /></button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-6">
                        <div className="text-6xl drop-shadow-xl">{getFlagEmoji(entry.country)}</div>
                        <div className="flex-1 min-w-0">
                            <h2 className="font-tech text-xl text-white uppercase tracking-wider truncate">{entry.name}</h2>
                            <div className={`text-[10px] font-bold tracking-[0.2em] mt-1 ${statusColor}`}>{statusText}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.features.rankings.score}</div>
                            <div className="font-mono font-bold text-lg text-white">{formatNumber(entry.score)}</div>
                        </div>
                        <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.features.rankings.rank}</div>
                            <div className="font-mono font-bold text-lg text-cyan-400">#{entry.rank}</div>
                        </div>
                    </div>

                    {pInfo && !isMe && (
                        <div className={`p-4 rounded-xl border ${pInfo.bg} space-y-2`}>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">Strategic Profile</span>
                                <span className="text-xl">{pInfo.icon}</span>
                            </div>
                            <div className={`font-tech text-base font-bold uppercase tracking-wide ${pInfo.color}`}>{pInfo.title}</div>
                            <div className="text-xs leading-relaxed opacity-70">{pInfo.desc}</div>
                        </div>
                    )}

                    <div className="bg-black/20 rounded-xl p-4 space-y-3">
                        <h4 className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Technical Specs</h4>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-400">{t.common.ui.tier_class}</span>
                            <span className="text-white font-tech font-bold">{entry.tier}{t.features.rankings.class_suffix}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Power Ratio</span>
                            <span className={`font-mono font-bold ${inRange ? 'text-emerald-400' : 'text-red-400'}`}>{percentage}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full ${inRange ? 'bg-emerald-500' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} style={{ width: `${Math.min(100, percentage/1.5)}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="mt-auto p-6 bg-black/40 border-t border-white/10 space-y-3 sticky bottom-0 backdrop-blur">
                    {!isMe && (
                        <>
                            <GlassButton onClick={onAttack} disabled={!inRange || isNewbie} variant={isWarTarget ? "danger" : "primary"} className="w-full py-4 font-bold tracking-widest uppercase">
                                {t.common.actions.attack}
                            </GlassButton>
                            {!isWarTarget && (
                                <GlassButton onClick={onDeclareWar} disabled={hasActiveWar || !inRange || isNewbie} variant="neutral" className="w-full py-3 border-red-900/50 text-red-400 hover:bg-red-900/20 font-bold tracking-widest uppercase">
                                    {t.common.war.declare_title}
                                </GlassButton>
                            )}
                            <div className="text-center">
                                {isNewbie && <p className="text-[10px] text-cyan-500 uppercase font-bold tracking-tighter">{t.errors.protection_active}</p>}
                                {!inRange && <p className="text-[10px] text-orange-400 uppercase font-bold tracking-tighter">Target outside combat range (50% - 150%)</p>}
                                {hasActiveWar && !isWarTarget && <p className="text-[10px] text-red-400 uppercase font-bold tracking-tighter">{t.common.war.already_war}</p>}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};
