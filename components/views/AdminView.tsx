import React from 'react';
import { GameState, ResourceType, UnitType } from '../../types';
import { Icons } from '../UIComponents';
import { formatNumber } from '../../utils';
import { useAuth } from '../../context/AuthContext';

interface AdminViewProps {
    gameState: GameState;
    onUpdateState: (newState: GameState) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ gameState, onUpdateState }) => {
    const { role } = useAuth();

    if (role !== 'admin' && role !== 'dev') {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <Icons.Warning className="w-16 h-16 text-red-500 mb-4 animate-pulse" />
                <h2 className="text-2xl font-tech text-white uppercase tracking-widest mb-2">Access Denied</h2>
                <p className="text-slate-400 max-w-md">This console is restricted to high-ranking command personnel only.</p>
            </div>
        );
    }

    const addResources = (type: ResourceType, amount: number) => {
        const newState = {
            ...gameState,
            resources: {
                ...gameState.resources,
                [type]: gameState.resources[type] + amount
            }
        };
        onUpdateState(newState);
    };

    const addUnits = (type: UnitType, amount: number) => {
        const newState = {
            ...gameState,
            units: {
                ...gameState.units,
                [type]: (gameState.units[type] || 0) + amount
            }
        };
        onUpdateState(newState);
    };

    const resetCooldowns = () => {
        const newState = {
            ...gameState,
            nextAttackTime: 0,
            lastEnemyAttackCheckTime: 0,
            lastEnemyAttackResetTime: 0
        };
        onUpdateState(newState);
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="glass-panel p-6 rounded-2xl border border-red-500/30 bg-red-950/10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/50">
                        <Icons.Settings className="w-6 h-6 text-red-400 animate-spin-slow" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-tech text-white uppercase tracking-tighter">Strategic Command Console</h2>
                        <p className="text-red-400/60 text-xs font-mono uppercase tracking-widest">Authorized Personnel: {role?.toUpperCase()}</p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Resources Section */}
                <section className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Icons.Base className="w-4 h-4" /> Logistics Overload
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.values(ResourceType).map(type => (
                            <div key={type} className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">{type}</span>
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-cyan-400">{formatNumber(gameState.resources[type])}</span>
                                    <button 
                                        onClick={() => addResources(type, 1000000)}
                                        className="bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 text-[10px] px-2 py-1 rounded border border-cyan-500/30 transition-colors"
                                    >
                                        +1M
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Units Section */}
                <section className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Icons.Army className="w-4 h-4" /> Instant Deployment
                    </h3>
                    <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {Object.values(UnitType).map(type => (
                            <div key={type} className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">{type.replace('_', ' ')}</span>
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-emerald-400">{formatNumber(gameState.units[type] || 0)}</span>
                                    <button 
                                        onClick={() => addUnits(type, 100)}
                                        className="bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 text-[10px] px-2 py-1 rounded border border-emerald-500/30 transition-colors"
                                    >
                                        +100
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* System Controls */}
                <section className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Icons.Radar className="w-4 h-4" /> System Override
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        <button 
                            onClick={resetCooldowns}
                            className="bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 text-xs px-4 py-2 rounded-xl border border-purple-500/30 transition-colors flex items-center gap-2"
                        >
                            <Icons.Check className="w-4 h-4" /> Reset Cooldowns
                        </button>
                        <button 
                            onClick={() => onUpdateState({...gameState, empirePoints: gameState.empirePoints + 10000})}
                            className="bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 text-xs px-4 py-2 rounded-xl border border-yellow-500/30 transition-colors flex items-center gap-2"
                        >
                            <Icons.Crown className="w-4 h-4" /> +10k Empire Points
                        </button>
                    </div>
                </section>

                {/* Info Section */}
                <section className="glass-panel p-6 rounded-2xl border border-white/10 bg-cyan-950/5">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Session Info</h3>
                    <div className="space-y-2 font-mono text-[10px]">
                        <div className="flex justify-between">
                            <span className="text-slate-500">PEER ID:</span>
                            <span className="text-white truncate max-w-[200px]">{gameState.peerId}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">ROLE:</span>
                            <span className="text-red-400 font-bold">{role?.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">SERVER STATUS:</span>
                            <span className="text-emerald-400">OPERATIONAL</span>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};
