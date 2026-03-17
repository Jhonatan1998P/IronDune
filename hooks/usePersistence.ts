
import React, { useState, useEffect, useCallback, MutableRefObject, useRef } from 'react';
import { GameState, GameStatus, OfflineReport } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { calculateOfflineProgress } from '../utils/engine/offline';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { CLOUD_SAVE_INTERVAL_MS, OFFLINE_SIGNOUT_THRESHOLD_MS } from '../constants';
import { TimeSyncService } from '../lib/timeSync';
import { buildBackendUrl } from '../lib/backend';
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

  return merged;
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

  const saveCloudProfile = useCallback(async (state: GameState, keepalive: boolean = false) => {
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
    setStatus('PLAYING');
  }, [setGameState, setOfflineReport, setHasNewReports, lastTickRef, setStatus, user]);

  // Check for save on Supabase when user is available
  useEffect(() => {
    if (!user || !session || isInitialLoadDone || initialCheckStartedRef.current) return;

    const checkSave = async () => {
      initialCheckStartedRef.current = true;
      const traceId = createTraceId('persist-bootstrap');
      try {
        console.log('[Persistence] Initial check started', {
          traceId,
          userId: shortId(user?.id),
          hasSession: Boolean(session),
        });

        // 0. Check for Server Reset
        const { data: metaData } = await supabase
          .from('server_metadata')
          .select('value')
          .eq('key', 'last_reset_id')
          .single();
        
        const serverResetId = metaData?.value;
        console.log('[Persistence] Initial check reset metadata', {
          traceId,
          serverResetId,
        });
        // 1. Fetch from Cloud (Master Authority)
        const cloudPayload = await fetchCloudProfile();
        const cloudState = cloudPayload?.state || null;
        if (cloudPayload?.updatedAt) {
          cloudUpdatedAtRef.current = cloudPayload.updatedAt;
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
          setStatus('PLAYING');
        }
      } catch (e) {
        console.error('[Persistence] Initial check failed', {
          traceId,
          userId: shortId(user?.id),
          error: normalizeError(e),
        });

        const metadata = user?.user_metadata;
        const playerName = metadata?.username || INITIAL_GAME_STATE.playerName;
        const playerFlag = metadata?.flag || INITIAL_GAME_STATE.playerFlag;
        setGameState({
          ...INITIAL_GAME_STATE,
          playerName,
          playerFlag,
          lastSaveTime: TimeSyncService.getServerTime(),
        });
        setStatus('PLAYING');
        setOfflineReport(null);
        setHasNewReports(false);
        console.warn('[Persistence] Falling back to local new game after bootstrap failure', {
          traceId,
          userId: shortId(user?.id),
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
    signOut,
    setGameState,
    setStatus,
    setOfflineReport,
    setHasNewReports,
  ]);

  const lastCloudSaveRef = useRef(TimeSyncService.getServerTime());
  const pendingSaveRef = useRef(false);

  const performAutoSave = useCallback(async (_force: boolean = false) => {
      if (!user) return;
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

  return { hasSave, startNewGame, loadGame: () => {}, saveGame, exportSave: () => {}, importSave: () => false, resetGame, performAutoSave };
};
