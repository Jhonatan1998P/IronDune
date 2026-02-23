import React from 'react';
import { BotState } from '../../types/bot';
import { Faction } from '../../types/faction';

export const RelationsOverview: React.FC<{ botStates: Record<string, BotState>; factions: Record<string, Faction>; playerFactionId: string | null }> = () => {
  return (
    <div className="relations-overview text-sm text-slate-400">
      <p>Mapa de relaciones próximamente.</p>
    </div>
  );
};
