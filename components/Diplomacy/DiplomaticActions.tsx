import React from 'react';
import { BotState } from '../../types/bot';
import { Faction } from '../../types/faction';
import { DiplomaticAction, DealTerms } from '../../types/diplomacy';

export const DiplomaticActions: React.FC<{ botStates: Record<string, BotState>; factions: Record<string, Faction>; onSendProposal: (targetId: string, action: DiplomaticAction, terms: DealTerms) => void }> = () => {
  return (
    <div className="diplomatic-actions text-sm text-slate-400">
      <p>Próximamente: formulario para enviar propuestas.</p>
    </div>
  );
};
