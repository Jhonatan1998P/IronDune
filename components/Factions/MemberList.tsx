import React from 'react';
import { Faction } from '../../types/faction';
import { BotState } from '../../types/bot';

export const MemberList: React.FC<{ faction: Faction; botStates: Record<string, BotState> }> = ({ faction }) => {
  return <ul className="member-list">
    {faction.memberIds.map(id => <li key={id}>{id}</li>)}
  </ul>;
};
