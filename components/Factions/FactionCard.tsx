import React from 'react';
import { Faction } from '../../types/faction';

export const FactionCard: React.FC<{ faction: Faction; isPlayerFaction: boolean; isSelected: boolean; onClick: () => void }> = ({ faction, isPlayerFaction, isSelected, onClick }) => {
  return <div className={`faction-card ${isSelected ? 'selected' : ''}`} onClick={onClick}>
    <h4>{faction.name} [{faction.tag}]</h4>
    <p>Power: {faction.power}</p>
  </div>;
};
