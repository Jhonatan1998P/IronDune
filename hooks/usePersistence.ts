
import React, { useState, useEffect, useCallback, MutableRefObject, useRef } from 'react';
import { GameState, GameStatus, OfflineReport } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { calculateOfflineProgress } from '../utils/engine/offline';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { CLOUD_SAVE_INTERVAL_MS, OFFLINE_SIGNOUT_THRESHOLD_MS } from '../constants';
import { TimeSyncService } from '../lib/timeSync';
import { buildBackendUrl, DISABLE_LEGACY_SAVE_BLOB } from '../lib/backend';
import { createTraceId, normalizeError, shortId } from '../lib/diagnosticLogger';

const stripServerManagedFields = (state: GameState): GameState => {
  const sanitized = { ...state } as Partial<GameState>;
  delete sanitized.resources;
  delete sanitized.maxResources;
  delete sanitized.bankBalance;
  delete sanitized.currentInterestRate;
  delete sanitized.nextRateChangeTime;
  delete sanitized.lastInterestPayoutTime;
  return sanitized as GameState;
};

const hydrateGameState = (input: Partial<GameState> | null | undefined): GameState => {
  const merged = {
    ...INITIAL_GAME_STATE,
    ...(input || {}),
  } as GameState;

  merged.resources = {
    ...INITIAL_GAME_STATE.resources,
    ...(input?.resources || {}),
  };

  merged.maxResources = {
    ...INITIAL_GAME_STATE.maxResources,
    ...(input?.maxResources || {}),
  };

  merged.buildings = {
    ...INITIAL_GAME_STATE.buildings,
    ...(input?.buildings || {}),
  };

  merged.units = {
    ...INITIAL_GAME_STATE.units,
    ...(input?.units || {}),
  };

  merged.logs = Array.isArray(input?.logs) ? input.logs : INITIAL_GAME_STATE.logs;
  merged.activeMissions = Array.isArray(input?.activeMissions) ? input.activeMissions : INITIAL_GAME_STATE.activeMissions;
  merged.activeRecruitments = Array.isArray(input?.activeRecruitments) ? input.activeRecruitments : INITIAL_GAME_STATE.activeRecruitments;
  merged.activeConstructions = Array.isArray(input?.activeConstructions) ? input.activeConstructions : INITIAL_GAME_STATE.activeConstructions;
  merged.incomingAttacks = Array.isArray(input?.incomingAttacks) ? input.incomingAttacks : INITIAL_GAME_STATE.incomingAttacks;
  merged.spyReports = Array.isArray(input?.spyReports) ? input.spyReports : INITIAL_GAME_STATE.spyReports;
  merged.redeemedGiftCodes = Array.isArray(input?.redeemedGiftCodes) ? input.redeemedGiftCodes : INITIAL_GAME_STATE.redeemedGiftCodes;
  merged.researchedTechs = Array.isArray(input?.researchedTechs) ? input.researchedTechs : INITIAL_GAME_STATE.researchedTechs;

  merged.giftCodeCooldowns = {
    ...INITIAL_GAME_STATE.giftCodeCooldowns,
    ...(input?.giftCodeCooldowns || {}),
  };

  merged.diplomaticActions = {
    ...INITIAL_GAME_STATE.diplomaticActions,
    ...(input?.diplomaticActions || {}),
  };

  return merged;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const BOOTSTRAP_RETRY_DELAYS_MS = [700, 1500, 3000] as const;
const MULTI_TAB_SYNC_INTERVAL_MS = 8000;

type BootstrapLoadStatus = {
  attempt: number;
  maxAttempts: number;
  nextRetryAt: number | null;
  retryable: boolean;
  blocked: boolean;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

const INITIAL_BOOTSTRAP_LOAD_STATUS: BootstrapLoadStatus = {
  attempt: 0,
  maxAttempts: BOOTSTRAP_RETRY_DELAYS_MS.length,
  nextRetryAt: null,
  retryable: false,
  blocked: false,
  lastErrorCode: null,
  lastErrorMessage: null,
};

type BootstrapLoadError = Error & {
  errorCode?: string;
  retryable?: boolean;
  status?: number;
};

const makeBootstrapError = (message: string, options?: { errorCode?: string; retryable?: boolean; status?: number }): BootstrapLoadError => {
  const error = new Error(message) as BootstrapLoadError;
  if (options?.errorCode) error.errorCode = options.errorCode;
  if (options?.retryable !== undefined) error.retryable = options.retryable;
  if (options?.status !== undefined) error.status = options.status;
  return error;
};

const isTransientBootstrapError = (error: unknown): boolean => {
  const typed = error as BootstrapLoadError;
  if (typed?.retryable === true) return true;

  const message = error instanceof Error ? error.message : String(error || '');
  if (!message) return false;
  return (
    message.includes('Failed to fetch')
    || message.includes('NetworkError')
    || message.includes('timeout')
    || message.includes('503')
    || message.includes('502')
    || message.includes('500')
  );
};

export const usePersistence = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  status: GameStatus,
  setStatus: React.Dispatch<React.SetStateAction<GameStatus>>,
  setOfflineReport: React.Dispatch<React.SetStateAction<OfflineReport | null>>,
  setHasNewReports: (has: boolean) => void,
  lastTickRef: MutableRefObject<number>
) => {
  const { user, session, signOut } = useAuth();
  const [hasSave, setHasSave] = useState(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [bootstrapLoadStatus, setBootstrapLoadStatus] = useState<BootstrapLoadStatus>(INITIAL_BOOTSTRAP_LOAD_STATUS);
  const initialCheckStartedRef = useRef(false);
  
  // Refs para evitar dependencias cambiantes
  const gameStateRef = useRef(gameState);
  const statusRef = useRef(status);
  gameStateRef.current = gameState;
  statusRef.current = status;
  const cloudUpdatedAtRef = useRef<string | null>(null);

  useEffect(() => {
    setIsInitialLoadDone(false);
    setHasSave(false);
    setBootstrapLoadStatus(INITIAL_BOOTSTRAP_LOAD_STATUS);
    initialCheckStartedRef.current = false;
    cloudUpdatedAtRef.current = null;
  }, [user?.id]);

  const getAuthHeaders = useCallback(() => {
    const token = session?.access_token;
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [session]);

  const fetchCloudProfile = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return null;

    const traceId = createTraceId('persist-load');
    const startedAt = performance.now();
    console.log('[Persistence] Load profile started', {
      traceId,
      userId: shortId(user?.id),
    });

    const response = await fetch(buildBackendUrl('/api/profile'), { headers });
    if (response.status === 401) {
      console.warn('[Persistence] Load profile unauthorized', {
        traceId,
        userId: shortId(user?.id),
      });
      await signOut();
      return null;
    }
    if (response.status === 404) {
      console.log('[Persistence] Load profile no save found', {
        traceId,
        userId: shortId(user?.id),
        elapsedMs: Math.round(performance.now() - startedAt),
      });
      return null;
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to load cloud profile');
    }

    const payload = await response.json().catch(() => null);
    console.log('[Persistence] Load profile succeeded', {
      traceId,
      userId: shortId(user?.id),
      hasState: Boolean(payload?.game_state),
      updatedAt: payload?.updated_at || null,
      elapsedMs: Math.round(performance.now() - startedAt),
    });

    return {
      state: payload?.game_state || null,
      updatedAt: payload?.updated_at || null
    };
  }, [getAuthHeaders, signOut, user?.id]);

  const fetchBootstrapSnapshot = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return null;

    const traceId = createTraceId('persist-bootstrap-v2');
    const response = await fetch(buildBackendUrl('/api/bootstrap'), { headers });

    if (response.status === 401) {
      await signOut();
      throw makeBootstrapError('Unauthorized', {
        errorCode: 'BOOTSTRAP_UNAUTHORIZED',
        retryable: false,
        status: 401,
      });
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw makeBootstrapError(payload?.error || 'Failed to load bootstrap', {
        errorCode: payload?.errorCode,
        retryable: Boolean(payload?.retryable),
        status: response.status,
      });
    }

    const payload = await response.json().catch(() => null);
    console.log('[Persistence] Bootstrap payload loaded', {
      traceId,
      userId: shortId(user?.id),
      revision: payload?.metadata?.revision ?? null,
      resetId: payload?.metadata?.resetId ?? null,
      updatedAt: payload?.updated_at ?? null,
    });

    return {
      state: payload?.game_state || null,
      updatedAt: payload?.updated_at || null,
      resetId: payload?.metadata?.resetId || null,
    };
  }, [getAuthHeaders, signOut, user?.id]);

  const saveCloudProfile = useCallback(async (state: GameState, keepalive: boolean = false) => {
    if (DISABLE_LEGACY_SAVE_BLOB) {
      console.log('[Persistence] Legacy profile blob save skipped by feature flag', {
        userId: shortId(user?.id),
      });
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) throw new Error('Missing auth token');

    const traceId = createTraceId('persist-save');
    const startedAt = performance.now();
    console.log('[Persistence] Save profile started', {
      traceId,
      userId: shortId(user?.id),
      keepalive,
      expectedUpdatedAt: cloudUpdatedAtRef.current,
      clientLastSaveTime: state.lastSaveTime,
    });

    const response = await fetch(buildBackendUrl('/api/profile/save'), {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      keepalive,
      body: JSON.stringify({
        game_state: stripServerManagedFields(state),
        expected_updated_at: cloudUpdatedAtRef.current
      })
    });

    if (response.status === 401) {
      console.warn('[Persistence] Save profile unauthorized', {
        traceId,
        userId: shortId(user?.id),
      });
      await signOut();
      throw new Error('Unauthorized');
    }
    if (response.status === 409) {
      console.warn('[Persistence] Save profile conflict', {
        traceId,
        userId: shortId(user?.id),
      });
      throw new Error('Conflict');
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to save cloud profile');
    }
    const payload = await response.json().catch(() => null);
    if (payload?.updated_at) {
      cloudUpdatedAtRef.current = payload.updated_at;
    }
    console.log('[Persistence] Save profile succeeded', {
      traceId,
      userId: shortId(user?.id),
      updatedAt: payload?.updated_at || null,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
  }, [getAuthHeaders, signOut, user?.id]);

  const resetCloudProfile = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('Missing auth token');

    const response = await fetch(buildBackendUrl('/api/profile/reset'), {
      method: 'POST',
      headers
    });

    if (response.status === 401) {
      await signOut();
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to reset cloud profile');
    }
  }, [getAuthHeaders, signOut]);

  // Sync peerId from P2P to gameState
  useEffect(() => {
    const handlePeerIdChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ peerId: string }>;
      if (customEvent.detail?.peerId) {
        setGameState(prev => ({
          ...prev,
          peerId: customEvent.detail.peerId
        }));
      }
    };

    window.addEventListener('p2p-peer-id-changed', handlePeerIdChange);
    return () => window.removeEventListener('p2p-peer-id-changed', handlePeerIdChange);
  }, [setGameState]);

  const loadGameFromData = useCallback((saveData: any) => {
    try {
      console.log('[LoadGame] Processing save data...');

      const hydratedState = hydrateGameState(saveData as Partial<GameState>);
      const { newState, report, newLogs } = calculateOfflineProgress(hydratedState);

      if (newLogs.length > 0) {
          newState.logs = [...newLogs, ...newState.logs].slice(0, 100);
          setHasNewReports(true);
      }

      setGameState(newState);

      if (report.timeElapsed > 60000) {
          setOfflineReport(report);
      }

      lastTickRef.current = TimeSyncService.getServerTime();
      setStatus('HYDRATED');
      setStatus('PLAYING');
    } catch (e) {
      console.error("Failed to load save:", e);
      setStatus('MENU');
    }
  }, [setGameState, setOfflineReport, setHasNewReports, lastTickRef, setStatus]);

  const startNewGame = useCallback(async () => {
    const metadata = user?.user_metadata;
    const playerName = metadata?.username || INITIAL_GAME_STATE.playerName;
    const playerFlag = metadata?.flag || INITIAL_GAME_STATE.playerFlag;

    // Obtener ResetID actual para la nueva partida
    const { data: metaData } = await supabase
      .from('server_metadata')
      .select('value')
      .eq('key', 'last_reset_id')
      .single();

    setGameState({ 
      ...INITIAL_GAME_STATE, 
      playerName,
      playerFlag,
      lastResetId: metaData?.value,
      lastSaveTime: TimeSyncService.getServerTime() 
    });
    setOfflineReport(null);
    setHasNewReports(false);
    lastTickRef.current = TimeSyncService.getServerTime();
    setStatus('HYDRATED');
    setStatus('PLAYING');
  }, [setGameState, setOfflineReport, setHasNewReports, lastTickRef, setStatus, user]);

  // Check for save on Supabase when user is available
  useEffect(() => {
    if (!user || !session || isInitialLoadDone || initialCheckStartedRef.current) return;

    const checkSave = async () => {
      initialCheckStartedRef.current = true;
      const traceId = createTraceId('persist-bootstrap');
      try {
        setStatus('AUTHENTICATING');
        console.log('[Persistence] Initial check started', {
          traceId,
          userId: shortId(user?.id),
          hasSession: Boolean(session),
        });

        setStatus('SYNCING_TIME');
        await TimeSyncService.sync();

        setStatus('LOADING_BOOTSTRAP');
        setBootstrapLoadStatus(INITIAL_BOOTSTRAP_LOAD_STATUS);
        let bootstrapPayload = null;
        let bootstrapError: unknown = null;

        for (let attempt = 1; attempt <= BOOTSTRAP_RETRY_DELAYS_MS.length; attempt += 1) {
          try {
            bootstrapPayload = await fetchBootstrapSnapshot();
            bootstrapError = null;
            setBootstrapLoadStatus((prev) => ({
              ...prev,
              attempt,
              nextRetryAt: null,
              retryable: false,
              blocked: false,
              lastErrorCode: null,
              lastErrorMessage: null,
            }));
            break;
          } catch (error) {
            bootstrapError = error;
            const typedError = error as BootstrapLoadError;
            const retryable = isTransientBootstrapError(error);
            const nextRetryDelay = BOOTSTRAP_RETRY_DELAYS_MS[attempt] || null;
            const exhaustedAttempts = attempt === BOOTSTRAP_RETRY_DELAYS_MS.length;

            setBootstrapLoadStatus((prev) => ({
              ...prev,
              attempt,
              retryable,
              nextRetryAt: retryable && !exhaustedAttempts && nextRetryDelay ? Date.now() + nextRetryDelay : null,
              blocked: !retryable || exhaustedAttempts,
              lastErrorCode: typedError?.errorCode || null,
              lastErrorMessage: error instanceof Error ? error.message : String(error || 'unknown'),
            }));

            if (!retryable || exhaustedAttempts) {
              throw error;
            }

            console.warn('[Persistence] Transient bootstrap failure, retrying', {
              traceId,
              attempt,
              userId: shortId(user?.id),
              error: normalizeError(error),
            });
            await sleep(nextRetryDelay);
          }
        }

        if (!bootstrapPayload && bootstrapError) {
          throw bootstrapError;
        }

        const cloudState = bootstrapPayload?.state || null;
        const serverResetId = bootstrapPayload?.resetId || null;
        console.log('[Persistence] Initial check reset metadata', {
          traceId,
          serverResetId,
        });
        if (bootstrapPayload?.updatedAt) {
          cloudUpdatedAtRef.current = bootstrapPayload.updatedAt;
        }

        let authoritativeState = null;

        if (cloudState) {
          authoritativeState = cloudState;
          
          // Ensure cloud state is also in sync with reset (should be, but for safety)
          if (serverResetId && authoritativeState.lastResetId !== serverResetId) {
             console.warn('[Persistence] Cloud state is from a previous reset. Ignoring.');
             authoritativeState = null;
           }
        }

        if (authoritativeState) {
          const now = TimeSyncService.getServerTime();
          const lastSaveTime = authoritativeState.lastSaveTime || 0;
          const offlineMs = lastSaveTime ? now - lastSaveTime : null;
          console.log('[Persistence] Initial check cloud state found', {
            traceId,
            lastSaveTime,
            offlineMs,
            lastResetId: authoritativeState.lastResetId || null,
          });
          if (lastSaveTime && now - lastSaveTime > OFFLINE_SIGNOUT_THRESHOLD_MS) {
            console.warn('[Persistence] Offline threshold exceeded. Signing out user.');
            await signOut();
            return;
          }

          // Si el estado no tiene el ResetID, se lo ponemos (primera carga tras reset)
          if (serverResetId && !authoritativeState.lastResetId) {
              authoritativeState.lastResetId = serverResetId;
          }
          setHasSave(true);
          loadGameFromData(authoritativeState);
          setBootstrapLoadStatus(INITIAL_BOOTSTRAP_LOAD_STATUS);
        } else {
          console.log('[Persistence] No valid saves found. Starting new game.');
          // Iniciamos partida nueva con el ResetID actual
          const metadata = user?.user_metadata;
          const playerName = metadata?.username || INITIAL_GAME_STATE.playerName;
          const playerFlag = metadata?.flag || INITIAL_GAME_STATE.playerFlag;

          setGameState({ 
            ...INITIAL_GAME_STATE, 
            playerName,
            playerFlag,
            lastResetId: serverResetId,
            lastSaveTime: TimeSyncService.getServerTime() 
          });
          setStatus('HYDRATED');
          setStatus('PLAYING');
          setBootstrapLoadStatus(INITIAL_BOOTSTRAP_LOAD_STATUS);
        }
      } catch (e) {
        console.error('[Persistence] Initial check failed', {
          traceId,
          userId: shortId(user?.id),
          error: normalizeError(e),
        });

        const typedError = e as BootstrapLoadError;
        const message = e instanceof Error ? e.message : String(e || 'unknown');
        const isUnauthorized = message.includes('Unauthorized');
        const retryable = typedError?.retryable === true || isTransientBootstrapError(e);
        setBootstrapLoadStatus((prev) => ({
          ...prev,
          retryable,
          blocked: true,
          nextRetryAt: null,
          lastErrorCode: typedError?.errorCode || null,
          lastErrorMessage: message,
        }));
        setStatus('MENU');
        setOfflineReport(null);
        setHasNewReports(false);
        console.warn('[Persistence] Bootstrap failed; gameplay blocked until next successful bootstrap', {
          traceId,
          userId: shortId(user?.id),
          blockedBy: isUnauthorized ? 'unauthorized' : 'transient_or_terminal_error',
          retryable: typedError?.retryable === true,
          errorCode: typedError?.errorCode || null,
        });
      } finally {
        setIsInitialLoadDone(true);
        initialCheckStartedRef.current = false;
      }
    };

    checkSave();
  }, [
    user,
    session,
    isInitialLoadDone,
    loadGameFromData,
    fetchCloudProfile,
    fetchBootstrapSnapshot,
    signOut,
    setGameState,
    setStatus,
    setOfflineReport,
    setHasNewReports,
  ]);

  useEffect(() => {
    if (!user || !session || status !== 'PLAYING') return;

    let cancelled = false;
    let syncing = false;

    const syncAuthoritativeSnapshot = async () => {
      if (syncing || cancelled) return;
      syncing = true;
      try {
        const bootstrapPayload = await fetchBootstrapSnapshot();
        const serverState = bootstrapPayload?.state || null;
        if (!serverState) return;

        const localState = gameStateRef.current;
        const localRevision = Number(localState?.revision || 0);
        const serverRevision = Number(serverState?.revision || 0);
        const updatedAtChanged = Boolean(
          bootstrapPayload?.updatedAt
          && bootstrapPayload.updatedAt !== cloudUpdatedAtRef.current
        );

        if (bootstrapPayload?.updatedAt) {
          cloudUpdatedAtRef.current = bootstrapPayload.updatedAt;
        }

        const shouldApply = serverRevision > localRevision || (updatedAtChanged && serverRevision >= localRevision);
        if (!shouldApply || cancelled) return;

        setGameState(hydrateGameState(serverState as Partial<GameState>));
        lastTickRef.current = TimeSyncService.getServerTime();
      } catch (error) {
        console.warn('[Persistence] Multi-tab sync skipped due to transient error', {
          userId: shortId(user?.id),
          error: normalizeError(error),
        });
      } finally {
        syncing = false;
      }
    };

    const intervalId = window.setInterval(syncAuthoritativeSnapshot, MULTI_TAB_SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [fetchBootstrapSnapshot, lastTickRef, session, setGameState, status, user]);

  const lastCloudSaveRef = useRef(TimeSyncService.getServerTime());
  const pendingSaveRef = useRef(false);

  const performAutoSave = useCallback(async (_force: boolean = false) => {
      if (!user) return;

      if (DISABLE_LEGACY_SAVE_BLOB) {
        setHasSave(true);
        lastCloudSaveRef.current = TimeSyncService.getServerTime();
        return;
      }

      const now = TimeSyncService.getServerTime();
      const currentState = gameStateRef.current;
      const stateToSave = { ...currentState, lastSaveTime: now };

      if (now - lastCloudSaveRef.current >= CLOUD_SAVE_INTERVAL_MS) {
          if (pendingSaveRef.current) return;
          pendingSaveRef.current = true;

          try {
              await saveCloudProfile(stateToSave);
              
              setHasSave(true);
              lastCloudSaveRef.current = now;
              console.log('[Persistence] Master-save (cloud) verified.');
              } catch (e) {
                if (e instanceof Error && e.message === 'Conflict') {
                try {
                  const cloudPayload = await fetchCloudProfile();
                  const cloudState = cloudPayload?.state || null;
                  if (cloudPayload?.updatedAt) {
                    cloudUpdatedAtRef.current = cloudPayload.updatedAt;
                  }
                  if (cloudState) {
                    const hydratedCloud = hydrateGameState(cloudState as Partial<GameState>);
                    const retryState: GameState = {
                      ...stateToSave,
                      resources: hydratedCloud.resources,
                      maxResources: hydratedCloud.maxResources,
                      bankBalance: hydratedCloud.bankBalance,
                      currentInterestRate: hydratedCloud.currentInterestRate,
                      nextRateChangeTime: hydratedCloud.nextRateChangeTime,
                      lastInterestPayoutTime: hydratedCloud.lastInterestPayoutTime,
                    };

                    await saveCloudProfile(retryState);
                    setHasSave(true);
                    lastCloudSaveRef.current = now;
                    console.warn('[Persistence] Conflict resolved by retrying save with fresh server revision.');
                  }
                } catch (syncError) {
                  console.error('[Persistence] Conflict resolution failed', {
                    userId: shortId(user?.id),
                    error: normalizeError(syncError),
                  });
                }
              } else {
                console.error('[Persistence] Cloud save failed', {
                  userId: shortId(user?.id),
                  error: normalizeError(e),
                });
              }
          } finally {
              pendingSaveRef.current = false;
          }
      }
  }, [user, saveCloudProfile, fetchCloudProfile, loadGameFromData]);

  const saveGame = useCallback(async () => {
      setStatus('MENU');
  }, [setStatus]);

  const resetGame = useCallback(async () => {
      if (!user) return;
      
      try {
        await resetCloudProfile();
        setHasSave(false);
      } catch (e) {
        console.error('Reset failed:', e);
      }

      setTimeout(() => {
          window.location.reload();
      }, 50);
  }, [user, resetCloudProfile]);

  return {
    hasSave,
    bootstrapLoadStatus,
    startNewGame,
    loadGame: () => {},
    saveGame,
    exportSave: () => {},
    importSave: () => false,
    resetGame,
    performAutoSave,
  };
};
