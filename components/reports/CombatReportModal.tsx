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

type TabType = 'summary' | 'player' | 'allies' | 'enemy' | 'analysis';

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
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/95 overflow-y-auto p-0 sm:p-4">
            <div className="w-full min-h-full relative flex flex-col">
                <div className="bg-slate-950 relative flex-1 flex flex-col sm:rounded-2xl overflow-hidden">
                    <div className="flex-1 overflow-y-auto">
                        <CombatReportContent {...props} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export const CombatReportContent: React.FC<CombatReportProps> = ({ log, t, onClose, embedded = false }) => {
    const [activeTab, setActiveTab] = useState<TabType>('summary');

    // Reporte de GUERRA
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

        return (
            <div className={`flex flex-col flex-1 w-full bg-slate-950 ${embedded ? '' : 'md:rounded-2xl overflow-hidden relative'} ${!embedded && (isWin ? 'md:border-2 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.1)]' : 'md:border-2 border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.1)]')}`}>
                <div className={`p-4 sm:p-6 md:p-8 text-center border-b border-white/10 ${isWin ? 'bg-gradient-to-b from-emerald-900/40 to-transparent' : 'bg-gradient-to-b from-red-900/40 to-transparent'}`}>
                    <h2 className={`font-tech text-2xl sm:text-3xl uppercase tracking-widest font-bold mb-2 ${isWin ? 'text-emerald-400 drop-shadow-md' : 'text-red-500 drop-shadow-md'}`}>
                        {isWin ? t.common.ui.war_won : t.common.ui.war_lost}
                    </h2>
                    <p className="text-[10px] sm:text-xs font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</p>
                </div>

                <div className="p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 w-full flex flex-col">
                    <div className="text-center text-xs sm:text-sm md:text-base font-bold text-white bg-black/40 p-4 sm:p-6 rounded-xl border border-white/5 whitespace-pre-wrap leading-relaxed shadow-inner">
                        {resultText}
                    </div>

                    {isWin && log.params?.loot && (
                        <div className="bg-emerald-950/20 p-4 sm:p-6 rounded-xl border border-emerald-500/30 shadow-lg">
                            <h3 className="text-[10px] sm:text-sm text-emerald-400 uppercase tracking-widest font-bold mb-3 sm:mb-4 flex items-center gap-2 border-b border-emerald-500/20 pb-2">
                                <Icons.Crown className="w-4 h-4 sm:w-5 sm:h-5" /> {t.features.war.current_pool}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                                {Object.entries(log.params.loot).map(([k, v]) => (
                                    <div key={k} className="flex flex-col items-center bg-black/50 p-2 sm:p-3 rounded-lg border border-emerald-500/10">
                                        <div className="mb-1 sm:mb-2 scale-110 sm:scale-125">{getResourceIcon(k)}</div>
                                        <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider mb-1 text-center">{t.common.resources[k]}</span>
                                        <span className="text-emerald-300 font-mono font-bold text-sm sm:text-base">+{formatNumber(v as number)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {warSummary && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                            <div className="bg-red-950/20 p-4 sm:p-6 rounded-xl border border-red-500/20 text-center flex flex-col shadow-lg">
                                <div className="text-[10px] sm:text-xs text-red-400 uppercase tracking-widest font-bold mb-2">{t.common.ui.your_losses}</div>
                                <div className="text-xl sm:text-2xl md:text-3xl font-mono text-white font-bold mb-1">
                                    ${formatNumber(Object.values(warSummary.playerResourceLosses || {}).reduce((a: number, b: number | undefined) => a + (b || 0), 0))}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">{warSummary.playerUnitLosses} {t.common.ui.units}</div>
                            </div>
                            <div className="bg-emerald-950/20 p-4 sm:p-6 rounded-xl border border-emerald-500/20 text-center flex flex-col shadow-lg">
                                <div className="text-[10px] sm:text-xs text-emerald-400 uppercase tracking-widest font-bold mb-2">{t.common.ui.enemies_killed}</div>
                                <div className="text-xl sm:text-2xl md:text-3xl font-mono text-white font-bold mb-1">
                                    {formatNumber(warSummary.enemyUnitLosses)}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">{t.common.ui.units}</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer - SOLO mostrar si NO está embebido */}
                {!embedded && (
                    <div className="p-3 sm:p-4 md:p-6 bg-slate-950 border-t border-white/10 shrink-0 flex gap-3 sm:gap-4 md:gap-6 mt-auto">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 sm:py-4 bg-white/5 hover:bg-white/10 active:bg-slate-700 text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all rounded-xl border border-white/10 shadow-lg"
                        >
                            {t.common.actions.acknowledge}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Reporte de MISION/PATRULLA (sin combatResult)
    if (!log.params?.combatResult) {
        const msg = t.missions.patrol[log.messageKey as keyof typeof t.missions.patrol] || log.messageKey;
        const isGoodNews = log.messageKey.includes('win') || log.messageKey.includes('contraband') || log.messageKey.includes('success');

        return (
            <div className={`flex flex-col flex-1 w-full bg-slate-950 ${embedded ? '' : 'md:rounded-2xl overflow-hidden relative'} border-x-0 border-b-0 md:border-2 ${isGoodNews ? 'border-emerald-500/50' : 'border-slate-500/50'}`}>
                <div className={`p-4 sm:p-6 md:p-8 text-center border-b border-white/10 ${isGoodNews ? 'bg-gradient-to-b from-emerald-900/30 to-transparent' : 'bg-gradient-to-b from-slate-900/50 to-transparent'}`}>
                    <h2 className={`font-tech text-xl sm:text-2xl md:text-3xl uppercase tracking-widest font-bold mb-2 ${isGoodNews ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {isGoodNews ? t.campaign.victory_title : t.reports.view_report}
                    </h2>
                    <p className="text-[10px] sm:text-xs font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</p>
                </div>

                <div className="p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 w-full flex flex-col items-center">
                    <div className="w-full text-center text-xs sm:text-sm md:text-base font-bold text-white bg-black/40 p-4 sm:p-6 rounded-xl border border-white/5 shadow-inner">
                        {msg}
                    </div>

                    {log.params?.loot && Object.keys(log.params.loot).length > 0 && (
                        <div className="w-full bg-emerald-950/20 p-4 sm:p-6 rounded-xl border border-emerald-500/20 shadow-lg">
                            <h3 className="text-[10px] sm:text-sm text-emerald-400 uppercase tracking-widest font-bold mb-4 sm:mb-6 flex items-center justify-center gap-2">
                                <Icons.Crown className="w-4 h-4 sm:w-5 sm:h-5" /> {t.reports.details_loot}
                            </h3>
                            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                                {Object.entries(log.params.loot).map(([k, v]) => (
                                    <div key={k} className="flex flex-col items-center bg-black/50 px-4 sm:px-6 py-3 sm:py-4 rounded-lg min-w-[90px] sm:min-w-[100px] border border-emerald-500/10">
                                        <div className="mb-2 sm:mb-3 scale-125 sm:scale-150">{getResourceIcon(k)}</div>
                                        <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold text-center">{t.common.resources[k]}</span>
                                        <span className="text-emerald-300 font-mono font-bold text-lg sm:text-xl">+{formatNumber(v as number)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer - SOLO mostrar si NO está embebido */}
                {!embedded && (
                    <div className="p-3 sm:p-4 md:p-6 bg-slate-950 border-t border-white/10 shrink-0 flex gap-3 sm:gap-4 md:gap-6 mt-auto">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 sm:py-4 bg-white/5 hover:bg-white/10 active:bg-slate-700 text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all rounded-xl border border-white/10 shadow-lg"
                        >
                            {t.common.actions.acknowledge}
                        </button>
                    </div>
                )}

                {/* Botón cerrar - SOLO mostrar si NO está embebido */}
                {!embedded && onClose && (
                    <button onClick={onClose} className="absolute top-2 right-2 sm:top-4 sm:right-4 p-2 bg-black/20 rounded-full text-slate-400 hover:text-white transition-colors">
                        <Icons.Close className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                )}
            </div>
        );
    }

    const result = log.params.combatResult as BattleResult;

    // DEBUG: Log the result data
    console.log('[DEBUG] CombatReportModal - result:', {
        winner: result.winner,
        rounds: result.rounds,
        initialPlayerArmy: result.initialPlayerArmy,
        initialEnemyArmy: result.initialEnemyArmy,
        totalPlayerCasualties: result.totalPlayerCasualties,
        totalEnemyCasualties: result.totalEnemyCasualties,
        finalPlayerArmy: result.finalPlayerArmy,
        finalEnemyArmy: result.finalEnemyArmy
    });

    const isCampaign = log.type === 'combat' && log.params?.targetName?.startsWith('OP-');
    const isPatrol = log.messageKey.includes('patrol');

    const isDefenseLoss = log.messageKey === 'log_defense_loss';
    const isDefenseWin = log.messageKey === 'log_defense_win';
    const isAttackWin = log.messageKey === 'log_battle_win' || log.messageKey.includes('patrol_battle_win');

    const attackerName = log.params?.attackerName || log.params?.attacker || (log.messageKey.includes('defense') ? t.reports.hostile_force : t.reports.you_label);
    const defenderName = log.params?.targetName || (log.messageKey.includes('defense') ? t.reports.you_label : t.reports.enemy_target);

    // Safe HP calculations with NaN prevention
    const playerHpStart = result.playerTotalHpStart || 0;
    const playerHpLost = result.playerTotalHpLost || 0;
    const enemyHpStart = result.enemyTotalHpStart || 0;
    const enemyHpLost = result.enemyTotalHpLost || 0;
    
    const playerHpPercent = playerHpStart > 0 ? ((playerHpStart - playerHpLost) / playerHpStart) * 100 : 0;
    const enemyHpPercent = enemyHpStart > 0 ? ((enemyHpStart - enemyHpLost) / enemyHpStart) * 100 : 0;

    const safePlayerArmy = result.initialPlayerArmy || {};
    const safeEnemyArmy = result.initialEnemyArmy || {};
    const safeAllyArmies = result.initialAllyArmies || {};

    // Include ally units in the unit type list
    const allyUnitTypes = Object.values(safeAllyArmies).flatMap(army => Object.keys(army));
    
    const allUnitTypes = Array.from(new Set([
        ...Object.keys(safePlayerArmy),
        ...Object.keys(safeEnemyArmy),
        ...allyUnitTypes
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
        const colorClass = isPlayer ? 'text-cyan-400' : 'text-red-400';
        const bgClass = isPlayer ? 'bg-cyan-950/20 border-cyan-500/20' : 'bg-red-950/20 border-red-500/20';

        const activeUnits = sortedUnitTypes.filter(u => {
            const count = initialArmy[u];
            return (count || 0) > 0;
        });
        
        if (activeUnits.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-16 opacity-50 bg-black/20 rounded-xl border border-white/5">
                    <div className="text-5xl mb-4 opacity-50">{isPlayer ? '🛡️' : '⚔️'}</div>
                    <span className="text-sm font-bold uppercase tracking-widest">{t.reports.deployed}: 0</span>
                </div>
            );
        }

        return (
            <div className="space-y-1.5 sm:space-y-2">
                <div className="grid grid-cols-[1fr_auto] gap-1 sm:gap-2 text-[8px] sm:text-[9px] md:text-[10px] uppercase tracking-wider text-slate-500 font-bold px-1 sm:px-2 mb-1.5">
                    <div className="truncate">Unidad</div>
                    <div className="text-right whitespace-nowrap">Bajas | Sobreviven</div>
                </div>

                {activeUnits.map(uType => {
                    const initial = initialArmy[uType] || 0;
                    const lost = casualties[uType] || 0;
                    const survived = initial - lost;
                    const def = UNIT_DEFS[uType];
                    const name = t.units[def.translationKey]?.name || uType;
                    const lostPercent = initial > 0 ? (lost / initial) * 100 : 0;
                    const survivedPercent = initial > 0 ? (survived / initial) * 100 : 0;

                    return (
                        <div key={uType} className={`p-1.5 sm:p-2.5 md:p-3 rounded-lg border ${bgClass} flex flex-col gap-1 sm:gap-1.5 shadow-sm hover:bg-white/5 transition-colors`}>
                            <div className="flex justify-between items-center min-w-0">
                                <span className={`font-bold text-[10px] sm:text-xs md:text-sm ${colorClass} truncate pr-2`}>{name}</span>
                                <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] md:text-xs font-mono whitespace-nowrap shrink-0">
                                    <span className="text-red-400 font-bold">-{formatNumber(lost)}</span>
                                    <span className="text-slate-500">|</span>
                                    <span className="text-emerald-400 font-bold">{formatNumber(survived)}</span>
                                </div>
                            </div>
                            <div className="w-full h-1.5 sm:h-2 md:h-2.5 bg-slate-900/80 rounded-full overflow-hidden border border-white/5">
                                <div 
                                    className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500" 
                                    style={{ width: `${lostPercent}%` }}
                                />
                                <div 
                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 -mt-1.5 sm:-mt-2 md:-mt-2.5 transition-all duration-500" 
                                    style={{ width: `${survivedPercent}%`, marginTop: lostPercent > 0 ? '-100%' : '0' }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderAllyList = () => {
        const allyArmies = result.initialAllyArmies;
        const allyCasualties = result.totalAllyCasualties || {};

        if (!allyArmies || Object.keys(allyArmies).length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-16 opacity-50 bg-black/20 rounded-xl border border-white/5">
                    <div className="text-5xl mb-4 opacity-50">🤝</div>
                    <span className="text-sm font-bold uppercase tracking-widest">{t.reports.no_allies}</span>
                </div>
            );
        }

        const allyIds = Object.keys(allyArmies);

        return (
            <div className="space-y-6">
                {allyIds.map(allyId => {
                    const initialArmy = allyArmies[allyId] || {};
                    const casualties = allyCasualties[allyId] || {};
                    const allyBotName = log.params?.allyNames?.[allyId] || allyId;

                    const activeUnits = sortedUnitTypes.filter(u => (initialArmy[u] || 0) > 0);

                    if (activeUnits.length === 0) return null;

                    return (
                        <div key={allyId} className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 sm:p-6">
                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-emerald-500/20">
                                <div className="p-2 bg-emerald-500/20 rounded-lg">
                                    <Icons.Shield className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-emerald-400 font-bold text-sm sm:text-base uppercase tracking-wider">{allyBotName}</h3>
                                    <p className="text-[10px] text-emerald-500/70 font-mono">{t.reports.allied_reinforcements}</p>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="grid grid-cols-[1fr_auto] gap-1 sm:gap-2 text-[8px] sm:text-[9px] md:text-[10px] uppercase tracking-wider text-slate-500 font-bold px-1 sm:px-2 mb-1.5">
                                    <div className="truncate">Unidad</div>
                                    <div className="text-right whitespace-nowrap">Bajas | Sobreviven</div>
                                </div>

                                {activeUnits.map(uType => {
                                    const initial = initialArmy[uType] || 0;
                                    const lost = casualties[uType] || 0;
                                    const survived = initial - lost;
                                    const def = UNIT_DEFS[uType];
                                    const name = t.units[def.translationKey]?.name || uType;
                                    const lostPercent = initial > 0 ? (lost / initial) * 100 : 0;
                                    const survivedPercent = initial > 0 ? (survived / initial) * 100 : 0;

                                    return (
                                        <div key={uType} className="p-1.5 sm:p-2.5 md:p-3 rounded-lg border bg-emerald-900/10 border-emerald-500/10 flex flex-col gap-1 sm:gap-1.5 shadow-sm">
                                            <div className="flex justify-between items-center min-w-0">
                                                <span className="font-bold text-[10px] sm:text-xs md:text-sm text-emerald-300 truncate pr-2">{name}</span>
                                                <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] md:text-xs font-mono whitespace-nowrap shrink-0">
                                                    <span className="text-red-400 font-bold">-{formatNumber(lost)}</span>
                                                    <span className="text-slate-500">|</span>
                                                    <span className="text-emerald-400 font-bold">{formatNumber(survived)}</span>
                                                </div>
                                            </div>
                                            <div className="w-full h-1.5 sm:h-2 md:h-2.5 bg-slate-900/80 rounded-full overflow-hidden border border-white/5">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500" 
                                                    style={{ width: `${lostPercent}%` }}
                                                />
                                                <div 
                                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 -mt-1.5 sm:-mt-2 md:-mt-2.5 transition-all duration-500" 
                                                    style={{ width: `${survivedPercent}%`, marginTop: lostPercent > 0 ? '-100%' : '0' }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
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
                <div className="flex flex-col items-center justify-center py-12 sm:py-16 opacity-50 bg-black/20 rounded-xl border border-white/5">
                    <Icons.Radar className="w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-4 opacity-50" />
                    <span className="text-xs sm:text-sm font-bold uppercase tracking-widest">{t.reports.no_data}</span>
                </div>
            );
        }

        if (!result.initialPlayerArmy) return null;

        const sortedPerfKeys = sortUnitKeys(Object.keys(result.initialPlayerArmy));

        return (
            <div className="space-y-4 sm:space-y-6">
                <div className="text-[10px] sm:text-xs md:text-sm text-yellow-500 uppercase tracking-widest font-bold px-2 mb-2 flex items-center gap-3">
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

                    const isHuman = unitDef.category === UnitCategory.GROUND;
                    const criticalText = isHuman ? t.reports.critical_bio : t.reports.critical_mech;

                    return (
                        <div key={uType} className="bg-slate-900/80 border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-lg">
                            <div className="p-3 sm:p-4 bg-white/5 flex justify-between items-center border-b border-white/5">
                                <div className="flex flex-col gap-1 min-w-0 flex-1">
                                    <span className="text-cyan-400 font-bold text-sm sm:text-base md:text-lg truncate">{unitName}</span>
                                    <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-mono whitespace-nowrap">
                                        {t.reports.deployed}: <span className="text-white">{formatNumber(deployed)}</span> | {t.reports.lost}: <span className="text-white">{formatNumber(myLosses)}</span>
                                    </span>
                                </div>
                                <div className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border text-[10px] sm:text-xs font-mono font-bold whitespace-nowrap ${isEfficient ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-red-950/40 border-red-500/50 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]'}`}>
                                    {t.reports.efficiency}: {kdRatio}
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row">
                                <div className="flex-1 p-3 sm:p-4 md:p-5 border-b md:border-b-0 md:border-r border-white/5 bg-gradient-to-br from-emerald-950/20 to-transparent">
                                    <div className="text-[9px] sm:text-[10px] text-emerald-500 uppercase tracking-widest font-bold mb-2 sm:mb-3 flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        {t.reports.targets_neutralized}
                                    </div>
                                    {myKills > 0 ? (
                                        <ul className="space-y-1.5 sm:space-y-2">
                                            {Object.entries(kills).map(([victim, count]) => {
                                                const vDef = UNIT_DEFS[victim as UnitType];
                                                const vName = t.units[vDef.translationKey]?.name || victim;
                                                const text = (t.reports as any).analysis_kill_text?.replace('{count}', formatNumber(count)).replace('{unit}', vName) || `${formatNumber(count)} ${vName} neutralized`;
                                                return (
                                                    <li key={victim} className="text-[10px] sm:text-xs md:text-sm text-emerald-100 flex items-start gap-2 bg-emerald-950/20 p-2 rounded-md border border-emerald-500/10">
                                                        <span className="text-emerald-500 font-bold">•</span>
                                                        {text}
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    ) : (
                                        <div className="text-[10px] sm:text-xs text-slate-500 italic bg-black/20 p-2.5 sm:p-3 rounded-md border border-white/5 text-center">{t.reports.no_kills}</div>
                                    )}
                                </div>

                                <div className="flex-1 p-3 sm:p-4 md:p-5 bg-gradient-to-br from-red-950/20 to-transparent">
                                    <div className="text-[9px] sm:text-[10px] text-red-500 uppercase tracking-widest font-bold mb-2 sm:mb-3 flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        {t.reports.fell_to}
                                    </div>
                                    {myLosses > 0 ? (
                                        <ul className="space-y-1.5 sm:space-y-2">
                                            {Object.entries(deathsBy).map(([killer, count]) => {
                                                const kDef = UNIT_DEFS[killer as UnitType];
                                                const kName = t.units[kDef.translationKey]?.name || killer;
                                                const text = (t.reports as any).analysis_death_text?.replace('{count}', formatNumber(count)).replace('{unit}', kName) || `Lost ${formatNumber(count)} to ${kName}`;
                                                return (
                                                    <li key={killer} className="text-[10px] sm:text-xs md:text-sm text-red-100 flex items-start gap-2 bg-red-950/20 p-2 rounded-md border border-red-500/10">
                                                        <span className="text-red-500 font-bold">•</span>
                                                        {text}
                                                    </li>
                                                )
                                            })}
                                            {criticalDeaths > 0 && (
                                                <li className="text-[10px] sm:text-xs md:text-sm text-orange-200 flex items-start gap-2 p-2 mt-2 bg-orange-950/30 rounded-md border border-orange-500/30 shadow-inner">
                                                    <span className="text-orange-500 font-bold animate-pulse">⚠</span>
                                                    {formatNumber(criticalDeaths)} {criticalText}
                                                </li>
                                            )}
                                        </ul>
                                    ) : (
                                        <div className="text-[10px] sm:text-xs text-slate-500 italic bg-black/20 p-2.5 sm:p-3 rounded-md border border-white/5 text-center">{t.reports.no_casualties}</div>
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
            <div className={`p-3 sm:p-4 md:p-6 shrink-0 flex justify-between items-start gap-2 sm:gap-4 border-b border-white/10 ${headerBg}`}>
                <div className="flex gap-2 sm:gap-4 items-start min-w-0 flex-1">
                    <div className={`p-2.5 sm:p-3 rounded-xl bg-black/40 border border-white/10 shadow-lg ${headerText} shrink-0`}>
                        {React.cloneElement(iconHeader, { className: 'w-5 h-5 sm:w-6 sm:h-6' })}
                    </div>
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <h2 className={`text-sm sm:text-base md:text-lg font-tech font-bold uppercase tracking-widest ${headerText} drop-shadow-sm truncate`}>
                            {title}
                        </h2>
                        <div className="text-[9px] sm:text-[10px] md:text-xs text-slate-400 font-mono uppercase tracking-wider opacity-80 bg-black/30 w-max px-1.5 sm:px-2 py-0.5 rounded border border-white/5">
                            {isCampaign ? (t.common.ui as any).mission_type_campaign : isPatrol ? (t.common.ui as any).mission_type_patrol : (t.common.ui as any).mission_type_tactical} • #{log.id.slice(-4)}
                        </div>
                    </div>
                </div>
                {/* Botón cerrar: integrado si embedded, absoluto si no */}
                {onClose && (
                    <button onClick={onClose} className={`p-2 sm:p-2.5 bg-black/40 rounded-full text-slate-400 hover:text-white transition-colors active:scale-95 border border-white/10 hover:bg-white/10 shrink-0 ${embedded ? '' : 'absolute top-3 right-3 sm:top-4 sm:right-4'}`}>
                        <Icons.Close className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                )}
            </div>

            {/* Navigation Tabs - STICKY solo si NO está embebido */}
            <div className={`flex border-b border-white/10 bg-black/80 backdrop-blur-md shrink-0 overflow-x-auto no-scrollbar shadow-inner px-1.5 sm:px-2 pt-1.5 sm:pt-2 gap-1 ${embedded ? '' : 'sticky top-0 z-30'}`}>
                <button onClick={() => setActiveTab('summary')} className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all rounded-t-lg border-t border-x whitespace-nowrap ${activeTab === 'summary' ? 'border-white/20 bg-slate-900 text-white shadow-[0_-5px_10px_rgba(0,0,0,0.3)]' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>{t.common.ui.summary}</button>
                <button onClick={() => setActiveTab('analysis')} className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all rounded-t-lg border-t border-x whitespace-nowrap ${activeTab === 'analysis' ? 'border-yellow-500/30 bg-slate-900 text-yellow-400 shadow-[0_-5px_10px_rgba(234,179,8,0.1)]' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>{t.reports.combat_analysis}</button>
                <button onClick={() => setActiveTab('player')} className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all rounded-t-lg border-t border-x whitespace-nowrap ${activeTab === 'player' ? 'border-cyan-500/30 bg-slate-900 text-cyan-400 shadow-[0_-5px_10px_rgba(6,182,212,0.1)]' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>Propias</button>
                <button onClick={() => setActiveTab('allies')} className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all rounded-t-lg border-t border-x whitespace-nowrap ${activeTab === 'allies' ? 'border-emerald-500/30 bg-slate-900 text-emerald-400 shadow-[0_-5px_10px_rgba(16,185,129,0.1)]' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>Aliados</button>
                <button onClick={() => setActiveTab('enemy')} className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all rounded-t-lg border-t border-x whitespace-nowrap ${activeTab === 'enemy' ? 'border-red-500/30 bg-slate-900 text-red-400 shadow-[0_-5px_10px_rgba(239,68,68,0.1)]' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>Enemigos</button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 p-3 sm:p-4 md:p-6 bg-slate-900/50">
                {activeTab === 'summary' && (
                    <div className="space-y-4 sm:space-y-6 animate-[fadeIn_0.2s_ease-out]">

                        {/* Combatants Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="bg-cyan-900/20 border border-cyan-500/30 p-3 sm:p-4 rounded-xl flex flex-col items-center">
                                <span className="text-[9px] sm:text-[10px] text-cyan-400 uppercase tracking-widest mb-1 font-bold text-center">Propias</span>
                                <span className="text-white font-tech text-sm sm:text-lg uppercase tracking-wider text-center">{t.reports.you_label}</span>
                            </div>
                            <div className="bg-red-900/20 border border-red-500/30 p-3 sm:p-4 rounded-xl flex flex-col items-center">
                                <span className="text-[9px] sm:text-[10px] text-red-400 uppercase tracking-widest mb-1 font-bold text-center">Enemigos</span>
                                <span className="text-white font-tech text-sm sm:text-lg uppercase tracking-wider text-center truncate w-full">{attackerName === t.reports.you_label ? defenderName : attackerName}</span>
                            </div>
                        </div>

                        {log.params.buildingLoot && Object.keys(log.params.buildingLoot).length > 0 && (
                            <div className={`p-3 sm:p-5 rounded-xl border ${isDefenseLoss ? 'bg-red-950/30 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-yellow-950/20 border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.1)]'}`}>
                                <div className={`text-[9px] sm:text-[10px] md:text-xs uppercase tracking-widest mb-3 sm:mb-4 font-bold flex justify-center items-center gap-2 ${isDefenseLoss ? 'text-red-400' : 'text-yellow-400'}`}>
                                    <Icons.Base className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    {isDefenseLoss ? t.reports.buildings_lost : t.reports.buildings_seized}
                                </div>
                                <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
                                    {Object.entries(log.params.buildingLoot).map(([k, v]) => {
                                        const val = v as number;
                                        if (val <= 0) return null;
                                        const bDef = BUILDING_DEFS[k as BuildingType];
                                        const name = t.buildings[bDef?.translationKey]?.name || k;

                                        if (k === BuildingType.DIAMOND_MINE) {
                                            return (
                                                <div key={k} className="flex flex-col items-center bg-black/60 px-4 sm:px-5 py-2.5 sm:py-3 rounded-lg min-w-[90px] sm:min-w-[100px] border border-red-500/50 shadow-lg relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-full h-0.5 sm:h-1 bg-red-500 animate-pulse"></div>
                                                    <div className="mb-1.5 sm:mb-2 text-red-500 animate-pulse scale-110 sm:scale-125"><Icons.Warning className="w-4 h-4 sm:w-5 sm:h-5" /></div>
                                                    <span className="text-[9px] sm:text-[10px] text-red-300 uppercase max-w-[100px] sm:max-w-[120px] text-center truncate mb-1">{t.reports.diamond_damaged}</span>
                                                    <span className="font-mono font-bold text-xs sm:text-base text-red-400">{t.common.ui.status_damaged}</span>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={k} className="flex flex-col items-center bg-black/40 px-4 sm:px-5 py-2.5 sm:py-3 rounded-lg min-w-[90px] sm:min-w-[100px] border border-white/5">
                                                <div className="mb-1.5 sm:mb-2 text-slate-400 scale-110 sm:scale-125"><Icons.Base className="w-4 h-4 sm:w-5 sm:h-5" /></div>
                                                <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase max-w-[100px] text-center truncate mb-1">{name}</span>
                                                <span className={`font-mono font-bold text-base sm:text-lg ${isDefenseLoss ? 'text-red-400' : 'text-yellow-300'}`}>{isDefenseLoss ? '-' : '+'}{formatNumber(val)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {log.params.loot && Object.keys(log.params.loot).length > 0 ? (
                            <div className={`p-3 sm:p-5 rounded-xl border text-center shadow-lg ${isDefenseLoss ? 'bg-red-950/30 border-red-500/30' : isCampaign ? 'bg-cyan-950/20 border-cyan-500/30' : 'bg-emerald-950/20 border-emerald-500/30'}`}>
                                <div className={`text-[9px] sm:text-[10px] md:text-xs uppercase tracking-widest mb-3 sm:mb-4 font-bold flex items-center justify-center gap-2 ${isDefenseLoss ? 'text-red-400' : isCampaign ? 'text-cyan-400' : 'text-emerald-400'}`}>
                                    <Icons.Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    {isDefenseLoss ? t.reports.details_stolen : isCampaign ? t.campaign.rewards : t.reports.details_loot}
                                </div>
                                <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
                                    {Object.entries(log.params.loot).map(([k,v]) => (
                                        <span key={k} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border text-[9px] sm:text-[10px] md:text-xs font-mono font-bold flex items-center gap-1.5 sm:gap-2 shadow-inner ${isDefenseLoss ? 'text-red-300 border-red-500/30 bg-red-950/40' : 'text-emerald-300 border-emerald-500/20 bg-emerald-950/40'}`}>
                                            <div className="scale-110 sm:scale-125">{getResourceIcon(k)}</div>
                                            <span>{isDefenseLoss ? '-' : '+'}{formatNumber(v as number)}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            (!log.params.buildingLoot || Object.keys(log.params.buildingLoot).length === 0) && (
                                <div className="text-center py-4 sm:py-6 border-y border-white/5 bg-black/20 rounded-xl">
                                    <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest font-bold">
                                        {isAttackWin || isDefenseWin ? t.reports.no_loot : t.reports.no_losses}
                                    </span>
                                </div>
                            )
                        )}

                        <div className="space-y-3 sm:space-y-4">
                            <div className="bg-black/30 p-3 sm:p-4 rounded-xl border border-white/5 shadow-inner">
                                <div className="flex justify-between text-[9px] sm:text-[10px] md:text-xs uppercase tracking-widest mb-2 font-bold">
                                    <span className="text-cyan-400 flex items-center gap-1.5 sm:gap-2"><Icons.Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {t.reports.integrity} (Propias)</span>
                                    <span className="text-white bg-black/50 px-2 py-0.5 rounded">{playerHpPercent.toFixed(0)}%</span>
                                </div>
                                <div className="h-2 sm:h-3 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                                    <div className={`h-full transition-all duration-1000 ${playerHpPercent < 30 ? 'bg-red-500' : 'bg-cyan-500'}`} style={{ width: `${playerHpPercent}%` }}></div>
                                </div>
                            </div>
                            <div className="bg-black/30 p-3 sm:p-4 rounded-xl border border-white/5 shadow-inner">
                                <div className="flex justify-between text-[9px] sm:text-[10px] md:text-xs uppercase tracking-widest mb-2 font-bold">
                                    <span className="text-red-400 flex items-center gap-1.5 sm:gap-2"><Icons.Skull className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {t.reports.integrity} (Enemigos)</span>
                                    <span className="text-white bg-black/50 px-2 py-0.5 rounded">{enemyHpPercent.toFixed(0)}%</span>
                                </div>
                                <div className="h-2 sm:h-3 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                                    <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${enemyHpPercent}%` }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="bg-slate-800/30 p-3 sm:p-5 rounded-xl text-center border border-white/5 shadow-sm">
                                <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold"><Icons.Clock className="inline w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1"/>{t.reports.rounds}</div>
                                <div className="text-xl sm:text-2xl md:text-3xl font-mono text-white font-bold">{result.rounds?.length || 0}</div>
                            </div>
                            <div className="bg-slate-800/30 p-3 sm:p-5 rounded-xl text-center border border-white/5 shadow-sm">
                                <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold"><Icons.Crosshair className="inline w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1"/>{t.reports.damage_dealt}</div>
                                {(() => {
                                    const totalAllyDamage = result.allyDamageDealt 
                                        ? Object.values(result.allyDamageDealt).reduce((a, b) => a + (b || 0), 0) 
                                        : 0;
                                    const totalDamage = (result.playerDamageDealt || 0) + totalAllyDamage;
                                    return (
                                        <div className="text-xl sm:text-2xl md:text-3xl font-mono text-cyan-400 font-bold">{formatNumber(totalDamage)}</div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'analysis' && <div className="animate-[fadeIn_0.2s_ease-out]">{renderAnalysis()}</div>}
                {activeTab === 'player' && <div className="animate-[fadeIn_0.2s_ease-out]">{renderUnitList('player')}</div>}
                {activeTab === 'allies' && <div className="animate-[fadeIn_0.2s_ease-out]">{renderAllyList()}</div>}
                {activeTab === 'enemy' && <div className="animate-[fadeIn_0.2s_ease-out]">{renderUnitList('enemy')}</div>}
            </div>

            {/* Footer Buttons for Modals - STICKY solo si NO está embebido */}
            {!embedded && onClose && (
                <div className={`p-3 sm:p-4 md:p-6 bg-slate-950/95 backdrop-blur-md border-t border-white/10 shrink-0 mt-auto ${!embedded ? 'sticky bottom-0 z-30 safe-area-bottom' : ''}`}>
                    <button onClick={onClose} className="w-full py-3 sm:py-4 bg-white/5 hover:bg-white/10 active:scale-[0.98] rounded-xl border border-white/10 text-white text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-widest transition-all shadow-lg hover:shadow-white/5">
                        {t.common.actions.close}
                    </button>
                </div>
            )}
        </div>
    );
};