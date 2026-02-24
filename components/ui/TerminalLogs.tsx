import React, { useState } from 'react';
import { LogEntry, BuildingType, TechType, UnitType } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { Icons } from '../UIComponents';
import { BUILDING_DEFS } from '../../data/buildings';
import { TECH_DEFS } from '../../data/techs';
import { UNIT_DEFS } from '../../data/units';

export const TerminalLogs: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
    const { t } = useLanguage();
    const [isExpanded, setIsExpanded] = useState(false);

    // Limit to 50 logs to prevent DOM bloat
    const historyLogs = logs.slice(0, 50);

    const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const getTypeColor = (type: LogEntry['type']) => {
        switch (type) {
            case 'combat': return 'text-red-400';
            case 'war': return 'text-red-500 font-bold';
            case 'market': return 'text-yellow-400';
            case 'research': return 'text-purple-400';
            case 'economy': return 'text-emerald-400';
            case 'intel': return 'text-indigo-400';
            case 'build': return 'text-cyan-400';
            default: return 'text-slate-400';
        }
    };

    const getLogMessage = (log: LogEntry) => {
        const { messageKey, params, type } = log;
        
        // Explicit Overrides for hardcoded system keys
        if (messageKey === 'log_battle_win') return `${t.common.actions.attack} - ${t.campaign.victory_title}`;
        if (messageKey === 'log_battle_loss') return `${t.common.actions.attack} - ${t.campaign.defeat_title}`;
        if (messageKey === 'log_wipeout') return t.reports.wipeout;
        if (messageKey === 'log_defense_win') return t.common.ui.log_defense_win;
        if (messageKey === 'log_defense_loss') return t.common.ui.log_defense_loss;
        if (messageKey === 'log_intel_acquired') return t.reports.log_intel_acquired;
        
        if (messageKey === 'log_grudge_planning') return t.common.ui.log_intel_revenge.replace('{attacker}', params?.attacker || 'Unknown');
        if (messageKey === 'log_grudge_imminent') return t.common.ui.log_intel_fleet.replace('{attacker}', params?.attacker || 'Unknown');
        if (messageKey === 'alert_incoming') return `${t.common.ui.alert_incoming} (${params?.attacker || 'Unknown'})`;
        
        if (messageKey === 'log_desertion' && params) {
            const resList = (params.reasons || []).map((r: string) => t.common.resources[r]).join(', ');
            const def = UNIT_DEFS[params.unit as UnitType];
            const unitName = def ? (t.units[def.translationKey]?.name || params.unit) : params.unit;
            return `${t.reports.log_desertion} (${unitName} - ${resList})`;
        }

        if (messageKey === 'log_war_ended') {
            const winnerStr = params?.winner === 'PLAYER' ? t.features.war.you : t.features.war.enemy;
            return `${t.common.ui.log_war_ended}: ${winnerStr}`;
        }

        if (messageKey === 'status_repaired' && params?.building) {
            const bName = t.buildings[BUILDING_DEFS[params.building as BuildingType]?.translationKey]?.name || params.building;
            return `${t.common.actions.repair}: ${bName}`;
        }

        if (type === 'market') return t.market.title;
        
        if (type === 'research') {
            const tName = t.techs[TECH_DEFS[messageKey as TechType]?.translationKey ?? '']?.name || messageKey;
            return `${t.common.actions.researched}: ${tName}`;
        }

        // Fallbacks to dictionaries
        if (t.common.ui[messageKey as keyof typeof t.common.ui]) return t.common.ui[messageKey as keyof typeof t.common.ui];
        if (t.reports[messageKey as keyof typeof t.reports]) return t.reports[messageKey as keyof typeof t.reports];
        if (t.missions.patrol[messageKey as keyof typeof t.missions.patrol]) return t.missions.patrol[messageKey as keyof typeof t.missions.patrol];
        if (t.errors[messageKey as keyof typeof t.errors]) return t.errors[messageKey as keyof typeof t.errors];

        return messageKey.replace(/_/g, ' ').toUpperCase();
    };

    return (
        <div className="w-full bg-slate-950/80 rounded-xl overflow-hidden shadow-lg border border-white/5 flex flex-col font-mono mt-4">
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                className="bg-black/40 p-3 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
            >
                <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                    <Icons.Terminal className="w-4 h-4 text-cyan-500" />
                    <span>{t.common.actions.sys_console || 'SYS.CONSOLE'}</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-slate-500">
                    <span>{logs.length}</span>
                    <Icons.ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isExpanded && (
                <div className="p-2 max-h-[300px] overflow-y-auto custom-scrollbar bg-black/60 flex flex-col space-y-1">
                    {historyLogs.length === 0 && (
                        <div className="text-slate-600 text-[10px] italic p-2 text-center">{t.common.ui.sys_ready}</div>
                    )}
                    {historyLogs.map((log) => (
                        <div key={log.id} className="flex gap-2 p-1.5 hover:bg-white/5 rounded transition-colors text-[10px] leading-tight">
                            <span className="text-slate-500 shrink-0">[{formatTime(log.timestamp)}]</span>
                            <span className={`${getTypeColor(log.type)} break-words`}>
                                {getLogMessage(log)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};