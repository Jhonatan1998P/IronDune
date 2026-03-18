export const createRequireAuthUser = ({ supabase, makeTraceId, shortId, normalizeServerError }) => async (req, res, next) => {
  const traceId = req.traceId || makeTraceId('auth-mw');
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      console.warn('[AuthMiddleware] Missing bearer token', { traceId });
      return res.status(401).json({ error: 'Missing auth token', traceId });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      console.warn('[AuthMiddleware] Empty bearer token', { traceId });
      return res.status(401).json({ error: 'Missing auth token', traceId });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      console.warn('[AuthMiddleware] Invalid auth token', {
        traceId,
        error: normalizeServerError(error),
      });
      return res.status(401).json({ error: 'Invalid auth token', traceId });
    }

    console.log('[AuthMiddleware] Authenticated request', {
      traceId,
      userId: shortId(data.user.id),
      email: data.user.email || null,
      path: req.path,
    });
    req.user = data.user;
    return next();
  } catch (error) {
    console.error('[AuthMiddleware] Auth validation exception', {
      traceId,
      error: normalizeServerError(error),
    });
    return res.status(500).json({ error: 'Auth validation failed', traceId });
  }
};
