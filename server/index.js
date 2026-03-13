import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/health', (_req, res) => {
  const rooms = io.sockets.adapter.rooms;
  const playerCount = io.sockets.sockets.size;
  res.json({ status: 'ok', players: playerCount, rooms: rooms.size });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 25000,
  pingTimeout: 20000,
});

const playerPresence = new Map();
const GLOBAL_ROOM = 'global';

io.on('connection', (socket) => {
  let playerId = null;

  socket.on('join_room', ({ peerId }) => {
    playerId = peerId;
    socket.join(GLOBAL_ROOM);

    playerPresence.set(peerId, {
      id: peerId,
      socketId: socket.id,
      name: 'Player',
      level: 0,
      lastSeen: Date.now(),
    });

    const peersInRoom = [];
    for (const [pid, data] of playerPresence.entries()) {
      if (pid !== peerId) {
        peersInRoom.push(pid);
      }
    }

    socket.emit('room_joined', { roomId: GLOBAL_ROOM, peers: peersInRoom });
    socket.to(GLOBAL_ROOM).emit('peer_join', { peerId });
  });

  socket.on('broadcast_action', ({ action }) => {
    socket.to(GLOBAL_ROOM).emit('remote_action', { action, fromPeerId: playerId });
  });

  socket.on('send_to_peer', ({ targetPeerId, action }) => {
    const target = playerPresence.get(targetPeerId);
    if (!target) return;
    const targetSocketId = target.socketId;
    io.to(targetSocketId).emit('remote_action', { action, fromPeerId: playerId });
  });

  socket.on('presence_update', ({ playerData }) => {
    if (!playerId) return;
    const existing = playerPresence.get(playerId);
    if (existing) {
      existing.name = playerData.name || existing.name;
      existing.level = playerData.level ?? existing.level;
      existing.flag = playerData.flag;
      existing.lastSeen = Date.now();
    }
  });

  socket.on('disconnect', () => {
    if (playerId) {
      socket.to(GLOBAL_ROOM).emit('peer_leave', { peerId: playerId });
      playerPresence.delete(playerId);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Iron Dune multiplayer server running on port ${PORT}`);
});
