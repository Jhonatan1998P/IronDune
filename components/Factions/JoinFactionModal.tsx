import React from 'react';
import { Faction } from '../../types/faction';

export const JoinFactionModal: React.FC<{ factions: Faction[]; onJoin: (factionId: string) => void; onClose: () => void }> = ({ factions, onJoin, onClose }) => {
  return <div className="modal">
    <h3>Join a Faction</h3>
    {factions.map(f => <button key={f.id} onClick={() => onJoin(f.id)}>Join {f.name}</button>)}
    <button onClick={onClose}>Cancel</button>
  </div>;
};
