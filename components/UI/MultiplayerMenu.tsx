/**
 * MultiplayerMenu Component
 *
 * Menú modal simplificado para el sistema multijugador.
 * Muestra la lista de jugadores conectados globalmente.
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMultiplayer } from '../../hooks/useMultiplayer';

// Iconos de lucide-react
import {
  Users,
  X,
  Loader2,
} from 'lucide-react';

interface MultiplayerMenuProps {
  onClose: () => void;
}

const MultiplayerMenuContent: React.FC<MultiplayerMenuProps> = ({ onClose }) => {
  const {
    isConnected,
    isConnecting,
    remotePlayers,
  } = useMultiplayer();

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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out] p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="multiplayer-modal-title"
    >
      {/* Modal Container */}
      <div
        className="relative w-full max-w-md mx-auto h-[70dvh] md:h-auto md:max-h-[85vh] md:my-auto flex flex-col animate-[slideUp_0.3s_ease-out] bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-white/10 shadow-2xl rounded-t-2xl md:rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative shrink-0 flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm rounded-t-2xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
          <div className="flex items-center gap-3 min-w-0 z-10">
            <div className="relative">
              <div className="p-2.5 rounded-xl shadow-lg bg-gradient-to-br from-violet-500 to-violet-600 shadow-violet-500/25">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            </div>
            <div className="min-w-0">
              <h2
                id="multiplayer-modal-title"
                className="font-tech text-sm text-white uppercase tracking-wider truncate"
              >
                Jugadores en línea
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[10px] text-slate-400 font-medium">
                  {isConnected
                    ? `${remotePlayers.length + 1} usuarios conectados`
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

        {/* Content */}
        <div className="relative flex-1 flex flex-col items-center justify-center p-8 z-10">
          {/* Estado: Conectando */}
          {isConnecting && !isConnected && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              </div>
              <p className="text-violet-400 font-bold uppercase tracking-wider text-sm">
                Conectando...
              </p>
            </div>
          )}

          {/* Contador Simplificado */}
          {isConnected && (
            <div className="flex flex-col items-center gap-8 animate-[fadeIn_0.5s_ease-out]">
              <div className="flex items-center gap-6">
                <div className="relative">
                  {/* Gran punto verde parpadeante */}
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center border-2 border-emerald-500/30">
                    <div className="w-10 h-10 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_30px_rgba(16,185,129,0.6)]" />
                  </div>
                  {/* Efecto de radar */}
                  <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-[ping_3s_linear_infinite]" />
                </div>

                <div className="flex flex-col">
                  <div className="text-6xl font-tech font-black text-white leading-none">
                    {remotePlayers.length + 1}
                  </div>
                  <div className="text-emerald-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">
                    Comandantes en línea
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-slate-800/30 border border-white/5 max-w-xs text-center">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Estás activo y conectado al canal global. Tu presencia es visible para otros sistemas de comando.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative shrink-0 p-4 border-t border-white/10 bg-slate-900/80 backdrop-blur-sm z-10">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <p className="text-[10px] text-slate-500 text-center">
            Estás conectado al universo de Iron Dune. Todos los jugadores activos son visibles aquí.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * MultiplayerMenu - Portal version
 */
export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = (props) => {
  const [mountPoint, setMountPoint] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    const mainElement = document.querySelector('main');
    if (mainElement) {
      setMountPoint(mainElement);
    } else {
      setMountPoint(document.body);
    }
  }, []);

  if (!mountPoint) return null;

  return createPortal(
    <MultiplayerMenuContent {...props} />,
    mountPoint
  );
};
