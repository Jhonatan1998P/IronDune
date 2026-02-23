import React from 'react';
import { CoordinatedOperation, OperationType } from '../../types/operations';
import { BotState } from '../../types/bot';
import { Faction } from '../../types/faction';
import { useLanguage } from '../../context/LanguageContext';

interface IncomingOperationsProps {
  operations: CoordinatedOperation[];
  botStates: Record<string, BotState>;
  factions: Record<string, Faction>;
}

export const IncomingOperations: React.FC<IncomingOperationsProps> = ({
  operations,
  botStates,
  factions
}) => {
  const { t, language } = useLanguage();
  const isSpanish = language === 'es';

  const getOperationTypeLabel = (type: OperationType): string => {
    const labels: Partial<Record<OperationType, { es: string; en: string }>> = {
      [OperationType.PINCER_ATTACK]: { es: 'Ataque de Pinzas', en: 'Pincer Attack' },
      [OperationType.WAVE_ASSAULT]: { es: 'Asalto de Oleadas', en: 'Wave Assault' },
      [OperationType.BLITZKRIEG]: { es: 'Guerra Relámpago', en: 'Blitzkrieg' },
      [OperationType.SIEGE]: { es: 'Asedio', en: 'Siege' },
      [OperationType.MUTUAL_DEFENSE]: { es: 'Defensa Mutua', en: 'Mutual Defense' },
      [OperationType.COUNTER_OFFENSIVE]: { es: 'Contraofensiva', en: 'Counter-Offensive' }
    };
    return labels[type]?.[isSpanish ? 'es' : 'en'] || type;
  };

  const formatTimeRemaining = (targetTime: number): string => {
    const diff = targetTime - Date.now();
    if (diff <= 0) return isSpanish ? 'En curso' : 'In progress';
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return isSpanish ? `${hours}h ${minutes % 60}m` : `${hours}h ${minutes % 60}m`;
    }
    return isSpanish ? `${minutes}m` : `${minutes}m`;
  };

  const getOrganizerName = (id: string): string => {
    if (id === 'player') return isSpanish ? 'Jugador' : 'Player';
    if (botStates[id]) return botStates[id].name;
    if (factions[id]) return factions[id].name;
    return id.slice(0, 8);
  };

  const getStatusLabel = (status: string): string => {
    const labels: Partial<Record<string, { es: string; en: string }>> = {
      planning: { es: 'Planificación', en: 'Planning' },
      mobilizing: { es: 'Movilización', en: 'Mobilizing' },
      active: { es: 'Activa', en: 'Active' },
      completed: { es: 'Completada', en: 'Completed' },
      failed: { es: 'Fallida', en: 'Failed' },
      cancelled: { es: 'Cancelada', en: 'Cancelled' }
    };
    return labels[status]?.[isSpanish ? 'es' : 'en'] || status;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'planning': return '#FFAA22';
      case 'mobilizing': return '#FF6622';
      case 'active': return '#FF2222';
      default: return '#888888';
    }
  };

  return (
    <div className="incoming-operations space-y-2 text-sm text-slate-200">
      {operations.map(op => (
        <div 
          key={op.id} 
          className="bg-slate-800/40 border border-red-500/30 rounded px-3 py-2"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-red-400">
              {getOperationTypeLabel(op.type)}
            </span>
            <span 
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ 
                backgroundColor: `${getStatusColor(op.status)}20`,
                color: getStatusColor(op.status)
              }}
            >
              {getStatusLabel(op.status)}
            </span>
          </div>
          
          <div className="text-[11px] text-slate-400 space-y-0.5">
            <div className="flex items-center justify-between">
              <span>{isSpanish ? 'Organizador' : 'Organizer'}:</span>
              <span className="text-slate-300">{getOrganizerName(op.organizerId)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{isSpanish ? 'Participantes' : 'Participants'}:</span>
              <span className="text-slate-300">{op.participantIds.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{isSpanish ? 'Inicio' : 'Start'}:</span>
              <span className="text-red-400 font-mono">
                {formatTimeRemaining(op.plannedStartTime)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
