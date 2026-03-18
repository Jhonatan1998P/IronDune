const DEVTOOLS_ACTIONS = new Set([
  'ADD_RESOURCE',
  'ADD_UNIT',
  'ADD_BUILDING_LEVELS',
  'RESOLVE_LIFECYCLE',
]);

const RESOURCE_COLUMN_MAP = {
  MONEY: 'money',
  OIL: 'oil',
  AMMO: 'ammo',
  GOLD: 'gold',
  DIAMOND: 'diamond',
};

const PRIVILEGED_ROLES = new Set(['Dev', 'Admin', 'Moderador']);

const isPositiveInt = (value) => Number.isFinite(value) && Number.isInteger(value) && value > 0;

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const registerDevToolsRoutes = (app, deps) => {
  const {
    requireAuthUser,
    makeTraceId,
    supabase,
    getOrCreatePlayerResources,
    parseRevision,
    resolveLifecycleCompletions,
    syncNormalizedDomain,
    emitUserStateChanged,
    getCommandMetricsSnapshot,
    io,
    normalizeRole,
  } = deps;

  const loadRoleForUser = async (userId, fallbackRole) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data?.role) {
      return normalizeRole(data.role);
    }

    return normalizeRole(fallbackRole);
  };

  const ensurePrivilegedRole = async (req, res, traceId) => {
    const fallbackRole = req.user?.app_metadata?.role || req.user?.user_metadata?.role;
    const role = await loadRoleForUser(req.user.id, fallbackRole);
    if (!PRIVILEGED_ROLES.has(role)) {
      res.status(403).json({ ok: false, error: 'Forbidden', errorCode: 'FORBIDDEN', traceId });
      return null;
    }
    return role;
  };

  app.get('/api/devtools/metrics', requireAuthUser, async (req, res) => {
    const traceId = req.traceId || makeTraceId('devtools-metrics');
    try {
      const role = await ensurePrivilegedRole(req, res, traceId);
      if (!role) return;

      const [profileResult, resources, commandMetrics] = await Promise.all([
        supabase.from('profiles').select('game_state, updated_at').eq('id', req.user.id).maybeSingle(),
        getOrCreatePlayerResources(req.user.id),
        Promise.resolve(getCommandMetricsSnapshot()),
      ]);

      if (profileResult.error) throw profileResult.error;

      const gameState = profileResult.data?.game_state && typeof profileResult.data?.game_state === 'object'
        ? profileResult.data.game_state
        : {};

      const activeConstructions = Array.isArray(gameState.activeConstructions) ? gameState.activeConstructions.length : 0;
      const activeRecruitments = Array.isArray(gameState.activeRecruitments) ? gameState.activeRecruitments.length : 0;
      const activeResearch = gameState.activeResearch ? 1 : 0;

      const buildingLevels = Object.values(gameState.buildings || {}).reduce((acc, item) => {
        return acc + toSafeNumber(item?.level, 0);
      }, 0);
      const unitCount = Object.values(gameState.units || {}).reduce((acc, value) => acc + toSafeNumber(value, 0), 0);

      return res.json({
        ok: true,
        role,
        traceId,
        server: {
          time: Date.now(),
          connectedPlayers: io?.sockets?.sockets?.size || 0,
          commandMetrics,
        },
        player: {
          revision: parseRevision(gameState.revision),
          updatedAt: profileResult.data?.updated_at || null,
          resources: {
            MONEY: toSafeNumber(resources.money),
            OIL: toSafeNumber(resources.oil),
            AMMO: toSafeNumber(resources.ammo),
            GOLD: toSafeNumber(resources.gold),
            DIAMOND: toSafeNumber(resources.diamond),
          },
          queues: {
            activeConstructions,
            activeRecruitments,
            activeResearch,
          },
          totals: {
            buildingLevels,
            unitCount,
            logs: Array.isArray(gameState.logs) ? gameState.logs.length : 0,
          },
        },
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || 'Failed to load metrics', traceId });
    }
  });

  app.post('/api/devtools/action', requireAuthUser, async (req, res) => {
    const traceId = req.traceId || makeTraceId('devtools-action');
    try {
      const role = await ensurePrivilegedRole(req, res, traceId);
      if (!role) return;

      const action = typeof req.body?.action === 'string' ? req.body.action.trim().toUpperCase() : '';
      if (!DEVTOOLS_ACTIONS.has(action)) {
        return res.status(400).json({ ok: false, error: 'Invalid action', errorCode: 'INVALID_ACTION', traceId });
      }

      const amount = Number(req.body?.amount);
      if (action !== 'RESOLVE_LIFECYCLE' && !isPositiveInt(amount)) {
        return res.status(400).json({ ok: false, error: 'Invalid amount', errorCode: 'INVALID_AMOUNT', traceId });
      }

      const [profileResult, resources] = await Promise.all([
        supabase.from('profiles').select('game_state').eq('id', req.user.id).maybeSingle(),
        getOrCreatePlayerResources(req.user.id),
      ]);

      if (profileResult.error) throw profileResult.error;

      const gameState = profileResult.data?.game_state && typeof profileResult.data?.game_state === 'object'
        ? profileResult.data.game_state
        : {};

      let nextState = {
        ...gameState,
        resources: {
          MONEY: toSafeNumber(resources.money),
          OIL: toSafeNumber(resources.oil),
          AMMO: toSafeNumber(resources.ammo),
          GOLD: toSafeNumber(resources.gold),
          DIAMOND: toSafeNumber(resources.diamond),
        },
      };

      if (action === 'ADD_RESOURCE') {
        const resourceType = typeof req.body?.resourceType === 'string' ? req.body.resourceType.trim().toUpperCase() : '';
        const resourceColumn = RESOURCE_COLUMN_MAP[resourceType];
        if (!resourceColumn) {
          return res.status(400).json({ ok: false, error: 'Invalid resource type', errorCode: 'INVALID_RESOURCE_TYPE', traceId });
        }

        const current = toSafeNumber(resources[resourceColumn]);
        const nextAmount = current + amount;
        const nowIso = new Date().toISOString();
        const { error: updateResourceError } = await supabase
          .from('player_resources')
          .update({
            [resourceColumn]: nextAmount,
            updated_at: nowIso,
          })
          .eq('player_id', req.user.id);

        if (updateResourceError) throw updateResourceError;
        nextState.resources = {
          ...nextState.resources,
          [resourceType]: nextAmount,
        };
      }

      if (action === 'ADD_UNIT') {
        const unitType = typeof req.body?.unitType === 'string' ? req.body.unitType.trim().toUpperCase() : '';
        if (!unitType) {
          return res.status(400).json({ ok: false, error: 'Invalid unit type', errorCode: 'INVALID_UNIT_TYPE', traceId });
        }
        nextState.units = {
          ...(nextState.units || {}),
          [unitType]: toSafeNumber(nextState.units?.[unitType]) + amount,
        };
      }

      if (action === 'ADD_BUILDING_LEVELS') {
        const buildingType = typeof req.body?.buildingType === 'string' ? req.body.buildingType.trim().toUpperCase() : '';
        if (!buildingType) {
          return res.status(400).json({ ok: false, error: 'Invalid building type', errorCode: 'INVALID_BUILDING_TYPE', traceId });
        }
        const currentBuilding = nextState.buildings?.[buildingType] || {};
        nextState.buildings = {
          ...(nextState.buildings || {}),
          [buildingType]: {
            level: toSafeNumber(currentBuilding.level) + amount,
            isDamaged: Boolean(currentBuilding.isDamaged),
          },
        };
      }

      if (action === 'RESOLVE_LIFECYCLE') {
        const lifecycle = resolveLifecycleCompletions(nextState, Date.now());
        nextState = lifecycle.state;
      }

      const nextRevision = parseRevision(nextState.revision) + 1;
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      nextState = {
        ...nextState,
        revision: nextRevision,
        lastSaveTime: now,
      };

      const { error: updateProfileError } = await supabase
        .from('profiles')
        .upsert({
          id: req.user.id,
          game_state: nextState,
          updated_at: nowIso,
        });

      if (updateProfileError) throw updateProfileError;

      await syncNormalizedDomain(req.user.id, nextState, traceId);
      emitUserStateChanged(req.user.id, {
        revision: nextRevision,
        reason: `DEVTOOLS_${action}`,
      });

      return res.json({
        ok: true,
        role,
        traceId,
        action,
        gameState: nextState,
        updatedAt: nowIso,
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || 'Failed to process action', traceId });
    }
  });
};
