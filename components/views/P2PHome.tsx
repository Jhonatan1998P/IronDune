import React, { useState, useEffect, useRef } from 'react';
import { useP2P, PeerMessage } from '../../context/P2PContext';
import { Icons } from '../UIComponents';
import { useToast } from '../ui/Toast';
import { formatNumber } from '../../utils';

interface P2PHomeProps {
  playerName: string;
  playerScore: number;
  onBattleStart: (opponentId: string, isHost: boolean) => void;
}

type TabType = 'friends' | 'battle' | 'chat' | 'rankings';

const defaultTranslations = {
  tabs: {
    friends: 'Amigos',
    battle: 'Batalla',
    chat: 'Chat',
    rankings: 'Rankings',
  },
  your_id: 'Tu ID',
  enter_id: 'Ingresa ID del oponente...',
  connect: 'Conectar',
  online_players: 'Conectados',
  offline_players: 'Desconectados',
  challenge: 'Desafiar',
  battle_request: 'Solicitud de Batalla!',
  wants_to_battle: 'quiere batallar contigo!',
  decline: 'Rechazar',
  accept: 'Aceptar',
  hint: 'Comparte tu ID con un amigo para jugar!',
  connected: 'Conectado!',
  connection_failed: 'Conexión fallida',
  id_copied: 'ID copiado!',
  waiting: 'Esperando...',
  battle_started: 'Batalla iniciada!',
  challenge_sent: 'Desafío enviado!',
  player_connected: 'Jugador conectado!',
  online: 'En línea',
  offline: 'Offline',
  remove: 'Eliminar',
  remove_confirm: 'Eliminar este jugador?',
  yes: 'Sí',
  no: 'No',
  removed: 'Jugador eliminado',
  type_message: 'Escribe un mensaje...',
  send: 'Enviar',
  no_messages: 'No hay mensajes aún',
  no_friends: 'Conecta con amigos para chatear!',
  your_rank: 'Tu Posición',
  of: 'de',
  players: 'jugadores',
};

export const P2PHome: React.FC<P2PHomeProps> = ({ 
  playerName, 
  playerScore,
  onBattleStart 
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [remotePeerId, setRemotePeerId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [battleRequest, setBattleRequest] = useState<{from: string; name: string; score: number} | null>(null);
  const [selectedChatPeer, setSelectedChatPeer] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  
  const { 
    peerId, 
    connectToPeer, 
    sendToPeer, 
    status, 
    connectedPeers, 
    knownPeers, 
    removePeer, 
    chatMessages,
    sendChat,
  } = useP2P();

  const { showSuccess, showError, showInfo } = useToast();
  const t = defaultTranslations;
  const chatEndRef = useRef<HTMLDivElement>(null);

  const onlinePeers = Array.from(knownPeers.values()).filter(p => p.isOnline && p.id !== peerId);
  const offlinePeers = Array.from(knownPeers.values()).filter(p => !p.isOnline && p.id !== peerId);
  const connectedPeerIds = Array.from(connectedPeers.keys());
  
  const currentChatMessages = selectedChatPeer ? chatMessages.get(selectedChatPeer) || [] : [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChatMessages]);

  useEffect(() => {
    if (status === 'connected' && connectedPeers.size > 0 && !selectedChatPeer) {
      const firstConnected = Array.from(connectedPeers.keys())[0];
      if (firstConnected) {
        setSelectedChatPeer(firstConnected);
      }
    }
  }, [connectedPeers, selectedChatPeer]);

  useEffect(() => {
    const handleMessage = (e: CustomEvent<PeerMessage & { from: string }>) => {
      const { from, type, payload } = e.detail;
      
      switch (type) {
        case 'challenge':
          setBattleRequest({ from, name: payload.from, score: payload.score });
          showInfo(`${payload.from} quiere batallar!`);
          break;
        case 'accept':
          onBattleStart(from, false);
          showSuccess(t.battle_started);
          break;
        case 'decline':
          showInfo('El jugador rechazó tu desafío');
          break;
        case 'chat':
          if (!selectedChatPeer) {
            setSelectedChatPeer(from);
          }
          break;
        case 'typing':
          break;
      }
    };

    window.addEventListener('p2p-message', handleMessage as EventListener);
    return () => window.removeEventListener('p2p-message', handleMessage as EventListener);
  }, [onBattleStart, showInfo, showSuccess, t.battle_started, selectedChatPeer]);

  const handleConnect = async () => {
    if (!remotePeerId.trim()) return;
    setIsConnecting(true);
    showInfo(t.waiting);
    try {
      await connectToPeer(remotePeerId.trim());
      showSuccess(t.connected);
      setRemotePeerId('');
      if (activeTab !== 'friends') {
        setActiveTab('friends');
      }
    } catch (err: any) {
      const errorMessage = err?.message || t.connection_failed;
      showError(errorMessage);
      console.error('Connection failed:', err);
    }
    setIsConnecting(false);
  };

  const handleChallenge = (peerIdToChallenge: string) => {
    sendToPeer(peerIdToChallenge, {
      type: 'challenge',
      payload: { from: playerName, score: playerScore }
    });
    showInfo(t.challenge_sent);
    onBattleStart(peerIdToChallenge, true);
  };

  const handleAcceptChallenge = () => {
    if (!battleRequest) return;
    sendToPeer(battleRequest.from, {
      type: 'accept',
      payload: { army: {} }
    });
    showSuccess(t.battle_started);
    onBattleStart(battleRequest.from, false);
    setBattleRequest(null);
  };

  const handleDeclineChallenge = () => {
    if (battleRequest) {
      sendToPeer(battleRequest.from, {
        type: 'decline',
        payload: { reason: 'declined' }
      });
    }
    setBattleRequest(null);
  };

  const copyPeerId = () => {
    if (peerId) {
      navigator.clipboard.writeText(peerId);
      showSuccess(t.id_copied);
    }
  };

  const handleRemovePeer = (peerIdToRemove: string) => {
    if (window.confirm(t.remove_confirm)) {
      removePeer(peerIdToRemove);
      showInfo(t.removed);
      if (selectedChatPeer === peerIdToRemove) {
        setSelectedChatPeer(null);
      }
    }
  };

  const handleSendChat = () => {
    if (!chatInput.trim() || !selectedChatPeer) return;
    sendChat(selectedChatPeer, chatInput.trim());
    setChatInput('');
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: 'bg-yellow-900/30', border: 'border-yellow-500/40', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.2)]' };
    if (rank === 2) return { bg: 'bg-slate-700/30', border: 'border-slate-400/40', glow: 'shadow-[0_0_15px_rgba(148,163,184,0.15)]' };
    if (rank === 3) return { bg: 'bg-orange-900/30', border: 'border-orange-500/40', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]' };
    return { bg: 'bg-slate-900/40', border: 'border-white/5', glow: '' };
  };

  const rankedPlayers = React.useMemo(() => {
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

  const playerRank = rankedPlayers.findIndex(p => p.isPlayer) + 1;
  const onlineCount = rankedPlayers.filter(p => p.isOnline).length;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'friends':
        return (
          <div className="space-y-4">
            {/* Your ID Card */}
            <div className="glass-panel p-3 sm:p-4 rounded-xl border border-white/10">
              <h3 className="font-tech text-xs sm:text-sm text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                <Icons.Radar className="w-4 h-4 text-cyan-400" />
                {t.your_id}
              </h3>
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
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={remotePeerId}
                  onChange={(e) => setRemotePeerId(e.target.value)}
                  placeholder={t.enter_id}
                  className="flex-1 bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                />
                <button
                  onClick={handleConnect}
                  disabled={!remotePeerId.trim() || isConnecting || status !== 'connected'}
                  className="px-3 sm:px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap"
                >
                  {isConnecting ? '...' : t.connect}
                </button>
              </div>
            </div>

            {/* Online Players */}
            {onlinePeers.length > 0 && (
              <div className="glass-panel p-3 sm:p-4 rounded-xl border border-emerald-500/20">
                <h3 className="font-tech text-xs sm:text-sm text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  {t.online_players} ({onlinePeers.length})
                </h3>
                <div className="space-y-2">
                  {onlinePeers.map((peer) => (
                    <div
                      key={peer.id}
                      className="flex items-center justify-between bg-slate-800/50 p-2.5 rounded-lg border border-white/5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-white font-bold text-sm truncate">{peer.name}</div>
                        <div className="text-slate-500 text-xs">
                          {formatNumber(peer.score)} pts
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleRemovePeer(peer.id)}
                          className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                          title={t.remove}
                        >
                          <Icons.Close className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleChallenge(peer.id)}
                          className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-300 text-xs font-bold uppercase tracking-wider rounded transition-colors"
                        >
                          {t.challenge}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offline Players */}
            {offlinePeers.length > 0 && (
              <div className="glass-panel p-3 sm:p-4 rounded-xl border border-white/10 opacity-60">
                <h3 className="font-tech text-xs sm:text-sm text-slate-500 uppercase tracking-widest mb-3">
                  {t.offline_players} ({offlinePeers.length})
                </h3>
                <div className="space-y-2">
                  {offlinePeers.map((peer) => (
                    <div
                      key={peer.id}
                      className="flex items-center justify-between bg-slate-800/30 p-2.5 rounded-lg border border-white/5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-slate-400 font-bold text-sm truncate">{peer.name}</div>
                        <div className="text-slate-600 text-xs">
                          {formatNumber(peer.score)} pts
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemovePeer(peer.id)}
                        className="p-2 text-slate-600 hover:text-red-400 transition-colors"
                        title={t.remove}
                      >
                        <Icons.Close className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {knownPeers.size === 0 && (
              <div className="glass-panel p-6 rounded-xl border border-white/10 text-center">
                <Icons.Radar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">{t.hint}</p>
              </div>
            )}
          </div>
        );

      case 'battle':
        return (
          <div className="space-y-4">
            <div className="glass-panel p-4 rounded-xl border border-white/10">
              <h3 className="font-tech text-sm text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                <Icons.Swords className="w-4 h-4 text-red-400" />
                Batalla Rápida
              </h3>
              <p className="text-slate-400 text-xs mb-4">
                Tus amigos en línea aparecerán aquí para aceptar batallas
              </p>
              
              {onlinePeers.length > 0 ? (
                <div className="space-y-2">
                  {onlinePeers.map((peer) => (
                    <button
                      key={peer.id}
                      onClick={() => handleChallenge(peer.id)}
                      className="w-full flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-white/5 hover:border-red-500/30 transition-colors"
                    >
                      <div className="text-left">
                        <div className="text-white font-bold">{peer.name}</div>
                        <div className="text-slate-500 text-xs">{formatNumber(peer.score)} pts</div>
                      </div>
                      <Icons.Swords className="w-5 h-5 text-red-400" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-sm">
                  No hay amigos en línea para batallar
                </div>
              )}
            </div>

            <div className="glass-panel p-4 rounded-xl border border-white/10">
              <h3 className="font-tech text-sm text-white uppercase tracking-widest mb-3">
                Cómo Batallar
              </h3>
              <ol className="text-slate-400 text-xs space-y-2 list-decimal list-inside">
                <li>Comparte tu ID con un amigo desde la pestaña Amigos</li>
                <li>Tu amigo ingresa tu ID y se conecta</li>
                <li>Cuando aparezca en tu lista, presiona "Desafiar"</li>
                <li>Tu amigo recibirá la solicitud y puede Acceptar o Rechazar</li>
              </ol>
            </div>
          </div>
        );

      case 'chat':
        return (
          <div className="flex flex-col h-full gap-2">
            {/* Chat Partner Selector */}
            {connectedPeerIds.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {connectedPeerIds.map((id) => {
                  const peer = knownPeers.get(id);
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedChatPeer(id)}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors
                        ${selectedChatPeer === id 
                          ? 'bg-cyan-600 text-white' 
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}
                      `}
                    >
                      {peer?.name || id.slice(0, 8)}...
                      <span className={`ml-1.5 w-2 h-2 inline-block rounded-full ${peer?.isOnline ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 glass-panel p-3 rounded-xl border border-white/10 overflow-y-auto custom-scrollbar min-h-[200px]">
              {selectedChatPeer ? (
                currentChatMessages.length > 0 ? (
                  <div className="space-y-2">
                    {currentChatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`
                            max-w-[80%] px-3 py-2 rounded-lg text-xs
                            ${msg.isOwn 
                              ? 'bg-cyan-600/80 text-white rounded-br-sm' 
                              : 'bg-slate-700/80 text-slate-200 rounded-bl-sm'}
                          `}
                        >
                          {!msg.isOwn && (
                            <div className="text-[10px] text-cyan-400 mb-1 font-bold">{msg.fromName}</div>
                          )}
                          <div>{msg.message}</div>
                          <div className={`text-[9px] mt-1 ${msg.isOwn ? 'text-cyan-200/60' : 'text-slate-500'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                    {t.no_messages}
                  </div>
                )
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  {t.no_friends}
                </div>
              )}
            </div>

            {/* Chat Input */}
            {selectedChatPeer && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder={t.type_message}
                  className="flex-1 bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim()}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  {t.send}
                </button>
              </div>
            )}
          </div>
        );

      case 'rankings':
        return (
          <div className="space-y-4">
            {/* Player Rank Card */}
            {playerRank > 0 && (
              <div className="glass-panel p-4 rounded-xl border border-cyan-500/40 bg-cyan-900/20">
                <div className="text-center">
                  <div className="text-cyan-300 text-[10px] uppercase tracking-widest font-bold">{t.your_rank}</div>
                  <div className="text-4xl font-bold text-white">#{playerRank}</div>
                  <div className="text-slate-400 text-xs mt-1">
                    {t.of} {rankedPlayers.length} {t.players} ({onlineCount} {t.online})
                  </div>
                </div>
              </div>
            )}

            {/* Rankings List */}
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
                      ${!player.isOnline ? 'opacity-50' : ''}
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`
                        flex items-center justify-center w-7 h-7 rounded font-bold text-sm shrink-0
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
                        <div className={`font-bold text-sm truncate flex items-center gap-2 ${player.isPlayer ? 'text-cyan-300' : 'text-white'}`}>
                          {player.name}
                          {player.isOnline && (
                            <span className="w-2 h-2 bg-emerald-400 rounded-full shrink-0"></span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="font-mono font-bold text-white text-sm">
                        {formatNumber(player.score)}
                      </div>
                      <div className="text-[9px] text-slate-500 uppercase">pts</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {rankedPlayers.length === 0 && (
              <div className="glass-panel p-6 rounded-xl border border-white/10 text-center">
                <Icons.Crown className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">{t.no_friends}</p>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${status === 'connected' ? 'bg-emerald-400 animate-pulse' : status === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`}></span>
          <span className="text-xs text-slate-400 uppercase font-bold">
            {status === 'connected' ? t.online : status === 'connecting' ? 'Conectando...' : 'Desconectado'}
          </span>
        </div>
        {knownPeers.size > 0 && (
          <span className="text-xs text-cyan-400 font-bold">
            {onlinePeers.length} {t.online}
          </span>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/10 overflow-x-auto">
        {(['friends', 'battle', 'chat', 'rankings'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              flex-1 px-2 py-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap
              ${activeTab === tab 
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-900/10' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}
            `}
          >
            <span className="flex items-center justify-center gap-1.5">
              {tab === 'friends' && <Icons.Users className="w-3.5 h-3.5" />}
              {tab === 'battle' && <Icons.Swords className="w-3.5 h-3.5" />}
              {tab === 'chat' && <Icons.Chat className="w-3.5 h-3.5" />}
              {tab === 'rankings' && <Icons.Crown className="w-3.5 h-3.5" />}
              {t.tabs[tab]}
              {tab === 'chat' && connectedPeerIds.length > 0 && (
                <span className="w-4 h-4 bg-cyan-600 rounded-full text-[8px] flex items-center justify-center">
                  {connectedPeerIds.length}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {renderTabContent()}
      </div>

      {/* Battle Request Modal */}
      {battleRequest && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-xl p-4 sm:p-6 max-w-md w-full shadow-2xl animate-[slideUp_0.3s_ease-out]">
            <h3 className="font-tech text-base text-white uppercase tracking-widest mb-3 text-center">
              {t.battle_request}
            </h3>
            <p className="text-slate-300 mb-2 text-center">
              <span className="text-cyan-300 font-bold">{battleRequest.name}</span> 
              {' '}({formatNumber(battleRequest.score)} pts)
            </p>
            <p className="text-slate-500 text-sm text-center mb-6">
              {t.wants_to_battle}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeclineChallenge}
                className="flex-1 py-3.5 bg-white/10 hover:bg-white/20 text-white text-sm font-bold uppercase tracking-wider rounded transition-colors"
              >
                {t.decline}
              </button>
              <button
                onClick={handleAcceptChallenge}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold uppercase tracking-wider rounded transition-colors"
              >
                {t.accept}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
