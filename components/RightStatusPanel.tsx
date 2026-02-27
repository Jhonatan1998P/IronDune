import React from 'react';
import { useGame } from '../context/GameContext';
import { useLanguage } from '../context/LanguageContext';
import { formatDuration, formatNumber } from '../utils';
import { Icons, SpeedUpButton } from './UIComponents';
import { BUILDING_DEFS } from '../data/buildings';
import { UNIT_DEFS } from '../data/units';
import { TECH_DEFS } from '../data/techs';
import { BuildingType, TechType, UnitType } from '../types';
import { TerminalLogs } from './ui/TerminalLogs';
import { calculatePotentialReinforcements, getPlayerGarrison, isPlayerUnderThreat } from '../utils/engine/allianceReinforcements';

interface RightStatusPanelProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export const RightStatusPanel: React.FC<RightStatusPanelProps> = ({ isOpen = false, onClose }) => {
    const { gameState, speedUp } = useGame();
    const { t } = useLanguage();
    const now = Date.now();

    const incomingAttacks = gameState.incomingAttacks || [];
    const activeConstructions = gameState.activeConstructions;
    const activeRecruitments = gameState.activeRecruitments;
    const activeResearch = gameState.activeResearch;
    const activeMissions = gameState.activeMissions;
    const activeWar = gameState.activeWar;

    // Calculate garrison and reinforcements
    const garrison = getPlayerGarrison(gameState);
    const reinforcements = calculatePotentialReinforcements(gameState, now);
    const underThreat = isPlayerUnderThreat(gameState);

    const drawerClasses = `
        fixed inset-y-0 right-0 z-[60] 
        w-[90vw] sm:w-96 
        bg-slate-900/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        
        xl:translate-x-0 xl:static xl:w-80 xl:z-auto xl:shadow-none xl:bg-slate-900/60 xl:border-l-0
    `;

    return (
        <>
            <div 
                className={`
                    fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] xl:hidden 
                    transition-opacity duration-300 
                    ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                `}
                onClick={onClose}
            />

            <aside className={drawerClasses}>
                <div className="flex flex-col h-full w-full relative overflow-hidden">
                    
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none mix-blend-overlay"></div>
                    
                    <div className="xl:hidden flex justify-between items-center p-4 border-b border-white/10 bg-black/20 shrink-0 relative z-10">
                        <span className="font-tech text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Icons.Menu /> {t.common.ui.sys_monitor}
                        </span>
                        <button 
                            onClick={onClose} 
                            className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors active:scale-95"
                        >
                            <Icons.Close />
                        </button>
                    </div>

                    <div className={`p-3 md:p-4 border-b border-white/10 shrink-0 relative z-10 transition-colors ${activeWar ? 'bg-red-950/30' : 'bg-black/10'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className={`font-tech text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-2 ${activeWar ? 'text-red-500 font-bold' : 'text-red-400'}`}>
                                <Icons.Radar /> {activeWar ? 'WARCOM ACTIVE' : t.common.ui.threat_short}
                            </h3>
                            {(incomingAttacks.length > 0 || activeWar) && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            )}
                        </div>

                        <div className="min-h-[50px] max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                            {incomingAttacks.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-[10px] text-slate-600 uppercase tracking-widest border border-dashed border-white/5 rounded p-2 bg-black/10">
                                    {activeWar ? t.common.ui.no_inbound_waves : t.common.ui.no_active_threats}
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {incomingAttacks.map(attack => (
                                        <div key={attack.id} className="bg-red-950/40 border border-red-500/30 p-1.5 rounded text-xs relative overflow-hidden group">
                                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500 animate-pulse"></div>
                                            <div className="flex justify-between items-center mb-0.5 pl-2">
                                                <span className="font-bold text-red-300 truncate max-w-[60%]">{attack.attackerName}</span>
                                                <span className="font-mono text-white font-bold text-[10px] bg-black/40 px-1 rounded">
                                                    {formatDuration(Math.max(0, attack.endTime - Date.now()))}
                                                </span>
                                            </div>
                                            {attack.isScouted && (
                                                <div className="pl-2 text-[9px] text-red-400/80 font-mono">
                                                    Intel: {Object.values(attack.units).reduce((a: number, b: number | undefined) => a + (b || 0), 0)} units
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-3 md:p-4 space-y-5 relative z-10">
                        
                        <section>
                            <div className="flex justify-between items-center mb-2 px-1 sticky top-0 bg-slate-900/95 backdrop-blur z-20 py-1">
                                <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> {t.common.actions.construct}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">{activeConstructions.length} / 3</span>
                            </div>
                            <div className="space-y-1.5">
                                {activeConstructions.length === 0 && (
                                    <div className="text-[10px] text-slate-600 italic pl-3 border-l border-slate-800 py-1">{t.common.ui.sys_idle}</div>
                                )}
                                {activeConstructions.map(c => {
                                    const def = BUILDING_DEFS[c.buildingType as BuildingType];
                                    const name = t.buildings[def?.translationKey]?.name || c.buildingType;
                                    const left = Math.max(0, c.endTime - Date.now());
                                    const total = c.endTime - c.startTime;
                                    const percent = 100 - (left / total * 100);
                                    
                                    return (
                                        <div key={c.id} className="bg-slate-800/40 border border-white/5 p-2 rounded relative overflow-hidden group">
                                            <div className="flex justify-between items-center text-xs relative z-10">
                                                <span className="text-slate-300 truncate max-w-[65%] text-[11px]">{name} <span className="text-emerald-500 font-mono text-[10px]">(+{c.count})</span></span>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="font-mono text-emerald-400 text-[10px]">{formatDuration(left)}</span>
                                                    <SpeedUpButton onClick={() => speedUp(c.id, 'BUILD')} />
                                                </div>
                                            </div>
                                            <div className="absolute bottom-0 left-0 h-0.5 bg-emerald-500/50 transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>

                        <section>
                            <div className="flex justify-between items-center mb-2 px-1 sticky top-0 bg-slate-900/95 backdrop-blur z-20 py-1">
                                <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span> {t.common.ui.training_queue}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">{activeRecruitments.length} / 3</span>
                            </div>
                            <div className="space-y-1.5">
                                {activeRecruitments.length === 0 && (
                                    <div className="text-[10px] text-slate-600 italic pl-3 border-l border-slate-800 py-1">{t.common.ui.barracks_idle}</div>
                                )}
                                {activeRecruitments.map(r => {
                                    const def = UNIT_DEFS[r.unitType as UnitType];
                                    const name = t.units[def?.translationKey]?.name || r.unitType;
                                    const left = Math.max(0, r.endTime - Date.now());
                                    const total = r.endTime - r.startTime;
                                    const percent = 100 - (left / total * 100);

                                    return (
                                        <div key={r.id} className="bg-slate-800/40 border border-white/5 p-2 rounded relative overflow-hidden">
                                            <div className="flex justify-between items-center text-xs relative z-10">
                                                <span className="text-slate-300 truncate max-w-[65%] text-[11px]">{name} <span className="text-cyan-500 font-mono text-[10px]">(x{r.count})</span></span>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="font-mono text-cyan-400 text-[10px]">{formatDuration(left)}</span>
                                                    <SpeedUpButton onClick={() => speedUp(r.id, 'RECRUIT')} />
                                                </div>
                                            </div>
                                            <div className="absolute bottom-0 left-0 h-0.5 bg-cyan-500/50 transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>

                        <section>
                            <div className="flex justify-between items-center mb-2 px-1 sticky top-0 bg-slate-900/95 backdrop-blur z-20 py-1">
                                <span className="text-[10px] text-purple-400 uppercase tracking-widest font-bold flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span> {t.common.ui.nav_research}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">{activeResearch ? '1' : '0'} / 1</span>
                            </div>
                            <div className="space-y-1.5">
                                {!activeResearch ? (
                                    <div className="text-[10px] text-slate-600 italic pl-3 border-l border-slate-800 py-1">{t.common.ui.lab_idle}</div>
                                ) : (
                                    (() => {
                                        const def = TECH_DEFS[activeResearch.techId as TechType];
                                        const name = t.techs[def?.translationKey ?? '']?.name || activeResearch.techId;
                                        const left = Math.max(0, activeResearch.endTime - Date.now());
                                        const total = activeResearch.endTime - activeResearch.startTime;
                                        const percent = 100 - (left / total * 100);

                                        return (
                                            <div className="bg-slate-800/40 border border-white/5 p-2 rounded relative overflow-hidden">
                                                <div className="flex justify-between items-center text-xs relative z-10">
                                                    <span className="text-slate-300 truncate max-w-[65%] text-[11px]">{name}</span>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="font-mono text-purple-400 text-[10px]">{formatDuration(left)}</span>
                                                        <SpeedUpButton onClick={() => speedUp(activeResearch.techId, 'RESEARCH')} />
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-0 left-0 h-0.5 bg-purple-500/50 transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                                            </div>
                                        );
                                    })()
                                )}
                            </div>
                        </section>

                        <section>
                            <div className="flex justify-between items-center mb-2 px-1 border-t border-white/5 pt-4 sticky top-0 bg-slate-900/95 backdrop-blur z-20 py-1">
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span> {t.common.ui.active_ops}
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                {activeMissions.length === 0 ? (
                                    <div className="text-center text-[10px] text-slate-600 py-3 border border-dashed border-white/5 rounded bg-black/10">{t.common.ui.no_ops}</div>
                                ) : (
                                    activeMissions.slice(0, 5).map(m => (
                                        <div key={m.id} className="bg-white/5 rounded p-2 border border-white/5 text-[10px] flex justify-between items-center">
                                            <div className="text-slate-300 truncate max-w-[65%] flex items-center gap-2">
                                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${m.type === 'PVP_ATTACK' ? 'bg-yellow-500' : 'bg-blue-500'}`}></span>
                                                <span className="truncate">{m.type === 'PVP_ATTACK' ? `Atk: ${m.targetName}` : m.type === 'PATROL' ? t.common.ui.mission_patrol : t.common.ui.mission_campaign}</span>
                                            </div>
                                            <div className="font-mono text-cyan-400">{formatDuration(Math.max(0, m.endTime - Date.now()))}</div>
                                        </div>
                                    ))
                                )}
                                {activeMissions.length > 5 && (
                                    <div className="text-[9px] text-center text-slate-500 pt-1">+{activeMissions.length - 5} more...</div>
                                )}
                            </div>
                        </section>

                        {/* --- TERMINAL LOGS RENDERED IN SYSTEM MONITOR --- */}
                        <section className="pt-4 mt-4 border-t border-white/5">
                            <TerminalLogs logs={gameState.logs} />
                        </section>

                        {/* --- PLAYER GARRISON --- */}
                        <section className="pt-4 mt-4 border-t border-white/5">
                            <div className="flex justify-between items-center mb-2 px-1">
                                <span className="text-[10px] text-amber-400 uppercase tracking-widest font-bold flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> {t.common.ui.active_units}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">
                                    {garrison.totalUnits} units
                                </span>
                            </div>
                            <div className="bg-slate-800/30 border border-amber-500/20 rounded-lg p-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-black/30 rounded p-2 text-center">
                                        <div className="text-[9px] text-slate-500 uppercase tracking-wider">Total</div>
                                        <div className="text-lg font-mono font-bold text-amber-400">{formatNumber(garrison.totalUnits)}</div>
                                    </div>
                                    <div className="bg-black/30 rounded p-2 text-center">
                                        <div className="text-[9px] text-slate-500 uppercase tracking-wider">Power</div>
                                        <div className="text-lg font-mono font-bold text-amber-400">{formatNumber(garrison.totalPower)}</div>
                                    </div>
                                </div>
                                {garrison.totalUnits > 0 && (
                                    <div className="mt-2 pt-2 border-t border-white/5">
                                        <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Composition</div>
                                        <div className="flex flex-wrap gap-1">
                                            {Object.entries(garrison.units)
                                                .filter(([_, count]) => count && count > 0)
                                                .slice(0, 8)
                                                .map(([unitType, count]) => {
                                                    const def = UNIT_DEFS[unitType as UnitType];
                                                    const name = def ? t.units[def.translationKey]?.name.split(' ')[0] || unitType : unitType;
                                                    return (
                                                        <div key={unitType} className="bg-amber-950/30 border border-amber-500/20 rounded px-1.5 py-0.5 text-[8px] text-amber-300 font-mono flex items-center gap-1">
                                                            <span>{name}</span>
                                                            <span className="text-amber-400 font-bold">{formatNumber(count!)}</span>
                                                        </div>
                                                    );
                                                })}
                                            {Object.entries(garrison.units).filter(([_, count]) => count && count > 0).length > 8 && (
                                                <div className="bg-slate-700/50 rounded px-1.5 py-0.5 text-[8px] text-slate-400">+more</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {garrison.totalUnits === 0 && (
                                    <div className="text-[10px] text-slate-600 text-center py-2">No units garrisoned</div>
                                )}
                            </div>
                        </section>

                        {/* --- ALLIED REINFORCEMENTS --- */}
                        <section className="pt-4 mt-4 border-t border-white/5">
                            <div className="flex justify-between items-center mb-2 px-1">
                                <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full ${underThreat ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'}`}></span> {t.common.ui.diplomacy_allies}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">
                                    {reinforcements.length} allies
                                </span>
                            </div>
                            {reinforcements.length === 0 ? (
                                <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-lg p-3 text-center">
                                    <div className="text-[10px] text-slate-600">No allied bots available</div>
                                    <div className="text-[9px] text-slate-700 mt-1">Build reputation (70+) to gain allies</div>
                                </div>
                            ) : (
                                <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                                    {reinforcements.slice(0, 5).map((reinforcement) => (
                                        <div key={reinforcement.botId} className={`bg-emerald-950/20 border ${underThreat ? 'border-emerald-500/40' : 'border-emerald-500/20'} rounded p-2 text-xs relative overflow-hidden`}>
                                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500/50"></div>
                                            <div className="flex justify-between items-start pl-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="font-bold text-emerald-300 truncate max-w-[120px]">{reinforcement.botName}</span>
                                                        <span className="text-[8px] bg-emerald-900/50 text-emerald-400 px-1 rounded font-mono">Rep: {reinforcement.reputation}</span>
                                                    </div>
                                                    <div className="text-[9px] text-slate-400 font-mono">
                                                        {formatNumber(reinforcement.totalUnits)} units • ETA: {formatDuration(reinforcement.estimatedArrival - now)}
                                                    </div>
                                                </div>
                                            </div>
                                            {reinforcement.totalUnits > 0 && (
                                                <div className="pl-2 mt-1 flex flex-wrap gap-1">
                                                    {Object.entries(reinforcement.units)
                                                        .filter(([_, count]) => count && count > 0)
                                                        .slice(0, 4)
                                                        .map(([unitType, count]) => {
                                                            const def = UNIT_DEFS[unitType as UnitType];
                                                            const name = def ? t.units[def.translationKey]?.name.split(' ')[0] || unitType : unitType;
                                                            return (
                                                                <span key={unitType} className="text-[8px] bg-black/30 text-emerald-400/80 px-1 rounded font-mono">
                                                                    {name} x{formatNumber(count!)}
                                                                </span>
                                                            );
                                                        })}
                                                    {Object.entries(reinforcement.units).filter(([_, count]) => count && count > 0).length > 4 && (
                                                        <span className="text-[8px] text-slate-500">+more</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {reinforcements.length > 5 && (
                                        <div className="text-[9px] text-center text-slate-500 pt-1">
                                            +{reinforcements.length - 5} more allies available
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        <div className="h-20 xl:h-10 shrink-0"></div>
                    </div>
                </div>
            </aside>
        </>
    );
};