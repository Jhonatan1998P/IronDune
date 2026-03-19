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
  } = deps;

  const NORMALIZED_DOMAIN_STATE_KEYS = [
    'buildings',
    'units',
    'techLevels',
    'researchedTechs',
    'activeConstructions',
    'activeRecruitments',
    'activeResearch',
    'campaignProgress',
    'empirePoints',
  ];

  const hasCriticalCoverageGap = (blobState, normalizedPatch) => NORMALIZED_DOMAIN_STATE_KEYS.some((key) => (
    blobState?.[key] === undefined && normalizedPatch?.[key] !== undefined
  ));

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
        const blobLastSaveTime = Number(responseState?.lastSaveTime || 0);
        const normalizedLastSaveTime = Number(normalizedPatch?.lastSaveTime || 0);
        const normalizedRepairsBlobGap = hasCriticalCoverageGap(responseState || {}, normalizedPatch || {});
        const shouldUseNormalizedPatch = isNonNullObject(normalizedPatch)
          && (normalizedLastSaveTime >= blobLastSaveTime || normalizedRepairsBlobGap);

        if (!shouldUseNormalizedPatch && isNonNullObject(normalizedPatch)) {
          console.warn('[ProfileAPI] Ignoring stale normalized state patch', {
            traceId,
            userId: shortId(req.user.id),
            blobLastSaveTime,
            normalizedLastSaveTime,
          });
        }

        if (isNonNullObject(normalizedPatch) && shouldUseNormalizedPatch && normalizedLastSaveTime < blobLastSaveTime && normalizedRepairsBlobGap) {
          console.warn('[ProfileAPI] Using stale normalized patch to repair blob critical gap', {
            traceId,
            userId: shortId(req.user.id),
            blobLastSaveTime,
            normalizedLastSaveTime,
          });
        }

        responseState = shouldUseNormalizedPatch
          ? {
            ...responseState,
            ...normalizedPatch,
          }
          : responseState;
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
};
