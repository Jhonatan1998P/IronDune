import React, { useState, useMemo, useEffect } from 'react';
import { LogEntry, UnitType } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useGame } from '../../context/GameContext';
import { Icons } from '../UIComponents';
import { FilterType, FilterTab } from '../reports/FilterTab';
import { ReportItem } from '../reports/ReportItem';
import { CombatReportModal, CombatReportContent } from '../reports/CombatReportModal';

// ============================================
// TYPES & CONFIG
// ============================================
interface ReportsViewProps {
    logs: LogEntry[];
    onDelete: (ids: string[]) => void;
    onArchive: (ids: string[], archive: boolean) => void;
    onSimulate?: (enemyUnits: Partial<Record<UnitType, number>>, playerUnits: Partial<Record<UnitType, number>>) => void;
}

const ITEMS_PER_PAGE = 15;

// ============================================
// MAIN COMPONENT
// ============================================
export const ReportsView: React.FC<ReportsViewProps> = ({ logs, onDelete, onArchive, onSimulate }) => {
    const { t } = useLanguage();
    const { gameState } = useGame();

    // -- State: Filtros y navegación --
    const [activeTab, setActiveTab] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // -- State: Selección de informes --
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

    // -- State: Responsive --
    const [isMobile, setIsMobile] = useState(false);

    // ============================================
    // EFFECTS
    // ============================================
    // Detectar dispositivo móvil
    useEffect(() => {
        const checkDevice = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkDevice();
        window.addEventListener('resize', checkDevice);
        return () => window.removeEventListener('resize', checkDevice);
    }, []);

    // ============================================
    // FILTERING & PAGINATION
    // ============================================
    // Filtrar logs por tipo, pestaña activa y búsqueda
    const filteredLogs = useMemo(() => {
        const filtered = logs.filter(log => {
            // Solo mostrar tipos de logs relevantes
            if (log.type !== 'combat' && log.type !== 'mission' && log.type !== 'intel' && log.type !== 'war') return false;
            
            // Filtrar por archivados
            if (activeTab === 'archived') {
                if (!log.archived) return false;
            } else {
                if (log.archived) return false;
                // En pestaña combat, incluir intel y war
                if (activeTab === 'combat') {
                    if (log.type !== 'combat' && log.type !== 'intel' && log.type !== 'war') return false;
                }
            }
            
            // Búsqueda por texto
            if (searchQuery) {
                const searchLower = searchQuery.toLowerCase();
                if (log.messageKey.toLowerCase().includes(searchLower)) return true;
                if (log.params && JSON.stringify(log.params).toLowerCase().includes(searchLower)) return true;
                return false;
            }
            return true;
        });
        // Ordenar por fecha (más reciente primero)
        return filtered.sort((a, b) => b.timestamp - a.timestamp);
    }, [logs, activeTab, searchQuery]);

    // Calcular paginación
    const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
    const paginatedLogs = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredLogs.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredLogs, currentPage]);

    // Resetear página y selección al cambiar filtros
    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds(new Set());
        // No auto-select reports - let user choose which report to view
        if (!isMobile) {
            setSelectedLog(null);
        }
    }, [activeTab, searchQuery, isMobile]);

    // ============================================
    // HANDLERS: SELECCIÓN
    // ============================================
    // Seleccionar/deseleccionar informe individual
    const handleSelect = React.useCallback((id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    }, []);

    // Seleccionar todos los informes visibles
    const areAllSelected = filteredLogs.length > 0 && filteredLogs.every(l => selectedIds.has(l.id));

    const handleSelectAll = () => {
        if (areAllSelected) {
            setSelectedIds(new Set());
        } else {
            const newSet = new Set(filteredLogs.map(l => l.id));
            setSelectedIds(newSet);
        }
    };

    // ============================================
    // HANDLERS: ACCIONES BULK
    // ============================================
    // Eliminar múltiples informes seleccionados
    const handleBulkDelete = () => {
        const idsToDelete = Array.from(selectedIds);
        if (idsToDelete.length === 0) return;
        if (selectedLog && idsToDelete.includes(selectedLog.id)) {
            setSelectedLog(null);
        }
        onDelete(idsToDelete);
        setSelectedIds(new Set());
    };

    // Archivar/desarchivar múltiples informes
    const handleBulkArchive = (archive: boolean) => {
        const idsToMod = Array.from(selectedIds);
        if (idsToMod.length === 0) return;
        onArchive(idsToMod, archive);
        setSelectedIds(new Set());
    };

    // ============================================
    // HANDLERS: ACCIONES INDIVIDUALES
    // ============================================
    // Eliminar informe individual
    const singleDelete = React.useCallback((id: string) => {
        if (selectedLog?.id === id) setSelectedLog(null);
        onDelete([id]);
    }, [onDelete, selectedLog]);

    // Archivar informe individual
    const singleArchive = React.useCallback((id: string, state: boolean) => {
        onArchive([id], state);
        if (selectedLog?.id === id) setSelectedLog(null);
    }, [onArchive, selectedLog]);

    // Verificar si hay selección activa
    const hasSelection = selectedIds.size > 0;

    // ============================================
    // RENDER
    // ============================================
    return (
        <div className="flex flex-col w-full h-full min-h-0 min-w-0">
            {/* Mobile modal for viewing reports */}
            <div className="lg:hidden">
                {selectedLog && (
                    <CombatReportModal log={selectedLog} onClose={() => setSelectedLog(null)} t={t} />
                )}
            </div>

            {/* Main content container - full width on mobile, split on desktop */}
            <div className="flex flex-col lg:flex-row w-full gap-0 lg:gap-2 xl:gap-4">
                {/* Reports list panel */}
                <div className="flex flex-col min-w-0 glass-panel border border-white/10 rounded-none lg:rounded-lg xl:rounded-xl overflow-hidden flex-1 w-full h-full lg:max-h-full">
                    <div className="bg-slate-900/95 backdrop-blur-md border-b border-white/10 shrink-0 flex flex-col">
                        {/* Filter tabs */}
                        <div className="flex overflow-x-auto no-scrollbar px-1.5 pt-2 border-b border-white/5 -mx-1.5">
                            <FilterTab id="all" label={t.reports.filter_all} current={activeTab} onClick={setActiveTab} />
                            <FilterTab id="combat" label={t.reports.filter_military} current={activeTab} onClick={setActiveTab} />
                            <div className="w-px h-6 bg-white/10 mx-1 self-center shrink-0"></div>
                            <FilterTab id="archived" label={t.reports.filter_archived} current={activeTab} onClick={setActiveTab} icon={<Icons.Settings className="w-3 h-3" />} />
                        </div>

                        {/* Search and bulk actions bar */}
                        <div className="p-2 md:p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between border-b border-white/5 bg-black/20 shrink-0">
                            {hasSelection ? (
                                // Bulk action toolbar
                                <div className="flex-1 w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 animate-[fadeIn_0.2s_ease-out]">
                                    <div className="text-xs font-bold text-cyan-300 flex items-center gap-2 bg-cyan-950/40 px-3 py-2 sm:py-1.5 rounded-lg border border-cyan-500/30 w-fit">
                                        <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse shrink-0"></div>
                                        <span className="font-mono">{selectedIds.size}</span>
                                    </div>
                                    <div className="flex gap-1.5">
                                        {activeTab === 'archived' ? (
                                            <button onClick={() => handleBulkArchive(false)} className="flex items-center justify-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-2 sm:py-1.5 rounded-lg text-xs text-emerald-300 transition-colors font-bold uppercase tracking-wider shadow-sm active:scale-95">
                                                <Icons.Settings className="w-3.5 h-3.5" />
                                            </button>
                                        ) : (
                                            <button onClick={() => handleBulkArchive(true)} className="flex items-center justify-center gap-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 px-2.5 py-2 sm:py-1.5 rounded-lg text-xs text-cyan-300 transition-colors font-bold uppercase tracking-wider shadow-sm active:scale-95">
                                                <Icons.Settings className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button onClick={handleBulkDelete} className="flex items-center justify-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-2.5 py-2 sm:py-1.5 rounded-lg text-xs text-red-400 transition-colors font-bold uppercase tracking-wider shadow-sm active:scale-95">
                                            <Icons.Close className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                              ) : (
                                  // Search bar + select all checkbox
                                  <div className="relative flex-1 w-full flex items-center gap-2">
                                      <input
                                          type="text"
                                          placeholder={t.common.ui.search}
                                          value={searchQuery}
                                          onChange={(e) => setSearchQuery(e.target.value)}
                                          className="flex-1 bg-black/40 border border-white/10 rounded-lg py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-all font-mono shadow-inner min-h-[40px]"
                                      />
                                      <label className="flex items-center justify-center gap-1.5 text-xs text-slate-400 cursor-pointer hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2.5 py-2 rounded-lg border border-white/5 select-none shrink-0 shadow-sm active:scale-95 min-h-[40px]">
                                          <input
                                              type="checkbox"
                                              checked={areAllSelected}
                                              onChange={handleSelectAll}
                                              className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-offset-0 focus:ring-0 cursor-pointer accent-cyan-500"
                                          />
                                      </label>
                                  </div>
                              )}
                        </div>
                    </div>

                    {/* Scrollable content area */}
                    <div className="flex-1 overflow-y-auto p-2 md:p-3 flex flex-col bg-slate-900/40 min-h-0 lg:max-h-[calc(100vh-220px)] xl:max-h-[calc(100vh-240px)]">
                        {paginatedLogs.length === 0 ? (
                            // Empty state
                            <div className="flex flex-col items-center justify-center flex-1 text-slate-600 opacity-60 min-h-[200px]">
                                <div className="w-14 h-14 mb-3 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 border-dashed">
                                    <Icons.Report className="w-7 h-7" />
                                </div>
                                <p className="text-xs uppercase tracking-widest font-bold text-center px-4">
                                    {activeTab === 'archived' ? t.reports.empty_archive : t.reports.empty_inbox}
                                </p>
                                {searchQuery && <p className="text-xs mt-2 text-slate-500">{t.common.ui.no_results}</p>}
                            </div>
                        ) : (
                            // Reports list
                            <div className="space-y-2 flex-1">
                                {paginatedLogs.map(log => (
                                    <div
                                        key={log.id}
                                        onClick={() => setSelectedLog(log)}
                                        className="cursor-pointer transition-colors rounded-lg"
                                    >
                                        <ReportItem
                                            log={log}
                                            isSelected={selectedIds.has(log.id)}
                                            onSelect={handleSelect}
                                            onDelete={singleDelete}
                                            onArchive={singleArchive}
                                            onViewDetails={setSelectedLog}
                                            onSimulate={(enemyUnits) => onSimulate?.(enemyUnits, gameState.units)}
                                            playerUnits={gameState.units}
                                            t={t}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex flex-wrap justify-center items-center gap-2 py-3 mt-2 shrink-0 border-t border-white/5">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setCurrentPage(p => Math.max(1, p - 1)); }}
                                    disabled={currentPage === 1}
                                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 transition-colors active:scale-95"
                                >
                                    <Icons.ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-xs font-mono text-slate-400 px-2">
                                    {currentPage}/{totalPages}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setCurrentPage(p => Math.min(totalPages, p + 1)); }}
                                    disabled={currentPage === totalPages}
                                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/10 transition-colors active:scale-95"
                                >
                                    <Icons.ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop side panel - hidden on mobile */}
                <div className="hidden lg:flex flex-1 xl:w-[40%] glass-panel border border-white/10 rounded-xl overflow-hidden h-full flex-col bg-black/20 shrink-0 lg:min-w-[320px]">
                    {selectedLog ? (
                        // Report detail view
                        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                            <CombatReportContent log={selectedLog} t={t} embedded={true} />
                        </div>
                    ) : (
                        // Empty state - no report selected
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                            <Icons.Report className="w-16 h-16 opacity-20" />
                            <p className="mt-4 text-sm uppercase tracking-widest">{t.reports.view_report}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};