import React, { useState } from 'react';
import { BUILDING_DEFS } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
import { BattleResult, LogEntry, UnitType, TranslationDictionary, ResourceType, WarState, UnitCategory, BuildingType, LogisticLootField } from '../../types';
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

    // 1. ESPECIAL: Reporte de SALVAMENTO
    if (log.messageKey === 'log_salvage_success' && log.params?.lootField) {
        const field = log.params.lootField as LogisticLootField;
        return (
            <div className={`flex flex-col flex-1 w-full bg-slate-950 ${embedded ? '' : 'md:rounded-2xl overflow-hidden relative border-2 border-yellow-500/50 shadow-[0_0_40px_rgba(234,179,8,0.1)]'}`}>
                <div className="p-4 sm:p-6 md:p-8 text-center border-b border-white/10 bg-gradient-to-b from-yellow-900/30 to-transparent">
                    <h2 className="font-tech text-xl sm:text-2xl md:text-3xl uppercase tracking-widest font-bold mb-2 text-yellow-400">
                        {(t.common.ui as any).mission_salvage || 'Operación de Salvamento'}
                    </h2>
                    <p className="text-[10px] sm:text-xs font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</p>
                </div>

                <div className="p-3 sm:p-4 md:p-8 space-y-6 w-full flex flex-col">
                    <div className="text-center text-xs sm:text-sm font-bold text-white bg-black/40 p-4 rounded-xl border border-white/5 shadow-inner">
                        {t.common.ui.log_salvage_success.replace('{drones}', log.params.drones || '0')}
                    </div>

                    {/* Recursos Obtenidos */}
                    <div className="bg-emerald-950/20 p-4 sm:p-6 rounded-xl border border-emerald-500/30 shadow-lg">
                        <h3 className="text-[10px] sm:text-sm text-emerald-400 uppercase tracking-widest font-bold mb-4 flex items-center gap-2 border-b border-emerald-500/20 pb-2">
                            <Icons.Resources.Money className="w-4 h-4" /> {t.reports.details_loot}
                        </h3>
                        <div className="grid grid-cols-3 gap-2 sm:gap-4">
                            {Object.entries(log.params.loot || {}).map(([k, v]) => (
                                <div key={k} className="flex flex-col items-center bg-black/50 p-2 sm:p-3 rounded-lg border border-emerald-500/10">
                                    <div className="mb-1 sm:mb-2">{getResourceIcon(k)}</div>
                                    <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase tracking-wider mb-1 text-center">{t.common.resources[k as keyof typeof t.common.resources]}</span>
                                    <span className="text-emerald-300 font-mono font-bold text-xs sm:text-base">+{formatNumber(v as number)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Estado del Campo */}
                    <div className="bg-black/30 p-4 sm:p-6 rounded-xl border border-white/5 shadow-inner">
                        <h3 className="text-[10px] sm:text-sm text-yellow-500 uppercase tracking-widest font-bold mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
                            <Icons.Radar className="w-4 h-4" /> Telemetría del Campo
                        </h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                            <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                <span className="text-[9px] text-slate-500 uppercase font-bold block mb-2 text-center">Generado Originalmente</span>
                                <div className="space-y-1">
                                    {Object.entries(field.initialResources || {}).map(([res, val]) => (
                                        <div key={res} className="flex justify-between items-center text-[10px] font-mono">
                                            <span className="text-slate-400">{t.common.resources[res as keyof typeof t.common.resources]}</span>
                                            <span className="text-white">{formatNumber(val as number)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white/5 p-3 rounded-lg border border-white/5 flex flex-col justify-center items-center gap-1">
                                <span className="text-[9px] text-slate-500 uppercase font-bold block text-center">Extracciones Totales</span>
                                <span className="text-xl font-mono text-cyan-400 font-bold">{field.harvestCount || 0}</span>
                                <span className="text-[8px] text-slate-500 uppercase">operaciones realizadas</span>
                            </div>
                            <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                <span className="text-[9px] text-slate-500 uppercase font-bold block mb-2 text-center">Restante en Zona</span>
                                <div className="space-y-1">
                                    {Object.entries(field.resources || {}).map(([res, val]) => (
                                        <div key={res} className="flex justify-between items-center text-[10px] font-mono">
                                            <span className="text-slate-400">{t.common.resources[res as keyof typeof t.common.resources]}</span>
                                            <span className="text-yellow-500">{formatNumber(val as number)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Estado */}
                        <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-3 border-l-2 border-yellow-500 pl-2">Estado de la Zona</span>
                            <div className="p-4 bg-white/5 rounded-lg border border-white/5 text-center">
                                <p className="text-[10px] text-slate-400 font-mono italic">
                                    {field.totalValue > 0 
                                        ? "Detección de firmas activas. Recursos remanentes listos para extracción adicional."
                                        : "Zona agotada. No se detectan más materiales recuperables."}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {!embedded && (
                    <div className="p-3 sm:p-4 md:p-6 bg-slate-950 border-t border-white/10 shrink-0 flex gap-3 mt-auto">
                        <button onClick={onClose} className="flex-1 py-3 sm:py-4 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all rounded-xl border border-yellow-500/30">
                            {t.common.actions.acknowledge}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // 2. Reporte de GUERRA
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
                                        <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider mb-1 text-center">{t.common.resources[k as keyof typeof t.common.resources]}</span>
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

    // 3. Reporte de INTELIGENCIA (Espionaje)
    if (log.type === 'intel') {
        const params = log.params || {};
        return (
            <div className={`flex flex-col flex-1 w-full bg-slate-950 ${embedded ? '' : 'md:rounded-2xl overflow-hidden relative'} border-x-0 border-b-0 md:border-2 border-indigo-500/50`}>
                <div className="p-4 sm:p-6 md:p-8 text-center border-b border-white/10 bg-gradient-to-b from-indigo-900/30 to-transparent">
                    <h2 className="font-tech text-xl sm:text-2xl md:text-3xl uppercase tracking-widest font-bold mb-2 text-indigo-400">
                        {t.common.ui.spy_report_title || 'Intelligence Report'}
                    </h2>
                    <p className="text-[10px] sm:text-xs font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</p>
                </div>

                <div className="p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 w-full flex flex-col">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className="bg-indigo-950/20 border border-indigo-500/30 p-3 sm:p-4 rounded-xl flex flex-col items-center">
                            <span className="text-[9px] sm:text-[10px] text-indigo-400 uppercase tracking-widest mb-1 font-bold">{t.reports.intel_target}</span>
                            <span className="text-white font-tech text-sm sm:text-lg uppercase tracking-wider">{params.targetName || '---'}</span>
                        </div>
                        <div className="bg-indigo-950/20 border border-indigo-500/30 p-3 sm:p-4 rounded-xl flex flex-col items-center">
                            <span className="text-[9px] sm:text-[10px] text-indigo-400 uppercase tracking-widest mb-1 font-bold">{t.reports.intel_strength}</span>
                            <span className="text-white font-mono text-sm sm:text-lg font-bold">{formatNumber(params.score || 0)}</span>
                        </div>
                    </div>

                    <div className="bg-black/30 p-4 sm:p-6 rounded-xl border border-white/5 shadow-inner">
                        <h3 className="text-[10px] sm:text-sm text-indigo-400 uppercase tracking-widest font-bold mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
                            <Icons.Army className="w-4 h-4" /> {t.common.ui.spy_detected_units || 'Detected Units'}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                            {params.units && Object.entries(params.units).map(([uType, count]) => {
                                const def = UNIT_DEFS[uType as UnitType];
                                const name = t.units[def?.translationKey]?.name || uType;
                                return (
                                    <div key={uType} className="flex justify-between items-center bg-indigo-900/10 p-2 sm:p-3 rounded-lg border border-indigo-500/10">
                                        <span className="text-[10px] sm:text-xs text-slate-300 truncate pr-2">{name}</span>
                                        <span className="text-white font-mono font-bold text-xs sm:text-sm">{formatNumber(count as number)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {!embedded && (
                    <div className="p-3 sm:p-4 md:p-6 bg-slate-950 border-t border-white/10 shrink-0 flex gap-3 mt-auto">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 sm:py-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all rounded-xl border border-indigo-500/30"
                        >
                            {t.common.actions.acknowledge}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // 4. Reporte de MISION/PATRULLA (sin combate)
    if (!log.params?.combatResult) {
        const msg = t.missions.patrol[log.messageKey as keyof typeof t.missions.patrol] || log.messageKey;
        const isGoodNews = log.messageKey.includes('win') || log.messageKey.includes('contraband') || log.messageKey.includes('success');

        return (
            <div className={`flex flex-col flex-1 w-full bg-slate-950 ${embedded ? '' : 'md:rounded-2xl overflow-hidden relative border-x-0 border-b-0 md:border-2'} ${isGoodNews ? 'border-emerald-500/50' : 'border-slate-500/50'}`}>
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
                                    <div key={k} className="flex flex-col items-center bg-black/50 px-4 sm:px-6 py-3 sm:py-4 rounded-lg min-w-[90px] border border-emerald-500/10">
                                        <div className="mb-2 sm:mb-3 scale-125 sm:scale-150">{getResourceIcon(k)}</div>
                                        <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold text-center">{t.common.resources[k as keyof typeof t.common.resources]}</span>
                                        <span className="text-emerald-300 font-mono font-bold text-lg sm:text-xl">+{formatNumber(v as number)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {!embedded && (
                    <div className="p-3 sm:p-4 md:p-6 bg-slate-950 border-t border-white/10 shrink-0 flex gap-3 mt-auto">
                        <button onClick={onClose} className="flex-1 py-3 sm:py-4 bg-white/5 hover:bg-white/10 active:bg-slate-700 text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all rounded-xl border border-white/10 shadow-lg">{t.common.actions.acknowledge}</button>
                    </div>
                )}
            </div>
        );
    }

    // 5. Reporte de COMBATE ESTÁNDAR
    const result = log.params.combatResult as BattleResult;
    const isCampaign = log.type === 'combat' && log.params?.targetName?.startsWith('OP-');
    const isPatrol = log.messageKey.includes('patrol');
    const isDefenseLoss = log.messageKey === 'log_defense_loss' || log.messageKey === 'combat_p2p_defenseFail';
    const isDefenseWin = log.messageKey === 'log_defense_win' || log.messageKey === 'combat_p2p_defenseSuccess';
    const isAttackWin = log.messageKey === 'log_battle_win' || log.messageKey.includes('patrol_battle_win') || log.messageKey === 'combat_p2p_victory';

    const attackerName = log.params?.attackerName || log.params?.attacker || (log.messageKey.includes('defense') ? t.reports.hostile_force : t.reports.you_label);
    const defenderName = log.params?.targetName || log.params?.defender || (log.messageKey.includes('defense') ? t.reports.you_label : t.reports.enemy_target);

    const playerHpStart = result.playerTotalHpStart || 0;
    const playerHpLost = result.playerTotalHpLost || 0;
    const enemyHpStart = result.enemyTotalHpStart || 0;
    const enemyHpLost = result.enemyTotalHpLost || 0;
    const playerHpPercent = playerHpStart > 0 ? ((playerHpStart - playerHpLost) / playerHpStart) * 100 : 0;
    const enemyHpPercent = enemyHpStart > 0 ? ((enemyHpStart - enemyHpLost) / enemyHpStart) * 100 : 0;

    const safePlayerArmy = result.initialPlayerArmy || {};
    const safeEnemyArmy = result.initialEnemyArmy || {};
    const safeAllyArmies = result.initialAllyArmies || {};
    const allUnitTypes = sortUnitKeys(Array.from(new Set([...Object.keys(safePlayerArmy), ...Object.keys(safeEnemyArmy), ...Object.values(safeAllyArmies).flatMap(army => Object.keys(army))])) as UnitType[]);

    let headerBg = 'bg-slate-900';
    let headerText = 'text-slate-200';
    let title = t.campaign.victory_title;
    let iconHeader = <Icons.Army />;

    if (isPatrol) {
        headerBg = isAttackWin ? 'bg-gradient-to-b from-purple-900/40 to-transparent' : 'bg-gradient-to-b from-slate-900/80 to-transparent';
        headerText = isAttackWin ? 'text-purple-400' : 'text-slate-400';
        title = isAttackWin ? t.missions.patrol.complete : t.missions.patrol.in_progress;
    } else if (isCampaign) {
        headerBg = isAttackWin ? 'bg-gradient-to-b from-cyan-900/40 to-transparent' : 'bg-gradient-to-b from-slate-900/80 to-transparent';
        headerText = isAttackWin ? 'text-cyan-400' : 'text-slate-400';
        title = isAttackWin ? t.campaign.victory_title : t.campaign.defeat_title;
    } else if (isDefenseLoss) {
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
    } else {
        headerBg = 'bg-gradient-to-b from-orange-900/40 to-transparent';
        headerText = 'text-orange-400';
        title = t.campaign.defeat_title;
        iconHeader = <Icons.Skull className="w-6 h-6" />;
    }

    const renderUnitList = (side: 'player' | 'enemy') => {
        const isPlayer = side === 'player';
        const initialArmy = isPlayer ? safePlayerArmy : safeEnemyArmy;
        const casualties = isPlayer ? (result.totalPlayerCasualties || {}) : (result.totalEnemyCasualties || {});
        const activeUnits = allUnitTypes.filter(u => (initialArmy[u] || 0) > 0);
        
        if (activeUnits.length === 0) return <div className="py-12 text-center opacity-50 italic text-xs">{t.reports.deployed}: 0</div>;

        return (
            <div className="space-y-2">
                <div className="grid grid-cols-[1fr_auto] text-[10px] uppercase text-slate-500 font-bold px-2">
                    <span>Unidad</span>
                    <span>Bajas | Sobreviven</span>
                </div>
                {activeUnits.map(uType => {
                    const initial = initialArmy[uType] || 0;
                    const lost = casualties[uType] || 0;
                    const survived = initial - lost;
                    const name = t.units[UNIT_DEFS[uType].translationKey]?.name || uType;
                    const lostPct = initial > 0 ? (lost / initial) * 100 : 0;
                    return (
                        <div key={uType} className={`p-3 rounded-lg border ${isPlayer ? 'bg-cyan-950/20 border-cyan-500/20' : 'bg-red-950/20 border-red-500/20'}`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-xs">{name}</span>
                                <span className="font-mono text-xs"><span className="text-red-400">-{formatNumber(lost)}</span> | <span className="text-emerald-400">{formatNumber(survived)}</span></span>
                            </div>
                            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 transition-all" style={{ width: `${lostPct}%` }}></div>
                                <div className="h-full bg-emerald-500 -mt-1.5" style={{ width: `${100-lostPct}%` }}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderAllyList = () => {
        const allyArmies = result.initialAllyArmies || {};
        const allyCasualties = result.totalAllyCasualties || {};

        if (Object.keys(allyArmies).length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-16 opacity-50 bg-black/20 rounded-xl border border-white/5">
                    <div className="text-5xl mb-4 opacity-50">🤝</div>
                    <span className="text-sm font-bold uppercase tracking-widest">{t.reports.no_allies}</span>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {Object.keys(allyArmies).map(allyId => {
                    const army = allyArmies[allyId];
                    const casualties = allyCasualties[allyId] || {};
                    const name = log.params?.allyNames?.[allyId] || allyId;
                    const activeUnits = allUnitTypes.filter(u => (army[u] || 0) > 0);

                    return (
                        <div key={allyId} className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 sm:p-6">
                            <h3 className="text-emerald-400 font-bold mb-4 uppercase tracking-widest border-b border-emerald-500/20 pb-2">{name}</h3>
                            <div className="space-y-2">
                                {activeUnits.map(uType => {
                                    const initial = army[uType] || 0;
                                    const lost = casualties[uType] || 0;
                                    const survived = initial - lost;
                                    const uName = t.units[UNIT_DEFS[uType].translationKey]?.name || uType;
                                    return (
                                        <div key={uType} className="flex justify-between items-center text-xs p-2 bg-black/30 rounded border border-white/5">
                                            <span className="text-slate-300">{uName}</span>
                                            <span className="font-mono"><span className="text-red-400">-{formatNumber(lost)}</span> | <span className="text-emerald-400">{formatNumber(survived)}</span></span>
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

        return (
            <div className="space-y-6">
                <div className="text-[10px] sm:text-xs md:text-sm text-yellow-500 uppercase tracking-widest font-bold px-2 mb-2 flex items-center gap-3">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_10px_#eab308]"></span>
                    {t.reports.kill_analysis}
                </div>
                {Object.keys(perf).map(uType => {
                    const stats = perf[uType as UnitType];
                    if (!stats) return null;
                    const uName = t.units[UNIT_DEFS[uType as UnitType].translationKey]?.name || uType;
                    const kills = Object.values(stats.kills || {}).reduce((a, b) => a + (b || 0), 0);
                    const deaths = Object.values(stats.deathsBy || {}).reduce((a, b) => a + (b || 0), 0);

                    return (
                        <div key={uType} className="bg-slate-900/80 border border-white/10 rounded-xl overflow-hidden p-4">
                            <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                                <div className="flex flex-col">
                                    <span className="text-cyan-400 font-bold">{uName}</span>
                                    <span className="text-[10px] text-slate-500 uppercase font-mono">{t.reports.damage_dealt}: {formatNumber(stats.damageDealt || 0)}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-mono text-slate-400">{t.reports.efficiency}: {(kills / (deaths || 1)).toFixed(2)}</span>
                                    {stats.criticalKills > 0 && (
                                        <span className="text-[10px] text-yellow-500 font-bold uppercase animate-pulse">
                                            {stats.criticalKills} Impactos Críticos
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center border-b border-emerald-500/20 pb-1 mb-1">
                                        <span className="text-[10px] text-emerald-500 uppercase font-bold">{t.reports.targets_neutralized}</span>
                                        <span className="text-xs font-mono text-emerald-400 font-bold">{kills}</span>
                                    </div>
                                    {Object.entries(stats.kills || {}).map(([v, c]) => (
                                        <div key={v} className="text-[10px] text-slate-300 flex justify-between">
                                            <span>{t.units[UNIT_DEFS[v as UnitType].translationKey]?.name || v}</span>
                                            <span className="text-emerald-400">+{c}</span>
                                        </div>
                                    ))}
                                    {kills === 0 && <div className="text-[10px] text-slate-500 italic">No neutralizó objetivos</div>}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center border-b border-red-500/20 pb-1 mb-1">
                                        <span className="text-[10px] text-red-500 uppercase font-bold">{t.reports.fell_to}</span>
                                        <span className="text-xs font-mono text-red-400 font-bold">{deaths}</span>
                                    </div>
                                    {Object.entries(stats.deathsBy || {}).map(([k, c]) => (
                                        <div key={k} className="text-[10px] text-slate-300 flex justify-between">
                                            <span>{t.units[UNIT_DEFS[k as UnitType].translationKey]?.name || k}</span>
                                            <span className="text-red-400">-{c}</span>
                                        </div>
                                    ))}
                                    {deaths === 0 && <div className="text-[10px] text-slate-500 italic">Sin bajas registradas</div>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className={`flex flex-col flex-1 w-full bg-slate-950 ${embedded ? '' : 'md:border border-white/10 md:rounded-2xl relative'}`}>
            <div className={`p-4 md:p-6 flex justify-between items-start border-b border-white/10 ${headerBg}`}>
                <div className="flex gap-4 items-center">
                    <div className={`p-3 rounded-xl bg-black/40 border border-white/10 ${headerText}`}>{iconHeader}</div>
                    <div>
                        <h2 className={`text-base md:text-lg font-tech font-bold uppercase tracking-widest ${headerText}`}>{title}</h2>
                        <div className="text-[10px] text-slate-400 font-mono uppercase">#{log.id.slice(-4)}</div>
                    </div>
                </div>
                {onClose && <button onClick={onClose} className="p-2 bg-black/40 rounded-full text-slate-400 hover:text-white transition-colors"><Icons.Close /></button>}
            </div>

            <div className="flex border-b border-white/10 bg-black/80 shrink-0 overflow-x-auto px-2 pt-2 gap-1 sticky top-0 z-30">
                <button onClick={() => setActiveTab('summary')} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider rounded-t-lg ${activeTab === 'summary' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{t.common.ui.summary}</button>
                <button onClick={() => setActiveTab('analysis')} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider rounded-t-lg ${activeTab === 'analysis' ? 'bg-slate-900 text-yellow-400 shadow-[0_-5px_10px_rgba(234,179,8,0.1)]' : 'text-slate-500'}`}>{t.reports.combat_analysis}</button>
                <button onClick={() => setActiveTab('player')} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider rounded-t-lg ${activeTab === 'player' ? 'bg-slate-900 text-cyan-400' : 'text-slate-500'}`}>Propias</button>
                <button onClick={() => setActiveTab('allies')} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider rounded-t-lg ${activeTab === 'allies' ? 'bg-slate-900 text-emerald-400 shadow-[0_-5px_10px_rgba(16,185,129,0.1)]' : 'text-slate-500'}`}>Aliados</button>
                <button onClick={() => setActiveTab('enemy')} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider rounded-t-lg ${activeTab === 'enemy' ? 'bg-slate-900 text-red-400' : 'text-slate-500'}`}>Enemigos</button>
            </div>

            <div className="flex-1 p-4 md:p-6 bg-slate-900/50 space-y-6">
                {activeTab === 'summary' && (
                    <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-cyan-900/20 border border-cyan-500/30 p-4 rounded-xl text-center"><span className="text-[10px] text-cyan-400 font-bold block">TÚ</span><span className="text-white font-tech uppercase">{t.reports.you_label}</span></div>
                            <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl text-center"><span className="text-[10px] text-red-400 font-bold block">ENEMIGO</span><span className="text-white font-tech uppercase truncate block">{attackerName === t.reports.you_label ? defenderName : attackerName}</span></div>
                        </div>

                        {log.params.buildingLoot && Object.keys(log.params.buildingLoot).length > 0 && (
                            <div className="bg-black/40 border border-white/10 p-5 rounded-xl text-center">
                                <h3 className="text-xs uppercase tracking-widest text-yellow-500 font-bold mb-4">{isDefenseLoss ? t.reports.buildings_lost : t.reports.buildings_seized}</h3>
                                <div className="flex flex-wrap justify-center gap-3">
                                    {Object.entries(log.params.buildingLoot).map(([k,v]) => (
                                        <div key={k} className="bg-white/5 px-4 py-2 rounded-lg border border-white/5 text-[10px] text-white">
                                            {t.buildings[BUILDING_DEFS[k as BuildingType].translationKey]?.name || k} <span className={isDefenseLoss ? 'text-red-400' : 'text-emerald-400'}>{isDefenseLoss ? '-' : '+'}{v as number}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="bg-black/30 p-4 rounded-xl border border-white/5 shadow-inner">
                                <div className="flex justify-between text-[10px] font-bold mb-2 text-cyan-400 uppercase"><span>Integridad Propias</span><span>{playerHpPercent.toFixed(0)}%</span></div>
                                <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5"><div className={`h-full transition-all duration-1000 ${playerHpPercent < 30 ? 'bg-red-500' : 'bg-cyan-500'}`} style={{ width: `${playerHpPercent}%` }}></div></div>
                            </div>
                            <div className="bg-black/30 p-4 rounded-xl border border-white/5 shadow-inner">
                                <div className="flex justify-between text-[10px] font-bold mb-2 text-red-400 uppercase"><span>Integridad Enemigas</span><span>{enemyHpPercent.toFixed(0)}%</span></div>
                                <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${enemyHpPercent}%` }}></div></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-5 rounded-xl text-center border border-white/5"><div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t.reports.rounds}</div><div className="text-2xl font-mono text-white font-bold">{result.rounds?.length || 0}</div></div>
                            <div className="bg-white/5 p-5 rounded-xl text-center border border-white/5"><div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t.reports.damage_dealt}</div><div className="text-2xl font-mono text-cyan-400 font-bold">{formatNumber(result.playerDamageDealt || 0)}</div></div>
                        </div>
                    </div>
                )}
                {activeTab === 'player' && <div className="animate-[fadeIn_0.2s_ease-out]">{renderUnitList('player')}</div>}
                {activeTab === 'allies' && <div className="animate-[fadeIn_0.2s_ease-out]">{renderAllyList()}</div>}
                {activeTab === 'analysis' && <div className="animate-[fadeIn_0.2s_ease-out]">{renderAnalysis()}</div>}
                {activeTab === 'enemy' && <div className="animate-[fadeIn_0.2s_ease-out]">{renderUnitList('enemy')}</div>}
            </div>

            {!embedded && onClose && (
                <div className="p-4 md:p-6 bg-slate-950/95 border-t border-white/10 shrink-0 sticky bottom-0 z-30">
                    <button onClick={onClose} className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white text-xs font-bold uppercase tracking-widest transition-all">{t.common.actions.close}</button>
                </div>
            )}
        </div>
    );
};
