export const createCommandService = ({
  makeTraceId,
  shortId,
  observeCommandEvent,
  isLikelyUuid,
  COMMAND_TYPES,
  validateCommandPayload,
  isNonNullObject,
  loadCommandById,
  supabase,
  parseRevision,
  getOrCreateProfileState,
  sanitizeStatePatch,
  normalizeLifecycleState,
  resolveLifecycleCompletions,
  AUTHORITATIVE_QUEUE_COMMANDS,
  AUTHORITATIVE_SPEEDUP_TYPES,
  buildAuthoritativeCommandResult,
  buildAuthoritativeTutorialCommandResult,
  validateResourceDeduction,
  addResources,
  getOrCreatePlayerResources,
  ResourceType,
  syncNormalizedDomain,
  buildServerStatePatch,
  emitUserStateChanged,
  normalizeServerError,
  patchAllowList,
  normalizedReadsEnabled,
  loadNormalizedStatePatch,
  stripCriticalDomainFromBlob,
  logWithSchema,
  calculateEmpirePointsBreakdown,
}) => {
  const LOG_STALE_NORMALIZED_PATCH = process.env.LOG_STALE_NORMALIZED_PATCH === 'true';

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

  const hasNormalizedDomainChanges = (beforeState, afterState) => NORMALIZED_DOMAIN_STATE_KEYS.some((key) => (
    JSON.stringify(beforeState?.[key]) !== JSON.stringify(afterState?.[key])
  ));

  const isTransientCommandError = (error) => {
    const message = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();

    return (
      code === '57014'
      || message.includes('upstream request timeout')
      || message.includes('temporarily unavailable')
      || message.includes('cloudflare')
      || message.includes('timeout')
      || message.includes('fetch failed')
      || message.includes('network')
      || message.includes('econnreset')
    );
  };

  const handleCommand = async (req, res) => {
    const traceId = req.traceId || makeTraceId('command');
    const serverTime = Date.now();
    const commandStartedAt = Date.now();

    try {
      const commandId = req.body?.commandId;
      const type = req.body?.type;
      let payload = isNonNullObject(req.body?.payload) ? req.body.payload : {};
      const expectedRevision = req.body?.expectedRevision;

      if (!isLikelyUuid(commandId)) {
        observeCommandEvent({ type, result: 'bad_request', errorCode: 'INVALID_COMMAND_ID', durationMs: Date.now() - commandStartedAt });
        return res.status(400).json({
          ok: false,
          error: 'Invalid commandId',
          errorCode: 'INVALID_COMMAND_ID',
          traceId,
        });
      }

      if (!COMMAND_TYPES.has(type)) {
        observeCommandEvent({ type, result: 'bad_request', errorCode: 'UNSUPPORTED_COMMAND_TYPE', durationMs: Date.now() - commandStartedAt });
        return res.status(400).json({
          ok: false,
          error: 'Unsupported command type',
          errorCode: 'UNSUPPORTED_COMMAND_TYPE',
          traceId,
        });
      }

      if (!Number.isFinite(Number(expectedRevision))) {
        observeCommandEvent({ type, result: 'bad_request', errorCode: 'INVALID_EXPECTED_REVISION', durationMs: Date.now() - commandStartedAt });
        return res.status(400).json({
          ok: false,
          error: 'Invalid expectedRevision',
          errorCode: 'INVALID_EXPECTED_REVISION',
          traceId,
        });
      }

      const payloadValidation = validateCommandPayload(type, payload);
      if (!payloadValidation.ok) {
        observeCommandEvent({ type, result: 'bad_request', errorCode: payloadValidation.errorCode, durationMs: Date.now() - commandStartedAt });
        return res.status(400).json({
          ok: false,
          error: payloadValidation.message,
          errorCode: payloadValidation.errorCode,
          traceId,
        });
      }
      payload = payloadValidation.payload || payload;

      const previousResponse = await loadCommandById(req.user.id, commandId);
      if (previousResponse && Object.keys(previousResponse).length > 0) {
        observeCommandEvent({
          type,
          result: previousResponse.ok ? 'success' : 'failed',
          errorCode: previousResponse.errorCode || null,
          durationMs: Date.now() - commandStartedAt,
          idempotentReplay: true,
        });
        return res.json(previousResponse);
      }

      const { error: commandReservationError } = await supabase
        .from('player_commands')
        .insert({
          player_id: req.user.id,
          command_id: commandId,
          command_type: type,
          expected_revision: parseRevision(expectedRevision),
          payload,
          response_payload: {},
        });

      if (commandReservationError) {
        if (commandReservationError.code === '23505') {
          const racedResponse = await loadCommandById(req.user.id, commandId);
          if (racedResponse && Object.keys(racedResponse).length > 0) {
            observeCommandEvent({
              type,
              result: racedResponse.ok ? 'success' : 'failed',
              errorCode: racedResponse.errorCode || null,
              durationMs: Date.now() - commandStartedAt,
              idempotentReplay: true,
            });
            return res.json(racedResponse);
          }
          observeCommandEvent({
            type,
            result: 'conflict',
            errorCode: 'COMMAND_IN_PROGRESS',
            durationMs: Date.now() - commandStartedAt,
            inProgressCollision: true,
          });
          return res.status(409).json({
            ok: false,
            error: 'Command already in progress',
            errorCode: 'COMMAND_IN_PROGRESS',
            traceId,
          });
        }
        throw commandReservationError;
      }

      const expectedRevisionNumber = parseRevision(expectedRevision);
      const { data: revisionReservations, error: revisionReservationError } = await supabase
        .from('player_commands')
        .select('id, command_id, created_at')
        .eq('player_id', req.user.id)
        .eq('expected_revision', expectedRevisionNumber)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(2);

      if (revisionReservationError) {
        throw revisionReservationError;
      }

      const winnerReservation = Array.isArray(revisionReservations) ? revisionReservations[0] : null;
      if (winnerReservation && winnerReservation.command_id !== commandId) {
        const conflictPayload = {
          ok: false,
          error: 'Another command already claimed this revision',
          errorCode: 'REVISION_SLOT_TAKEN',
          retryable: false,
          traceId,
        };

        await supabase
          .from('player_commands')
          .update({ response_payload: conflictPayload })
          .eq('player_id', req.user.id)
          .eq('command_id', commandId);

        observeCommandEvent({
          type,
          result: 'conflict',
          errorCode: 'REVISION_SLOT_TAKEN',
          durationMs: Date.now() - commandStartedAt,
          inProgressCollision: true,
        });

        return res.status(409).json(conflictPayload);
      }

      const profile = await getOrCreateProfileState(req.user);
      const normalizedPatch = normalizedReadsEnabled
        ? await loadNormalizedStatePatch(req.user.id).catch((error) => {
          logWithSchema('warn', '[CommandGateway] Falling back to profile blob read', {
            traceId,
            userId: shortId(req.user.id),
            commandId,
            expectedRevision: parseRevision(expectedRevision),
            errorCode: 'NORMALIZED_READ_FALLBACK',
            extra: {
              commandType: type,
              error: normalizeServerError(error),
            },
          });
          return null;
        })
        : null;

      const blobLastSaveTime = Number(profile.gameState?.lastSaveTime || 0);
      const normalizedLastSaveTime = Number(normalizedPatch?.lastSaveTime || 0);
      const normalizedRepairsBlobGap = hasCriticalCoverageGap(profile.gameState || {}, normalizedPatch || {});
      const shouldUseNormalizedPatch = isNonNullObject(normalizedPatch)
        && (normalizedLastSaveTime >= blobLastSaveTime || normalizedRepairsBlobGap);

      if (LOG_STALE_NORMALIZED_PATCH && isNonNullObject(normalizedPatch) && !shouldUseNormalizedPatch) {
        logWithSchema('warn', '[CommandGateway] Ignoring stale normalized state patch', {
          traceId,
          userId: shortId(req.user.id),
          commandId,
          expectedRevision: parseRevision(expectedRevision),
          errorCode: 'NORMALIZED_PATCH_STALE',
          extra: {
            commandType: type,
            blobLastSaveTime,
            normalizedLastSaveTime,
          },
        });
      }

      if (isNonNullObject(normalizedPatch) && shouldUseNormalizedPatch && normalizedLastSaveTime < blobLastSaveTime && normalizedRepairsBlobGap) {
        logWithSchema('warn', '[CommandGateway] Using stale normalized patch to repair blob critical gap', {
          traceId,
          userId: shortId(req.user.id),
          commandId,
          expectedRevision: parseRevision(expectedRevision),
          errorCode: 'NORMALIZED_PATCH_CRITICAL_GAP_RECOVERY',
          extra: {
            commandType: type,
            blobLastSaveTime,
            normalizedLastSaveTime,
          },
        });
      }

      const profileState = {
        ...(profile.gameState || {}),
        ...(shouldUseNormalizedPatch ? normalizedPatch : {}),
      };
      const currentRevision = parseRevision(profileState?.revision);
      const nextRevision = currentRevision + 1;

      if (currentRevision !== parseRevision(expectedRevision)) {
        logWithSchema('warn', '[CommandGateway] Revision mismatch', {
          traceId,
          userId: shortId(req.user.id),
          commandId,
          expectedRevision: parseRevision(expectedRevision),
          newRevision: currentRevision,
          errorCode: 'REVISION_MISMATCH',
          extra: {
            commandType: type,
          },
        });
        observeCommandEvent({
          type,
          result: 'conflict',
          errorCode: 'REVISION_MISMATCH',
          durationMs: Date.now() - commandStartedAt,
          revisionMismatch: true,
        });
        return res.status(409).json({
          ok: false,
          error: 'Revision mismatch',
          errorCode: 'REVISION_MISMATCH',
          expectedRevision: parseRevision(expectedRevision),
          currentRevision,
          traceId,
        });
      }

      const rawCosts = isNonNullObject(payload.costs) ? payload.costs : {};
      const rawGains = isNonNullObject(payload.gains) ? payload.gains : {};
      const requestedStatePatch = sanitizeStatePatch(payload.statePatch, patchAllowList);
      const diagnostics = [];

      const originalState = normalizeLifecycleState(profileState || {});
      const lifecycleState = resolveLifecycleCompletions(originalState, serverTime).state;
      let workingState = lifecycleState;
      let costs = rawCosts;
      let gains = rawGains;

      const speedupType = isNonNullObject(payload.action) ? payload.action.type : null;
      const runAuthoritativeLifecycle = AUTHORITATIVE_QUEUE_COMMANDS.has(type)
        || (type === 'SPEEDUP' && AUTHORITATIVE_SPEEDUP_TYPES.has(speedupType));

      const tutorialAuthoritativeResult = buildAuthoritativeTutorialCommandResult(type, lifecycleState, payload.action);

      if (tutorialAuthoritativeResult.handled) {
        if (!tutorialAuthoritativeResult.ok) {
          observeCommandEvent({
            type,
            result: 'bad_request',
            errorCode: tutorialAuthoritativeResult.errorCode || 'INVALID_COMMAND_ACTION',
            durationMs: Date.now() - commandStartedAt,
          });
          return res.status(tutorialAuthoritativeResult.status || 400).json({
            ok: false,
            error: tutorialAuthoritativeResult.error || 'Invalid command action',
            errorCode: tutorialAuthoritativeResult.errorCode || 'INVALID_COMMAND_ACTION',
            traceId,
          });
        }
        workingState = tutorialAuthoritativeResult.nextState;
        costs = tutorialAuthoritativeResult.costs || {};
        gains = tutorialAuthoritativeResult.gains || {};
      } else if (runAuthoritativeLifecycle) {
        const authoritativeResult = buildAuthoritativeCommandResult(type, lifecycleState, payload.action, serverTime);
        if (!authoritativeResult.ok) {
          observeCommandEvent({
            type,
            result: 'bad_request',
            errorCode: authoritativeResult.errorCode || 'INVALID_COMMAND_ACTION',
            durationMs: Date.now() - commandStartedAt,
          });
          return res.status(authoritativeResult.status || 400).json({
            ok: false,
            error: authoritativeResult.error || 'Invalid command action',
            errorCode: authoritativeResult.errorCode || 'INVALID_COMMAND_ACTION',
            traceId,
          });
        }
        workingState = authoritativeResult.nextState;
        costs = authoritativeResult.costs || {};
        gains = authoritativeResult.gains || {};
      } else {
        workingState = {
          ...lifecycleState,
          ...requestedStatePatch,
        };
      }

      if (Object.keys(costs).length > 0) {
        const deduction = await validateResourceDeduction(req.user.id, costs);
        if (!deduction.ok) {
          observeCommandEvent({
            type,
            result: 'bad_request',
            errorCode: 'INSUFFICIENT_FUNDS',
            durationMs: Date.now() - commandStartedAt,
          });
          return res.status(400).json({
            ok: false,
            error: deduction.reason || 'insufficient_funds',
            errorCode: 'INSUFFICIENT_FUNDS',
            resource: deduction.resource || null,
            traceId,
          });
        }
      }

      if (Object.keys(gains).length > 0) {
        const addition = await addResources(req.user.id, gains);
        if (!addition.ok) {
          observeCommandEvent({
            type,
            result: 'bad_request',
            errorCode: 'RESOURCE_ADD_FAILED',
            durationMs: Date.now() - commandStartedAt,
          });
          return res.status(400).json({
            ok: false,
            error: addition.reason || 'add_failed',
            errorCode: 'RESOURCE_ADD_FAILED',
            traceId,
          });
        }
      }

      const authoritativeResources = await getOrCreatePlayerResources(req.user.id);
      const progression = calculateEmpirePointsBreakdown(workingState);

      const nextState = {
        ...workingState,
        revision: nextRevision,
        lastSaveTime: serverTime,
        empirePoints: progression.empirePoints,
        rankingStats: {
          ...(isNonNullObject(workingState.rankingStats) ? workingState.rankingStats : {}),
          DOMINION: progression.empirePoints,
          MILITARY: progression.militaryScore,
          ECONOMY: progression.economyScore,
          CAMPAIGN: progression.campaignScore,
        },
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

      const updatedAt = new Date(serverTime).toISOString();
      const { error: saveError } = await supabase.from('profiles').upsert({
        id: req.user.id,
        game_state: nextState,
        updated_at: updatedAt,
      });

      if (saveError) throw saveError;

      const shouldSyncNormalizedDomain = hasNormalizedDomainChanges(originalState, nextState);
      const normalizedSync = shouldSyncNormalizedDomain
        ? await syncNormalizedDomain(req.user.id, nextState, traceId)
        : { ok: true, skipped: true };
      if (!normalizedSync.ok && normalizedSync.warning) {
        diagnostics.push(normalizedSync.warning);
      }

      if (normalizedSync.ok && stripCriticalDomainFromBlob) {
        const frozenState = stripCriticalDomainFromBlob(nextState);
        const shouldFreeze = frozenState !== nextState;
        if (shouldFreeze) {
          const { error: freezeSaveError } = await supabase.from('profiles').upsert({
            id: req.user.id,
            game_state: frozenState,
            updated_at: updatedAt,
          });
          if (freezeSaveError) {
            throw freezeSaveError;
          }
        }
      }

      const responsePayload = {
        ok: true,
        newRevision: nextRevision,
        statePatch: buildServerStatePatch(originalState, nextState, patchAllowList),
        serverTime,
        diagnostics,
        traceId,
      };

      const { error: commandUpdateError } = await supabase
        .from('player_commands')
        .update({
          resulting_revision: nextRevision,
          response_payload: responsePayload,
        })
        .eq('player_id', req.user.id)
        .eq('command_id', commandId);

      if (commandUpdateError) {
        throw commandUpdateError;
      }

      logWithSchema('info', '[CommandGateway] Command processed', {
        traceId,
        userId: shortId(req.user.id),
        commandId,
        expectedRevision: parseRevision(expectedRevision),
        newRevision: nextRevision,
        extra: {
          commandType: type,
        },
      });

      observeCommandEvent({
        type,
        result: 'success',
        durationMs: Date.now() - commandStartedAt,
      });

      emitUserStateChanged(req.user.id, {
        revision: nextRevision,
        reason: 'COMMAND',
        commandType: type,
        commandId,
        traceId,
      });

      return res.json(responsePayload);
    } catch (error) {
      const isTransient = isTransientCommandError(error);
      const errorCode = isTransient ? 'COMMAND_TRANSIENT_ERROR' : 'COMMAND_FAILED';

      if (isLikelyUuid(req.body?.commandId)) {
        const failedPayload = {
          ok: false,
          error: error.message || 'Failed to process command',
          errorCode,
          retryable: isTransient,
          traceId,
        };

        await supabase
          .from('player_commands')
          .update({ response_payload: failedPayload })
          .eq('player_id', req.user.id)
          .eq('command_id', req.body.commandId);
      }

      logWithSchema('error', '[CommandGateway] Command failed', {
        traceId,
        userId: shortId(req.user?.id),
        commandId: req.body?.commandId || null,
        expectedRevision: parseRevision(req.body?.expectedRevision),
        errorCode,
        extra: {
          error: normalizeServerError(error),
          commandType: req.body?.type || null,
        },
      });

      observeCommandEvent({
        type: req.body?.type,
        result: 'failed',
        errorCode,
        durationMs: Date.now() - commandStartedAt,
      });

      return res.status(isTransient ? 503 : 500).json({
        ok: false,
        error: error.message || 'Failed to process command',
        errorCode,
        retryable: isTransient,
        traceId,
      });
    }
  };

  return {
    handleCommand,
  };
};
