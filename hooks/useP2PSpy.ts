import { useEffect, useRef, useCallback } from 'react';
import { useMultiplayer } from './useMultiplayerHook';
import { MultiplayerActionType } from '../types/multiplayer';
import type { P2PSpyRequest, P2PSpyResponse } from '../types/multiplayer';
import { UnitType, BuildingType } from '../types/enums';
import type { GameState } from '../types/state';
import { calculateSpyCost } from '../utils/engine/missions';
import { addSpyReport, addGameLog } from '../utils';
import type { LogEntry } from '../types/state';
import { gameEventBus } from '../utils/eventBus';

interface UseP2PSpyProps {
  gameState: GameState;
  onUpdateState?: (updates: Partial<GameState>) => void;
  onSpyReportReceived?: (report: any) => void;
}

export const useP2PSpy = ({ gameState, onUpdateState, onSpyReportReceived }: UseP2PSpyProps) => {
  const { sendToPeer, localPlayerId, remotePlayers } = useMultiplayer();
  const gameStateRef = useRef(gameState);
  const onUpdateStateRef = useRef(onUpdateState);
  const onSpyReportReceivedRef = useRef(onSpyReportReceived);
  const localPlayerIdRef = useRef(localPlayerId);

  useEffect(() => {
    localPlayerIdRef.current = localPlayerId;
  }, [localPlayerId]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    onUpdateStateRef.current = onUpdateState;
  }, [onUpdateState]);

  useEffect(() => {
    onSpyReportReceivedRef.current = onSpyReportReceived;
  }, [onSpyReportReceived]);

  const sendSpyRequest = useCallback((
    targetPeerId: string,
    targetScore: number,
    targetName: string
  ) => {
    if (!localPlayerId) return;

    const now = Date.now();
    const spyId = `spy-${localPlayerId}-${targetPeerId}-${now}`;
    const cost = calculateSpyCost(targetScore);

    const payload: P2PSpyRequest = {
      type: MultiplayerActionType.SPY_REQUEST,
      spyId,
      requesterId: localPlayerId,
      requesterName: gameState.playerName,
      requesterScore: gameState.empirePoints,
      targetId: targetPeerId,
      timestamp: now,
    };

    console.log(`[P2P Spy] 📤 Enviando petición de espionaje a ${targetName} (${targetPeerId}) - Costo: ${cost} oro`);

    const logSent: LogEntry = {
      id: `spy-req-${now}`,
      messageKey: 'log_p2p_spy_request_sent',
      type: 'intel',
      timestamp: now,
      params: {
        targetName: targetName
      }
    };

    const newLogs = addGameLog(gameState.logs || [], logSent);

    if (onUpdateStateRef.current) {
      onUpdateStateRef.current({ logs: newLogs });
    }

    sendToPeer(targetPeerId, {
      type: MultiplayerActionType.SPY_REQUEST,
      payload,
      playerId: localPlayerId,
      timestamp: payload.timestamp,
    });

    return { spyId, cost };
  }, [localPlayerId, gameState.playerName, gameState.empirePoints, gameState.logs, sendToPeer]);

  const buildSpyResponse = useCallback((
    requesterPeerId: string
  ) => {
    const currentGameState = gameStateRef.current;
    if (!currentGameState) {
      console.error('[P2P Spy] Error: gameState no disponible');
      return null;
    }
    
    const now = Date.now();

    const unitsInMovement = currentGameState.activeMissions?.reduce((acc, mission) => {
      Object.entries(mission.units).forEach(([unitType, count]) => {
        acc[unitType as UnitType] = (acc[unitType as UnitType] || 0) + (count || 0);
      });
      return acc;
    }, {} as Record<UnitType, number>);

    const unitsInBase: Partial<Record<UnitType, number>> = {};
    if (currentGameState.units) {
      Object.entries(currentGameState.units).forEach(([unitType, count]) => {
        const inMovement = unitsInMovement[unitType as UnitType] || 0;
        const inBase = Math.max(0, count - inMovement);
        if (inBase > 0) {
          unitsInBase[unitType as UnitType] = inBase;
        }
      });
    }

    const buildings: Partial<Record<BuildingType, number>> = {};
    if (currentGameState.buildings) {
      Object.entries(currentGameState.buildings).forEach(([buildingType, state]) => {
        if (state.level > 0) {
          buildings[buildingType as BuildingType] = state.level;
        }
      });
    }

    const response: P2PSpyResponse = {
      type: MultiplayerActionType.SPY_RESPONSE,
      spyId: `spy-response-${now}`,
      requesterId: requesterPeerId,
      targetId: localPlayerId || '',
      targetName: currentGameState.playerName || 'Unknown',
      targetScore: currentGameState.empirePoints || 0,
      resources: currentGameState.resources ? { ...currentGameState.resources } : {},
      units: unitsInBase,
      buildings,
      timestamp: now,
    };

    return response;
  }, [localPlayerId]);

  const handleSpyRequest = useCallback((
    action: any
  ) => {
    const payload = action.payload as P2PSpyRequest;
    if (!payload || payload.type !== MultiplayerActionType.SPY_REQUEST) return;

    const senderPeerId = action.playerId;
    console.log(`[P2P Spy] 📥 SPY_REQUEST recibido del peerId de Trystero: ${senderPeerId} - requesterName: ${payload.requesterName}`);

    const currentGameState = gameStateRef.current;
    if (!currentGameState) {
      console.error('[P2P Spy] Error: gameState no disponible');
      return;
    }
    
    const now = Date.now();

    console.log(`[P2P Spy] 📥 Petición de espionaje recibida de ${payload.requesterName} (${payload.requesterId}) - Score: ${payload.requesterScore}`);

    const logReceived: LogEntry = {
      id: `spy-recv-${now}`,
      messageKey: 'log_p2p_spy_request_received',
      type: 'intel',
      timestamp: now,
      params: {
        requesterName: payload.requesterName
      }
    };

    const newLogs1 = addGameLog(currentGameState.logs || [], logReceived);

    if (onUpdateStateRef.current) {
      onUpdateStateRef.current({ logs: newLogs1 });
    } else if (typeof (window as any)._updateGameState === 'function') {
      (window as any)._updateGameState({ logs: newLogs1 });
    }

    const response = buildSpyResponse(action.playerId);
    if (!response) {
      console.error('[P2P Spy] Error: No se pudo construir la respuesta de espionaje');
      return;
    }

    const totalUnitsInBase = Object.values(response.units).reduce((sum, count) => sum + (count || 0), 0);
    const totalResources = Object.values(response.resources).reduce((sum, val) => sum + (val || 0), 0);
    const totalBuildings = Object.values(response.buildings).reduce((sum, val) => sum + (val || 0), 0);

    console.log(`[P2P Spy] 📤 Respondiendo a ${payload.requesterName} con: ${totalUnitsInBase} unidades, ${totalResources} recursos, ${totalBuildings} edificios`);

    const logResponseSent: LogEntry = {
      id: `spy-sent-${now}`,
      messageKey: 'log_p2p_spy_response_sent',
      type: 'intel',
      timestamp: now,
      params: {
        targetName: payload.requesterName
      }
    };

    const newLogs2 = addGameLog(newLogs1, logResponseSent);

    try {
      if (onUpdateStateRef.current) {
        onUpdateStateRef.current({ logs: newLogs2 });
      } else if (typeof (window as any)._updateGameState === 'function') {
        (window as any)._updateGameState({ logs: newLogs2 });
      }
    } catch (e) {
      console.error('[P2P Spy] Error al actualizar logs:', e);
    }

    const myLocalId = localPlayerIdRef.current;
    console.log(`[P2P Spy] 📤 Enviando respuesta al peerId de Trystero: ${action.playerId}`);
    
    try {
      sendToPeer(action.playerId, {
        type: MultiplayerActionType.SPY_RESPONSE,
        payload: response,
        playerId: myLocalId || '',
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error('[P2P Spy] Error al enviar respuesta:', e);
    }
  }, [localPlayerId, buildSpyResponse, sendToPeer]);

  const handleSpyResponse = useCallback((
    action: any
  ) => {
    const payload = action.payload as P2PSpyResponse;
    if (!payload || payload.type !== MultiplayerActionType.SPY_RESPONSE) return;

    const myPlayerId = localPlayerIdRef.current;
    console.log(`[P2P Spy] 🔍 Verificando respuesta - action.playerId (sender/target): ${action.playerId}, payload.requesterId: ${payload.requesterId}, myPlayerId: ${myPlayerId}`);

    // The requester is the local player if payload.requesterId matches our local player ID
    // action.playerId is the sender of this message (the target who responded)
    const isForLocalPlayer = payload.requesterId === myPlayerId;

    if (!isForLocalPlayer) {
      console.log(`[P2P Spy] ⚠️ Response not for local player, skipping`);
      return;
    }

    const currentGameState = gameStateRef.current;
    if (!currentGameState) {
      console.error('[P2P Spy] Error: gameState no disponible al procesar respuesta');
      return;
    }

    const now = Date.now();

    const totalUnitsReceived = Object.values(payload.units).reduce((sum, count) => sum + (count || 0), 0);
    const totalResourcesReceived = Object.values(payload.resources).reduce((sum, val) => sum + (val || 0), 0);
    const totalBuildingsReceived = Object.values(payload.buildings).reduce((sum, val) => sum + (val || 0), 0);

    console.log(`[P2P Spy] ✅ Espionaje exitoso sobre ${payload.targetName} (${payload.targetId})`);
    console.log(`[P2P Spy] 📊 Datos recibidos:`);
    console.log(`   - Unidades: ${totalUnitsReceived}`);
    console.log(`   - Recursos: ${totalResourcesReceived}`);
    console.log(`   - Edificios: ${totalBuildingsReceived}`);
    console.log(`   - Score: ${payload.targetScore}`);
    console.log(`[P2P Spy] 🏗️ Detalle de edificios:`, payload.buildings);

    const report = {
      id: `spy-p2p-${payload.targetId}-${now}`,
      botId: payload.targetId,
      botName: payload.targetName,
      botScore: payload.targetScore,
      botPersonality: null,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000,
      units: payload.units,
      resources: payload.resources,
      buildings: payload.buildings,
      isP2P: true,
    };

    const newSpyReports = addSpyReport(currentGameState.spyReports || [], report);

    const combatLog: LogEntry = {
      id: `intel-p2p-${now}-${payload.targetId}`,
      messageKey: 'log_p2p_spy_success',
      type: 'intel',
      timestamp: now,
      params: {
        targetName: payload.targetName,
        units: payload.units,
        score: payload.targetScore,
        botId: payload.targetId
      }
    };

    const newLogs = addGameLog(currentGameState.logs || [], combatLog);

    try {
      if (onUpdateStateRef.current) {
        onUpdateStateRef.current({
          spyReports: newSpyReports,
          logs: newLogs,
        });
      } else if (typeof (window as any)._updateGameState === 'function') {
        (window as any)._updateGameState({
          spyReports: newSpyReports,
          logs: newLogs,
        });
      }

      if (onSpyReportReceivedRef.current) {
        onSpyReportReceivedRef.current(report);
      }
    } catch (e) {
      console.error('[P2P Spy] Error al actualizar estado con informe de espionaje:', e);
    }
  }, [localPlayerId]);

  useEffect(() => {
    const handleSpyRequestEvent = (data: any) => {
      const action = {
        type: MultiplayerActionType.SPY_REQUEST,
        payload: data,
        playerId: data._senderPeerId,
        timestamp: data.timestamp || Date.now()
      };
      handleSpyRequest(action);
    };

    const handleSpyResponseEvent = (data: any) => {
      const action = {
        type: MultiplayerActionType.SPY_RESPONSE,
        payload: data,
        playerId: data._senderPeerId,
        timestamp: data.timestamp || Date.now()
      };
      handleSpyResponse(action);
    };

    gameEventBus.on('P2P_SPY_REQUEST' as any, handleSpyRequestEvent);
    gameEventBus.on('P2P_SPY_RESPONSE' as any, handleSpyResponseEvent);

    return () => {
      gameEventBus.off('P2P_SPY_REQUEST' as any, handleSpyRequestEvent);
      gameEventBus.off('P2P_SPY_RESPONSE' as any, handleSpyResponseEvent);
    };
  }, [handleSpyRequest, handleSpyResponse]);

  const getPeerInfo = useCallback((peerId: string) => {
    return remotePlayers.find(p => p.id === peerId);
  }, [remotePlayers]);

  return {
    sendSpyRequest,
    getPeerInfo,
  };
};
