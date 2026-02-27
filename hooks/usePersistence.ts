
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

export const usePersistence = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  setStatus: React.Dispatch<React.SetStateAction<GameStatus>>,
  setOfflineReport: React.Dispatch<React.SetStateAction<OfflineReport | null>>,
  setHasNewReports: (has: boolean) => void,
  lastTickRef: MutableRefObject<number>
) => {
  const [hasSave, setHasSave] = useState(false);

  // Check for save on mount
  useEffect(() => {
    const saved = localStorage.getItem('ironDuneSave');
    if (saved) {
      setHasSave(true);
    }
  }, []);

  // Cleanup expired spy reports and sync logs periodically (every 5 minutes)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      // Cleanup expired spy reports
      const savedReports = loadSpyReportsFromStorage();
      if (savedReports.length !== (gameState.spyReports || []).length) {
        setGameState(prev => ({
          ...prev,
          spyReports: savedReports
        }));
      }
      
      // Sync logs from storage
      const savedLogs = loadLogsFromStorage();
      if (savedLogs.length > 0) {
        setGameState(prev => {
          // Merge logs, keeping most recent
          const mergedLogs = [...savedLogs, ...prev.logs]
              .filter((log, index, self) => 
                  index === self.findIndex(l => l.id === log.id)
              )
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 100);
          return { ...prev, logs: mergedLogs };
        });
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(cleanupInterval);
  }, [gameState.spyReports?.length, gameState.logs?.length, setGameState]);

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
        
        // Pass parsed data for detailed error logging if migration fails
        const migratedState = sanitizeAndMigrateSave(parsed, parsed);
        
        // Cargar spyReports desde localStorage (persistencia independiente)
        const storedSpyReports = loadSpyReportsFromStorage();
        if (storedSpyReports.length > 0) {
          migratedState.spyReports = storedSpyReports;
        }
        
        // Cargar logs/informes desde localStorage (persistencia independiente)
        const storedLogs = loadLogsFromStorage();
        if (storedLogs.length > 0) {
          // Merge con logs existentes, priorizando los más recientes
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

  // Auto-save logic with throttle to improve performance
  const performAutoSave = useCallback(() => {
      const now = Date.now();
      if (now - lastSaveTimeRef.current < 30000) return; // Save at most every 30s
      lastSaveTimeRef.current = now;
      
      // Guardar spyReports en localStorage con límites
      saveSpyReportsToStorage(gameState.spyReports || []);
      
      // Guardar logs/informes en localStorage con límites
      saveLogsToStorage(gameState.logs || []);
      
      localStorage.setItem('ironDuneSave', JSON.stringify(gameState));
      setHasSave(true);
  }, [gameState]);

  const saveGame = useCallback(() => {
      const now = Date.now();
      lastSaveTimeRef.current = now;
      
      // Guardar spyReports en localStorage con límites
      saveSpyReportsToStorage(gameState.spyReports || []);
      
      // Guardar logs/informes en localStorage con límites
      saveLogsToStorage(gameState.logs || []);
      
      const stateToSave = { ...gameState, lastSaveTime: now };
      localStorage.setItem('ironDuneSave', JSON.stringify(stateToSave));
      setHasSave(true);
      setStatus('MENU');
  }, [gameState, setStatus]);

  const exportSave = useCallback(() => {
    const stateToSave = { ...gameState, lastSaveTime: Date.now() };
    
    // Guardar spyReports en localStorage antes de exportar
    saveSpyReportsToStorage(gameState.spyReports || []);
    
    // Guardar logs/informes en localStorage antes de exportar
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

        // Pass parsed data for detailed error logging if migration fails
        const migratedState = sanitizeAndMigrateSave(parsed, parsed);
        
        // Cargar spyReports desde localStorage
        const storedSpyReports = loadSpyReportsFromStorage();
        if (storedSpyReports.length > 0) {
          migratedState.spyReports = storedSpyReports;
        }
        
        // Cargar logs/informes desde localStorage
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
        if (report.timeElapsed > 60000) setOfflineReport(report);

        localStorage.setItem('ironDuneSave', JSON.stringify(newState));
        setHasSave(true);
        lastTickRef.current = Date.now();
        setStatus('PLAYING');
        return true;
    } catch (e) {
        return false;
    }
  }, [setGameState, setOfflineReport, setHasNewReports, lastTickRef, setStatus]);

  const resetGame = useCallback(() => {
      setGameState(INITIAL_GAME_STATE);
      setOfflineReport(null);
      setHasNewReports(false);
      localStorage.removeItem('ironDuneSave');
      localStorage.removeItem(SPY_REPORTS_STORAGE_KEY);
      localStorage.removeItem(LOGS_STORAGE_KEY);
      setHasSave(false);
      setStatus('MENU');
  }, [setGameState, setOfflineReport, setHasNewReports, setStatus]);

  return { hasSave, startNewGame, loadGame, saveGame, exportSave, importSave, resetGame, performAutoSave };
};