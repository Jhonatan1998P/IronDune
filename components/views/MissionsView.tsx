
import React, { useState } from 'react';
import { UNIT_DEFS } from '../../data/units';
import { GameState, MissionDuration, UnitType } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { GlassButton, Icons } from '../UIComponents';
import { formatDuration, formatNumber } from '../../utils';
import { calculateTotalUnitCost } from '../../utils/engine/market';

export const MissionsView: React.FC<{ gameState: GameState, onStartMission: (units: Partial<Record<UnitType, number>>, duration: MissionDuration) => void }> = ({ gameState, onStartMission }) => {
    const { t } = useLanguage();
    const [selectedUnits, setSelectedUnits] = useState<Partial<Record<UnitType, number>>>({});
    const [selectedDuration, setSelectedDuration] = useState<MissionDuration | null>(null);

    const ZONES: { id: MissionDuration, lvl: number, nameKey: string, risk: string, color: string, bg: string, border: string }[] = [
        { id: 5, lvl: 1, nameKey: 'zone_1', risk: 'Low', color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-500/50' },
        { id: 15, lvl: 2, nameKey: 'zone_2', risk: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-950/40', border: 'border-yellow-500/50' },
        { id: 30, lvl: 3, nameKey: 'zone_3', risk: 'High', color: 'text-orange-400', bg: 'bg-orange-950/40', border: 'border-orange-500/50' },
        { id: 60, lvl: 4, nameKey: 'zone_4', risk: 'Extreme', color: 'text-red-400', bg: 'bg-red-950/40', border: 'border-red-500/50' }
    ];

    const handleUnitChange = (uType: UnitType, delta: number) => {
        setSelectedUnits(prev => {
            const max = gameState.units[uType] || 0;
            const curr = prev[uType] || 0;
            const next = Math.max(0, Math.min(max, curr + delta));
            if (next === 0) {
                const newUnits = { ...prev };
                delete newUnits[uType];
                return newUnits;
            }
            return { ...prev, [uType]: next };
        });
    };

    const handleUnitSet = (uType: UnitType, val: number) => {
        setSelectedUnits(prev => {
            const max = gameState.units[uType] || 0;
            const next = Math.max(0, Math.min(max, val));
            if (next === 0) {
                const newUnits = { ...prev };
                delete newUnits[uType];
                return newUnits;
            }
            return { ...prev, [uType]: next };
        });
    };

    const calculateSquadPower = () => {
        let power = 0;
        Object.entries(selectedUnits).forEach(([u, count]) => {
            const def = UNIT_DEFS[u as UnitType];
            power += (def.attack + def.defense + def.hp) * (count as number);
        });
        return power;
    };

    const squadPower = calculateSquadPower();
    const fleetValue = calculateTotalUnitCost(selectedUnits);
    const estCapacity = selectedDuration ? fleetValue * 0.05 * (selectedDuration === 5 ? 1 : selectedDuration === 15 ? 2 : selectedDuration === 30 ? 3 : 4) : 0;
    const totalSelected = Object.values(selectedUnits).reduce((a: number, b) => a + ((b as number) || 0), 0);

    return (
        <div className="flex flex-col lg:flex-row gap-6 animate-[fadeIn_0.3s_ease-out] pb-24">
            
            {/* LEFT: SQUAD SELECTION */}
            <div className="w-full lg:w-1/3 flex flex-col gap-4">
                <div className="flex flex-col glass-panel rounded-xl border border-white/10 overflow-hidden shadow-lg">
                    <div className="p-4 bg-black/40 border-b border-white/10 shrink-0 flex justify-between items-center">
                        <h2 className="font-tech text-cyan-400 uppercase tracking-widest text-sm flex items-center gap-2">
                            <Icons.Army /> {t.missions.patrol.select_units}
                        </h2>
                        <span className="text-[10px] text-slate-500 font-bold bg-black/50 px-2 py-1 rounded border border-white/5 uppercase tracking-widest">{t.common.ui.total}: {totalSelected}</span>
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto p-2 custom-scrollbar bg-slate-900/40">
                         {(Object.keys(gameState.units) as UnitType[]).filter(u => gameState.units[u] > 0).map(u => {
                             const def = UNIT_DEFS[u];
                             const name = t.units[def.translationKey]?.name || u;
                             const current = selectedUnits[u] || 0;
                             return (
                                 <div key={u} className={`flex justify-between items-center p-2 mb-1 hover:bg-white/5 rounded transition-colors border-b border-white/5 last:border-0 ${current > 0 ? 'bg-cyan-900/10 border-cyan-500/20' : ''}`}>
                                     <div className="flex flex-col">
                                         <span className={`text-xs font-bold ${current > 0 ? 'text-white' : 'text-slate-300'}`}>{name}</span>
                                         <span className="text-[9px] text-slate-500 font-mono">ATK {def.attack} | DEF {def.defense}</span>
                                     </div>
                                     <div className="flex gap-2 items-center bg-black/40 px-1 py-1 rounded">
                                         <button onClick={() => handleUnitChange(u, -5)} className="text-[9px] text-slate-500 hover:text-white px-1">-5</button>
                                         <button onClick={() => handleUnitChange(u, -1)} className="w-6 h-6 bg-white/5 hover:bg-white/10 rounded text-xs border border-white/10 text-slate-400">-</button>
                                         <input 
                                            type="number"
                                            value={current === 0 ? '' : current}
                                            onChange={(e) => handleUnitSet(u, parseInt(e.target.value) || 0)}
                                            placeholder="0"
                                            className={`w-10 bg-transparent text-center font-mono text-xs font-bold focus:outline-none border-b border-transparent focus:border-cyan-500/50 ${current > 0 ? 'text-cyan-400' : 'text-slate-500'}`}
                                         />
                                         <button onClick={() => handleUnitChange(u, 1)} className="w-6 h-6 bg-white/5 hover:bg-white/10 rounded text-xs border border-white/10 text-white">+</button>
                                         <button onClick={() => handleUnitChange(u, 5)} className="text-[9px] text-slate-500 hover:text-white px-1">+5</button>
                                     </div>
                                 </div>
                             )
                         })}
                         {Object.keys(gameState.units).every(u => (gameState.units[u as UnitType] || 0) === 0) && (
                             <div className="text-xs text-slate-500 text-center py-10 italic flex flex-col items-center gap-3">
                                 <Icons.Radar className="w-8 h-8 opacity-20" />
                                 {t.errors.insufficient_units}
                             </div>
                         )}
                    </div>

                    <div className="p-4 bg-black/60 border-t border-white/10 shrink-0 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400 uppercase tracking-widest">{t.common.ui.est_power}</span>
                            <span className={`font-mono font-bold text-lg ${squadPower > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>{formatNumber(squadPower)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT: TACTICAL MAP & ZONES */}
            <div className="w-full lg:w-2/3 flex flex-col gap-6">
                
                {/* Tactical Map Container */}
                <div className="glass-panel rounded-xl border border-white/10 p-4 md:p-6 relative overflow-hidden flex flex-col shadow-lg">
                    
                    {/* Background Map Styling */}
                    <div className="absolute inset-0 bg-slate-950 z-0"></div>
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/40 via-transparent to-transparent z-0"></div>
                    <div className="absolute inset-0 bg-grid-pattern opacity-10 z-0"></div>
                    
                    <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                        <h3 className="font-tech text-white uppercase tracking-widest text-lg flex items-center gap-2 shrink-0">
                            <Icons.Radar /> {t.missions.patrol.title}
                        </h3>
                        <div className="text-[10px] text-slate-400 font-mono bg-black/50 px-3 py-1.5 rounded border border-white/10 leading-tight">
                            {t.missions.patrol.mechanic_note}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                        {ZONES.map(zone => {
                            const isSelected = selectedDuration === zone.id;
                            const zoneName = (t.missions.patrol as any)[zone.nameKey] || `Sector ${zone.lvl}`;

                            return (
                                <button
                                    key={zone.id}
                                    onClick={() => setSelectedDuration(zone.id)}
                                    className={`
                                        relative overflow-hidden rounded-xl border-2 transition-all duration-300 flex flex-col justify-between p-4 group text-left min-h-[100px]
                                        ${isSelected ? `${zone.bg} ${zone.border} shadow-[0_0_20px_rgba(0,0,0,0.5)] scale-[1.02]` : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/5'}
                                    `}
                                >
                                    {isSelected && <div className={`absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent`}></div>}
                                    
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`font-tech text-sm md:text-base uppercase tracking-widest ${isSelected ? zone.color : 'text-slate-300'}`}>
                                                {zoneName}
                                            </span>
                                            <span className="text-[9px] font-bold bg-black/50 px-2 py-1 rounded text-white border border-white/10">
                                                Lvl {zone.lvl}
                                            </span>
                                        </div>
                                        <div className={`text-[10px] uppercase tracking-widest font-bold ${isSelected ? zone.color : 'text-slate-500'}`}>
                                            Risk: {zone.risk}
                                        </div>
                                    </div>

                                    <div className="mt-4 flex justify-between items-end">
                                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                            <Icons.Clock className="w-3 h-3" />
                                            <span className="font-mono text-sm">{zone.id}m</span>
                                        </div>
                                        {isSelected && squadPower > 0 && (
                                            <div className="text-right animate-[fadeIn_0.3s_ease-out]">
                                                <div className="text-[9px] text-emerald-400/70 uppercase tracking-widest font-bold">{(t.missions.patrol as any).est_capacity || "Est. Capacity"}</div>
                                                <div className="font-mono font-bold text-emerald-400 text-sm">~ ${formatNumber(estCapacity)}</div>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Launch Bar */}
                <div className="glass-panel p-4 md:p-6 rounded-xl border border-white/10 bg-black/40 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-lg">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="hidden sm:flex w-12 h-12 rounded-full border border-dashed border-slate-600 items-center justify-center text-slate-500 shrink-0">
                            <Icons.Radar />
                        </div>
                        <div className="text-sm">
                            <div className="text-slate-400 uppercase tracking-widest text-[10px] mb-1">{t.common.ui.status}</div>
                            {totalSelected === 0 ? (
                                <span className="text-red-400 font-bold uppercase text-xs">{t.errors.insufficient_units}</span>
                            ) : !selectedDuration ? (
                                <span className="text-orange-400 font-bold uppercase text-xs">Select Target Zone</span>
                            ) : (
                                <span className="text-emerald-400 font-bold uppercase text-xs">Ready for Deployment</span>
                            )}
                        </div>
                    </div>

                    <GlassButton 
                        id="btn-start-patrol"
                        onClick={() => {
                            if (selectedDuration) {
                                onStartMission(selectedUnits, selectedDuration);
                                setSelectedUnits({});
                                setSelectedDuration(null);
                            }
                        }}
                        disabled={totalSelected === 0 || !selectedDuration}
                        variant="primary"
                        className="w-full sm:w-auto px-8 py-4 text-sm tracking-[0.2em] shadow-[0_0_20px_rgba(6,182,212,0.3)] min-w-[200px]"
                    >
                        {t.missions.patrol.start_btn}
                    </GlassButton>
                </div>

                {/* Active Patrols Preview */}
                {gameState.activeMissions.filter(m => m.type === 'PATROL').length > 0 && (
                    <div className="glass-panel p-3 rounded-xl border border-white/10 bg-black/20 shrink-0 overflow-hidden flex gap-2 overflow-x-auto custom-scrollbar">
                        {gameState.activeMissions.filter(m => m.type === 'PATROL').map(m => {
                            const remaining = Math.max(0, m.endTime - Date.now());
                            const totalTime = m.duration * 60 * 1000;
                            const progress = 100 - (remaining / totalTime * 100);
                            
                            return (
                                <div key={m.id} className="min-w-[200px] bg-slate-900/80 p-2 rounded-lg border border-purple-500/30 relative overflow-hidden flex-1 max-w-[250px]">
                                    <div className="absolute top-0 left-0 h-full w-1 bg-purple-500"></div>
                                    <div className="flex justify-between items-start mb-2 pl-2">
                                        <div className="text-[10px] font-bold text-purple-300 uppercase tracking-widest truncate">{t.missions.patrol.in_progress}</div>
                                        <div className="font-mono text-xs font-bold text-white bg-black/40 px-1 rounded">
                                            {formatDuration(remaining)}
                                        </div>
                                    </div>
                                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden ml-2">
                                        <div className="h-full bg-purple-500 shadow-[0_0_10px_#a855f7] transition-all duration-1000 linear" style={{ width: `${progress}%` }}></div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
