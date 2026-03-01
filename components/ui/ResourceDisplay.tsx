
import React from 'react';
import { formatNumber } from '../../utils';
import { useLanguage } from '../../context/LanguageContext';
import { SmartTooltip } from './SmartTooltip';

export const ResourceDisplay: React.FC<{ label: string; value: number; max: number; color: string; production?: number; upkeep?: number; icon?: React.ReactNode; resourceType?: string }> = ({ label, value, max, color, production = 0, upkeep = 0, icon, resourceType }) => {
  const { t } = useLanguage();
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const net = production - upkeep;
  const fmt = (n: number) => formatNumber(Math.round(n));
  const isDiamond = resourceType === 'DIAMOND' || resourceType === 'diamond';
  const suffix = isDiamond ? '/h' : '/10m';

  return (
    <SmartTooltip 
        triggerMode="hover"
        placement="bottom"
        content={
        <div className="space-y-2 min-w-[180px]">
            <div className={`font-bold ${color} uppercase tracking-widest text-[10px] border-b border-white/10 pb-1`}>{label} {t.common.ui.status}</div>
            <div className="font-mono text-[10px] space-y-1">
                <div className="flex justify-between"><span className="text-slate-400">{t.common.ui.inventory}:</span><span className="text-white">{formatNumber(value)} / {formatNumber(max)}</span></div>
                <div className="flex justify-between text-emerald-400"><span>{t.common.ui.income}:</span><span>+{fmt(production)}{suffix}</span></div>
                <div className="flex justify-between text-red-400"><span>{t.common.stats.upkeep}:</span><span>-{fmt(upkeep)}{suffix}</span></div>
                <div className="border-t border-white/5 mt-1 pt-1 flex justify-between font-bold">
                    <span className="text-slate-500">{t.common.ui.net_flow}:</span>
                    <span className={net >= 0 ? "text-emerald-400" : "text-red-500"}>{net > 0 ? '+' : ''}{fmt(net)}{suffix}</span>
                </div>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                <div className={`h-full ${color.replace('text-', 'bg-')}`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    }>
      <div className={`flex flex-col items-center justify-center bg-black/40 px-2 md:px-3 py-1.5 rounded min-w-[60px] lg:min-w-0 lg:w-full border border-white/5 hover:bg-white/5 transition-all relative overflow-hidden h-[44px] lg:h-[50px] group shrink-0`}>
        <div className={`absolute bottom-0 left-0 h-0.5 transition-all duration-700 ${color.replace('text-', 'bg-')} opacity-40 group-hover:opacity-80`} style={{ width: `${percent}%` }}></div>
        
        {/* Mobile / Compact View */}
        <div className="lg:hidden flex flex-row items-center justify-center gap-1 w-full h-full">
            <div>
                {icon}
            </div>
            <span className={`text-[10px] font-mono font-bold text-white leading-none`}>{formatNumber(value)}</span>
        </div>

        {/* Desktop / Command View (Expanded Row) */}
        <div className="hidden lg:flex w-full justify-between items-center gap-2 xl:gap-4 px-1">
            <div className="flex flex-col items-start min-w-0">
                <div className="flex items-center gap-2">
                    {icon && <span>{icon}</span>}
                    <span className={`text-[10px] font-bold tracking-widest opacity-80 ${color} uppercase truncate`}>{label}</span>
                </div>
                <span className={`text-sm font-mono font-bold text-white leading-none mt-0.5 truncate`}>{formatNumber(value)}</span>
            </div>
            
             <div className="flex flex-col items-end shrink-0">
                 <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">{t.common.ui.rate}</span>
<span className={`text-[10px] font-mono font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                     {net > 0 ? '+' : ''}{fmt(net)}{suffix}
                  </span>
            </div>
        </div>

      </div>
    </SmartTooltip>
  );
};
