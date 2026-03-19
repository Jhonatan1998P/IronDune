const AUTH_CACHE_TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS || 60000);
const AUTH_CACHE_MAX_ENTRIES = Number(process.env.AUTH_CACHE_MAX_ENTRIES || 5000);
const AUTH_CACHE_SAFETY_WINDOW_MS = 5000;

const authTokenCache = new Map();

const decodeJwtPayload = (token) => {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const payloadBase64Url = parts[1];
    const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadBase64 + '='.repeat((4 - (payloadBase64.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(decoded);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
};

const readCachedUser = (token) => {
  const entry = authTokenCache.get(token);
  if (!entry) return null;

  const now = Date.now();
  const expiredByVerification = now >= entry.verifiedUntil;
  const expiredByToken = now >= entry.tokenExpiresAt - AUTH_CACHE_SAFETY_WINDOW_MS;
  if (expiredByVerification || expiredByToken) {
    authTokenCache.delete(token);
    return null;
  }

  return entry.user;
};

const writeCachedUser = (token, user) => {
  const now = Date.now();
  const jwtPayload = decodeJwtPayload(token);
  const expSeconds = Number(jwtPayload?.exp || 0);
  const tokenExpiresAt = Number.isFinite(expSeconds) && expSeconds > 0
    ? expSeconds * 1000
    : now + AUTH_CACHE_TTL_MS;
  const verifiedUntil = now + AUTH_CACHE_TTL_MS;

  authTokenCache.set(token, {
    user,
    tokenExpiresAt,
    verifiedUntil,
  });

  if (authTokenCache.size <= AUTH_CACHE_MAX_ENTRIES) {
    return;
  }

  const overflow = authTokenCache.size - AUTH_CACHE_MAX_ENTRIES;
  const keys = authTokenCache.keys();
  for (let i = 0; i < overflow; i += 1) {
    const key = keys.next().value;
    if (!key) break;
    authTokenCache.delete(key);
  }
};

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

    const cachedUser = readCachedUser(token);
    if (cachedUser) {
      req.user = cachedUser;
      return next();
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      authTokenCache.delete(token);
      logWithSchema('warn', '[AuthMiddleware] Invalid auth token', {
        traceId,
        errorCode: 'AUTH_INVALID_TOKEN',
        extra: {
          error: normalizeServerError(error),
        },
      });
      return res.status(401).json({ error: 'Invalid auth token', traceId });
    }

    writeCachedUser(token, data.user);

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
