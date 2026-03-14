import React, { useState, useEffect, useCallback, MutableRefObject, useRef } from 'react';
import { GameState, GameStatus, OfflineReport, BuildingType, ResourceType, TechType, UnitType } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { BUILDING_DEFS } from '../data/buildings';
import { sanitizeAndMigrateSave } from '../utils/engine/migration';
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
        console.log('[Persistence] Loading full game state from multiple tables...');
        
        // 1. Fetch Profile & Economy & Others & Reports
        const [profileRes, economyRes, buildingsRes, researchRes, unitsRes, reportsRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('player_economy').select('*').eq('player_id', user.id).single(),
          supabase.from('player_buildings').select('*').eq('player_id', user.id),
          supabase.from('player_research').select('*').eq('player_id', user.id),
          supabase.from('player_units').select('*').eq('player_id', user.id),
          supabase.from('reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
        ]);

        if (profileRes.error && profileRes.error.code !== 'PGRST116') {
          console.error('Error fetching profile:', profileRes.error);
          return;
        }

        if (profileRes.data) {
          console.log('[Persistence] Profile found, reconstructing state...');
          
          // Reconstruct GameState from individual tables
          const baseState = profileRes.data.game_state || {};
          const economy = economyRes.data || {};
          
          const reconstructedState: any = {
            ...INITIAL_GAME_STATE,
            ...baseState,
            playerName: profileRes.data.username || baseState.playerName || 'Commander',
            empirePoints: Number(profileRes.data.empire_points || 0),
            lastSaveTime: new Date(profileRes.data.updated_at).getTime(),
            logs: []
          };

          // Map Reports to Logs
          if (reportsRes.data && reportsRes.data.length > 0) {
            reconstructedState.logs = reportsRes.data.map((r: any) => ({
              id: r.id,
              messageKey: r.title,
              params: r.content,
              timestamp: new Date(r.created_at).getTime(),
              type: r.type.toLowerCase(),
              archived: false
            }));
          } else {
            // Fallback to legacy logs if no reports found in table
            reconstructedState.logs = baseState.logs || [];
          }

          // Map Resources
          if (economyRes.data) {
            reconstructedState.resources = {
              [ResourceType.MONEY]: Number(economy.money || 0),
              [ResourceType.OIL]: Number(economy.oil || 0),
              [ResourceType.AMMO]: Number(economy.ammo || 0),
              [ResourceType.GOLD]: Number(economy.gold || 0),
              [ResourceType.DIAMOND]: Number(economy.diamond || 0),
            };
            reconstructedState.bankBalance = Number(economy.bank_balance || 0);
          }

          // Map Buildings
          if (buildingsRes.data) {
            buildingsRes.data.forEach((b: any) => {
              const def = BUILDING_DEFS[b.building_type as BuildingType];
              // Si es un edificio de cantidad, usamos la columna quantity, si no level
              const value = def?.buildMode === 'QUANTITY' ? (b.quantity || 0) : (b.level || 0);
              reconstructedState.buildings[b.building_type as BuildingType] = {
                level: value,
                isDamaged: false
              };
            });
          }

          // Map Research
          if (researchRes.data) {
            researchRes.data.forEach((r: any) => {
              reconstructedState.techLevels[r.tech_type as TechType] = r.level;
              if (r.level > 0 && !reconstructedState.researchedTechs.includes(r.tech_type)) {
                reconstructedState.researchedTechs.push(r.tech_type);
              }
            });
          }

          // Map Units
          if (unitsRes.data) {
            unitsRes.data.forEach((u: any) => {
              reconstructedState.units[u.unit_type as UnitType] = Number(u.count);
            });
          }

          setHasSave(true);
          loadGameFromData(reconstructedState);
        } else {
          console.log('[Persistence] No profile found. Starting new game.');
          startNewGame();
        }
      } catch (e) {
        console.error('Persistence load failed:', e);
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
      
      // La producción offline ahora la gestiona el servidor vía SQL RPC.
      // Aquí solo cargamos el estado ya procesado por el Scheduler.
      const newState = migratedState;

      setGameState(newState);

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
    setGameState({ ...INITIAL_GAME_STATE, lastSaveTime: Date.now() });
    setOfflineReport(null);
    setHasNewReports(false);
    lastTickRef.current = Date.now();
    setStatus('PLAYING');
  }, [setGameState, setOfflineReport, setHasNewReports, lastTickRef, setStatus]);

  const saveGame = useCallback(async () => {
      if (!user) return;

      console.log('[SaveGame] === PERSISTENCIA MULTI-TABLA ===');
      
      if (isLoopRunningRef) isLoopRunningRef.current = false;
      if (animationFrameRef?.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = undefined;
      }
      
      const now = Date.now();
      const state = gameStateRef.current;

      try {
          // 1. Update Profile
          const { error: pErr } = await supabase.from('profiles').upsert({
            id: user.id,
            username: state.playerName,
            empire_points: state.empirePoints,
            game_state: {
               completedTutorials: state.completedTutorials,
               currentTutorialId: state.currentTutorialId,
               tutorialClaimable: state.tutorialClaimable,
               tutorialAccepted: state.tutorialAccepted,
               isTutorialMinimized: state.isTutorialMinimized,
               playerFlag: state.playerFlag,
               saveVersion: state.saveVersion
            },
            updated_at: new Date(now).toISOString()
          });
          if (pErr) throw pErr;

          // 2. Update Economy
          const { error: eErr } = await supabase.from('player_economy').upsert({
            player_id: user.id,
            money: state.resources.MONEY,
            oil: state.resources.OIL,
            ammo: state.resources.AMMO,
            gold: state.resources.GOLD,
            diamond: state.resources.DIAMOND,
            bank_balance: state.bankBalance,
            last_calc_time: now
          });
          if (eErr) throw eErr;

          // 3. Update Buildings
          const buildingData = Object.entries(state.buildings).map(([type, b]) => {
            const def = BUILDING_DEFS[type as BuildingType];
            const isQuantity = def?.buildMode === 'QUANTITY';
            return {
              player_id: user.id,
              building_type: type,
              level: isQuantity ? 0 : b.level,
              quantity: isQuantity ? b.level : 0
            };
          });
          await supabase.from('player_buildings').upsert(buildingData);

          // 4. Update Research
          const researchData = Object.entries(state.techLevels).map(([type, level]) => ({
            player_id: user.id,
            tech_type: type,
            level: level
          }));
          if (researchData.length > 0) {
             await supabase.from('player_research').upsert(researchData);
          }

          // 5. Update Units
          const unitData = Object.entries(state.units).map(([type, count]) => ({
            player_id: user.id,
            unit_type: type,
            count: count
          }));
          await supabase.from('player_units').upsert(unitData);

          // 6. Update Reports (New/Unread only or full sync)
          // For now, we only insert new logs that don't have a UUID (frontend generated)
          const newLogs = state.logs.filter(log => !log.id.includes('-') && log.id.length < 30);
          if (newLogs.length > 0) {
            const reportData = newLogs.map(log => ({
              user_id: user.id,
              title: log.messageKey,
              content: log.params || {},
              type: log.type.toUpperCase(),
              created_at: new Date(log.timestamp).toISOString()
            }));
            await supabase.from('reports').insert(reportData);
          }

          console.log('[SaveGame] ✓ Estado sincronizado');
          setHasSave(true);
          localStorage.removeItem('ironDuneSave');
      } catch (e) {
          console.error('[SaveGame] ERROR:', e);
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
      const state = gameStateRef.current;

      try {
        await Promise.all([
          supabase.from('profiles').upsert({ 
            id: user.id, 
            username: state.playerName, 
            empire_points: state.empirePoints,
            updated_at: new Date().toISOString() 
          }),
          supabase.from('player_economy').upsert({
            player_id: user.id,
            money: state.resources.MONEY,
            oil: state.resources.OIL,
            ammo: state.resources.AMMO,
            gold: state.resources.GOLD,
            diamond: state.resources.DIAMOND,
            bank_balance: state.bankBalance,
            last_calc_time: now
          })
        ]);
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
      setTimeout(() => { window.location.reload(); }, 50);
  }, [user]);

  return { hasSave, startNewGame, loadGame: () => {}, saveGame, exportSave: () => {}, importSave: () => false, resetGame, performAutoSave };
};