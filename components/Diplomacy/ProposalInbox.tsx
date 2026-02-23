import React from 'react';
import { ProposalCard } from './ProposalCard';
import { DiplomaticProposal } from '../../types/diplomacy';
import { BotState } from '../../types/bot';
import { useLanguage } from '../../context/LanguageContext';

interface ProposalInboxProps {
  proposals: DiplomaticProposal[];
  botStates: Record<string, BotState>;
  onAccept: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
}

export const ProposalInbox: React.FC<ProposalInboxProps> = ({
  proposals,
  botStates,
  onAccept,
  onReject
}) => {
  const { t, language } = useLanguage();
  const isSpanish = language === 'es';

  if (proposals.length === 0) {
    return (
      <div className="empty-inbox text-sm text-slate-400 space-y-1">
        <p>{isSpanish ? 'No hay propuestas diplomáticas pendientes.' : 'No pending diplomatic proposals.'}</p>
        <p className="hint text-slate-500 text-xs">
          {isSpanish 
            ? 'Interactúa con bots para recibir propuestas o envía las tuyas desde la pestaña Acciones.' 
            : 'Interact with bots to receive proposals or send yours from the Actions tab.'}
        </p>
      </div>
    );
  }
  
  return (
    <div className="proposal-inbox">
      <div className="inbox-header text-sm text-slate-300">
        <span>
          {proposals.length} {isSpanish ? 'propuesta' : 'proposal'}{proposals.length !== 1 ? 's' : ''} {isSpanish ? 'pendiente' : 'pending'}{proposals.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div className="proposal-list">
        {proposals.map(proposal => {
          const sender = botStates[proposal.fromId];
          const timeRemaining = proposal.expiresAt - Date.now();
          const isExpiringSoon = timeRemaining < 5 * 60 * 1000;
          
          return (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              senderName={sender?.name || (isSpanish ? 'Desconocido' : 'Unknown')}
              senderPersonality={sender?.personality}
              senderReputation={sender?.playerReputation || 0}
              timeRemaining={timeRemaining}
              isExpiringSoon={isExpiringSoon}
              onAccept={() => onAccept(proposal.id)}
              onReject={() => onReject(proposal.id)}
            />
          );
        })}
      </div>
    </div>
  );
};
