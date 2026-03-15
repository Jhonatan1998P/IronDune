import React, { useMemo } from 'react';
import { useServerPvpRankings } from '../../hooks/useServerRankings';
import { useAuth } from '../../context/AuthContext';
import { Icons } from '../UIComponents';
import { formatNumber } from '../../utils';
import { Loader2, RefreshCw } from 'lucide-react';

export const P2PRanking: React.FC = () => {
  const { user } = useAuth();
  const { rankings, loading, error, refetch } = useServerPvpRankings();

  const currentPlayerId = user?.id;

  const playerRankEntry = useMemo(
    () => rankings.find(r => r.id === currentPlayerId),
    [rankings, currentPlayerId]
  );

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: 'bg-yellow-900/30', border: 'border-yellow-500/40', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.2)]' };
    if (rank === 2) return { bg: 'bg-slate-700/30', border: 'border-slate-400/40', glow: 'shadow-[0_0_15px_rgba(148,163,184,0.15)]' };
    if (rank === 3) return { bg: 'bg-orange-900/30', border: 'border-orange-500/40', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]' };
    return { bg: 'bg-slate-900/40', border: 'border-white/5', glow: '' };
  };

  const onlineCount = rankings.filter(r => r.isOnline).length;

  return (
    <div className="flex flex-col min-h-full p-2 sm:p-4 gap-3 sm:gap-4 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div className="glass-panel p-3 sm:p-4 rounded-xl border border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="font-tech text-sm sm:text-lg text-white uppercase tracking-widest flex items-center gap-2">
            <Icons.Crown className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            Rankings PvP
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-400 uppercase font-bold">{onlineCount} online</span>
            </div>
            <button
              onClick={refetch}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 transition-all active:scale-95"
              title="Actualizar clasificación"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Player Rank Card */}
        {playerRankEntry && (
          <div className="bg-cyan-900/20 border border-cyan-500/40 rounded-lg p-3 sm:p-4 mt-4">
            <div className="text-center">
              <div className="text-cyan-300 text-[10px] sm:text-xs uppercase tracking-widest font-bold">Tu Posición</div>
              <div className="text-3xl sm:text-4xl font-bold text-white">#{playerRankEntry.rank}</div>
              <div className="text-slate-400 text-xs mt-1">
                de {rankings.length} jugadores • {formatNumber(playerRankEntry.score)} pts PvP
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rankings List */}
      <div className="flex-1 px-0.5 sm:px-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-cyan-500/50" />
            <span className="text-xs font-tech uppercase tracking-widest">Cargando ranking PvP...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
            <Icons.Crown className="w-10 h-10 text-slate-700" />
            <p className="text-sm text-center">No se pudo cargar el ranking</p>
            <button
              onClick={refetch}
              className="text-xs text-cyan-400 border border-cyan-500/30 px-3 py-1.5 rounded-lg hover:bg-cyan-900/20 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : rankings.length === 0 ? (
          <div className="glass-panel p-6 sm:p-8 rounded-xl border border-white/10 text-center">
            <Icons.Crown className="w-10 h-10 sm:w-12 sm:h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm sm:text-base mb-2">No hay jugadores registrados aún</p>
            <p className="text-slate-500 text-xs sm:text-sm">¡Sé el primero en la tabla PvP!</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {rankings.map((player) => {
              const rankStyle = getRankStyle(player.rank);
              const isCurrentPlayer = player.id === currentPlayerId;

              return (
                <div
                  key={player.id}
                  className={`
                    flex items-center justify-between p-2.5 sm:p-4 rounded-lg border transition-all
                    ${rankStyle.bg} ${rankStyle.border} ${rankStyle.glow}
                    ${isCurrentPlayer ? 'ring-1 sm:ring-2 ring-cyan-500/50' : ''}
                  `}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className={`
                      flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded font-bold text-sm shrink-0
                      ${player.rank <= 3
                        ? player.rank === 1 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                        : player.rank === 2 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/50'
                        : 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                        : 'bg-black/40 text-slate-500 border border-white/10'
                      }
                    `}>
                      {player.rank}
                    </div>
                    <div className="min-w-0">
                      <div className={`font-bold text-sm sm:text-base truncate flex items-center gap-2 ${isCurrentPlayer ? 'text-cyan-300' : 'text-white'}`}>
                        {player.name}
                        {player.isOnline && (
                          <span className="w-2 h-2 bg-emerald-400 rounded-full shrink-0" title="En línea ahora" />
                        )}
                      </div>
                      {isCurrentPlayer && (
                        <div className="text-[10px] sm:text-xs text-slate-500">Tú</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="font-mono font-bold text-white text-sm sm:text-lg">
                      {formatNumber(player.score)}
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase">pts PvP</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
