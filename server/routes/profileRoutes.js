export const registerProfileRoutes = (app, deps) => {
  const {
    requireAuthUser,
    makeTraceId,
    shortId,
    supabase,
    getOrCreatePlayerResources,
    NORMALIZED_READS_ENABLED,
    isNonNullObject,
    loadNormalizedStatePatch,
    normalizeServerError,
    DISABLE_LEGACY_SAVE_BLOB,
    SERVER_MANAGED_FIELDS,
    ResourceType,
    syncNormalizedDomain,
    emitUserStateChanged,
    parseRevision,
  } = deps;

  app.get('/api/profile', requireAuthUser, async (req, res) => {
    const traceId = req.traceId || makeTraceId('profile-load');
    try {
      console.log('[ProfileAPI] Load started', {
        traceId,
        userId: shortId(req.user.id),
      });

      const { data, error } = await supabase
        .from('profiles')
        .select('game_state, updated_at')
        .eq('id', req.user.id)
        .single();

      await getOrCreatePlayerResources(req.user.id);

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('[ProfileAPI] Load no profile found', {
            traceId,
            userId: shortId(req.user.id),
          });
          return res.status(404).json({ game_state: null, traceId });
        }
        throw error;
      }

      let responseState = data?.game_state || null;

      if (NORMALIZED_READS_ENABLED && isNonNullObject(responseState)) {
        const normalizedPatch = await loadNormalizedStatePatch(req.user.id);
        responseState = {
          ...responseState,
          ...normalizedPatch,
        };
      }

      console.log('[ProfileAPI] Load succeeded', {
        traceId,
        userId: shortId(req.user.id),
        hasState: Boolean(data?.game_state),
        updatedAt: data?.updated_at || null,
        stateKeys: data?.game_state ? Object.keys(data.game_state).length : 0,
        normalizedReads: NORMALIZED_READS_ENABLED,
      });
      return res.json({ game_state: responseState, updated_at: data?.updated_at || null, traceId });
    } catch (error) {
      console.error('[ProfileAPI] Load failed', {
        traceId,
        userId: shortId(req.user?.id),
        error: normalizeServerError(error),
      });
      return res.status(500).json({ error: error.message || 'Failed to load profile', traceId });
    }
  });

  app.post('/api/profile/save', requireAuthUser, async (req, res) => {
    const traceId = req.traceId || makeTraceId('profile-save');
    try {
      if (DISABLE_LEGACY_SAVE_BLOB) {
        console.warn('[ProfileAPI] Save blocked by feature flag', {
          traceId,
          userId: shortId(req.user.id),
          errorCode: 'LEGACY_SAVE_DISABLED',
        });
        return res.status(410).json({
          ok: false,
          error: 'Legacy profile save is disabled',
          errorCode: 'LEGACY_SAVE_DISABLED',
          traceId,
        });
      }

      const gameState = req.body?.game_state;
      const expectedUpdatedAt = req.body?.expected_updated_at || null;

      console.log('[ProfileAPI] Save started', {
        traceId,
        userId: shortId(req.user.id),
        expectedUpdatedAt,
        hasGameState: Boolean(gameState),
        stateKeys: gameState ? Object.keys(gameState).length : 0,
      });

      if (!gameState) {
        return res.status(400).json({ error: 'Missing game_state', traceId });
      }

      if (expectedUpdatedAt) {
        const { data: existing, error: existingError } = await supabase
          .from('profiles')
          .select('updated_at')
          .eq('id', req.user.id)
          .single();

        if (existingError && existingError.code !== 'PGRST116') {
          throw existingError;
        }

        if (existing?.updated_at && existing.updated_at !== expectedUpdatedAt) {
          console.warn('[ProfileAPI] Save conflict', {
            traceId,
            userId: shortId(req.user.id),
            expectedUpdatedAt,
            existingUpdatedAt: existing.updated_at,
          });
          return res.status(409).json({ error: 'Profile out of date', updated_at: existing.updated_at, traceId });
        }
      }

      const serverTime = Date.now();
      const stateToSave = { ...gameState, lastSaveTime: serverTime };

      for (const field of SERVER_MANAGED_FIELDS) {
        if (field in stateToSave) {
          delete stateToSave[field];
        }
      }

      const authoritativeResources = await getOrCreatePlayerResources(req.user.id);

      if (authoritativeResources) {
        stateToSave.resources = {
          [ResourceType.MONEY]: authoritativeResources.money,
          [ResourceType.OIL]: authoritativeResources.oil,
          [ResourceType.AMMO]: authoritativeResources.ammo,
          [ResourceType.GOLD]: authoritativeResources.gold,
          [ResourceType.DIAMOND]: authoritativeResources.diamond,
        };
        stateToSave.maxResources = {
          [ResourceType.MONEY]: authoritativeResources.money_max,
          [ResourceType.OIL]: authoritativeResources.oil_max,
          [ResourceType.AMMO]: authoritativeResources.ammo_max,
          [ResourceType.GOLD]: authoritativeResources.gold_max,
          [ResourceType.DIAMOND]: authoritativeResources.diamond_max,
        };
        stateToSave.bankBalance = authoritativeResources.bank_balance;
        stateToSave.currentInterestRate = authoritativeResources.interest_rate;
        stateToSave.nextRateChangeTime = authoritativeResources.next_rate_change;
      }
      const updatedAt = new Date().toISOString();

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: req.user.id,
          game_state: stateToSave,
          updated_at: updatedAt,
        });

      if (error) throw error;

      const diagnostics = [];
      const normalizedSync = await syncNormalizedDomain(req.user.id, stateToSave, traceId);
      if (!normalizedSync.ok && normalizedSync.warning) {
        diagnostics.push(normalizedSync.warning);
      }

      console.log('[ProfileAPI] Save succeeded', {
        traceId,
        userId: shortId(req.user.id),
        updatedAt,
        serverTime,
        savedStateKeys: Object.keys(stateToSave).length,
      });

      emitUserStateChanged(req.user.id, {
        revision: parseRevision(stateToSave.revision),
        reason: 'PROFILE_SAVE',
      });

      return res.json({ ok: true, serverTime, updated_at: updatedAt, diagnostics, traceId });
    } catch (error) {
      console.error('[ProfileAPI] Save failed', {
        traceId,
        userId: shortId(req.user?.id),
        error: normalizeServerError(error),
      });
      return res.status(500).json({ error: error.message || 'Failed to save profile', traceId });
    }
  });
};
