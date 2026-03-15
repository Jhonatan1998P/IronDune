/**
 * MultiplayerButton Component
 *
 * Muestra el número de jugadores activos.
 * Solo admin/dev pueden ver la lista completa de quién está conectado.
 */

import React, { useState } from 'react';
import { MultiplayerMenu } from './UI/MultiplayerMenu';
import { useOnlineCount } from '../hooks/useServerRankings';
import { useAuth } from '../context/AuthContext';
import { User } from 'lucide-react';

interface MultiplayerButtonProps {
  variant?: 'default' | 'icon' | 'text';
  className?: string;
}

export const MultiplayerButton: React.FC<MultiplayerButtonProps> = ({
  variant = 'default',
  className = ''
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const { role } = useAuth();
  const onlineCount = useOnlineCount();

  const isPrivileged = role === 'admin' || role === 'dev';

  return (
    <>
      <button
        onClick={() => isPrivileged && setShowMenu(true)}
        className={`
          relative flex items-center gap-2 px-3 py-2 rounded-lg
          transition-all border font-tech text-xs uppercase tracking-wider
          ${isPrivileged
            ? 'bg-violet-900/30 border-violet-500/50 text-violet-300 hover:bg-violet-900/40 cursor-pointer'
            : 'bg-slate-800/50 border-white/10 text-slate-400 cursor-default'}
          ${className}
        `}
        title={`${onlineCount} jugadores activos`}
      >
        <User className={`w-4 h-4 ${isPrivileged ? 'text-violet-400' : 'text-slate-500'}`} />

        {variant !== 'icon' && (
          <span className="hidden sm:inline">
            {onlineCount}
          </span>
        )}

        {/* Pulso cuando hay jugadores online */}
        {onlineCount > 0 && (
          <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse ${isPrivileged ? 'bg-violet-400' : 'bg-slate-500'}`} />
        )}
      </button>

      {showMenu && isPrivileged && (
        <MultiplayerMenu onClose={() => setShowMenu(false)} />
      )}
    </>
  );
};

export const useMultiplayerMenu = () => {
  const [showMenu, setShowMenu] = useState(false);

  const open = () => setShowMenu(true);
  const close = () => setShowMenu(false);

  const Menu = () => (showMenu ? <MultiplayerMenu onClose={close} /> : null);

  return { showMenu, open, close, Menu };
};
