import React, { useState } from 'react';
import { BUILDING_DEFS } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
import { BattleResult, LogEntry, UnitType, TranslationDictionary, ResourceType, WarState, UnitCategory, BuildingType } from '../../types';
import { Icons } from '../UIComponents';
import { formatNumber } from '../../utils';
import { UNIT_PRIORITY } from '../../utils/engine/combat';

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

const sortUnitKeys = (keys: string[]): UnitType[] => {
    return (keys as UnitType[]).sort((a, b) => {
        const idxA = UNIT_PRIORITY.indexOf(a);
        const idxB = UNIT_PRIORITY.indexOf(b);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
};

export const CombatReportModal: React.FC<CombatReportProps> = (props) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/95 overflow-y-auto">
            <div className="w-full min-h-full relative flex flex-col">
                <div className="bg-slate-950 relative flex-1 flex flex-col">
                    {/* Close Button - Sticky to top */}
                    <div className="sticky top-0 right-0 z-50 flex justify-end p-4 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
                        <button 
                            onClick={props.onClose} 
                            className="p-2 bg-black/40 rounded-full text-slate-400 hover:text-white border border-white/5 transition-transform active:scale-95 flex items-center gap-2 px-4"
                        >
                            <span className="text-[10px] font-bold uppercase tracking-widest">{props.t.common.actions.close}</span>
                            <Icons.Close />
                        </button>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1">
                        <CombatReportContent {...props} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export const CombatReportContent: React.FC<CombatReportProps> = ({ log, t, onClose, embedded = false }) => {
    const [activeTab, setActiveTab] = useState<TabType>('summary');

    if (log.type === 'war') {
        const warSummary = log.params?.warSummary as (WarState & { convertedAmount?: number; bankedAmount?: number }) | undefined;
        let resultText = log.params?.result || "";
        
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
    
    // Translation fallback for missing keys to avoid LSP errors
    const t_ui = t.common.ui as any;
    
    return (
        <div className={`flex flex-col flex-1 w-full bg-slate-950 ${embedded ? '' : 'md:rounded-2xl overflow-hidden relative'} ${!embedded && (isWin ? 'md:border-2 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.1)]' : 'md:border-2 border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.1)]')}`}>
                <div className={`p-6 md:p-8 text-center border-b border-white/10 ${isWin ? 'bg-gradient-to-b from-emerald-900/40 to-transparent' : 'bg-gradient-to-b from-red-900/40 to-transparent'}`}>
                    <h2 className={`font-tech text-3xl uppercase tracking-widest font-bold mb-2 ${isWin ? 'text-emerald-400 drop-shadow-md' : 'text-red-500 drop-shadow-md'}`}>
                        {isWin ? t.common.ui.war_won : t.common.ui.war_lost}
                    </h2>
                    <p className="text-xs font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</p>
                </div>

                <div className="p-4 md:p-8 space-y-6 w-full flex flex-col">
                    <div className="text-center text-sm md:text-base font-bold text-white bg-black/40 p-6 rounded-xl border border-white/5 whitespace-pre-wrap leading-relaxed shadow-inner">
                        {resultText}
                    </div>

                    {isWin && log.params?.loot && (
                        <div className="bg-emerald-950/20 p-6 rounded-xl border border-emerald-500/30 shadow-lg">
                            <h3 className="text-xs md:text-sm text-emerald-400 uppercase tracking-widest font-bold mb-4 flex items-center gap-2 border-b border-emerald-500/20 pb-2">
                                <Icons.Crown className="w-5 h-5" /> {t.features.war.current_pool}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {Object.entries(log.params.loot).map(([k, v]) => (
                                    <div key={k} className="flex flex-col items-center bg-black/50 p-3 rounded-lg border border-emerald-500/10">
                                        <div className="mb-2 scale-125">{getResourceIcon(k)}</div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{t.common.resources[k]}</span>
                                        <span className="text-emerald-300 font-mono font-bold text-base">+{formatNumber(v as number)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {warSummary && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-red-950/20 p-6 rounded-xl border border-red-500/20 text-center flex flex-col shadow-lg">
                                <div className="text-[10px] md:text-xs text-red-400 uppercase tracking-widest font-bold mb-2">{t.common.ui.your_losses}</div>
                                <div className="text-2xl md:text-3xl font-mono text-white font-bold mb-1">
                                    ${formatNumber(Object.values(warSummary.playerResourceLosses || {}).reduce((a: number, b: number | undefined) => a + (b || 0), 0))}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">{warSummary.playerUnitLosses} Units</div>
                            </div>
                            <div className="bg-emerald-950/20 p-6 rounded-xl border border-emerald-500/20 text-center flex flex-col shadow-lg">
                                <div className="text-[10px] md:text-xs text-emerald-400 uppercase tracking-widest font-bold mb-2">{t.common.ui.enemies_killed}</div>
                                <div className="text-2xl md:text-3xl font-mono text-white font-bold mb-1">
                                    {formatNumber(warSummary.enemyUnitLosses)}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">Units</div>
                            </div>
                        </div>
                    )}
                </div>

                {!embedded && onClose && (
                    <div className="p-4 md:p-6 bg-slate-950/95 backdrop-blur-md border-t border-white/10 mt-auto sticky bottom-0 z-30 safe-area-bottom">
                        <button onClick={onClose} className="w-full py-4 bg-white/5 hover:bg-white/10 active:scale-[0.98] rounded-xl text-white text-xs font-bold uppercase tracking-widest transition-all border border-white/10 shadow-lg hover:shadow-white/5">
                            {t.common.actions.acknowledge}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (!log.params?.combatResult) {
        const msg = t.missions.patrol[log.messageKey as keyof typeof t.missions.patrol] || log.messageKey;
        const isGoodNews = log.messageKey.includes('win') || log.messageKey.includes('contraband') || log.messageKey.includes('success');
        
        return (
            <div className={`flex flex-col flex-1 w-full bg-slate-950 ${embedded ? '' : 'md:rounded-2xl overflow-hidden relative'} border-x-0 border-b-0 md:border-2 ${isGoodNews ? 'border-emerald-500/50' : 'border-slate-500/50'}`}>
                <div className={`p-6 md:p-8 text-center border-b border-white/10 ${isGoodNews ? 'bg-gradient-to-b from-emerald-900/30 to-transparent' : 'bg-gradient-to-b from-slate-900/50 to-transparent'}`}>
                    <h2 className={`font-tech text-2xl md:text-3xl uppercase tracking-widest font-bold mb-2 ${isGoodNews ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {isGoodNews ? t.campaign.victory_title : t.reports.view_report}
                    </h2>
                    <p className="text-xs font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</p>
                </div>

                <div className="p-4 md:p-8 space-y-6 w-full flex flex-col items-center">
                    <div className="w-full text-center text-sm md:text-base font-bold text-white bg-black/40 p-6 rounded-xl border border-white/5 shadow-inner">
                        {msg}
                    </div>

                    {log.params?.loot && Object.keys(log.params.loot).length > 0 && (
                        <div className="w-full bg-emerald-950/20 p-6 rounded-xl border border-emerald-500/20 shadow-lg">
                            <h3 className="text-xs md:text-sm text-emerald-400 uppercase tracking-widest font-bold mb-6 flex items-center justify-center gap-2">
                                <Icons.Crown className="w-5 h-5" /> {t.reports.details_loot}
                            </h3>
                            <div className="flex flex-wrap justify-center gap-4">
                                {Object.entries(log.params.loot).map(([k, v]) => (
                                    <div key={k} className="flex flex-col items-center bg-black/50 px-6 py-4 rounded-lg min-w-[100px] border border-emerald-500/10">
                                        <div className="mb-3 scale-150">{getResourceIcon(k)}</div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">{t.common.resources[k]}</span>
                                        <span className="text-emerald-300 font-mono font-bold text-xl">+{formatNumber(v as number)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {!embedded && onClose && (
                    <div className="p-4 md:p-6 bg-slate-950/95 backdrop-blur-md border-t border-white/10 mt-auto sticky bottom-0 z-30 safe-area-bottom">
                        <button onClick={onClose} className="w-full py-4 bg-white/5 hover:bg-white/10 active:scale-[0.98] rounded-xl text-white text-xs font-bold uppercase tracking-widest transition-all border border-white/10 shadow-lg hover:shadow-white/5">
                            {t.common.actions.acknowledge}
                        </button>
                    </div>
                )}
                
                {!embedded && onClose && (
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/20 rounded-full text-slate-400 hover:text-white transition-colors">
                        <Icons.Close className="w-5 h-5" />
                    </button>
                )}
            </div>
        );
    }

    const result = log.params.combatResult as BattleResult;
    
    const isCampaign = log.type === 'combat' && log.params?.targetName?.startsWith('OP-');
    const isPatrol = log.messageKey.includes('patrol');

    const isDefenseLoss = log.messageKey === 'log_defense_loss';
    const isDefenseWin = log.messageKey === 'log_defense_win';
    const isAttackWin = log.messageKey === 'log_battle_win' || log.messageKey.includes('patrol_battle_win');
    
    const playerHpPercent = result.playerTotalHpStart > 0 ? ((result.playerTotalHpStart - result.playerTotalHpLost) / result.playerTotalHpStart) * 100 : 0;
    const enemyHpPercent = result.enemyTotalHpStart > 0 ? ((result.enemyTotalHpStart - result.enemyTotalHpLost) / result.enemyTotalHpStart) * 100 : 0;
    
    const safePlayerArmy = result.initialPlayerArmy || {};
    const safeEnemyArmy = result.initialEnemyArmy || {};

    const allUnitTypes = Array.from(new Set([
        ...Object.keys(safePlayerArmy),
        ...Object.keys(safeEnemyArmy)
    ])) as UnitType[];

    const sortedUnitTypes = sortUnitKeys(allUnitTypes);

    let headerBg = 'bg-slate-900';
    let headerText = 'text-slate-200';
    let title = t.campaign.victory_title;
    let iconHeader = <Icons.Army />;

    if (isPatrol) {
        headerBg = isAttackWin ? 'bg-gradient-to-b from-purple-900/40 to-transparent' : 'bg-gradient-to-b from-slate-900/80 to-transparent';
        headerText = isAttackWin ? 'text-purple-400' : 'text-slate-400';
        title = isAttackWin ? t.missions.patrol.complete : t.missions.patrol.in_progress;
        iconHeader = <Icons.Radar className="w-6 h-6" />;
    }
    else if (isCampaign) {
        headerBg = isAttackWin ? 'bg-gradient-to-b from-cyan-900/40 to-transparent' : 'bg-gradient-to-b from-slate-900/80 to-transparent';
        headerText = isAttackWin ? 'text-cyan-400' : 'text-slate-400';
        title = isAttackWin ? t.campaign.victory_title : t.campaign.defeat_title;
        iconHeader = <Icons.Radar className="w-6 h-6" />;
    }
    else {
        if (isDefenseLoss) {
            headerBg = 'bg-gradient-to-b from-red-900/40 to-transparent';
            headerText = 'text-red-500';
            title = t.common.ui.log_defense_loss;
            iconHeader = <Icons.Warning className="w-6 h-6" />;
        } else if (isDefenseWin) {
            headerBg = 'bg-gradient-to-b from-cyan-900/40 to-transparent';
            headerText = 'text-cyan-400';
            title = t.common.ui.log_defense_win;
            iconHeader = <Icons.Shield className="w-6 h-6" />;
        } else if (isAttackWin) {
            headerBg = 'bg-gradient-to-b from-emerald-900/40 to-transparent';
            headerText = 'text-emerald-400';
            title = t.campaign.victory_title;
            iconHeader = <Icons.Army className="w-6 h-6" />;
        } else {
            headerBg = 'bg-gradient-to-b from-orange-900/40 to-transparent';
            headerText = 'text-orange-400';
            title = t.campaign.defeat_title;
            iconHeader = <Icons.Skull className="w-6 h-6" />;
        }
    }

    const renderUnitList = (side: 'player' | 'enemy') => {
        const isPlayer = side === 'player';
        const initialArmy = isPlayer ? (result.initialPlayerArmy || {}) : (result.initialEnemyArmy || {});
        const casualties = isPlayer ? (result.totalPlayerCasualties || {}) : (result.totalEnemyCasualties || {});
        const finalArmy = isPlayer ? (result.finalPlayerArmy || {}) : (result.finalEnemyArmy || {});
        const colorClass = isPlayer ? 'text-cyan-400' : 'text-red-400';
        const bgClass = isPlayer ? 'bg-cyan-950/20 border-cyan-500/20' : 'bg-red-950/20 border-red-500/20';

        const activeUnits = sortedUnitTypes.filter(u => (initialArmy[u] || 0) > 0);

        if (activeUnits.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-16 opacity-50 bg-black/20 rounded-xl border border-white/5">
                    <div className="text-5xl mb-4 opacity-50">{isPlayer ? '🛡️' : '⚔️'}</div>
                    <span className="text-sm font-bold uppercase tracking-widest">{t.reports.deployed}: 0</span>
                </div>
            );
        }

        return (
            <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 text-[10px] md:text-xs uppercase tracking-widest text-slate-500 font-bold px-4 mb-2">
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
                    
                    const safeWidth = start > 0 ? (end/start)*100 : 0;
                    const lossWidth = start > 0 ? (lost/start)*100 : 0;

                    return (
                        <div key={uType} className={`p-4 rounded-xl border ${bgClass} flex flex-col gap-3 shadow-sm hover:bg-white/5 transition-colors`}>
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <span className={`font-bold text-sm ${colorClass}`}>{name}</span>
                                <span className="text-xs font-mono text-slate-400">
                                    {t.reports.deployed}: <span className="text-white font-bold">{formatNumber(start)}</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 h-3 bg-black/50 rounded-full overflow-hidden flex border border-white/5">
                                    <div className={`h-full ${isPlayer ? 'bg-cyan-500' : 'bg-orange-500'} transition-all`} style={{ width: `${safeWidth}%` }}></div>
                                    <div className="h-full bg-red-600 transition-all" style={{ width: `${lossWidth}%` }}></div>
                                </div>
                                <div className="flex gap-6 font-mono text-sm shrink-0 w-24 justify-end">
                                    <div className="text-red-400 font-bold w-8 text-right">-{lost}</div>
                                    <div className={`w-8 text-right ${end > 0 ? "text-white font-bold" : "text-slate-600"}`}>{end}</div>
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
                <div className="flex flex-col items-center justify-center py-16 opacity-50 bg-black/20 rounded-xl border border-white/5">
                    <Icons.Radar className="w-12 h-12 mb-4 opacity-50" />
                    <span className="text-sm font-bold uppercase tracking-widest">{t.reports.no_data || "No Detailed Data Available"}</span>
                </div>
            );
        }

        if (!result.initialPlayerArmy) return null;

        const sortedPerfKeys = sortUnitKeys(Object.keys(result.initialPlayerArmy));

        return (
            <div className="space-y-6">
                <div className="text-xs md:text-sm text-yellow-500 uppercase tracking-widest font-bold px-2 mb-2 flex items-center gap-3">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_10px_#eab308]"></span>
                    {t.reports.kill_analysis}
                </div>
                {sortedPerfKeys.map(key => {
                    const uType = key as UnitType;
                    const stats = perf[uType];
                    const unitDef = UNIT_DEFS[uType];
                    const unitName = t.units[unitDef.translationKey]?.name || uType;
                    
                    if (!stats) return null;

                    const kills = stats.kills || {};
                    const deathsBy = stats.deathsBy || {};
                    const criticalDeaths = stats.criticalDeaths || 0;
                    
                    const myLosses = Object.values(deathsBy).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
                    const myKills = Object.values(kills).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
                    const deployed = result.initialPlayerArmy[uType] || 0;

                    if (myKills === 0 && myLosses === 0 && criticalDeaths === 0) return null;

                    const kdRatio = myLosses > 0 ? (myKills / myLosses).toFixed(1) : myKills > 0 ? "∞" : "0.0";
                    const isEfficient = parseFloat(kdRatio) >= 1.0 || kdRatio === "∞";

                    const isHuman = unitDef.category === UnitCategory.GROUND && uType !== UnitType.LIGHT_TANK;
                    const criticalText = isHuman ? t.reports.critical_bio : t.reports.critical_mech;

                    return (
                        <div key={uType} className="bg-slate-900/80 border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-lg">
                            <div className="p-4 bg-white/5 flex justify-between items-center border-b border-white/5">
                                <div className="flex flex-col gap-1">
                                    <span className="text-cyan-400 font-bold text-base md:text-lg">{unitName}</span>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                                        {t.reports.deployed}: <span className="text-white">{deployed}</span> | {t.reports.lost}: <span className="text-white">{myLosses}</span>
                                    </span>
                                </div>
                                <div className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold ${isEfficient ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-red-950/40 border-red-500/50 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]'}`}>
                                    {t.reports.efficiency}: {kdRatio}
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row">
                                <div className="flex-1 p-4 md:p-5 border-b md:border-b-0 md:border-r border-white/5 bg-gradient-to-br from-emerald-950/20 to-transparent">
                                    <div className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        {t.reports.targets_neutralized}
                                    </div>
                                    {myKills > 0 ? (
                                        <ul className="space-y-2">
                                            {Object.entries(kills).map(([victim, count]) => {
                                                const vDef = UNIT_DEFS[victim as UnitType];
                                                const vName = t.units[vDef.translationKey]?.name || victim;
                                                const text = (t.reports as any).analysis_kill_text?.replace('{count}', count.toString()).replace('{unit}', vName) || `${count} ${vName} neutralized`;
                                                return (
                                                    <li key={victim} className="text-xs md:text-sm text-emerald-100 flex items-start gap-2 bg-emerald-950/20 p-2 rounded-md border border-emerald-500/10">
                                                        <span className="text-emerald-500 font-bold">•</span>
                                                        {text}
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    ) : (
                                        <div className="text-xs text-slate-500 italic bg-black/20 p-3 rounded-md border border-white/5 text-center">{t.reports.no_kills}</div>
                                    )}
                                </div>

                                <div className="flex-1 p-4 md:p-5 bg-gradient-to-br from-red-950/20 to-transparent">
                                    <div className="text-[10px] text-red-500 uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        {t.reports.fell_to}
                                    </div>
                                    {myLosses > 0 ? (
                                        <ul className="space-y-2">
                                            {Object.entries(deathsBy).map(([killer, count]) => {
                                                const kDef = UNIT_DEFS[killer as UnitType];
                                                const kName = t.units[kDef.translationKey]?.name || killer;
                                                const text = (t.reports as any).analysis_death_text?.replace('{count}', count.toString()).replace('{unit}', kName) || `Lost ${count} to ${kName}`;
                                                return (
                                                    <li key={killer} className="text-xs md:text-sm text-red-100 flex items-start gap-2 bg-red-950/20 p-2 rounded-md border border-red-500/10">
                                                        <span className="text-red-500 font-bold">•</span>
                                                        {text}
                                                    </li>
                                                )
                                            })}
                                            {criticalDeaths > 0 && (
                                                <li className="text-xs md:text-sm text-orange-200 flex items-start gap-2 p-2 mt-2 bg-orange-950/30 rounded-md border border-orange-500/30 shadow-inner">
                                                    <span className="text-orange-500 font-bold animate-pulse">⚠</span>
                                                    {criticalDeaths} {criticalText}
                                                </li>
                                            )}
                                        </ul>
                                    ) : (
                                        <div className="text-xs text-slate-500 italic bg-black/20 p-3 rounded-md border border-white/5 text-center">{t.reports.no_casualties}</div>
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
        <div className={`flex flex-col flex-1 w-full bg-slate-950 ${embedded ? '' : 'md:border border-white/10 md:rounded-2xl relative'}`}>
            {/* Header */}
            <div className={`p-4 md:p-6 shrink-0 flex justify-between items-start border-b border-white/10 ${headerBg}`}>
                <div className="flex gap-4 items-start">
                    <div className={`p-3 rounded-xl bg-black/40 border border-white/10 shadow-lg ${headerText}`}>
                        {iconHeader}
                    </div>
                    <div className="flex flex-col gap-1">
                        <h2 className={`text-base md:text-lg font-tech font-bold uppercase tracking-widest ${headerText} drop-shadow-sm`}>
                            {title}
                        </h2>
                        <div className="text-[10px] md:text-xs text-slate-400 font-mono uppercase tracking-wider opacity-80 bg-black/30 w-max px-2 py-0.5 rounded border border-white/5">
                            {isCampaign ? (t.common.ui as any).mission_type_campaign : isPatrol ? (t.common.ui as any).mission_type_patrol : (t.common.ui as any).mission_type_tactical} • #{log.id.slice(-4)}
                        </div>
                    </div>
                </div>
                {!embedded && onClose && (
                    <button onClick={onClose} className="p-2.5 bg-black/40 rounded-full text-slate-400 hover:text-white transition-colors active:scale-95 border border-white/10 hover:bg-white/10 shrink-0">
                        <Icons.Close className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Navigation Tabs - STICKY */}
            <div className="flex border-b border-white/10 bg-black/80 backdrop-blur-md shrink-0 overflow-x-auto no-scrollbar shadow-inner px-2 pt-2 gap-1 sticky top-0 z-30">
                <button onClick={() => setActiveTab('summary')} className={`px-4 md:px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all rounded-t-lg border-t border-x ${activeTab === 'summary' ? 'border-white/20 bg-slate-900 text-white shadow-[0_-5px_10px_rgba(0,0,0,0.3)]' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>{t.common.ui.summary}</button>
                <button onClick={() => setActiveTab('analysis')} className={`px-4 md:px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all rounded-t-lg border-t border-x ${activeTab === 'analysis' ? 'border-yellow-500/30 bg-slate-900 text-yellow-400 shadow-[0_-5px_10px_rgba(234,179,8,0.1)]' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>{t.reports.combat_analysis}</button>
                <button onClick={() => setActiveTab('player')} className={`px-4 md:px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all rounded-t-lg border-t border-x ${activeTab === 'player' ? 'border-cyan-500/30 bg-slate-900 text-cyan-400 shadow-[0_-5px_10px_rgba(6,182,212,0.1)]' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>{t.reports.friendly}</button>
                {!isPatrol && (
                    <button onClick={() => setActiveTab('enemy')} className={`px-4 md:px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all rounded-t-lg border-t border-x ${activeTab === 'enemy' ? 'border-red-500/30 bg-slate-900 text-red-400 shadow-[0_-5px_10px_rgba(239,68,68,0.1)]' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>{t.reports.hostile}</button>
                )}
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 p-4 md:p-6 bg-slate-900/50">
                {activeTab === 'summary' && (
                    <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                        
                        {log.params.buildingLoot && Object.keys(log.params.buildingLoot).length > 0 && (
                            <div className={`p-5 rounded-xl border ${isDefenseLoss ? 'bg-red-950/30 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-yellow-950/20 border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.1)]'}`}>
                                <div className={`text-[10px] md:text-xs uppercase tracking-widest mb-4 font-bold flex justify-center items-center gap-2 ${isDefenseLoss ? 'text-red-400' : 'text-yellow-400'}`}>
                                    <Icons.Base className="w-4 h-4" />
                                    {isDefenseLoss ? (t.common.ui as any).buildings_lost?.toUpperCase() || "BUILDINGS LOST" : (t.common.ui as any).buildings_seized?.toUpperCase() || "BUILDINGS SEIZED"}
                                </div>
                                <div className="flex flex-wrap justify-center gap-4">
                                    {Object.entries(log.params.buildingLoot).map(([k, v]) => {
                                        const val = v as number;
                                        if (val <= 0) return null;
                                        const bDef = BUILDING_DEFS[k as BuildingType];
                                        const name = t.buildings[bDef?.translationKey]?.name || k;
                                        
                                        if (k === BuildingType.DIAMOND_MINE) {
                                            return (
                                                <div key={k} className="flex flex-col items-center bg-black/60 px-5 py-3 rounded-lg min-w-[100px] border border-red-500/50 shadow-lg relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse"></div>
                                                    <div className="mb-2 text-red-500 animate-pulse scale-125"><Icons.Warning /></div>
                                                    <span className="text-[10px] text-red-300 uppercase max-w-[120px] text-center truncate mb-1">{t.reports.diamond_damaged}</span>
                                                    <span className="font-mono font-bold text-red-400 text-base">{t.common.ui.status_damaged}</span>
                                                </div>
                                            );
                                        }
                                        
                                        return (
                                            <div key={k} className="flex flex-col items-center bg-black/40 px-5 py-3 rounded-lg min-w-[100px] border border-white/5">
                                                <div className="mb-2 text-slate-400 scale-125"><Icons.Base /></div>
                                                <span className="text-[10px] text-slate-400 uppercase max-w-[100px] text-center truncate mb-1">{name}</span>
                                                <span className={`font-mono font-bold text-lg ${isDefenseLoss ? 'text-red-400' : 'text-yellow-300'}`}>{isDefenseLoss ? '-' : '+'}{formatNumber(val)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {log.params.loot && Object.keys(log.params.loot).length > 0 ? (
                            <div className={`p-5 rounded-xl border text-center shadow-lg ${isDefenseLoss ? 'bg-red-950/30 border-red-500/30' : isCampaign ? 'bg-cyan-950/20 border-cyan-500/30' : 'bg-emerald-950/20 border-emerald-500/30'}`}>
                                <div className={`text-[10px] md:text-xs uppercase tracking-widest mb-4 font-bold flex items-center justify-center gap-2 ${isDefenseLoss ? 'text-red-400' : isCampaign ? 'text-cyan-400' : 'text-emerald-400'}`}>
                                    <Icons.Crown className="w-4 h-4" />
                                    {isDefenseLoss ? t.reports.details_stolen : isCampaign ? t.campaign.rewards : t.reports.details_loot}
                                </div>
                                <div className="flex gap-3 flex-wrap justify-center">
                                    {Object.entries(log.params.loot).map(([k,v]) => (
                                        <span key={k} className={`px-4 py-2 rounded-lg border text-[10px] md:text-xs font-mono font-bold flex items-center gap-2 shadow-inner ${isDefenseLoss ? 'text-red-300 border-red-500/30 bg-red-950/40' : 'text-emerald-300 border-emerald-500/20 bg-emerald-950/40'}`}>
                                            <div className="scale-125">{getResourceIcon(k)}</div>
                                            <span>{isDefenseLoss ? '-' : '+'}{formatNumber(v as number)}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            (!log.params.buildingLoot || Object.keys(log.params.buildingLoot).length === 0) && (
                                <div className="text-center py-6 border-y border-white/5 bg-black/20 rounded-xl">
                                    <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                                        {isAttackWin || isDefenseWin ? t.reports.no_loot : t.reports.no_losses}
                                    </span>
                                </div>
                            )
                        )}

                        <div className="space-y-4">
                            <div className="bg-black/30 p-4 rounded-xl border border-white/5 shadow-inner">
                                <div className="flex justify-between text-[10px] md:text-xs uppercase tracking-widest mb-2 font-bold">
                                    <span className="text-cyan-400 flex items-center gap-2"><Icons.Shield className="w-3 h-3" /> {t.reports.integrity} ({t.reports.friendly})</span>
                                    <span className="text-white bg-black/50 px-2 py-0.5 rounded">{playerHpPercent.toFixed(0)}%</span>
                                </div>
                                <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                                    <div className={`h-full transition-all duration-1000 ${playerHpPercent < 30 ? 'bg-red-500' : 'bg-cyan-500'}`} style={{ width: `${playerHpPercent}%` }}></div>
                                </div>
                            </div>
                            {!isPatrol && (
                                <div className="bg-black/30 p-4 rounded-xl border border-white/5 shadow-inner">
                                    <div className="flex justify-between text-[10px] md:text-xs uppercase tracking-widest mb-2 font-bold">
                                        <span className="text-red-400 flex items-center gap-2"><Icons.Skull className="w-3 h-3" /> {t.reports.integrity} ({t.reports.hostile})</span>
                                        <span className="text-white bg-black/50 px-2 py-0.5 rounded">{enemyHpPercent.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                                        <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${enemyHpPercent}%` }}></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-800/30 p-5 rounded-xl text-center border border-white/5 shadow-sm">
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold"><Icons.Clock className="inline w-3 h-3 mr-1"/>{t.reports.rounds}</div>
                                <div className="text-2xl md:text-3xl font-mono text-white font-bold">{result.rounds?.length || 0}</div>
                            </div>
                            <div className="bg-slate-800/30 p-5 rounded-xl text-center border border-white/5 shadow-sm">
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold"><Icons.Crosshair className="inline w-3 h-3 mr-1"/>{t.reports.damage_dealt}</div>
                                <div className="text-2xl md:text-3xl font-mono text-cyan-400 font-bold">{formatNumber(result.playerDamageDealt)}</div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'analysis' && <div className="animate-[fadeIn_0.2s_ease-out]">{renderAnalysis()}</div>}
                {activeTab === 'player' && <div className="animate-[fadeIn_0.2s_ease-out]">{renderUnitList('player')}</div>}
                {activeTab === 'enemy' && <div className="animate-[fadeIn_0.2s_ease-out]">{renderUnitList('enemy')}</div>}
            </div>

            {/* Footer Buttons for Modals - STICKY */}
            {!embedded && onClose && (
                <div className="p-4 md:p-6 bg-slate-950/95 backdrop-blur-md border-t border-white/10 shrink-0 mt-auto sticky bottom-0 z-30 safe-area-bottom">
                    <button onClick={onClose} className="w-full py-4 bg-white/5 hover:bg-white/10 active:scale-[0.98] rounded-xl border border-white/10 text-white text-xs md:text-sm font-bold uppercase tracking-widest transition-all shadow-lg hover:shadow-white/5">
                        {t.common.actions.close}
                    </button>
                </div>
            )}
        </div>
    );
};