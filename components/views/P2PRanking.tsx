import React, { useState, useEffect } from 'react';
import { useP2PConnection, PeerMessage } from '../../hooks/useP2PConnection';
import { Icons } from '../UIComponents';
import { formatNumber } from '../../utils';

interface P2PRankingProps {
  playerName: string;
  playerScore: number;
}

interface RankedPlayer {
  id: string;
  name: string;
  score: number;
  isPlayer: boolean;
}

export const P2PRanking: React.FC<P2PRankingProps> = ({ playerName, playerScore }) => {
  const [rankedPlayers, setRankedPlayers] = useState<RankedPlayer[]>([]);
  
  const { peerId, status } = useP2PConnection(
    playerName, 
    playerScore
  );

  useEffect(() => {
    const handleMessage = (e: CustomEvent<PeerMessage & { from: string }>) => {
      const { from, type, payload } = e.detail;
      
      switch (type) {
        case 'score_update':
          setRankedPlayers(prev => {
            const existing = prev.find(p => p.id === from);
            if (existing) {
              return prev.map(p => p.id === from ? { ...p, score: payload.score } : p)
                .sort((a, b) => b.score - a.score);
            }
            return prev;
          });
          break;
        case 'player_info':
          setRankedPlayers(prev => {
            const existing = prev.find(p => p.id === from);
            if (existing) return prev;
            const newPlayer: RankedPlayer = {
              id: from,
              name: payload.name,
              score: payload.score,
              isPlayer: false,
            };
            return [...prev, newPlayer].sort((a, b) => b.score - a.score);
          });
          break;
      }
    };

    window.addEventListener('p2p-message', handleMessage as EventListener);
    return () => window.removeEventListener('p2p-message', handleMessage as EventListener);
  }, []);

  useEffect(() => {
    if (!peerId) return;
    
    setRankedPlayers(prev => {
      const existing = prev.find(p => p.id === peerId);
      if (existing && existing.score !== playerScore) {
        return prev.map(p => p.id === peerId ? { ...p, score: playerScore, name: playerName } : p)
          .sort((a, b) => b.score - a.score);
      }
      if (!existing && peerId) {
        return [{ id: peerId, name: playerName, score: playerScore, isPlayer: true }, ...prev]
          .sort((a, b) => b.score - a.score);
      }
      return prev;
    });
  }, [playerScore, peerId]);

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: 'bg-yellow-900/30', border: 'border-yellow-500/40', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.2)]' };
    if (rank === 2) return { bg: 'bg-slate-700/30', border: 'border-slate-400/40', glow: 'shadow-[0_0_15px_rgba(148,163,184,0.15)]' };
    if (rank === 3) return { bg: 'bg-orange-900/30', border: 'border-orange-500/40', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]' };
    return { bg: 'bg-slate-900/40', border: 'border-white/5', glow: '' };
  };

  const playerRank = rankedPlayers.findIndex(p => p.isPlayer) + 1;

  return (
    <div className="flex flex-col min-h-full p-4 gap-4 animate-[fadeIn_0.3s_ease-out]">
      <div className="glass-panel p-4 rounded-xl border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-tech text-lg text-white uppercase tracking-widest flex items-center gap-2">
            <Icons.Crown className="w-5 h-5 text-yellow-400" />
            P2P Rankings
          </h2>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
            <span className="text-xs text-slate-500 uppercase">
              {status === 'connected' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {playerRank > 0 && (
          <div className="bg-cyan-900/20 border border-cyan-500/40 rounded-lg p-3 mb-4">
            <div className="text-center">
              <div className="text-cyan-300 text-xs uppercase tracking-widest">Your Rank</div>
              <div className="text-3xl font-bold text-white">#{playerRank}</div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {rankedPlayers.map((player, index) => {
            const rank = index + 1;
            const rankStyle = getRankStyle(rank);
            
            return (
              <div
                key={player.id}
                className={`
                  flex items-center justify-between p-3 rounded-lg border transition-all
                  ${rankStyle.bg} ${rankStyle.border} ${rankStyle.glow}
                  ${player.isPlayer ? 'ring-1 ring-cyan-500/50' : ''}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    flex items-center justify-center w-7 h-7 rounded font-bold text-sm
                    ${rank <= 3 
                      ? rank === 1 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' 
                      : rank === 2 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/50'
                      : 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                      : 'bg-black/40 text-slate-500 border border-white/10'
                    }
                  `}>
                    {rank}
                  </div>
                  <div>
                    <div className={`font-bold text-sm ${player.isPlayer ? 'text-cyan-300' : 'text-white'}`}>
                      {player.name}
                      {player.isPlayer && <span className="text-slate-500 ml-1">(You)</span>}
                    </div>
                  </div>
                </div>
                <div className="font-mono font-bold text-white">
                  {formatNumber(player.score)}
                </div>
              </div>
            );
          })}
        </div>

        {rankedPlayers.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">Connect with friends to see rankings!</p>
            <p className="text-xs mt-2">Share your ID in the Multiplayer Lobby</p>
          </div>
        )}
      </div>
    </div>
  );
};
