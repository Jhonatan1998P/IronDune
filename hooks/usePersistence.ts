/**
 * usePersistence — Arquitectura de persistencia de Iron Dune
 *
 * FUENTE DE VERDAD: Supabase (servidor)
 *   - El estado del juego vive en las tablas de Supabase.
 *   - Se sincroniza con el servidor cada BUFFER_TO_SERVER_MS (2 minutos).
 *   - Al cargar el juego, Supabase SIEMPRE tiene prioridad.
 *
 * BUFFER LOCAL: localStorage
 *   - Única función: evitar pérdida de datos entre sincronizaciones.
 *   - Se actualiza silenciosamente cada BUFFER_WRITE_MS (30 segundos).
 *   - Solo se usa como FALLBACK si Supabase no está disponible al cargar.
 *   - El usuario nunca ve ni gestiona este buffer directamente.
 *   - Los datos del buffer se descartan una vez el servidor confirma el guardado.
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

const BUFFER_WRITE_MS  = 30000;   // localStorage: actualizar buffer cada 30s
const BUFFER_TO_SERVER_MS = 120000; // Supabase: sincronizar con servidor cada 2min
const BUFFER_KEY = 'ironDuneSave_v2';

// ── Buffer local (solo lectura/escritura interna, nunca expuesto al usuario) ───

const writeBuffer = (state: GameState): void => {
  try {
    const encoded = encodeSaveData({ ...state, lastSaveTime: Date.now() });
    if (encoded) localStorage.setItem(BUFFER_KEY, encoded);
  } catch {
    // El buffer es opcional; si falla, Supabase sigue siendo la fuente de verdad
  }
};

const readBuffer = (): GameState | null => {
  try {
    const raw = localStorage.getItem(BUFFER_KEY)
             || localStorage.getItem('ironDuneSave'); // clave de versión anterior
    if (!raw) return null;
    return decodeSaveData(raw);
  } catch {
    return null;
  }
};

const clearBuffer = (): void => {
  localStorage.removeItem(BUFFER_KEY);
  localStorage.removeItem('ironDuneSave');
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

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const lastBufferWriteRef  = useRef(0);
  const lastServerSyncRef   = useRef(0);
  const pendingServerSyncRef = useRef(false);
  const prevUserIdRef        = useRef<string | null>(null);

  // ── 1. Aplicar estado al juego (con cálculo offline opcional) ────────────────
  const applyLoadedState = useCallback((rawState: GameState, fromBuffer: boolean) => {
    try {
      const migrated = sanitizeAndMigrateSave(rawState, rawState);
      let finalState = migrated;

      // Solo calcular producción offline si viene del buffer local
      // (los datos de Supabase ya son los correctos, no necesitan ajuste)
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

  // ── 2. Cargar desde Supabase (fuente de verdad) ───────────────────────────────
  const loadFromServer = useCallback(async (userId: string): Promise<boolean> => {
    try {
      console.log('[Persistence] Cargando desde servidor (Supabase)...');

      const [profileRes, economyRes, buildingsRes, researchRes, unitsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('player_economy').select('*').eq('player_id', userId).single(),
        supabase.from('player_buildings').select('*').eq('player_id', userId),
        supabase.from('player_research').select('*').eq('player_id', userId),
        supabase.from('player_units').select('*').eq('player_id', userId),
      ]);

      if (profileRes.error) {
        if (profileRes.error.code === 'PGRST116') {
          // Perfil no encontrado — nuevo usuario o primer acceso
          return false;
        }
        console.error('[Persistence] Error al cargar perfil del servidor:', profileRes.error);
        return false;
      }

      const profile  = profileRes.data;
      const economy  = economyRes.data;
      const baseState = profile.game_state || {};

      const serverState: GameState = {
        ...INITIAL_GAME_STATE,
        ...baseState,
        playerName:   profile.username || 'Commander',
        empirePoints: Number(profile.empire_points || 0),
        lastSaveTime: new Date(profile.updated_at).getTime(),
      };

      if (economy) {
        serverState.resources = {
          [ResourceType.MONEY]:   Number(economy.money   || 0),
          [ResourceType.OIL]:     Number(economy.oil     || 0),
          [ResourceType.AMMO]:    Number(economy.ammo    || 0),
          [ResourceType.GOLD]:    Number(economy.gold    || 0),
          [ResourceType.DIAMOND]: Number(economy.diamond || 0),
        };
        serverState.bankBalance = Number(economy.bank_balance || 0);
      }

      buildingsRes.data?.forEach((b: any) => {
        const def   = BUILDING_DEFS[b.building_type as BuildingType];
        const value = def?.buildMode === 'QUANTITY' ? (b.quantity || 0) : (b.level || 0);
        serverState.buildings[b.building_type as BuildingType] = { level: value, isDamaged: false };
      });

      researchRes.data?.forEach((r: any) => {
        serverState.techLevels[r.tech_type as TechType] = r.level;
        if (r.level > 0 && !serverState.researchedTechs.includes(r.tech_type)) {
          serverState.researchedTechs.push(r.tech_type);
        }
      });

      unitsRes.data?.forEach((u: any) => {
        serverState.units[u.unit_type as UnitType] = Number(u.count);
      });

      clearBuffer(); // Los datos del servidor son autoritativos; el buffer queda obsoleto
      setHasSave(true);
      applyLoadedState(serverState, false);
      console.log('[Persistence] ✓ Estado cargado desde Supabase.');
      return true;
    } catch (e) {
      console.error('[Persistence] Error de red al cargar desde Supabase:', e);
      return false;
    }
  }, [applyLoadedState]);

  // ── 3. Carga inicial — detecta cambio de usuario y dispara la carga ───────────
  useEffect(() => {
    const currentUserId = user?.id ?? null;

    // Si el usuario cambió (ej. login), reiniciar el proceso de carga
    if (prevUserIdRef.current !== currentUserId) {
      prevUserIdRef.current = currentUserId;
      setIsInitialLoadDone(false);
      return;
    }

    if (isInitialLoadDone) return;

    const init = async () => {
      // Prioridad 1: Supabase (solo si hay usuario autenticado)
      if (user) {
        const loaded = await loadFromServer(user.id);
        if (loaded) { setIsInitialLoadDone(true); return; }
      }

      // Prioridad 2: Buffer local (red caída o usuario no autenticado)
      const buffered = readBuffer();
      if (buffered) {
        console.log('[Persistence] Servidor no disponible. Cargando desde buffer local...');
        setHasSave(true);
        applyLoadedState(buffered, true); // calcular progreso offline
        setIsInitialLoadDone(true);
        return;
      }

      // Sin datos en ningún lado → nuevo juego
      console.log('[Persistence] Sin datos. Iniciando nuevo juego.');
      setIsInitialLoadDone(true);
    };

    init();
  }, [user, isInitialLoadDone, loadFromServer, applyLoadedState]);

  // ── 4. Sincronizar con el servidor (Supabase) ─────────────────────────────────
  const syncToServer = useCallback(async (state: GameState): Promise<void> => {
    if (!user || pendingServerSyncRef.current) return;

    pendingServerSyncRef.current = true;
    const now = Date.now();

    try {
      await supabase.from('profiles').upsert({
        id:            user.id,
        username:      state.playerName,
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
        player_id:      user.id,
        money:          state.resources[ResourceType.MONEY],
        oil:            state.resources[ResourceType.OIL],
        ammo:           state.resources[ResourceType.AMMO],
        gold:           state.resources[ResourceType.GOLD],
        diamond:        state.resources[ResourceType.DIAMOND],
        bank_balance:   state.bankBalance,
        last_calc_time: now,
      });

      const buildingRows = Object.entries(state.buildings).map(([type, b]) => {
        const isQty = BUILDING_DEFS[type as BuildingType]?.buildMode === 'QUANTITY';
        return { player_id: user.id, building_type: type, level: isQty ? 0 : b.level, quantity: isQty ? b.level : 0 };
      });
      if (buildingRows.length > 0) await supabase.from('player_buildings').upsert(buildingRows);

      const researchRows = Object.entries(state.techLevels).map(([type, level]) => ({
        player_id: user.id, tech_type: type, level,
      }));
      if (researchRows.length > 0) await supabase.from('player_research').upsert(researchRows);

      const unitRows = Object.entries(state.units).map(([type, count]) => ({
        player_id: user.id, unit_type: type, count,
      }));
      if (unitRows.length > 0) await supabase.from('player_units').upsert(unitRows);

      lastServerSyncRef.current = now;
      console.log('[Persistence] ✓ Estado sincronizado con servidor.');
    } catch (e) {
      console.error('[Persistence] Error al sincronizar con servidor:', e);
      // El buffer local tiene los datos recientes; se intentará de nuevo en el próximo ciclo
    } finally {
      pendingServerSyncRef.current = false;
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

    // Guardar inmediatamente en servidor si hay usuario
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
        // El trigger SQL crea player_economy y player_buildings automáticamente
        console.log('[Persistence] ✓ Perfil inicial creado en servidor.');
      } catch (e) {
        console.warn('[Persistence] No se pudo crear perfil en servidor:', e);
        // El buffer local capturará el estado en el siguiente ciclo
      }
    }
  }, [user, setGameState, setOfflineReport, setHasNewReports, lastTickRef, setStatus]);

  // ── 6. Auto-guardado (buffer + servidor) ─────────────────────────────────────
  const performAutoSave = useCallback(async (force: boolean = false) => {
    const now   = Date.now();
    const state = gameStateRef.current;

    // Buffer local: actualización silenciosa y rápida
    if (force || now - lastBufferWriteRef.current >= BUFFER_WRITE_MS) {
      writeBuffer(state);
      lastBufferWriteRef.current = now;
    }

    // Servidor: sincronización periódica (fuente de verdad)
    if (user && (force || now - lastServerSyncRef.current >= BUFFER_TO_SERVER_MS)) {
      await syncToServer(state);
    }
  }, [user, syncToServer]);

  // ── 7. Guardado manual (desde menú Guardar y Salir) ──────────────────────────
  const saveGame = useCallback(async () => {
    const state = gameStateRef.current;

    // Guardado inmediato en servidor (fuente de verdad)
    if (user) {
      await syncToServer(state);
    }

    // Actualizar buffer local también para consistencia
    writeBuffer(state);
    lastBufferWriteRef.current = Date.now();

    setHasSave(true);
    setStatus('MENU');
  }, [user, syncToServer, setStatus]);

  // ── 8. Exportar partida (archivo .idb para respaldo manual del jugador) ───────
  const exportSave = useCallback(() => {
    try {
      const encoded = encodeSaveData(gameStateRef.current);
      const blob = new Blob([encoded], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `irondune_save_${Date.now()}.idb`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[Persistence] Error al exportar:', e);
    }
  }, []);

  // ── 9. Importar partida (desde archivo .idb) ──────────────────────────────────
  const importSave = useCallback((encodedData: string): boolean => {
    try {
      const state = decodeSaveData(encodedData);
      if (!state) return false;
      applyLoadedState(state, true);
      setHasSave(true);
      // Sincronizar inmediatamente con servidor
      if (user) syncToServer(state);
      return true;
    } catch (e) {
      console.error('[Persistence] Error al importar:', e);
      return false;
    }
  }, [applyLoadedState, user, syncToServer]);

  // ── 10. Reinicio completo ─────────────────────────────────────────────────────
  const resetGame = useCallback(async () => {
    clearBuffer();
    setHasSave(false);
    if (user) {
      try { await supabase.from('profiles').delete().eq('id', user.id); }
      catch (e) { console.error('[Persistence] Error al borrar perfil:', e); }
    }
    setTimeout(() => window.location.reload(), 50);
  }, [user]);

  // ── 11. Sincronizar peerId de P2P al estado del juego ────────────────────────
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
