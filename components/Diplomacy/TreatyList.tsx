import React from 'react';
import { ActiveTreaty } from '../../types/diplomacy';
import { BotState } from '../../types/bot';
import { Faction } from '../../types/faction';

export const TreatyList: React.FC<{ treaties: ActiveTreaty[]; botStates: Record<string, BotState>; factions: Record<string, Faction> }> = ({ treaties }) => {
  return <div className="treaty-list">
    {treaties.map(t => <div key={t.id}>{t.type}</div>)}
  </div>;
};
