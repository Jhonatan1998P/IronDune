export const registerResourceRoutes = (app, deps) => {
  const {
    requireAuthUser,
    makeTraceId,
    DISABLE_LEGACY_SAVE_BLOB,
    validateResourceDeduction,
    addResources,
    emitUserStateChanged,
  } = deps;

  app.post('/api/resources/deduct', requireAuthUser, async (req, res) => {
    const traceId = req.traceId || makeTraceId('resource-deduct');
    try {
      if (DISABLE_LEGACY_SAVE_BLOB) {
        return res.status(410).json({
          ok: false,
          error: 'Legacy resource endpoint is disabled. Use /api/command',
          errorCode: 'LEGACY_RESOURCE_ENDPOINT_DISABLED',
          traceId,
        });
      }

      const costs = req.body?.costs || {};
      const result = await validateResourceDeduction(req.user.id, costs);
      if (!result.ok) {
        return res.status(400).json({ ok: false, error: result.reason || 'insufficient_funds', resource: result.resource, traceId });
      }
      emitUserStateChanged(req.user.id, { reason: 'RESOURCE_DEDUCT' });
      return res.json({ ok: true, resources: result.resources, traceId });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || 'Failed to deduct resources', traceId });
    }
  });

  app.post('/api/resources/add', requireAuthUser, async (req, res) => {
    const traceId = req.traceId || makeTraceId('resource-add');
    try {
      if (DISABLE_LEGACY_SAVE_BLOB) {
        return res.status(410).json({
          ok: false,
          error: 'Legacy resource endpoint is disabled. Use /api/command',
          errorCode: 'LEGACY_RESOURCE_ENDPOINT_DISABLED',
          traceId,
        });
      }

      const gains = req.body?.gains || {};
      const result = await addResources(req.user.id, gains);
      if (!result.ok) {
        return res.status(400).json({ ok: false, error: result.reason || 'add_failed', traceId });
      }
      emitUserStateChanged(req.user.id, { reason: 'RESOURCE_ADD' });
      return res.json({ ok: true, resources: result.resources, traceId });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || 'Failed to add resources', traceId });
    }
  });
};
