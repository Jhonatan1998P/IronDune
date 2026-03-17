
/**
 * BotInteractionModal Component
 */

import React from 'react';
import { X, Minus, Gift, Handshake, Sword, Shield, Clock } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { StaticBot } from '../../utils/engine/rankings';
import { GameState, ReputationChangeType } from '../../types';

interface BotInteractionModalProps {
    bot: StaticBot;
    gameState: GameState;
    onClose: () => void;
}

// Simple local helper to avoid broken imports
const getReputationColor = (rep: number = 50) => {
    if (rep >= 75) return 'text-green-400';
    if (rep <= 30) return 'text-red-400';
    return 'text-yellow-400';
};

export const BotInteractionModal: React.FC<BotInteractionModalProps> = ({
    bot,
    gameState,
    onClose
}) => {
    const { t } = useLanguage();

    // Re-implementing simplified logic locally
    const reputationChanges = gameState.reputationHistory[bot.id] || [];
    const recentChanges = [...reputationChanges].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
    
    const interactions = gameState.interactionRecords[bot.id] || [];
    
    const summary = {
        trend: recentChanges.length === 0 ? 'STABLE' : (recentChanges[0].amount >= 0 ? 'IMPROVING' : 'WORSENING'),
        totalInteractions: interactions.length
    };

    const getChangeTypeIcon = (type: ReputationChangeType) => {
        switch (type) {
            case ReputationChangeType.GIFT:
                return <Gift className="w-3.5 h-3.5 text-blue-400" />;
            case ReputationChangeType.ALLIANCE:
            case ReputationChangeType.PEACE:
                return <Handshake className="w-3.5 h-3.5 text-green-400" />;
            case ReputationChangeType.ATTACK:
            case ReputationChangeType.WAR_LOSS:
                return <Sword className="w-3.5 h-3.5 text-red-400" />;
            case ReputationChangeType.DEFEND:
            case ReputationChangeType.ALLIANCE_DEFEND:
            case ReputationChangeType.WAR_WIN:
                return <Shield className="w-3.5 h-3.5 text-orange-400" />;
            case ReputationChangeType.DECAY:
                return <Clock className="w-3.5 h-3.5 text-gray-400" />;
            default:
                return <Minus className="w-3.5 h-3.5 text-gray-400" />;
        }
    };

    const getChangeTypeLabel = (type: ReputationChangeType): string => {
        switch (type) {
            case ReputationChangeType.GIFT: return t.common.ui.reputation_gifts_sent || 'Regalo';
            case ReputationChangeType.ALLIANCE: return t.common.ui.reputation_alliances_proposed || 'Alianza';
            case ReputationChangeType.PEACE: return t.common.ui.reputation_peace_proposed || 'Paz';
            case ReputationChangeType.ATTACK: return t.common.ui.reputation_attacks_won || 'Ataque';
            case ReputationChangeType.DEFEND: return t.common.ui.reputation_defends_won || 'Defensa';
            case ReputationChangeType.DECAY: return 'Decaimiento';
            default: return type;
        }
    };

    const formatTimeAgo = (timestamp: number): string => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        if (minutes < 60) return `hace ${minutes}m`;
        if (hours < 24) return `hace ${hours}h`;
        return `hace ${Math.floor(diff / 86400000)}d`;
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Shield className={`w-5 h-5 ${getReputationColor(bot.reputation ?? 50)}`} />
                        {t.common.ui.reputation_history || 'Historial de Reputación'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
                </div>

                <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                            <div className="text-xs text-gray-400 uppercase mb-1">{t.common.ui.reputation || 'Reputación'}</div>
                            <div className={`text-2xl font-black ${getReputationColor(bot.reputation ?? 50)}`}>{(bot.reputation ?? 50).toFixed(0)}%</div>
                        </div>
                        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                            <div className="text-xs text-gray-400 uppercase mb-1">{t.common.ui.reputation_trend || 'Tendencia'}</div>
                            <div className={`text-sm font-bold ${summary.trend === 'IMPROVING' ? 'text-green-400' : summary.trend === 'WORSENING' ? 'text-red-400' : 'text-gray-400'}`}>{summary.trend}</div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                        <div className="text-xs text-gray-400 uppercase mb-3 font-bold">{t.common.ui.reputation_total_interactions || 'Interacciones Totales'}: {summary.totalInteractions}</div>
                    </div>

                    {recentChanges.length > 0 && (
                        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                            <div className="text-xs text-gray-400 uppercase mb-3 font-bold">Cambios Recientes</div>
                            <div className="space-y-2">
                                {recentChanges.map((change, index) => (
                                    <div key={index} className="flex items-center justify-between text-xs py-1.5 px-2 bg-gray-900 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            {getChangeTypeIcon(change.type)}
                                            <span className="text-gray-300">{getChangeTypeLabel(change.type)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`font-bold ${change.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>{change.amount > 0 ? '+' : ''}{change.amount.toFixed(1)}</span>
                                            <span className="text-gray-500 text-[10px]">{formatTimeAgo(change.timestamp)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {recentChanges.length === 0 && <div className="text-center text-gray-500 text-sm py-4">No hay historial de interacciones registrado</div>}
                </div>
            </div>
        </div>
    );
};

export default BotInteractionModal;
