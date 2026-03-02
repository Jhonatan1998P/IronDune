import React, { useState, useEffect } from 'react';
import { useP2P, PeerMessage } from '../../context/P2PContext';
import { Icons } from '../UIComponents';
import { useToast } from '../ui/Toast';

interface P2PLobbyProps {
  playerName: string;
  playerScore: number;
  onBattleStart: (opponentId: string, isHost: boolean) => void;
}

interface DiscoveredPeer {
  id: string;
  name: string;
  score: number;
}

const defaultTranslations = {
  title: 'PvP Battle',
  your_id: 'Tu ID',
  enter_id: 'Ingresa ID del oponente...',
  connect: 'Conectar',
  online_players: 'Jugadores Conectados',
  challenge: 'Desafiar',
  battle_request: 'Solicitud de Batalla!',
  wants_to_battle: 'quiere batallar contigo!',
  decline: 'Rechazar',
  accept: 'Aceptar',
  hint: 'Comparte tu ID con un amigo para batallar!',
  connected: 'Conectado exitosamente!',
  connection_failed: 'Conexión fallida. Verifica el ID.',
  id_copied: 'ID copiado!',
  waiting: 'Esperando al oponente...',
  battle_started: 'Batalla iniciada!',
  challenge_sent: 'Desafío enviado!',
  player_connected: 'Jugador conectado!',
};

export const P2PLobby: React.FC<P2PLobbyProps> = ({ 
  playerName, 
  playerScore,
  onBattleStart 
}) => {
  const [remotePeerId, setRemotePeerId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [discoveredPeers, setDiscoveredPeers] = useState<Map<string, DiscoveredPeer>>(new Map());
  const [battleRequest, setBattleRequest] = useState<{from: string; name: string; score: number} | null>(null);
  
  const { peerId, connectToPeer, sendToPeer, status, connectedPeers } = useP2P();

  const { showSuccess, showError, showInfo } = useToast();
  const t2 = defaultTranslations;

  useEffect(() => {
    if (status === 'connected' && connectedPeers.size > 0) {
      showSuccess(t2.player_connected);
    }
  }, [connectedPeers.size, status, showSuccess, t2.player_connected]);

  useEffect(() => {
    const handleMessage = (e: CustomEvent<PeerMessage & { from: string }>) => {
      const { from, type, payload } = e.detail;
      
      switch (type) {
        case 'player_info':
          setDiscoveredPeers(prev => {
            const newMap = new Map(prev);
            newMap.set(from, { id: from, name: payload.name, score: payload.score });
            return newMap;
          });
          break;
        case 'challenge':
          setBattleRequest({ from, name: payload.from, score: payload.score });
          showInfo(`${payload.from} quiere batallar!`);
          break;
        case 'accept':
          onBattleStart(from, false);
          showSuccess(t2.battle_started);
          break;
      }
    };

    window.addEventListener('p2p-message', handleMessage as EventListener);
    return () => window.removeEventListener('p2p-message', handleMessage as EventListener);
  }, [onBattleStart, showInfo, showSuccess, t2.battle_started]);

  const handleConnect = async () => {
    if (!remotePeerId.trim()) return;
    setIsConnecting(true);
    showInfo(t2.waiting);
    try {
      await connectToPeer(remotePeerId.trim());
      showSuccess(t2.connected);
      setRemotePeerId('');
    } catch (err: any) {
      const errorMessage = err?.message || t2.connection_failed;
      showError(errorMessage);
      console.error('Connection failed:', err);
    }
    setIsConnecting(false);
  };

  const handleChallenge = (peer: DiscoveredPeer) => {
    sendToPeer(peer.id, {
      type: 'challenge',
      payload: { from: playerName, score: playerScore }
    });
    showInfo(t2.challenge_sent);
    onBattleStart(peer.id, true);
  };

  const handleAcceptChallenge = () => {
    if (!battleRequest) return;
    sendToPeer(battleRequest.from, {
      type: 'accept',
      payload: { army: {} }
    });
    showSuccess(t2.battle_started);
    onBattleStart(battleRequest.from, false);
    setBattleRequest(null);
  };

  const handleDeclineChallenge = () => {
    setBattleRequest(null);
  };

  const copyPeerId = () => {
    if (peerId) {
      navigator.clipboard.writeText(peerId);
      showSuccess(t2.id_copied);
    }
  };

  return (
    <div className="flex flex-col min-h-full p-2 sm:p-4 gap-3 sm:gap-4 animate-[fadeIn_0.3s_ease-out]">
      {/* Header Status */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
          <span className="text-xs sm:text-sm text-slate-400 uppercase font-bold">
            {status === 'connected' ? 'En línea' : 'Conectando...'}
          </span>
        </div>
        {connectedPeers.size > 0 && (
          <span className="text-xs sm:text-sm text-cyan-400 font-bold">
            {connectedPeers.size} conectado{connectedPeers.size > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Your ID Card */}
      <div className="glass-panel p-3 sm:p-4 rounded-xl border border-white/10">
        <h2 className="font-tech text-sm sm:text-base text-white uppercase tracking-widest flex items-center gap-2 mb-3 sm:mb-4">
          <Icons.Radar className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
          {t2.title}
        </h2>
        
        <div className="space-y-3">
          <div className="bg-slate-800/50 p-2 sm:p-3 rounded-lg border border-white/10">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
              {t2.your_id}
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs sm:text-sm text-cyan-300 bg-black/30 p-2 rounded truncate">
                {peerId || 'Generando...'}
              </code>
              <button
                onClick={copyPeerId}
                disabled={!peerId}
                className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 rounded border border-white/10 transition-colors shrink-0"
                title="Copiar"
              >
                <Icons.Mail className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={remotePeerId}
              onChange={(e) => setRemotePeerId(e.target.value)}
              placeholder={t2.enter_id}
              className="flex-1 bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2.5 sm:py-3 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            />
            <button
              onClick={handleConnect}
              disabled={!remotePeerId.trim() || isConnecting || status !== 'connected'}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors whitespace-nowrap"
            >
              {isConnecting ? '...' : t2.connect}
            </button>
          </div>
        </div>
      </div>

      {/* Connected Players */}
      {discoveredPeers.size > 0 && (
        <div className="glass-panel p-3 sm:p-4 rounded-xl border border-white/10">
          <h3 className="font-tech text-xs sm:text-sm text-white uppercase tracking-widest mb-3">
            {t2.online_players}
          </h3>
          <div className="space-y-2">
            {Array.from(discoveredPeers.values()).map((peer) => (
              <div
                key={peer.id}
                className="flex items-center justify-between bg-slate-800/50 p-2.5 sm:p-3 rounded-lg border border-white/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-white font-bold text-sm truncate">{peer.name}</div>
                  <div className="text-slate-500 text-xs">
                    Puntos: {peer.score.toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => handleChallenge(peer)}
                  className="ml-2 px-3 sm:px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-300 text-xs font-bold uppercase tracking-wider rounded transition-colors shrink-0"
                >
                  {t2.challenge}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Battle Request Modal */}
      {battleRequest && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-xl p-4 sm:p-6 max-w-md w-full shadow-2xl">
            <h3 className="font-tech text-base sm:text-lg text-white uppercase tracking-widest mb-3 text-center">
              {t2.battle_request}
            </h3>
            <p className="text-slate-300 mb-2 text-center">
              <span className="text-cyan-300 font-bold">{battleRequest.name}</span> 
              {' '}({battleRequest.score.toLocaleString()} pts)
            </p>
            <p className="text-slate-500 text-sm text-center mb-6">
              {t2.wants_to_battle}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeclineChallenge}
                className="flex-1 py-3 sm:py-3.5 bg-white/10 hover:bg-white/20 text-white text-sm font-bold uppercase tracking-wider rounded transition-colors"
              >
                {t2.decline}
              </button>
              <button
                onClick={handleAcceptChallenge}
                className="flex-1 py-3 sm:py-3.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold uppercase tracking-wider rounded transition-colors"
              >
                {t2.accept}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hint */}
      <div className="text-center text-slate-500 text-xs mt-auto px-2">
        <p className="leading-relaxed">{t2.hint}</p>
      </div>
    </div>
  );
};
