
import React, { useState, useEffect, useCallback, MutableRefObject, useRef } from 'react';
import { GameState, GameStatus, OfflineReport } from '../types';
import { INITIAL_GAME_STATE } from '../data/initialState';
import { sanitizeAndMigrateSave } from '../utils/engine/migration';
import { calculateOfflineProgress } from '../utils/engine/offline';
import { encodeSaveData, decodeSaveData } from '../utils/engine/security';
import { SAVE_VERSION } from '../constants';

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
        const migratedState = sanitizeAndMigrateSave(parsed);
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
      localStorage.setItem('ironDuneSave', JSON.stringify(gameState));
      setHasSave(true);
  }, [gameState]);

  const saveGame = useCallback(() => {
      const now = Date.now();
      lastSaveTimeRef.current = now;
      const stateToSave = { ...gameState, lastSaveTime: now };
      localStorage.setItem('ironDuneSave', JSON.stringify(stateToSave));
      setHasSave(true);
      setStatus('MENU');
  }, [gameState, setStatus]);

  const exportSave = useCallback(() => {
    const stateToSave = { ...gameState, lastSaveTime: Date.now() };
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

        const migratedState = sanitizeAndMigrateSave(parsed);
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
      setHasSave(false);
      setStatus('MENU');
  }, [setGameState, setOfflineReport, setHasNewReports, setStatus]);

  return { hasSave, startNewGame, loadGame, saveGame, exportSave, importSave, resetGame, performAutoSave };
};