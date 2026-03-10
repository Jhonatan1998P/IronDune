
import React, { useState, useEffect, useCallback, MutableRefObject, useRef } from 'react';
import { GameState, GameStatus, OfflineReport } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { sanitizeAndMigrateSave } from '../utils/engine/migration';
import { calculateOfflineProgress } from '../utils/engine/offline';
import { encodeSaveData, decodeSaveData } from '../utils/engine/security';
import { SAVE_VERSION } from '../constants';
import {
    loadSpyReportsFromStorage,
    saveSpyReportsToStorage,
    loadLogsFromStorage,
    saveLogsToStorage
} from '../utils';

const SPY_REPORTS_STORAGE_KEY = 'ironDuneSpyReports';
const LOGS_STORAGE_KEY = 'ironDuneLogs';
const AUTO_SAVE_INTERVAL_MS = 30000; // 30 seconds

// Optimización: Debounce para escrituras en localStorage
const useDebounce = <T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      fnRef.current(...args);
    }, delay);
  }, [delay]);
};

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
  const [hasSave, setHasSave] = useState(false);
  
  // Refs para evitar dependencias cambiantes
  const gameStateRef = useRef(gameState);
  const statusRef = useRef(status);
  gameStateRef.current = gameState;
  statusRef.current = status;

  // Check for save on mount
  useEffect(() => {
    const saved = localStorage.getItem('ironDuneSave');
    if (saved) {
      setHasSave(true);
    }
  }, []);

  // Optimización: Cleanup con throttle (solo cada 10 minutos)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const savedReports = loadSpyReportsFromStorage();
      if (savedReports.length !== (gameStateRef.current.spyReports || []).length) {
        setGameState(prev => ({
          ...prev,
          spyReports: savedReports
        }));
      }

      const savedLogs = loadLogsFromStorage();
      if (savedLogs.length > 0) {
        setGameState(prev => {
          const mergedLogs = [...savedLogs, ...prev.logs]
              .filter((log, index, self) =>
                  index === self.findIndex(l => l.id === log.id)
              )
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 100);
          return { ...prev, logs: mergedLogs };
        });
      }
    }, 10 * 60 * 1000); // 10 minutos en lugar de 5

    return () => clearInterval(cleanupInterval);
  }, []);

  const isResettingRef = useRef(false);

  // Optimización: beforeunload con throttle
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isResettingRef.current) return;

      if (statusRef.current === 'PLAYING') {
        const now = Date.now();
        saveSpyReportsToStorage(gameStateRef.current.spyReports || []);
        saveLogsToStorage(gameStateRef.current.logs || []);
        const stateToSave = { ...gameStateRef.current, lastSaveTime: now };
        localStorage.setItem('ironDuneSave', JSON.stringify(stateToSave));
        setHasSave(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

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

  const loadGame = useCallback(() => {
    const savedStr = localStorage.getItem('ironDuneSave');
    if (savedStr) {
      try {
        console.log('[LoadGame] Starting load process...');
        const parsed = JSON.parse(savedStr);
        console.log('[LoadGame] Parsed save data', {
          saveVersion: parsed.saveVersion,
          lastSaveTime: parsed.lastSaveTime,
          resources: parsed.resources,
          now: Date.now(),
          timeSinceSave: Date.now() - parsed.lastSaveTime
        });
        
        const migratedState = sanitizeAndMigrateSave(parsed, parsed);
        console.log('[LoadGame] After migration', {
          resources: migratedState.resources,
          lastSaveTime: migratedState.lastSaveTime
        });

        const storedSpyReports = loadSpyReportsFromStorage();
        if (storedSpyReports.length > 0) {
          migratedState.spyReports = storedSpyReports;
        }

        const storedLogs = loadLogsFromStorage();
        if (storedLogs.length > 0) {
          migratedState.logs = [...storedLogs, ...migratedState.logs]
              .filter((log, index, self) =>
                  index === self.findIndex(l => l.id === log.id)
              )
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 100);
        }

        console.log('[LoadGame] Before offline calculation', {
          resources: migratedState.resources,
          lastSaveTime: migratedState.lastSaveTime
        });
        const { newState, report, newLogs } = calculateOfflineProgress(migratedState);
        console.log('[LoadGame] After offline calculation', {
          resources: newState.resources,
          resourcesGained: report.resourcesGained,
          timeElapsed: report.timeElapsed
        });

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
        console.error("Failed to load save: Corrupt Data", e);
      }
    }
  }, [setGameState, setOfflineReport, setHasNewReports, lastTickRef, setStatus]);

  const lastSaveTimeRef = React.useRef(Date.now());
  const pendingSaveRef = useRef(false);

  // Optimización: Auto-save con debounce y throttle combinados
  const performAutoSave = useCallback(() => {
      const now = Date.now();
      
      // Throttle: Solo guardar cada 30s
      if (now - lastSaveTimeRef.current < AUTO_SAVE_INTERVAL_MS) return;
      
      // Debounce: Evitar múltiples guardados simultáneos
      if (pendingSaveRef.current) return;
      
      pendingSaveRef.current = true;
      lastSaveTimeRef.current = now;

      try {
        saveSpyReportsToStorage(gameStateRef.current.spyReports || []);
        saveLogsToStorage(gameStateRef.current.logs || []);
        const stateToSave = { ...gameStateRef.current, lastSaveTime: now };
        localStorage.setItem('ironDuneSave', JSON.stringify(stateToSave));
        setHasSave(true);
      } catch (e) {
        console.error('Auto-save failed:', e);
      } finally {
        pendingSaveRef.current = false;
      }
  }, []);

  const saveGame = useCallback(() => {
      console.log('[SaveGame] === INICIANDO GUARDADO ===');
      
      // 1. DETENER EXPLÍCITAMENTE EL GAME LOOP
      if (isLoopRunningRef) {
          isLoopRunningRef.current = false;
          console.log('[SaveGame] Game loop marcado como detenido');
      }
      
      // 2. CANCELAR ANIMATION FRAME PENDIENTE
      if (animationFrameRef && animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = undefined;
          console.log('[SaveGame] Animation frame cancelado');
      }
      
      const now = Date.now();
      lastSaveTimeRef.current = now;

      // 3. OBTENER EL ESTADO ACTUAL COMPLETO DIRECTAMENTE DE gameStateRef
      // Esto asegura que capturamos el estado más reciente
      const currentState = gameStateRef.current;
      
      console.log('[SaveGame] Estado actual capturado:', {
          saveVersion: currentState.saveVersion,
          playerName: currentState.playerName,
          lastSaveTime: currentState.lastSaveTime,
          resources: currentState.resources,
          buildings: Object.keys(currentState.buildings).length,
          units: Object.keys(currentState.units).length,
          researchedTechs: currentState.researchedTechs.length,
          activeMissions: currentState.activeMissions.length,
          incomingAttacks: currentState.incomingAttacks.length,
          spyReports: currentState.spyReports?.length || 0,
          logs: currentState.logs?.length || 0,
          rankingData: {
              bots: currentState.rankingData?.bots?.length || 0,
              lastUpdateTime: currentState.rankingData?.lastUpdateTime
          },
          activeWar: currentState.activeWar ? 'ACTIVE' : 'NONE',
          campaignProgress: currentState.campaignProgress,
          empirePoints: currentState.empirePoints,
          bankBalance: currentState.bankBalance
      });

      // 4. GUARDAR SPY REPORTS Y LOGS EN ALMACENAMIENTO SEPARADO
      saveSpyReportsToStorage(currentState.spyReports || []);
      console.log('[SaveGame] Spy reports guardados:', currentState.spyReports?.length || 0);
      
      saveLogsToStorage(currentState.logs || []);
      console.log('[SaveGame] Logs guardados:', currentState.logs?.length || 0);

      // 5. CREAR ESTADO COMPLETO PARA GUARDAR
      const stateToSave = { 
          ...currentState, 
          lastSaveTime: now 
      };

      // 6. VERIFICAR QUE TODOS LOS CAMPOS CRÍTICOS ESTÉN PRESENTES
      const requiredFields = [
          'saveVersion', 'playerName', 'resources', 'buildings', 'units',
          'researchedTechs', 'techLevels', 'activeMissions', 'incomingAttacks',
          'grudges', 'spyReports', 'logs', 'rankingData', 'diplomaticActions',
          'lifetimeStats', 'lastSaveTime', 'empirePoints', 'bankBalance',
          'campaignProgress', 'activeWar', 'enemyAttackCounts', 'targetAttackCounts',
          'activeRecruitments', 'activeConstructions', 'activeResearch'
      ];
      
      const missingFields = requiredFields.filter(field => !(field in stateToSave));
      if (missingFields.length > 0) {
          console.error('[SaveGame] CAMPOS FALTANTES EN EL GUARDADO:', missingFields);
      } else {
          console.log('[SaveGame] ✓ Todos los campos críticos presentes');
      }

      // 7. GUARDAR EN LOCALSTORAGE
      try {
          localStorage.setItem('ironDuneSave', JSON.stringify(stateToSave));
          console.log('[SaveGame] ✓ Estado guardado en localStorage:', {
              size: JSON.stringify(stateToSave).length,
              lastSaveTime: stateToSave.lastSaveTime
          });
          setHasSave(true);
      } catch (e) {
          console.error('[SaveGame] ERROR al guardar en localStorage:', e);
      }

      // 8. CAMBIAR A MENU DESPUÉS DE GUARDAR
      console.log('[SaveGame] Cambiando a MENU...');
      setStatus('MENU');
      
      console.log('[SaveGame] === GUARDADO COMPLETADO ===');
  }, [setStatus, setHasSave, isLoopRunningRef, animationFrameRef]);

  const exportSave = useCallback(() => {
    const stateToSave = { ...gameState, lastSaveTime: Date.now() };

    saveSpyReportsToStorage(gameState.spyReports || []);
    saveLogsToStorage(gameState.logs || []);
    localStorage.setItem('ironDuneSave', JSON.stringify(stateToSave));
    const secureString = encodeSaveData(stateToSave);
    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(secureString);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `iron_dune_save_v${SAVE_VERSION}_${Date.now()}.ids`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }, [gameState]);

  const importSave = useCallback((fileContent: string): boolean => {
    try {
        console.log('[ImportSave] Starting import process...');
        const parsed = decodeSaveData(fileContent);
        if (!parsed || typeof parsed !== 'object' || !parsed.resources) return false;

        console.log('[ImportSave] Parsed import data', {
          saveVersion: parsed.saveVersion,
          lastSaveTime: parsed.lastSaveTime,
          resources: parsed.resources,
          now: Date.now(),
          timeSinceSave: Date.now() - parsed.lastSaveTime
        });

        const migratedState = sanitizeAndMigrateSave(parsed, parsed);
        console.log('[ImportSave] After migration', {
          resources: migratedState.resources,
          lastSaveTime: migratedState.lastSaveTime
        });

        const { newState, report, newLogs } = calculateOfflineProgress(migratedState);
        console.log('[ImportSave] After offline calculation', {
          resources: newState.resources,
          resourcesGained: report.resourcesGained,
          timeElapsed: report.timeElapsed
        });

        const storedSpyReports = loadSpyReportsFromStorage();
        if (storedSpyReports.length > 0) {
          newState.spyReports = storedSpyReports;
        }

        const storedLogs = loadLogsFromStorage();
        if (storedLogs.length > 0) {
          newState.logs = [...storedLogs, ...newState.logs, ...newLogs]
              .filter((log, index, self) =>
                  index === self.findIndex(l => l.id === log.id)
              )
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 100);
        } else if (newLogs.length > 0) {
          newState.logs = [...newLogs, ...newState.logs].slice(0, 100);
        }

        if (newLogs.length > 0) {
            setHasNewReports(true);
        }

        setGameState(newState);

        if (report.timeElapsed > 60000) {
            setOfflineReport(report);
        } else {
            setOfflineReport(null);
        }

        localStorage.setItem('ironDuneSave', JSON.stringify(newState));
        setHasSave(true);
        lastTickRef.current = Date.now();
        setStatus('PLAYING');
        return true;
    } catch (e) {
        console.error("[ImportSave] Error fatal durante la importación:", e);
        return false;
    }
  }, [setGameState, setOfflineReport, setHasNewReports, lastTickRef, setStatus]);

  const resetGame = useCallback(() => {
      isResettingRef.current = true;
      setStatus('MENU');
      window.onbeforeunload = null;
      setGameState({ ...INITIAL_GAME_STATE, lastSaveTime: Date.now() });
      setOfflineReport(null);
      setHasNewReports(false);
      localStorage.removeItem('ironDuneSave');
      localStorage.removeItem(SPY_REPORTS_STORAGE_KEY);
      localStorage.removeItem(LOGS_STORAGE_KEY);
      localStorage.removeItem('ironDuneP2PChatMessages');
      setHasSave(false);

      setTimeout(() => {
          window.location.reload();
      }, 50);
  }, [setGameState, setOfflineReport, setHasNewReports, setStatus]);

  return { hasSave, startNewGame, loadGame, saveGame, exportSave, importSave, resetGame, performAutoSave };
};