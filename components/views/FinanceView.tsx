
import React, { useState, useMemo } from 'react';
import { BuildingType, GameState, ResourceType, TechType, UnitType } from '../../types';
import { BUILDING_DEFS } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
import { useLanguage } from '../../context/LanguageContext';
import { Card, GlassButton, Icons } from '../UIComponents';
import { formatNumber } from '../../utils';
import { calculateMaxBankCapacity } from '../../utils/engine/modifiers';

export const FinanceView: React.FC<{ gameState: GameState; onBankAction: (amount: number, type: 'deposit' | 'withdraw') => void }> = ({ gameState, onBankAction }) => {
    const { t } = useLanguage();
    const [amount, setAmount] = useState<number>(0);
    
    const bank = gameState.buildings[BuildingType.BANK];
    const hasBank = bank.level > 0;

    // Calcular capacidad dinámica usando la fórmula específica de puntos de imperio
    const maxBankBalance = useMemo(() => {
        return calculateMaxBankCapacity(gameState.empirePoints, bank.level);
    }, [gameState.empirePoints, bank.level]);

    // --- CÁLCULO DE FINANZAS DETALLADAS ---
    const financialReport = useMemo(() => {
        const report = {
            income: [] as { source: string; amount: number; count?: number }[],
            expenses: [] as { source: string; amount: number; count?: number }[],
            totalIncome: 0,
            totalExpenses: 0,
        };

        // 1. Calcular Ingresos por Edificios
        let moneyProdMult = 1.0;
        if (gameState.researchedTechs.includes(TechType.EFFICIENT_WORKFLOWS)) moneyProdMult += 0.1;

        (Object.keys(gameState.buildings) as BuildingType[]).forEach((bType) => {
            const qty = gameState.buildings[bType].level;
            if (qty > 0) {
                const def = BUILDING_DEFS[bType];
                const ratePerSec = def.productionRate?.[ResourceType.MONEY];
                
                if (ratePerSec && ratePerSec > 0) {
                    // Convertir tasa por segundo a tasa por hora (x3600)
                    const hourlyBase = ratePerSec * 3600;
                    const totalHourly = hourlyBase * qty * moneyProdMult;
                    
                    report.income.push({
                        source: t.buildings[def.translationKey]?.name || def.id,
                        amount: totalHourly,
                        count: qty
                    });
                    report.totalIncome += totalHourly;
                }
            }
        });

        // 2. Calcular Interés Bancario (Ingreso Pasivo)
        if (gameState.bankBalance > 0 && hasBank) {
            // Tasa actual es por 6 horas. 
            // Interés por hora = (Balance * Tasa) / 6
            const hourlyInterest = (gameState.bankBalance * gameState.currentInterestRate) / 6;
            if (hourlyInterest > 0) {
                report.income.push({
                    source: `${t.common.ui.bank_yield} (${(gameState.currentInterestRate * 100).toFixed(2)}%)`,
                    amount: hourlyInterest
                });
                report.totalIncome += hourlyInterest;
            }
        }

        // 3. Calcular Gastos por Mantenimiento de Unidades
        (Object.keys(gameState.units) as UnitType[]).forEach((uType) => {
            const qty = gameState.units[uType];
            if (qty > 0) {
                const def = UNIT_DEFS[uType];
                const upkeepPerSec = def.upkeep?.[ResourceType.MONEY];

                if (upkeepPerSec && upkeepPerSec > 0) {
                    const totalHourly = upkeepPerSec * 3600 * qty;
                    
                    report.expenses.push({
                        source: t.units[def.translationKey]?.name || def.id,
                        amount: totalHourly,
                        count: qty
                    });
                    report.totalExpenses += totalHourly;
                }
            }
        });

        // Ordenar de mayor a menor impacto
        report.income.sort((a, b) => b.amount - a.amount);
        report.expenses.sort((a, b) => b.amount - a.amount);

        return report;
    }, [gameState, t, hasBank]);

    const netFlow = financialReport.totalIncome - financialReport.totalExpenses;

    return (
        <div className="space-y-4 md:space-y-6 animate-[fadeIn_0.3s_ease-out] min-h-full w-full">
            {/* --- SECCIÓN 1: CONTROL BANCARIO (Compacto) --- */}
            <Card title={t.common.ui.bank_balance} className={!hasBank ? "opacity-75" : ""}>
                {!hasBank ? (
                    <div className="p-8 text-center text-slate-500 font-mono text-sm">
                        <div className="mb-2"><Icons.Lock /></div>
                        {t.errors.req_building} ({t.buildings.bank.name})
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Estado y Tasa */}
                        <div className="flex flex-col md:flex-row gap-4">
                             <div className="bg-black/20 p-3 rounded-lg border border-white/5 flex-1 relative overflow-hidden">
                                 <div className="relative z-10">
                                     <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.common.ui.bank_balance}</div>
                                     <div className="flex items-baseline gap-2">
                                         <div className={`text-2xl md:text-3xl font-mono ${gameState.bankBalance > maxBankBalance ? 'text-orange-400' : 'text-emerald-400'} shadow-green-500/20 drop-shadow-sm`}>
                                             ${formatNumber(gameState.bankBalance)}
                                         </div>
                                         <div className="text-[10px] font-mono text-slate-600">
                                             / ${formatNumber(maxBankBalance)}
                                         </div>
                                     </div>
                                 </div>
                                 {/* Barra de fondo sutil */}
                                 <div className={`absolute bottom-0 left-0 h-1 ${gameState.bankBalance > maxBankBalance ? 'bg-orange-600/50' : 'bg-emerald-600/50'} transition-all duration-500`} style={{ width: `${Math.min(100, (gameState.bankBalance / maxBankBalance) * 100)}%` }}></div>
                             </div>

                             <div className="bg-black/20 p-3 rounded-lg border border-white/5 flex-1 flex flex-col justify-center">
                                 <div className="flex justify-between items-end">
                                     <div>
                                         <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.common.ui.current_rate}</div>
                                         <div className="text-xl font-mono text-cyan-400">
                                             {(gameState.currentInterestRate * 100).toFixed(2)}%
                                         </div>
                                     </div>
                                     <div className="text-[10px] text-slate-600 font-mono text-right">
                                         {t.common.ui.next_rate_update}<br/>
                                         {Math.max(0, Math.ceil((gameState.nextRateChangeTime - Date.now()) / 60000))}m
                                     </div>
                                 </div>
                             </div>
                        </div>
                        
                        {/* Controles de Depósito */}
                        <div className="p-3 bg-slate-900/50 rounded border border-white/5">
                             <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
                                 {[1000, 10000, 100000, 1000000, 5000000].map(val => (
                                     <button 
                                       key={val} 
                                       onClick={() => setAmount(val)}
                                       className={`px-3 py-1 rounded border text-[10px] font-mono transition-colors whitespace-nowrap ${amount === val ? 'bg-white/10 border-white text-white' : 'border-white/10 text-slate-500 hover:text-slate-300'}`}
                                     >
                                         {formatNumber(val)}
                                     </button>
                                 ))}
                             </div>
                             <div className="flex gap-3">
                                 <input 
                                     type="number" 
                                     value={amount}
                                     onChange={(e) => setAmount(Number(e.target.value))}
                                     className="w-1/3 bg-black/40 border border-white/10 rounded px-2 py-2 font-mono text-xs text-right focus:border-cyan-500/50 outline-none transition-colors"
                                      placeholder={t.common.ui.amount}
                                 />
                                 <GlassButton 
                                     onClick={() => onBankAction(amount, 'deposit')} 
                                     variant="primary"
                                     disabled={gameState.bankBalance >= maxBankBalance}
                                     className="flex-1 py-1 text-xs"
                                 >
                                     {gameState.bankBalance >= maxBankBalance ? 'FULL' : t.common.actions.deposit}
                                 </GlassButton>
                                 <GlassButton onClick={() => onBankAction(amount, 'withdraw')} variant="neutral" className="flex-1 py-1 text-xs">
                                     {t.common.actions.withdraw}
                                 </GlassButton>
                             </div>
                        </div>
                    </div>
                )}
            </Card>

            {/* --- SECCIÓN 2: INFORME FINANCIERO DETALLADO --- */}
            {hasBank && (
                <div className="glass-panel rounded-xl overflow-hidden border border-white/10">
                    <div className="p-3 bg-black/40 border-b border-white/5 flex justify-between items-center">
                        <h3 className="font-tech text-sm uppercase tracking-widest text-slate-300">{t.common.ui.financial_report}</h3>
                        <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-1 rounded">{t.common.ui.hourly_projection}</span>
                    </div>

                    {/* Resumen Principal */}
                    <div className="p-4 text-center bg-gradient-to-b from-white/5 to-transparent">
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.common.ui.net_flow} (Hr)</div>
                        <div className={`text-4xl font-mono font-bold ${netFlow >= 0 ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]' : 'text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.3)]'}`}>
                            {netFlow >= 0 ? '+' : ''}{formatNumber(Math.round(netFlow))}
                        </div>
                        <div className="flex justify-center gap-6 mt-2 text-xs font-mono">
                             <span className="text-emerald-500/80">{t.common.ui.income}: +{formatNumber(Math.round(financialReport.totalIncome))}</span>
                             <span className="text-red-500/80">{t.common.ui.expenses}: -{formatNumber(Math.round(financialReport.totalExpenses))}</span>
                        </div>
                    </div>

                    {/* Desglose en Columnas */}
                    <div className="flex flex-col md:flex-row border-t border-white/5">
                        
                        {/* Columna Ingresos */}
                        <div className="flex-1 border-b md:border-b-0 md:border-r border-white/5">
                            <div className="p-2 bg-emerald-950/20 text-emerald-400 text-xs font-bold uppercase tracking-widest border-b border-white/5 flex items-center gap-2">
                                <Icons.ArrowUp className="w-3 h-3" />
                                {t.common.ui.income}
                            </div>
                            <div className="p-2 space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                                {financialReport.income.length === 0 && (
                                    <div className="text-center text-[10px] text-slate-600 py-4 italic">{t.common.ui.no_income}</div>
                                )}
                                {financialReport.income.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs p-2 rounded hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            {item.count && <span className="bg-emerald-500/10 text-emerald-500 text-[9px] px-1 rounded border border-emerald-500/20">x{item.count}</span>}
                                            <span className="text-slate-300">{item.source}</span>
                                        </div>
                                        <span className="font-mono text-emerald-400">+{formatNumber(Math.round(item.amount))}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Columna Gastos */}
                        <div className="flex-1">
                            <div className="p-2 bg-red-950/20 text-red-400 text-xs font-bold uppercase tracking-widest border-b border-white/5 flex items-center gap-2">
                                <Icons.ArrowDown className="w-3 h-3" />
                                {t.common.ui.expenses}
                            </div>
                            <div className="p-2 space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                                {financialReport.expenses.length === 0 && (
                                    <div className="text-center text-[10px] text-slate-600 py-4 italic">{t.common.ui.no_expenses}</div>
                                )}
                                {financialReport.expenses.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs p-2 rounded hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            {item.count && <span className="bg-red-500/10 text-red-500 text-[9px] px-1 rounded border border-red-500/20">x{item.count}</span>}
                                            <span className="text-slate-300">{item.source}</span>
                                        </div>
                                        <span className="font-mono text-red-400">-{formatNumber(Math.round(item.amount))}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                    
                    {/* Barra de Visualización de Proporción */}
                    <div className="h-1 bg-slate-900 flex w-full">
                        {financialReport.totalIncome > 0 && (
                            <div className="h-full bg-emerald-500" style={{ width: `${(financialReport.totalIncome / (financialReport.totalIncome + financialReport.totalExpenses)) * 100}%` }}></div>
                        )}
                        {financialReport.totalExpenses > 0 && (
                            <div className="h-full bg-red-500" style={{ width: `${(financialReport.totalExpenses / (financialReport.totalIncome + financialReport.totalExpenses)) * 100}%` }}></div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
