
import React, { useState } from 'react';
import { UNIT_DEFS } from '../../data/units';
import { BattleResult, LogEntry, UnitType, TranslationDictionary, ResourceType, WarState } from '../../types';
import { Icons } from '../UIComponents';
import { formatNumber } from '../../utils';

interface CombatReportProps {
    log: LogEntry;
    t: TranslationDictionary;
    onClose?: () => void;
    embedded?: boolean;
}

type TabType = 'summary' | 'player' | 'enemy' | 'analysis';

const getResourceIcon = (res: string) => {
    switch(res) {
        case ResourceType.MONEY: return <Icons.Resources.Money className="w-3 h-3" />;
        case ResourceType.OIL: return <Icons.Resources.Oil className="w-3 h-3" />;
        case ResourceType.AMMO: return <Icons.Resources.Ammo className="w-3 h-3" />;
        case ResourceType.GOLD: return <Icons.Resources.Gold className="w-3 h-3" />;
        case ResourceType.DIAMOND: return <Icons.Resources.Diamond className="w-3 h-3" />;
        default: return null;
    }
};

export const CombatReportModal: React.FC<CombatReportProps> = (props) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/90 backdrop-blur-xl animate-[fadeIn_0.2s_ease-out] md:p-4">
            <div className="w-full h-[90vh] md:h-auto md:max-h-[85vh] md:max-w-2xl relative">
                <CombatReportContent {...props} />
            </div>
        </div>
    );
};

// --- INNER COMPONENT (REUSABLE) ---
export const CombatReportContent: React.FC<CombatReportProps> = ({ log, t, onClose, embedded = false }) => {
    const [activeTab, setActiveTab] = useState<TabType>('summary');

    // WAR REPORT HANDLING
    if (log.type === 'war') {
        const warSummary = log.params?.warSummary as (WarState & { convertedAmount?: number; bankedAmount?: number }) | undefined;
        let resultText = log.params?.result || "";
        
        // Translate dynamic result text if resultKey exists
        if (log.params?.resultKey && t.common.ui[log.params.resultKey as keyof typeof t.common.ui]) {
            resultText = t.common.ui[log.params.resultKey as keyof typeof t.common.ui];
            if (log.params.resultKey === 'war_victory_secured' && warSummary) {
                const converted = warSummary.convertedAmount || 0;
                const banked = warSummary.bankedAmount || 0;
                
                if (converted > 0) {
                    const extra = t.common.ui.war_overflow.replace('${amount}', `$${formatNumber(converted)}`);
                    resultText += ` ${extra}`;
                }
                if (banked > 0) {
                    const extra = t.common.ui.war_banked.replace('${amount}', `$${formatNumber(banked)}`);
                    resultText += ` ${extra}`;
                }
            }
        }

        const isWin = log.messageKey.includes('PLAYER') || (log.params?.winner === 'PLAYER');
        
        return (
            <div className={`flex flex-col h-full bg-slate-950 ${embedded ? '' : 'rounded-t-2xl md:rounded-xl shadow-2xl overflow-hidden relative'} ${!embedded && (isWin ? 'md:border-2 border-emerald-500/50 shadow-emerald-900/20' : 'md:border-2 border-red-500/50 shadow-red-900/20')}`}>
                <div className={`p-6 text-center shrink-0 ${isWin ? 'bg-emerald-900/30' : 'bg-red-900/30'}`}>
                    <h2 className={`font-tech text-2xl uppercase tracking-widest font-bold mb-1 ${isWin ? 'text-emerald-400' : 'text-red-500'}`}>
                        {isWin ? t.common.ui.war_won : t.common.ui.war_lost}
                    </h2>
                    <p className="text-xs font-mono text-slate-300">{new Date(log.timestamp).toLocaleString()}</p>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="text-center text-sm font-bold text-white bg-white/5 p-3 rounded border border-white/10 whitespace-pre-wrap">
                        {resultText}
                    </div>

                    {isWin && log.params?.loot && (
                        <div className="bg-emerald-950/20 p-4 rounded border border-emerald-500/20">
                            <h3 className="text-xs text-emerald-400 uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                                <Icons.Crown /> {t.features.war.current_pool}
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(log.params.loot).map(([k, v]) => (
                                    <div key={k} className="flex justify-between text-xs bg-black/30 p-2 rounded items-center">
                                        <div className="flex items-center gap-2">
                                            {getResourceIcon(k)}
                                            <span className="text-slate-400 uppercase">{t.common.resources[k]}</span>
                                        </div>
                                        <span className="text-emerald-300 font-mono font-bold">+{formatNumber(v as number)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {warSummary && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-red-950/10 p-3 rounded border border-red-500/10">
                                <div className="text-[10px] text-red-400 uppercase mb-1">{t.common.ui.your_losses}</div>
                                <div className="text-lg font-mono text-red-300 font-bold">
                                    {formatNumber(Object.values(warSummary.playerResourceLosses || {}).reduce((a,b)=>a+b,0))}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1">{warSummary.playerUnitLosses} Units</div>
                            </div>
                            <div className="bg-emerald-950/10 p-3 rounded border border-emerald-500/10">
                                <div className="text-[10px] text-emerald-400 uppercase mb-1">{t.common.ui.enemies_killed}</div>
                                <div className="text-lg font-mono text-emerald-300 font-bold">
                                    {formatNumber(warSummary.enemyUnitLosses)}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1">Units</div>
                            </div>
                        </div>
                    )}
                </div>

                {onClose && (
                    <button onClick={onClose} className="w-full py-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-white text-xs font-bold uppercase tracking-widest transition-colors border-t border-white/10 shrink-0 safe-area-bottom">
                        {t.common.actions.acknowledge}
                    </button>
                )}
            </div>
        );
    }

    // GENERIC NON-COMBAT REPORT HANDLING (e.g. Patrol Contraband)
    // Prevents soft-lock/blank screen when log lacks combatResult but has other data (like loot)
    if (!log.params?.combatResult) {
        const msg = t.missions.patrol[log.messageKey as keyof typeof t.missions.patrol] || log.messageKey;
        const isGoodNews = log.messageKey.includes('win') || log.messageKey.includes('contraband') || log.messageKey.includes('success');
        
        return (
            <div className={`flex flex-col h-full bg-slate-950 ${embedded ? '' : 'rounded-t-2xl md:rounded-xl shadow-2xl overflow-hidden relative'} border-2 ${isGoodNews ? 'border-emerald-500/50' : 'border-slate-500/50'}`}>
                {/* Header */}
                <div className={`p-6 text-center shrink-0 border-b border-white/10 ${isGoodNews ? 'bg-emerald-900/30' : 'bg-slate-900/50'}`}>
                    <h2 className={`font-tech text-xl md:text-2xl uppercase tracking-widest font-bold mb-1 ${isGoodNews ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {isGoodNews ? t.campaign.victory_title : t.reports.view_report}
                    </h2>
                    <p className="text-xs font-mono text-slate-300">{new Date(log.timestamp).toLocaleString()}</p>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col items-center">
                    <div className="w-full text-center text-sm font-bold text-white bg-white/5 p-4 rounded border border-white/10">
                        {msg}
                    </div>

                    {log.params?.loot && Object.keys(log.params.loot).length > 0 && (
                        <div className="w-full bg-emerald-950/20 p-4 rounded border border-emerald-500/20">
                            <h3 className="text-xs text-emerald-400 uppercase tracking-widest font-bold mb-4 flex items-center justify-center gap-2">
                                <Icons.Crown /> {t.reports.details_loot}
                            </h3>
                            <div className="flex flex-wrap justify-center gap-3">
                                {Object.entries(log.params.loot).map(([k, v]) => (
                                    <div key={k} className="flex flex-col items-center bg-black/30 px-4 py-3 rounded min-w-[80px] border border-white/5">
                                        <div className="mb-2 scale-125">{getResourceIcon(k)}</div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{t.common.resources[k]}</span>
                                        <span className="text-emerald-300 font-mono font-bold text-lg">+{formatNumber(v as number)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {onClose && (
                    <button onClick={onClose} className="w-full py-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-white text-xs font-bold uppercase tracking-widest transition-colors border-t border-white/10 shrink-0 safe-area-bottom">
                        {t.common.actions.acknowledge}
                    </button>
                )}
                
                {/* Mobile Close X (if embedded is false) */}
                {!embedded && onClose && (
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/20 rounded-full text-slate-400 hover:text-white">
                        <Icons.Close />
                    </button>
                )}
            </div>
        );
    }

    const result = log.params.combatResult as BattleResult;
    
    // TYPE DETECTION
    const isCampaign = log.type === 'combat' && log.params?.targetName?.startsWith('OP-');
    const isPatrol = log.messageKey.includes('patrol');
    const isPvP = !isCampaign && !isPatrol && log.type === 'combat';

    const isDefenseLoss = log.messageKey === 'log_defense_loss';
    const isDefenseWin = log.messageKey === 'log_defense_win';
    const isAttackWin = log.messageKey === 'log_battle_win' || log.messageKey.includes('patrol_battle_win');
    
    const playerHpPercent = result.playerTotalHpStart > 0 ? ((result.playerTotalHpStart - result.playerTotalHpLost) / result.playerTotalHpStart) * 100 : 0;
    const enemyHpPercent = result.enemyTotalHpStart > 0 ? ((result.enemyTotalHpStart - result.enemyTotalHpLost) / result.enemyTotalHpStart) * 100 : 0;
    
    // Safety check for armies
    const safePlayerArmy = result.initialPlayerArmy || {};
    const safeEnemyArmy = result.initialEnemyArmy || {};

    const allUnitTypes = Array.from(new Set([
        ...Object.keys(safePlayerArmy),
        ...Object.keys(safeEnemyArmy)
    ])) as UnitType[];

    let headerBg = 'bg-slate-900';
    let headerText = 'text-slate-200';
    let title = t.campaign.victory_title;
    let iconHeader = <Icons.Army />;

    if (isPatrol) {
        headerBg = isAttackWin ? 'bg-purple-950/80' : 'bg-slate-900/90';
        headerText = isAttackWin ? 'text-purple-400' : 'text-slate-400';
        title = isAttackWin ? t.missions.patrol.complete : t.missions.patrol.in_progress; // Ambush
        iconHeader = <Icons.Radar />;
    }
    else if (isCampaign) {
        headerBg = isAttackWin ? 'bg-cyan-950/80' : 'bg-slate-900/90';
        headerText = isAttackWin ? 'text-cyan-400' : 'text-slate-400';
        title = isAttackWin ? t.campaign.victory_title : t.campaign.defeat_title;
        iconHeader = <div className="text-cyan-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>;
    }
    else {
        // PvP & War
        if (isDefenseLoss) {
            headerBg = 'bg-red-950/80';
            headerText = 'text-red-500';
            title = t.common.ui.log_defense_loss;
        } else if (isDefenseWin) {
            headerBg = 'bg-cyan-950/80';
            headerText = 'text-cyan-400';
            title = t.common.ui.log_defense_win;
        } else if (isAttackWin) {
            headerBg = 'bg-emerald-950/80';
            headerText = 'text-emerald-400';
            title = t.campaign.victory_title;
        } else {
            headerBg = 'bg-orange-950/80';
            headerText = 'text-orange-400';
            title = t.campaign.defeat_title;
        }
    }

    const renderUnitList = (side: 'player' | 'enemy') => {
        const isPlayer = side === 'player';
        const initialArmy = isPlayer ? (result.initialPlayerArmy || {}) : (result.initialEnemyArmy || {});
        const casualties = isPlayer ? (result.totalPlayerCasualties || {}) : (result.totalEnemyCasualties || {});
        const finalArmy = isPlayer ? (result.finalPlayerArmy || {}) : (result.finalEnemyArmy || {});
        const colorClass = isPlayer ? 'text-cyan-400' : 'text-red-400';
        const bgClass = isPlayer ? 'bg-cyan-900/10 border-cyan-500/20' : 'bg-red-900/10 border-red-500/20';

        const activeUnits = allUnitTypes.filter(u => (initialArmy[u] || 0) > 0);

        if (activeUnits.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <div className="text-4xl mb-2">{isPlayer ? '🛡️' : '⚔️'}</div>
                    <span className="text-xs uppercase tracking-widest">{t.reports.deployed}: 0</span>
                </div>
            );
        }

        return (
            <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-widest text-slate-500 font-bold px-2 mb-1">
                    <div className="col-span-2">{t.reports.unit_type}</div>
                    <div className="text-center">{t.reports.lost}</div>
                    <div className="text-right">{t.reports.survived}</div>
                </div>

                {activeUnits.map(uType => {
                    const start = initialArmy[uType] || 0;
                    const lost = casualties[uType] || 0;
                    const end = finalArmy[uType] || 0;
                    const def = UNIT_DEFS[uType];
                    const name = t.units[def.translationKey]?.name || uType;
                    
                    // Safety for width calculation
                    const safeWidth = start > 0 ? (end/start)*100 : 0;
                    const lossWidth = start > 0 ? (lost/start)*100 : 0;

                    return (
                        <div key={uType} className={`p-3 rounded border ${bgClass} flex flex-col gap-2`}>
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <span className={`font-bold text-xs ${colorClass}`}>{name}</span>
                                <span className="text-[10px] font-mono text-slate-400">
                                    {t.reports.deployed}: <span className="text-white font-bold text-sm">{formatNumber(start)}</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden flex">
                                    <div className={`h-full ${isPlayer ? 'bg-cyan-500' : 'bg-orange-500'}`} style={{ width: `${safeWidth}%` }}></div>
                                    <div className="h-full bg-red-900/50" style={{ width: `${lossWidth}%` }}></div>
                                </div>
                                <div className="flex gap-4 font-mono text-xs shrink-0">
                                    <div className="text-red-400 font-bold">-{lost}</div>
                                    <div className={end > 0 ? "text-white font-bold" : "text-slate-600"}>{end}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderAnalysis = () => {
        const perf = result.playerPerformance;
        if (!perf || Object.keys(perf).length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <Icons.Radar />
                    <span className="text-xs uppercase tracking-widest mt-2">{t.reports.no_data || "No Detailed Data Available"}</span>
                </div>
            );
        }

        if (!result.initialPlayerArmy) return null;

        return (
            <div className="space-y-4">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold px-2 mb-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
                    {t.reports.kill_analysis}
                </div>
                {Object.keys(result.initialPlayerArmy).map(key => {
                    const uType = key as UnitType;
                    const stats = perf[uType];
                    const unitDef = UNIT_DEFS[uType];
                    const unitName = t.units[unitDef.translationKey]?.name || uType;
                    
                    // Safety checks
                    if (!stats) return null;

                    const kills = stats.kills || {};
                    const deathsBy = stats.deathsBy || {};
                    
                    const myLosses = Object.values(deathsBy).reduce((a, b) => a + b, 0);
                    const myKills = Object.values(kills).reduce((a, b) => a + b, 0);
                    
                    const deployed = result.initialPlayerArmy[uType] || 0;

                    if (myKills === 0 && myLosses === 0) return null;

                    const kdRatio = myLosses > 0 ? (myKills / myLosses).toFixed(1) : myKills > 0 ? "∞" : "0.0";
                    const isEfficient = parseFloat(kdRatio) >= 1.0 || kdRatio === "∞";

                    return (
                        <div key={uType} className="bg-slate-900/80 border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-lg">
                            <div className="p-3 bg-white/5 flex justify-between items-center border-b border-white/5">
                                <div className="flex flex-col">
                                    <span className="text-cyan-400 font-bold text-sm">{unitName}</span>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                                        {t.reports.deployed}: {deployed} | {t.reports.lost}: {myLosses}
                                    </span>
                                </div>
                                <div className={`px-2 py-1 rounded border text-[10px] font-mono font-bold ${isEfficient ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400' : 'bg-red-900/30 border-red-500/30 text-red-400'}`}>
                                    {t.reports.efficiency}: {kdRatio}
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row">
                                <div className="flex-1 p-3 border-b md:border-b-0 md:border-r border-white/5 bg-emerald-950/10">
                                    <div className="text-[9px] text-emerald-500 uppercase tracking-widest font-bold mb-2 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        {t.reports.targets_neutralized}
                                    </div>
                                    {myKills > 0 ? (
                                        <ul className="space-y-1.5">
                                            {Object.entries(kills).map(([victim, count]) => {
                                                const vDef = UNIT_DEFS[victim as UnitType];
                                                const vName = t.units[vDef.translationKey]?.name || victim;
                                                const text = t.reports.analysis_kill_text.replace('{count}', count.toString()).replace('{unit}', vName);
                                                return (
                                                    <li key={victim} className="text-xs text-emerald-100 flex items-start gap-2">
                                                        <span className="text-emerald-500 font-bold">•</span>
                                                        {text}
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    ) : (
                                        <span className="text-[10px] text-slate-600 italic">No confirmed kills.</span>
                                    )}
                                </div>

                                <div className="flex-1 p-3 bg-red-950/10">
                                    <div className="text-[9px] text-red-500 uppercase tracking-widest font-bold mb-2 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        {t.reports.fell_to}
                                    </div>
                                    {myLosses > 0 ? (
                                        <ul className="space-y-1.5">
                                            {Object.entries(deathsBy).map(([killer, count]) => {
                                                const kDef = UNIT_DEFS[killer as UnitType];
                                                const kName = t.units[kDef.translationKey]?.name || killer;
                                                const text = t.reports.analysis_death_text.replace('{count}', count.toString()).replace('{unit}', kName);
                                                return (
                                                    <li key={killer} className="text-xs text-red-100 flex items-start gap-2">
                                                        <span className="text-red-500 font-bold">•</span>
                                                        {text}
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    ) : (
                                        <span className="text-[10px] text-slate-600 italic">No casualties taken.</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full bg-slate-950 ${embedded ? '' : 'border-t md:border border-white/10 rounded-t-2xl md:rounded-xl shadow-2xl overflow-hidden relative'}`}>
            {/* Header */}
            <div className={`p-4 shrink-0 flex justify-between items-start border-b border-white/10 ${headerBg}`}>
                <div className="flex gap-3 items-start">
                    <div className={`p-2 rounded-full bg-black/20 ${headerText}`}>
                        {iconHeader}
                    </div>
                    <div>
                        <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${headerText}`}>
                            {title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono opacity-80">
                            {isCampaign ? 'CAMPAIGN MISSION' : isPatrol ? 'SECTOR PATROL' : 'TACTICAL ENGAGEMENT'} • #{log.id.slice(-4)}
                        </div>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-2 bg-black/20 rounded-full text-slate-400 hover:text-white transition-colors active:scale-95">
                        <Icons.Close />
                    </button>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/10 bg-black/20 shrink-0 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('summary')} className={`flex-1 min-w-[80px] py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 active:bg-white/10 ${activeTab === 'summary' ? 'border-white text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>{t.common.ui.summary}</button>
                <button onClick={() => setActiveTab('analysis')} className={`flex-1 min-w-[80px] py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 active:bg-white/10 ${activeTab === 'analysis' ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>{t.reports.combat_analysis}</button>
                <button onClick={() => setActiveTab('player')} className={`flex-1 min-w-[80px] py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 active:bg-white/10 ${activeTab === 'player' ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>{t.reports.friendly}</button>
                {!isPatrol && (
                    <button onClick={() => setActiveTab('enemy')} className={`flex-1 min-w-[80px] py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 active:bg-white/10 ${activeTab === 'enemy' ? 'border-red-500 text-red-400 bg-red-500/10' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>{t.reports.hostile}</button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {activeTab === 'summary' && (
                    <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                        
                        {/* Loot / Reward Section */}
                        {log.params.loot && Object.keys(log.params.loot).length > 0 ? (
                            <div className={`p-4 rounded-xl border text-center ${isDefenseLoss ? 'bg-red-950/30 border-red-500/30' : isCampaign ? 'bg-cyan-950/30 border-cyan-500/30' : 'bg-emerald-950/30 border-emerald-500/30'}`}>
                                <div className={`text-[10px] uppercase tracking-widest mb-3 font-bold ${isDefenseLoss ? 'text-red-400' : isCampaign ? 'text-cyan-400' : 'text-emerald-400'}`}>
                                    {isDefenseLoss ? t.reports.details_stolen : isCampaign ? t.campaign.rewards : t.reports.details_loot}
                                </div>
                                <div className="flex flex-wrap justify-center gap-3">
                                    {Object.entries(log.params.loot).map(([k,v]) => {
                                        const val = v as number;
                                        if (val <= 0) return null;
                                        return (
                                            <div key={k} className="flex flex-col items-center bg-black/40 px-3 py-2 rounded min-w-[60px]">
                                                <div className="mb-1">{getResourceIcon(k)}</div>
                                                <span className="text-[10px] text-slate-400 uppercase">{t.common.resources[k]?.substring(0,3)}</span>
                                                <span className={`font-mono font-bold ${isDefenseLoss ? 'text-red-400' : isCampaign ? 'text-cyan-300' : 'text-emerald-300'}`}>{isDefenseLoss ? '-' : '+'}{formatNumber(val)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 border-b border-white/5"><span className="text-xs text-slate-500 uppercase tracking-widest">{isAttackWin || isDefenseWin ? "No loot secured" : "No resources lost"}</span></div>
                        )}

                        <div className="space-y-4">
                            <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                                <div className="flex justify-between text-[10px] uppercase tracking-widest mb-1">
                                    <span className="text-cyan-400">{t.reports.integrity} ({t.reports.friendly})</span>
                                    <span className="text-white">{playerHpPercent.toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-black rounded-full overflow-hidden">
                                    <div className={`h-full ${playerHpPercent < 30 ? 'bg-red-500' : 'bg-cyan-500'}`} style={{ width: `${playerHpPercent}%` }}></div>
                                </div>
                            </div>
                            {!isPatrol && (
                                <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                                    <div className="flex justify-between text-[10px] uppercase tracking-widest mb-1">
                                        <span className="text-red-400">{t.reports.integrity} ({t.reports.hostile})</span>
                                        <span className="text-white">{enemyHpPercent.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-2 bg-black rounded-full overflow-hidden">
                                        <div className="h-full bg-red-500" style={{ width: `${enemyHpPercent}%` }}></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-black/30 p-3 rounded text-center border border-white/5">
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.reports.rounds}</div>
                                <div className="text-lg font-mono text-white">{result.rounds?.length || 0}</div>
                            </div>
                            <div className="bg-black/30 p-3 rounded text-center border border-white/5">
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.reports.damage_dealt}</div>
                                <div className="text-lg font-mono text-cyan-400">{formatNumber(result.playerDamageDealt)}</div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'analysis' && <div className="animate-[fadeIn_0.2s_ease-out]">{renderAnalysis()}</div>}
                {activeTab === 'player' && <div className="animate-[fadeIn_0.2s_ease-out]">{renderUnitList('player')}</div>}
                {activeTab === 'enemy' && <div className="animate-[fadeIn_0.2s_ease-out]">{renderUnitList('enemy')}</div>}
            </div>

            {onClose && (
                <div className="p-4 bg-slate-950 border-t border-white/10 shrink-0 safe-area-bottom">
                    <button onClick={onClose} className="w-full py-3 bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg border border-white/10 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-lg">{t.campaign.close}</button>
                </div>
            )}
        </div>
    );
};
