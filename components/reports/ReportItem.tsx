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

export const ReportItem: React.FC<ReportItemProps> = React.memo(({ log, isSelected, onSelect: _onSelect, onDelete, onArchive, onViewDetails, onSimulate, t }) => {
    const isCampaign = log.type === 'combat' && log.params?.targetName?.startsWith('OP-');
    const isPatrol = log.messageKey.includes('patrol');

    const isDefenseLoss = log.messageKey === 'log_defense_loss';
    const isDefenseWin = log.messageKey === 'log_defense_win';
    const isAttackWin = log.messageKey === 'log_battle_win' || log.messageKey.includes('patrol_battle_win') || log.messageKey.includes('patrol_contraband');
    
    let msg = log.messageKey;
    
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
    else if (log.messageKey === 'log_grudge_planning') msg = t.common.ui.log_grudge_planning.replace('{attacker}', log.params?.attacker || 'Unknown');
    else if (log.messageKey === 'log_grudge_imminent') msg = t.common.ui.log_grudge_imminent.replace('{attacker}', log.params?.attacker || 'Unknown');
    else if (log.messageKey === 'alert_incoming') msg = t.common.ui.alert_incoming;
    else if (log.messageKey === 'log_grudge_created' && log.params) msg = t.common.ui.log_grudge_created.replace('{attacker}', log.params.attacker || 'Unknown').replace('{retaliationTime}', log.params.retaliationTime || '?');
    else if (log.messageKey === 'log_grudge_decayed') msg = t.common.ui.log_grudge_decayed.replace('{attacker}', log.params?.attacker || 'Unknown');
    else if (log.messageKey === 'log_grudge_forgiven') msg = t.common.ui.log_grudge_forgiven.replace('{attacker}', log.params?.attacker || 'Unknown');
    else if (log.messageKey === 'log_enemy_attack' && log.params) msg = t.common.ui.log_enemy_attack.replace('{attacker}', log.params.attacker || 'Unknown').replace('{reputation}', log.params.reputation || '?');
    else if (log.messageKey === 'log_attack_reset') msg = t.common.ui.log_attack_reset;
    else if (log.messageKey === 'log_ally_reinforcement') msg = t.common.ui.log_ally_reinforcement.replace('{allyName}', log.params?.allyName || 'Unknown');
    else if (log.messageKey === 'log_new_ally') msg = t.common.ui.log_new_ally;
    else if (log.messageKey === 'war_system_error') msg = t.common.ui.war_system_error;
    else if (log.type === 'research') {
        const name = t.techs[TECH_DEFS[log.messageKey as TechType]?.translationKey ?? '']?.name || log.messageKey;
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
    const hasBuildingLoot = log.params?.buildingLoot && Object.keys(log.params.buildingLoot).length > 0;
    
    const hasCombatParams = !!log.params?.combatResult;
    const isTrade = log.type === 'market' && log.params?.type;
    const isIntel = log.type === 'intel';

    let styleClass = 'bg-slate-900/40 border-white/10 border-l-slate-500';
    let iconColor = 'text-slate-400 bg-slate-800/50 border-slate-600';
    let iconSymbol = <Icons.Info />;
    let typeLabel = t.common.ui.tactical_op;

    if (log.type === 'combat') {
        if (isCampaign) {
            typeLabel = t.common.ui.mission_type_campaign || 'Campaign Mission';
            styleClass = isAttackWin 
                ? 'bg-gradient-to-r from-cyan-950/40 to-slate-900/80 border-cyan-500/30 border-l-cyan-500' 
                : 'bg-gradient-to-r from-slate-800/40 to-slate-900/80 border-cyan-800/30 border-l-cyan-800';
            iconColor = 'text-cyan-400 bg-cyan-950/50 border-cyan-500/30';
            iconSymbol = <Icons.Radar />;
        } 
        else if (isPatrol) {
            typeLabel = t.common.ui.mission_type_patrol || 'Sector Patrol';
            styleClass = isAttackWin 
                ? 'bg-gradient-to-r from-purple-950/40 to-slate-900/80 border-purple-500/30 border-l-purple-500' 
                : 'bg-gradient-to-r from-purple-950/10 to-slate-900/80 border-purple-800/30 border-l-purple-800';
            iconColor = 'text-purple-400 bg-purple-950/50 border-purple-500/30';
            iconSymbol = <Icons.Radar />;
        }
        else {
            typeLabel = t.common.ui.mission_type_tactical || 'Tactical Engagement';
            if (isAttackWin) {
                styleClass = 'bg-gradient-to-r from-emerald-950/40 to-slate-900/80 border-emerald-500/30 border-l-emerald-500';
                iconColor = 'text-emerald-400 bg-emerald-950/50 border-emerald-500/30';
                iconSymbol = <Icons.Army />;
            } else if (isDefenseWin) {
                styleClass = 'bg-gradient-to-r from-emerald-950/40 to-slate-900/80 border-emerald-500/30 border-l-emerald-500';
                iconColor = 'text-emerald-400 bg-emerald-950/50 border-emerald-500/30';
                iconSymbol = <Icons.Shield />;
            } else if (isDefenseLoss) {
                styleClass = 'bg-gradient-to-r from-red-950/40 to-slate-900/80 border-red-500/30 border-l-red-500';
                iconColor = 'text-red-400 bg-red-950/50 border-red-500/30';
                iconSymbol = <Icons.Warning />;
            } else {
                styleClass = 'bg-gradient-to-r from-orange-950/40 to-slate-900/80 border-orange-500/30 border-l-orange-500';
                iconColor = 'text-orange-400 bg-orange-950/50 border-orange-500/30';
                iconSymbol = <Icons.Skull />;
            }
        }
    } else if (log.type === 'research') {
        typeLabel = t.common.ui.nav_research;
        styleClass = 'bg-gradient-to-r from-blue-950/40 to-slate-900/80 border-blue-500/30 border-l-blue-500';
        iconColor = 'text-blue-400 bg-blue-950/50 border-blue-500/30';
        iconSymbol = <Icons.Science />;
    } else if (log.type === 'finance' || log.type === 'economy') {
        typeLabel = t.common.ui.nav_economy;
        styleClass = 'bg-gradient-to-r from-emerald-950/20 to-slate-900/80 border-emerald-500/20 border-l-emerald-500';
        iconColor = 'text-emerald-400 bg-emerald-950/50 border-emerald-500/30';
        iconSymbol = <Icons.Resources.Money />;
    } else if (log.type === 'market') {
        typeLabel = t.common.ui.nav_market;
        styleClass = 'bg-gradient-to-r from-yellow-950/20 to-slate-900/80 border-yellow-500/20 border-l-yellow-500';
        iconColor = 'text-yellow-400 bg-yellow-950/50 border-yellow-500/30';
        iconSymbol = <Icons.Resources.Gold />;
    } else if (log.type === 'intel') {
        typeLabel = t.common.ui.nav_intel;
        styleClass = 'bg-gradient-to-r from-indigo-950/40 to-slate-900/80 border-indigo-500/40 border-l-indigo-500';
        iconColor = 'text-indigo-400 bg-indigo-950/50 border-indigo-500/30';
        iconSymbol = <Icons.Radar />;
    } else if (log.type === 'war') {
        typeLabel = t.common.war.title;
        styleClass = 'bg-gradient-to-r from-red-900/50 to-slate-900/80 border-red-500/50 border-l-red-600 animate-pulse';
        iconColor = 'text-red-300 bg-red-950/50 border-red-500/50';
        iconSymbol = <Icons.Warning />;
    }

    return (
        <div className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border-y border-r border-l-[3px] transition-all duration-200 group relative flex items-start gap-3 active:scale-[0.99] ${styleClass} ${isSelected ? 'ring-2 ring-cyan-500 bg-cyan-900/10' : ''}`}>
             <div className="flex flex-col items-center justify-start pt-0.5" onClick={(e) => e.stopPropagation()}>
                 <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${isSelected ? 'bg-cyan-500 border-cyan-400 text-black' : 'bg-black/40 border-white/20'}`}>
                     {isSelected && <Icons.Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                 </div>
             </div>

             <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-start gap-2 mb-1.5 sm:mb-2">
                     <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                         <div className={`p-2 rounded-lg border ${iconColor} shadow-inner flex items-center justify-center shrink-0`}>
                             {iconSymbol}
                         </div>
                         <div className="flex flex-col min-w-0">
                             <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase tracking-widest font-bold">{typeLabel}</span>
                             <span className={`font-tech font-bold text-xs sm:text-sm leading-tight break-words ${log.type === 'combat' ? 'text-white' : log.type === 'intel' ? 'text-indigo-200' : log.type === 'war' ? 'text-red-300' : 'text-slate-200'}`}>
                                 {msg}
                             </span>
                         </div>
                     </div>
                     
                     <div className="flex flex-col items-end shrink-0 gap-1 sm:gap-2">
                         <span className="text-[9px] sm:text-[10px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                         <div className="flex gap-0.5 sm:gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                             {!log.archived ? (
                                <button onClick={(e) => { e.stopPropagation(); onArchive(log.id, true); }} className="p-1 sm:p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-cyan-400 transition-colors" title={t.common.actions.archive}>
                                    <Icons.Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                             ) : (
                                <button onClick={(e) => { e.stopPropagation(); onArchive(log.id, false); }} className="p-1 sm:p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-emerald-400 transition-colors" title={t.common.actions.unarchive}>
                                    <Icons.Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 rotate-180" />
                                </button>
                             )}
                             <button onClick={(e) => { e.stopPropagation(); onDelete(log.id); }} className="p-1 sm:p-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors" title={t.common.actions.delete}>
                                 <Icons.Close className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                             </button>
                         </div>
                     </div>
                 </div>
                 
                 <div className="space-y-2 mt-2 pl-0">
                     {isIntel && log.params && (
                         <div className="text-xs bg-indigo-950/40 rounded-lg p-2 sm:p-3 border border-indigo-500/20 shadow-inner">
                             {log.messageKey === 'log_intel_acquired' ? (
                                 <>
                                     <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 sm:mb-3 border-b border-indigo-500/20 pb-2 gap-1.5 sm:gap-2">
                                         <span className="text-indigo-300 font-bold uppercase tracking-widest text-[10px] sm:text-xs">{t.reports.intel_target}: {log.params.targetName}</span>
                                         <span className="font-mono text-indigo-400 text-[9px] sm:text-[10px] bg-indigo-900/30 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">{t.reports.intel_strength}: {formatNumber(log.params?.score ?? 0)}</span>
                                     </div>
                                     
                                     <div className="space-y-1.5 sm:space-y-2">
                                         <div className="text-[8px] sm:text-[9px] text-indigo-400/80 uppercase tracking-widest">{t.reports.intel_composition}</div>
                                         <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                             {log.params.units && Object.entries(log.params.units).map(([uType, count]) => {
                                                 const def = UNIT_DEFS[uType as UnitType];
                                                 const name = t.units[def?.translationKey]?.name || uType;
                                                 return (
                                                     <span key={uType} className="bg-black/40 px-2 py-1 rounded-md text-slate-300 border border-indigo-500/10 flex gap-1.5 items-center text-[9px] sm:text-[10px] font-bold">
                                                         <span className="truncate max-w-[60px] sm:max-w-none">{name}</span>
                                                         <span className="text-white font-mono">{count as number}</span>
                                                     </span>
                                                 );
                                             })}
                                         </div>
                                     </div>

                                     {onSimulate && log.params?.units && (
                                         <button
                                             onClick={() => onSimulate(log.params?.units ?? {})}
                                             className="w-full mt-2 sm:mt-3 py-1.5 sm:py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors text-[9px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98]"
                                         >
                                             <Icons.Simulate className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                             {t.common.actions.simulate}
                                         </button>
                                     )}
                                 </>
                             ) : (
                                 <div className="text-indigo-300 italic text-[10px] sm:text-xs">{msg}</div>
                             )}
                         </div>
                     )}

                     {hasBuildingLoot && (
                         <div className={`p-2 sm:p-3 rounded-lg text-[10px] sm:text-xs border ${isDefenseLoss ? 'bg-red-950/40 border-red-500/20' : 'bg-yellow-950/40 border-yellow-500/20'}`}>
                             <div className={`${isDefenseLoss ? 'text-red-400' : 'text-yellow-400'} font-bold mb-1.5 sm:mb-2 text-[9px] sm:text-[10px] uppercase tracking-wider`}>
                                 {isDefenseLoss ? t.reports.buildings_lost?.toUpperCase() || "BUILDINGS LOST" : t.reports.buildings_seized?.toUpperCase() || "BUILDINGS SEIZED"}
                             </div>
                             <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                                 {Object.entries(log.params?.buildingLoot ?? {}).map(([k,v]) => (
                                     <span key={k} className={`px-2 py-1 rounded-md border text-[9px] sm:text-[10px] font-mono font-bold flex items-center gap-1 ${isDefenseLoss ? 'text-red-300 border-red-500/30 bg-red-950/30' : 'text-yellow-300 border-yellow-500/30 bg-yellow-900/30'}`}>
                                         <Icons.Base className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                         <span>{isDefenseLoss ? '-' : '+'}{formatNumber(v as number)}</span>
                                     </span>
                                 ))}
                             </div>
                         </div>
                     )}

                     {hasLoot && log.params?.loot && (
                         <div className={`p-2 sm:p-3 rounded-lg text-[10px] sm:text-xs border ${isDefenseLoss ? 'bg-red-950/40 border-red-500/20' : 'bg-black/30 border-white/5'}`}>
                             <div className={`${isDefenseLoss ? 'text-red-400' : 'text-emerald-400'} font-bold mb-1.5 sm:mb-2 text-[9px] sm:text-[10px] uppercase tracking-wider`}>
                                 {isDefenseLoss ? t.reports.details_stolen : isCampaign ? t.campaign.rewards : t.reports.details_loot}
                             </div>
                             <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                                 {Object.entries(log.params.loot).map(([k,v]) => (
                                     <span key={k} className={`px-2 py-1 rounded-md border text-[9px] sm:text-[10px] font-mono font-bold flex items-center gap-1 ${isDefenseLoss ? 'text-red-300 border-red-500/30 bg-red-950/30' : 'text-slate-200 border-emerald-500/20 bg-emerald-950/20'}`}>
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
                             className={`w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg border text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] shadow-md
                             ${isDefenseLoss ? 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30' : 
                               isDefenseWin ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/30' :
                               isCampaign ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 hover:bg-blue-500/30' :
                               isPatrol ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 hover:bg-purple-500/30' :
                               isAttackWin ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30' :
                               'bg-orange-500/20 border-orange-500/50 text-orange-300 hover:bg-orange-500/30'}`}
                         >
                             <Icons.Report className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                             {t.reports.view_report}
                         </button>
                     )}

                     {isTrade && log.params && (
                         <div className="text-[10px] sm:text-xs font-mono font-bold text-orange-300 flex items-center gap-1.5 sm:gap-2 bg-orange-950/20 p-1.5 sm:p-2 rounded-md border border-orange-500/20 w-max">
                             {log.params.type === 'BUY' ? t.market.offer_buy : t.market.offer_sell} {formatNumber(log.params.amount ?? 0)}
                             {getResourceIcon(log.params.resource ?? '')}
                         </div>
                     )}
                     
                     {log.type === 'war' && log.params?.result && (
                          <div className="text-[10px] sm:text-xs text-red-200 bg-red-950/40 p-2 sm:p-3 rounded-lg border border-red-500/30">
                              {log.params.result}
                              {log.params.warSummary && (
                                  <button 
                                     onClick={(e) => { e.stopPropagation(); onViewDetails(log); }}
                                     className="flex items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3 text-[9px] sm:text-[10px] text-red-400 hover:text-white font-bold uppercase tracking-widest bg-red-900/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border border-red-500/20 transition-colors w-max"
                                  >
                                      <Icons.Report className="w-3 h-3" /> {t.features.war.losses_report}
                                  </button>
                              )}
                          </div>
                     )}
                 </div>
             </div>
        </div>
    );
});