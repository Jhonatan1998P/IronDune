
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
  lastTickRef: MutableRefObject<number>
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
        const parsed = JSON.parse(savedStr);
        const migratedState = sanitizeAndMigrateSave(parsed, parsed);

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
      const now = Date.now();
      lastSaveTimeRef.current = now;

      saveSpyReportsToStorage(gameStateRef.current.spyReports || []);
      saveLogsToStorage(gameStateRef.current.logs || []);
      const stateToSave = { ...gameStateRef.current, lastSaveTime: now };
      localStorage.setItem('ironDuneSave', JSON.stringify(stateToSave));
      setHasSave(true);
      setStatus('MENU');
  }, [setStatus]);

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
        const parsed = decodeSaveData(fileContent);
        if (!parsed || typeof parsed !== 'object' || !parsed.resources) return false;

        const migratedState = sanitizeAndMigrateSave(parsed, parsed);

        const { newState, report, newLogs } = calculateOfflineProgress(migratedState);

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