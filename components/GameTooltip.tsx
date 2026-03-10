import React from 'react';
import { formatNumber } from '../utils';
import { useLanguage } from '../context/LanguageContext';
import { UNIT_DEFS } from '../data/units';
import { UnitType, ResourceType } from '../types';

interface GameTooltipProps {
    title: string;
    description?: string;
    cost?: Partial<Record<string, number>>;
    resources?: Record<string, number>;
    production?: Partial<Record<string, number>>;
    stats?: Array<{ label: string; value: string | number; color?: string }>;
    requirements?: Array<{ label: string; met: boolean }>;
    rapidFire?: Record<string, number>;
    footer?: string;
    resourceType?: string;
}

const getResourceName = (key: string, t: any): string => {
    if (t.common.resources[key]) return t.common.resources[key];
    if (t.common.resources[key.toUpperCase()]) return t.common.resources[key.toUpperCase()];
    if (t.common.resources[key.toLowerCase()]) return t.common.resources[key.toLowerCase()];
    return key;
};

const getResourceValue = (resources: Record<string, number> | undefined, key: string): number => {
    if (!resources) return 0;
    if (resources[key] !== undefined) return resources[key];
    if (resources[key.toUpperCase()] !== undefined) return resources[key.toUpperCase()];
    if (resources[key.toLowerCase()] !== undefined) return resources[key.toLowerCase()];
    return 0;
};

export const GameTooltip: React.FC<GameTooltipProps> = ({
    title, description, cost, resources, production, stats, requirements, rapidFire, footer, resourceType
}) => {
    const { t, language } = useLanguage();

    return (
        <div className="flex flex-col gap-2.5 min-w-[200px] xs:min-w-[220px]">
            {/* Header - Título y descripción */}
            <div className="border-b border-white/10 pb-2 relative">
                <h4 className="font-tech text-sm sm:text-base font-bold text-cyan-300 uppercase tracking-widest drop-shadow-sm truncate pr-2">
                    {title}
                </h4>
                {description && (
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1 leading-snug line-clamp-3">
                        {description}
                    </p>
                )}
            </div>

            {/* Stats Grid */}
            {stats && stats.length > 0 && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 bg-black/30 p-2 rounded-lg border border-white/5">
                    {stats.map((s, i) => (
                        <div key={i} className="flex flex-col min-w-0">
                            <span className="text-slate-500 uppercase text-[9px] font-bold tracking-wider truncate">{s.label}</span>
                            <span className={`font-mono text-[10px] sm:text-xs font-bold ${s.color || 'text-slate-200'} mt-0.5 truncate`}>{s.value}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Production */}
            {production && Object.keys(production).length > 0 && (
                 <div className="bg-emerald-950/10 p-2 rounded border border-emerald-500/10">
                    <span className="text-[9px] text-emerald-500/70 uppercase tracking-widest block mb-1.5 font-bold">
                        {t.common.ui.output_label}
                    </span>
                    {Object.entries(production).map(([res, val]) => {
                        const isDiamond = res === ResourceType.DIAMOND || resourceType === 'DIAMOND';
                        return (
                        <div key={res} className="flex justify-between items-center text-emerald-300 font-mono text-[10px] sm:text-xs">
                            <span className="uppercase opacity-80 truncate">{getResourceName(res, t)}</span>
                            <span className="font-bold shrink-0">+ {formatNumber((val as number) * (isDiamond ? 3600 : 600))}<span className="text-[9px] opacity-50 ml-0.5">{isDiamond ? '/h' : '/10m'}</span></span>
                        </div>
                        );
                    })}
                 </div>
            )}

            {/* Rapid Fire */}
            {rapidFire && Object.keys(rapidFire).length > 0 && (
                <div className="space-y-1.5">
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1">
                        <span className="text-orange-400">⚡</span> Rapid Fire
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {Object.entries(rapidFire).map(([target, chance]) => {
                            const probability = chance as number;
                            if (probability <= 0) return null;

                            const unitDef = UNIT_DEFS[target as UnitType];
                            const unitName = unitDef && t.units[unitDef.translationKey]
                                ? t.units[unitDef.translationKey].name
                                : target.replace(/_/g, ' ');

                            return (
                                <span key={target} className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300 border border-orange-500/20 flex items-center gap-1 shrink-0">
                                    <span className="opacity-50 shrink-0">vs</span>
                                    <span className="font-bold truncate max-w-[80px] sm:max-w-[100px]">{unitName}</span>
                                    <span className="text-white font-mono shrink-0">{Math.round(probability * 100)}%</span>
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Requirements */}
            {requirements && requirements.length > 0 && (
                <div className="space-y-1 bg-slate-800/50 p-2 rounded border border-white/5">
                     <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">{t.common.ui.prereq_label}</div>
                     {requirements.map((req, i) => (
                         <div key={i} className={`flex justify-between text-[10px] sm:text-xs items-center ${req.met ? 'text-slate-400' : 'text-red-400 font-bold'}`}>
                             <span className="truncate flex-1">{req.label}</span>
                             <span className={`text-[9px] sm:text-[10px] px-1.5 rounded shrink-0 ${req.met ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                 {req.met ? t.common.ui.req_met : t.common.ui.req_missing}
                             </span>
                         </div>
                     ))}
                </div>
            )}

            {/* Cost */}
            {cost && resources && (
                <div className="pt-2 border-t border-white/10">
                    <div className="flex justify-between items-end mb-1.5">
                         <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">{t.common.ui.cost_label}</div>
                         <div className="text-[9px] text-slate-600 uppercase tracking-widest">{t.common.ui.available_label}</div>
                    </div>

                    <div className="space-y-1">
                        {Object.entries(cost).map(([type, val]) => {
                            const amount = val as number;
                            if (amount === 0) return null;

                            const current = getResourceValue(resources, type);
                            const affordable = current >= amount;
                            const resourceName = getResourceName(type, t);

                            return (
                                <div key={type} className="flex justify-between items-center text-[10px] sm:text-xs font-mono bg-black/20 rounded px-1.5 sm:px-2 py-1">
                                    <span className={`uppercase font-bold truncate max-w-[80px] sm:max-w-[100px] ${affordable ? 'text-slate-400' : 'text-red-300'}`}>
                                        {resourceName}
                                    </span>
                                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                        <span className={`font-bold ${affordable ? 'text-white' : 'text-red-400'}`}>
                                            {formatNumber(amount)}
                                        </span>
                                        <div className={`h-2.5 sm:h-3 w-[1px] ${affordable ? 'bg-slate-700' : 'bg-red-900'}`}></div>
                                        <span className={`${affordable ? 'text-emerald-500' : 'text-red-500'} opacity-80`}>
                                            {formatNumber(current)}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Footer */}
            {footer && (
                <div className="text-[9px] sm:text-[10px] text-red-400 font-mono text-center bg-red-950/30 p-1 rounded border border-red-500/20 mt-1">
                    ⚠ {footer}
                </div>
            )}
        </div>
    );
};
