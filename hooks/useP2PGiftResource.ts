import { useCallback, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useMultiplayer } from './useMultiplayer';
import { useLanguage } from '../context/LanguageContext';
import { gameEventBus } from '../utils/eventBus';
import { MultiplayerActionType, GiftResourcePayload } from '../types/multiplayer';
import { ResourceType } from '../types/enums';
import { GameEventType } from '../types/events';
import { calculateTechMultipliers, calculateProductionRates } from '../utils/engine/modifiers';

// ============================================================================
// Constantes
// ============================================================================

const HOURS_OF_PRODUCTION = 4;     // límite = 4h de producción
const RESET_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas en ms

type GiftableResource = 'OIL' | 'GOLD' | 'AMMO';

interface GiftLimitState {
  resetAt: number;
  OIL: number;
  GOLD: number;
  AMMO: number;
}

let inMemoryGiftLimits: GiftLimitState = { resetAt: Date.now() + RESET_INTERVAL_MS, OIL: 0, GOLD: 0, AMMO: 0 };

// ============================================================================
// Helpers de persistencia
// ============================================================================

const loadGiftLimits = (): GiftLimitState => {
  if (Date.now() >= inMemoryGiftLimits.resetAt) {
    inMemoryGiftLimits = { resetAt: Date.now() + RESET_INTERVAL_MS, OIL: 0, GOLD: 0, AMMO: 0 };
  }
  return inMemoryGiftLimits;
};

const saveGiftLimits = (state: GiftLimitState) => {
  inMemoryGiftLimits = state;
};

// ============================================================================
// Hook
// ============================================================================

export const useP2PGiftResource = () => {
  const { gameState, receiveP2PResource, deductLocalResource } = useGame();
  const { sendToPeer, localPlayerId, isConnected, remotePlayers } = useMultiplayer();
  const { t } = useLanguage();

  // Ref para acceder a las funciones más recientes en el listener del eventBus
  const receiveP2PResourceRef = useRef(receiveP2PResource);
  const deductLocalResourceRef = useRef(deductLocalResource);
  const gameStateRef = useRef(gameState);
  const remotePlayersRef = useRef(remotePlayers);
  
  useEffect(() => { receiveP2PResourceRef.current = receiveP2PResource; }, [receiveP2PResource]);
  useEffect(() => { deductLocalResourceRef.current = deductLocalResource; }, [deductLocalResource]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { remotePlayersRef.current = remotePlayers; }, [remotePlayers]);

  // Escuchar recursos recibidos de otros jugadores
  useEffect(() => {
    const handleReceive = (payload: { resource: string; amount: number; senderName: string }) => {
      const resourceType = payload.resource as ResourceType;
      const validResources: ResourceType[] = [ResourceType.OIL, ResourceType.GOLD, ResourceType.AMMO];
      if (!validResources.includes(resourceType) || payload.amount <= 0) return;

      receiveP2PResourceRef.current(resourceType, payload.amount);

      const label = t.common.resources[payload.resource] || payload.resource;
      const formattedAmount = Math.floor(payload.amount).toLocaleString();

      // Notificación Toast
      gameEventBus.emit('SHOW_TOAST' as any, {
        message: (t.common.actions as any).toast_p2p_gift_received
          .replace('{senderName}', payload.senderName)
          .replace('{amount}', formattedAmount)
          .replace('{resource}', label),
        type: 'success',
      });

      // Añadir Log al historial
      gameEventBus.emit(GameEventType.ADD_LOG, {
        messageKey: 'log_p2p_gift_received',
        type: 'info',
        params: {
          senderName: payload.senderName,
          amount: formattedAmount,
          resource: label
        }
      });
    };

    gameEventBus.on('RECEIVE_P2P_RESOURCE' as any, handleReceive);
    return () => gameEventBus.off('RECEIVE_P2P_RESOURCE' as any, handleReceive);
  }, [t]);

  /**
   * Calcula la tasa de producción por segundo de un recurso dado el estado actual del jugador.
   * Devuelve unidades/segundo.
   */
  const getProductionRatePerSecond = useCallback((resource: GiftableResource): number => {
    const multipliers = calculateTechMultipliers(gameState.researchedTechs, gameState.techLevels);
    const rates = calculateProductionRates(gameState.buildings, multipliers);
    const resourceType = ResourceType[resource];
    return rates[resourceType] ?? 0;
  }, [gameState.researchedTechs, gameState.techLevels, gameState.buildings]);

  /**
   * Calcula el límite máximo a enviar en las próximas 24h (4h de producción),
   * restando lo ya enviado en el período actual.
   */
  const getRemainingLimit = useCallback((resource: GiftableResource): number => {
    const ratePerSec = getProductionRatePerSecond(resource);
    const cap = Math.floor(ratePerSec * HOURS_OF_PRODUCTION * 3600);
    const limits = loadGiftLimits();
    const alreadySent = limits[resource] ?? 0;
    return Math.max(0, cap - alreadySent);
  }, [getProductionRatePerSecond]);

  /**
   * Devuelve el cap total (4h de producción) sin descontar lo enviado.
   */
  const getTotalCap = useCallback((resource: GiftableResource): number => {
    const ratePerSec = getProductionRatePerSecond(resource);
    return Math.floor(ratePerSec * HOURS_OF_PRODUCTION * 3600);
  }, [getProductionRatePerSecond]);

  /**
   * Devuelve cuánto se ha enviado ya en el período actual.
   */
  const getAlreadySent = useCallback((resource: GiftableResource): number => {
    return loadGiftLimits()[resource] ?? 0;
  }, []);

  /**
   * Devuelve cuántos ms faltan para el próximo reset de 24h.
   */
  const getMsUntilReset = useCallback((): number => {
    const limits = loadGiftLimits();
    return Math.max(0, limits.resetAt - Date.now());
  }, []);

  /**
   * Envía recursos a un peer conectado específico.
   * Descuenta de los propios recursos del jugador y persiste el límite.
   * @returns { success: boolean; reason?: string }
   */
  const sendResource = useCallback((resource: GiftableResource, amount: number, targetPeerId: string): { success: boolean; reason?: string } => {
    if (!isConnected || !localPlayerId) {
      return { success: false, reason: 'No conectado' };
    }
    if (!targetPeerId) {
      return { success: false, reason: 'Debes seleccionar un jugador' };
    }
    if (amount <= 0) {
      return { success: false, reason: 'Cantidad inválida' };
    }

    const resourceType = ResourceType[resource];
    const currentAmount = gameState.resources[resourceType] ?? 0;
    if (currentAmount < amount) {
      return { success: false, reason: 'Recursos insuficientes' };
    }

    const remaining = getRemainingLimit(resource);
    if (amount > remaining) {
      return { success: false, reason: `Límite diario superado (quedan ${Math.floor(remaining).toLocaleString()})` };
    }

    // Descontar del propio inventario
    deductLocalResourceRef.current(resourceType, amount);

    // Persistir límite
    const limits = loadGiftLimits();
    limits[resource] = (limits[resource] ?? 0) + amount;
    saveGiftLimits(limits);

    // Enviar al peer específico
    const payload: GiftResourcePayload = {
      resource,
      amount,
      senderName: gameStateRef.current.playerName || 'Aliado',
    };
    sendToPeer(targetPeerId, {
      type: MultiplayerActionType.GIFT_RESOURCE,
      payload,
      playerId: localPlayerId,
      timestamp: Date.now(),
    });

    // Notificaciones locales para el emisor
    const label = t.common.resources[resource] || resource;
    const formattedAmount = Math.floor(amount).toLocaleString();
    const targetPlayer = remotePlayersRef.current?.find((p: any) => p.id === targetPeerId);
    const targetName = targetPlayer?.name || 'Comandante';

    gameEventBus.emit('SHOW_TOAST' as any, {
      message: (t.common.actions as any).toast_p2p_gift_sent
        .replace('{targetName}', targetName)
        .replace('{amount}', formattedAmount)
        .replace('{resource}', label),
      type: 'success',
    });

    gameEventBus.emit(GameEventType.ADD_LOG, {
      messageKey: 'log_p2p_gift_sent',
      type: 'info',
      params: {
        targetName,
        amount: formattedAmount,
        resource: label
      }
    });

    return { success: true };
  }, [isConnected, localPlayerId, getRemainingLimit, sendToPeer, t]);

  return {
    sendResource,
    getRemainingLimit,
    getTotalCap,
    getAlreadySent,
    getMsUntilReset,
  };
};
