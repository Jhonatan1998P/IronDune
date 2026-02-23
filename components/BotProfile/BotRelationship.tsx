import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { REPUTATION_THRESHOLDS } from '../../utils/engine/reputation';

interface BotRelationshipProps {
  reputation: number;
  repLabel: string;
  repColor: string;
  threatLevel: number;
  relation: string;
}

export const BotRelationship: React.FC<BotRelationshipProps> = ({
  reputation,
  repLabel,
  repColor,
  threatLevel,
  relation
}) => {
  const { t, language } = useLanguage();
  const isSpanish = language === 'es';

  const getRelationLabel = (): string => {
    const labels: Record<string, { es: string; en: string }> = {
      ally: { es: 'Aliado', en: 'Ally' },
      enemy: { es: 'Enemigo', en: 'Enemy' },
      faction_member: { es: 'Miembro de Facción', en: 'Faction Member' },
      neutral: { es: 'Neutral', en: 'Neutral' }
    };
    return labels[relation]?.[isSpanish ? 'es' : 'en'] || relation;
  };

  const getThreatLabel = (): string => {
    if (threatLevel >= 80) return isSpanish ? 'Crítico' : 'Critical';
    if (threatLevel >= 60) return isSpanish ? 'Alto' : 'High';
    if (threatLevel >= 40) return isSpanish ? 'Medio' : 'Medium';
    if (threatLevel >= 20) return isSpanish ? 'Bajo' : 'Low';
    return isSpanish ? 'Mínimo' : 'Minimal';
  };

  const getThreatColor = (): string => {
    if (threatLevel >= 80) return '#FF2222';
    if (threatLevel >= 60) return '#FF6622';
    if (threatLevel >= 40) return '#FFAA22';
    if (threatLevel >= 20) return '#FFCC44';
    return '#44FF66';
  };

  const getRelationColor = (): string => {
    if (relation === 'ally') return '#44FF66';
    if (relation === 'enemy') return '#FF4444';
    if (relation === 'faction_member') return '#44AAFF';
    return '#AAAAAA';
  };

  return (
    <div className="bot-relationship p-3 bg-slate-800/40 border border-white/5 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            {isSpanish ? 'Relación' : 'Relation'}
          </span>
          <span 
            className="px-2 py-0.5 rounded text-xs font-bold uppercase"
            style={{ backgroundColor: `${getRelationColor()}20`, color: getRelationColor() }}
          >
            {getRelationLabel()}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            {isSpanish ? 'Reputación' : 'Reputation'}
          </span>
          <span className="text-xs font-mono" style={{ color: repColor }}>
            {reputation > 0 ? '+' : ''}{reputation}
          </span>
        </div>
        
        <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="absolute h-full transition-all duration-300 rounded-full"
            style={{ 
              width: `${Math.abs(reputation)}%`,
              backgroundColor: repColor,
              left: reputation >= 0 ? 0 : 'auto',
              right: reputation < 0 ? 0 : 'auto'
            }}
          />
          <div 
            className="absolute h-full w-0.5 bg-white/50 left-1/2 -translate-x-1/2"
          />
        </div>
        
        <div className="flex justify-between text-[9px] text-slate-600">
          <span>-100</span>
          <span className={reputation >= 0 ? 'text-green-400' : 'text-red-400'}>
            {repLabel}
          </span>
          <span>+100</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            {isSpanish ? 'Nivel de Amenaza' : 'Threat Level'}
          </span>
          <span className="text-xs font-mono" style={{ color: getThreatColor() }}>
            {threatLevel}/100 - {getThreatLabel()}
          </span>
        </div>
        
        <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="absolute h-full transition-all duration-300 rounded-full"
            style={{ 
              width: `${threatLevel}%`,
              backgroundColor: getThreatColor()
            }}
          />
        </div>
      </div>
    </div>
  );
};
