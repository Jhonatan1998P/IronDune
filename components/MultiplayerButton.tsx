/**
 * MultiplayerButton Component
 * 
 * Botón para abrir el menú multijugador desde cualquier parte de la app
 */

import React, { useState } from 'react';
import { MultiplayerMenu } from './UI/MultiplayerMenu';
import { useMultiplayer } from '../hooks/useMultiplayer';
import { Users } from 'lucide-react';

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
            ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/40' 
            : 'bg-slate-800/50 border-white/10 text-slate-400 hover:bg-slate-700/50'}
          ${className}
        `}
      >
        <Users className="w-4 h-4" />
        {variant !== 'icon' && (
          <span className="hidden sm:inline">
            {isConnected ? `Sala (${remotePlayers.length + 1})` : 'Multijugador'}
          </span>
        )}
        {isConnected && remotePlayers.length > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span>
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
