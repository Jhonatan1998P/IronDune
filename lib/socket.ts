import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:10000';

export const socket = io(SOCKET_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
});

socket.on('connect', () => {
    console.log('[Socket] Connected to authority server');
});

socket.on('disconnect', () => {
    console.log('[Socket] Disconnected from authority server');
});
