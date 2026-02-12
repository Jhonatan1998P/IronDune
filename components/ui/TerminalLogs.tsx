
import React, { useEffect, useRef, useState } from 'react';
import { LogEntry } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { Icons } from '../UIComponents';

export const TerminalLogs: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
    const { t } = useLanguage();
    const [isExpanded, setIsExpanded] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const endRef = useRef<HTMLDivElement>(null);

    // Filter to last 50 for the expanded view, last 1 for collapsed
    const historyLogs = logs.slice(0, 50).reverse(); // Newest at bottom
    const latestLog = logs[0];

    // Auto-scroll to bottom when logs update and expanded
    useEffect(() => {
        if (isExpanded && endRef.current) {
            endRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isExpanded]);

    const toggleExpand = () => setIsExpanded(!isExpanded);

    const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const getTypeColor = (type: LogEntry['type']) => {
        switch (type) {
            case 'combat': return 'text-red-400';
            case 'war': return 'text-red-500 font-bold';
            case 'market': return 'text-yellow-400';
            case 'research': return 'text-cyan-400';
            case 'economy': return 'text-emerald-400';
            case 'intel': return 'text-indigo-400';
            default: return 'text-slate-400';
        }
    };

    return (
        <div 
            className={`hidden lg:flex fixed bottom-0 left-64 right-0 xl:right-80 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 z-50 flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-all duration-300 ease-out font-mono text-[10px] ${isExpanded ? 'h-72 border-cyan-500/30' : 'h-8 hover:bg-slate-900'}`}
        >
            {/* Header / Collapsed View */}
            <div 
                onClick={toggleExpand}
                className="flex items-center h-8 shrink-0 px-4 cursor-pointer w-full hover:bg-white/5 transition-colors relative group"
            >
                {/* Decoration */}
                <div className="absolute top-0 left-0 h-full w-1 bg-cyan-500/50 group-hover:bg-cyan-400 transition-colors"></div>

                <div className="flex items-center gap-2 text-cyan-500/70 uppercase tracking-widest shrink-0 border-r border-white/10 pr-4 mr-4 select-none">
                    <div className={`w-2 h-2 rounded-sm bg-cyan-500 ${isExpanded ? 'animate-none' : 'animate-pulse'}`}></div>
                    {t.common.ui.console}
                </div>

                {/* Content (Changes based on state) */}
                <div className="flex-1 flex justify-between items-center overflow-hidden">
                    {!isExpanded ? (
                        latestLog ? (
                            <div className="flex items-center gap-3 animate-[fadeIn_0.3s_ease-out]">
                                <span className="text-slate-600">[{formatTime(latestLog.timestamp)}]</span>
                                <span className={`${getTypeColor(latestLog.type)} uppercase tracking-wide truncate`}>
                                    {latestLog.messageKey.replace(/_/g, ' ')}
                                </span>
                                {latestLog.type === 'combat' && <span className="text-red-500 text-[8px] border border-red-900 px-1 rounded bg-red-950/30">ALERT</span>}
                            </div>
                        ) : (
                            <span className="text-slate-600 italic">{t.common.ui.sys_ready}</span>
                        )
                    ) : (
                        <span className="text-slate-500 uppercase tracking-wider">{t.common.ui.cmd_history} ({logs.length})</span>
                    )}

                    {/* Toggle Icon */}
                    <div className={`text-slate-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                        <Icons.ChevronUp />
                    </div>
                </div>
            </div>

            {/* Expanded List */}
            {isExpanded && (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-black/40 shadow-inner">
                    <div className="flex flex-col justify-end min-h-full">
                        {historyLogs.map((log) => (
                            <div key={log.id} className="flex gap-3 px-2 py-0.5 hover:bg-white/5 rounded w-full">
                                <span className="text-slate-600 min-w-[50px]">[{formatTime(log.timestamp)}]</span>
                                <span className="text-slate-500 min-w-[60px] uppercase text-right mr-2">[{log.type}]</span>
                                <span className={`${getTypeColor(log.type)} flex-1 break-words`}>
                                    {`> ${log.messageKey.replace(/_/g, ' ')}`}
                                </span>
                            </div>
                        ))}
                        <div ref={endRef} />
                        {/* Fake cursor at bottom */}
                        <div className="px-2 py-0.5 text-cyan-500 animate-pulse font-bold">>_</div>
                    </div>
                </div>
            )}
        </div>
    );
};
