/**
 * usePersistence — Arquitectura de persistencia de Iron Dune (REFACTORED FOR AUTHORITY)
 * FUENTE DE VERDAD: Supabase (Servidor con Delta Calculation V3)
 */

import React, { useState, useEffect, useCallback, MutableRefObject, useRef } from 'react';
import { GameState, GameStatus, OfflineReport, BuildingType, ResourceType, TechType, UnitType } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { BUILDING_DEFS } from '../data/buildings';
import { sanitizeAndMigrateSave } from '../utils/engine/migration';
import { calculateOfflineProgress } from '../utils/engine/offline';
import { encodeSaveData, decodeSaveData } from '../utils/engine/security';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { socket } from '../lib/socket';

const BUFFER_WRITE_MS  = 10000;   // localStorage: cada 10s
const BUFFER_TO_SERVER_MS = 2 * 60 * 1000; // Supabase: cada 2 minutos (como pidió el usuario)
const BUFFER_KEY = 'ironDuneSave_v2';

const writeBuffer = (state: GameState): void => {
  try {
    const encoded = encodeSaveData({ ...state, lastSaveTime: Date.now() });
    if (encoded) localStorage.setItem(BUFFER_KEY, encoded);
  } catch { /* Buffer opcional */ }
};

const readBuffer = (): GameState | null => {
  try {
    const raw = localStorage.getItem(BUFFER_KEY) || localStorage.getItem('ironDuneSave');
    if (!raw) return null;
    return decodeSaveData(raw);
  } catch { return null; }
};

const clearBuffer = (): void => {
  localStorage.removeItem(BUFFER_KEY);
  localStorage.removeItem('ironDuneSave');
};

export const usePersistence = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  _status: GameStatus,
  setStatus: React.Dispatch<React.SetStateAction<GameStatus>>,
  setOfflineReport: React.Dispatch<React.SetStateAction<OfflineReport | null>>,
  setHasNewReports: (has: boolean) => void,
  lastTickRef: MutableRefObject<number>,
) => {
  const { user } = useAuth();
  const [hasSave, setHasSave] = useState(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const lastBufferWriteRef  = useRef(0);
  const lastServerSyncRef   = useRef(0);
  const pendingServerSyncRef = useRef(false);
  const prevUserIdRef        = useRef<string | null>(null);

  const applyLoadedState = useCallback((rawState: GameState, fromBuffer: boolean) => {
    try {
      const migrated = sanitizeAndMigrateSave(rawState, rawState);
      let finalState = migrated;

      if (fromBuffer && migrated.lastSaveTime && Date.now() - migrated.lastSaveTime > 60000) {
        const { newState, report } = calculateOfflineProgress(migrated);
        finalState = newState;
        if (report.timeElapsed > 60000) {
          setOfflineReport(report);
          setHasNewReports(true);
        }
      }

      setGameState(finalState);
      lastTickRef.current = Date.now();
      setStatus('PLAYING');
    } catch (e) {
      console.error('[Persistence] Error al aplicar estado:', e);
      setStatus('MENU');
    }
  }, [setGameState, setOfflineReport, setHasNewReports, lastTickRef, setStatus]);

  const loadFromServer = useCallback(async (userId: string): Promise<boolean> => {
    try {
      console.log('[Persistence] Cargando desde servidor (Autoridad)...');
      await supabase.rpc('sync_all_production_v3'); // Forzar cálculo delta al entrar

      const [profileRes, economyRes, buildingsRes, researchRes, unitsRes, cQueueRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('player_economy').select('*').eq('player_id', userId).single(),
        supabase.from('player_buildings').select('*').eq('player_id', userId),
        supabase.from('player_research').select('*').eq('player_id', userId),
        supabase.from('player_units').select('*').eq('player_id', userId),
        supabase.from('construction_queue').select('*').eq('player_id', userId),
      ]);

      if (profileRes.error) return false;

      const profile  = profileRes.data;
      const economy  = economyRes.data;
      const serverState: GameState = {
        ...INITIAL_GAME_STATE,
        ...profile.game_state,
        playerName: profile.username || 'Commander',
        empirePoints: Number(profile.empire_points || 0),
        lastSaveTime: new Date(profile.updated_at).getTime(),
      };

      if (economy) {
        serverState.resources = {
          [ResourceType.MONEY]: Number(economy.money || 0),
          [ResourceType.OIL]: Number(economy.oil || 0),
          [ResourceType.AMMO]: Number(economy.ammo || 0),
          [ResourceType.GOLD]: Number(economy.gold || 0),
          [ResourceType.DIAMOND]: Number(economy.diamond || 0),
        };
        serverState.bankBalance = Number(economy.bank_balance || 0);
      }

      buildingsRes.data?.forEach((b: any) => {
        const def = BUILDING_DEFS[b.building_type as BuildingType];
        serverState.buildings[b.building_type as BuildingType] = { 
            level: def?.buildMode === 'QUANTITY' ? (b.quantity || 0) : (b.level || 0), 
            isDamaged: false 
        };
      });

      researchRes.data?.forEach((r: any) => {
        serverState.techLevels[r.tech_type as TechType] = r.level;
      });

      unitsRes.data?.forEach((u: any) => {
        serverState.units[u.unit_type as UnitType] = Number(u.count);
      });

      serverState.activeConstructions = (cQueueRes.data || []).map((c: any) => ({
        id: c.id, buildingType: c.building_type as BuildingType, count: c.target_level,
        startTime: new Date(c.created_at).getTime(), endTime: Number(c.end_time)
      }));

      clearBuffer();
      setHasSave(true);
      applyLoadedState(serverState, false);
      return true;
    } catch (e) {
      console.error('[Persistence] Error al cargar:', e);
      return false;
    }
  }, [applyLoadedState]);

  const syncWithServer = useCallback(async (state: GameState): Promise<void> => {
    if (!user || pendingServerSyncRef.current) return;
    pendingServerSyncRef.current = true;
    try {
      await supabase.from('profiles').upsert({
        id: user.id, username: state.playerName, empire_points: state.empirePoints,
        game_state: { 
            completedTutorials: state.completedTutorials,
            currentTutorialId: state.currentTutorialId,
            saveVersion: state.saveVersion 
        },
        updated_at: new Date().toISOString(),
      });

      await loadFromServer(user.id); // FETCH Authority
      lastServerSyncRef.current = Date.now();
    } catch (e) {
      console.error('[Persistence] Sync Error:', e);
    } finally {
      pendingServerSyncRef.current = false;
    }
  }, [user, loadFromServer]);

  const startNewGame = useCallback(async () => {
    const initialState: GameState = { ...INITIAL_GAME_STATE, lastSaveTime: Date.now() };
    setGameState(initialState);
    lastTickRef.current = Date.now();
    setStatus('PLAYING');
    if (user) {
      await supabase.from('profiles').upsert({ id: user.id, username: user.email?.split('@')[0] || 'Commander', updated_at: new Date().toISOString() });
    }
  }, [user, setGameState, lastTickRef, setStatus]);

  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (prevUserIdRef.current !== currentUserId) {
      prevUserIdRef.current = currentUserId;
      setIsInitialLoadDone(false);
      return;
    }
    if (isInitialLoadDone) return;
    const init = async () => {
      if (user) {
        const loaded = await loadFromServer(user.id);
        if (loaded) { setIsInitialLoadDone(true); return; }
      }
      const buffered = readBuffer();
      if (buffered) { setHasSave(true); applyLoadedState(buffered, true); setIsInitialLoadDone(true); return; }
      startNewGame(); 
    };
    init();
  }, [user, isInitialLoadDone, loadFromServer, applyLoadedState, startNewGame]);

  const performAutoSave = useCallback(async (force: boolean = false) => {
    const now = Date.now();
    if (force || now - lastBufferWriteRef.current >= BUFFER_WRITE_MS) {
      writeBuffer(gameStateRef.current);
      lastBufferWriteRef.current = now;
    }
    if (user && (force || now - lastServerSyncRef.current >= BUFFER_TO_SERVER_MS)) {
      await syncWithServer(gameStateRef.current);
    }
  }, [user, syncWithServer]);

  const saveGame = useCallback(async () => {
    if (user) await syncWithServer(gameStateRef.current);
    writeBuffer(gameStateRef.current);
    setHasSave(true);
    setStatus('MENU');
  }, [user, syncWithServer, setStatus]);

  const resetGame = useCallback(async () => {
    clearBuffer();
    if (user) await supabase.from('profiles').delete().eq('id', user.id);
    window.location.reload();
  }, [user]);

  useEffect(() => {
    const handleEngineSync = (data: { resources: any, serverTime: number }) => {
        setGameState(prev => ({
            ...prev,
            resources: {
                ...prev.resources,
                ...data.resources
            },
            lastSaveTime: data.serverTime
        }));
    };

    socket.on('engine_sync_update', handleEngineSync);
    return () => { socket.off('engine_sync_update', handleEngineSync); };
  }, [setGameState]);

  return { hasSave, startNewGame, loadGame: () => {}, saveGame, resetGame, performAutoSave };
};
