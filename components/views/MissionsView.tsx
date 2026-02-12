
import React, { useState } from 'react';
import { UNIT_DEFS } from '../../data/units';
import { GameState, MissionDuration, UnitType } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { Card, GlassButton, Icons } from '../UIComponents';
import { formatDuration } from '../../utils';

export const MissionsView: React.FC<{ gameState: GameState, onStartMission: (units: any, duration: any) => void }> = ({ gameState, onStartMission }) => {
    const { t } = useLanguage();
    const [selectedUnits, setSelectedUnits] = useState<Partial<Record<UnitType, number>>>({});
    const durations: { val: MissionDuration, lvl: number }[] = [
        { val: 5, lvl: 1 },
        { val: 15, lvl: 2 },
        { val: 30, lvl: 3 },
        { val: 60, lvl: 4 }
    ];
    const [selectedDuration, setSelectedDuration] = useState<MissionDuration>(5);

    const handleUnitChange = (uType: UnitType, delta: number) => {
        setSelectedUnits(prev => {
            const max = gameState.units[uType] || 0;
            const curr = prev[uType] || 0;
            const next = Math.max(0, Math.min(max, curr + delta));
            if (next === 0) {
                const { [uType]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [uType]: next };
        });
    };

    const handleUnitSet = (uType: UnitType, val: number) => {
        setSelectedUnits(prev => {
            const max = gameState.units[uType] || 0;
            const next = Math.max(0, Math.min(max, val));
            if (next === 0) {
                const { [uType]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [uType]: next };
        });
    };

    // Calculate approximate squad power for UI feedback
    const calculateSquadPower = () => {
        let power = 0;
        Object.entries(selectedUnits).forEach(([u, count]) => {
            const def = UNIT_DEFS[u as UnitType];
            power += (def.attack + def.defense + def.hp) * (count as number);
        });
        return power;
    };

    const squadPower = calculateSquadPower();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-[fadeIn_0.3s_ease-out]">
            <Card title={t.missions.patrol.title} tooltip={t.missions.patrol.desc}>
                <div className="space-y-4">
                     {/* Info / Mechanics Section */}
                     <div className="bg-cyan-950/30 p-3 rounded border border-cyan-500/20 text-xs text-slate-300">
                         <h4 className="flex items-center gap-2 font-bold text-cyan-400 mb-1 uppercase tracking-wider">
                             <Icons.Info /> {t.missions.patrol.intel_title || "Mission Profile"}
                         </h4>
                         <p className="mb-2 leading-relaxed opacity-90">
                             {t.missions.patrol.intel_desc}
                         </p>
                         <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-[10px] font-mono">
                             <span className="text-slate-400">{t.missions.patrol.no_event_chance}</span>
                             <span className="text-emerald-400">{t.missions.patrol.contraband_chance}</span>
                             <span className="text-orange-400">{t.missions.patrol.battle_chance}</span>
                             <span className="text-red-500 font-bold">{t.missions.patrol.ambush_chance}</span>
                         </div>
                         <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-cyan-200/70">
                             {t.missions.patrol.mechanic_note}
                         </div>
                     </div>

                     <div>
                         <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">{t.missions.patrol.select_units}</div>
                         
                         {/* Unit Selector List */}
                         <div className="bg-black/20 p-2 rounded border border-white/5 max-h-48 overflow-y-auto custom-scrollbar">
                             {(Object.keys(gameState.units) as UnitType[]).filter(u => gameState.units[u] > 0).map(u => {
                                 const def = UNIT_DEFS[u];
                                 const name = t.units[def.translationKey]?.name || u;
                                 return (
                                     <div key={u} className="flex justify-between items-center p-1.5 hover:bg-white/5 rounded transition-colors border-b border-white/5 last:border-0">
                                         <div className="flex flex-col">
                                             <span className="text-xs text-slate-300 font-bold">{name}</span>
                                             <span className="text-[9px] text-slate-500 font-mono">ATK {def.attack} | DEF {def.defense}</span>
                                         </div>
                                         <div className="flex gap-2 items-center">
                                             <button onClick={() => handleUnitChange(u, -5)} className="text-[9px] text-slate-500 hover:text-white px-1">-5</button>
                                             <button onClick={() => handleUnitChange(u, -1)} className="w-6 h-6 bg-white/5 hover:bg-white/10 rounded text-xs border border-white/10">-</button>
                                             <input 
                                                type="number"
                                                value={selectedUnits[u] || ''}
                                                onChange={(e) => handleUnitSet(u, parseInt(e.target.value) || 0)}
                                                placeholder="0"
                                                className="w-10 bg-transparent text-center font-mono text-xs font-bold text-cyan-400 focus:outline-none border-b border-transparent focus:border-cyan-500/50"
                                             />
                                             <button onClick={() => handleUnitChange(u, 1)} className="w-6 h-6 bg-white/5 hover:bg-white/10 rounded text-xs border border-white/10">+</button>
                                             <button onClick={() => handleUnitChange(u, 5)} className="text-[9px] text-slate-500 hover:text-white px-1">+5</button>
                                         </div>
                                     </div>
                                 )
                             })}
                             {Object.keys(gameState.units).every(u => (gameState.units[u as UnitType] || 0) === 0) && (
                                 <div className="text-xs text-slate-500 text-center py-6 italic">{t.errors.insufficient_units}</div>
                             )}
                         </div>
                     </div>
                     
                     <div className="flex justify-between items-center bg-black/40 p-2 rounded border border-white/5">
                        <span className="text-[10px] uppercase text-slate-500 tracking-widest">{t.common.ui.est_power}</span>
                        <span className={`font-mono font-bold ${squadPower > 0 ? 'text-cyan-400' : 'text-slate-600'}`}>{squadPower.toLocaleString()}</span>
                     </div>

                     <div>
                         <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">{t.missions.patrol.patrol_duration_label}</div>
                         <div className="grid grid-cols-4 gap-2">
                             {durations.map(d => (
                                 <button 
                                    key={d.val}
                                    onClick={() => setSelectedDuration(d.val)}
                                    className={`flex flex-col items-center justify-center py-2 rounded border text-xs font-mono transition-all ${selectedDuration === d.val ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-black/20 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10'}`}
                                 >
                                     <span className="font-bold text-[10px] uppercase tracking-wide">Lvl {d.lvl}</span>
                                     <span>{d.val}m</span>
                                 </button>
                             ))}
                         </div>
                     </div>

                     <GlassButton 
                        id="btn-start-patrol"
                        onClick={() => {
                             onStartMission(selectedUnits, selectedDuration);
                             setSelectedUnits({});
                        }}
                        disabled={Object.keys(selectedUnits).length === 0}
                        className="w-full h-12 text-sm font-bold tracking-widest"
                        variant="primary"
                     >
                         {t.missions.patrol.start_btn}
                     </GlassButton>
                </div>
            </Card>

            <Card title={t.missions.patrol.in_progress}>
                <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar p-1">
                    {gameState.activeMissions.filter(m => m.type === 'PATROL').length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 opacity-50">
                             <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-600">
                                 <Icons.Radar />
                             </div>
                             <span className="text-slate-500 text-xs uppercase tracking-widest">{t.missions.patrol.log_nothing}</span>
                        </div>
                    ) : (
                        gameState.activeMissions.filter(m => m.type === 'PATROL').map(m => {
                            const remaining = Math.max(0, m.endTime - Date.now());
                            const totalTime = m.duration * 60 * 1000;
                            const progress = 100 - (remaining / totalTime * 100);
                            
                            // Unit Summary for Card
                            const unitCount = Object.values(m.units).reduce((a: number, b) => a + ((b as number) || 0), 0);

                            return (
                                <div key={m.id} className="bg-slate-900/80 p-4 rounded-lg border border-white/5 relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 h-full w-1 bg-purple-500"></div>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="text-xs font-bold text-purple-300 mb-0.5">Operation #{m.id.slice(-4)}</div>
                                            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Sector Recon</div>
                                        </div>
                                        <div className="font-mono text-sm font-bold text-white bg-black/40 px-2 py-1 rounded border border-white/5">
                                            {formatDuration(remaining)}
                                        </div>
                                    </div>
                                    
                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
                                        <div className="h-full bg-purple-500 shadow-[0_0_10px_#a855f7] transition-all duration-1000 linear" style={{ width: `${progress}%` }}></div>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <div className="text-[10px] text-slate-400">
                                            <span className="text-slate-500 uppercase mr-2">Force Size:</span>
                                            <span className="font-mono text-white">{unitCount} Units</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </Card>
        </div>
    );
};
