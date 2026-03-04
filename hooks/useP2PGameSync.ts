import { useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { P2PAttackRequest, P2PAttackResult } from '../types/multiplayer';
import { IncomingAttack } from '../types/state';
import { gameEventBus } from '../utils/eventBus';
import type { UnitType, BuildingType } from '../types/enums';

// ============================================================================
// FASE 8: Verificación de Integridad
// ============================================================================

const countUnits = (units: Partial<Record<string, number>>): number => {
  return Object.values(units).reduce((a: number, b) => a + (b || 0), 0);
};

const verifyBattleResult = (
  result: P2PAttackResult,
  myUnits: Record<UnitType, number>,
  myBuildings: Record<BuildingType, { level: number }>
): { valid: boolean; reason?: string } => {
  // 1. Verificar que las bajas del defensor no excedan sus tropas actuales
  const claimedCasualties = countUnits(result.defenderCasualties || {});
  const myCurrentUnits = countUnits(myUnits);

  if (claimedCasualties > myCurrentUnits) {
    return { valid: false, reason: 'Invalid defender casualties: exceeds current units' };
  }

  // 2. Verificar edificios robados (solo si el atacante ganó)
  if (result.winner === 'ENEMY' && result.stolenBuildings) {
    for (const [bType, count] of Object.entries(result.stolenBuildings)) {
      const myCount = myBuildings[bType as BuildingType]?.level || 0;
      if ((count as number) > myCount) {
        return { valid: false, reason: `Invalid building theft: exceeds buildings owned (${bType})` };
      }
    }
  }

  // 3. Verificar consistencia: si dice que ganó el atacante pero no le quedan tropas
  const enemyOriginal = countUnits(result.battleResult?.initialPlayerArmy || {});
  const enemyCasualtiesCount = countUnits(result.attackerCasualties || {});
  const enemyRemaining = enemyOriginal - enemyCasualtiesCount;

  if (result.winner === 'ENEMY' && enemyRemaining <= 0 && enemyOriginal > 0) {
    return { valid: false, reason: 'Inconsistent result: attacker won but has no survivors' };
  }

  return { valid: true };
};

export const useP2PGameSync = () => {
  const { addP2PIncomingAttack, applyP2PBattleResult, gameState } = useGame();

  // Convertir ataque P2P a formato IncomingAttack
  const convertToIncomingAttack = (request: P2PAttackRequest): IncomingAttack => {
    return {
      id: request.attackId,
      attackerName: request.attackerName,
      attackerScore: request.attackerScore,
      units: request.units,
      startTime: request.startTime,
      endTime: request.endTime,
      isP2P: true,
      attackerId: request.attackerId,
      isScouted: false, // El defensor debe espiar para ver tropas
    };
  };

  useEffect(() => {
    const handleIncomingAttack = (payload: any) => {
      const request = payload as P2PAttackRequest;
      const attack = convertToIncomingAttack(request);
      addP2PIncomingAttack(attack);
    };

    const handleBattleResult = (payload: any) => {
      const result = payload as P2PAttackResult;

      // FASE 8: Verificar integridad antes de aplicar
      const verification = verifyBattleResult(
        result,
        gameState.units,
        gameState.buildings
      );

      if (!verification.valid) {
        console.warn('[P2PGameSync] Battle result rejected:', verification.reason, result);
        return;
      }

      // Recibimos resultado como defensores (ya que nosotros recibimos el P2P_BATTLE_RESULT)
      applyP2PBattleResult(result, false);
    };

    gameEventBus.on('INCOMING_P2P_ATTACK' as any, handleIncomingAttack);
    gameEventBus.on('P2P_BATTLE_RESULT' as any, handleBattleResult);

    return () => {
      gameEventBus.off('INCOMING_P2P_ATTACK' as any, handleIncomingAttack);
      gameEventBus.off('P2P_BATTLE_RESULT' as any, handleBattleResult);
    };
  }, [addP2PIncomingAttack, applyP2PBattleResult, gameState.units, gameState.buildings]);

  return { convertToIncomingAttack };
};
