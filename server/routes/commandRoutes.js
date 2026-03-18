import { createCommandRateLimitMiddleware } from '../middleware/commandRateLimit.js';
import { createCommandService } from '../services/commandService.js';

export const registerCommandRoutes = (app, deps) => {
  const {
    requireAuthUser,
    makeTraceId,
    shortId,
    observeCommandEvent,
    COMMAND_RATE_WINDOW_MS,
    COMMAND_RATE_MAX_REQUESTS,
    isObservabilityAuthorized,
    getCommandMetricsSnapshot,
  } = deps;

  const commandService = createCommandService(deps);
  const enforceCommandRateLimit = createCommandRateLimitMiddleware({
    makeTraceId,
    shortId,
    observeCommandEvent,
    windowMs: COMMAND_RATE_WINDOW_MS,
    maxRequests: COMMAND_RATE_MAX_REQUESTS,
  });

  app.get('/api/ops/command-metrics', (req, res) => {
    if (!isObservabilityAuthorized(req)) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.json({
      ok: true,
      serverTime: Date.now(),
      metrics: getCommandMetricsSnapshot(),
    });
  });

  app.post('/api/command', requireAuthUser, enforceCommandRateLimit, commandService.handleCommand);
};
