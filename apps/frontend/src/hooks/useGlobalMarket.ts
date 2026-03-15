import { useState, useEffect, useCallback } from 'react';
import { socket } from '../lib/socket';

const SERVER_URL = (import.meta as any).env?.VITE_SOCKET_SERVER_URL || 'http://localhost:10000';

export interface GlobalMarketPrice {
    resource_type: string;
    current_price: number;
    base_price: number;
    last_update: string;
}

export interface GlobalMarketState {
    prices: Record<string, GlobalMarketPrice>;
    lastUpdate: number;
    loading: boolean;
}

export const useGlobalMarket = () => {
    const [state, setState] = useState<GlobalMarketState>({
        prices: {},
        lastUpdate: 0,
        loading: true,
    });

    const fetchPrices = useCallback(async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/market/global`);
            if (!res.ok) return;
            const data: GlobalMarketPrice[] = await res.json();
            const pricesMap: Record<string, GlobalMarketPrice> = {};
            data.forEach(p => { pricesMap[p.resource_type] = p; });
            setState(prev => ({ ...prev, prices: pricesMap, lastUpdate: Date.now(), loading: false }));
        } catch (_e) {
            setState(prev => ({ ...prev, loading: false }));
        }
    }, []);

    useEffect(() => {
        fetchPrices();

        const handleMarketUpdate = (data: { prices: Record<string, { current_price: number; base_price: number }>, serverTime: number }) => {
            setState(prev => {
                const updated = { ...prev.prices };
                Object.entries(data.prices).forEach(([rt, info]) => {
                    updated[rt] = {
                        resource_type: rt,
                        current_price: info.current_price,
                        base_price: info.base_price,
                        last_update: new Date(data.serverTime).toISOString(),
                    };
                });
                return { prices: updated, lastUpdate: data.serverTime, loading: false };
            });
        };

        socket.on('market_update', handleMarketUpdate);

        return () => {
            socket.off('market_update', handleMarketUpdate);
        };
    }, [fetchPrices]);

    const getPriceChangePercent = (resourceType: string): number => {
        const price = state.prices[resourceType];
        if (!price || price.base_price === 0) return 0;
        return ((price.current_price - price.base_price) / price.base_price) * 100;
    };

    return { ...state, getPriceChangePercent, refetch: fetchPrices };
};
