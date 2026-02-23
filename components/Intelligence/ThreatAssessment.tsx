import React from 'react';
import { BotState } from '../../types/bot';
import { Faction } from '../../types/faction';
import { useLanguage } from '../../context/LanguageContext';

interface ThreatAssessmentProps {
  threats: BotState[];
  potentialAllies: BotState[];
  botStates: Record<string, BotState>;
  factions: Record<string, Faction>;
}

export const ThreatAssessment: React.FC<ThreatAssessmentProps> = ({
  threats,
  potentialAllies,
  botStates,
  factions
}) => {
  const { t, language } = useLanguage();
  const isSpanish = language === 'es';

  const getThreatLevelLabel = (level: number): string => {
    if (level >= 80) return isSpanish ? 'CRÍTICO' : 'CRITICAL';
    if (level >= 60) return isSpanish ? 'ALTO' : 'HIGH';
    if (level >= 40) return isSpanish ? 'MEDIO' : 'MEDIUM';
    if (level >= 20) return isSpanish ? 'BAJO' : 'LOW';
    return isSpanish ? 'MÍNIMO' : 'MINIMAL';
  };

  const getThreatColor = (level: number): string => {
    if (level >= 80) return '#FF2222';
    if (level >= 60) return '#FF6622';
    if (level >= 40) return '#FFAA22';
    if (level >= 20) return '#FFCC44';
    return '#44FF66';
  };

  if (threats.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {isSpanish ? 'Sin amenazas detectadas.' : 'No detected threats.'}
      </p>
    );
  }

  return (
    <div className="threat-assessment space-y-2">
      {threats.slice(0, 5).map(t => (
        <div 
          key={t.id} 
          className="flex items-center justify-between bg-slate-800/40 border border-white/5 rounded px-3 py-2"
        >
          <div className="flex flex-col">
            <span className="font-semibold text-sm text-slate-200">{t.name}</span>
            <span className="text-[10px] text-slate-500">
              {isSpanish ? 'Puntuación' : 'Score'}: {t.armyScore.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span 
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ 
                backgroundColor: `${getThreatColor(t.memory.playerThreatLevel)}20`,
                color: getThreatColor(t.memory.playerThreatLevel)
              }}
            >
              {getThreatLevelLabel(t.memory.playerThreatLevel)}
            </span>
            <span 
              className="text-[10px] mt-1 font-mono"
              style={{ color: getThreatColor(t.memory.playerThreatLevel) }}
            >
              {t.memory.playerThreatLevel}%
            </span>
          </div>
        </div>
      ))}
      
      {threats.length > 5 && (
        <p className="text-[10px] text-slate-500 text-right">
          +{threats.length - 5} {isSpanish ? 'más' : 'more'}
        </p>
      )}
    </div>
  );
};
