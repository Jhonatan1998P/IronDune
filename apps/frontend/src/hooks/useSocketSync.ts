import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/useGameStore';

export function useSocketSync(playerId: string | undefined) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const { applyPatch, setServerTimeOffset } = useGameStore();

    useEffect(() => {
        if (!playerId) return;

        const s = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
            query: { playerId }
        });

        s.on('connect', () => {
            console.log('Connected to game server');
            // Sincronizar tiempo
            const start = Date.now();
            s.emit('server:time-sync', {}, (serverTime: string) => {
                const latency = (Date.now() - start) / 2;
                const offset = new Date(serverTime).getTime() - Date.now() + latency;
                setServerTimeOffset(offset);
            });
        });

        s.on('planet:patch', (patch) => {
            applyPatch('planet', patch);
        });

        s.on('queue:patch', (patch) => {
            applyPatch('queue', patch);
        });

        setSocket(s);

        return () => {
            s.disconnect();
        };
    }, [playerId]);

    return socket;
}
