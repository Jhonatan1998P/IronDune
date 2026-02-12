
import React from 'react';
import { LogEntry, TechType, TranslationDictionary, UnitType, ResourceType } from '../../types';
import { TECH_DEFS } from '../../data/techs';
import { UNIT_DEFS } from '../../data/units';
import { Icons } from '../UIComponents';
import { formatNumber } from '../../utils';

interface ReportItemProps {
    log: LogEntry;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onArchive: (id: string, archive: boolean) => void;
    onViewDetails: (log: LogEntry) => void;
    onSimulate?: (enemyUnits: Partial<Record<UnitType, number>>) => void;
    t: TranslationDictionary;
}

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

export const ReportItem: React.FC<ReportItemProps> = React.memo(({ log, isSelected, onSelect, onDelete, onArchive, onViewDetails, onSimulate, t }) => {
    // Combat Context Logic
    const isCampaign = log.type === 'combat' && log.params?.targetName?.startsWith('OP-');
    const isPatrol = log.messageKey.includes('patrol');
    const isPvP = !isCampaign && !isPatrol && log.type === 'combat';

    const isDefenseLoss = log.messageKey === 'log_defense_loss';
    const isDefenseWin = log.messageKey === 'log_defense_win';
    const isAttackWin = log.messageKey === 'log_battle_win' || log.messageKey.includes('patrol_battle_win') || log.messageKey.includes('patrol_contraband');
    
    // --- Message Builder ---
    let msg = log.messageKey;
    
    // Title Resolution based on exact type
    if (log.messageKey === 'log_battle_win') msg = isCampaign ? `${t.common.actions.attack}: ${t.campaign.victory_title}` : `${t.common.actions.attack}: ${t.campaign.victory_title}`;
    else if (log.messageKey === 'log_battle_loss') msg = `${t.common.actions.attack}: ${t.campaign.defeat_title}`;
    else if (log.messageKey === 'log_wipeout') msg = `${t.reports.wipeout}`;
    else if (log.messageKey === 'log_defense_win') msg = `${t.common.ui.under_attack}: ${t.campaign.victory_title}`;
    else if (log.messageKey === 'log_defense_loss') msg = `${t.common.ui.under_attack}: ${t.campaign.defeat_title}`;
    else if (log.messageKey === 'log_desertion' && log.params) {
        const resList = (log.params.reasons || []).map((r: string) => t.common.resources[r]).join(', ');
        const def = UNIT_DEFS[log.params.unit as UnitType];
        const unitName = def ? (t.units[def.translationKey]?.name || log.params.unit) : log.params.unit;
        msg = `${t.reports.log_desertion} (${unitName} - ${resList})`;
    }
    else if (log.messageKey === 'log_intel_acquired') msg = t.reports.log_intel_acquired;
    else if (log.messageKey === 'log_war_started') msg = t.common.ui.log_war_declared;
    else if (log.messageKey === 'log_war_overtime') msg = t.common.ui.log_war_overtime;
    else if (log.messageKey === 'log_war_ended') msg = `${t.common.ui.log_war_ended}: ${log.params?.winner === 'PLAYER' ? t.features.war.you : t.features.war.enemy}`;
    else if (log.messageKey === 'log_grudge_planning') msg = t.common.ui.log_intel_revenge.replace('{attacker}', log.params?.attacker || 'Unknown');
    else if (log.messageKey === 'log_grudge_imminent') msg = t.common.ui.log_intel_fleet.replace('{attacker}', log.params?.attacker || 'Unknown');
    else if (log.messageKey === 'alert_incoming') msg = t.common.ui.alert_incoming;
    else if (log.type === 'research') {
        const name = t.techs[TECH_DEFS[log.messageKey as TechType]?.translationKey]?.name || log.messageKey;
        msg = `${t.common.actions.researched}: ${name}`;
    } else if (log.type === 'market') {
         msg = t.market.title;
    } else if (log.type === 'finance') {
        msg = log.messageKey.includes('deposit') ? t.common.actions.deposit : t.common.actions.withdraw;
    } else if (log.type === 'build') {
        msg = t.common.actions.construct;
    } else if (t.missions.patrol[log.messageKey as keyof typeof t.missions.patrol]) {
        msg = t.missions.patrol[log.messageKey as keyof typeof t.missions.patrol];
    } else if (t.errors[log.messageKey as keyof typeof t.errors]) {
        msg = t.errors[log.messageKey as keyof typeof t.errors];
    }

    const hasLoot = log.params?.loot && Object.keys(log.params.loot).length > 0;
    const hasCombatParams = !!log.params?.combatResult;
    const isTrade = log.type === 'market' && log.params?.type;
    const isIntel = log.type === 'intel';

    // --- Styling Logic (Differentiated) ---
    let styleClass = 'border-l-slate-500 bg-slate-900/40';
    let iconColor = 'text-slate-400';
    let iconSymbol = <Icons.Info />;

    if (log.type === 'combat') {
        if (isCampaign) {
            // Campaign Style (Blue/Cyan)
            styleClass = isAttackWin 
                ? 'border-l-cyan-500 bg-cyan-950/20 shadow-[inset_0_0_10px_rgba(6,182,212,0.1)]' 
                : 'border-l-cyan-800 bg-cyan-950/10';
            iconColor = 'text-cyan-400';
            iconSymbol = <Icons.Radar />; // Map icon
        } 
        else if (isPatrol) {
            // Patrol Style (Purple)
            styleClass = isAttackWin 
                ? 'border-l-purple-500 bg-purple-950/20' 
                : 'border-l-purple-800 bg-purple-950/10';
            iconColor = 'text-purple-400';
            iconSymbol = <Icons.Radar />;
        }
        else {
            // PvP / War / Defense (Red/Green/Orange)
            if (isAttackWin) {
                styleClass = 'border-l-emerald-500 bg-emerald-950/20';
                iconColor = 'text-emerald-400';
                iconSymbol = <Icons.Army />;
            } else if (isDefenseWin) {
                styleClass = 'border-l-green-500 bg-green-950/20';
                iconColor = 'text-green-400';
                iconSymbol = <Icons.Shield />;
            } else if (isDefenseLoss) {
                styleClass = 'border-l-red-600 bg-red-950/30';
                iconColor = 'text-red-500';
                iconSymbol = <Icons.Warning />;
            } else {
                styleClass = 'border-l-orange-500 bg-orange-950/20';
                iconColor = 'text-orange-400';
                iconSymbol = <Icons.Skull />;
            }
        }
    } else if (log.type === 'research') {
        styleClass = 'border-l-blue-500 bg-blue-950/10';
        iconSymbol = <Icons.Science />;
    } else if (log.type === 'finance' || log.type === 'economy') {
        styleClass = 'border-l-emerald-500 bg-emerald-950/10';
        iconSymbol = <Icons.Resources.Money />;
    } else if (log.type === 'market') {
        styleClass = 'border-l-yellow-500 bg-yellow-950/10';
        iconSymbol = <Icons.Resources.Gold />;
    } else if (log.type === 'intel') {
        styleClass = 'border-l-indigo-500 bg-indigo-950/20 border-indigo-500/50 shadow-[inset_0_0_10px_rgba(99,102,241,0.1)]';
        iconColor = 'text-indigo-400';
        iconSymbol = <Icons.Radar />;
    } else if (log.type === 'war') {
        styleClass = 'border-l-red-600 bg-red-950/40 border-red-500/50 animate-pulse';
        iconColor = 'text-red-500';
        iconSymbol = <Icons.Warning />;
    }

    return (
        <div className={`
            glass-panel p-3 rounded border-l-4 mb-2 transition-all group relative active:scale-[0.99]
            ${styleClass} ${isSelected ? 'ring-1 ring-white/20 bg-white/10' : ''}
        `}>
             <div className="flex items-start gap-3">
                 <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                     <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={() => onSelect(log.id)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-offset-0 focus:ring-0 cursor-pointer"
                     />
                 </div>

                 <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start mb-1">
                         <div className="flex flex-col min-w-0 pr-2">
                             <div className="flex items-center gap-2">
                                 <span className={`${iconColor} text-sm`}>
                                     {iconSymbol}
                                 </span>
                                 <span className={`font-bold text-sm whitespace-normal break-words leading-tight ${log.type === 'combat' ? 'text-white' : log.type === 'intel' ? 'text-indigo-200' : log.type === 'war' ? 'text-red-300' : 'text-slate-200'}`}>
                                     {msg}
                                 </span>
                             </div>
                             <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 ml-6">{new Date(log.timestamp).toLocaleString()}</span>
                         </div>
                         
                         <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                             {!log.archived ? (
                                <button onClick={(e) => { e.stopPropagation(); onArchive(log.id, true); }} className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-cyan-400 active:scale-90 transition-transform" title={t.common.actions.archive}>
                                    <div className="scale-75"><Icons.Settings /></div>
                                </button>
                             ) : (
                                <button onClick={(e) => { e.stopPropagation(); onArchive(log.id, false); }} className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-emerald-400 active:scale-90 transition-transform" title="Unarchive">
                                    <div className="scale-75 rotate-180"><Icons.Settings /></div>
                                </button>
                             )}
                             <button onClick={(e) => { e.stopPropagation(); onDelete(log.id); }} className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 active:scale-90 transition-transform" title={t.common.actions.delete}>
                                 <Icons.Close />
                             </button>
                         </div>
                     </div>
                     
                     <div className="space-y-2 mt-2 ml-6">
                        {isIntel && log.params && (
                            <div className="text-xs bg-indigo-950/40 rounded p-2 border border-indigo-500/20">
                                {log.messageKey === 'log_intel_acquired' ? (
                                    <>
                                        <div className="flex justify-between items-center mb-2 border-b border-indigo-500/20 pb-1">
                                            <span className="text-indigo-300 font-bold uppercase">{t.reports.intel_target}: {log.params.targetName}</span>
                                            <span className="font-mono text-indigo-400 text-[10px]">{t.reports.intel_strength}: {formatNumber(log.params.score)}</span>
                                        </div>
                                        
                                        <div className="space-y-1">
                                            <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">{t.reports.intel_composition}</div>
                                            <div className="flex flex-wrap gap-2">
                                                {log.params.units && Object.entries(log.params.units).map(([uType, count]) => {
                                                    const def = UNIT_DEFS[uType as UnitType];
                                                    const name = t.units[def?.translationKey]?.name || uType;
                                                    return (
                                                        <span key={uType} className="bg-black/30 px-2 py-1 rounded text-slate-300 border border-white/5 flex gap-1 items-center">
                                                            <span>{name}</span>
                                                            <span className="text-white font-bold">{count as number}</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {onSimulate && log.params.units && (
                                            <button
                                                onClick={() => onSimulate(log.params.units)}
                                                className="w-full mt-2 py-1.5 rounded border border-indigo-500/30 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98]"
                                            >
                                                <Icons.Simulate />
                                                {t.common.actions.simulate}
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-indigo-300 italic">{msg}</div>
                                )}
                            </div>
                        )}

                        {hasLoot && log.params?.loot && (
                            <div className={`p-2 rounded text-xs border ${isDefenseLoss ? 'bg-red-950/40 border-red-500/20' : 'bg-black/20 border-white/5'}`}>
                                <div className={`${isDefenseLoss ? 'text-red-400' : 'text-emerald-400'} font-bold mb-1 text-[10px] uppercase tracking-wider`}>
                                    {isDefenseLoss ? t.reports.details_stolen : isCampaign ? t.campaign.rewards : t.reports.details_loot}
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {Object.entries(log.params.loot).map(([k,v]) => (
                                        <span key={k} className={`px-2 py-1 rounded border text-[10px] font-mono font-bold flex items-center gap-1 ${isDefenseLoss ? 'text-red-300 border-red-500/30 bg-red-950/20' : 'text-slate-300 border-emerald-500/10 bg-black/40'}`}>
                                            {getResourceIcon(k)}
                                            <span>{isDefenseLoss ? '-' : '+'}{formatNumber(v as number)}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {hasCombatParams && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onViewDetails(log); }}
                                className={`w-full mt-2 py-2 rounded border text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 active:scale-[0.98]
                                ${isDefenseLoss ? 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30' : 
                                  isDefenseWin ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20' :
                                  isCampaign ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20' :
                                  isPatrol ? 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20' :
                                  isAttackWin ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20' :
                                  'bg-orange-500/10 border-orange-500/30 text-orange-300 hover:bg-orange-500/20'}`}
                            >
                                <Icons.Report />
                                {t.reports.view_report}
                            </button>
                        )}

                        {isTrade && log.params && (
                            <div className="text-xs font-mono text-orange-300 flex items-center gap-2">
                                {log.params.type === 'BUY' ? t.market.offer_buy : t.market.offer_sell} {formatNumber(log.params.amount)}
                                {getResourceIcon(log.params.resource)}
                            </div>
                        )}
                        
                        {log.type === 'war' && log.params?.result && (
                             <div className="text-xs text-red-200 bg-red-900/20 p-2 rounded border border-red-500/20">
                                 {log.params.result}
                                 {log.params.warSummary && (
                                     <button 
                                        onClick={(e) => { e.stopPropagation(); onViewDetails(log); }}
                                        className="block mt-2 text-[10px] text-red-400 underline uppercase tracking-widest hover:text-white"
                                     >
                                         {t.features.war.losses_report}
                                     </button>
                                 )}
                             </div>
                        )}
                     </div>
                 </div>
             </div>
        </div>
    );
});
