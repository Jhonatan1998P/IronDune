export const GLOBAL_ROOM = 'global';

export const createGlobalPresence = ({ io }) => {
  const playerPresence = new Map();

  const registerSocketHandlers = (socket, state) => {
    socket.on('join_room', ({ peerId }) => {
      state.playerId = peerId;
      socket.join(GLOBAL_ROOM);

      playerPresence.set(peerId, {
        id: peerId,
        socketId: socket.id,
        name: 'Player',
        level: 0,
        lastSeen: Date.now(),
      });

      const peersInRoom = [];
      for (const [pid] of playerPresence.entries()) {
        if (pid !== peerId) {
          peersInRoom.push(pid);
        }
      }

      socket.emit('room_joined', { roomId: GLOBAL_ROOM, peers: peersInRoom });
      socket.to(GLOBAL_ROOM).emit('peer_join', { peerId });
    });

    socket.on('broadcast_action', ({ action }) => {
      socket.to(GLOBAL_ROOM).emit('remote_action', { action, fromPeerId: state.playerId });
    });

    socket.on('send_to_peer', ({ targetPeerId, action }) => {
      const target = playerPresence.get(targetPeerId);
      if (!target) return;
      io.to(target.socketId).emit('remote_action', { action, fromPeerId: state.playerId });
    });

    socket.on('presence_update', ({ playerData }) => {
      if (!state.playerId) return;
      const existing = playerPresence.get(state.playerId);
      if (!existing) return;

      existing.name = playerData.name || existing.name;
      existing.level = playerData.level ?? existing.level;
      existing.flag = playerData.flag;
      existing.lastSeen = Date.now();
    });

    socket.on('disconnect', () => {
      if (!state.playerId) return;
      socket.to(GLOBAL_ROOM).emit('peer_leave', { peerId: state.playerId });
      playerPresence.delete(state.playerId);
    });
  };

  return {
    registerSocketHandlers,
  };
};
