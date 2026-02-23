import React from 'react';
import { DiplomaticAction } from '../../types/diplomacy';
import { useLanguage } from '../../context/LanguageContext';

interface ProposalCardProps {
  proposal: {
    id: string;
    type: DiplomaticAction;
    fromId: string;
    fromType: 'bot' | 'faction' | 'player';
    toId: string;
    toType: 'bot' | 'faction' | 'player';
    terms: {
      resourcesOffered?: Record<string, number>;
      resourcesRequested?: Record<string, number>;
      duration?: number;
      targetId?: string;
    };
    status: string;
    createdAt: number;
    expiresAt: number;
    respondedAt?: number;
    response?: string;
  };
  senderName: string;
  senderPersonality?: string;
  senderReputation: number;
  timeRemaining: number;
  isExpiringSoon: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  senderName,
  senderPersonality,
  senderReputation,
  timeRemaining,
  isExpiringSoon,
  onAccept,
  onReject
}) => {
  const { t, language } = useLanguage();
  const isSpanish = language === 'es';

  const minutesLeft = Math.max(0, Math.floor(timeRemaining / 60000));

  const getActionLabel = (action: DiplomaticAction): string => {
    const labels: Partial<Record<DiplomaticAction, { es: string; en: string }>> = {
      [DiplomaticAction.PROPOSE_ALLIANCE]: { es: 'Propuesta de Alianza', en: 'Alliance Proposal' },
      [DiplomaticAction.PROPOSE_NON_AGGRESSION]: { es: 'Propuesta de No Agresión', en: 'Non-Aggression Proposal' },
      [DiplomaticAction.PROPOSE_TRADE_DEAL]: { es: 'Acuerdo Comercial', en: 'Trade Deal' },
      [DiplomaticAction.PROPOSE_JOINT_ATTACK]: { es: 'Ataque Conjunto', en: 'Joint Attack' },
      [DiplomaticAction.OFFER_TRIBUTE]: { es: 'Ofrecer Tributo', en: 'Offer Tribute' },
      [DiplomaticAction.REQUEST_AID]: { es: 'Solicitar Ayuda', en: 'Request Aid' },
      [DiplomaticAction.INVITE_TO_FACTION]: { es: 'Invitación a Facción', en: 'Faction Invite' },
      [DiplomaticAction.OFFER_CEASEFIRE]: { es: 'Alto el Fuego', en: 'Ceasefire Offer' },
      [DiplomaticAction.SURRENDER]: { es: 'Rendición', en: 'Surrender' },
      [DiplomaticAction.DEMAND_TRIBUTE]: { es: 'Exigir Tributo', en: 'Demand Tribute' }
    };
    return labels[action]?.[isSpanish ? 'es' : 'en'] || action.replace(/_/g, ' ');
  };

  const getActionColor = (action: DiplomaticAction): string => {
    if (action === DiplomaticAction.PROPOSE_ALLIANCE || 
        action === DiplomaticAction.OFFER_TRIBUTE ||
        action === DiplomaticAction.OFFER_CEASEFIRE) {
      return 'border-green-500/30 bg-green-900/10';
    }
    if (action === DiplomaticAction.DECLARE_WAR ||
        action === DiplomaticAction.DEMAND_TRIBUTE ||
        action === DiplomaticAction.PROPOSE_JOINT_ATTACK) {
      return 'border-red-500/30 bg-red-900/10';
    }
    return 'border-cyan-500/30 bg-cyan-900/10';
  };

  const getReputationColor = (rep: number): string => {
    if (rep >= 50) return '#44FF66';
    if (rep >= 25) return '#88FF00';
    if (rep >= 0) return '#FFCC00';
    if (rep >= -25) return '#FF8800';
    return '#FF4444';
  };

  return (
    <div className={`proposal-card rounded-lg border p-3 mb-2 ${getActionColor(proposal.type)}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-sm font-bold text-slate-100">{senderName}</h4>
          {senderPersonality && (
            <span className="text-[10px] text-slate-500">{senderPersonality}</span>
          )}
        </div>
        <div className="text-right">
          <span 
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ 
              backgroundColor: `${getReputationColor(senderReputation)}20`,
              color: getReputationColor(senderReputation)
            }}
          >
            {senderReputation > 0 ? '+' : ''}{senderReputation}
          </span>
        </div>
      </div>
      
      <p className="text-xs text-cyan-400 font-medium mb-1">
        {getActionLabel(proposal.type)}
      </p>
      
      {proposal.terms.resourcesOffered && Object.keys(proposal.terms.resourcesOffered).length > 0 && (
        <p className="text-[10px] text-slate-400">
          {isSpanish ? 'Ofrece:' : 'Offers:'} {Object.entries(proposal.terms.resourcesOffered).map(([k, v]) => `${v} ${k}`).join(', ')}
        </p>
      )}
      
      {proposal.terms.resourcesRequested && Object.keys(proposal.terms.resourcesRequested).length > 0 && (
        <p className="text-[10px] text-slate-400">
          {isSpanish ? 'Solicita:' : 'Requests:'} {Object.entries(proposal.terms.resourcesRequested).map(([k, v]) => `${v} ${k}`).join(', ')}
        </p>
      )}
      
      <div className="flex items-center justify-between mt-2">
        <span className={`text-[10px] ${isExpiringSoon ? 'text-red-400 animate-pulse' : 'text-slate-500'}`}>
          {isSpanish ? 'Expira en' : 'Expires in'}: ~{minutesLeft} min
        </span>
        <div className="flex gap-2">
          <button 
            onClick={onReject} 
            className="px-3 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors"
          >
            {isSpanish ? 'Rechazar' : 'Reject'}
          </button>
          <button 
            onClick={onAccept} 
            className="px-3 py-1 text-xs rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 transition-colors"
          >
            {isSpanish ? 'Aceptar' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
};
