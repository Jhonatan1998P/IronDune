
import React, { useState, useEffect, useCallback, MutableRefObject, useRef } from 'react';
import { GameState, GameStatus, OfflineReport } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { sanitizeAndMigrateSave } from '../utils/engine/migration';
import { calculateOfflineProgress } from '../utils/engine/offline';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const AUTO_SAVE_INTERVAL_MS = 30000; // 30 seconds

export const usePersistence = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  status: GameStatus,
  setStatus: React.Dispatch<React.SetStateAction<GameStatus>>,
  setOfflineReport: React.Dispatch<React.SetStateAction<OfflineReport | null>>,
  setHasNewReports: (has: boolean) => void,
  lastTickRef: MutableRefObject<number>,
  isLoopRunningRef?: MutableRefObject<boolean>,
  animationFrameRef?: MutableRefObject<number | undefined>
) => {
  const { user } = useAuth();
  const [hasSave, setHasSave] = useState(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  
  // Refs para evitar dependencias cambiantes
  const gameStateRef = useRef(gameState);
  const statusRef = useRef(status);
  gameStateRef.current = gameState;
  statusRef.current = status;

  // Check for save on Supabase when user is available
  useEffect(() => {
    if (!user || isInitialLoadDone) return;

    const checkSave = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('game_state')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching save from Supabase:', error);
          return;
        }

        if (data?.game_state) {
          console.log('[Persistence] Save found in Supabase');
          setHasSave(true);
          loadGameFromData(data.game_state);
        } else {
          console.log('[Persistence] No save found in Supabase for this user');
          // Try to migrate from localStorage if exists
          const localSave = localStorage.getItem('ironDuneSave');
          if (localSave) {
            console.log('[Persistence] Local save found, migrating to Supabase...');
            const parsed = JSON.parse(localSave);
            loadGameFromData(parsed);
          } else {
            console.log('[Persistence] No save found in Supabase for this user. Starting new game.');
            startNewGame();
          }
        }
      } catch (e) {
        console.error('Persistence check failed:', e);
      } finally {
        setIsInitialLoadDone(true);
      }
    };

    checkSave();
  }, [user, isInitialLoadDone]);

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

      lastTickRef.current = Date.now();
      setStatus('PLAYING');
    } catch (e) {
      console.error("Failed to load save:", e);
      setStatus('MENU');
    }
  }, [setGameState, setOfflineReport, setHasNewReports, lastTickRef, setStatus]);

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

  const startNewGame = useCallback(() => {
    const metadata = user?.user_metadata;
    const playerName = metadata?.username || INITIAL_GAME_STATE.playerName;
    const playerFlag = metadata?.flag || INITIAL_GAME_STATE.playerFlag;

    setGameState({ 
      ...INITIAL_GAME_STATE, 
      playerName,
      playerFlag,
      lastSaveTime: Date.now() 
    });
    setOfflineReport(null);
    setHasNewReports(false);
    lastTickRef.current = Date.now();
    setStatus('PLAYING');
  }, [setGameState, setOfflineReport, setHasNewReports, lastTickRef, setStatus, user]);

  const saveGame = useCallback(async () => {
      if (!user) return;

      console.log('[SaveGame] === INICIANDO GUARDADO EN SUPABASE ===');
      
      // 1. DETENER EXPLÍCITAMENTE EL GAME LOOP
      if (isLoopRunningRef) {
          isLoopRunningRef.current = false;
      }
      
      if (animationFrameRef && animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = undefined;
      }
      
      const now = Date.now();
      const currentState = gameStateRef.current;
      const stateToSave = { 
          ...currentState, 
          lastSaveTime: now 
      };

      try {
          const { error } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              game_state: stateToSave,
              updated_at: new Date().toISOString()
            });

          if (error) throw error;
          
          console.log('[SaveGame] ✓ Estado guardado en Supabase');
          setHasSave(true);
          
          // Also clear local storage as we migrated
          localStorage.removeItem('ironDuneSave');
      } catch (e) {
          console.error('[SaveGame] ERROR al guardar en Supabase:', e);
      }

      setStatus('MENU');
  }, [user, setStatus, setHasSave, isLoopRunningRef, animationFrameRef]);

  const lastSaveTimeRef = React.useRef(Date.now());
  const pendingSaveRef = useRef(false);

  const performAutoSave = useCallback(async (force: boolean = false) => {
      if (!user) return;
      const now = Date.now();
      
      if (!force && now - lastSaveTimeRef.current < AUTO_SAVE_INTERVAL_MS) return;
      if (pendingSaveRef.current) return;
      
      pendingSaveRef.current = true;
      lastSaveTimeRef.current = now;

      try {
        const stateToSave = { ...gameStateRef.current, lastSaveTime: now };
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            game_state: stateToSave,
            updated_at: new Date().toISOString()
          });
        setHasSave(true);
        console.log('[Persistence] Background save completed' + (force ? ' (FORCED)' : ''));
      } catch (e) {
        console.error('Auto-save failed:', e);
      } finally {
        pendingSaveRef.current = false;
      }
  }, [user]);

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