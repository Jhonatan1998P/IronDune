export const createRequireAuthUser = ({ supabase, makeTraceId, shortId, normalizeServerError, logWithSchema }) => async (req, res, next) => {
  const traceId = req.traceId || makeTraceId('auth-mw');
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      logWithSchema('warn', '[AuthMiddleware] Missing bearer token', { traceId, errorCode: 'AUTH_MISSING_TOKEN' });
      return res.status(401).json({ error: 'Missing auth token', traceId });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      logWithSchema('warn', '[AuthMiddleware] Empty bearer token', { traceId, errorCode: 'AUTH_EMPTY_TOKEN' });
      return res.status(401).json({ error: 'Missing auth token', traceId });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      logWithSchema('warn', '[AuthMiddleware] Invalid auth token', {
        traceId,
        errorCode: 'AUTH_INVALID_TOKEN',
        extra: {
          error: normalizeServerError(error),
        },
      });
      return res.status(401).json({ error: 'Invalid auth token', traceId });
    }

    logWithSchema('info', '[AuthMiddleware] Authenticated request', {
      traceId,
      userId: shortId(data.user.id),
      extra: {
        email: data.user.email || null,
        path: req.path,
      },
    });
    req.user = data.user;
    return next();
  } catch (error) {
    logWithSchema('error', '[AuthMiddleware] Auth validation exception', {
      traceId,
      errorCode: 'AUTH_VALIDATION_FAILED',
      extra: {
        error: normalizeServerError(error),
      },
    });
    return res.status(500).json({ error: 'Auth validation failed', traceId });
  }
};
