
import React, { useState, useEffect, useCallback, MutableRefObject, useRef } from 'react';
import { GameState, GameStatus, OfflineReport } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { sanitizeAndMigrateSave } from '../utils/engine/migration';
import { calculateOfflineProgress } from '../utils/engine/offline';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { decodeSaveData } from '../utils/engine/security';
import { CLOUD_SAVE_INTERVAL_MS } from '../constants';
import { TimeSyncService } from '../lib/timeSync';

export const usePersistence = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  status: GameStatus,
  setStatus: React.Dispatch<React.SetStateAction<GameStatus>>,
  setOfflineReport: React.Dispatch<React.SetStateAction<OfflineReport | null>>,
  setHasNewReports: (has: boolean) => void,
  lastTickRef: MutableRefObject<number>
) => {
  const { user, session } = useAuth();
  const [hasSave, setHasSave] = useState(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  
  // Refs para evitar dependencias cambiantes
  const gameStateRef = useRef(gameState);
  const statusRef = useRef(status);
  gameStateRef.current = gameState;
  statusRef.current = status;

  const getAuthHeaders = useCallback(() => {
    const token = session?.access_token;
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [session]);

  const fetchCloudProfile = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return null;

    const response = await fetch('/api/profile', { headers });
    if (response.status === 404) return null;
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to load cloud profile');
    }

    const payload = await response.json().catch(() => null);
    return payload?.game_state || null;
  }, [getAuthHeaders]);

  const saveCloudProfile = useCallback(async (state: GameState) => {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('Missing auth token');

    const response = await fetch('/api/profile/save', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ game_state: state })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to save cloud profile');
    }
  }, [getAuthHeaders]);

  const resetCloudProfile = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('Missing auth token');

    const response = await fetch('/api/profile/reset', {
      method: 'POST',
      headers
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to reset cloud profile');
    }
  }, [getAuthHeaders]);

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
      
      const migratedState = sanitizeAndMigrateSave(saveData, saveData);
      
      const { newState, report, newLogs } = calculateOfflineProgress(migratedState);

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
    if (!user || !session || isInitialLoadDone) return;

    const checkSave = async () => {
      try {
        // 0. Check for Server Reset
        const { data: metaData } = await supabase
          .from('server_metadata')
          .select('value')
          .eq('key', 'last_reset_id')
          .single();
        
        const serverResetId = metaData?.value;

        // 1. Fetch from Cloud (Master Authority)
        let cloudState = await fetchCloudProfile();

        // 2. Fetch from Local (migration only)
        const localRaw = localStorage.getItem('ironDuneSave');
        let localState = localRaw ? decodeSaveData(localRaw) : null;
        const hadLocalSave = !!localRaw;

        // --- ANTI-RACE CONDITION LOGIC (SERVER RESET) ---
        // If the server has been reset, but the client has an old local save
        if (serverResetId && localState && localState.lastResetId !== serverResetId) {
            console.warn('[Persistence] Server Reset detected. Local save is obsolete.');
            localStorage.removeItem('ironDuneSave');
            localState = null;
        }

        let authoritativeState = null;

        if (cloudState) {
          authoritativeState = cloudState;
          
          // Ensure cloud state is also in sync with reset (should be, but for safety)
          if (serverResetId && authoritativeState.lastResetId !== serverResetId) {
             console.warn('[Persistence] Cloud state is from a previous reset. Ignoring.');
             authoritativeState = null;
          }

          if (authoritativeState && localState) {
              const cloudTime = authoritativeState.lastSaveTime || 0;
              const localTime = localState.lastSaveTime || 0;
              
              if (localTime > cloudTime) {
                  console.log('[Persistence] Local save is more recent. Syncing...');
                  authoritativeState = localState;
              }
          }
        } else if (localState) {
          console.log('[Persistence] No cloud save, using valid local state.');
          authoritativeState = localState;
        }

        if (authoritativeState) {
          // Si el estado no tiene el ResetID, se lo ponemos (primera carga tras reset)
          if (serverResetId && !authoritativeState.lastResetId) {
              authoritativeState.lastResetId = serverResetId;
          }
          setHasSave(true);
          loadGameFromData(authoritativeState);

          if (localState) {
            try {
              await saveCloudProfile(authoritativeState);
            } catch (error) {
              console.error('Cloud save failed during migration:', error);
            } finally {
              localStorage.removeItem('ironDuneSave');
            }
          } else if (hadLocalSave) {
            localStorage.removeItem('ironDuneSave');
          }
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
        console.error('Persistence check failed:', e);
      } finally {
        setIsInitialLoadDone(true);
      }
    };

    checkSave();
  }, [user, session, isInitialLoadDone, loadGameFromData, fetchCloudProfile, saveCloudProfile, startNewGame]);

  const lastCloudSaveRef = useRef(TimeSyncService.getServerTime());
  const pendingSaveRef = useRef(false);

  const performAutoSave = useCallback(async (force: boolean = false) => {
      if (!user) return;
      const now = TimeSyncService.getServerTime();
      const currentState = gameStateRef.current;
      const stateToSave = { ...currentState, lastSaveTime: now };

      // MASTER CLOUD SAVE (Every 2 min)
      if (force || now - lastCloudSaveRef.current >= CLOUD_SAVE_INTERVAL_MS) {
          if (pendingSaveRef.current) return;
          pendingSaveRef.current = true;

          try {
              await saveCloudProfile(stateToSave);
              
              setHasSave(true);
              lastCloudSaveRef.current = now;
              console.log('[Persistence] Master-save (cloud) verified.');
          } catch (e) {
              console.error('Cloud save failed:', e);
          } finally {
              pendingSaveRef.current = false;
          }
      }
  }, [user, saveCloudProfile]);

  const saveGame = useCallback(async () => {
      if (!user) return;
      console.log('[SaveGame] Manual Forced Sync Initiated...');
      await performAutoSave(true);
      setStatus('MENU');
  }, [performAutoSave, setStatus, user]);

  const resetGame = useCallback(async () => {
      if (!user) return;
      
      try {
        await resetCloudProfile();
        setHasSave(false);
      } catch (e) {
        console.error('Reset failed:', e);
      }

      setTimeout(() => {
          localStorage.removeItem('ironDuneSave');
          window.location.reload();
      }, 50);
  }, [user, resetCloudProfile]);

  return { hasSave, startNewGame, loadGame: () => {}, saveGame, exportSave: () => {}, importSave: () => false, resetGame, performAutoSave };
};
