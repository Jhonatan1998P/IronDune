
import { useEffect, useRef } from 'react';
import { GameStatus, GameState, BuildingType, UnitType, TechType } from '../types';
import { socket } from '../lib/socket';
import { resourceStore } from '../store/ResourceStore';

/**
 * useGameLoop — ALTA FRECUENCIA (Interpolación Autoritativa)
 * Implementa un bucle de predicción en el cliente sincronizado con el servidor.
 */
export const useGameLoop = (
  status: GameStatus,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  performAutoSave: (force?: boolean) => Promise<void>,
) => {
  const isLoopRunningRef = useRef<boolean>(false);
  const statusRef = useRef<GameStatus>(status);
  const lastSyncRef = useRef<{ 
      resources: Record<string, number>, 
      rates: Record<string, number>, 
      queues: any,
      serverTime: number 
  } | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (status !== 'PLAYING') return;

    console.log('[GameLoop] Authority Interpolation Active');
    isLoopRunningRef.current = true;

    // 1. Escuchar actualizaciones del servidor
    const handleSyncUpdate = (data: any) => {
        lastSyncRef.current = data;
        
        // Sincronizar store de recursos (Alta frecuencia)
        resourceStore.updateFromServer(data.resources, data.rates, data.serverTime);
        
        // Sincronización inmediata de colas y estado pesado al recibir sync
        setGameState(prev => {
            const newState = { ...prev };
            
            // Actualizar colas desde el servidor (Fuente de Verdad)
            if (data.queues) {
                newState.activeConstructions = data.queues.constructions.map((c: any) => ({
                    id: c.id, 
                    buildingType: c.building_type as BuildingType, 
                    count: c.target_level,
                    startTime: new Date(c.created_at).getTime(), 
                    endTime: Number(c.end_time)
                }));

                newState.activeRecruitments = data.queues.units.map((u: any) => ({
                    id: u.id,
                    unitType: u.unit_type as UnitType,
                    count: u.amount,
                    startTime: new Date(u.created_at).getTime(),
                    endTime: Number(u.end_time)
                }));

                newState.activeResearch = data.queues.research.map((r: any) => ({
                    id: r.id,
                    techId: r.tech_type as TechType,
                    targetLevel: r.target_level,
                    startTime: new Date(r.created_at).getTime(),
                    endTime: Number(r.end_time)
                }));
            }

            return newState;
        });
    };

    socket.on('engine_sync_update', handleSyncUpdate);
    
    // 2. Heartbeat de sincronización (Cada 2 segundos es óptimo con interpolación)
    const heartbeatInterval = setInterval(() => {
        if (statusRef.current === 'PLAYING' && socket.connected) {
            socket.emit('request_engine_sync');
        }
    }, 2000);

    // 3. BUCLE DE INTERPOLACIÓN (60 FPS)
    // Anima los recursos localmente entre cada sincronización del servidor
    let animationFrameId: number;
    
    const interpolate = () => {
        if (statusRef.current === 'PLAYING') {
            resourceStore.interpolate();
        }
        animationFrameId = requestAnimationFrame(interpolate);
    };

    animationFrameId = requestAnimationFrame(interpolate);

    // 4. Persistencia en DB (Cada 2 minutos)
    const dbSyncInterval = setInterval(() => {
        if (statusRef.current === 'PLAYING') {
            performAutoSave(true); 
        }
    }, 2 * 60 * 1000);

    return () => {
      socket.off('engine_sync_update', handleSyncUpdate);
      clearInterval(heartbeatInterval);
      clearInterval(dbSyncInterval);
      cancelAnimationFrame(animationFrameId);
      isLoopRunningRef.current = false;
    };
  }, [status, performAutoSave, setGameState]);

  return { isLoopRunningRef };
};
