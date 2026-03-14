/**
 * P2PBattleView - Vista completa del sistema de batalla P2P
 * 
 * Incluye:
 * - Panel de oponentes disponibles para desafiar
 * - Modal de desafío entrante
 * - Selector de ejército con controles de cantidad
 * - Barra de poder comparativa
 * - Pantalla de resultado con detalles de batalla
 * - Historial de batallas con persistencia en IndexedDB
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useP2PBattle } from '../../hooks/useP2PBattle';
import { useMultiplayer } from '../../hooks/useMultiplayer';
import { useLanguage } from '../../context/LanguageContext';
import { UNIT_DEFS } from '../../data/units';
import { formatNumber } from '../../utils';
import { Icons } from '../UIComponents';
import type { UnitType, GameState } from '../../types';
import type { PlayerPresence, P2PBattleRecord } from '../../types/multiplayer';
import { MAX_ATTACKS_24H } from '../../constants';

import { getFlagEmoji } from '../../utils/engine/rankings';

const UNIT_PRIORITY: UnitType[] = ['INFANTRY' as any, 'TANK' as any, 'JET' as any, 'SHIP' as any, 'SALVAGER_DRONE' as any];

// ============================================================================
// PROPS
// ============================================================================

interface P2PBattleViewProps {
  gameState: GameState;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * OpponentCard - Tarjeta de un jugador disponible para desafiar
 */
const OpponentCard: React.FC<{
  player: PlayerPresence;
  onChallenge: (peerId: string) => void;
  disabled: boolean;
  inRange: boolean;
  remainingAttacks: number;
  maxAttacks: number;
}> = ({ player, onChallenge, disabled, inRange, remainingAttacks, maxAttacks }) => {
  const outOfRange = !inRange;
  const noAttacksLeft = remainingAttacks <= 0;
  const cannotAttack = outOfRange || noAttacksLeft || disabled;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-all group ${
      outOfRange
        ? 'border-red-500/20 bg-red-950/20 opacity-70'
        : 'border-white/10 bg-slate-900/50 hover:bg-slate-800/50'
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg ${
            outOfRange
              ? 'bg-gradient-to-br from-slate-600 to-slate-700'
              : 'bg-gradient-to-br from-cyan-600 to-blue-700'
          }`}>
            {player.flag ? (
              <span className="text-xl">{getFlagEmoji(player.flag)}</span>
            ) : (
              player.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900" />
        </div>
        <div className="min-w-0">
          <div className="text-white font-bold text-sm truncate">{player.name}</div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs font-mono">{formatNumber(player.level)} pts</span>
            {outOfRange && (
              <span className="text-[9px] text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded-full font-bold uppercase">
                Fuera de rango
              </span>
            )}
            {!outOfRange && noAttacksLeft && (
              <span className="text-[9px] text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full font-bold uppercase">
                Sin ataques hoy
              </span>
            )}
            {!outOfRange && !noAttacksLeft && (
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                remainingAttacks <= 2 ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 bg-white/5'
              }`}>
                {remainingAttacks}/{maxAttacks}
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={() => onChallenge(player.id)}
        disabled={cannotAttack}
        className="shrink-0 px-3 py-2 bg-red-600/20 hover:bg-red-600/40 disabled:opacity-30 disabled:cursor-not-allowed border border-red-500/30 hover:border-red-500/60 text-red-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
      >
        <Icons.Swords className="w-3.5 h-3.5" />
        Desafiar
      </button>
    </div>
  );
};

/**
 * ArmyUnitRow - Fila de selección de unidad para el ejército de batalla
 */
const ArmyUnitRow: React.FC<{
  unitType: UnitType;
  available: number;
  selected: number;
  onChange: (unitType: UnitType, count: number) => void;
}> = ({ unitType, available, selected, onChange }) => {
  const { t } = useLanguage();
  const def = UNIT_DEFS[unitType];
  if (!def || available <= 0) return null;

  const handleDelta = (delta: number) => {
    const next = Math.max(0, Math.min(available, selected + delta));
    onChange(unitType, next);
  };

  const handleSetAll = () => onChange(unitType, available);
  const handleClear = () => onChange(unitType, 0);

  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
      selected > 0 
        ? 'bg-cyan-900/15 border-cyan-500/40' 
        : 'bg-slate-900/40 border-transparent hover:bg-slate-800/30'
    }`}>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className={`text-xs font-bold truncate ${selected > 0 ? 'text-white' : 'text-slate-500'}`}>
          {t.units[def.translationKey]?.name || def.translationKey}
        </span>
        <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-mono">
          <span title="ATK">
            <Icons.Stats.Attack className="w-2.5 h-2.5 text-red-400/80 inline" /> {formatNumber(def.attack)}
          </span>
          <span title="DEF">
            <Icons.Stats.Defense className="w-2.5 h-2.5 text-blue-400/80 inline" /> {def.defense}
          </span>
          <span title="HP">
            <Icons.Stats.Hp className="w-2.5 h-2.5 text-emerald-400/80 inline" /> {formatNumber(def.hp)}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-400/70">Disp: {available}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button onClick={handleClear} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-red-400 bg-white/5 hover:bg-white/10 rounded text-[9px] font-bold transition-colors" title="Quitar todos">
          0
        </button>
        <button onClick={() => handleDelta(-10)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded text-[9px] font-bold transition-colors">
          -10
        </button>
        <button onClick={() => handleDelta(-1)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors">
          -
        </button>
        <input
          type="number"
          value={selected === 0 ? '' : selected}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            onChange(unitType, isNaN(val) ? 0 : Math.max(0, Math.min(available, val)));
          }}
          placeholder="0"
          className={`w-12 bg-transparent text-center font-mono text-sm font-bold focus:outline-none border-b border-transparent focus:border-cyan-500/40 transition-colors ${
            selected > 0 ? 'text-cyan-400' : 'text-slate-600'
          }`}
        />
        <button onClick={() => handleDelta(1)} className="w-6 h-6 flex items-center justify-center text-cyan-500 hover:text-cyan-300 bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors">
          +
        </button>
        <button onClick={() => handleDelta(10)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded text-[9px] font-bold transition-colors">
          +10
        </button>
        <button onClick={handleSetAll} className="w-7 h-6 flex items-center justify-center text-amber-400/70 hover:text-amber-300 bg-white/5 hover:bg-white/10 rounded text-[9px] font-bold transition-colors" title="Todos">
          MAX
        </button>
      </div>
    </div>
  );
};

/**
 * HistoryRow - Fila del historial de batallas
 */
const HistoryRow: React.FC<{ record: P2PBattleRecord }> = ({ record }) => {
  const winColor = record.winner === 'PLAYER' ? 'text-emerald-400' : record.winner === 'ENEMY' ? 'text-red-400' : 'text-amber-400';
  const winBg = record.winner === 'PLAYER' ? 'border-emerald-500/20' : record.winner === 'ENEMY' ? 'border-red-500/20' : 'border-amber-500/20';
  const winLabel = record.winner === 'PLAYER' ? 'VICTORIA' : record.winner === 'ENEMY' ? 'DERROTA' : 'EMPATE';

  return (
    <div className={`p-3 rounded-lg border ${winBg} bg-slate-900/40 hover:bg-slate-800/40 transition-colors`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-bold uppercase tracking-wider ${winColor}`}>{winLabel}</span>
        <span className="text-[10px] text-slate-500">{new Date(record.timestamp).toLocaleDateString()}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-white font-bold truncate">{record.opponentName}</div>
        <div className="text-xs text-slate-500 font-mono">{formatNumber(record.opponentScore)} pts</div>
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
        <span>Perdidas: {Object.values(record.myCasualties).reduce((a, b) => a + b, 0)}</span>
        <span>Bajas enemigas: {Object.values(record.opponentCasualties).reduce((a, b) => a + b, 0)}</span>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const P2PBattleView: React.FC<P2PBattleViewProps> = ({ gameState }) => {
  const { t } = useLanguage();
  const { isConnected } = useMultiplayer();
  const p2p = useP2PBattle(gameState.playerName, gameState.empirePoints);

  const isInPointRange = (attackerScore: number, targetScore: number) => {
    return targetScore >= attackerScore * 0.5 && targetScore <= attackerScore * 1.5;
  };

  const getRemainingAttacks = (targetId: string) => {
    const count = gameState.targetAttackCounts[targetId] || 0;
    return Math.max(0, MAX_ATTACKS_24H - count);
  };

  const [activeSection, setActiveSection] = useState<'arena' | 'history'>('arena');

  // ============================================================================
  // ARMY SELECTION STATE
  // ============================================================================

  const handleArmyChange = useCallback((unitType: UnitType, count: number) => {
    const currentArmy = p2p.battle.myArmy || {};
    const newArmy = { ...currentArmy };
    if (count <= 0) {
      delete newArmy[unitType];
    } else {
      newArmy[unitType] = count;
    }
    p2p.setMyArmy(newArmy);
  }, [p2p]);

  const handleSelectAll = useCallback(() => {
    const army: Record<string, number> = {};
    UNIT_PRIORITY.forEach(uType => {
      const available = gameState.units[uType] || 0;
      if (available > 0) army[uType] = available;
    });
    p2p.setMyArmy(army);
  }, [gameState.units, p2p]);

  const handleClearArmy = useCallback(() => {
    p2p.setMyArmy({});
  }, [p2p]);

  // ============================================================================
  // COMPUTED
  // ============================================================================

  const totalSelectedUnits = useMemo(() => {
    if (!p2p.battle.myArmy) return 0;
    return Object.values(p2p.battle.myArmy).reduce((a, b) => a + b, 0);
  }, [p2p.battle.myArmy]);

  const myPower = 0; // p2p.myArmyStats.attack + p2p.myArmyStats.hp;
  const oppPower = 0; // p2p.opponentArmyStats.attack + p2p.opponentArmyStats.hp;
  const totalPower = myPower + oppPower;
  const myRatio = totalPower === 0 ? 50 : (myPower / totalPower) * 100;

  // ============================================================================
  // RENDER: CHALLENGE NOTIFICATION (modal overlay)
  // ============================================================================

  const renderChallengeNotification = () => {
    if (!p2p.pendingChallenge) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out] p-4">
        <div className="bg-slate-900 border border-red-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl shadow-red-500/20 animate-[slideUp_0.3s_ease-out]">
          <div className="text-center mb-5">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/40">
              <Icons.Swords className="w-8 h-8 text-red-400 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Desafio PvP</h3>
            <p className="text-slate-400 text-sm mt-1">
              <span className="text-red-300 font-bold">{p2p.pendingChallenge.challengerName}</span> te desafia a una batalla
            </p>
            <div className="text-xs text-slate-500 mt-1 font-mono">
              {formatNumber(p2p.pendingChallenge.challengerScore)} pts de imperio
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={p2p.declineChallenge}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold uppercase tracking-wider text-sm transition-all border border-white/10"
            >
              Rechazar
            </button>
            <button
              onClick={p2p.acceptChallenge}
              className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold uppercase tracking-wider text-sm transition-all shadow-lg shadow-red-500/30 hover:shadow-red-500/50"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER: BATTLE RESULT
  // ============================================================================

  const renderBattleResult = () => {
    if (p2p.battle.status !== 'RESULT' || !p2p.battle.result) return null;

    const result = p2p.battle.result;
    const isChallenger = p2p.battle.isChallenger;

    // Determine local winner
    let localWinner: 'PLAYER' | 'ENEMY' | 'DRAW';
    if (result.winner === 'DRAW') localWinner = 'DRAW';
    else if (isChallenger) localWinner = result.winner;
    else localWinner = result.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER';

    const myCasualties = isChallenger ? result.attackerCasualties : result.defenderCasualties;
    const oppCasualties = isChallenger ? result.defenderCasualties : result.attackerCasualties;
    const mySurvivors = isChallenger ? result.attackerSurvivors : result.defenderSurvivors;
    const oppSurvivors = isChallenger ? result.defenderSurvivors : result.attackerSurvivors;

    const totalMyLosses = Object.values(myCasualties).reduce((a, b) => a + b, 0);
    const totalOppLosses = Object.values(oppCasualties).reduce((a, b) => a + b, 0);
    const totalMySurvivors = Object.values(mySurvivors).reduce((a, b) => a + b, 0);
    const totalOppSurvivors = Object.values(oppSurvivors).reduce((a, b) => a + b, 0);

    const winColor = localWinner === 'PLAYER' ? 'from-emerald-600 to-emerald-800' : localWinner === 'ENEMY' ? 'from-red-600 to-red-800' : 'from-amber-600 to-amber-800';
    const winText = localWinner === 'PLAYER' ? 'VICTORIA' : localWinner === 'ENEMY' ? 'DERROTA' : 'EMPATE';
    const winGlow = localWinner === 'PLAYER' ? 'shadow-emerald-500/40' : localWinner === 'ENEMY' ? 'shadow-red-500/40' : 'shadow-amber-500/40';

    return (
      <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/90 backdrop-blur-xl animate-[fadeIn_0.3s_ease-out]">
        <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
          {/* Result Header */}
          <div className={`p-6 bg-gradient-to-r ${winColor} text-center rounded-t-2xl`}>
            <div className="text-4xl font-bold text-white tracking-widest mb-1">{winText}</div>
            <div className="text-white/70 text-sm">vs {p2p.battle.opponentName}</div>
            <div className="text-white/50 text-xs mt-1">{result.rounds} rondas de combate</div>
          </div>

          {/* Stats */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Summary Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-lg p-3 text-center">
                <div className="text-[10px] text-cyan-400 uppercase tracking-wider font-bold mb-1">Tus Bajas</div>
                <div className="text-2xl font-bold text-white">{totalMyLosses}</div>
                <div className="text-xs text-slate-500">{totalMySurvivors} sobrevivientes</div>
              </div>
              <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3 text-center">
                <div className="text-[10px] text-red-400 uppercase tracking-wider font-bold mb-1">Bajas Enemigas</div>
                <div className="text-2xl font-bold text-white">{totalOppLosses}</div>
                <div className="text-xs text-slate-500">{totalOppSurvivors} sobrevivientes</div>
              </div>
            </div>

            {/* Detailed Casualties */}
            {Object.keys(myCasualties).length > 0 && (
              <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Tus Perdidas</div>
                <div className="space-y-1">
                  {Object.entries(myCasualties).map(([unitType, count]) => (
                    <div key={unitType} className="flex justify-between text-xs">
                      <span className="text-slate-300">{t.units[UNIT_DEFS[unitType as UnitType]?.translationKey]?.name || unitType}</span>
                      <span className="text-red-400 font-mono">-{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(oppCasualties).length > 0 && (
              <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">Bajas Enemigas</div>
                <div className="space-y-1">
                  {Object.entries(oppCasualties).map(([unitType, count]) => (
                    <div key={unitType} className="flex justify-between text-xs">
                      <span className="text-slate-300">{t.units[UNIT_DEFS[unitType as UnitType]?.translationKey]?.name || unitType}</span>
                      <span className="text-emerald-400 font-mono">-{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Close Button */}
          <div className="p-4 border-t border-white/10 shrink-0">
            <button
              onClick={p2p.resetBattle}
              className={`w-full py-3 bg-gradient-to-r ${winColor} text-white rounded-lg font-bold uppercase tracking-widest text-sm shadow-lg ${winGlow} transition-all hover:scale-[1.02] active:scale-95`}
            >
              Volver a la Arena
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER: PREPARING / ARMY SELECTION
  // ============================================================================

  const renderArmySelection = () => {
    if (p2p.battle.status !== 'PREPARING' && p2p.battle.status !== 'WAITING_LOCK' && p2p.battle.status !== 'LOCKED' && p2p.battle.status !== 'RESOLVING') return null;

    const isLocked = p2p.battle.myArmyLocked;

    return (
      <div className="flex flex-col min-h-full animate-[fadeIn_0.3s_ease-out]">
        {/* Header */}
        <div className="shrink-0 glass-panel border-b border-white/10 p-3 sm:p-4 bg-slate-900/95">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-tech text-sm text-white uppercase tracking-widest flex items-center gap-2">
                <Icons.Army className="w-4 h-4 text-cyan-400" />
                Preparar Ejército
              </h3>
              <div className="text-xs text-slate-500 mt-0.5">
                vs <span className="text-red-300 font-bold">{p2p.battle.opponentName}</span>
                <span className="ml-2 text-slate-600">({formatNumber(p2p.battle.opponentScore)} pts)</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {p2p.battle.opponentArmyLocked && (
                <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-500/30 animate-pulse">
                  Oponente listo
                </span>
              )}
              {isLocked && (
                <span className="text-[10px] text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-full border border-cyan-500/30">
                  Confirmado
                </span>
              )}
            </div>
          </div>

          {/* Power Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono font-bold uppercase tracking-wider">
              <span className="text-cyan-400">Tu Poder: {formatNumber(myPower)}</span>
              <span className="text-slate-500">{totalSelectedUnits} unidades</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-cyan-500 transition-all duration-300 shadow-[0_0_8px_#06b6d4]"
                style={{ width: `${Math.min(100, myRatio)}%` }}
              />
            </div>
          </div>

          {/* Quick Actions */}
          {!isLocked && (
            <div className="flex gap-2 mt-3">
              <button onClick={handleSelectAll} className="flex-1 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 rounded text-[10px] font-bold uppercase tracking-wider transition-all">
                Seleccionar Todo
              </button>
              <button onClick={handleClearArmy} className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 rounded text-[10px] font-bold uppercase tracking-wider transition-all">
                Limpiar
              </button>
              <button onClick={() => p2p.cancelBattle()} className="py-2 px-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded text-[10px] font-bold uppercase tracking-wider transition-all">
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Unit List */}
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-1.5">
          {UNIT_PRIORITY.map(uType => {
            const available = gameState.units[uType] || 0;
            if (available <= 0) return null;
            const selected = (p2p.battle.myArmy || {})[uType] || 0;
            return (
              <ArmyUnitRow
                key={uType}
                unitType={uType}
                available={available}
                selected={selected}
                onChange={isLocked ? () => {} : handleArmyChange}
              />
            );
          })}
          {UNIT_PRIORITY.every(uType => (gameState.units[uType] || 0) <= 0) && (
            <div className="text-center py-12 text-slate-500">
              <Icons.Army className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-sm">No tienes unidades disponibles</p>
              <p className="text-xs text-slate-600 mt-1">Recluta unidades para poder luchar</p>
            </div>
          )}
        </div>

        {/* Lock Button */}
        {!isLocked && (
          <div className="shrink-0 p-4 border-t border-white/10 bg-slate-900/80">
            <button
              onClick={p2p.lockArmy}
              disabled={!p2p.canLockArmy}
              className="w-full py-3.5 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg font-bold uppercase tracking-[0.15em] text-sm shadow-lg shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-95"
            >
              Confirmar Ejercito ({totalSelectedUnits} unidades)
            </button>
          </div>
        )}

        {/* Waiting for opponent lock */}
        {isLocked && p2p.battle.status === 'WAITING_LOCK' && (
          <div className="shrink-0 p-4 border-t border-white/10 bg-slate-900/80 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-400 text-sm font-bold animate-pulse">
              <div className="w-4 h-4 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
              Esperando que {p2p.battle.opponentName} confirme...
            </div>
          </div>
        )}

        {/* Resolving */}
        {p2p.battle.status === 'RESOLVING' && (
          <div className="shrink-0 p-4 border-t border-white/10 bg-slate-900/80 text-center">
            <div className="flex items-center justify-center gap-2 text-cyan-400 text-sm font-bold animate-pulse">
              <div className="w-5 h-5 border-2 border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
              Resolviendo combate...
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER: CHALLENGING (waiting for response)
  // ============================================================================

  const renderChallenging = () => {
    if (p2p.battle.status !== 'CHALLENGING') return null;

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 animate-[fadeIn_0.3s_ease-out]">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500/40 animate-pulse">
            <Icons.Swords className="w-10 h-10 text-red-400" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/40 animate-spin">
            <div className="w-4 h-4 border-2 border-amber-400/40 border-t-amber-400 rounded-full" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Desafio Enviado</h3>
        <p className="text-slate-400 text-sm text-center max-w-xs">
          Esperando que <span className="text-red-300 font-bold">{p2p.battle.opponentName}</span> acepte el desafio...
        </p>
        <div className="text-xs text-slate-500 mt-2 font-mono">
          Tiempo limite: 30 segundos
        </div>
        <button
          onClick={() => p2p.cancelBattle()}
          className="mt-6 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-bold uppercase tracking-wider transition-all border border-white/10"
        >
          Cancelar
        </button>
      </div>
    );
  };

  // ============================================================================
  // RENDER: IDLE - ARENA (opponents + history)
  // ============================================================================

  const renderArena = () => {
    if (p2p.battle.status !== 'IDLE') return null;

    return (
      <div className="flex flex-col min-h-full animate-[fadeIn_0.3s_ease-out]">
        {/* Header */}
        <div className="shrink-0 glass-panel border-b border-white/10 p-3 sm:p-4 bg-slate-900/95">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-tech text-sm sm:text-lg text-white uppercase tracking-widest flex items-center gap-2">
              <Icons.Swords className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              Arena PvP
            </h2>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-xs text-slate-400 font-bold uppercase">
                {isConnected ? 'En linea' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 bg-emerald-900/20 border border-emerald-500/20 rounded px-2.5 py-1">
              <span className="text-emerald-400 font-bold">0</span>
              <span className="text-slate-500">V</span>
            </div>
            <div className="flex items-center gap-1.5 bg-red-900/20 border border-red-500/20 rounded px-2.5 py-1">
              <span className="text-red-400 font-bold">0</span>
              <span className="text-slate-500">D</span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-900/20 border border-amber-500/20 rounded px-2.5 py-1">
              <span className="text-amber-400 font-bold">0</span>
              <span className="text-slate-500">E</span>
            </div>
            <div className="text-slate-600 ml-auto font-mono text-[10px]">0 batallas</div>
          </div>

          {/* Section Tabs */}
          <div className="flex mt-3 bg-black/40 rounded p-1 border border-white/5">
            <button
              onClick={() => setActiveSection('arena')}
              className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                activeSection === 'arena' ? 'bg-red-900/40 text-red-300 border border-red-500/30' : 'text-slate-500'
              }`}
            >
              Oponentes ({p2p.opponents.length})
            </button>
            <button
              onClick={() => setActiveSection('history')}
              className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                activeSection === 'history' ? 'bg-slate-700/40 text-slate-300 border border-white/10' : 'text-slate-500'
              }`}
            >
              Historial ({p2p.history.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-2">
          {activeSection === 'arena' && (
            <>
              {!isConnected && (
                <div className="text-center py-12">
                  <Icons.Radar className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-400 text-sm mb-2">No estas conectado a una sala</p>
                  <p className="text-slate-500 text-xs">Unete a una sala multijugador para desafiar jugadores</p>
                </div>
              )}
              {isConnected && p2p.opponents.length === 0 && (
                <div className="text-center py-12">
                  <Icons.Radar className="w-12 h-12 mx-auto mb-3 text-slate-600 animate-pulse" />
                  <p className="text-slate-400 text-sm mb-2">Esperando oponentes...</p>
                  <p className="text-slate-500 text-xs">Comparte el codigo de sala para que se unan otros jugadores</p>
                </div>
              )}
              {isConnected && p2p.opponents.map((player: PlayerPresence) => (
                <OpponentCard
                  key={player.id}
                  player={player}
                  onChallenge={p2p.challengePlayer}
                  disabled={!p2p.canChallenge}
                  inRange={isInPointRange(gameState.empirePoints, player.level)}
                  remainingAttacks={getRemainingAttacks(player.id)}
                  maxAttacks={MAX_ATTACKS_24H}
                />
              ))}
            </>
          )}

          {activeSection === 'history' && (
            <>
              {p2p.history.length === 0 && (
                <div className="text-center py-12">
                  <Icons.Report className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-400 text-sm mb-2">Sin batallas registradas</p>
                  <p className="text-slate-500 text-xs">Tu historial de combates PvP aparecera aqui</p>
                </div>
              )}
              {p2p.history.map(record => (
                <HistoryRow key={record.battleId} record={record} />
              ))}
            </>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="flex flex-col min-h-full">
      {/* Challenge Notification Overlay */}
      {renderChallengeNotification()}

      {/* Battle Result Overlay */}
      {renderBattleResult()}

      {/* Main Content: depends on battle status */}
      {renderArena()}
      {renderChallenging()}
      {renderArmySelection()}
    </div>
  );
};
