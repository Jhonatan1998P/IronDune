import React from 'react';
import { FactionWar } from '../../types/faction';

export const FactionWars: React.FC<{ wars: FactionWar[] }> = ({ wars }) => {
  return <div className="faction-wars">
    {wars.map(w => <div key={w.id}>War against {w.enemyFactionId}</div>)}
  </div>;
};
