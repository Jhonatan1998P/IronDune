
import React, { useState, useMemo } from 'react';
import { BuildingType, GameState, ResourceType, MarketOffer } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { Card, GlassButton, Icons } from '../UIComponents';
import { formatDuration, formatNumber } from '../../utils';
import { calculateDiamondExchangeRate } from '../../utils/engine/market';

// --- SUB-COMPONENT: DIAMOND LIQUIDATION CARD ---
// extracted for cleaner main component code
const DiamondLiquidationCard: React.FC<{ 
    gameState: GameState; 
    onExchange: (res: ResourceType, amount: number) => void; 
}> = ({ gameState, onExchange }) => {
    const { t } = useLanguage();
    
    const hasDiamonds = gameState.resources[ResourceType.DIAMOND] >= 1;
    const resourcesToExchange = [ResourceType.MONEY, ResourceType.OIL, ResourceType.AMMO, ResourceType.GOLD];

    return (
        <Card title={t.market.liquidation_title} className="border-cyan-500/30 bg-cyan-900/5">
            <div className="flex flex-col md:flex-row items-center gap-6">
                
                {/* Left: Diamond Status */}
                <div className="flex flex-col items-center justify-center p-4 bg-black/20 rounded border border-cyan-500/20 md:w-1/4 shrink-0 w-full">
                    <div className="text-[10px] text-cyan-400 uppercase tracking-widest mb-2 font-bold">{t.market.your_diamonds}</div>
                    <div className="text-3xl font-mono text-white flex items-center gap-2">
                        <Icons.Resources.Diamond className="w-6 h-6 text-cyan-400" />
                        {Math.floor(gameState.resources[ResourceType.DIAMOND])}
                    </div>
                    <div className="text-[9px] text-slate-500 mt-2 text-center">
                        {t.market.rate_desc.replace('{score}', formatNumber(gameState.empirePoints))}
                    </div>
                </div>

                {/* Right: Exchange Options */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1 w-full">
                    {resourcesToExchange.map(res => {
                        // REFACTORED: Use shared SSOT function
                        const rate = calculateDiamondExchangeRate(res, gameState.empirePoints, gameState.activeMarketEvent);
                        
                        const color = res === ResourceType.MONEY ? 'text-emerald-400' :
                                      res === ResourceType.OIL ? 'text-purple-400' :
                                      res === ResourceType.AMMO ? 'text-orange-400' : 'text-yellow-400';

                        return (
                            <button
                                key={res}
                                onClick={() => onExchange(res, 1)}
                                disabled={!hasDiamonds}
                                className="flex flex-col items-center justify-between p-3 bg-black/40 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group h-full"
                            >
                                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">{t.common.resources[res]}</div>
                                <div className={`font-mono text-lg font-bold ${color} mb-1 group-hover:scale-110 transition-transform`}>
                                    +{formatNumber(rate)}
                                </div>
                                <div className="flex items-center gap-1 text-[9px] text-cyan-500 border border-cyan-500/20 px-2 py-0.5 rounded bg-cyan-900/20">
                                    {t.market.exchange_btn} <Icons.Resources.Diamond className="w-2 h-2" />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
};

// --- SUB-COMPONENT: MARKET OFFER CARD ---
const MarketOfferCard: React.FC<{ 
    offer: MarketOffer; 
    playerResources: Record<ResourceType, number>; 
    maxResources: Record<ResourceType, number>;
    currentAmount: number;
    onAmountChange: (id: string, val: number) => void;
    onTrade: (id: string, amount: number) => void;
}> = ({ offer, playerResources, maxResources: _maxResources, currentAmount, onAmountChange, onTrade }) => {
    const { t } = useLanguage();
    
    const isBuy = offer.type === 'BUY'; // Player Buys
    const available = offer.totalAmount - offer.amountSold;
    const isSoldOut = available <= 0;
    const totalCost = currentAmount * offer.pricePerUnit;
    const resourceName = t.common.resources[offer.resource];
    const trend = useMemo(() => Math.random() > 0.5 ? 'up' : 'down', []); // Simulated visual trend

    // Validation Logic
    let canAfford = false;
    if (isBuy) {
         canAfford = playerResources[ResourceType.MONEY] >= totalCost;
    } else {
         canAfford = playerResources[offer.resource] >= currentAmount;
    }

    return (
        <div className={`glass-panel border border-white/5 rounded-xl overflow-hidden flex flex-col ${isSoldOut ? 'opacity-60 grayscale' : ''}`}>
             <div className={`px-4 py-3 flex justify-between items-center border-b border-white/5 ${isBuy ? 'bg-emerald-950/20' : 'bg-orange-950/20'}`}>
                 <div className="flex items-center gap-2">
                     <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${isBuy ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-orange-500/10 text-orange-400 border-orange-500/30'}`}>
                         {isBuy ? t.market.offer_buy : t.market.offer_sell}
                     </div>
                     <span className="font-tech text-sm text-slate-200">{resourceName}</span>
                 </div>
                 <div className="text-right">
                     <span className="block text-[10px] text-slate-500 uppercase tracking-widest">{t.market.price}</span>
                     <div className="flex items-center justify-end gap-1">
                         <span className="font-mono font-bold text-white text-sm">${offer.pricePerUnit}</span>
                         <span className={`text-[9px] ${trend === 'up' ? 'text-emerald-500' : 'text-red-500'}`}>
                             {trend === 'up' ? <Icons.TrendUp className="w-3 h-3" /> : <Icons.TrendDown className="w-3 h-3" />}
                         </span>
                     </div>
                 </div>
             </div>
             
             <div className="p-4 flex-1 flex flex-col justify-between bg-gradient-to-b from-transparent to-black/20">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.market.available}</div>
                        <div className={`font-mono text-xl font-bold ${isSoldOut ? 'text-red-500' : 'text-slate-200'}`}>
                            {isSoldOut ? t.market.sold_out : formatNumber(available)}
                        </div>
                    </div>
                    {/* Simulated Sparkline */}
                    <div className="flex items-end gap-0.5 h-8 opacity-30">
                        {[40,60,30,70,50,80,60,90].map((h, i) => (
                            <div key={i} className={`w-1.5 rounded-t-sm ${isBuy ? 'bg-emerald-400' : 'bg-orange-400'}`} style={{ height: `${h}%` }}></div>
                        ))}
                    </div>
                </div>

                {!isSoldOut && (
                    <div className="space-y-4">
                        <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                            <div className="flex justify-between items-center text-xs mb-2">
                                <span className="text-slate-400 uppercase tracking-wider">{t.common.ui.quantity}</span>
                                <span className="font-mono text-cyan-400 font-bold">{formatNumber(currentAmount)}</span>
                            </div>
                            
                            <input 
                                type="range" 
                                min="0" 
                                max={available} 
                                step="1"
                                value={currentAmount}
                                onChange={(e) => onAmountChange(offer.id, parseInt(e.target.value) || 0)}
                                className="w-full accent-cyan-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer mb-3"
                            />
                            
                            <div className="flex justify-between gap-1">
                                 <button onClick={() => onAmountChange(offer.id, 0)} className="flex-1 text-[9px] py-1 bg-white/5 hover:bg-white/10 rounded text-slate-400 font-mono">0%</button>
                                 <button onClick={() => onAmountChange(offer.id, Math.floor(available * 0.25))} className="flex-1 text-[9px] py-1 bg-white/5 hover:bg-white/10 rounded text-slate-400 font-mono">25%</button>
                                 <button onClick={() => onAmountChange(offer.id, Math.floor(available * 0.5))} className="flex-1 text-[9px] py-1 bg-white/5 hover:bg-white/10 rounded text-slate-400 font-mono">50%</button>
                                 <button onClick={() => onAmountChange(offer.id, available)} className="flex-1 text-[9px] py-1 bg-white/5 hover:bg-white/10 rounded text-slate-400 font-mono">{t.common.actions.max}</button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="text-right">
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest">{t.common.ui.total}</div>
                                <div className={`font-mono text-sm font-bold ${canAfford ? 'text-white' : 'text-red-500'}`}>
                                    ${formatNumber(totalCost)}
                                </div>
                            </div>
                            <GlassButton 
                                onClick={() => {
                                    onTrade(offer.id, currentAmount);
                                    onAmountChange(offer.id, 0);
                                }}
                                disabled={isSoldOut || currentAmount <= 0 || !canAfford}
                                className="min-w-[100px]"
                                variant={isBuy ? 'primary' : 'neutral'}
                            >
                                {t.common.actions.trade}
                            </GlassButton>
                        </div>
                    </div>
                )}
             </div>
        </div>
    );
};

interface MarketViewProps {
    gameState: GameState;
    onExecuteTrade: (offerId: string, amount: number) => void;
    onDiamondExchange?: (resource: ResourceType, amount: number) => void;
}

export const MarketView: React.FC<MarketViewProps> = ({ gameState, onExecuteTrade, onDiamondExchange }) => {
    const { t } = useLanguage();
    const [tradeAmounts, setTradeAmounts] = useState<Record<string, number>>({});

    const marketBuilding = gameState.buildings[BuildingType.MARKET];
    const hasMarket = marketBuilding.level > 0;
    const event = gameState.activeMarketEvent;

    const getEventInfo = () => {
        if (!event) return { title: t.market.events.evt_stable.title, desc: t.market.events.evt_stable.desc };
        return t.market.events[event.nameKey] || { title: event.nameKey, desc: event.descriptionKey };
    };

    const handleAmountChange = (offerId: string, val: number) => {
        setTradeAmounts(prev => ({ ...prev, [offerId]: val }));
    };

    if (!hasMarket) {
        return (
            <div className="h-full flex items-center justify-center animate-[fadeIn_0.3s_ease-out] p-4">
                <div className="glass-panel max-w-md p-8 text-center flex flex-col items-center gap-4 opacity-75 border-dashed border-slate-700">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-500 border border-slate-600 mb-2">
                        <Icons.Lock />
                    </div>
                    <h2 className="text-xl font-tech text-slate-400 uppercase tracking-widest">{t.market.title}</h2>
                    <p className="text-sm text-slate-500">{t.market.no_connection}</p>
                </div>
            </div>
        );
    }

    const eventInfo = getEventInfo();

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] pb-24">
            
            {/* Header Status / Ticker */}
            <div className="glass-panel p-0 rounded-xl border border-white/10 relative overflow-hidden bg-slate-900/80">
                <div className="p-4 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10 bg-gradient-to-r from-cyan-950/30 to-transparent">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                             <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                             </span>
                             <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">{t.market.status}</span>
                        </div>
                        <h2 className="font-tech text-lg text-white uppercase tracking-wider mb-1">{eventInfo.title}</h2>
                        <p className="text-[10px] text-slate-400 max-w-md font-mono">{eventInfo.desc}</p>
                    </div>
                    
                    <div className="text-right bg-black/30 px-3 py-2 rounded border border-white/5">
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">{t.market.next_refresh}</div>
                        <div className="font-mono text-base text-cyan-300">{formatDuration(Math.max(0, gameState.marketNextRefreshTime - Date.now()))}</div>
                    </div>
                </div>
            </div>

            {/* Diamond Exchange (Refactored Sub-Component) */}
            {onDiamondExchange && (
                <DiamondLiquidationCard gameState={gameState} onExchange={onDiamondExchange} />
            )}

            {/* Offers Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {gameState.marketOffers.map(offer => (
                    <MarketOfferCard 
                        key={offer.id}
                        offer={offer}
                        playerResources={gameState.resources}
                        maxResources={gameState.maxResources}
                        currentAmount={tradeAmounts[offer.id] || 0}
                        onAmountChange={handleAmountChange}
                        onTrade={onExecuteTrade}
                    />
                ))}
            </div>
        </div>
    );
};
