
import React, { useState, useMemo } from 'react';
import { LogEntry, UnitType } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { Icons } from '../UIComponents';
import { FilterType, FilterTab } from '../reports/FilterTab';
import { ReportItem } from '../reports/ReportItem';
import { CombatReportModal, CombatReportContent } from '../reports/CombatReportModal';

interface ReportsViewProps {
    logs: LogEntry[];
    onDelete: (ids: string[]) => void;
    onArchive: (ids: string[], archive: boolean) => void;
    onSimulate?: (enemyUnits: Partial<Record<UnitType, number>>) => void;
}

const ITEMS_PER_PAGE = 20;

export const ReportsView: React.FC<ReportsViewProps> = ({ logs, onDelete, onArchive, onSimulate }) => {
     const { t } = useLanguage();
     
     const [activeTab, setActiveTab] = useState<FilterType>('all');
     const [searchQuery, setSearchQuery] = useState('');
     const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
     const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
     const [currentPage, setCurrentPage] = useState(1);

     // --- FILTER LOGIC ---
     const filteredLogs = useMemo(() => {
         const filtered = logs.filter(log => {
             // 1. GLOBAL FILTER: Only Combat, Missions, and Intel allowed
             if (log.type !== 'combat' && log.type !== 'mission' && log.type !== 'intel' && log.type !== 'war') return false;

             // 2. Tab Filter
             if (activeTab === 'archived') {
                 if (!log.archived) return false;
             } else {
                 if (log.archived) return false; 
                 // 'all' now implies 'Inbox' (Combat + Missions + Intel)
                 if (activeTab === 'combat') {
                     if (log.type !== 'combat' && log.type !== 'intel' && log.type !== 'war') return false;
                 }
             }

             // 3. Search Filter
             if (searchQuery) {
                 const searchLower = searchQuery.toLowerCase();
                 if (log.messageKey.toLowerCase().includes(searchLower)) return true;
                 if (log.params && JSON.stringify(log.params).toLowerCase().includes(searchLower)) return true;
                 return false;
             }
             
             return true;
         });
         
         // 4. SORT: Newest first (Descending timestamp)
         return filtered.sort((a, b) => b.timestamp - a.timestamp);
     }, [logs, activeTab, searchQuery]);

     // --- PAGINATION LOGIC ---
     const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
     const paginatedLogs = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredLogs.slice(start, start + ITEMS_PER_PAGE);
     }, [filteredLogs, currentPage]);

     // Auto-select first log on desktop if none selected
     React.useEffect(() => {
        const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
        if (isDesktop && !selectedLog && paginatedLogs.length > 0) {
            setSelectedLog(paginatedLogs[0]);
        }
     }, [paginatedLogs, selectedLog]);

     React.useEffect(() => {
        setCurrentPage(1);
        setSelectedIds(new Set());
     }, [activeTab, searchQuery]);

     // --- ACTIONS ---
     const handleSelect = React.useCallback((id: string) => {
         setSelectedIds(prev => {
             const newSet = new Set(prev);
             if (newSet.has(id)) newSet.delete(id);
             else newSet.add(id);
             return newSet;
         });
     }, []);

     const areAllSelected = filteredLogs.length > 0 && filteredLogs.every(l => selectedIds.has(l.id));

     const handleSelectAll = () => {
         if (areAllSelected) {
             setSelectedIds(new Set());
         } else {
             const newSet = new Set(filteredLogs.map(l => l.id));
             setSelectedIds(newSet);
         }
     };

     const handleBulkDelete = () => {
         const idsToDelete = Array.from(selectedIds);
         if (idsToDelete.length === 0) return;
         
         // If selected log is deleted, clear it
         if (selectedLog && idsToDelete.includes(selectedLog.id)) {
             setSelectedLog(null);
         }

         onDelete(idsToDelete);
         setSelectedIds(new Set());
     };

     const handleBulkArchive = (archive: boolean) => {
         const idsToMod = Array.from(selectedIds);
         if (idsToMod.length === 0) return;
         onArchive(idsToMod, archive);
         setSelectedIds(new Set());
     };

     const singleDelete = React.useCallback((id: string) => {
         if (selectedLog?.id === id) setSelectedLog(null);
         onDelete([id]);
     }, [onDelete, selectedLog]);

     const singleArchive = React.useCallback((id: string, state: boolean) => {
         onArchive([id], state);
         if (selectedLog?.id === id) setSelectedLog(null); // Will likely filter out
     }, [onArchive, selectedLog]);

     const hasSelection = selectedIds.size > 0;

     return (
         <div className="flex h-full animate-[fadeIn_0.3s_ease-out] gap-4">
             
             <div className={`md:hidden`}>
                {selectedLog && (
                    <CombatReportModal log={selectedLog} onClose={() => setSelectedLog(null)} t={t} />
                )}
             </div>

             {/* LEFT COLUMN: LIST */}
             <div className="flex-1 flex flex-col min-w-0 glass-panel border border-white/10 rounded-xl overflow-hidden h-full">
                 {/* TOP BAR: TABS */}
                 <div className="bg-slate-900/95 backdrop-blur-md border-b border-white/10 shrink-0">
                     <div className="flex overflow-x-auto no-scrollbar mask-image-sides px-2 pt-2">
                         <FilterTab id="all" label={t.reports.filter_all} current={activeTab} onClick={setActiveTab} />
                         <FilterTab id="combat" label={t.reports.filter_military} current={activeTab} onClick={setActiveTab} />
                         <div className="w-px h-6 bg-white/10 mx-2 self-center"></div>
                         <FilterTab id="archived" label={t.reports.filter_archived} current={activeTab} onClick={setActiveTab} icon={<div className="scale-75"><Icons.Settings /></div>} />
                     </div>

                     {/* SUB BAR: SEARCH & TOOLS */}
                     <div className="p-2 flex gap-2 items-center justify-between">
                         <div className="relative flex-1 max-w-xs">
                             <input 
                                type="text" 
                                placeholder={t.common.ui.search}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-full py-1.5 pl-4 pr-4 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                             />
                         </div>
                         
                         <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-full border border-white/5 select-none">
                            <input 
                                type="checkbox"
                                checked={areAllSelected}
                                onChange={handleSelectAll}
                                className="w-3 h-3 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-offset-0 focus:ring-0 cursor-pointer accent-cyan-500"
                            />
                            <span className="hidden sm:inline font-bold uppercase tracking-wider text-[10px]">{t.common.actions.select_all}</span>
                         </label>
                     </div>
                 </div>

                 {/* MAIN CONTENT LIST */}
                 <div className="flex-1 overflow-y-auto p-2 custom-scrollbar flex flex-col bg-slate-900/40">
                     {paginatedLogs.length === 0 ? (
                         <div className="flex flex-col items-center justify-center flex-1 text-slate-600 opacity-60 min-h-[200px]">
                             <div className="w-16 h-16 mb-4 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 border-dashed">
                                 <Icons.Report />
                             </div>
                             <p className="text-sm uppercase tracking-widest font-bold">
                                 {activeTab === 'archived' ? t.reports.empty_archive : t.reports.empty_inbox}
                             </p>
                             {searchQuery && <p className="text-xs mt-2 text-slate-500">{t.common.ui.no_results}</p>}
                         </div>
                     ) : (
                         <div className="space-y-1 flex-1">
                             {paginatedLogs.map(log => (
                                 <div 
                                    key={log.id} 
                                    onClick={() => setSelectedLog(log)} // Desktop click
                                    className={`cursor-pointer transition-colors rounded ${selectedLog?.id === log.id ? 'bg-white/5 ring-1 ring-cyan-500/30' : ''}`}
                                 >
                                     <ReportItem 
                                        log={log} 
                                        isSelected={selectedIds.has(log.id)}
                                        onSelect={handleSelect}
                                        onDelete={singleDelete}
                                        onArchive={singleArchive}
                                        onViewDetails={setSelectedLog}
                                        onSimulate={onSimulate}
                                        t={t}
                                     />
                                 </div>
                             ))}
                         </div>
                     )}
                     
                     {/* Pagination */}
                     {totalPages > 1 && (
                         <div className="flex justify-center items-center gap-4 py-4 mt-2 shrink-0 border-t border-white/5">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setCurrentPage(p => Math.max(1, p - 1)); }}
                                disabled={currentPage === 1}
                                className="w-8 h-8 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10"
                            >
                                <Icons.ChevronLeft />
                            </button>
                            <span className="text-xs font-mono text-slate-400">
                                {t.common.ui.page} <span className="text-cyan-400 font-bold">{currentPage}</span> / {totalPages}
                            </span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setCurrentPage(p => Math.min(totalPages, p + 1)); }}
                                disabled={currentPage === totalPages}
                                className="w-8 h-8 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10"
                            >
                                <Icons.ChevronRight />
                            </button>
                         </div>
                     )}
                     <div className="h-24 shrink-0 md:hidden"></div>
                 </div>
             </div>

             {/* RIGHT COLUMN: PREVIEW (DESKTOP ONLY) */}
             <div className="hidden lg:flex w-1/2 xl:w-3/5 glass-panel border border-white/10 rounded-xl overflow-hidden h-full flex-col bg-black/20">
                 {selectedLog ? (
                     <CombatReportContent log={selectedLog} t={t} embedded={true} />
                 ) : (
                     <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                         <Icons.Report />
                         <p className="mt-4 text-sm uppercase tracking-widest">Select a report to view details</p>
                     </div>
                 )}
             </div>

             {/* FLOATING ACTION BAR */}
             <div className={`
                absolute md:bottom-6 bottom-20 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-slate-800/95 backdrop-blur-xl border border-white/20 p-2 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex justify-between items-center transition-all duration-300 z-[70]
                ${hasSelection ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-20 opacity-0 pointer-events-none'}
             `}>
                 <div className="text-xs font-bold text-white ml-3 flex items-center gap-2">
                     <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                     <span className="font-mono">{selectedIds.size}</span> Selected
                 </div>
                 <div className="flex gap-2">
                     {activeTab === 'archived' ? (
                         <button onClick={() => handleBulkArchive(false)} className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-xs text-white transition-colors font-bold uppercase tracking-wider">
                             Unarchive
                         </button>
                     ) : (
                        <button onClick={() => handleBulkArchive(true)} className="flex items-center gap-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 px-3 py-2 rounded-lg text-xs text-cyan-300 transition-colors font-bold uppercase tracking-wider">
                             {t.common.actions.archive}
                         </button>
                     )}
                     
                     <button onClick={handleBulkDelete} className="flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 px-3 py-2 rounded-lg text-xs text-red-300 transition-colors font-bold uppercase tracking-wider">
                         {t.common.actions.delete}
                     </button>
                 </div>
             </div>
         </div>
     )
};
