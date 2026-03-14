import React, { useState, useEffect, useCallback, MutableRefObject, useRef } from 'react';
import { GameState, GameStatus, OfflineReport, BuildingType, ResourceType, TechType, UnitType } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { BUILDING_DEFS } from '../data/buildings';
import { sanitizeAndMigrateSave } from '../utils/engine/migration';
import { calculateOfflineProgress } from '../utils/engine/offline';
import { encodeSaveData, decodeSaveData } from '../utils/engine/security';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const AUTO_SAVE_LOCAL_MS = 30000;   // localStorage cada 30 seg
const AUTO_SAVE_SERVER_MS = 120000; // Supabase cada 2 min
const LOCAL_SAVE_KEY = 'ironDuneSave_v2';

// ── Helpers de módulo (no cambian entre renders) ──────────────────────────────

const saveToLocalStorage = (state: GameState): void => {
  try {
    const encoded = encodeSaveData({ ...state, lastSaveTime: Date.now() });
    if (encoded) localStorage.setItem(LOCAL_SAVE_KEY, encoded);
  } catch (e) {
    console.warn('[Persistence] localStorage write failed:', e);
  }
};

const loadFromLocalStorage = (): GameState | null => {
  try {
    const raw = localStorage.getItem(LOCAL_SAVE_KEY)
             || localStorage.getItem('ironDuneSave'); // clave legacy
    if (!raw) return null;
    return decodeSaveData(raw);
  } catch (e) {
    console.warn('[Persistence] localStorage read failed:', e);
    return null;
  }
};

// ── Hook principal ────────────────────────────────────────────────────────────

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

  // Refs estables para callbacks
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const lastLocalSaveRef = useRef(0);
  const lastServerSaveRef = useRef(0);
  const pendingServerSaveRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);

  // ── 1. Aplicar estado cargado (calcular offline si viene de local) ────────────
  const applyLoadedState = useCallback((rawState: GameState, calculateOffline: boolean) => {
    try {
      const migrated = sanitizeAndMigrateSave(rawState, rawState);
      let finalState = migrated;

      if (calculateOffline && migrated.lastSaveTime && Date.now() - migrated.lastSaveTime > 60000) {
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

  // ── 2. Cargar desde Supabase ──────────────────────────────────────────────────
  const loadFromSupabase = useCallback(async (userId: string): Promise<boolean> => {
    try {
      console.log('[Persistence] Consultando Supabase...');

      const [profileRes, economyRes, buildingsRes, researchRes, unitsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('player_economy').select('*').eq('player_id', userId).single(),
        supabase.from('player_buildings').select('*').eq('player_id', userId),
        supabase.from('player_research').select('*').eq('player_id', userId),
        supabase.from('player_units').select('*').eq('player_id', userId),
      ]);

      if (profileRes.error) {
        if (profileRes.error.code === 'PGRST116') {
          console.log('[Persistence] Sin perfil en Supabase, revisar localStorage.');
          return false;
        }
        console.error('[Persistence] Error al cargar perfil:', profileRes.error);
        return false;
      }

      const profile = profileRes.data;
      const economy = economyRes.data;
      const baseState = profile.game_state || {};

      const reconstructed: GameState = {
        ...INITIAL_GAME_STATE,
        ...baseState,
        playerName: profile.username || baseState.playerName || 'Commander',
        empirePoints: Number(profile.empire_points || 0),
        lastSaveTime: new Date(profile.updated_at).getTime(),
      };

      if (economy) {
        reconstructed.resources = {
          [ResourceType.MONEY]:   Number(economy.money   || 0),
          [ResourceType.OIL]:     Number(economy.oil     || 0),
          [ResourceType.AMMO]:    Number(economy.ammo    || 0),
          [ResourceType.GOLD]:    Number(economy.gold    || 0),
          [ResourceType.DIAMOND]: Number(economy.diamond || 0),
        };
        reconstructed.bankBalance = Number(economy.bank_balance || 0);
      }

      if (buildingsRes.data) {
        buildingsRes.data.forEach((b: any) => {
          const def = BUILDING_DEFS[b.building_type as BuildingType];
          const value = def?.buildMode === 'QUANTITY' ? (b.quantity || 0) : (b.level || 0);
          reconstructed.buildings[b.building_type as BuildingType] = { level: value, isDamaged: false };
        });
      }

      if (researchRes.data) {
        researchRes.data.forEach((r: any) => {
          reconstructed.techLevels[r.tech_type as TechType] = r.level;
          if (r.level > 0 && !reconstructed.researchedTechs.includes(r.tech_type)) {
            reconstructed.researchedTechs.push(r.tech_type);
          }
        });
      }

      if (unitsRes.data) {
        unitsRes.data.forEach((u: any) => {
          reconstructed.units[u.unit_type as UnitType] = Number(u.count);
        });
      }

      setHasSave(true);
      applyLoadedState(reconstructed, false);
      console.log('[Persistence] ✓ Estado cargado desde Supabase.');
      return true;
    } catch (e) {
      console.error('[Persistence] Error al cargar desde Supabase:', e);
      return false;
    }
  }, [applyLoadedState]);

  // ── 3. Carga inicial: detecta cambio de usuario y dispara la carga ────────────
  useEffect(() => {
    const currentUserId = user?.id ?? null;

    // Si el usuario cambió (login/logout), reiniciar la carga
    if (prevUserIdRef.current !== currentUserId) {
      prevUserIdRef.current = currentUserId;
      setIsInitialLoadDone(false);
      return;
    }

    if (isInitialLoadDone) return;

    const init = async () => {
      if (user) {
        const loaded = await loadFromSupabase(user.id);
        if (loaded) { setIsInitialLoadDone(true); return; }
      }

      const localData = loadFromLocalStorage();
      if (localData) {
        console.log('[Persistence] Cargando desde localStorage...');
        setHasSave(true);
        applyLoadedState(localData, true);
        setIsInitialLoadDone(true);
        return;
      }

      console.log('[Persistence] Sin guardado previo. Iniciando nuevo juego.');
      setIsInitialLoadDone(true);
    };

    init();
  }, [user, isInitialLoadDone, loadFromSupabase, applyLoadedState]);

  // ── 4. Sincronizar con Supabase ───────────────────────────────────────────────
  const syncToSupabase = useCallback(async (state: GameState): Promise<void> => {
    if (!user || pendingServerSaveRef.current) return;

    pendingServerSaveRef.current = true;
    const now = Date.now();

    try {
      await supabase.from('profiles').upsert({
        id: user.id,
        username: state.playerName,
        empire_points: state.empirePoints,
        game_state: {
          completedTutorials:  state.completedTutorials,
          currentTutorialId:   state.currentTutorialId,
          tutorialClaimable:   state.tutorialClaimable,
          tutorialAccepted:    state.tutorialAccepted,
          isTutorialMinimized: state.isTutorialMinimized,
          playerFlag:          state.playerFlag,
          saveVersion:         state.saveVersion,
        },
        updated_at: new Date(now).toISOString(),
      });

      await supabase.from('player_economy').upsert({
        player_id:    user.id,
        money:        state.resources[ResourceType.MONEY],
        oil:          state.resources[ResourceType.OIL],
        ammo:         state.resources[ResourceType.AMMO],
        gold:         state.resources[ResourceType.GOLD],
        diamond:      state.resources[ResourceType.DIAMOND],
        bank_balance: state.bankBalance,
        last_calc_time: now,
      });

      const buildingData = Object.entries(state.buildings).map(([type, b]) => {
        const isQty = BUILDING_DEFS[type as BuildingType]?.buildMode === 'QUANTITY';
        return { player_id: user.id, building_type: type, level: isQty ? 0 : b.level, quantity: isQty ? b.level : 0 };
      });
      if (buildingData.length > 0) await supabase.from('player_buildings').upsert(buildingData);

      const researchData = Object.entries(state.techLevels).map(([type, level]) => ({
        player_id: user.id, tech_type: type, level,
      }));
      if (researchData.length > 0) await supabase.from('player_research').upsert(researchData);

      const unitData = Object.entries(state.units).map(([type, count]) => ({
        player_id: user.id, unit_type: type, count,
      }));
      if (unitData.length > 0) await supabase.from('player_units').upsert(unitData);

      lastServerSaveRef.current = now;
      console.log('[Persistence] ✓ Sincronizado con Supabase.');
    } catch (e) {
      console.error('[Persistence] Error al sincronizar con Supabase:', e);
    } finally {
      pendingServerSaveRef.current = false;
    }
  }, [user]);

  // ── 5. Nuevo juego ────────────────────────────────────────────────────────────
  const startNewGame = useCallback(async () => {
    const initialState: GameState = { ...INITIAL_GAME_STATE, lastSaveTime: Date.now() };
    setGameState(initialState);
    setOfflineReport(null);
    setHasNewReports(false);
    lastTickRef.current = Date.now();
    setStatus('PLAYING');

    saveToLocalStorage(initialState);

    if (user) {
      try {
        const defaultName = user.email?.split('@')[0] || 'Commander';
        await supabase.from('profiles').upsert({
          id: user.id,
          username: defaultName,
          empire_points: 0,
          game_state: { saveVersion: initialState.saveVersion },
          updated_at: new Date().toISOString(),
        });
        await supabase.from('player_economy').upsert({
          player_id:      user.id,
          money:          initialState.resources[ResourceType.MONEY],
          oil:            initialState.resources[ResourceType.OIL],
          ammo:           initialState.resources[ResourceType.AMMO],
          gold:           0,
          diamond:        0,
          bank_balance:   0,
          last_calc_time: Date.now(),
        });
        console.log('[Persistence] ✓ Perfil inicial creado en Supabase.');
      } catch (e) {
        console.warn('[Persistence] No se pudo crear perfil (modo offline):', e);
      }
    }
  }, [user, setGameState, setOfflineReport, setHasNewReports, lastTickRef, setStatus]);

  // ── 6. Auto-guardado ──────────────────────────────────────────────────────────
  const performAutoSave = useCallback(async (force: boolean = false) => {
    const now = Date.now();
    const state = gameStateRef.current;

    // localStorage cada AUTO_SAVE_LOCAL_MS
    if (force || now - lastLocalSaveRef.current >= AUTO_SAVE_LOCAL_MS) {
      saveToLocalStorage(state);
      lastLocalSaveRef.current = now;
    }

    // Supabase cada AUTO_SAVE_SERVER_MS
    if (user && (force || now - lastServerSaveRef.current >= AUTO_SAVE_SERVER_MS)) {
      await syncToSupabase(state);
    }
  }, [user, syncToSupabase]);

  // ── 7. Guardado manual ────────────────────────────────────────────────────────
  const saveGame = useCallback(async () => {
    const state = gameStateRef.current;
    saveToLocalStorage(state);
    lastLocalSaveRef.current = Date.now();
    if (user) await syncToSupabase(state);
    setHasSave(true);
    setStatus('MENU');
  }, [user, syncToSupabase, setStatus]);

  // ── 8. Exportar / Importar ────────────────────────────────────────────────────
  const exportSave = useCallback(() => {
    try {
      const encoded = encodeSaveData(gameStateRef.current);
      const blob = new Blob([encoded], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `irondune_save_${Date.now()}.idb`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[Persistence] Error al exportar:', e);
    }
  }, []);

  const importSave = useCallback((encodedData: string): boolean => {
    try {
      const state = decodeSaveData(encodedData);
      if (!state) return false;
      applyLoadedState(state, true);
      setHasSave(true);
      return true;
    } catch (e) {
      console.error('[Persistence] Error al importar:', e);
      return false;
    }
  }, [applyLoadedState]);

  // ── 9. Reinicio ───────────────────────────────────────────────────────────────
  const resetGame = useCallback(async () => {
    localStorage.removeItem(LOCAL_SAVE_KEY);
    localStorage.removeItem('ironDuneSave');
    setHasSave(false);
    if (user) {
      try { await supabase.from('profiles').delete().eq('id', user.id); }
      catch (e) { console.error('[Persistence] Error al borrar perfil:', e); }
    }
    setTimeout(() => window.location.reload(), 50);
  }, [user]);

  // ── 10. Sync peerId P2P ───────────────────────────────────────────────────────
  useEffect(() => {
    const handle = (e: Event) => {
      const ev = e as CustomEvent<{ peerId: string }>;
      if (ev.detail?.peerId) setGameState(prev => ({ ...prev, peerId: ev.detail.peerId }));
    };
    window.addEventListener('p2p-peer-id-changed', handle);
    return () => window.removeEventListener('p2p-peer-id-changed', handle);
  }, [setGameState]);

  return { hasSave, startNewGame, loadGame: () => {}, saveGame, exportSave, importSave, resetGame, performAutoSave };
};
