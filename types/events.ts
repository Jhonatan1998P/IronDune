
import React from 'react';
import { LogEntry } from './state';

export enum GameEventType {
  // Sistema
  STATE_CHANGE = 'STATE_CHANGE',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  
  // UI / Notificaciones
  ADD_LOG = 'ADD_LOG',
  UI_POPUP = 'UI_POPUP',

  // Gameplay Triggers (Para desacoplar lógica)
  MISSION_COMPLETED = 'MISSION_COMPLETED',
  RESEARCH_COMPLETED = 'RESEARCH_COMPLETED',
  BUILDING_COMPLETED = 'BUILDING_COMPLETED',
  
  // P2P Async Attacks
  INCOMING_P2P_ATTACK = 'INCOMING_P2P_ATTACK',
  P2P_BATTLE_RESULT = 'P2P_BATTLE_RESULT',
  SHOW_TOAST = 'SHOW_TOAST',

  // P2P Espionage
  P2P_SPY_REQUEST = 'P2P_SPY_REQUEST',
  P2P_SPY_RESPONSE = 'P2P_SPY_RESPONSE'
}

// Mapeo estricto de Evento -> Datos
export type GameEventPayloads = {
  [GameEventType.STATE_CHANGE]: void; // Señal genérica de actualización
  [GameEventType.ERROR_OCCURRED]: { code: string; message: string };
  
  [GameEventType.ADD_LOG]: { 
    messageKey: string; 
    type: LogEntry['type']; 
    params?: any;
  };
  
  [GameEventType.UI_POPUP]: { title: string; content: React.ReactNode };

  [GameEventType.MISSION_COMPLETED]: { missionId: string; success: boolean };
  [GameEventType.RESEARCH_COMPLETED]: { techId: string };
  [GameEventType.BUILDING_COMPLETED]: { buildingId: string; level: number };
  
  [GameEventType.INCOMING_P2P_ATTACK]: any; // import { P2PAttackRequest } from './multiplayer'; causes circular deps? Let's use any for now
  [GameEventType.P2P_BATTLE_RESULT]: any;
  [GameEventType.SHOW_TOAST]: { message: string; type?: 'success' | 'error' | 'info' | 'warning'; duration?: number };

  [GameEventType.P2P_SPY_REQUEST]: any;
  [GameEventType.P2P_SPY_RESPONSE]: any;
}

export type GameEventCallback<T extends GameEventType> = (payload: GameEventPayloads[T]) => void;