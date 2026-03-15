
import React, { useState, useMemo, useEffect } from 'react';

/**
 * BattleSimulatorView - Vista del Simulador de Batalla
 */

import { UNIT_DEFS } from '../../data/units';
import { UnitType, BattleResult, UnitDef, TranslationDictionary, LogEntry } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { Icons } from '../UIComponents';
import { formatNumber } from '../../utils';
import { CombatReportContent } from '../reports/CombatReportModal';
import { battleService } from '../../services/battleService';

// Updated to match actual UnitType enum from types/enums.ts
const UNIT_PRIORITY: UnitType[] = [
    UnitType.CYBER_MARINE,
    UnitType.HEAVY_COMMANDO,
    UnitType.SCOUT_TANK,
    UnitType.TITAN_MBT,
    UnitType.WRAITH_GUNSHIP,
    UnitType.ACE_FIGHTER,
    UnitType.AEGIS_DESTROYER,
    UnitType.PHANTOM_SUB,
    UnitType.SALVAGER_DRONE
];

/**
 * Helper to calculate power locally for the UI (estimate)
 */
const calculatePowerLocally = (units: Partial<Record<UnitType, number>>) => {
    let attack = 0;
    let hp = 0;
    Object.entries(units).forEach(([uType, count]) => {
        const def = UNIT_DEFS[uType as UnitType];
        if (def) {
            attack += def.attack * (count || 0);
            hp += def.hp * (count || 0);
        }
    });
    return { attack, hp };
};

/**
 * UnitRow Component
 */
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
    const bgActive = isPlayer ? 'bg-cyan-900/10 border-cyan-500/50' : 'bg-red-900/10 border-red-500/50';
    const bgInactive = 'bg-slate-900/40 border-transparent';
    const hoverBg = isPlayer ? 'hover:bg-cyan-500/5' : 'hover:bg-red-500/5';

    return (
        <div className={`flex items-center justify-between p-2.5 sm:p-2 rounded-lg border transition-all ${count > 0 ? bgActive : bgInactive} ${hoverBg}`}>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className={`text-xs sm:text-[11px] font-bold truncate ${count > 0 ? 'text-white' : 'text-slate-500'}`}>
                    {t.units[def.translationKey]?.name}
                </span>
                <div className="flex items-center gap-1.5 sm:gap-1 text-[9px] sm:text-[10px] text-slate-500 font-mono">
                    <span className="flex items-center gap-0.5 whitespace-nowrap">
                        <Icons.Stats.Attack className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-400/80" /> {formatNumber(def.attack)}
                    </span>
                    <span className="flex items-center gap-0.5 whitespace-nowrap">
                        <Icons.Stats.Defense className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-400/80" /> {def.defense}
                    </span>
                    <span className="flex items-center gap-0.5 whitespace-nowrap">
                        <Icons.Stats.Hp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400/80" /> {formatNumber(def.hp)}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-1 shrink-0">
                <button onClick={() => onChange(side, def.id, -1)} className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors">-</button>
                <input
                    type="number"
                    value={count === 0 ? '' : count}
                    onChange={(e) => onSet(side, def.id, Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0"
                    className={`w-10 sm:w-9 bg-transparent text-center font-mono text-sm sm:text-xs font-bold focus:outline-none border-b border-transparent focus:border-white/20 transition-colors ${count > 0 ? colorClass : 'text-slate-600'}`}
                />
                <button onClick={() => onChange(side, def.id, 1)} className={`w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded border border-white/10 bg-white/5 hover:bg-white/10 transition-colors ${isPlayer ? 'text-cyan-500 hover:text-cyan-300' : 'text-red-500 hover:text-red-300'}`}>+</button>
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
    initialPlayerArmy?: Partial<Record<UnitType, number>> | null;
}

export const BattleSimulatorView: React.FC<BattleSimulatorViewProps> = ({ initialEnemyArmy, initialPlayerArmy }) => {
    const { t } = useLanguage();
    
    const [playerUnits, setPlayerUnits] = useState<Partial<Record<UnitType, number>>>({});
    const [enemyUnits, setEnemyUnits] = useState<Partial<Record<UnitType, number>>>({});
    const [result, setResult] = useState<BattleResult | null>(null);
    const [activeTab, setActiveTab] = useState<'player' | 'enemy'>('player');
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);

    useEffect(() => {
        if (initialEnemyArmy) setEnemyUnits(initialEnemyArmy);
        if (initialPlayerArmy) setPlayerUnits(initialPlayerArmy);
    }, [initialEnemyArmy, initialPlayerArmy]);

    const handleUnitChange = (side: 'player' | 'enemy', uType: UnitType, delta: number) => {
        const setter = side === 'player' ? setPlayerUnits : setEnemyUnits;
        setter(prev => {
            const next = Math.max(0, (prev[uType] || 0) + delta);
            const newState = { ...prev };
            if (next === 0) delete newState[uType];
            else newState[uType] = next;
            return newState;
        });
    };

    const handleUnitSet = (side: 'player' | 'enemy', uType: UnitType, val: number) => {
        const setter = side === 'player' ? setPlayerUnits : setEnemyUnits;
        setter(prev => {
            const newState = { ...prev };
            if (val <= 0) delete newState[uType];
            else newState[uType] = val;
            return newState;
        });
    };

    const playerStats = useMemo(() => calculatePowerLocally(playerUnits), [playerUnits]);
    const enemyStats = useMemo(() => calculatePowerLocally(enemyUnits), [enemyUnits]);

    const handleSimulate = async () => {
        if (isSimulating) return;
        setIsSimulating(true);
        try {
            const res = await battleService.simulateCombat(playerUnits, enemyUnits);
            setResult(res);
        } catch (e) {
            console.error('Simulation error', e);
        } finally {
            setIsSimulating(false);
        }
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
        setHistory(prev => [newEntry, ...prev].slice(0, 10));
        setResult(null);
    };

    const loadHistoryEntry = (entry: HistoryEntry) => {
        setPlayerUnits(entry.playerUnits);
        setEnemyUnits(entry.enemyUnits);
        setResult(entry.result);
        setShowHistory(false);
    };

    const playerPower = playerStats.attack + playerStats.hp;
    const enemyPower = enemyStats.attack + enemyStats.hp;
    const totalPower = playerPower + enemyPower;
    const playerRatio = totalPower === 0 ? 50 : (playerPower / totalPower) * 100;

    const simLogEntry: LogEntry | null = result ? {
        id: `sim-${Date.now()}`,
        type: 'combat',
        timestamp: Date.now(),
        messageKey: result.winner === 'PLAYER' ? 'log_battle_win' : 'log_battle_loss',
        params: { combatResult: result }
    } : null;

    return (
        <div className="flex flex-col min-h-full animate-[fadeIn_0.3s_ease-out] relative w-full">
            {showHistory && (
                <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-xl w-full max-w-sm sm:max-w-md max-h-[75vh] flex flex-col shadow-2xl">
                        <div className="p-3 sm:p-4 border-b border-white/10 flex justify-between items-center shrink-0">
                            <h3 className="font-tech text-sm sm:text-base text-white uppercase tracking-widest">{t.simulator.history_title}</h3>
                            <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-white/5 rounded"><Icons.Close className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                            {history.length === 0 ? (
                                <div className="text-center text-slate-500 py-8 text-xs italic">{t.simulator.history_empty}</div>
                            ) : (
                                history.map(entry => {
                                    const pPwr = calculatePowerLocally(entry.playerUnits);
                                    const ePwr = calculatePowerLocally(entry.enemyUnits);
                                    return (
                                        <div key={entry.id} className="bg-white/5 p-2.5 rounded hover:bg-white/10 flex justify-between items-center cursor-pointer border border-transparent hover:border-white/10 transition-colors" onClick={() => loadHistoryEntry(entry)}>
                                            <div>
                                                <div className={`text-xs font-bold ${entry.result.winner === 'PLAYER' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {entry.result.winner === 'PLAYER' ? t.simulator.win : t.simulator.loss}
                                                </div>
                                                <div className="text-[10px] text-slate-500">{new Date(entry.timestamp).toLocaleString()}</div>
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono text-right">
                                                <div>{formatNumber(pPwr.attack + pPwr.hp)} {t.simulator.pwr_abbr}</div>
                                                <div>{t.simulator.vs} {formatNumber(ePwr.attack + ePwr.hp)} {t.simulator.pwr_abbr}</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="shrink-0 glass-panel border-b border-white/10 p-3 sm:p-4 z-20 bg-slate-900/95 backdrop-blur">
                <div className="flex justify-between items-center gap-2 mb-3 sm:mb-4">
                    <h2 className="font-tech text-base sm:text-lg text-white uppercase tracking-widest flex items-center gap-1.5 sm:gap-2">
                        <Icons.Radar className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden xs:inline">{t.simulator.title}</span>
                    </h2>
                    <div className="flex gap-1.5 sm:gap-2 shrink-0">
                        <button onClick={() => setShowHistory(true)} className="text-[10px] sm:text-[11px] text-slate-400 hover:text-cyan-400 uppercase tracking-wider bg-white/5 hover:bg-white/10 px-2.5 sm:px-3 py-1.5 rounded border border-white/5 transition-colors font-bold flex items-center gap-1">
                            <span className="text-lg leading-none">↺</span> <span className="hidden sm:inline">{t.simulator.history_btn}</span>
                        </button>
                        <button onClick={() => { setPlayerUnits({}); setEnemyUnits({}); setResult(null); }} className="text-[10px] sm:text-[11px] text-slate-400 hover:text-white uppercase tracking-wider bg-white/5 hover:bg-white/10 px-2.5 sm:px-3 py-1.5 rounded border border-white/5 transition-colors font-bold">
                            {t.common.actions.reset_sim}
                        </button>
                    </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider">
                        <span className="text-cyan-400">{t.common.ui.blue_team}</span>
                        <span className="text-red-400">{t.common.ui.red_team}</span>
                    </div>
                    <div className="w-full h-2.5 sm:h-3 bg-slate-800 rounded-full overflow-hidden flex border border-white/10 relative">
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-black z-10 opacity-50"></div>
                        <div className="h-full bg-cyan-500 transition-all duration-500 ease-out shadow-[0_0_10px_#06b6d4]" style={{ width: `${playerRatio}%` }}></div>
                        <div className="flex-1 bg-red-600 transition-all duration-500 ease-out shadow-[0_0_10px_#dc2626]"></div>
                    </div>
                    <div className="flex justify-between text-[9px] sm:text-[10px] font-mono text-slate-500">
                        <span>{t.simulator.pwr_abbr}: {playerPower.toLocaleString()}</span>
                        <span>{t.simulator.pwr_abbr}: {enemyPower.toLocaleString()}</span>
                    </div>
                </div>

                <div className="mt-3 sm:mt-4 flex md:hidden bg-black/40 rounded p-1 border border-white/5">
                    <button onClick={() => setActiveTab('player')} className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'player' ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-500/30' : 'text-slate-500'}`}>{t.common.ui.blue_team}</button>
                    <button onClick={() => setActiveTab('enemy')} className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'enemy' ? 'bg-red-900/40 text-red-300 border border-red-500/30' : 'text-slate-500'}`}>{t.common.ui.red_team}</button>
                </div>
            </div>

            <div className="flex flex-col p-2 sm:p-4 gap-3 sm:gap-4 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div className={`flex flex-col gap-2 ${activeTab === 'player' ? 'block' : 'hidden md:flex'}`}>
                        <div className="hidden md:flex items-center gap-2 mb-1 pb-2 border-b border-cyan-500/20 text-cyan-400 font-tech text-xs uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span> {t.common.ui.blue_team}
                        </div>
                        <div className="space-y-1.5">
                            {UNIT_PRIORITY.map(uType => {
                                const def = UNIT_DEFS[uType];
                                if (!def) return null;
                                return <UnitRow key={def.id} def={def} count={playerUnits[def.id] || 0} side="player" onChange={handleUnitChange} onSet={handleUnitSet} t={t} />;
                            })}
                        </div>
                    </div>

                    <div className={`flex flex-col gap-2 ${activeTab === 'enemy' ? 'block' : 'hidden md:flex'}`}>
                        <div className="hidden md:flex items-center gap-2 mb-1 pb-2 border-b border-red-500/20 text-red-400 font-tech text-xs uppercase tracking-widest">
                             <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> {t.common.ui.red_team}
                        </div>
                        <div className="space-y-1.5">
                            {UNIT_PRIORITY.map(uType => {
                                const def = UNIT_DEFS[uType];
                                if (!def) return null;
                                return <UnitRow key={def.id} def={def} count={enemyUnits[def.id] || 0} side="enemy" onChange={handleUnitChange} onSet={handleUnitSet} t={t} />;
                            })}
                        </div>
                    </div>
                </div>

                <div className="mt-6 mb-20 md:mb-4 px-1 sm:px-2">
                    <button
                        onClick={handleSimulate}
                        disabled={isSimulating}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-tech font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] py-3 sm:py-4 rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 transition-all transform hover:scale-[1.02] active:scale-95 text-sm sm:text-base"
                    >
                        {isSimulating ? 'SIMULATING...' : t.common.actions.simulate}
                    </button>
                </div>
            </div>

            {result && simLogEntry && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/90 backdrop-blur-xl animate-[fadeIn_0.2s_ease-out]">
                    <div className="w-full h-[85vh] md:h-auto md:max-h-[85vh] md:max-w-2xl relative flex flex-col">
                        <div className="bg-slate-900 border-t md:border border-white/10 overflow-hidden relative rounded-t-2xl md:rounded-xl shadow-2xl flex flex-col max-h-full">
                            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 custom-scrollbar">
                                <CombatReportContent log={simLogEntry} t={t} embedded={true} onClose={() => setResult(null)} />
                            </div>
                            <div className="p-3 sm:p-4 bg-slate-950 border-t border-white/10 shrink-0 flex gap-2 sm:gap-4">
                                <button onClick={() => setResult(null)} className="flex-1 py-2.5 sm:py-3 bg-white/10 hover:bg-white/20 active:bg-slate-700 text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-colors rounded">{t.common.actions.close}</button>
                                <button onClick={saveToHistory} className="flex-1 py-2.5 sm:py-3 bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-300 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-colors rounded shadow-[0_0_10px_rgba(6,182,212,0.2)]">{t.simulator.save_result}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
