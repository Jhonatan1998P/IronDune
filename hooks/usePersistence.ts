
import React, { useState, useEffect, useCallback, MutableRefObject, useRef } from 'react';
import { GameState, GameStatus, OfflineReport } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { calculateOfflineProgress } from '../utils/engine/offline';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { CLOUD_SAVE_INTERVAL_MS, OFFLINE_SIGNOUT_THRESHOLD_MS } from '../constants';
import { TimeSyncService } from '../lib/timeSync';
import { io, Socket } from 'socket.io-client';
import { BACKEND_ORIGIN, buildBackendUrl, SOCKET_IO_PATH } from '../lib/backend';
import { createTraceId, normalizeError, shortId } from '../lib/diagnosticLogger';

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

  merged.rankingData = {
    ...INITIAL_GAME_STATE.rankingData,
    ...(input?.rankingData || {}),
    bots: Array.isArray(input?.rankingData?.bots)
      ? input.rankingData.bots
      : INITIAL_GAME_STATE.rankingData.bots,
  };

  return merged;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const BOOTSTRAP_RETRY_DELAYS_MS = [700, 1500, 3000] as const;
const MULTI_TAB_SYNC_INTERVAL_MS = 30000;
const MULTI_TAB_MIN_SYNC_GAP_MS = 1200;
const MULTI_TAB_FOCUS_RESYNC_STALE_MS = 15000;
const RECENT_BOOTSTRAP_SUPPRESS_SYNC_MS = 8000;
const SERVER_MUTATION_SYNC_STORAGE_KEY = 'ido.serverMutationSync.v1';
const SERVER_MUTATION_SYNC_CHANNEL = 'ido.serverMutationSync.channel.v1';
const USER_STATE_CHANGED_EVENT = 'user_state_changed';

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
  const lastBootstrapSuccessAtRef = useRef(0);

  useEffect(() => {
    setIsInitialLoadDone(false);
    setHasSave(false);
    setBootstrapLoadStatus(INITIAL_BOOTSTRAP_LOAD_STATUS);
    initialCheckStartedRef.current = false;
    cloudUpdatedAtRef.current = null;
    lastBootstrapSuccessAtRef.current = 0;
  }, [user?.id]);

  const getAuthHeaders = useCallback(() => {
    const token = session?.access_token;
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [session]);

  const fetchBootstrapSnapshot = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return null;

    const traceId = createTraceId('persist-bootstrap-v2');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(buildBackendUrl('/api/bootstrap'), { headers, signal: controller.signal });
    } catch (error) {
      const timeoutError = makeBootstrapError('Bootstrap request timeout', {
        errorCode: 'BOOTSTRAP_TIMEOUT',
        retryable: true,
      });
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw timeoutError;
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }

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
            lastBootstrapSuccessAtRef.current = Date.now();
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
    let socketSubscribed = false;
    let syncInFlight: Promise<void> | null = null;
    let lastSyncStartedAt = 0;

    const canSkipForRevision = (revision: number | null | undefined) => {
      if (!Number.isFinite(Number(revision))) return false;
      const incoming = Number(revision || 0);
      const localRevision = Number(gameStateRef.current?.revision || 0);
      return incoming <= localRevision;
    };

    const runSync = async () => {
      const bootstrapPayload = await fetchBootstrapSnapshot();
      lastBootstrapSuccessAtRef.current = Date.now();
      const serverState = bootstrapPayload?.state || null;
      if (!serverState || cancelled) return;

      const localState = gameStateRef.current;
      const localRevision = Number(localState?.revision || 0);
      const serverRevision = Number(serverState?.revision || 0);
      if (bootstrapPayload?.updatedAt) {
        cloudUpdatedAtRef.current = bootstrapPayload.updatedAt;
      }

      if (!Number.isFinite(serverRevision) || serverRevision <= localRevision || cancelled) {
        return;
      }

      setGameState(hydrateGameState(serverState as Partial<GameState>));
      lastTickRef.current = TimeSyncService.getServerTime();
    };

    const requestSync = (options?: { reason?: string; force?: boolean; expectedRevision?: number | null }) => {
      if (cancelled) return;

      const reason = options?.reason || 'unknown';
      const force = options?.force === true;
      const expectedRevision = options?.expectedRevision;
      const recentBootstrap = (Date.now() - lastBootstrapSuccessAtRef.current) < RECENT_BOOTSTRAP_SUPPRESS_SYNC_MS;

      if (!force && canSkipForRevision(expectedRevision)) {
        return;
      }

      if (force && recentBootstrap && (reason === 'initial' || reason === 'socket_subscribed')) {
        return;
      }

      if (!force && reason === 'poll' && socketSubscribed) {
        return;
      }

      const now = Date.now();
      if (!force && (now - lastSyncStartedAt) < MULTI_TAB_MIN_SYNC_GAP_MS) {
        return;
      }

      if (syncInFlight) {
        return;
      }

      lastSyncStartedAt = now;
      syncInFlight = runSync()
        .catch((error) => {
          console.warn('[Persistence] Multi-tab sync skipped due to transient error', {
            userId: shortId(user?.id),
            reason,
            error: normalizeError(error),
          });
        })
        .finally(() => {
          syncInFlight = null;
        });
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      requestSync({ reason: 'poll' });
    }, MULTI_TAB_SYNC_INTERVAL_MS);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      const staleMs = Date.now() - lastSyncStartedAt;
      const force = staleMs >= MULTI_TAB_FOCUS_RESYNC_STALE_MS;
      requestSync({ reason: 'focus', force });
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== SERVER_MUTATION_SYNC_STORAGE_KEY || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue) as { userId?: string | null; revision?: number };
        if (payload?.userId && payload.userId !== user.id) return;
        requestSync({ reason: 'storage', expectedRevision: Number(payload?.revision || 0) });
      } catch {
        // Ignore malformed payloads
      }
    };

    let channel: BroadcastChannel | null = null;
    let socket: Socket | null = null;
    const onChannelMessage = (event: MessageEvent) => {
      const payload = event?.data as { userId?: string | null; revision?: number } | null;
      if (payload?.userId && payload.userId !== user.id) return;
      requestSync({ reason: 'broadcast', expectedRevision: Number(payload?.revision || 0) });
    };

    try {
      channel = new BroadcastChannel(SERVER_MUTATION_SYNC_CHANNEL);
      channel.addEventListener('message', onChannelMessage);
    } catch {
      channel = null;
    }

    try {
      const socketOptions = {
        path: SOCKET_IO_PATH,
        transports: ['websocket'],
        timeout: 8000,
      };
      socket = BACKEND_ORIGIN ? io(BACKEND_ORIGIN, socketOptions) : io(socketOptions);

      socket.on('connect', () => {
        socketSubscribed = false;
        socket?.emit('subscribe_user_state', { token: session.access_token });
      });

      socket.on('user_state_subscription', (payload: { ok?: boolean; errorCode?: string }) => {
        if (payload?.ok) {
          socketSubscribed = true;
          requestSync({ reason: 'socket_subscribed', force: true });
          return;
        }
        socketSubscribed = false;
        if (payload?.errorCode) {
          console.warn('[Persistence] Realtime state subscription failed', {
            userId: shortId(user?.id),
            errorCode: payload.errorCode,
          });
        }
      });

      socket.on(USER_STATE_CHANGED_EVENT, (payload: { userId?: string | null; revision?: number; reason?: string }) => {
        if (payload?.userId && payload.userId !== user.id) return;
        requestSync({ reason: 'socket_push', expectedRevision: Number(payload?.revision || 0) });
      });

      socket.on('reconnect', () => {
        socketSubscribed = false;
        socket?.emit('subscribe_user_state', { token: session.access_token });
      });

      socket.on('disconnect', () => {
        socketSubscribed = false;
      });

      socket.on('connect_error', () => {
        socketSubscribed = false;
      });
    } catch (error) {
      console.warn('[Persistence] Realtime socket unavailable; polling fallback active', {
        userId: shortId(user?.id),
        error: normalizeError(error),
      });
      socket = null;
    }

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    requestSync({ reason: 'initial', force: true });

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      if (channel) {
        channel.removeEventListener('message', onChannelMessage);
        channel.close();
      }
      if (socket) {
        socket.off(USER_STATE_CHANGED_EVENT);
        socket.off('user_state_subscription');
        socket.off('reconnect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('connect');
        socket.disconnect();
      }
    };
  }, [fetchBootstrapSnapshot, lastTickRef, session, setGameState, status, user]);

  const lastCloudSaveRef = useRef(TimeSyncService.getServerTime());

  const performAutoSave = useCallback(async (_force: boolean = false) => {
      if (!user) return;

      const now = TimeSyncService.getServerTime();
      if (now - lastCloudSaveRef.current < CLOUD_SAVE_INTERVAL_MS) return;

      setHasSave(true);
      lastCloudSaveRef.current = now;
  }, [user]);

  const saveGame = useCallback(async () => {
      setStatus('MENU');
  }, [setStatus]);

  const resetGame = useCallback(async () => {
      if (!user) return;
      setTimeout(() => {
          window.location.reload();
      }, 50);
  }, [user]);

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
