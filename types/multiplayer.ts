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
 * Acción multijugador para comunicación entre peers
 * Nota: payload debe ser JSON-serializable para Trystero
 */
export interface MultiplayerAction {
  type: string;      // 'PRESENCE_UPDATE', 'REQUEST_PRESENCE', 'GIFT_GOLD', etc.
  payload: PlayerPresence | GiftGoldPayload | null;  // Datos de la acción (debe ser JSON-serializable)
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
  createRoom: () => string;           // Crea sala, retorna roomId
  joinRoomById: (roomId: string) => boolean; // Unirse a sala
  leave: () => void;                  // Salir de sala
  reconnect: () => boolean;           // Reconectar a última sala

  // Sincronización
  syncPlayer: (player: { name: string; level: number }) => void; // Actualizar tu presencia

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
}

/**
 * Payload para acción de regalo de oro
 */
export interface GiftGoldPayload {
  amount: number;
}
