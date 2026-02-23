import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { PlayerActionMemory, AttackMemory, AllyMemory, BetrayalMemory } from '../../types/bot';

interface BotHistoryProps {
  playerActions: PlayerActionMemory[];
  recentAttackers: AttackMemory[];
  recentAllies: AllyMemory[];
  betrayals: BetrayalMemory[];
}

export const BotHistory: React.FC<BotHistoryProps> = ({
  playerActions,
  recentAttackers,
  recentAllies,
  betrayals
}) => {
  const { t, language } = useLanguage();
  const isSpanish = language === 'es';

  const formatTimeAgo = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return isSpanish ? `hace ${days}d` : `${days}d ago`;
    }
    if (hours > 0) {
      return isSpanish ? `hace ${hours}h` : `${hours}h ago`;
    }
    if (minutes > 0) {
      return isSpanish ? `hace ${minutes}m` : `${minutes}m ago`;
    }
    return isSpanish ? 'ahora' : 'now';
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, { es: string; en: string }> = {
      attack: { es: 'Atacó', en: 'Attacked' },
      help: { es: 'Ayudó', en: 'Helped' },
      trade: { es: 'Comerció', en: 'Traded' },
      betray: { es: 'Traicionó', en: 'Betrayed' },
      alliance: { es: 'Formó alianza', en: 'Formed alliance' }
    };
    return labels[action]?.[isSpanish ? 'es' : 'en'] || action;
  };

  const getHelpTypeLabel = (type: string): string => {
    const labels: Record<string, { es: string; en: string }> = {
      defense: { es: 'Defensa', en: 'Defense' },
      attack: { es: 'Ataque', en: 'Attack' },
      resources: { es: 'Recursos', en: 'Resources' }
    };
    return labels[type]?.[isSpanish ? 'es' : 'en'] || type;
  };

  const recentActions = [...playerActions]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  const recentBetrayals = [...betrayals]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3);

  return (
    <div className="bot-history space-y-3">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
        {isSpanish ? 'Historial de Interacciones' : 'Interaction History'}
      </h4>
      
      {playerActions.length === 0 && recentAttackers.length === 0 && recentAllies.length === 0 && betrayals.length === 0 ? (
        <p className="text-xs text-slate-500 italic">
          {isSpanish ? 'Sin historial disponible' : 'No history available'}
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
          {recentActions.map((action, idx) => (
            <div key={`action-${idx}`} className="flex items-center justify-between text-xs bg-slate-800/30 border border-white/5 rounded px-2 py-1.5">
              <span className={`font-medium ${
                action.action === 'attack' ? 'text-red-400' :
                action.action === 'help' ? 'text-green-400' :
                action.action === 'trade' ? 'text-cyan-400' :
                action.action === 'betray' ? 'text-orange-400' : 'text-slate-400'
              }`}>
                {getActionLabel(action.action)}
              </span>
              <span className="text-slate-500">{formatTimeAgo(action.timestamp)}</span>
            </div>
          ))}

          {recentAttackers.slice(0, 3).map((attack, idx) => (
            <div key={`attacker-${idx}`} className="flex items-center justify-between text-xs bg-red-900/20 border border-red-500/20 rounded px-2 py-1.5">
              <span className="text-red-400 font-medium">
                {isSpanish ? 'Atacó' : 'Attacked'} ({attack.attackerId.slice(0, 8)})
              </span>
              <span className="text-slate-500">{formatTimeAgo(attack.timestamp)}</span>
            </div>
          ))}

          {recentAllies.slice(0, 3).map((ally, idx) => (
            <div key={`ally-${idx}`} className="flex items-center justify-between text-xs bg-green-900/20 border border-green-500/20 rounded px-2 py-1.5">
              <span className="text-green-400 font-medium">
                {getHelpTypeLabel(ally.helpType)} ({ally.allyId.slice(0, 8)})
              </span>
              <span className="text-slate-500">{formatTimeAgo(ally.timestamp)}</span>
            </div>
          ))}

          {recentBetrayals.map((betrayal, idx) => (
            <div key={`betrayal-${idx}`} className="flex items-center justify-between text-xs bg-orange-900/20 border border-orange-500/30 rounded px-2 py-1.5">
              <span className="text-orange-400 font-medium">
                {isSpanish ? 'Traición' : 'Betrayal'}: {betrayal.context.slice(0, 20)}
              </span>
              <span className="text-slate-500">{formatTimeAgo(betrayal.timestamp)}</span>
            </div>
          ))}
        </div>
      )}

      {playerActions.length > 5 && (
        <p className="text-[10px] text-slate-500 text-right">
          +{playerActions.length - 5} {isSpanish ? 'más' : 'more'}
        </p>
      )}
    </div>
  );
};
