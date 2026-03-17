
/**
 * ReputationIcon Component
 */

import React from 'react';
import { Heart, Handshake, Shield, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SmartTooltip } from '../UIComponents';
import { useLanguage } from '../../hooks/useLanguage';

enum ReputationCategory {
    LOYAL_ALLY = 'LOYAL_ALLY',
    FRIENDLY = 'FRIENDLY',
    NEUTRAL = 'NEUTRAL',
    HOSTILE = 'HOSTILE',
    MORTAL_ENEMY = 'MORTAL_ENEMY'
}

const getReputationColor = (rep: number) => {
    if (rep >= 75) return 'text-green-400';
    if (rep <= 30) return 'text-red-400';
    return 'text-yellow-400';
};

const getReputationCategory = (rep: number): ReputationCategory => {
    if (rep >= 85) return ReputationCategory.LOYAL_ALLY;
    if (rep >= 75) return ReputationCategory.FRIENDLY;
    if (rep > 50) return ReputationCategory.NEUTRAL;
    if (rep > 30) return ReputationCategory.HOSTILE;
    return ReputationCategory.MORTAL_ENEMY;
};

interface ReputationIconProps {
    reputation: number;
    size?: 'sm' | 'md' | 'lg';
    showTooltip?: boolean;
    tooltipContent?: React.ReactNode;
    showTrend?: boolean;
    trend?: 'UP' | 'DOWN' | 'STABLE';
    className?: string;
}

export const ReputationIcon: React.FC<ReputationIconProps> = ({
    reputation,
    size = 'md',
    showTooltip = false,
    tooltipContent,
    showTrend = false,
    trend = 'STABLE',
    className = ''
}) => {
    const { t } = useLanguage();

    const clampedRep = Math.max(0, Math.min(100, reputation));
    const category = getReputationCategory(clampedRep);

    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6'
    };

    const containerSizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12'
    };

    const getIcon = () => {
        switch (category) {
            case ReputationCategory.LOYAL_ALLY:
                return <Heart className={`${sizeClasses[size]} ${getReputationColor(clampedRep)}`} fill="currentColor" fillOpacity={0.2} />;
            case ReputationCategory.FRIENDLY:
                return <Handshake className={`${sizeClasses[size]} ${getReputationColor(clampedRep)}`} />;
            case ReputationCategory.NEUTRAL:
                return <Shield className={`${sizeClasses[size]} ${getReputationColor(clampedRep)}`} />;
            case ReputationCategory.HOSTILE:
                return <Target className={`${sizeClasses[size]} ${getReputationColor(clampedRep)}`} />;
            case ReputationCategory.MORTAL_ENEMY:
                return <Target className={`${sizeClasses[size]} ${getReputationColor(clampedRep)}`} fill="currentColor" fillOpacity={0.2} />;
            default:
                return <Shield className={`${sizeClasses[size]} ${getReputationColor(clampedRep)}`} />;
        }
    };

    const getTrendIcon = () => {
        if (!showTrend) return null;
        switch (trend) {
            case 'UP': return <TrendingUp className="w-3 h-3 text-green-400" />;
            case 'DOWN': return <TrendingDown className="w-3 h-3 text-red-400" />;
            case 'STABLE': return <Minus className="w-3 h-3 text-gray-400" />;
        }
    };

    const getDefaultTooltip = () => (
        <div className="space-y-1.5 text-xs min-w-[160px]">
            <div className="font-bold text-cyan-400 border-b border-slate-700 pb-1">{t.common.ui.reputation || 'Reputación'}</div>
            <div className="flex justify-between"><span className="text-slate-400">Valor:</span><span className={`font-bold ${getReputationColor(clampedRep)}`}>{clampedRep}%</span></div>
            <div className="flex justify-between">
                <span className="text-slate-400">Estado:</span>
                <span className={`font-bold ${getReputationColor(clampedRep)}`}>
                    {category === ReputationCategory.LOYAL_ALLY && 'Aliado Leal'}
                    {category === ReputationCategory.FRIENDLY && 'Amistoso'}
                    {category === ReputationCategory.NEUTRAL && 'Neutral'}
                    {category === ReputationCategory.HOSTILE && 'Hostil'}
                    {category === ReputationCategory.MORTAL_ENEMY && 'Enemigo Mortal'}
                </span>
            </div>
        </div>
    );

    const iconContent = (
        <div className={`relative inline-flex items-center justify-center ${containerSizeClasses[size]} rounded-full bg-gray-700/50 border border-gray-600 ${className}`}>
            {getIcon()}
            {showTrend && <div className="absolute -top-1 -right-1 bg-gray-800 rounded-full p-0.5 border border-gray-600">{getTrendIcon()}</div>}
        </div>
    );

    if (showTooltip) {
        return (
            <SmartTooltip content={tooltipContent || getDefaultTooltip()} triggerMode="hover" placement="top">
                <div className="cursor-help">{iconContent}</div>
            </SmartTooltip>
        );
    }

    return iconContent;
};

export default ReputationIcon;
