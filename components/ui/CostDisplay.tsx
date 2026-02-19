
import React from 'react';
import { formatNumber } from '../../utils';
import { ResourceType, TranslationDictionary } from '../../types';
import { Icons } from '../Icons';

export const CostDisplay: React.FC<{ cost: { money: number, oil: number, ammo: number, diamond?: number }, currentResources: Record<ResourceType, number>, t: TranslationDictionary }> = ({ cost, currentResources, t }) => {
    
    const renderCostItem = (res: ResourceType, value: number, Icon: React.FC<{ className?: string }>, colorClass: string) => {
        if (value <= 0) return null;
        const canAfford = currentResources[res] >= value;
        const textColor = canAfford ? colorClass : 'text-red-400';
        
        return (
            <div className={`flex items-center gap-1.5 ${textColor}`}>
                <Icon className={`w-3.5 h-3.5 ${canAfford ? colorClass : 'text-red-400'}`} />
                <span className="hidden md:inline text-[9px] font-bold opacity-70 tracking-wide uppercase">{t.common.resources[res]}</span>
                <span className="font-mono text-xs font-bold">{formatNumber(value)}</span>
            </div>
        );
    };

    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-center">
            {renderCostItem(ResourceType.MONEY, cost.money, Icons.Resources.Money, 'text-emerald-400')}
            {renderCostItem(ResourceType.OIL, cost.oil, Icons.Resources.Oil, 'text-purple-400')}
            {renderCostItem(ResourceType.AMMO, cost.ammo, Icons.Resources.Ammo, 'text-orange-400')}
            {renderCostItem(ResourceType.DIAMOND, cost.diamond || 0, Icons.Resources.Diamond, 'text-cyan-400')}
        </div>
    );
};
