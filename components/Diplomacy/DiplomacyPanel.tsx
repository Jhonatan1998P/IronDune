import React, { useState, useMemo } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { useLanguage } from '../../context/LanguageContext';
import { Card } from '../UIComponents';
import { ProposalInbox } from './ProposalInbox';
import { RelationsOverview } from './RelationsOverview';
import { DiplomaticActions } from './DiplomaticActions';
import { TreatyList } from './TreatyList';
import { DiplomaticProposal, ActiveTreaty, DiplomaticAction, DealTerms } from '../../types/diplomacy';

type DiplomacyTab = 'inbox' | 'relations' | 'treaties' | 'actions';

export const DiplomacyPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DiplomacyTab>('inbox');
  const { t } = useLanguage();
  const { state, dispatch } = useGameState();
  
  const pendingProposals = useMemo(() => {
    return Object.values(state.diplomacy.proposals)
      .filter(p => p.status === 'pending' && p.toId === 'player')
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.diplomacy.proposals]);
  
  const activeTreaties = useMemo(() => {
    return Object.values(state.diplomacy.treaties)
      .filter(t => t.parties.includes('player'))
      .sort((a, b) => b.startedAt - a.startedAt);
  }, [state.diplomacy.treaties]);
  
  const tabs: { id: DiplomacyTab; label: string; badge?: number }[] = [
    { id: 'inbox', label: t.common.diplomacy.proposals, badge: pendingProposals.length },
    { id: 'relations', label: t.common.diplomacy.relations },
    { id: 'treaties', label: t.common.diplomacy.treaties, badge: activeTreaties.length },
    { id: 'actions', label: t.common.diplomacy.actions }
  ];
  
  const handleAcceptProposal = (proposalId: string) => {
    dispatch({ type: 'PLAYER_RESPOND_PROPOSAL', payload: { proposalId, response: 'accept' } });
  };
  
  const handleRejectProposal = (proposalId: string) => {
    dispatch({ type: 'PLAYER_RESPOND_PROPOSAL', payload: { proposalId, response: 'reject' } });
  };
  
  const handleSendProposal = (
    targetId: string, 
    action: DiplomaticAction, 
    terms: DealTerms
  ) => {
    dispatch({ type: 'PLAYER_SEND_PROPOSAL', payload: { targetId, action, terms } });
  };
  
  return (
    <Card title={t.common.diplomacy.title} className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === tab.id 
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50' 
                : 'bg-slate-800/50 text-slate-400 border border-white/10 hover:bg-white/5'
            }`}
          >
            {tab.label}
            {tab.badge && tab.badge > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px]">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      
      <div className="space-y-4 custom-scrollbar">
        {activeTab === 'inbox' && (
          <ProposalInbox
            proposals={pendingProposals}
            botStates={state.botStates}
            onAccept={handleAcceptProposal}
            onReject={handleRejectProposal}
          />
        )}
        {activeTab === 'relations' && (
          <RelationsOverview
            botStates={state.botStates}
            factions={state.factions}
            playerFactionId={state.playerFactionId || null}
          />
        )}
        {activeTab === 'treaties' && (
          <TreatyList
            treaties={activeTreaties}
            botStates={state.botStates}
            factions={state.factions}
          />
        )}
        {activeTab === 'actions' && (
          <DiplomaticActions
            botStates={state.botStates}
            factions={state.factions}
            onSendProposal={handleSendProposal}
          />
        )}
      </div>
    </Card>
  );
};
