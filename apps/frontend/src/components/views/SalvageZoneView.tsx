import React, { useState, useMemo, useEffect } from 'react';
import { GameState, LogisticLootField, UnitType, ResourceType } from '../../types';
import { SALVAGER_CARGO_CAPACITY } from '../../constants';
import { GlassButton, Icons } from '../UIComponents';
import { formatNumber, formatDuration } from '../../utils';

const BATTLE_SERVER_URL = (import.meta as any).env?.VITE_SOCKET_SERVER_URL || 'http://localhost:10000';

interface SalvageZoneViewProps {
    gameState: GameState;
    onStartMission: (lootId: string, drones: number) => void;
}

export const SalvageZoneView: React.FC<SalvageZoneViewProps> = ({ gameState, onStartMission }) => {
    const [selectedLootId, setSelectedLootId] = useState<string | null>(null);
    const [droneCount, setDroneCount] = useState<number>(0);
    const [globalLoot, setGlobalLoot] = useState<LogisticLootField[]>([]);

    const availableDrones = gameState.units[UnitType.SALVAGER_DRONE] || 0;
    
    // Fetch Global Loot from Server
    useEffect(() => {
        const fetchGlobalLoot = async () => {
            try {
                const response = await fetch(`${BATTLE_SERVER_URL}/api/salvage/global`);
                if (response.ok) {
                    const data = await response.json();
                    setGlobalLoot(data);
                }
            } catch (e) {
                console.error('Failed to fetch global loot:', e);
            }
        };

        fetchGlobalLoot();
        const interval = setInterval(fetchGlobalLoot, 10000); // Sync every 10s
        return () => clearInterval(interval);
    }, []);

    // Merge local loot (not yet synced) with global loot
    const lootFields = useMemo(() => {
        const combined = [...globalLoot];
        // Add local ones if they are not in global yet (optional, for UX)
        (gameState.logisticLootFields || []).forEach(local => {
            if (!combined.find(g => g.id === local.id)) combined.push(local);
        });
        return combined;
    }, [globalLoot, gameState.logisticLootFields]);
    
    // Sort loot fields by expiration (closest first)
    const sortedFields = useMemo(() => {
        return [...lootFields].sort((a, b) => a.expiresAt - b.expiresAt);
    }, [lootFields]);

    const activeSalvageMissions = gameState.activeMissions.filter(m => m.type === 'SALVAGE');

    const handleStartSalvage = () => {
        if (selectedLootId && droneCount > 0) {
            onStartMission(selectedLootId, droneCount);
            setDroneCount(0);
            setSelectedLootId(null);
        }
    };
    
    const calculateRequiredDrones = (field: LogisticLootField) => {
        // Simplified value calculation for drone requirement
        // value = money + oil*10 + ammo*5
        let weightedValue = 0;
        weightedValue += (field.resources[ResourceType.MONEY] || 0) * 1;
        weightedValue += (field.resources[ResourceType.OIL] || 0) * 10;
        weightedValue += (field.resources[ResourceType.AMMO] || 0) * 5;
        
        return Math.ceil(weightedValue / SALVAGER_CARGO_CAPACITY);
    };

    return (
        <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out] min-h-full pb-20">
            <header className="flex flex-col gap-2">
                <h1 className="text-2xl font-tech text-yellow-400 uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(250,204,21,0.3)]">
                    Zona de Salvamento
                </h1>
                <p className="text-slate-400 text-xs font-mono tracking-wider">
                    Recuperación de materiales y logística de campo
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LIST OF LOOT FIELDS */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <section className="glass-panel rounded-xl border border-white/10 overflow-hidden flex flex-col">
                        <div className="p-4 bg-black/40 border-b border-white/10 flex justify-between items-center">
                            <h2 className="font-tech text-yellow-500 uppercase tracking-widest text-sm flex items-center gap-2">
                                <Icons.Radar /> Botines Disponibles
                            </h2>
                            <span className="text-[10px] text-slate-500 font-bold bg-black/50 px-2 py-1 rounded border border-white/5 uppercase tracking-widest">
                                Activos: {sortedFields.length}
                            </span>
                        </div>

                        <div className="p-4 flex flex-col gap-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                            {sortedFields.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-4 text-slate-500 opacity-50">
                                    <Icons.Radar className="w-12 h-12" />
                                    <span className="text-xs font-mono uppercase tracking-widest">No hay botín logístico detectado</span>
                                </div>
                            ) : (
                                sortedFields.map(field => {
                                    const isSelected = selectedLootId === field.id;
                                    const reqDrones = calculateRequiredDrones(field);
                                    const timeRemaining = Math.max(0, field.expiresAt - Date.now());
                                    
                                    return (
                                        <div 
                                            key={field.id}
                                            onClick={() => setSelectedLootId(field.id)}
                                            className={`
                                                p-4 rounded-lg border transition-all cursor-pointer group
                                                ${isSelected 
                                                    ? 'bg-yellow-500/10 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' 
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10'}
                                            `}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex flex-col">
                                                    <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-yellow-400' : 'text-slate-200'}`}>
                                                        {field.origin === 'WAR' ? 'Escombros de Guerra' : 'Restos de Batalla'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-mono">
                                                        Origen: {field.attackerName} vs {field.defenderName}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] text-yellow-500/80 font-mono uppercase tracking-tight">
                                                        Expira en: {formatDuration(timeRemaining)}
                                                    </span>
                                                    {field.isPartiallyHarvested && (
                                                        <span className="text-[9px] text-emerald-400 uppercase font-bold tracking-tighter">Parcialmente Recogido</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 mb-4">
                                                <div className="flex flex-col items-center bg-black/40 p-2 rounded border border-white/5">
                                                    <span className="text-[9px] text-slate-500 uppercase tracking-tighter mb-1">Dinero</span>
                                                    <span className="text-xs font-bold text-white">${formatNumber(field.resources[ResourceType.MONEY] || 0)}</span>
                                                </div>
                                                <div className="flex flex-col items-center bg-black/40 p-2 rounded border border-white/5">
                                                    <span className="text-[9px] text-slate-500 uppercase tracking-tighter mb-1">Petróleo</span>
                                                    <span className="text-xs font-bold text-white">{formatNumber(field.resources[ResourceType.OIL] || 0)}</span>
                                                </div>
                                                <div className="flex flex-col items-center bg-black/40 p-2 rounded border border-white/5">
                                                    <span className="text-[9px] text-slate-500 uppercase tracking-tighter mb-1">Munición</span>
                                                    <span className="text-xs font-bold text-white">{formatNumber(field.resources[ResourceType.AMMO] || 0)}</span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    Recomendado: <span className="text-yellow-500">{reqDrones}</span> Drones
                                                </span>
                                                {isSelected && (
                                                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shadow-[0_0_8px_#eab308]"></div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </section>

                    {/* ACTIVE MISSIONS */}
                    <section className="glass-panel rounded-xl border border-white/10 overflow-hidden flex flex-col">
                        <div className="p-4 bg-black/40 border-b border-white/10">
                            <h2 className="font-tech text-emerald-500 uppercase tracking-widest text-sm flex items-center gap-2">
                                <Icons.Army /> Operaciones de Salvamento
                            </h2>
                        </div>
                        <div className="p-4 flex flex-col gap-2">
                            {activeSalvageMissions.length === 0 ? (
                                <span className="text-xs text-slate-500 font-mono italic">No hay misiones de recolección en curso</span>
                            ) : (
                                activeSalvageMissions.map(m => (
                                    <div key={m.id} className="flex justify-between items-center p-3 bg-white/5 rounded border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="text-emerald-400"><Icons.Army /></div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-white">Recuperando Suministros</span>
                                                <span className="text-[9px] text-slate-500 font-mono uppercase tracking-tighter">
                                                    {m.units[UnitType.SALVAGER_DRONE]} Drones Desplegados
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-bold text-emerald-400 font-mono">
                                                {formatDuration(Math.max(0, m.endTime - Date.now()))}
                                            </span>
                                            <div className="w-24 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                                <div 
                                                    className="h-full bg-emerald-500 animate-[pulse_2s_infinite]"
                                                    style={{ width: `${Math.min(100, 100 - ((m.endTime - Date.now()) / (m.duration * 60000)) * 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                {/* CONTROL PANEL */}
                <div className="flex flex-col gap-4">
                    <section className="glass-panel rounded-xl border border-white/10 overflow-hidden sticky top-4">
                        <div className="p-4 bg-black/40 border-b border-white/10">
                            <h2 className="font-tech text-cyan-400 uppercase tracking-widest text-sm flex items-center gap-2">
                                <Icons.Settings /> Centro de Control
                            </h2>
                        </div>
                        <div className="p-6 flex flex-col gap-6">
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest">
                                    <span className="text-slate-400">Drones Disponibles</span>
                                    <span className={availableDrones > 0 ? 'text-cyan-400' : 'text-red-400'}>
                                        {availableDrones} Unidades
                                    </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-cyan-500"
                                        style={{ width: `${Math.min(100, (availableDrones / Math.max(1, availableDrones + totalSelectedDrones)) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4 bg-black/40 p-4 rounded-lg border border-white/5">
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest text-center">Configurar Recolección</span>
                                
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-300 uppercase tracking-tight font-mono">Cantidad:</span>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => setDroneCount(Math.max(0, droneCount - 1))}
                                                className="w-8 h-8 bg-white/5 border border-white/10 rounded flex items-center justify-center hover:bg-white/10 text-slate-300"
                                            >-</button>
                                            <input 
                                                type="number"
                                                value={droneCount}
                                                onChange={(e) => setDroneCount(Math.max(0, Math.min(availableDrones, parseInt(e.target.value) || 0)))}
                                                className="w-16 bg-black border border-white/20 rounded px-2 py-1 text-center text-sm font-mono text-cyan-400 focus:outline-none focus:border-cyan-500"
                                            />
                                            <button 
                                                onClick={() => setDroneCount(Math.min(availableDrones, droneCount + 1))}
                                                className="w-8 h-8 bg-white/5 border border-white/10 rounded flex items-center justify-center hover:bg-white/10 text-slate-300"
                                            >+</button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-1">
                                        {[0.25, 0.5, 0.75, 1].map(pct => (
                                            <button 
                                                key={pct}
                                                onClick={() => setDroneCount(Math.floor(availableDrones * pct))}
                                                className="text-[9px] bg-white/5 hover:bg-white/10 py-1 rounded border border-white/5 text-slate-400 font-bold"
                                            >
                                                {pct * 100}%
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="border-t border-white/10 pt-3 mt-1">
                                    <div className="flex justify-between text-[10px] font-mono mb-1">
                                        <span className="text-slate-500 uppercase">Capacidad Total:</span>
                                        <span className="text-emerald-400 font-bold tracking-tighter">
                                            ${formatNumber(droneCount * SALVAGER_CARGO_CAPACITY)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <GlassButton
                                onClick={handleStartSalvage}
                                disabled={!selectedLootId || droneCount <= 0 || availableDrones < droneCount}
                                color="yellow"
                                className="w-full py-4 uppercase font-bold tracking-widest text-xs"
                            >
                                Iniciar Salvamento
                            </GlassButton>
                            
                            {!selectedLootId && (
                                <span className="text-[9px] text-yellow-500/60 text-center uppercase tracking-widest font-bold animate-pulse">Seleccione un botín para proceder</span>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

// Helper for total selected drones in active missions (not used but kept for logic)
const totalSelectedDrones = 0;
