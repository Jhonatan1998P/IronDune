
import React, { useState, useEffect, useCallback, MutableRefObject, useRef } from 'react';
import { GameState, GameStatus, OfflineReport } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { sanitizeAndMigrateSave } from '../utils/engine/migration';
import { calculateOfflineProgress } from '../utils/engine/offline';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { encodeSaveData, decodeSaveData } from '../utils/engine/security';
import { LOCAL_SAVE_INTERVAL_MS, CLOUD_SAVE_INTERVAL_MS } from '../constants';
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
  const { user } = useAuth();
  const [hasSave, setHasSave] = useState(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  
  // Refs para evitar dependencias cambiantes
  const gameStateRef = useRef(gameState);
  const statusRef = useRef(status);
  gameStateRef.current = gameState;
  statusRef.current = status;

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

  const startNewGame = useCallback(() => {
    const metadata = user?.user_metadata;
    const playerName = metadata?.username || INITIAL_GAME_STATE.playerName;
    const playerFlag = metadata?.flag || INITIAL_GAME_STATE.playerFlag;

    setGameState({ 
      ...INITIAL_GAME_STATE, 
      playerName,
      playerFlag,
      lastSaveTime: TimeSyncService.getServerTime() 
    });
    setOfflineReport(null);
    setHasNewReports(false);
    lastTickRef.current = TimeSyncService.getServerTime();
    setStatus('PLAYING');
  }, [setGameState, setOfflineReport, setHasNewReports, lastTickRef, setStatus, user]);

  // Check for save on Supabase when user is available
  useEffect(() => {
    if (!user || isInitialLoadDone) return;

    const checkSave = async () => {
      try {
        // 1. Fetch from Cloud (Master Authority)
        const { data: cloudData, error: cloudError } = await supabase
          .from('profiles')
          .select('game_state')
          .eq('id', user.id)
          .single();

        if (cloudError && cloudError.code !== 'PGRST116') {
          console.error('Error fetching save from Supabase:', cloudError);
          return;
        }

        // 2. Fetch from Local (Faster/Backup)
        const localRaw = localStorage.getItem('ironDuneSave');
        const localState = localRaw ? decodeSaveData(localRaw) : null;

        let authoritativeState = null;

        if (cloudData?.game_state) {
          authoritativeState = cloudData.game_state;
          console.log('[Persistence] Cloud save found (Authority).');
          
          if (localState) {
              const cloudTime = authoritativeState.lastSaveTime || 0;
              const localTime = localState.lastSaveTime || 0;
              
              // If local is newer AND valid (already checked by decode), use it
              if (localTime > cloudTime) {
                  console.log('[Persistence] Local save is more recent and valid. Syncing...');
                  authoritativeState = localState;
              }
          }
        } else if (localState) {
          console.log('[Persistence] No cloud save, using valid local state.');
          authoritativeState = localState;
        }

        if (authoritativeState) {
          setHasSave(true);
          loadGameFromData(authoritativeState);
        } else {
          console.log('[Persistence] No valid saves found. Starting new game.');
          startNewGame();
        }
      } catch (e) {
        console.error('Persistence check failed:', e);
      } finally {
        setIsInitialLoadDone(true);
      }
    };

    checkSave();
  }, [user, isInitialLoadDone, loadGameFromData, startNewGame]);

  const lastLocalSaveRef = useRef(TimeSyncService.getServerTime());
  const lastCloudSaveRef = useRef(TimeSyncService.getServerTime());
  const pendingSaveRef = useRef(false);

  const performAutoSave = useCallback(async (force: boolean = false) => {
      if (!user) return;
      const now = TimeSyncService.getServerTime();
      const currentState = gameStateRef.current;
      const stateToSave = { ...currentState, lastSaveTime: now };

      // 1. QUICK LOCAL SAVE (Every 10s)
      if (force || now - lastLocalSaveRef.current >= LOCAL_SAVE_INTERVAL_MS) {
          try {
              const signedData = encodeSaveData(stateToSave);
              localStorage.setItem('ironDuneSave', signedData);
              lastLocalSaveRef.current = now;
              // console.log('[Persistence] Quick-save (local) secured.');
          } catch (e) {
              console.error('Local save failed:', e);
          }
      }

      // 2. MASTER CLOUD SAVE (Every 2 min)
      if (force || now - lastCloudSaveRef.current >= CLOUD_SAVE_INTERVAL_MS) {
          if (pendingSaveRef.current) return;
          pendingSaveRef.current = true;

          try {
              const { error } = await supabase
                .from('profiles')
                .upsert({
                  id: user.id,
                  game_state: stateToSave,
                  updated_at: new Date().toISOString()
                });

              if (error) throw error;
              
              setHasSave(true);
              lastCloudSaveRef.current = now;
              console.log('[Persistence] Master-save (cloud) verified.');
          } catch (e) {
              console.error('Cloud save failed:', e);
          } finally {
              pendingSaveRef.current = false;
          }
      }
  }, [user]);

  const saveGame = useCallback(async () => {
      if (!user) return;
      console.log('[SaveGame] Manual Forced Sync Initiated...');
      await performAutoSave(true);
      setStatus('MENU');
  }, [performAutoSave, setStatus, user]);

  const resetGame = useCallback(async () => {
      if (!user) return;
      
      try {
        await supabase.from('profiles').delete().eq('id', user.id);
        setHasSave(false);
      } catch (e) {
        console.error('Reset failed:', e);
      }

      setTimeout(() => {
          window.location.reload();
      }, 50);
  }, [user]);

  return { hasSave, startNewGame, loadGame: () => {}, saveGame, exportSave: () => {}, importSave: () => false, resetGame, performAutoSave };
};