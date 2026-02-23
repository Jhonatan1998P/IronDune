import React, { useMemo } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { useLanguage } from '../../context/LanguageContext';
import { Card } from '../UIComponents';
import { ThreatAssessment } from './ThreatAssessment';
import { IncomingOperations } from './IncomingOperations';
import { WorldEventsFeed } from './WorldEventsFeed';
import { CoordinatedOperation } from '../../types/operations';

export const IntelPanel: React.FC = () => {
  const { t } = useLanguage();
  const { state } = useGameState();
  
  const detectedOperations = useMemo(() => {
    return Object.values(state.operations || {})
      .filter((op: CoordinatedOperation) => 
        op.targetId === 'player' && 
        op.detectedByPlayer && 
        (op.status === 'planning' || op.status === 'mobilizing' || op.status === 'active')
      )
      .sort((a, b) => a.plannedStartTime - b.plannedStartTime);
  }, [state.operations]);
  
  const threats = useMemo(() => {
    return Object.values(state.botStates)
      .filter(bot => bot.playerReputation < -25)
      .sort((a, b) => a.playerReputation - b.playerReputation)
      .slice(0, 10);
  }, [state.botStates]);
  
  const potentialAllies = useMemo(() => {
    return Object.values(state.botStates)
      .filter(bot => bot.playerReputation > 25 && !bot.factionId)
      .sort((a, b) => b.playerReputation - a.playerReputation)
      .slice(0, 5);
  }, [state.botStates]);
  
  const recentEvents = useMemo(() => {
    return (state.diplomacy.worldEvents || [])
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);
  }, [state.diplomacy.worldEvents]);
  
  return (
    <Card title={t.common.intelligence.title} className="space-y-4">
        <div className="flex flex-col gap-4 custom-scrollbar">
            {detectedOperations.length > 0 && (
                <div className="bg-red-900/20 rounded-lg p-3 border border-red-500/30">
                    <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        {t.common.intelligence.incoming_threats}
                    </h3>
                    <IncomingOperations
                        operations={detectedOperations}
                        botStates={state.botStates}
                        factions={state.factions}
                    />
                </div>
            )}
            
            <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {t.common.intelligence.threats}
                </h3>
                <p className="text-xs text-slate-500 mb-3">{t.common.intelligence.threats_desc}</p>
                <ThreatAssessment
                    threats={threats}
                    potentialAllies={potentialAllies}
                    botStates={state.botStates}
                    factions={state.factions}
                />
            </div>
            
            <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {t.common.intelligence.allies}
                </h3>
                <p className="text-xs text-slate-500 mb-3">{t.common.intelligence.allies_desc}</p>
                {potentialAllies.length > 0 ? (
                    <div className="space-y-2">
                        {potentialAllies.map(bot => (
                            <div key={bot.id} className="bg-emerald-900/10 border border-emerald-500/20 rounded p-2">
                                <div className="text-xs text-emerald-400 font-bold">{bot.name}</div>
                                <div className="text-[10px] text-slate-500">
                                    {t.common.diplomacy.reputation_trusted}: {bot.playerReputation}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-slate-500">{t.common.intelligence.no_allies}</p>
                )}
            </div>
            
            <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {t.common.intelligence.events}
                </h3>
                <WorldEventsFeed
                    events={recentEvents}
                    botStates={state.botStates}
                    factions={state.factions}
                />
            </div>
        </div>
    </Card>
  );
};
