import { BattleResult } from './state';
import { UnitType, ResourceType, BuildingType } from './enums';

/**
 * Tipos para el sistema multijugador P2P con Trystero
 * Basado en MULTIPLAYER_ARCHITECTURE.md
 */

/**
 * Presencia de un jugador en la sala
 */
export interface PlayerPresence {
  id: string;        // playerId único
  name: string;      // Nombre del jugador
  level: number;     // Nivel del jugador (empirePoints)
  lastSeen: number;  // Timestamp de última actualización
}

/**
 * Payload para acción de regalo de oro
 */
export interface GiftGoldPayload {
  amount: number;
}

/**
 * Payload para acción de mensaje de chat
 */
export interface ChatMessagePayload {
  text: string;
  senderName: string;
}

/**
 * Acción multijugador para comunicación entre peers
 * Nota: payload debe ser JSON-serializable para Trystero
 */
export interface MultiplayerAction {
  type: string;      // 'PRESENCE_UPDATE', 'REQUEST_PRESENCE', 'GIFT_GOLD', 'CHAT_MESSAGE', etc.
  payload: PlayerPresence | GiftGoldPayload | ChatMessagePayload | P2PAttackRequest | P2PAttackResult | any | null;  // Datos de la acción (debe ser JSON-serializable)
  playerId: string;  // Quién envía
  timestamp: number; // Cuándo
  playerName?: string;
  playerLevel?: number;
}

/**
 * Tipo compatible con Trystero's DataPayload
 */
export type TrysteroPayload = {
  [key: string]: string | number | boolean | null | undefined;
};

/**
 * Estado del hook useMultiplayer
 */
export interface UseMultiplayerReturn {
  // Estado
  isInitialized: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  peers: string[];                    // IDs de peers conectados
  localPlayerId: string | null;       // Tu playerId
  remotePlayers: PlayerPresence[];    // Jugadores remotos
  currentRoomId: string | null;       // roomId actual

  // Funciones de conexión
  createRoom: (roomId?: string) => string;     // Crea sala, retorna roomId (opcionalmente acepta roomId)
  joinRoomById: (roomId: string) => boolean;   // Unirse a sala
  leave: () => void;                           // Salir de sala
  reconnect: () => boolean;                    // Reconectar a última sala

  // Sincronización
  syncPlayer: (player: { name: string; level: number }) => void; // Actualizar tu presencia
  syncPlayerWithData: (playerName: string, empirePoints: number) => void; // Actualizar con datos directos

  // Comunicación
  broadcastAction: (action: MultiplayerAction) => void; // A todos
  sendToPeer: (peerId: string, action: MultiplayerAction) => void; // A uno
  onRemoteAction: (callback: (action: MultiplayerAction) => void) => void; // Escuchar
}

/**
 * Tipos de acciones built-in del sistema
 */
export enum MultiplayerActionType {
  PRESENCE_UPDATE = 'PRESENCE_UPDATE',
  REQUEST_PRESENCE = 'REQUEST_PRESENCE',
  GIFT_GOLD = 'GIFT_GOLD',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  // P2P Battle Actions
  BATTLE_CHALLENGE = 'BATTLE_CHALLENGE',
  BATTLE_ACCEPT = 'BATTLE_ACCEPT',
  BATTLE_DECLINE = 'BATTLE_DECLINE',
  BATTLE_ARMY_LOCK = 'BATTLE_ARMY_LOCK',
  BATTLE_RESULT_SYNC = 'BATTLE_RESULT_SYNC',
  BATTLE_CANCEL = 'BATTLE_CANCEL',
}

/**
 * Payload para acción de regalo de oro (duplicate removed)
 */

// ============================================================================
// P2P BATTLE SYSTEM TYPES
// ============================================================================

/**
 * Estado de una batalla P2P
 */
export type P2PBattleStatus =
  | 'IDLE'           // No hay batalla activa
  | 'CHALLENGING'    // Enviamos desafío, esperando respuesta
  | 'CHALLENGED'     // Recibimos desafío, debemos responder
  | 'PREPARING'      // Ambos aceptaron, seleccionando ejército
  | 'LOCKED'         // Ejército seleccionado y confirmado
  | 'WAITING_LOCK'   // Esperando que el oponente confirme ejército
  | 'RESOLVING'      // Ambos confirmaron, resolviendo combate
  | 'RESULT'         // Resultado disponible
  | 'CANCELLED';     // Batalla cancelada

/**
 * Payload de un desafío de batalla P2P
 */
export interface BattleChallengePayload {
  battleId: string;
  challengerName: string;
  challengerScore: number;
  challengerPeerId: string;
}

/**
 * Payload de aceptación de batalla
 */
export interface BattleAcceptPayload {
  battleId: string;
  accepterName: string;
  accepterScore: number;
  accepterPeerId: string;
}

/**
 * Payload de rechazo de batalla
 */
export interface BattleDeclinePayload {
  battleId: string;
  reason?: string;
}

/**
 * Payload de ejército confirmado para batalla
 */
export interface BattleArmyLockPayload {
  battleId: string;
  army: Record<string, number>; // UnitType -> count (serializado como string keys)
  totalPower: number;
}

/**
 * Payload de resultado sincronizado de batalla
 */
export interface BattleResultSyncPayload {
  battleId: string;
  winner: 'PLAYER' | 'ENEMY' | 'DRAW';
  attackerArmy: Record<string, number>;
  defenderArmy: Record<string, number>;
  attackerSurvivors: Record<string, number>;
  defenderSurvivors: Record<string, number>;
  attackerCasualties: Record<string, number>;
  defenderCasualties: Record<string, number>;
  rounds: number;
  seed: number; // Seed determinística para reproducir la batalla
}

/**
 * Payload de cancelación de batalla
 */
export interface BattleCancelPayload {
  battleId: string;
  reason: string;
}

/**
 * Estado completo de una batalla P2P activa
 */
export interface P2PBattleState {
  battleId: string;
  status: P2PBattleStatus;
  opponentPeerId: string;
  opponentName: string;
  opponentScore: number;
  isChallenger: boolean; // true si nosotros iniciamos el desafío
  myArmy: Record<string, number> | null;
  opponentArmy: Record<string, number> | null;
  myArmyLocked: boolean;
  opponentArmyLocked: boolean;
  result: BattleResultSyncPayload | null;
  startedAt: number;
  resolvedAt: number | null;
}

/**
 * Historial de batallas P2P
 */
export interface P2PBattleRecord {
  battleId: string;
  opponentName: string;
  opponentScore: number;
  winner: 'PLAYER' | 'ENEMY' | 'DRAW';
  myArmy: Record<string, number>;
  opponentArmy: Record<string, number>;
  myCasualties: Record<string, number>;
  opponentCasualties: Record<string, number>;
  timestamp: number;
}

/**
 * Yjs shared state structure for a P2P battle room
 */
export interface YjsBattleDocument {
  battleId: string;
  participants: string[]; // peerId[]
  armies: Record<string, Record<string, number>>; // peerId -> army
  locks: Record<string, boolean>; // peerId -> locked
  result: BattleResultSyncPayload | null;
  phase: P2PBattleStatus;
  createdAt: number;
}

// ============================================================================
// P2P ASYNC ATTACK SYSTEM TYPES
// ============================================================================


export interface P2PAttackRequest {
  type: 'P2P_ATTACK_REQUEST';
  attackId: string;
  attackerId: string;
  attackerName: string;
  attackerScore: number;
  units: Partial<Record<UnitType, number>>;
  targetId: string;          // ID del jugador defensor
  startTime: number;
  endTime: number;           // Tiempo de viaje (ej: 7.5 minutos)
  timestamp: number;
}

export interface P2PAttackResult {
  type: 'P2P_ATTACK_RESULT';
  attackId: string;
  attackerId: string;
  defenderId: string;
  battleResult: BattleResult; 
  
  // IMPORTANTE: Ambos bandos siempre tienen bajas
  attackerCasualties: Partial<Record<UnitType, number>>;  // Bajas del atacante
  defenderCasualties: Partial<Record<UnitType, number>>;  // Bajas del defensor
  
  // Loot: SOLO si el atacante GANA
  loot?: Partial<Record<ResourceType, number>>;
  stolenBuildings?: Partial<Record<BuildingType, number>>;
  
  winner: 'PLAYER' | 'ENEMY' | 'DRAW';
  timestamp: number;
}
