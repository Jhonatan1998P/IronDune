
import React from 'react';
import { formatNumber } from '../../utils';
import { ResourceType, TranslationDictionary } from '../../types';
import { ResourceIcon } from './ResourceIcon';

export const CostDisplay: React.FC<{ cost: { money: number, oil: number, ammo: number, gold?: number, diamond?: number }, currentResources: Record<ResourceType, number>, t: TranslationDictionary }> = ({ cost, currentResources, t }) => {
    
    const renderCostItem = (res: ResourceType, value: number, colorClass: string) => {
        if (!value || value <= 0 || isNaN(value)) return null;
        const canAfford = currentResources[res] >= value;
        const textColor = canAfford ? colorClass : 'text-red-400';
        
        return (
            <div className={`flex items-center gap-1.5 ${textColor}`}>
                <ResourceIcon resource={res} className="w-3.5 h-3.5" alt={res} />
                <span className="hidden md:inline text-[9px] font-bold opacity-70 tracking-wide uppercase">{t.common.resources[res]}</span>
                <span className="font-mono text-xs font-bold">{formatNumber(value)}</span>
            </div>
        );
    };

    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-center">
            {renderCostItem(ResourceType.MONEY, cost.money, 'text-emerald-400')}
            {renderCostItem(ResourceType.OIL, cost.oil, 'text-purple-400')}
            {renderCostItem(ResourceType.AMMO, cost.ammo, 'text-orange-400')}
            {renderCostItem(ResourceType.GOLD, cost.gold || 0, 'text-yellow-400')}
            {renderCostItem(ResourceType.DIAMOND, cost.diamond || 0, 'text-cyan-400')}
        </div>
    );
};
