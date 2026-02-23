import React from 'react';
import { Faction } from '../../types/faction';
import { BotState } from '../../types/bot';

export const FactionDetails: React.FC<{ faction: Faction; botStates: Record<string, BotState>; isPlayerFaction: boolean; isPlayerLeader: boolean; onInviteBot: (botId: string) => void; onClose: () => void }> = ({ faction, onClose }) => {
  return (
    <div className="faction-details text-sm text-slate-200">
      <h3 className="text-base font-bold mb-2">{faction.name}</h3>
      <button onClick={onClose} className="px-2 py-1 text-xs bg-slate-800 border border-white/10 rounded">Cerrar</button>
    </div>
  );
};
