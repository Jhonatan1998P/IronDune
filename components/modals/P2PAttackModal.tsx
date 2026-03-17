import React, { useState } from 'react';
import { GameState, UnitType } from '../../types';
import { UNIT_DEFS } from '../../data/units';
import { Icons } from '../UIComponents';
import { useLanguage } from '../../hooks/useLanguage';
import { formatNumber, formatDuration } from '../../utils';
import { useP2PAttack } from '../../hooks/useP2PAttack';
import { useP2PAttackLimits } from '../../hooks/useP2PAttackLimits';
import { P2P_ATTACK_TRAVEL_TIME_MS, P2P_MAX_ATTACKS_PER_TARGET_PER_DAY, NEWBIE_PROTECTION_THRESHOLD } from '../../constants';

import { useMultiplayer } from '../../hooks/useMultiplayer';
import { useGameStoreSelector } from '../../stores/gameStore';

interface P2PAttackModalProps {
    target: { id: string; name: string; score: number };
    gameState: GameState;
    onClose: () => void;
    onAttackSent: (newState: GameState) => void;
}

export const P2PAttackModal: React.FC<P2PAttackModalProps> = ({ target, gameState, onClose }) => {
    const { t } = useLanguage();
    const addP2PMission = useGameStoreSelector((state) => state.addP2PMission);
    const { localPlayerId } = useMultiplayer();
    const [selectedUnits, setSelectedUnits] = useState<Partial<Record<UnitType, number>>>({});
    const { sendAttack } = useP2PAttack();
    const { canAttack, getRemainingAttacks, isInPointRange, registerAttack } = useP2PAttackLimits();
    
    // Tiempo configurado según constantes (15 minutos)
    const travelTime = P2P_ATTACK_TRAVEL_TIME_MS;

    // --- Validaciones de reglas P2P ---
    const remainingAttacks = getRemainingAttacks(target.id);
    const inRange = isInPointRange(gameState.empirePoints, target.score);
    const isPlayerProtected = gameState.empirePoints < NEWBIE_PROTECTION_THRESHOLD;
    const isTargetProtected = target.score < NEWBIE_PROTECTION_THRESHOLD;
    const isGlobalProtected = isPlayerProtected || isTargetProtected;
    
    const attackAllowed = canAttack(target.id, false) && inRange && !isGlobalProtected;

    // Rango permitido para información al jugador
    const minRange = Math.floor(gameState.empirePoints * 0.5);
    const maxRange = Math.floor(gameState.empirePoints * 1.5);

    const handleUnitChange = (type: UnitType, change: number) => {
        setSelectedUnits(prev => {
            const currentVal = prev[type] || 0;
            const maxVal = gameState.units[type];
            const newVal = Math.max(0, Math.min(maxVal, currentVal + change));
            if (newVal === 0) {
                const newUnits = { ...prev };
                delete newUnits[type];
                return newUnits;
            }
            return { ...prev, [type]: newVal };
        });
    };

    const handleUnitSet = (type: UnitType, val: number) => {
        setSelectedUnits(prev => {
            const maxVal = gameState.units[type];
            const newVal = Math.max(0, Math.min(maxVal, val));
            if (newVal === 0) {
                const newUnits = { ...prev };
                delete newUnits[type];
                return newUnits;
            }
            return { ...prev, [type]: newVal };
        });
    };

    const handleLaunch = () => {
        if (!attackAllowed) return;

        const attackId = `p2p_atk_${Date.now()}`;
        const startTime = Date.now();
        const endTime = startTime + travelTime;
        const attackerId = localPlayerId || 'UNKNOWN_PEER';

        // Registrar el ataque en el límite diario ANTES de enviarlo
        registerAttack(target.id, false);

        // 1. Enviar el ataque al defensor via P2P
        sendAttack(target.id, {
            attackId,
            attackerId,
            attackerName: gameState.playerName,
            attackerScore: gameState.empirePoints,
            units: selectedUnits,
            targetId: target.id,
            startTime,
            endTime
        });

        // 2. Registrar la misión saliente Y descontar tropas en un solo setGameState atómico
        addP2PMission({
            id: attackId,
            type: 'PVP_ATTACK',
            startTime,
            endTime,
            duration: travelTime / 60000,
            units: selectedUnits,
            targetId: target.id,
            targetName: target.name,
            targetScore: target.score,
            isP2P: true
        });

        onClose();
    };

    const availableUnits = (Object.entries(gameState.units) as [UnitType, number][]).filter(([, count]) => count > 0);
    const totalSelected = Object.values(selectedUnits).reduce((a: number, b) => a + ((b as number) || 0), 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
            <div className="w-full glass-panel rounded-t-2xl md:rounded-2xl border border-cyan-500/30 h-[85dvh] md:h-auto md:max-h-[85dvh] max-w-sm sm:max-w-md md:max-w-lg mx-0 sm:mx-3 md:mx-4 flex flex-col">
                {/* Header */}
                <div className="shrink-0 p-3 sm:p-4 border-b border-white/10 flex items-center justify-between bg-cyan-950/30">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-lg sm:rounded-xl shrink-0 bg-cyan-500/20 text-cyan-400">
                            <Icons.Army className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[8px] sm:text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-cyan-400">
                                ATAQUE MULTIJUGADOR P2P
                            </span>
                            <h2 className="font-tech text-xs sm:text-sm md:text-base text-white uppercase tracking-wide truncate">
                                {target.name}
                            </h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 sm:p-2 rounded-lg bg-black/40 hover:bg-white/10 text-slate-500 hover:text-white transition-colors shrink-0">
                        <Icons.Close className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            <div className="glass-panel p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/5 flex flex-col items-center justify-center">
                                <div className="text-[8px] sm:text-[9px] md:text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5 sm:mb-1">{t.common.ui.est_power}</div>
                                <div className="font-mono text-sm sm:text-lg md:text-xl text-cyan-400 font-bold">{formatNumber(target.score)}</div>
                            </div>
                            <div className="glass-panel p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/5 flex flex-col items-center justify-center">
                                <div className="text-[8px] sm:text-[9px] md:text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5 sm:mb-1">{t.common.ui.travel_time}</div>
                                <div className="font-mono text-sm sm:text-lg md:text-xl font-bold text-white">
                                    {formatDuration(travelTime)}
                                </div>
                            </div>
                        </div>

                        {/* Units Selection */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.missions.patrol.select_units}</h3>
                                <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">
                                    {t.reports.deployed}: {formatNumber(totalSelected)}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
                                {availableUnits.length === 0 ? (
                                    <div className="text-center text-slate-500 text-xs py-6 sm:py-8 bg-black/20 rounded-lg sm:rounded-xl border border-dashed border-white/10">
                                        {t.errors.insufficient_units}
                                    </div>
                                ) : (
                                    availableUnits.map(([uTypeString, max]) => {
                                        const uType = uTypeString as UnitType;
                                        const current = selectedUnits[uType] || 0;
                                        const def = UNIT_DEFS[uType];
                                        const name = t.units[def.translationKey]?.name || uType;
                                        return (
                                            <div key={uType} className="flex items-center justify-between p-2 sm:p-2.5 bg-black/20 hover:bg-white/[0.03] border border-white/5 rounded-lg sm:rounded-xl transition-all">
                                                <div className="flex-1 min-w-0 pr-2 sm:pr-3">
                                                    <div className="text-xs font-bold text-slate-200 truncate">{name}</div>
                                                    <div className="text-[9px] text-slate-500 font-mono">{formatNumber(max)}</div>
                                                </div>

                                                <div className="flex items-center gap-0.5 bg-black/40 p-0.5 sm:p-1 rounded-md sm:rounded-lg border border-white/5">
                                                    <button
                                                        onClick={() => handleUnitChange(uType, -1)}
                                                        className="w-7 h-7 sm:w-8 sm:h-8 bg-white/5 hover:bg-red-500/20 rounded-md text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors text-base active:scale-95"
                                                    >
                                                        −
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={current === 0 ? '' : current}
                                                        onChange={(e) => handleUnitSet(uType, parseInt(e.target.value) || 0)}
                                                        placeholder="0"
                                                        className="w-9 sm:w-12 bg-transparent text-center font-mono text-xs sm:text-sm font-bold text-cyan-400 focus:outline-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0"
                                                    />
                                                    <button
                                                        onClick={() => handleUnitChange(uType, 1)}
                                                        className="w-7 h-7 sm:w-8 sm:h-8 bg-white/5 hover:bg-emerald-500/20 rounded-md text-slate-400 hover:text-emerald-400 flex items-center justify-center transition-colors text-base active:scale-95"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 p-3 sm:p-4 border-t border-white/10 bg-black/40 space-y-2 sm:space-y-3">
                    {/* Alertas de reglas P2P */}
                    {!inRange && (
                        <div className="flex items-start gap-2 p-2.5 bg-red-900/30 border border-red-500/40 rounded-lg text-xs text-red-300">
                            <Icons.Close className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-400" />
                            <span>
                                Fuera de rango. Solo puedes atacar jugadores entre{' '}
                                <span className="font-bold text-red-200">{formatNumber(minRange)}</span> y{' '}
                                <span className="font-bold text-red-200">{formatNumber(maxRange)}</span> pts.
                            </span>
                        </div>
                    )}
                    {inRange && isGlobalProtected && (
                        <div className="flex items-start gap-2 p-2.5 bg-cyan-900/30 border border-cyan-500/40 rounded-lg text-xs text-cyan-300">
                            <Icons.Shield className="w-3.5 h-3.5 mt-0.5 shrink-0 text-cyan-400" />
                            <span>
                                {isPlayerProtected ? "Estás bajo protección de principiante." : "El objetivo está bajo protección de principiante."}
                            </span>
                        </div>
                    )}
                    {inRange && !isGlobalProtected && remainingAttacks <= 0 && (
                        <div className="flex items-start gap-2 p-2.5 bg-amber-900/30 border border-amber-500/40 rounded-lg text-xs text-amber-300">
                            <Icons.Close className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                            <span>
                                Límite diario alcanzado. Has usado los{' '}
                                <span className="font-bold">{P2P_MAX_ATTACKS_PER_TARGET_PER_DAY}</span> ataques
                                permitidos contra este jugador hoy. Reinicio en 24 h.
                            </span>
                        </div>
                    )}
                    {inRange && remainingAttacks > 0 && (
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>Ataques restantes hoy contra este jugador:</span>
                            <span className={`font-bold font-mono ${remainingAttacks <= 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {remainingAttacks}/{P2P_MAX_ATTACKS_PER_TARGET_PER_DAY}
                            </span>
                        </div>
                    )}
                    <button
                        onClick={handleLaunch}
                        disabled={totalSelected === 0 || !attackAllowed}
                        className={`w-full py-2.5 sm:py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-[0.98] ${
                            totalSelected === 0 || !attackAllowed
                                ? 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'
                                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                        }`}
                    >
                        LANZAR ATAQUE P2P
                    </button>
                </div>
            </div>
        </div>
    );
};
