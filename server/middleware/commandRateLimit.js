export const createCommandRateLimitMiddleware = ({
  makeTraceId,
  shortId,
  observeCommandEvent,
  logWithSchema,
  windowMs,
  maxRequests,
}) => {
  const commandRateTracker = new Map();

  return (req, res, next) => {
    const traceId = req.traceId || makeTraceId('rate-limit');
    const userKey = req.user?.id || 'anonymous';
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const bucketKey = `${userKey}:${ip}`;
    const now = Date.now();
    const current = commandRateTracker.get(bucketKey);

    if (!current || now - current.windowStart > windowMs) {
      commandRateTracker.set(bucketKey, { count: 1, windowStart: now });
      return next();
    }

    current.count += 1;
    if (current.count > maxRequests) {
      observeCommandEvent({
        type: req.body?.type,
        result: 'rate_limited',
        errorCode: 'RATE_LIMITED',
        durationMs: 0,
      });
      logWithSchema('warn', '[CommandGateway] Rate limit exceeded', {
        traceId,
        userId: shortId(req.user?.id),
        commandId: req.body?.commandId || null,
        expectedRevision: Number.isFinite(Number(req.body?.expectedRevision)) ? Number(req.body?.expectedRevision) : null,
        errorCode: 'RATE_LIMITED',
        extra: {
          ip,
          count: current.count,
          windowMs,
        },
      });
      return res.status(429).json({
        ok: false,
        error: 'Too many commands',
        errorCode: 'RATE_LIMITED',
        retryAfterMs: Math.max(0, windowMs - (now - current.windowStart)),
        traceId,
      });
    }

    return next();
  };
};
