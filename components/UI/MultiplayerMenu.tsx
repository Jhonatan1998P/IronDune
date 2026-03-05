/**
 * MultiplayerMenu Component
 *
 * Menú modal para el sistema multijugador.
 * - Al abrir el juego el jugador ya está en la sala global automáticamente.
 * - Desde aquí puede salir de la sala global y crear/unirse a una privada.
 * - Si está en sala privada, puede volver a la sala global con un botón dedicado.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMultiplayer } from '../../hooks/useMultiplayer';
import { GLOBAL_ROOM_ID } from '../../hooks/useMultiplayerInternal';
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
  QrCode,
  Globe,
  ArrowLeft,
} from 'lucide-react';

interface MultiplayerMenuProps {
  onClose: () => void;
}

const generateRoomId = (): string => {
  return `sb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
};

const MultiplayerMenuContent: React.FC<MultiplayerMenuProps> = ({ onClose }) => {
  const {
    isConnected,
    isConnecting,
    peers,
    remotePlayers,
    currentRoomId,
    isGlobalRoom,
    createRoom,
    joinRoomById,
    leave,
    reconnect,
    returnToGlobalRoom,
  } = useMultiplayer();

  const { showSuccess, showError, showInfo } = useToast();
  const [roomIdInput, setRoomIdInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewRoomId, setPreviewRoomId] = useState<string | null>(null);
  // Vista: 'main' = sala activa, 'custom' = crear/unirse a sala privada
  const [view, setView] = useState<'main' | 'custom'>('main');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const previewId = useMemo(() => {
    if (!showPreview) return null;
    return previewRoomId || generateRoomId();
  }, [showPreview, previewRoomId]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCreateRoom = useCallback(() => {
    if (!showPreview) {
      const newPreviewId = generateRoomId();
      setPreviewRoomId(newPreviewId);
      setShowPreview(true);
      showInfo('ID generado. Confirma para crear la sala');
      return;
    }

    const roomId = previewRoomId ? createRoom(previewRoomId) : createRoom();
    if (roomId) {
      setPreviewRoomId(roomId);
      setView('main');
      setShowPreview(false);
      showSuccess(`Sala creada: ${roomId}`);
    } else {
      showError('Error al crear la sala');
    }
  }, [createRoom, showSuccess, showError, showInfo, showPreview, previewRoomId]);

  const handleCancelPreview = useCallback(() => {
    setShowPreview(false);
    setPreviewRoomId(null);
  }, []);

  const handleJoinRoom = useCallback(() => {
    if (!roomIdInput.trim()) {
      showError('Ingresa un código de sala');
      return;
    }
    const success = joinRoomById(roomIdInput);
    if (success) {
      setView('main');
      setRoomIdInput('');
      showInfo('Uniéndose a la sala...');
    } else {
      showError('Error al unir a la sala');
    }
  }, [roomIdInput, joinRoomById, showInfo, showError]);

  const handleLeaveToCustom = useCallback(() => {
    // Salir de la sala actual (global) para ir a una privada
    leave();
    setShowPreview(false);
    setPreviewRoomId(null);
    setView('custom');
    showInfo('Has salido de la sala global');
  }, [leave, showInfo]);

  const handleLeaveCustomRoom = useCallback(() => {
    // Salir de sala privada sin volver a global automáticamente
    leave();
    setShowPreview(false);
    setPreviewRoomId(null);
    showInfo('Has salido de la sala privada');
  }, [leave, showInfo]);

  const handleReturnToGlobal = useCallback(() => {
    const success = returnToGlobalRoom();
    if (success) {
      setView('main');
      setShowPreview(false);
      setPreviewRoomId(null);
      showInfo('Volviendo a la sala global...');
    }
  }, [returnToGlobalRoom, showInfo]);

  const handleReconnect = useCallback(() => {
    const success = reconnect();
    if (success) {
      showInfo('Reconectando...');
    }
  }, [reconnect, showInfo]);

  const handleCopyRoomId = useCallback(() => {
    const idToCopy = previewId || currentRoomId;
    if (idToCopy) {
      navigator.clipboard.writeText(idToCopy);
      setCopied(true);
      showSuccess('Código copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [currentRoomId, previewId, showSuccess]);

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
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out] p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="multiplayer-modal-title"
    >
      {/* Modal Container - Responsive */}
      <div
        className="relative w-full max-w-md mx-auto h-[85dvh] md:h-auto md:max-h-[85vh] md:my-auto flex flex-col animate-[slideUp_0.3s_ease-out] bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-white/10 shadow-2xl rounded-t-2xl md:rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent pointer-events-none" />

        {/* Header - Sticky */}
        <div className="relative shrink-0 flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm rounded-t-2xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <div className="flex items-center gap-3 min-w-0 z-10">
            <div className="relative">
              <div className={`p-2.5 rounded-xl shadow-lg ${isGlobalRoom && isConnected ? 'bg-gradient-to-br from-violet-500 to-violet-600 shadow-violet-500/25' : 'bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-cyan-500/25'}`}>
                {isGlobalRoom && isConnected ? (
                  <Globe className="w-5 h-5 text-white" />
                ) : (
                  <Users className="w-5 h-5 text-white" />
                )}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            </div>
            <div className="min-w-0">
              <h2
                id="multiplayer-modal-title"
                className="font-tech text-sm text-white uppercase tracking-wider truncate"
              >
                {isGlobalRoom && isConnected ? 'Sala Global' : 'Multijugador'}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <p className="text-[10px] text-slate-400 font-medium">
                  {isConnected
                    ? isGlobalRoom
                      ? 'Sala global activa'
                      : 'Sala privada activa'
                    : isConnecting
                    ? 'Conectando...'
                    : 'Desconectado'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all duration-200 hover:rotate-90 shrink-0 z-10"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="relative flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4 z-10">

          {/* Estado: Conectando */}
          {isConnecting && !isConnected && (
            <div className="relative p-6 rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-900/30 to-amber-950/30 text-center overflow-hidden">
              <div className="absolute inset-0 bg-amber-500/5 animate-pulse" />
              <div className="relative">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                </div>
                <p className="text-amber-400 font-bold uppercase tracking-wider text-sm">
                  Conectando a la red P2P...
                </p>
                <p className="text-amber-400/60 text-xs mt-1">
                  Esto puede tomar unos segundos
                </p>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* VISTA: SALA ACTIVA (global o privada)                               */}
          {/* ------------------------------------------------------------------ */}
          {isConnected && view === 'main' && (
            <div className="space-y-4">

              {/* Sala Global - Banner especial */}
              {isGlobalRoom && (
                <div className="relative p-4 rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-900/30 to-slate-900/50 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-violet-500/20 rounded-lg shrink-0">
                      <Globe className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-violet-300 font-bold text-sm uppercase tracking-wider">Sala Global</p>
                      <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                        Estás conectado con todos los jugadores en línea. Esta sala es compartida automáticamente por todos.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Info de conexión */}
              <div className="relative p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/20 to-slate-900/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Users className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-emerald-400 font-bold uppercase tracking-wider text-xs block">
                        Sala Activa
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        {peers.length + 1} jugador{peers.length !== 1 ? 'es' : ''} conectado{peers.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Código de sala (solo para sala privada) */}
              {currentRoomId && !isGlobalRoom && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-400 uppercase tracking-wider font-bold flex items-center gap-2">
                      <QrCode className="w-3 h-3" />
                      Código de tu Sala
                    </label>
                    <button
                      onClick={handleCopyRoomId}
                      className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-md transition-colors text-[10px] text-cyan-400"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>
                  <div className="font-mono text-center text-lg text-cyan-300 bg-black/50 px-4 py-3 rounded-xl tracking-wider border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
                    {currentRoomId}
                  </div>
                  <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 bg-cyan-500/50 rounded-full animate-pulse" />
                    Comparte este código con tus amigos para que se unan
                  </p>
                </div>
              )}

              {/* Lista de jugadores */}
              <div className="space-y-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider font-bold flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  Jugadores en la Sala
                </label>
                <div className="rounded-xl border border-white/10 bg-slate-900/50 max-h-48 overflow-y-auto custom-scrollbar">
                  {remotePlayers.length > 0 ? (
                    <div className="p-2 space-y-2">
                      {remotePlayers.map((player: PlayerPresence) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-white/5 hover:border-cyan-500/20 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-white font-bold text-sm truncate flex items-center gap-2">
                              <span className="w-2 h-2 bg-cyan-400 rounded-full shrink-0" />
                              {player.name}
                            </div>
                            <div className="text-slate-500 text-xs pl-4">
                              Nivel {player.level.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      <p>Esperando jugadores...</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {isGlobalRoom
                          ? 'Cuando otros jugadores entren al juego aparecerán aquí'
                          : 'Comparte el código de sala'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Acciones según tipo de sala */}
              {isGlobalRoom ? (
                // En sala global: opción de ir a sala privada
                <button
                  onClick={handleLeaveToCustom}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700/40 hover:bg-slate-700/60 border border-white/10 text-slate-300 rounded-lg font-bold uppercase tracking-wider transition-all text-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  Crear o unirse a sala privada
                </button>
              ) : (
                // En sala privada: volver a sala global + salir
                <div className="space-y-2">
                  <button
                    onClick={handleReturnToGlobal}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-300 rounded-lg font-bold uppercase tracking-wider transition-all text-sm hover:scale-[1.02]"
                  >
                    <Globe className="w-4 h-4" />
                    Volver a Sala Global
                  </button>
                  <button
                    onClick={handleLeaveCustomRoom}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg font-bold uppercase tracking-wider transition-all text-sm"
                  >
                    <WifiOff className="w-4 h-4" />
                    Salir de la Sala
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* VISTA: DESCONECTADO - Reconectar o ir a sala privada                */}
          {/* ------------------------------------------------------------------ */}
          {!isConnected && !isConnecting && (
            <div className="space-y-4">

              {/* Botón prominente para volver a sala global */}
              <button
                onClick={handleReturnToGlobal}
                className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-gradient-to-r from-violet-600 hover:from-violet-500 to-violet-600 text-white rounded-xl font-bold uppercase tracking-wider transition-all text-sm shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02]"
              >
                <Globe className="w-5 h-5" />
                Reconectar a Sala Global
              </button>

              <p className="text-[10px] text-slate-500 text-center">
                La sala global conecta a todos los jugadores automáticamente
              </p>

              {/* Separador */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-950 px-3 text-slate-500">o</span>
                </div>
              </div>

              {/* Ir a vista de sala privada */}
              <button
                onClick={() => setView('custom')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 text-slate-300 rounded-lg font-bold uppercase tracking-wider transition-all text-sm"
              >
                <PlusCircle className="w-4 h-4" />
                Sala privada
              </button>
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* VISTA: SALA PRIVADA (crear / unirse)                                */}
          {/* ------------------------------------------------------------------ */}
          {view === 'custom' && !isConnected && !isConnecting && (
            <div className="space-y-4">
              {/* Back button */}
              <button
                onClick={() => { setView('main'); setShowPreview(false); setPreviewRoomId(null); }}
                className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </button>

              {/* Previsualización del ID de sala */}
              {showPreview && previewId && (
                <div className="relative p-4 rounded-xl border border-cyan-500/40 bg-gradient-to-br from-cyan-900/20 to-slate-900/50 animate-[fadeIn_0.3s_ease-out]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
                        Tu ID de Sala
                      </span>
                    </div>
                    <button
                      onClick={handleCopyRoomId}
                      className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-md transition-colors"
                      title="Copiar código"
                    >
                      {copied ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400" />
                      )}
                      <span className="text-[10px] text-slate-400">{copied ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-lg text-center text-cyan-300 bg-black/40 px-4 py-3 rounded-lg tracking-wider border border-white/5">
                    {previewId}
                  </div>
                  <p className="text-[10px] text-slate-500 text-center mt-2">
                    Este código se compartirá con los jugadores
                  </p>
                </div>
              )}

              {/* Botón de reconectar sala privada anterior (si existe) */}
              {currentRoomId && currentRoomId !== GLOBAL_ROOM_ID && (
                <button
                  onClick={handleReconnect}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/50 text-amber-300 rounded-lg font-bold uppercase tracking-wider transition-all text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reconectar a sala anterior
                </button>
              )}

              {/* Crear sala privada */}
              <button
                onClick={handleCreateRoom}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold uppercase tracking-wider transition-all text-sm ${
                  showPreview
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-gradient-to-r from-cyan-600 hover:from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40'
                }`}
              >
                {showPreview ? (
                  <>
                    <Check className="w-4 h-4" />
                    Confirmar y Crear
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    Generar ID de Sala
                  </>
                )}
              </button>

              {showPreview && (
                <button
                  onClick={handleCancelPreview}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
                >
                  <X className="w-3 h-3" />
                  Cancelar
                </button>
              )}

              {/* Unirse con código */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider px-2">
                    O únete a una sala existente
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={roomIdInput}
                      onChange={(e) => setRoomIdInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Código de sala"
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 font-mono tracking-wide min-w-0 transition-all"
                      maxLength={30}
                    />
                    {roomIdInput && (
                      <button
                        onClick={() => setRoomIdInput('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleJoinRoom}
                    disabled={!roomIdInput.trim()}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white font-bold uppercase tracking-wider transition-all shrink-0 flex items-center gap-2"
                    aria-label="Unirse a sala"
                  >
                    <LogIn className="w-4 h-4" />
                    <span className="hidden sm:inline">Unirse</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Vista custom cuando ya está conectado (sala privada activa, ir a custom no aplica) */}
          {view === 'custom' && isConnected && (
            <div className="space-y-3">
              <button
                onClick={() => setView('main')}
                className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Ver sala activa
              </button>
            </div>
          )}

        </div>

        {/* Footer - Sticky */}
        <div className="relative shrink-0 p-4 border-t border-white/10 bg-slate-900/80 backdrop-blur-sm z-10">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            {isConnected ? (
              <>
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isGlobalRoom ? 'bg-violet-500/70' : 'bg-emerald-500/50'}`} />
                <span>
                  {isGlobalRoom
                    ? 'Sala global — todos los jugadores te ven'
                    : 'Sala privada — comparte el código para invitar'}
                </span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
                <span>Reconecta a la sala global para estar en línea</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * MultiplayerMenu - Versión con Portal para renderizar dentro del main
 */
export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = (props) => {
  const [mountPoint, setMountPoint] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    // Buscar el elemento main en el documento
    const mainElement = document.querySelector('main');
    if (mainElement) {
      setMountPoint(mainElement);
    } else {
      // Fallback: usar el body si no hay main
      setMountPoint(document.body);
    }
  }, []);

  if (!mountPoint) return null;

  return createPortal(
    <MultiplayerMenuContent {...props} />,
    mountPoint
  );
};
