/**
 * MultiplayerMenu Component
 * 
 * Menú modal para crear/unirse/reconectar a salas multijugador
 * Basado en MULTIPLAYER_ARCHITECTURE.md
 */

import React, { useState, useCallback } from 'react';
import { useMultiplayer } from '../../hooks/useMultiplayer';
import { useToast } from '../ui/Toast';
import type { PlayerPresence } from '../../types/multiplayer';

// Iconos de lucide-react
import {
  Users,
  PlusCircle,
  LogIn,
  WifiOff,
  Copy,
  Check,
  RefreshCw,
  X,
  Loader2,
} from 'lucide-react';

interface MultiplayerMenuProps {
  onClose: () => void;
}

export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = ({ onClose }) => {
  const {
    isConnected,
    isConnecting,
    peers,
    remotePlayers,
    currentRoomId,
    createRoom,
    joinRoomById,
    leave,
    reconnect,
  } = useMultiplayer();

  const { showSuccess, showError, showInfo } = useToast();
  const [roomIdInput, setRoomIdInput] = useState('');
  const [copied, setCopied] = useState(false);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCreateRoom = useCallback(() => {
    const roomId = createRoom();
    if (roomId) {
      showSuccess(`Sala creada: ${roomId}`);
    } else {
      showError('Error al crear la sala');
    }
  }, [createRoom, showSuccess, showError]);

  const handleJoinRoom = useCallback(() => {
    if (!roomIdInput.trim()) {
      showError('Ingresa un código de sala');
      return;
    }

    const success = joinRoomById(roomIdInput);
    if (success) {
      showInfo('Uniéndose a la sala...');
    } else {
      showError('Error al unir a la sala');
    }
  }, [roomIdInput, joinRoomById, showInfo, showError]);

  const handleLeave = useCallback(() => {
    leave();
    showInfo('Has salido de la sala');
  }, [leave, showInfo]);

  const handleReconnect = useCallback(() => {
    const success = reconnect();
    if (success) {
      showInfo('Reconectando...');
    }
  }, [reconnect, showInfo]);

  const handleCopyRoomId = useCallback(() => {
    if (currentRoomId) {
      navigator.clipboard.writeText(currentRoomId);
      setCopied(true);
      showSuccess('Código copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [currentRoomId, showSuccess]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isConnecting) {
      handleJoinRoom();
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="multiplayer-modal-title"
    >
      {/* Modal Container - Responsive */}
      <div
        className="relative w-full max-w-md md:max-w-lg h-[95dvh] md:h-auto md:max-h-[90dvh] md:my-auto flex flex-col animate-[slideUp_0.3s_ease-out] bg-slate-950 border border-white/10 shadow-2xl rounded-t-2xl md:rounded-2xl m-0 md:m-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - Sticky */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-cyan-900/30 to-slate-900 rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-cyan-500/20 rounded-lg shrink-0">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <h2
                id="multiplayer-modal-title"
                className="font-tech text-xs text-cyan-400 uppercase tracking-widest truncate"
              >
                Multijugador
              </h2>
              <p className="text-[9px] text-cyan-400/70 font-mono mt-0.5">
                {isConnected ? 'Conectado' : 'Desconectado'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 hover:bg-white/10 rounded-lg transition-colors shrink-0"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4">

          {/* Estado: Conectando */}
          {isConnecting && !isConnected && (
            <div className="glass-panel p-6 rounded-xl border border-amber-500/40 bg-amber-900/20 text-center">
              <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto mb-4" />
              <p className="text-amber-400 font-bold uppercase tracking-wider text-sm">
                Conectando...
              </p>
            </div>
          )}

          {/* Estado: Desconectado */}
          {!isConnected && !isConnecting && (
            <div className="space-y-4">
              {/* Botón de reconectar (si hay sala previa) */}
              {currentRoomId && (
                <button
                  onClick={handleReconnect}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/50 text-amber-300 rounded-lg font-bold uppercase tracking-wider transition-colors text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reconectar a sala anterior
                </button>
              )}

              {/* Separador */}
              {currentRoomId && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-950 px-3 text-slate-500">o</span>
                  </div>
                </div>
              )}

              {/* Crear sala */}
              <button
                onClick={handleCreateRoom}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold uppercase tracking-wider transition-colors text-sm"
              >
                <PlusCircle className="w-4 h-4" />
                Crear Sala
              </button>

              {/* Unirse con código */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    placeholder="Ingresa código de sala"
                    className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 uppercase tracking-wider min-w-0"
                    maxLength={20}
                  />
                  <button
                    onClick={handleJoinRoom}
                    disabled={!roomIdInput.trim()}
                    className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold uppercase tracking-wider transition-colors shrink-0"
                    aria-label="Unirse a sala"
                  >
                    <LogIn className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Ingresa el código de una sala existente para unirte
                </p>
              </div>
            </div>
          )}

          {/* Estado: Conectado */}
          {isConnected && (
            <div className="space-y-4">
              {/* Info de conexión */}
              <div className="glass-panel p-3 rounded-xl border border-emerald-500/40 bg-emerald-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className="text-emerald-400 font-bold uppercase tracking-wider text-xs">
                      Conectado
                    </span>
                  </div>
                  <span className="text-slate-400 text-xs font-medium">
                    {peers.length + 1} jugador{peers.length !== 1 ? 'es' : ''}
                  </span>
                </div>
              </div>

              {/* Código de sala (copiable) */}
              {currentRoomId && (
                <div className="space-y-2">
                  <label className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                    Código de Sala
                  </label>
                  <div className="flex gap-2">
                    <code className="flex-1 font-mono text-xs text-cyan-300 bg-black/40 border border-white/10 px-3 py-2.5 rounded-lg truncate uppercase tracking-wider block min-w-0">
                      {currentRoomId}
                    </code>
                    <button
                      onClick={handleCopyRoomId}
                      className="px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors shrink-0"
                      title="Copiar"
                      aria-label="Copiar código"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Comparte este código con tus amigos
                  </p>
                </div>
              )}

              {/* Lista de jugadores */}
              <div className="space-y-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                  Jugadores en la Sala
                </label>
                <div className="glass-panel p-2 rounded-xl border border-white/10 max-h-48 overflow-y-auto custom-scrollbar">
                  {remotePlayers.length > 0 ? (
                    <div className="space-y-2">
                      {remotePlayers.map((player: PlayerPresence) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg border border-white/5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-white font-bold text-sm truncate">
                              {player.name}
                            </div>
                            <div className="text-slate-500 text-xs">
                              Nivel {player.level.toLocaleString()}
                            </div>
                          </div>
                          <div className="w-2 h-2 bg-emerald-400 rounded-full shrink-0"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      Esperando jugadores...
                    </div>
                  )}
                </div>
              </div>

              {/* Salir */}
              <button
                onClick={handleLeave}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 rounded-lg font-bold uppercase tracking-wider transition-colors text-sm"
              >
                <WifiOff className="w-4 h-4" />
                Salir de la Sala
              </button>
            </div>
          )}
        </div>

        {/* Footer - Sticky */}
        <div className="shrink-0 p-4 border-t border-white/10 bg-slate-950 rounded-b-2xl">
          <p className="text-xs text-slate-500 text-center">
            {isConnected
              ? 'Los jugadores verán tu nombre y nivel automáticamente'
              : 'Comparte el código de sala o únete a una existente'
            }
          </p>
        </div>
      </div>
    </div>
  );
};
