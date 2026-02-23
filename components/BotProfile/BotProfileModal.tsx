import React from 'react';
import { BotState, BotGoal } from '../../types/bot';
import { BotPersonality } from '../../types/enums';
import { BotRelationship } from './BotRelationship';
import { BotHistory } from './BotHistory';
import { PERSONALITY_DESCRIPTIONS } from '../../utils/ai/personalityWeights';
import { REPUTATION_THRESHOLDS } from '../../utils/engine/reputation';
import { DiplomaticAction } from '../../types/diplomacy';
import { getAvailableDiplomaticActions } from '../../utils/engine/reputation';
import { useLanguage } from '../../context/LanguageContext';

interface BotProfileModalProps {
  bot: BotState;
  isOpen: boolean;
  onClose: () => void;
  onDiplomaticAction: (action: DiplomaticAction, botId: string) => void;
}

export const BotProfileModal: React.FC<BotProfileModalProps> = ({
  bot,
  isOpen,
  onClose,
  onDiplomaticAction
}) => {
  const { t, language } = useLanguage();
  const isSpanish = language === 'es';

  if (!isOpen) return null;
  
  const relation = bot.playerReputation > 50 ? 'ally' 
    : bot.playerReputation < -50 ? 'enemy' 
    : bot.factionId ? 'faction_member'
    : 'neutral';
  
  const availableActions = getAvailableDiplomaticActions(bot.playerReputation, relation);
  
  const getReputationLabel = (rep: number): { label: string; color: string } => {
    if (rep >= REPUTATION_THRESHOLDS.TRUSTED_ALLY) return { label: isSpanish ? 'Aliado de Confianza' : 'Trusted Ally', color: '#00FF00' };
    if (rep >= REPUTATION_THRESHOLDS.FRIENDLY) return { label: isSpanish ? 'Amigable' : 'Friendly', color: '#88FF00' };
    if (rep >= REPUTATION_THRESHOLDS.POSITIVE) return { label: isSpanish ? 'Positivo' : 'Positive', color: '#CCFF00' };
    if (rep >= REPUTATION_THRESHOLDS.NEUTRAL) return { label: isSpanish ? 'Neutral' : 'Neutral', color: '#FFCC00' };
    if (rep >= REPUTATION_THRESHOLDS.SUSPICIOUS) return { label: isSpanish ? 'Sospechoso' : 'Suspicious', color: '#FF8800' };
    if (rep >= REPUTATION_THRESHOLDS.HOSTILE) return { label: isSpanish ? 'Hostil' : 'Hostile', color: '#FF4400' };
    return { label: isSpanish ? 'Odiado' : 'Hated', color: '#FF0000' };
  };

  const getGoalLabel = (goal: BotGoal): string => {
    const labels: Partial<Record<BotGoal, { es: string; en: string }>> = {
      [BotGoal.EXPAND_ECONOMY]: { es: 'Expandir Economía', en: 'Expand Economy' },
      [BotGoal.BUILD_ARMY]: { es: 'Construir Ejército', en: 'Build Army' },
      [BotGoal.SEEK_ALLIANCE]: { es: 'Buscar Alianza', en: 'Seek Alliance' },
      [BotGoal.REVENGE]: { es: 'Venganza', en: 'Revenge' },
      [BotGoal.DEFEND_ALLY]: { es: 'Defender Aliado', en: 'Defend Ally' },
      [BotGoal.BETRAY_FACTION]: { es: 'Traicionar Facción', en: 'Betray Faction' },
      [BotGoal.DOMINATE_RANKING]: { es: 'Dominar Ranking', en: 'Dominate Ranking' },
      [BotGoal.SURVIVE]: { es: 'Supervivencia', en: 'Survive' },
      [BotGoal.RECRUIT_MEMBERS]: { es: 'Reclutar Miembros', en: 'Recruit Members' },
      [BotGoal.CONSOLIDATE_POWER]: { es: 'Consolidar Poder', en: 'Consolidate Power' }
    };
    return labels[goal]?.[isSpanish ? 'es' : 'en'] || goal.replace(/_/g, ' ');
  };

  const repInfo = getReputationLabel(bot.playerReputation);
  
  const totalArmy = Object.values(bot.army).reduce((sum, count) => sum + (count || 0), 0);
  const totalResources = Object.values(bot.resources).reduce((sum, val) => sum + val, 0);
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-cyan-500/30 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-white/10 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-lg bg-slate-800 border border-cyan-500/30 flex items-center justify-center overflow-hidden">
              {bot.avatarId ? (
                <img 
                  src={`/avatars/${bot.avatarId}.png`} 
                  alt={bot.name} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-2xl">🤖</span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{bot.name}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{bot.country}</span>
                {bot.factionId && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">
                    [{typeof bot.factionId === 'string' ? bot.factionId.slice(0, 6) : 'FACTION'}]
                  </span>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="p-3 bg-slate-800/40 border border-white/5 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {isSpanish ? 'Personalidad' : 'Personality'}
              </h3>
              <span className="text-xs font-medium text-cyan-400">{bot.personality}</span>
            </div>
            <p className="text-xs text-slate-300">
              {PERSONALITY_DESCRIPTIONS[bot.personality] ? 
                (PERSONALITY_DESCRIPTIONS[bot.personality][isSpanish ? 'es' : 'en']) : 
                (isSpanish ? 'Sin descripción disponible' : 'No description available')}
            </p>
          </div>
          
          <BotRelationship
            reputation={bot.playerReputation}
            repLabel={repInfo.label}
            repColor={repInfo.color}
            threatLevel={bot.memory.playerThreatLevel}
            relation={relation}
          />
          
          <div className="p-3 bg-slate-800/40 border border-white/5 rounded-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              {isSpanish ? 'Informe de Inteligencia' : 'Intelligence Report'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-800/50 rounded p-2">
                <span className="text-[10px] text-slate-500 block">
                  {isSpanish ? 'Puntuación Militar' : 'Army Score'}
                </span>
                <span className="text-sm font-bold text-white">{bot.armyScore.toLocaleString()}</span>
              </div>
              <div className="bg-slate-800/50 rounded p-2">
                <span className="text-[10px] text-slate-500 block">
                  {isSpanish ? 'Unidades Totales' : 'Total Units'}
                </span>
                <span className="text-sm font-bold text-white">{totalArmy.toLocaleString()}</span>
              </div>
              <div className="bg-slate-800/50 rounded p-2">
                <span className="text-[10px] text-slate-500 block">
                  {isSpanish ? 'Recursos' : 'Resources'}
                </span>
                <span className="text-sm font-bold text-white">{totalResources.toLocaleString()}</span>
              </div>
              <div className="bg-slate-800/50 rounded p-2">
                <span className="text-[10px] text-slate-500 block">
                  {isSpanish ? 'Ambición' : 'Ambition'}
                </span>
                <span className="text-sm font-bold text-white">{(bot.ambition * 100).toFixed(0)}%</span>
              </div>
              <div className="col-span-2 bg-slate-800/50 rounded p-2">
                <span className="text-[10px] text-slate-500 block">
                  {isSpanish ? 'Objetivo Actual' : 'Current Goal'}
                </span>
                <span className="text-sm font-bold text-cyan-400">{getGoalLabel(bot.currentGoal)}</span>
              </div>
            </div>
          </div>
          
          <BotHistory
            playerActions={bot.memory.playerActions}
            recentAttackers={bot.memory.recentAttackers}
            recentAllies={bot.memory.recentAllies}
            betrayals={bot.memory.betrayals}
          />
          
          <div className="p-3 bg-slate-800/40 border border-white/5 rounded-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              {isSpanish ? 'Acciones Diplomáticas' : 'Diplomatic Actions'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {availableActions.map(action => (
                <button
                  key={action}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                    ${action === DiplomaticAction.DECLARE_WAR || action === DiplomaticAction.BETRAY
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                      : action === DiplomaticAction.OFFER_TRIBUTE || action === DiplomaticAction.PROPOSE_ALLIANCE
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30'
                    }`}
                  onClick={() => onDiplomaticAction(action, bot.id)}
                >
                  {formatActionName(action, isSpanish)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function formatActionName(action: DiplomaticAction, isSpanish: boolean): string {
  const names: Partial<Record<DiplomaticAction, { es: string; en: string }>> = {
    [DiplomaticAction.PROPOSE_ALLIANCE]: { es: 'Proponer Alianza', en: 'Propose Alliance' },
    [DiplomaticAction.PROPOSE_NON_AGGRESSION]: { es: 'Propuesta No Agresión', en: 'Propose Non-Agression' },
    [DiplomaticAction.PROPOSE_TRADE_DEAL]: { es: 'Acuerdo Comercial', en: 'Trade Deal' },
    [DiplomaticAction.PROPOSE_JOINT_ATTACK]: { es: 'Ataque Conjunto', en: 'Joint Attack' },
    [DiplomaticAction.OFFER_TRIBUTE]: { es: 'Ofrecer Tributo', en: 'Offer Tribute' },
    [DiplomaticAction.REQUEST_AID]: { es: 'Solicitar Ayuda', en: 'Request Aid' },
    [DiplomaticAction.INVITE_TO_FACTION]: { es: 'Invitar a Facción', en: 'Invite to Faction' },
    [DiplomaticAction.DECLARE_WAR]: { es: 'Declarar Guerra', en: 'Declare War' },
    [DiplomaticAction.BREAK_ALLIANCE]: { es: 'Romper Alianza', en: 'Break Alliance' },
    [DiplomaticAction.BETRAY]: { es: 'Traicionar', en: 'Betray' },
    [DiplomaticAction.EMBARGO]: { es: 'Embargar', en: 'Embargo' },
    [DiplomaticAction.SURRENDER]: { es: 'Rendirse', en: 'Surrender' },
    [DiplomaticAction.DEMAND_TRIBUTE]: { es: 'Exigir Tributo', en: 'Demand Tribute' },
    [DiplomaticAction.THREATEN]: { es: 'Amenazar', en: 'Threaten' },
    [DiplomaticAction.OFFER_CEASEFIRE]: { es: 'Alto el Fuego', en: 'Offer Ceasefire' }
  };
  
  return names[action]?.[isSpanish ? 'es' : 'en'] || action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
