import React, { useMemo } from 'react';
import { useP2P } from '../../context/P2PContext';
import { Icons } from '../UIComponents';
import { formatNumber } from '../../utils';

interface P2PRankingProps {
  playerName: string;
  playerScore: number;
}

export const P2PRanking: React.FC<P2PRankingProps> = ({ playerName, playerScore }) => {
  const { peerId, status, knownPeers } = useP2P();

  const rankedPlayers = useMemo(() => {
    const players = Array.from(knownPeers.values())
      .filter(p => p.id !== peerId)
      .map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isPlayer: false,
        isOnline: p.isOnline,
      }));
    
    if (peerId) {
      players.unshift({
        id: peerId,
        name: playerName,
        score: playerScore,
        isPlayer: true,
        isOnline: true,
      });
    }
    
    return players.sort((a, b) => b.score - a.score);
  }, [knownPeers, peerId, playerName, playerScore]);

  const onlineCount = rankedPlayers.filter(p => p.isOnline).length;

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: 'bg-yellow-900/30', border: 'border-yellow-500/40', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.2)]' };
    if (rank === 2) return { bg: 'bg-slate-700/30', border: 'border-slate-400/40', glow: 'shadow-[0_0_15px_rgba(148,163,184,0.15)]' };
    if (rank === 3) return { bg: 'bg-orange-900/30', border: 'border-orange-500/40', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]' };
    return { bg: 'bg-slate-900/40', border: 'border-white/5', glow: '' };
  };

  const playerRank = rankedPlayers.findIndex(p => p.isPlayer) + 1;

  return (
    <div className="flex flex-col min-h-full p-2 sm:p-4 gap-3 sm:gap-4 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div className="glass-panel p-3 sm:p-4 rounded-xl border border-white/10">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="font-tech text-sm sm:text-lg text-white uppercase tracking-widest flex items-center gap-2">
            <Icons.Crown className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            Rankings PvP
          </h2>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${status === 'connected' ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
            <span className="text-xs sm:text-sm text-slate-400 uppercase font-bold">
              {status === 'connected' ? 'En línea' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Player Rank Card */}
        {playerRank > 0 && (
          <div className="bg-cyan-900/20 border border-cyan-500/40 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
            <div className="text-center">
              <div className="text-cyan-300 text-[10px] sm:text-xs uppercase tracking-widest font-bold">Tu Posición</div>
              <div className="text-3xl sm:text-4xl font-bold text-white">#{playerRank}</div>
              <div className="text-slate-400 text-xs mt-1">
                de {rankedPlayers.length} jugadores ({onlineCount} en línea)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rankings List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-0.5 sm:px-1">
        <div className="space-y-2 sm:space-y-3">
          {rankedPlayers.map((player, index) => {
            const rank = index + 1;
            const rankStyle = getRankStyle(rank);
            
            return (
              <div
                key={player.id}
                className={`
                  flex items-center justify-between p-2.5 sm:p-4 rounded-lg border transition-all
                  ${rankStyle.bg} ${rankStyle.border} ${rankStyle.glow}
                  ${player.isPlayer ? 'ring-1 sm:ring-2 ring-cyan-500/50' : ''}
                  ${!player.isOnline ? 'opacity-50' : ''}
                `}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className={`
                    flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded font-bold text-sm shrink-0
                    ${rank <= 3 
                      ? rank === 1 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' 
                      : rank === 2 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/50'
                      : 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                      : 'bg-black/40 text-slate-500 border border-white/10'
                    }
                  `}>
                    {rank}
                  </div>
                  <div className="min-w-0">
                    <div className={`font-bold text-sm sm:text-base truncate flex items-center gap-2 ${player.isPlayer ? 'text-cyan-300' : 'text-white'}`}>
                      {player.name}
                      {!player.isOnline && (
                        <span className="text-[10px] text-slate-500 uppercase">(Offline)</span>
                      )}
                      {player.isOnline && (
                        <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                      )}
                    </div>
                    {player.isPlayer && (
                      <div className="text-[10px] sm:text-xs text-slate-500">Tú</div>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="font-mono font-bold text-white text-sm sm:text-lg">
                    {formatNumber(player.score)}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase">pts</div>
                </div>
              </div>
            );
          })}
        </div>

        {rankedPlayers.length === 0 && (
          <div className="glass-panel p-6 sm:p-8 rounded-xl border border-white/10 text-center">
            <Icons.Crown className="w-10 h-10 sm:w-12 sm:h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm sm:text-base mb-2">Conéctate con amigos para ver rankings!</p>
            <p className="text-slate-500 text-xs sm:text-sm">Comparte tu ID en Batalla PvP</p>
          </div>
        )}
      </div>
    </div>
  );
};
