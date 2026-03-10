/**
 * ReputationBar Component
 * 
 * Displays a visual reputation bar with color coding and optional tooltip.
 * Reusable across DiplomacyView, RankingsView, and other components.
 */

import React from 'react';
import { SmartTooltip } from '../UIComponents';
import { getReputationColor, getReputationBgColor, getReputationCategory, ReputationCategory } from '../../utils/engine/reputation';
import { useLanguage } from '../../context/LanguageContext';

interface ReputationBarProps {
    reputation: number;
    showLabel?: boolean;
    showTooltip?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const ReputationBar: React.FC<ReputationBarProps> = ({
    reputation,
    showLabel = true,
    showTooltip = false,
    size = 'md',
    className = ''
}) => {
    const { t } = useLanguage();

    const clampedRep = Math.max(0, Math.min(100, reputation));
    const category = getReputationCategory(clampedRep);
    
    const sizeClasses = {
        sm: 'h-1.5 text-xs',
        md: 'h-2.5 text-sm',
        lg: 'h-4 text-base'
    };

    const labelSizeClasses = {
        sm: 'text-[9px]',
        md: 'text-[10px]',
        lg: 'text-xs'
    };

    const getLabel = (cat: ReputationCategory): string => {
        switch (cat) {
            case ReputationCategory.LOYAL_ALLY: return t.common.ui.reputation_loyal_ally || 'Aliado Leal';
            case ReputationCategory.FRIENDLY: return t.common.ui.reputation_friendly || 'Amistoso';
            case ReputationCategory.NEUTRAL: return t.common.ui.reputation_neutral || 'Neutral';
            case ReputationCategory.HOSTILE: return t.common.ui.reputation_hostile || 'Hostil';
            case ReputationCategory.MORTAL_ENEMY: return t.common.ui.reputation_mortal_enemy || 'Enemigo Mortal';
            default: return '';
        }
    };

    const barContent = (
        <div className={`flex items-center gap-2 ${className}`}>
            {/* Bar container */}
            <div className="flex-1 relative">
                {/* Background */}
                <div className={`w-full bg-gray-700 rounded-full overflow-hidden ${sizeClasses[size]}`}>
                    {/* Fill */}
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${getReputationBgColor(clampedRep)}`}
                        style={{ width: `${clampedRep}%` }}
                    />
                </div>
                
                {/* Tick marks */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                    {/* 25% mark */}
                    <div className="absolute left-1/4 top-0 h-full w-px bg-white/20" />
                    {/* 50% mark */}
                    <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
                    {/* 75% mark */}
                    <div className="absolute left-3/4 top-0 h-full w-px bg-white/20" />
                </div>
            </div>
            
            {/* Value label */}
            {showLabel && (
                <div className={`font-bold ${getReputationColor(clampedRep)} min-w-[36px] text-right`}>
                    <div className="text-lg leading-none">{clampedRep.toFixed(0)}</div>
                    <div className={`${labelSizeClasses[size]} text-gray-400 uppercase`}>
                        {getLabel(category)}
                    </div>
                </div>
            )}
        </div>
    );

    if (showTooltip) {
        return (
            <SmartTooltip
                content={
                    <div className="space-y-1.5 text-xs min-w-[180px]">
                        <div className="font-bold text-cyan-400 border-b border-slate-700 pb-1">
                            {t.common.ui.reputation || 'Reputación'}
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">{t.common.ui.current || 'Actual'}:</span>
                            <span className={`font-bold ${getReputationColor(clampedRep)}`}>{clampedRep}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">{t.common.ui.category || 'Categoría'}:</span>
                            <span className={`font-bold ${getReputationColor(clampedRep)}`}>{getLabel(category)}</span>
                        </div>
                        <div className="pt-1 border-t border-slate-700 text-slate-500 text-[10px]">
                            {clampedRep >= 75 
                                ? t.common.ui.tooltip_no_decay || 'No decae (≥75)'
                                : clampedRep >= 30
                                    ? t.common.ui.tooltip_normal_decay || 'Decaimiento normal'
                                    : t.common.ui.tooltip_accelerated_decay || 'Decaimiento acelerado'
                            }
                        </div>
                    </div>
                }
                triggerMode="hover"
                placement="top"
            >
                <div className="cursor-help">
                    {barContent}
                </div>
            </SmartTooltip>
        );
    }

    return barContent;
};

export default ReputationBar;
