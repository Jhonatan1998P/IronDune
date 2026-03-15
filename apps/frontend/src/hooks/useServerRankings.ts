import { useState, useEffect, useCallback } from 'react';

const SERVER_URL = (import.meta as any).env?.VITE_SOCKET_SERVER_URL || 'http://localhost:10000';

export interface ServerRankEntry {
    id: string;
    rank: number;
    name: string;
    score: number;
    isPlayer: boolean;
    isBot: boolean;
    country: string;
    personality: string | null;
    avatarId: number;
    tier: 'S' | 'A' | 'B' | 'C' | 'D';
}

export interface PvpRankEntry {
    id: string;
    rank: number;
    name: string;
    score: number;
    isOnline: boolean;
    tier: 'S' | 'A' | 'B' | 'C' | 'D';
}

export const useServerRankings = (category: string, currentPlayerId?: string) => {
    const [rankings, setRankings] = useState<ServerRankEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRankings = useCallback(async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/rankings?category=${category}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: ServerRankEntry[] = await res.json();
            setRankings(data);
            setError(null);
        } catch (e: any) {
            setError(e.message);
            console.error('[useServerRankings] Error:', e);
        } finally {
            setLoading(false);
        }
    }, [category]);

    useEffect(() => {
        fetchRankings();
        const interval = setInterval(fetchRankings, 60_000);
        return () => clearInterval(interval);
    }, [fetchRankings]);

    const currentPlayerRank = rankings.find(r => r.id === currentPlayerId)?.rank;

    return { rankings, loading, error, currentPlayerRank, refetch: fetchRankings };
};

export const useServerPvpRankings = () => {
    const [rankings, setRankings] = useState<PvpRankEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRankings = useCallback(async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/pvp-rankings`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: PvpRankEntry[] = await res.json();
            setRankings(data);
            setError(null);
        } catch (e: any) {
            setError(e.message);
            console.error('[useServerPvpRankings] Error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRankings();
        const interval = setInterval(fetchRankings, 30_000);
        return () => clearInterval(interval);
    }, [fetchRankings]);

    return { rankings, loading, error, refetch: fetchRankings };
};

export const useOnlineCount = () => {
    const [count, setCount] = useState(0);

    const fetchCount = useCallback(async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/online-count`);
            if (!res.ok) return;
            const data = await res.json();
            setCount(data.count || 0);
        } catch (_e) {}
    }, []);

    useEffect(() => {
        fetchCount();
        const interval = setInterval(fetchCount, 15_000);
        return () => clearInterval(interval);
    }, [fetchCount]);

    return count;
};
