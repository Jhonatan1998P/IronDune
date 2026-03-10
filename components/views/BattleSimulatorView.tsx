import React, { useState, useMemo, useEffect } from 'react';

/**
 * BattleSimulatorView - Vista del Simulador de Batalla
 * 
 * Componentes principales:
 * - Sección 1: Panel de Control - Título, botones de acción y barra de poder
 * - Sección 2: Configuración de Ejércitos - Listas de unidades del jugador y enemigo
 * - Sección 3: Modal de Resultado - Reporte detallado de la batalla simulada
 * 
 * Características:
 * - Comparación visual de poder entre equipos
 * - Configuración de unidades con controles de cantidad
 * - Simulación de combate con resultado detallado
 * - Historial de simulaciones guardadas
 */

import { UNIT_DEFS } from '../../data/units';
import { UnitType, BattleResult, UnitDef, TranslationDictionary, LogEntry } from '../../types';
import { calculateCombatStats, simulateCombat } from '../../hooks/useGameEngine';
import { useLanguage } from '../../context/LanguageContext';
import { Icons } from '../UIComponents';
import { formatNumber } from '../../utils';
import { CombatReportContent } from '../reports/CombatReportModal';
import { UNIT_PRIORITY } from '../../utils/engine/combat';

/**
 * UnitRow
 * Componente de fila de unidad en el simulador
 * Muestra stats y controles de cantidad
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
            {/* Info: Nombre + Stats */}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className={`text-xs sm:text-[11px] font-bold truncate ${count > 0 ? 'text-white' : 'text-slate-500'}`}>
                    {t.units[def.translationKey]?.name}
                </span>
                <div className="flex items-center gap-1.5 sm:gap-1 text-[9px] sm:text-[10px] text-slate-500 font-mono">
                    <span className="flex items-center gap-0.5 whitespace-nowrap" title={t.common.stats.attack}>
                        <Icons.Stats.Attack className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-400/80" /> {formatNumber(def.attack)}
                    </span>
                    <span className="flex items-center gap-0.5 whitespace-nowrap" title={t.common.stats.defense}>
                        <Icons.Stats.Defense className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-400/80" /> {def.defense}
                    </span>
                    <span className="flex items-center gap-0.5 whitespace-nowrap" title={t.common.stats.hp}>
                        <Icons.Stats.Hp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400/80" /> {formatNumber(def.hp)}
                    </span>
                </div>
            </div>

            {/* Controles: - [input] + */}
            <div className="flex items-center gap-1.5 sm:gap-1 shrink-0">
                <button
                    onClick={() => onChange(side, def.id, -1)}
                    className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors"
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
                    className={`w-10 sm:w-9 bg-transparent text-center font-mono text-sm sm:text-xs font-bold focus:outline-none border-b border-transparent focus:border-white/20 transition-colors ${count > 0 ? colorClass : 'text-slate-600'}`}
                />
                <button
                    onClick={() => onChange(side, def.id, 1)}
                    className={`w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded border border-white/10 bg-white/5 hover:bg-white/10 transition-colors ${isPlayer ? 'text-cyan-500 hover:text-cyan-300' : 'text-red-500 hover:text-red-300'}`}
                >
                    +
                </button>
            </div>
        </div>
    )
});

/* ============================================
   INTERFAZ: HistoryEntry
   Representa una simulación guardada en el historial
   ============================================ */
interface HistoryEntry {
    id: string;                                                    // ID único de la entrada
    timestamp: number;                                             // Fecha/hora de la simulación
    playerUnits: Partial<Record<UnitType, number>>;                // Unidades del jugador
    enemyUnits: Partial<Record<UnitType, number>>;                 // Unidades del enemigo
    result: BattleResult;                                          // Resultado de la batalla
}

/* ============================================
   INTERFAZ: BattleSimulatorViewProps
   Props del componente principal del simulador
   ============================================ */
interface BattleSimulatorViewProps {
    initialEnemyArmy?: Partial<Record<UnitType, number>> | null;  // Ejército enemigo inicial (para simular desde informes)
    initialPlayerArmy?: Partial<Record<UnitType, number>> | null;  // Ejército del jugador inicial (para simular desde informes)
}

/**
 * Componente principal de la vista del simulador de batalla
 * Permite configurar ejércitos y simular batallas
 */
export const BattleSimulatorView: React.FC<BattleSimulatorViewProps> = ({ initialEnemyArmy, initialPlayerArmy }) => {
    const { t } = useLanguage();
    
    // --- ESTADO ---
    const [playerUnits, setPlayerUnits] = useState<Partial<Record<UnitType, number>>>({});   // Unidades del jugador
    const [enemyUnits, setEnemyUnits] = useState<Partial<Record<UnitType, number>>>({});    // Unidades del enemigo
    const [result, setResult] = useState<BattleResult | null>(null);                         // Resultado de la simulación
    const [activeTab, setActiveTab] = useState<'player' | 'enemy'>('player');               // Pestaña activa (mobile)
    const [history, setHistory] = useState<HistoryEntry[]>([]);                            // Historial de simulaciones
    const [showHistory, setShowHistory] = useState(false);                                 // Mostrar/ocultar modal de historial

    // --- EFECTOS ---
    /**
     * Effect: Cargar ejército enemigo inicial
     * Cuando viene de un informe de batalla
     */
    useEffect(() => {
        if (initialEnemyArmy) {
            setEnemyUnits(initialEnemyArmy);
            setActiveTab('player'); 
            setResult(null); 
        }
    }, [initialEnemyArmy]);

    useEffect(() => {
        if (initialPlayerArmy) {
            setPlayerUnits(initialPlayerArmy);
        }
    }, [initialPlayerArmy]);

    // --- HANDLERS ---
    /**
     * handleUnitChange
     * Cambia la cantidad de unidades (+/-)
     */
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

    /**
     * handleUnitSet
     * Establece la cantidad exacta de unidades
     */
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

    // --- CÁLCULOS ---
    /**
     * playerStats
     * Calcula los stats combinados del ejército del jugador
     */
    const playerStats = useMemo(() => calculateCombatStats(playerUnits), [playerUnits]);
    
    /**
     * enemyStats
     * Calcula los stats combinados del ejército enemigo
     */
    const enemyStats = useMemo(() => calculateCombatStats(enemyUnits), [enemyUnits]);

    /**
     * handleSimulate
     * Ejecuta la simulación de batalla
     */
    const handleSimulate = () => {
        const res = simulateCombat(playerUnits, enemyUnits);
        setResult(res);
    };

    /**
     * saveToHistory
     * Guarda la simulación actual en el historial
     */
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
            return [newEntry, ...prev].slice(0, 10);  // Máximo 10 entradas
        });
        
        setResult(null);
    };

    /**
     * loadHistoryEntry
     * Carga una entrada del historial
     */
    const loadHistoryEntry = (entry: HistoryEntry) => {
        setPlayerUnits(entry.playerUnits);
        setEnemyUnits(entry.enemyUnits);
        setResult(entry.result);
        setShowHistory(false);
    };

    /**
     * reset
     * Reinicia todos los valores del simulador
     */
    const reset = () => {
        setPlayerUnits({});
        setEnemyUnits({});
        setResult(null);
    }

    // --- CÁLCULOS ADICIONALES ---
    /**
     * playerPower
     * Poder total del ejército del jugador
     */
    const playerPower = playerStats.attack + playerStats.hp;
    
    /**
     * enemyPower
     * Poder total del ejército enemigo
     */
    const enemyPower = enemyStats.attack + enemyStats.hp;
    const totalPower = playerPower + enemyPower;
    const playerRatio = totalPower === 0 ? 50 : (playerPower / totalPower) * 100;

    /**
     * simLogEntry
     * Prepara el LogEntry para el modal de resultado
     */
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

    // --- RENDERIZADO ---
    /**
     * Renderizado principal del simulador de batalla
     */
    return (
        <div className="flex flex-col min-h-full animate-[fadeIn_0.3s_ease-out] relative w-full">
            
            {/* MODAL: Historial */}
            {showHistory && (
                <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-xl w-full max-w-sm sm:max-w-md max-h-[75vh] sm:max-h-[80vh] flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-3 sm:p-4 border-b border-white/10 flex justify-between items-center shrink-0">
                            <h3 className="font-tech text-sm sm:text-base text-white uppercase tracking-widest">{t.simulator.history_title}</h3>
                            <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-white/5 rounded"><Icons.Close className="w-5 h-5" /></button>
                        </div>
                        {/* Lista */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                            {history.length === 0 ? (
                                <div className="text-center text-slate-500 py-8 text-xs italic">{t.simulator.history_empty}</div>
                            ) : (
                                history.map(entry => (
                                    <div key={entry.id} className="bg-white/5 p-2.5 rounded hover:bg-white/10 flex justify-between items-center cursor-pointer border border-transparent hover:border-white/10 transition-colors" onClick={() => loadHistoryEntry(entry)}>
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

            {/* PANEL SUPERIOR: Título, botones y barra de poder */}
            <div className="shrink-0 glass-panel border-b border-white/10 p-3 sm:p-4 z-20 bg-slate-900/95 backdrop-blur">
                {/* Título y botones */}
                <div className="flex justify-between items-center gap-2 mb-3 sm:mb-4">
                    <h2 className="font-tech text-base sm:text-lg text-white uppercase tracking-widest flex items-center gap-1.5 sm:gap-2">
                        <Icons.Radar className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden xs:inline">{t.simulator.title}</span>
                    </h2>
                    <div className="flex gap-1.5 sm:gap-2 shrink-0">
                        <button onClick={() => setShowHistory(true)} className="text-[10px] sm:text-[11px] text-slate-400 hover:text-cyan-400 uppercase tracking-wider bg-white/5 hover:bg-white/10 px-2.5 sm:px-3 py-1.5 rounded border border-white/5 transition-colors font-bold flex items-center gap-1">
                            <span className="text-lg leading-none">↺</span> <span className="hidden sm:inline">{t.simulator.history_btn}</span>
                        </button>
                        <button onClick={reset} className="text-[10px] sm:text-[11px] text-slate-400 hover:text-white uppercase tracking-wider bg-white/5 hover:bg-white/10 px-2.5 sm:px-3 py-1.5 rounded border border-white/5 transition-colors font-bold">
                            {t.common.actions.reset_sim}
                        </button>
                    </div>
                </div>

                {/* Barra de poder relativo */}
                <div className="space-y-1.5 sm:space-y-2">
                    {/* Labels */}
                    <div className="flex justify-between text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider">
                        <span className="text-cyan-400">{t.common.ui.blue_team}</span>
                        <span className="text-red-400">{t.common.ui.red_team}</span>
                    </div>
                    {/* Barra */}
                    <div className="w-full h-2.5 sm:h-3 bg-slate-800 rounded-full overflow-hidden flex border border-white/10 relative">
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-black z-10 opacity-50"></div>
                        <div
                            className="h-full bg-cyan-500 transition-all duration-500 ease-out shadow-[0_0_10px_#06b6d4]"
                            style={{ width: `${playerRatio}%` }}
                        ></div>
                        <div className="flex-1 bg-red-600 transition-all duration-500 ease-out shadow-[0_0_10px_#dc2626]"></div>
                    </div>
                    {/* Números */}
                    <div className="flex justify-between text-[9px] sm:text-[10px] font-mono text-slate-500">
                        <span>{t.simulator.pwr_abbr}: {playerPower.toLocaleString()}</span>
                        <span>{t.simulator.pwr_abbr}: {enemyPower.toLocaleString()}</span>
                    </div>
                </div>

                {/* Tabs móviles */}
                <div className="mt-3 sm:mt-4 flex md:hidden bg-black/40 rounded p-1 border border-white/5">
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

            {/* PANEL PRINCIPAL: Listas de unidades */}
            <div className="flex flex-col p-2 sm:p-4 gap-3 sm:gap-4 w-full">
                {/* Grid de dos columnas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">

                    {/* LISTA: Unidades del jugador (Equipo Azul) */}
                    <div className={`flex flex-col gap-2 ${activeTab === 'player' ? 'block' : 'hidden md:flex'}`}>
                        {/* Header con indicador */}
                        <div className="hidden md:flex items-center gap-2 mb-1 pb-2 border-b border-cyan-500/20 text-cyan-400 font-tech text-xs uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span> {t.common.ui.blue_team}
                        </div>
                        {/* Lista de UnitRows */}
                        <div className="space-y-1.5">
                            {UNIT_PRIORITY.map(uType => {
                                const def = UNIT_DEFS[uType];
                                if (!def) return null;
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

                    {/* LISTA: Unidades del enemigo (Equipo Rojo) */}
                    <div className={`flex flex-col gap-2 ${activeTab === 'enemy' ? 'block' : 'hidden md:flex'}`}>
                        {/* Header con indicador */}
                        <div className="hidden md:flex items-center gap-2 mb-1 pb-2 border-b border-red-500/20 text-red-400 font-tech text-xs uppercase tracking-widest">
                             <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> {t.common.ui.red_team}
                        </div>
                        {/* Lista de UnitRows */}
                        <div className="space-y-1.5">
                            {UNIT_PRIORITY.map(uType => {
                                const def = UNIT_DEFS[uType];
                                if (!def) return null;
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

                {/* BOTÓN: Simular batalla */}
                <div className="mt-6 mb-20 md:mb-4 px-1 sm:px-2">
                    <button
                        onClick={handleSimulate}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-tech font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] py-3 sm:py-4 rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all transform hover:scale-[1.02] active:scale-95 text-sm sm:text-base"
                    >
                        {t.common.actions.simulate}
                    </button>
                </div>
            </div>

            {/* MODAL: Resultado de la simulación */}
            {result && simLogEntry && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/90 backdrop-blur-xl animate-[fadeIn_0.2s_ease-out]">
                    <div className="w-full h-[85vh] md:h-auto md:max-h-[85vh] md:max-w-2xl relative flex flex-col">
                        {/* Panel de contenido */}
                        <div className="bg-slate-900 border-t md:border border-white/10 overflow-hidden relative rounded-t-2xl md:rounded-xl shadow-2xl flex flex-col max-h-full">
                            {/* Contenido: Reporte de combate */}
                            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 custom-scrollbar">
                                <CombatReportContent
                                    log={simLogEntry}
                                    t={t}
                                    embedded={true}
                                    onClose={() => setResult(null)}
                                />
                            </div>

                            {/* Footer: Acciones del modal */}
                            <div className="p-3 sm:p-4 bg-slate-950 border-t border-white/10 shrink-0 flex gap-2 sm:gap-4">
                                <button
                                    onClick={() => setResult(null)}
                                    className="flex-1 py-2.5 sm:py-3 bg-white/10 hover:bg-white/20 active:bg-slate-700 text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-colors rounded"
                                >
                                    {t.common.actions.close}
                                </button>
                                <button
                                    onClick={saveToHistory}
                                    className="flex-1 py-2.5 sm:py-3 bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-300 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-colors rounded shadow-[0_0_10px_rgba(6,182,212,0.2)]"
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