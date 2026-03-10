/**
 * BotInteractionModal Component
 * 
 * Shows detailed interaction history and reputation changes for a specific bot.
 */

import React from 'react';
import { X, TrendingUp, TrendingDown, Minus, Gift, Handshake, Sword, Shield, Clock } from 'lucide-react';
import { useLanguage } from '../context/useLanguageHook';
import { StaticBot } from '../../utils/engine/rankings';
import { getInteractionRecord, getRelationshipSummary, exportInteractionData } from '../../utils/engine/reputationHistory';
import { GameState } from '../../types';
import { ReputationChangeType, getReputationColor } from '../../utils/engine/reputation';

interface BotInteractionModalProps {
    bot: StaticBot;
    gameState: GameState;
    onClose: () => void;
}

export const BotInteractionModal: React.FC<BotInteractionModalProps> = ({
    bot,
    gameState,
    onClose
}) => {
    const { t } = useLanguage();

    const summary = getRelationshipSummary(gameState, bot.id);
    const data = exportInteractionData(gameState, bot.id, bot);

    const getChangeTypeIcon = (type: ReputationChangeType) => {
        switch (type) {
            case ReputationChangeType.GIFT:
                return <Gift className="w-3.5 h-3.5 text-blue-400" />;
            case ReputationChangeType.ALLIANCE:
            case ReputationChangeType.PEACE:
                return <Handshake className="w-3.5 h-3.5 text-green-400" />;
            case ReputationChangeType.ATTACK_WIN:
            case ReputationChangeType.DEFEND_LOSS:
                return <Sword className="w-3.5 h-3.5 text-red-400" />;
            case ReputationChangeType.ATTACK_LOSS:
            case ReputationChangeType.DEFEND_WIN:
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
            case ReputationChangeType.ATTACK_WIN: return t.common.ui.reputation_attacks_won || 'Ataque Ganado';
            case ReputationChangeType.ATTACK_LOSS: return t.common.ui.reputation_attacks_lost || 'Ataque Perdido';
            case ReputationChangeType.DEFEND_WIN: return t.common.ui.reputation_defends_won || 'Defensa Exitosa';
            case ReputationChangeType.DEFEND_LOSS: return t.common.ui.reputation_defends_lost || 'Defensa Fallida';
            case ReputationChangeType.DECAY: return 'Decaimiento';
            default: return type;
        }
    };

    const getTrendIcon = () => {
        switch (summary.trend) {
            case 'IMPROVING':
                return <TrendingUp className="w-5 h-5 text-green-400" />;
            case 'WORSENING':
                return <TrendingDown className="w-5 h-5 text-red-400" />;
            case 'STABLE':
                return <Minus className="w-5 h-5 text-gray-400" />;
        }
    };

    const getTrendLabel = () => {
        switch (summary.trend) {
            case 'IMPROVING': return t.common.ui.reputation_improving || 'Mejorando';
            case 'WORSENING': return t.common.ui.reputation_worsening || 'Empeorando';
            case 'STABLE': return t.common.ui.reputation_stable || 'Estable';
        }
    };

    const formatTimeAgo = (timestamp: number): string => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 60) return `hace ${minutes}m`;
        if (hours < 24) return `hace ${hours}h`;
        return `hace ${days}d`;
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Shield className={`w-5 h-5 ${getReputationColor(bot.reputation ?? 50)}`} />
                        {t.common.ui.reputation_history || 'Historial de Reputación'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                            <div className="text-xs text-gray-400 uppercase mb-1">
                                {t.common.ui.reputation || 'Reputación'}
                            </div>
                            <div className={`text-2xl font-black ${getReputationColor(bot.reputation ?? 50)}`}>
                                {(bot.reputation ?? 50).toFixed(0)}%
                            </div>
                        </div>
                        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                            <div className="text-xs text-gray-400 uppercase mb-1 flex items-center gap-1">
                                {getTrendIcon()}
                                {t.common.ui.reputation_trend || 'Tendencia'}
                            </div>
                            <div className={`text-sm font-bold ${
                                summary.trend === 'IMPROVING' ? 'text-green-400' :
                                summary.trend === 'WORSENING' ? 'text-red-400' :
                                'text-gray-400'
                            }`}>
                                {getTrendLabel()}
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                        <div className="text-xs text-gray-400 uppercase mb-3 font-bold">
                            {t.common.ui.reputation_total_interactions || 'Interacciones Totales'}: {data.totalInteractions}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-gray-400">{t.common.ui.reputation_gifts_sent || 'Regalos'}:</span>
                                <span className="text-blue-400 font-bold">{data.giftsSent}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">{t.common.ui.reputation_alliances_proposed || 'Alianzas'}:</span>
                                <span className="text-green-400 font-bold">{data.alliancesProposed}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">{t.common.ui.reputation_attacks_won || 'Ataques Ganados'}:</span>
                                <span className="text-orange-400 font-bold">{data.attacksWon}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">{t.common.ui.reputation_attacks_lost || 'Ataques Perdidos'}:</span>
                                <span className="text-red-400 font-bold">{data.attacksLost}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">{t.common.ui.reputation_defends_won || 'Defensas Exitosas'}:</span>
                                <span className="text-emerald-400 font-bold">{data.defendsWon}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">{t.common.ui.reputation_defends_lost || 'Defensas Fallidas'}:</span>
                                <span className="text-rose-400 font-bold">{data.defendsLost}</span>
                            </div>
                        </div>
                    </div>

                    {/* Recent Changes */}
                    {data.recentChanges.length > 0 && (
                        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                            <div className="text-xs text-gray-400 uppercase mb-3 font-bold">
                                Cambios Recientes
                            </div>
                            <div className="space-y-2">
                                {data.recentChanges.map((change, index) => (
                                    <div 
                                        key={index}
                                        className="flex items-center justify-between text-xs py-1.5 px-2 bg-gray-900 rounded-lg"
                                    >
                                        <div className="flex items-center gap-2">
                                            {getChangeTypeIcon(change.type)}
                                            <span className="text-gray-300">
                                                {getChangeTypeLabel(change.type)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`font-bold ${change.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {change.amount > 0 ? '+' : ''}{change.amount}
                                            </span>
                                            <span className="text-gray-500 text-[10px]">
                                                {formatTimeAgo(change.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {data.recentChanges.length === 0 && (
                        <div className="text-center text-gray-500 text-sm py-4">
                            No hay historial de interacciones registrado
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BotInteractionModal;
