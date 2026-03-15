/**
 * BottomSheet Component
 * 
 * Mobile-optimized bottom sheet modal for displaying bot details.
 * Slides up from bottom with smooth animation.
 */

import React, { useEffect, useCallback } from 'react';
import { X, Gift, Handshake, Heart, Target, Zap, History } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { RankingCategory } from '../../types';
import { StaticBot, getFlagEmoji } from '../../utils/engine/rankings';
import { formatNumber } from '../../utils';
import { ReputationBar } from '../reputation';

interface BottomSheetProps {
    bot: StaticBot | null;
    isOpen: boolean;
    onClose: () => void;
    onGift?: () => void;
    onAlliance?: () => void;
    onPeace?: () => void;
    onHistory?: () => void;
    canGift?: boolean;
    canAlliance?: boolean;
    canPeace?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
    bot,
    isOpen,
    onClose,
    onGift,
    onAlliance,
    onPeace,
    onHistory,
    canGift = true,
    canAlliance = true,
    canPeace = true
}) => {
    const { t } = useLanguage();

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    if (!bot || !isOpen) return null;

    const getPersonalityLabel = (personality: string): string => {
        const labels: Record<string, string> = {
            WARLORD: t.common.ui.personality_warlord || 'Señor de la Guerra',
            TURTLE: t.common.ui.personality_turtle || 'La Tortuga',
            TYCOON: t.common.ui.personality_tycoon || 'Magnate',
            ROGUE: t.common.ui.personality_rogue || 'Oportunista'
        };
        return labels[personality] || personality;
    };

    const getEventLabel = (event: string): string => {
        const labels: Record<string, string> = {
            ATTACKED: t.common.ui.bot_event_attacked || 'Bajo Ataque',
            SUCCESSFUL_RAID: t.common.ui.bot_event_successful_raid || 'Saqueo Exitoso',
            ECONOMIC_BOOM: t.common.ui.bot_event_economic_boom || 'Auge Económico',
            RESOURCES_CRISIS: t.common.ui.bot_event_resources_crisis || 'Crisis de Recursos',
            MILITARY_BUILDUP: t.common.ui.bot_event_military_buildup || 'Rearmamento',
            PEACEFUL_PERIOD: t.common.ui.bot_event_peaceful_period || 'Período Pacífico'
        };
        return labels[event] || event;
    };

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={handleBackdropClick}
        >
            <div
                className={`
                    bg-gray-900 border-t border-gray-700 rounded-t-2xl w-full max-w-lg
                    transform transition-transform duration-300 ease-out
                    ${isOpen ? 'translate-y-0' : 'translate-y-full'}
                    max-h-[85vh] overflow-hidden flex flex-col
                `}
            >
                {/* Handle bar */}
                <div className="flex items-center justify-center pt-3 pb-2">
                    <div className="w-12 h-1.5 bg-gray-700 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-800 rounded-full overflow-hidden border-2 border-gray-700">
                            <img
                                src={`/assets/avatars/bot_${bot.avatarId}.png`}
                                alt={bot.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as any).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${bot.id}`;
                                }}
                            />
                        </div>
                        <div>
                            <h3 className="font-bold text-white flex items-center gap-1.5">
                                <span className="text-lg">{getFlagEmoji(bot.country)}</span>
                                {bot.name}
                            </h3>
                            <p className="text-xs text-gray-400 uppercase">{getPersonalityLabel(bot.personality)}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {/* Reputation Bar */}
                    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                        <ReputationBar
                            reputation={bot.reputation ?? 50}
                            size="lg"
                            showTooltip
                        />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                                <Target className="w-3.5 h-3.5 text-orange-400" />
                                {t.common.ui.est_power || 'Poder'}
                            </div>
                            <div className="font-mono font-bold text-white">
                                {formatNumber(bot.stats[RankingCategory.DOMINION])}
                            </div>
                        </div>
                        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                                {t.common.ui.bot_event || 'Evento'}
                            </div>
                            <div className="text-xs text-white font-medium">
                                {getEventLabel(bot.currentEvent)}
                            </div>
                        </div>
                    </div>

                    {/* Quick Info */}
                    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-400">País:</span>
                            <span className="text-white font-medium">{bot.country}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Ambición:</span>
                            <span className="text-white font-medium">{bot.ambition.toFixed(1)}x</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Modo Crecimiento:</span>
                            <span className="text-white font-medium">{(bot.growthModifier * 100).toFixed(0)}%</span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="p-4 border-t border-gray-800 bg-gray-900 safe-area-bottom">
                    <div className="grid grid-cols-4 gap-2">
                        <button
                            onClick={() => { onHistory?.(); onClose(); }}
                            className="flex flex-col items-center justify-center gap-1 p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors border border-gray-700"
                        >
                            <History className="w-5 h-5 text-cyan-400" />
                            <span className="text-[10px] text-gray-300 font-medium">Historial</span>
                        </button>
                        <button
                            onClick={() => { onGift?.(); onClose(); }}
                            disabled={!canGift}
                            className="flex flex-col items-center justify-center gap-1 p-2 bg-blue-600/20 hover:bg-blue-600/30 disabled:bg-gray-800 disabled:opacity-50 rounded-xl transition-colors border border-blue-600/40"
                        >
                            <Gift className="w-5 h-5 text-blue-400" />
                            <span className="text-[10px] text-gray-300 font-medium">Regalo</span>
                        </button>
                        <button
                            onClick={() => { onAlliance?.(); onClose(); }}
                            disabled={!canAlliance}
                            className="flex flex-col items-center justify-center gap-1 p-2 bg-green-600/20 hover:bg-green-600/30 disabled:bg-gray-800 disabled:opacity-50 rounded-xl transition-colors border border-green-600/40"
                        >
                            <Handshake className="w-5 h-5 text-green-400" />
                            <span className="text-[10px] text-gray-300 font-medium">Alianza</span>
                        </button>
                        <button
                            onClick={() => { onPeace?.(); onClose(); }}
                            disabled={!canPeace}
                            className="flex flex-col items-center justify-center gap-1 p-2 bg-purple-600/20 hover:bg-purple-600/30 disabled:bg-gray-800 disabled:opacity-50 rounded-xl transition-colors border border-purple-600/40"
                        >
                            <Heart className="w-5 h-5 text-purple-400" />
                            <span className="text-[10px] text-gray-300 font-medium">Paz</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BottomSheet;
