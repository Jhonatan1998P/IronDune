/**
 * MultiplayerMenu Component
 *
 * Menú modal para el sistema multijugador.
 * Solo admin/dev pueden ver la lista de quién está conectado.
 * El resto solo ve el conteo total.
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMultiplayer } from '../../hooks/useMultiplayer';
import { useAuth } from '../../context/AuthContext';
import { useOnlineCount } from '../../hooks/useServerRankings';
import type { PlayerPresence } from '../../types/multiplayer';

import {
  User,
  Users,
  X,
  Loader2,
  ShieldCheck,
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

  const { role } = useAuth();
  const onlineCount = useOnlineCount();
  const isPrivileged = role === 'admin' || role === 'dev';

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
      <div
        className="relative w-full max-w-md mx-auto h-[70dvh] md:h-auto md:max-h-[85vh] md:my-auto flex flex-col animate-[slideUp_0.3s_ease-out] bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-white/10 shadow-2xl rounded-t-2xl md:rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
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
                className="font-tech text-sm text-white uppercase tracking-wider truncate flex items-center gap-2"
              >
                Jugadores activos
                {isPrivileged && (
                  <ShieldCheck className="w-3.5 h-3.5 text-violet-400" aria-label="Vista de administrador" />
                )}
              </h2>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                {isConnecting && !isConnected
                  ? 'Conectando...'
                  : `${onlineCount} jugadores en línea`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all duration-200 hover:rotate-90 shrink-0 z-10"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4 z-10">

          {isConnecting && !isConnected && (
            <div className="relative p-6 rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-900/30 to-slate-900/30 text-center overflow-hidden">
              <div className="absolute inset-0 bg-violet-500/5 animate-pulse" />
              <div className="relative">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                </div>
                <p className="text-violet-400 font-bold uppercase tracking-wider text-sm">
                  Estableciendo conexión...
                </p>
              </div>
            </div>
          )}

          {/* Count-only view for regular users */}
          {!isPrivileged && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-20 h-20 rounded-full bg-violet-900/30 border border-violet-500/30 flex items-center justify-center">
                <span className="text-3xl font-bold text-white">{onlineCount}</span>
              </div>
              <div className="text-center">
                <p className="text-slate-300 font-bold">Jugadores en línea</p>
                <p className="text-slate-500 text-xs mt-1">Información de jugadores privada</p>
              </div>
            </div>
          )}

          {/* Full list for admin/dev only */}
          {isPrivileged && isConnected && (
            <div className="space-y-4">
              <div className="text-[10px] text-violet-400 uppercase tracking-widest font-bold px-1">
                Vista de administrador — {remotePlayers.length + 1} conectados
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden">
                <div className="p-2 space-y-2">
                  <div className="flex items-center justify-between bg-violet-900/20 p-3 rounded-lg border border-violet-500/30">
                    <div className="min-w-0 flex-1">
                      <div className="text-violet-200 font-bold text-sm truncate flex items-center gap-2">
                        <User className="w-4 h-4 text-violet-400" />
                        Tú (Admin)
                      </div>
                      <div className="text-violet-400/70 text-[10px] pl-6 uppercase tracking-widest font-tech">
                        En línea
                      </div>
                    </div>
                  </div>

                  {remotePlayers.length > 0 ? (
                    remotePlayers.map((player: PlayerPresence) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-white/5 hover:border-violet-500/20 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-white font-bold text-sm truncate flex items-center gap-2">
                            <span className="w-2 h-2 bg-violet-400 rounded-full shrink-0" />
                            {player.name}
                          </div>
                          <div className="text-slate-500 text-xs pl-4 font-mono">
                            {player.id.slice(0, 8)}… · Nivel {player.level.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                      <p>No hay otros jugadores en línea</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative shrink-0 p-4 border-t border-white/10 bg-slate-900/80 backdrop-blur-sm z-10">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <p className="text-[10px] text-slate-500 text-center">
            {isPrivileged
              ? 'Modo administrador — lista completa de conexiones activas'
              : 'Iron Dune protege la privacidad de los jugadores'}
          </p>
        </div>
      </div>
    </div>
  );
};

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
