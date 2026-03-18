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
}) => {
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
      const profileState = {
        ...(profile.gameState || {}),
        ...(normalizedPatch || {}),
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

      if (runAuthoritativeLifecycle) {
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
      const nextState = {
        ...workingState,
        revision: nextRevision,
        lastSaveTime: serverTime,
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
      const stateToPersist = stripCriticalDomainFromBlob
        ? stripCriticalDomainFromBlob(nextState)
        : nextState;
      const { error: saveError } = await supabase.from('profiles').upsert({
        id: req.user.id,
        game_state: stateToPersist,
        updated_at: updatedAt,
      });

      if (saveError) throw saveError;

      const normalizedSync = await syncNormalizedDomain(req.user.id, nextState, traceId);
      if (!normalizedSync.ok && normalizedSync.warning) {
        diagnostics.push(normalizedSync.warning);
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
      if (isLikelyUuid(req.body?.commandId)) {
        const failedPayload = {
          ok: false,
          error: error.message || 'Failed to process command',
          errorCode: 'COMMAND_FAILED',
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
        errorCode: 'COMMAND_FAILED',
        extra: {
          error: normalizeServerError(error),
          commandType: req.body?.type || null,
        },
      });

      observeCommandEvent({
        type: req.body?.type,
        result: 'failed',
        errorCode: 'COMMAND_FAILED',
        durationMs: Date.now() - commandStartedAt,
      });

      return res.status(500).json({
        ok: false,
        error: error.message || 'Failed to process command',
        errorCode: 'COMMAND_FAILED',
        traceId,
      });
    }
  };

  return {
    handleCommand,
  };
};
