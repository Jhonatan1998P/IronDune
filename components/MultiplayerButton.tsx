/**
 * MultiplayerButton Component
 *
 * Botón para abrir el menú multijugador desde cualquier parte de la app.
 * Muestra el estado de la sala global y permite volver a ella si se sale.
 */

import React, { useState } from 'react';
import { MultiplayerMenu } from './UI/MultiplayerMenu';
import { useMultiplayer } from '../hooks/useMultiplayer';
import { User } from 'lucide-react';

interface MultiplayerButtonProps {
  variant?: 'default' | 'icon' | 'text';
  className?: string;
}

/**
 * Botón que abre el menú multijugador
 * Usa el hook useMultiplayer para mostrar el estado de conexión
 */
export const MultiplayerButton: React.FC<MultiplayerButtonProps> = ({
  variant = 'default',
  className = ''
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const { isConnected, remotePlayers } = useMultiplayer();

  return (
    <>
      <button
        onClick={() => setShowMenu(true)}
        className={`
          relative flex items-center gap-2 px-3 py-2 rounded-lg
          transition-all border font-tech text-xs uppercase tracking-wider
          ${isConnected
            ? 'bg-violet-900/30 border-violet-500/50 text-violet-300 hover:bg-violet-900/40'
            : 'bg-slate-800/50 border-amber-500/40 text-amber-400 hover:bg-slate-700/50'}
          ${className}
        `}
        title={
          isConnected
            ? `${remotePlayers.length + 1} usuarios en línea`
            : 'Desconectado — pulsa para reintentar conexión'
        }
      >
        <User className={`w-4 h-4 ${isConnected ? 'text-violet-400' : 'text-amber-400'}`} />

        {variant !== 'icon' && (
          <span className="hidden sm:inline">
            {isConnected
              ? `${remotePlayers.length + 1}`
              : 'OFF'}
          </span>
        )}

        {/* Pulso violeta: conectado con otros */}
        {isConnected && remotePlayers.length > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-violet-400 rounded-full animate-pulse" />
        )}

        {/* Pulso ámbar: desconectado */}
        {!isConnected && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
        )}
      </button>

      {showMenu && (
        <MultiplayerMenu onClose={() => setShowMenu(false)} />
      )}
    </>
  );
};

/**
 * Hook para abrir el menú multijugador programáticamente
 */
export const useMultiplayerMenu = () => {
  const [showMenu, setShowMenu] = useState(false);

  const open = () => setShowMenu(true);
  const close = () => setShowMenu(false);

  const Menu = () => (showMenu ? <MultiplayerMenu onClose={close} /> : null);

  return { showMenu, open, close, Menu };
};
