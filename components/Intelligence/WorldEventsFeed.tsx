import React from 'react';
import { BotState } from '../../types/bot';
import { Faction } from '../../types/faction';
import { WorldEvent, WorldEventType } from '../../types/diplomacy';
import { useLanguage } from '../../context/LanguageContext';

interface WorldEventsFeedProps {
  events: WorldEvent[];
  botStates: Record<string, BotState>;
  factions: Record<string, Faction>;
}

export const WorldEventsFeed: React.FC<WorldEventsFeedProps> = ({
  events,
  botStates,
  factions
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

  const getEventTypeLabel = (type: WorldEventType): string => {
    const labels: Partial<Record<WorldEventType, { es: string; en: string }>> = {
      [WorldEventType.WAR_DECLARED]: { es: 'Guerra Declarada', en: 'War Declared' },
      [WorldEventType.WAR_ENDED]: { es: 'Guerra Terminada', en: 'War Ended' },
      [WorldEventType.ALLIANCE_FORMED]: { es: 'Alianza Formada', en: 'Alliance Formed' },
      [WorldEventType.ALLIANCE_BROKEN]: { es: 'Alianza Rota', en: 'Alliance Broken' },
      [WorldEventType.FACTION_FORMED]: { es: 'Facción Formada', en: 'Faction Formed' },
      [WorldEventType.FACTION_DISSOLVED]: { es: 'Facción Disuelta', en: 'Faction Dissolved' },
      [WorldEventType.BETRAYAL]: { es: 'Traición', en: 'Betrayal' },
      [WorldEventType.MAJOR_BATTLE]: { es: 'Batalla Mayor', en: 'Major Battle' },
      [WorldEventType.POWER_SHIFT]: { es: 'Cambio de Poder', en: 'Power Shift' }
    };
    return labels[type]?.[isSpanish ? 'es' : 'en'] || type;
  };

  const getEventColor = (type: WorldEventType): string => {
    const colors: Partial<Record<WorldEventType, string>> = {
      [WorldEventType.WAR_DECLARED]: '#FF4444',
      [WorldEventType.WAR_ENDED]: '#888888',
      [WorldEventType.ALLIANCE_FORMED]: '#44FF66',
      [WorldEventType.ALLIANCE_BROKEN]: '#FF8844',
      [WorldEventType.FACTION_FORMED]: '#44AAFF',
      [WorldEventType.FACTION_DISSOLVED]: '#FF4444',
      [WorldEventType.BETRAYAL]: '#FF4444',
      [WorldEventType.MAJOR_BATTLE]: '#FFAA22',
      [WorldEventType.POWER_SHIFT]: '#AA44FF'
    };
    return colors[type] || '#AAAAAA';
  };

  const getImpactColor = (impact: string): string => {
    switch (impact) {
      case 'critical': return '#FF2222';
      case 'major': return '#FFAA22';
      default: return '#888888';
    }
  };

  const resolveActorName = (actorId: string): string => {
    if (actorId === 'player') return isSpanish ? 'Jugador' : 'Player';
    if (botStates[actorId]) return botStates[actorId].name;
    if (factions[actorId]) return factions[actorId].name;
    return actorId.slice(0, 8);
  };

  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {isSpanish ? 'Sin eventos recientes.' : 'No recent events.'}
      </p>
    );
  }

  const recentEvents = [...events]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  return (
    <div className="world-events-feed space-y-2">
      {recentEvents.map(e => (
        <div 
          key={e.id} 
          className="bg-slate-800/40 border border-white/5 rounded px-3 py-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span 
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ 
                  backgroundColor: `${getEventColor(e.type)}20`,
                  color: getEventColor(e.type)
                }}
              >
                {getEventTypeLabel(e.type)}
              </span>
            </div>
            <span 
              className="text-[9px] font-bold px-1 py-0.5 rounded"
              style={{ 
                backgroundColor: `${getImpactColor(e.impact)}20`,
                color: getImpactColor(e.impact)
              }}
            >
              {isSpanish ? e.impact === 'minor' ? 'MENOR' : e.impact === 'major' ? 'MAYOR' : 'CRÍTICO' 
                : e.impact.toUpperCase()}
            </span>
          </div>
          
          <p className="text-xs text-slate-300 mt-1.5">
            {e.description}
          </p>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              {e.actors.slice(0, 3).map((actor, idx) => (
                <React.Fragment key={actor}>
                  {idx > 0 && <span className="text-slate-600">→</span>}
                  <span className="text-slate-400">{resolveActorName(actor)}</span>
                </React.Fragment>
              ))}
            </div>
            <span className="text-[10px] text-slate-500">
              {formatTimeAgo(e.timestamp)}
            </span>
          </div>
        </div>
      ))}
      
      {events.length > 10 && (
        <p className="text-[10px] text-slate-500 text-right">
          +{events.length - 10} {isSpanish ? 'más' : 'more'}
        </p>
      )}
    </div>
  );
};
