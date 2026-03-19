import { z } from 'zod';

const bootstrapResponseSchema = z.object({
  profile: z.object({
    id: z.string().uuid(),
    playerName: z.string().min(1),
    playerFlag: z.string().min(1),
  }),
  resources: z.record(z.string(), z.number()),
  rates: z.record(z.string(), z.number()),
  buildings: z.record(z.string(), z.any()),
  units: z.record(z.string(), z.any()),
  tech: z.object({
    levels: z.record(z.string(), z.any()),
    researched: z.array(z.string()),
  }),
  progress: z.object({
    campaignProgress: z.number(),
    empirePoints: z.number(),
    lastSaveTime: z.number(),
  }),
  queues: z.object({
    activeConstructions: z.array(z.any()),
    activeRecruitments: z.array(z.any()),
    activeResearch: z.any().nullable(),
  }),
  metadata: z.object({
    revision: z.number(),
    serverTime: z.number(),
    resetId: z.any().nullable(),
  }),
  game_state: z.object({}).passthrough(),
  updated_at: z.string().nullable(),
  traceId: z.string().min(1),
});

export const createBootstrapService = ({
  makeTraceId,
  supabase,
  getOrCreatePlayerResources,
  isNonNullObject,
  parseRevision,
  ResourceType,
  resolveLifecycleCompletions,
  syncNormalizedDomain,
  emitUserStateChanged,
  normalizedReadsEnabled,
  loadNormalizedStatePatch,
  shortId,
  normalizeServerError,
  logWithSchema,
}) => {
  const classifyBootstrapError = (error) => {
    const code = error?.code || '';
    const message = String(error?.message || '').toLowerCase();

    if (code === 'PGRST301' || message.includes('timeout') || message.includes('econnreset') || message.includes('network')) {
      return {
        status: 503,
        errorCode: 'BOOTSTRAP_TRANSIENT_ERROR',
        retryable: true,
      };
    }

    return {
      status: 500,
      errorCode: 'BOOTSTRAP_TERMINAL_ERROR',
      retryable: false,
    };
  };

  const handleBootstrap = async (req, res) => {
    const traceId = req.traceId || makeTraceId('bootstrap');
    const serverTime = Date.now();

    try {
      const [metaResult, profileResult, authoritativeResources] = await Promise.all([
        supabase.from('server_metadata').select('value').eq('key', 'last_reset_id').maybeSingle(),
        supabase.from('profiles').select('game_state, updated_at').eq('id', req.user.id).maybeSingle(),
        getOrCreatePlayerResources(req.user.id),
      ]);

      if (metaResult.error) throw metaResult.error;
      if (profileResult.error && profileResult.error.code !== 'PGRST116') throw profileResult.error;

      const resetId = metaResult.data?.value || null;
      const baseState = isNonNullObject(profileResult.data?.game_state) ? profileResult.data.game_state : {};
      const stateWithDefaults = {
        ...baseState,
        playerName: baseState.playerName || req.user.user_metadata?.username || 'Commander',
        playerFlag: baseState.playerFlag || req.user.user_metadata?.flag || 'US',
        revision: parseRevision(baseState.revision),
        lastSaveTime: Number(baseState.lastSaveTime || serverTime),
        lastResetId: baseState.lastResetId || resetId,
        resources: {
          [ResourceType.MONEY]: authoritativeResources.money,
          [ResourceType.OIL]: authoritativeResources.oil,
          [ResourceType.AMMO]: authoritativeResources.ammo,
          [ResourceType.GOLD]: authoritativeResources.gold,
          [ResourceType.DIAMOND]: authoritativeResources.diamond,
        },
        maxResources: {
          [ResourceType.MONEY]: authoritativeResources.money_max,
          [ResourceType.OIL]: authoritativeResources.oil_max,
          [ResourceType.AMMO]: authoritativeResources.ammo_max,
          [ResourceType.GOLD]: authoritativeResources.gold_max,
          [ResourceType.DIAMOND]: authoritativeResources.diamond_max,
        },
        bankBalance: authoritativeResources.bank_balance,
        currentInterestRate: authoritativeResources.interest_rate,
        nextRateChangeTime: authoritativeResources.next_rate_change,
      };

      const lifecycleResolved = resolveLifecycleCompletions(stateWithDefaults, serverTime);
      const effectiveState = lifecycleResolved.state;

      if (lifecycleResolved.changed) {
        const lifecycleUpdatedAt = new Date(serverTime).toISOString();
        const { error: lifecycleSaveError } = await supabase.from('profiles').upsert({
          id: req.user.id,
          game_state: effectiveState,
          updated_at: lifecycleUpdatedAt,
        });
        if (!lifecycleSaveError) {
          await syncNormalizedDomain(req.user.id, effectiveState, traceId);
          emitUserStateChanged(req.user.id, {
            revision: parseRevision(effectiveState.revision),
            reason: 'BOOTSTRAP_LIFECYCLE_RESOLVE',
          });
        }
      }

      const normalizedPatch = normalizedReadsEnabled
        ? await loadNormalizedStatePatch(req.user.id).catch((error) => {
          logWithSchema('warn', '[BootstrapAPI] Falling back to profile blob read', {
            traceId,
            userId: shortId(req.user.id),
            errorCode: 'NORMALIZED_READ_FALLBACK',
            extra: {
              error: normalizeServerError(error),
            },
          });
          return null;
        })
        : null;

      const blobLastSaveTime = Number(effectiveState?.lastSaveTime || 0);
      const normalizedLastSaveTime = Number(normalizedPatch?.lastSaveTime || 0);
      const shouldUseNormalizedPatch = isNonNullObject(normalizedPatch)
        && normalizedLastSaveTime >= blobLastSaveTime;

      if (isNonNullObject(normalizedPatch) && !shouldUseNormalizedPatch) {
        logWithSchema('warn', '[BootstrapAPI] Ignoring stale normalized state patch', {
          traceId,
          userId: shortId(req.user.id),
          errorCode: 'NORMALIZED_PATCH_STALE',
          extra: {
            blobLastSaveTime,
            normalizedLastSaveTime,
          },
        });
      }

      const gameState = shouldUseNormalizedPatch
        ? { ...effectiveState, ...normalizedPatch }
        : effectiveState;

      const responsePayload = {
        profile: {
          id: req.user.id,
          playerName: gameState.playerName,
          playerFlag: gameState.playerFlag,
        },
        resources: gameState.resources,
        rates: {
          moneyRate: authoritativeResources.money_rate,
          oilRate: authoritativeResources.oil_rate,
          ammoRate: authoritativeResources.ammo_rate,
          goldRate: authoritativeResources.gold_rate,
          diamondRate: authoritativeResources.diamond_rate,
        },
        buildings: gameState.buildings || {},
        units: gameState.units || {},
        tech: {
          levels: gameState.techLevels || {},
          researched: Array.isArray(gameState.researchedTechs) ? gameState.researchedTechs : [],
        },
        progress: {
          campaignProgress: Number(gameState.campaignProgress || 1),
          empirePoints: Number(gameState.empirePoints || 0),
          lastSaveTime: Number(gameState.lastSaveTime || serverTime),
        },
        queues: {
          activeConstructions: Array.isArray(gameState.activeConstructions) ? gameState.activeConstructions : [],
          activeRecruitments: Array.isArray(gameState.activeRecruitments) ? gameState.activeRecruitments : [],
          activeResearch: gameState.activeResearch || null,
        },
        metadata: {
          revision: parseRevision(gameState.revision),
          serverTime,
          resetId: gameState.lastResetId || resetId,
        },
        game_state: gameState,
        updated_at: profileResult.data?.updated_at || null,
        traceId,
      };

      const schemaCheck = bootstrapResponseSchema.safeParse(responsePayload);
      if (!schemaCheck.success) {
        logWithSchema('error', '[BootstrapAPI] Invalid bootstrap response schema', {
          traceId,
          userId: shortId(req.user?.id),
          errorCode: 'BOOTSTRAP_SCHEMA_INVALID',
          extra: {
            issues: schemaCheck.error.issues,
          },
        });
        return res.status(500).json({
          error: 'Failed to bootstrap',
          errorCode: 'BOOTSTRAP_SCHEMA_INVALID',
          retryable: false,
          traceId,
        });
      }

      return res.json(responsePayload);
    } catch (error) {
      const classified = classifyBootstrapError(error);
      logWithSchema('error', '[BootstrapAPI] Bootstrap failed', {
        traceId,
        userId: shortId(req.user?.id),
        errorCode: classified.errorCode,
        extra: {
          retryable: classified.retryable,
          error: normalizeServerError(error),
        },
      });
      return res.status(classified.status).json({
        error: error.message || 'Failed to bootstrap',
        errorCode: classified.errorCode,
        retryable: classified.retryable,
        traceId,
      });
    }
  };

  return {
    handleBootstrap,
  };
};
