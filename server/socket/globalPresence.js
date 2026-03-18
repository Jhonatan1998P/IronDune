export const GLOBAL_ROOM = 'global';

export const createGlobalPresence = ({ io, supabase, makeTraceId, normalizeServerError }) => {
  const playerPresence = new Map();

  const registerSocketHandlers = (socket, state) => {
    socket.on('join_room', async ({ peerId, token }) => {
      const traceId = makeTraceId('socket-join-room');
      try {
        if (typeof token !== 'string' || !token.trim()) {
          socket.emit('room_join_error', { errorCode: 'MISSING_AUTH_TOKEN', traceId });
          return;
        }

        const { data, error } = await supabase.auth.getUser(token.trim());
        if (error || !data?.user?.id) {
          socket.emit('room_join_error', { errorCode: 'INVALID_AUTH_TOKEN', traceId });
          return;
        }

        if (typeof peerId !== 'string' || !peerId.trim()) {
          socket.emit('room_join_error', { errorCode: 'INVALID_PEER_ID', traceId });
          return;
        }

        state.authUserId = data.user.id;
      } catch (error) {
        socket.emit('room_join_error', { errorCode: 'JOIN_FAILED', traceId });
        console.error('[Socket] global room auth failed', {
          traceId,
          error: normalizeServerError(error),
        });
        return;
      }

      state.playerId = peerId;
      socket.join(GLOBAL_ROOM);

      playerPresence.set(peerId, {
        id: peerId,
        userId: state.authUserId,
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
      if (!state.authUserId || !state.playerId) return;
      socket.to(GLOBAL_ROOM).emit('remote_action', { action, fromPeerId: state.playerId });
    });

    socket.on('send_to_peer', ({ targetPeerId, action }) => {
      if (!state.authUserId || !state.playerId) return;
      const target = playerPresence.get(targetPeerId);
      if (!target) return;
      io.to(target.socketId).emit('remote_action', { action, fromPeerId: state.playerId });
    });

    socket.on('presence_update', ({ playerData }) => {
      if (!state.authUserId || !state.playerId) return;
      const existing = playerPresence.get(state.playerId);
      if (!existing) return;

      existing.name = playerData.name || existing.name;
      existing.level = playerData.level ?? existing.level;
      existing.flag = playerData.flag;
      existing.userId = state.authUserId;
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
