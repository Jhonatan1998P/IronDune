import React, { useState, useMemo } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { useLanguage } from '../../context/LanguageContext';
import { GlassButton, Card } from '../UIComponents';
import { FactionCard } from './FactionCard';
import { FactionDetails } from './FactionDetails';
import { JoinFactionModal } from './JoinFactionModal';
import { FactionIdeology, FACTION_LIMITS } from '../../types/faction';
import { GameState } from '../../types';

interface FactionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FactionPanel: React.FC<FactionPanelProps> = ({ isOpen, onClose }) => {
  const langHook = useLanguage();
  const t: any = langHook.t;
  const gameHook = useGameState();
  const state: any = gameHook.state || {};
  const dispatch = gameHook.dispatch;
  
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const playerFactionId = (state as any).playerFactionId || null;
  const playerFaction = playerFactionId ? (state as any).factions?.[playerFactionId] : null;
  
  const sortedFactions = useMemo(() => {
    const factions = (state as any).factions || {};
    return Object.values(factions)
      .sort((a: any, b: any) => b.power - a.power);
  }, [state]);
  
  if (!isOpen) return null;
  
  const handleJoinFaction = (factionId: string) => {
    dispatch({ type: 'PLAYER_JOIN_FACTION', payload: { factionId } });
    setShowJoinModal(false);
  };
  
  const handleLeaveFaction = () => {
    if (playerFactionId) {
      dispatch({ type: 'PLAYER_LEAVE_FACTION', payload: { factionId: playerFactionId } });
    }
  };
  
  const handleCreateFaction = (name: string, tag: string, ideology: FactionIdeology) => {
    dispatch({ type: 'PLAYER_CREATE_FACTION', payload: { name, tag, ideology } });
    setShowCreateModal(false);
  };
  
  const handleInviteBot = (botId: string) => {
    if (playerFactionId) {
      dispatch({ type: 'PLAYER_INVITE_TO_FACTION', payload: { factionId: playerFactionId, botId } });
    }
  };
  
  const factions = (state as any).factions || {};
  const botStates = (state as any).botStates || {};
  
  return (
    <Card title={t.common.factions.title} className="space-y-4">
      <div className="flex flex-col gap-4 p-3 md:p-4 custom-scrollbar">
        {playerFaction ? (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-cyan-500/30">
            <h3 className="text-sm font-bold text-cyan-300 mb-3">
              {t.common.factions.your_faction}: {playerFaction.name} [{playerFaction.tag}]
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-3">
              <span>{t.common.factions.power}: <span className="text-white">{playerFaction.power}</span></span>
              <span>{t.common.factions.members}: <span className="text-white">{playerFaction.memberIds.length + playerFaction.officerIds.length + 1}</span></span>
              <span>{t.common.factions.stability}: <span className="text-white">{playerFaction.stability}%</span></span>
              <span>{t.common.factions.wars}: <span className="text-white">{playerFaction.activeWars.filter((w: any) => w.status === 'active').length}</span></span>
            </div>
            <div className="flex gap-2">
              {playerFaction.leaderId === 'player' && (
                <GlassButton onClick={() => {}} variant="primary" className="text-xs">
                  {t.common.factions.manage}
                </GlassButton>
              )}
              <GlassButton onClick={handleLeaveFaction} variant="danger" className="text-xs">
                {t.common.factions.leave}
              </GlassButton>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10 text-center">
            <p className="text-sm text-slate-400 mb-3">{t.common.factions.no_faction}</p>
            <div className="flex gap-2 justify-center">
              <GlassButton onClick={() => setShowCreateModal(true)} variant="primary" className="text-xs">
                {t.common.factions.create_faction}
              </GlassButton>
              <GlassButton onClick={() => setShowJoinModal(true)} variant="neutral" className="text-xs">
                {t.common.factions.browse_factions}
              </GlassButton>
            </div>
          </div>
        )}
        
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            {t.common.factions.all_factions} ({sortedFactions.length})
          </h3>
          {sortedFactions.map((faction: any) => (
            <FactionCard
              key={faction.id}
              faction={faction}
              isPlayerFaction={faction.id === playerFactionId}
              isSelected={faction.id === selectedFaction}
              onClick={() => setSelectedFaction(
                selectedFaction === faction.id ? null : faction.id
              )}
            />
          ))}
        </div>
      </div>

      {selectedFaction && factions[selectedFaction] && (
        <FactionDetails
          faction={factions[selectedFaction]}
          botStates={botStates}
          isPlayerFaction={selectedFaction === playerFactionId}
          isPlayerLeader={factions[selectedFaction].leaderId === 'player'}
          onInviteBot={handleInviteBot}
          onClose={() => setSelectedFaction(null)}
        />
      )}

      {showJoinModal && (
        <JoinFactionModal
          factions={sortedFactions.filter((f: any) => f.memberIds.length < FACTION_LIMITS.MAX_MEMBERS) as any}
          onJoin={handleJoinFaction}
          onClose={() => setShowJoinModal(false)}
        />
      )}
    </Card>
  );
};
