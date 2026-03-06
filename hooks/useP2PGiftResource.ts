import { useCallback, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useMultiplayer } from './useMultiplayer';
import { gameEventBus } from '../utils/eventBus';
import { MultiplayerActionType, GiftResourcePayload } from '../types/multiplayer';
import { ResourceType } from '../types/enums';
import { calculateTechMultipliers, calculateProductionRates } from '../utils/engine/modifiers';

// ============================================================================
// Constantes
// ============================================================================

const GIFT_LIMIT_KEY = 'ironDuneP2PGiftLimits';
const HOURS_OF_PRODUCTION = 4;     // límite = 4h de producción
const RESET_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas en ms

type GiftableResource = 'OIL' | 'GOLD' | 'AMMO';

interface GiftLimitState {
  resetAt: number;
  OIL: number;
  GOLD: number;
  AMMO: number;
}

// ============================================================================
// Helpers de persistencia
// ============================================================================

const loadGiftLimits = (): GiftLimitState => {
  try {
    const raw = localStorage.getItem(GIFT_LIMIT_KEY);
    if (!raw) return { resetAt: Date.now() + RESET_INTERVAL_MS, OIL: 0, GOLD: 0, AMMO: 0 };
    const parsed: GiftLimitState = JSON.parse(raw);
    // Si el período de 24 h ha pasado, resetear
    if (Date.now() >= parsed.resetAt) {
      return { resetAt: Date.now() + RESET_INTERVAL_MS, OIL: 0, GOLD: 0, AMMO: 0 };
    }
    return parsed;
  } catch {
    return { resetAt: Date.now() + RESET_INTERVAL_MS, OIL: 0, GOLD: 0, AMMO: 0 };
  }
};

const saveGiftLimits = (state: GiftLimitState) => {
  try {
    localStorage.setItem(GIFT_LIMIT_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

// ============================================================================
// Hook
// ============================================================================

export const useP2PGiftResource = () => {
  const { gameState, receiveP2PResource, deductLocalResource } = useGame();
  const { sendToPeer, localPlayerId, isConnected } = useMultiplayer();

  // Ref para acceder a las funciones más recientes en el listener del eventBus
  const receiveP2PResourceRef = useRef(receiveP2PResource);
  const deductLocalResourceRef = useRef(deductLocalResource);
  useEffect(() => { receiveP2PResourceRef.current = receiveP2PResource; }, [receiveP2PResource]);
  useEffect(() => { deductLocalResourceRef.current = deductLocalResource; }, [deductLocalResource]);

  // Escuchar recursos recibidos de otros jugadores
  useEffect(() => {
    const handleReceive = (payload: { resource: string; amount: number; senderName: string }) => {
      const resourceType = payload.resource as ResourceType;
      const validResources: ResourceType[] = [ResourceType.OIL, ResourceType.GOLD, ResourceType.AMMO];
      if (!validResources.includes(resourceType) || payload.amount <= 0) return;

      receiveP2PResourceRef.current(resourceType, payload.amount);

      const resourceLabel: Record<GiftableResource, string> = { OIL: 'petróleo', GOLD: 'oro', AMMO: 'munición' };
      const label = resourceLabel[payload.resource as GiftableResource] ?? payload.resource;
      gameEventBus.emit('SHOW_TOAST' as any, {
        message: `${payload.senderName} te envió ${Math.floor(payload.amount).toLocaleString()} ${label}`,
        type: 'success',
      });
    };

    gameEventBus.on('RECEIVE_P2P_RESOURCE' as any, handleReceive);
    return () => gameEventBus.off('RECEIVE_P2P_RESOURCE' as any, handleReceive);
  }, []);

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
      senderName: gameState.playerName || 'Aliado',
    };
    sendToPeer(targetPeerId, {
      type: MultiplayerActionType.GIFT_RESOURCE,
      payload,
      playerId: localPlayerId,
      timestamp: Date.now(),
    });

    return { success: true };
  }, [isConnected, localPlayerId, gameState.resources, gameState.playerName, getRemainingLimit, sendToPeer]);

  return {
    sendResource,
    getRemainingLimit,
    getTotalCap,
    getAlreadySent,
    getMsUntilReset,
  };
};
