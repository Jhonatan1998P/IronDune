import React, { useState, useMemo, useEffect } from 'react';
import { UNIT_DEFS } from '../../data/units';
import { UnitType, BattleResult, UnitDef, TranslationDictionary, LogEntry } from '../../types';
import { calculateCombatStats, simulateCombat } from '../../hooks/useGameEngine';
import { useLanguage } from '../../context/LanguageContext';
import { Icons } from '../UIComponents';
import { formatNumber } from '../../utils';
import { CombatReportContent } from '../reports/CombatReportModal';
import { UNIT_PRIORITY } from '../../utils/engine/combat';

const UnitRow = React.memo(({ def, count, side, onChange, onSet, t }: { 
    def: UnitDef, 
    count: number, 
    side: 'player' | 'enemy', 
    onChange: (side: 'player' | 'enemy', uType: UnitType, delta: number) => void, 
    onSet: (side: 'player' | 'enemy', uType: UnitType, val: number) => void,
    t: TranslationDictionary 
}) => {
    const isPlayer = side === 'player';
    const colorClass = isPlayer ? 'text-cyan-400' : 'text-red-400';
    const bgClass = isPlayer ? 'hover:bg-cyan-500/5 border-l-cyan-500/0 hover:border-l-cyan-500/50' : 'hover:bg-red-500/5 border-l-red-500/0 hover:border-l-red-500/50';

    return (
        <div className={`flex items-center justify-between p-3 md:p-2 rounded-lg md:rounded-r border border-white/5 md:border-t-0 md:border-r-0 md:border-l-2 transition-all ${bgClass} ${count > 0 ? (isPlayer ? 'bg-cyan-900/10 border-cyan-500/50 md:border-l-cyan-500' : 'bg-red-900/10 border-red-500/50 md:border-l-red-500') : 'bg-slate-900/40 md:bg-transparent md:border-l-transparent'}`}>
            <div className="flex flex-col gap-1">
                <span className={`text-sm md:text-xs font-bold ${count > 0 ? 'text-white' : 'text-slate-500'}`}>
                    {t.units[def.translationKey]?.name}
                </span>
                <div className="flex items-center gap-2 text-[10px] md:text-[9px] text-slate-500 font-mono">
                    <span className="flex items-center gap-0.5" title={t.common.stats.attack}>
                        <Icons.Stats.Attack className="w-3 h-3 text-red-400/80" /> {formatNumber(def.attack)}
                    </span>
                    <span className="flex items-center gap-0.5" title={t.common.stats.defense}>
                        <Icons.Stats.Defense className="w-3 h-3 text-blue-400/80" /> {def.defense}
                    </span>
                    <span className="flex items-center gap-0.5" title={t.common.stats.hp}>
                        <Icons.Stats.Hp className="w-3 h-3 text-emerald-400/80" /> {formatNumber(def.hp)}
                    </span>
                </div>
            </div>
            
            <div className="flex items-center gap-2 md:gap-1">
                <button 
                    onClick={() => onChange(side, def.id, -1)} 
                    className="w-8 h-8 md:w-6 md:h-6 flex items-center justify-center text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded border border-white/10"
                >
                    -
                </button>
                <input 
                    type="number"
                    value={count === 0 ? '' : count}
                    onChange={(e) => {
                        const val = parseInt(e.target.value);
                        onSet(side, def.id, isNaN(val) ? 0 : val);
                    }}
                    placeholder="0"
                    className={`w-12 md:w-10 bg-transparent text-center font-mono text-base md:text-sm font-bold focus:outline-none border-b border-transparent focus:border-white/20 transition-colors ${count > 0 ? colorClass : 'text-slate-600'}`}
                />
                <button 
                    onClick={() => onChange(side, def.id, 1)} 
                    className={`w-8 h-8 md:w-6 md:h-6 flex items-center justify-center rounded border border-white/10 bg-white/5 hover:bg-white/10 ${isPlayer ? 'text-cyan-500 hover:text-cyan-300' : 'text-red-500 hover:text-red-300'}`}
                >
                    +
                </button>
            </div>
        </div>
    )
});

interface HistoryEntry {
    id: string;
    timestamp: number;
    playerUnits: Partial<Record<UnitType, number>>;
    enemyUnits: Partial<Record<UnitType, number>>;
    result: BattleResult;
}

interface BattleSimulatorViewProps {
    initialEnemyArmy?: Partial<Record<UnitType, number>> | null;
}

export const BattleSimulatorView: React.FC<BattleSimulatorViewProps> = ({ initialEnemyArmy }) => {
    const { t } = useLanguage();
    const [playerUnits, setPlayerUnits] = useState<Partial<Record<UnitType, number>>>({});
    const [enemyUnits, setEnemyUnits] = useState<Partial<Record<UnitType, number>>>({});
    const [result, setResult] = useState<BattleResult | null>(null);
    const [activeTab, setActiveTab] = useState<'player' | 'enemy'>('player');
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        if (initialEnemyArmy) {
            setEnemyUnits(initialEnemyArmy);
            setActiveTab('player'); 
            setResult(null); 
        }
    }, [initialEnemyArmy]);

    const handleUnitChange = (side: 'player' | 'enemy', uType: UnitType, delta: number) => {
        const setter = side === 'player' ? setPlayerUnits : setEnemyUnits;
        setter(prev => {
            const curr = prev[uType] || 0;
            const next = Math.max(0, curr + delta);
            if (next === 0) {
                const newUnits = { ...prev };
                delete newUnits[uType];
                return newUnits;
            }
            return { ...prev, [uType]: next };
        });
    };

    const handleUnitSet = (side: 'player' | 'enemy', uType: UnitType, val: number) => {
        const setter = side === 'player' ? setPlayerUnits : setEnemyUnits;
        setter(prev => {
            const next = Math.max(0, val);
            if (next === 0) {
                const newUnits = { ...prev };
                delete newUnits[uType];
                return newUnits;
            }
            return { ...prev, [uType]: next };
        });
    };

    const playerStats = useMemo(() => calculateCombatStats(playerUnits), [playerUnits]);
    const enemyStats = useMemo(() => calculateCombatStats(enemyUnits), [enemyUnits]);

    const handleSimulate = () => {
        const res = simulateCombat(playerUnits, enemyUnits);
        setResult(res);
    };

    const saveToHistory = () => {
        if (!result) return;
        
        const newEntry: HistoryEntry = {
            id: `sim-${Date.now()}`,
            timestamp: Date.now(),
            playerUnits: { ...playerUnits },
            enemyUnits: { ...enemyUnits },
            result: result
        };

        setHistory(prev => {
            return [newEntry, ...prev].slice(0, 10);
        });
        
        setResult(null);
    };

    const loadHistoryEntry = (entry: HistoryEntry) => {
        setPlayerUnits(entry.playerUnits);
        setEnemyUnits(entry.enemyUnits);
        setResult(entry.result);
        setShowHistory(false);
    };

    const reset = () => {
        setPlayerUnits({});
        setEnemyUnits({});
        setResult(null);
    }

    const playerPower = playerStats.attack + playerStats.hp;
    const enemyPower = enemyStats.attack + enemyStats.hp;
    const totalPower = playerPower + enemyPower;
    const playerRatio = totalPower === 0 ? 50 : (playerPower / totalPower) * 100;

    const simLogEntry: LogEntry | null = result ? {
        id: `sim-${Date.now()}`,
        type: 'combat',
        timestamp: Date.now(),
        messageKey: result.winner === 'PLAYER' ? 'log_battle_win' : 'log_battle_loss',
        archived: false,
        params: {
            combatResult: result
        }
    } : null;

    return (
        <div className="flex flex-col h-full animate-[fadeIn_0.3s_ease-out] relative">
            
            {showHistory && (
                <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-tech text-white uppercase tracking-widest">{t.simulator.history_title}</h3>
                            <button onClick={() => setShowHistory(false)}><Icons.Close /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {history.length === 0 ? (
                                <div className="text-center text-slate-500 py-8 text-xs italic">{t.simulator.history_empty}</div>
                            ) : (
                                history.map(entry => (
                                    <div key={entry.id} className="bg-white/5 p-3 rounded hover:bg-white/10 flex justify-between items-center cursor-pointer border border-transparent hover:border-white/10 transition-colors" onClick={() => loadHistoryEntry(entry)}>
                                        <div>
                                            <div className={`text-xs font-bold ${entry.result.winner === 'PLAYER' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {entry.result.winner === 'PLAYER' ? t.simulator.win : t.simulator.loss}
                                            </div>
                                            <div className="text-[10px] text-slate-500">{new Date(entry.timestamp).toLocaleString()}</div>
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono text-right">
                                            <div>{formatNumber(calculateCombatStats(entry.playerUnits).attack + calculateCombatStats(entry.playerUnits).hp)} {t.simulator.pwr_abbr}</div>
                                            <div>{t.simulator.vs} {formatNumber(calculateCombatStats(entry.enemyUnits).attack + calculateCombatStats(entry.enemyUnits).hp)} {t.simulator.pwr_abbr}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="shrink-0 glass-panel border-b border-white/10 p-4 z-20 bg-slate-900/95 backdrop-blur sticky top-0">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-tech text-lg text-white uppercase tracking-widest flex items-center gap-2">
                        <Icons.Radar /> {t.simulator.title}
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={() => setShowHistory(true)} className="text-[10px] text-slate-400 hover:text-cyan-400 uppercase tracking-wider bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded border border-white/5 transition-colors font-bold flex items-center gap-1">
                            <span className="text-lg leading-none">↺</span> {t.simulator.history_btn}
                        </button>
                        <button onClick={reset} className="text-[10px] text-slate-400 hover:text-white uppercase tracking-wider bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded border border-white/5 transition-colors font-bold">
                            {t.common.actions.reset_sim}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-mono font-bold uppercase tracking-wider">
                        <span className="text-cyan-400">{t.common.ui.blue_team}</span>
                        <span className="text-red-400">{t.common.ui.red_team}</span>
                    </div>
                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex border border-white/10 relative">
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-black z-10 opacity-50"></div>
                        <div 
                            className="h-full bg-cyan-500 transition-all duration-500 ease-out shadow-[0_0_10px_#06b6d4]" 
                            style={{ width: `${playerRatio}%` }}
                        ></div>
                        <div className="flex-1 bg-red-600 transition-all duration-500 ease-out shadow-[0_0_10px_#dc2626]"></div>
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-slate-500">
                        <span>{t.simulator.pwr_abbr}: {playerPower.toLocaleString()}</span>
                        <span>{t.simulator.pwr_abbr}: {enemyPower.toLocaleString()}</span>
                    </div>
                </div>
                
                <div className="mt-4 flex md:hidden bg-black/40 rounded p-1 border border-white/5">
                    <button 
                        onClick={() => setActiveTab('player')}
                        className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'player' ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-500/30' : 'text-slate-500'}`}
                    >
                        {t.common.ui.blue_team}
                    </button>
                    <button 
                        onClick={() => setActiveTab('enemy')}
                        className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'enemy' ? 'bg-red-900/40 text-red-300 border border-red-500/30' : 'text-slate-500'}`}
                    >
                        {t.common.ui.red_team}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 md:p-4 custom-scrollbar bg-black/20 pb-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    <div className={`flex flex-col gap-2 ${activeTab === 'player' ? 'block' : 'hidden md:flex'}`}>
                        <div className="hidden md:flex items-center gap-2 mb-1 pb-2 border-b border-cyan-500/20 text-cyan-400 font-tech text-xs uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span> {t.common.ui.blue_team}
                        </div>
                        <div className="space-y-2">
                            {UNIT_PRIORITY.map(uType => {
                                const def = UNIT_DEFS[uType];
                                return (
                                    <UnitRow 
                                        key={def.id} 
                                        def={def} 
                                        count={playerUnits[def.id] || 0} 
                                        side="player" 
                                        onChange={handleUnitChange}
                                        onSet={handleUnitSet}
                                        t={t}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    <div className={`flex flex-col gap-2 ${activeTab === 'enemy' ? 'block' : 'hidden md:flex'}`}>
                        <div className="hidden md:flex items-center gap-2 mb-1 pb-2 border-b border-red-500/20 text-red-400 font-tech text-xs uppercase tracking-widest">
                             <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> {t.common.ui.red_team}
                        </div>
                        <div className="space-y-2">
                            {UNIT_PRIORITY.map(uType => {
                                const def = UNIT_DEFS[uType];
                                return (
                                    <UnitRow 
                                        key={def.id} 
                                        def={def} 
                                        count={enemyUnits[def.id] || 0} 
                                        side="enemy" 
                                        onChange={handleUnitChange} 
                                        onSet={handleUnitSet}
                                        t={t}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="mt-8 mb-24 md:mb-4 px-2">
                    <button 
                        onClick={handleSimulate}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-tech font-bold uppercase tracking-[0.2em] py-4 rounded shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all transform hover:scale-[1.02] active:scale-95"
                    >
                        {t.common.actions.simulate}
                    </button>
                </div>
            </div>

            {result && simLogEntry && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/90 backdrop-blur-xl animate-[fadeIn_0.2s_ease-out] md:p-4">
                    <div className="w-full h-[90vh] md:h-auto md:max-h-[85vh] md:max-w-2xl relative flex flex-col">
                        <div className="bg-slate-900 border-t md:border border-white/10 flex-1 overflow-hidden relative rounded-t-2xl md:rounded-xl shadow-2xl flex flex-col">
                            <div className="flex-1 overflow-hidden relative">
                                <CombatReportContent 
                                    log={simLogEntry} 
                                    t={t} 
                                    embedded={true} 
                                />
                            </div>
                            <div className="p-4 bg-slate-950 border-t border-white/10 shrink-0 flex gap-4">
                                <button 
                                    onClick={() => setResult(null)} 
                                    className="flex-1 py-3 bg-white/10 hover:bg-white/20 active:bg-slate-700 text-white text-xs font-bold uppercase tracking-widest transition-colors rounded"
                                >
                                    {t.common.actions.close}
                                </button>
                                <button 
                                    onClick={saveToHistory} 
                                    className="flex-1 py-3 bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-300 text-xs font-bold uppercase tracking-widest transition-colors rounded shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                                >
                                    {t.simulator.save_result}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}