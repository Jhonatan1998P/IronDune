export const USER_STATE_ROOM_PREFIX = 'user-state:';
export const USER_STATE_CHANGED_EVENT = 'user_state_changed';

export const createUserStateRealtime = ({ io, supabase, makeTraceId, normalizeServerError }) => {
  const emitUserStateChanged = (userId, payload = {}) => {
    if (!userId || typeof userId !== 'string') return;
    const room = `${USER_STATE_ROOM_PREFIX}${userId}`;
    io.to(room).emit(USER_STATE_CHANGED_EVENT, {
      userId,
      serverTime: Date.now(),
      ...payload,
    });
  };

  const registerSocketHandlers = (socket, state) => {
    socket.on('subscribe_user_state', async ({ token }) => {
      const traceId = makeTraceId('socket-subscribe');
      try {
        if (typeof token !== 'string' || !token.trim()) {
          socket.emit('user_state_subscription', {
            ok: false,
            errorCode: 'MISSING_AUTH_TOKEN',
            traceId,
          });
          return;
        }

        const { data, error } = await supabase.auth.getUser(token.trim());
        if (error || !data?.user?.id) {
          socket.emit('user_state_subscription', {
            ok: false,
            errorCode: 'INVALID_AUTH_TOKEN',
            traceId,
          });
          return;
        }

        state.authUserId = data.user.id;
        socket.join(`${USER_STATE_ROOM_PREFIX}${state.authUserId}`);
        socket.emit('user_state_subscription', {
          ok: true,
          userId: state.authUserId,
          traceId,
        });
      } catch (error) {
        socket.emit('user_state_subscription', {
          ok: false,
          errorCode: 'SUBSCRIPTION_FAILED',
          traceId,
        });
        console.error('[Socket] user state subscription failed', {
          traceId,
          error: normalizeServerError(error),
        });
      }
    });

    socket.on('disconnect', () => {
      if (state.authUserId) {
        socket.leave(`${USER_STATE_ROOM_PREFIX}${state.authUserId}`);
      }
    });
  };

  return {
    emitUserStateChanged,
    registerSocketHandlers,
  };
};
