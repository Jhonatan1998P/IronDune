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

io.on('connection', (socket) => {
  let currentRoom = null;
  let playerId = null;

  socket.on('join_room', ({ roomId, peerId }) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      socket.to(currentRoom).emit('peer_leave', { peerId: playerId });
      if (playerId) playerPresence.delete(playerId);
    }

    currentRoom = roomId;
    playerId = peerId;
    socket.join(roomId);

    playerPresence.set(peerId, {
      id: peerId,
      socketId: socket.id,
      roomId,
      name: 'Player',
      level: 0,
      lastSeen: Date.now(),
    });

    const peersInRoom = [];
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    if (roomSockets) {
      for (const [pid, data] of playerPresence.entries()) {
        if (data.roomId === roomId && pid !== peerId) {
          peersInRoom.push(pid);
        }
      }
    }

    socket.emit('room_joined', { roomId, peers: peersInRoom });

    socket.to(roomId).emit('peer_join', { peerId });
  });

  socket.on('leave_room', () => {
    if (currentRoom && playerId) {
      socket.leave(currentRoom);
      socket.to(currentRoom).emit('peer_leave', { peerId: playerId });
      playerPresence.delete(playerId);
      currentRoom = null;
      playerId = null;
    }
  });

  socket.on('broadcast_action', ({ action }) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('remote_action', { action, fromPeerId: playerId });
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
    if (currentRoom && playerId) {
      socket.to(currentRoom).emit('peer_leave', { peerId: playerId });
      playerPresence.delete(playerId);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Iron Dune multiplayer server running on port ${PORT}`);
});
