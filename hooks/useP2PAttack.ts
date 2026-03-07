import { useMultiplayer } from './useMultiplayer';
import { P2PAttackRequest, P2PAttackResult } from '../types/multiplayer';

export const useP2PAttack = () => {
  const { sendToPeer } = useMultiplayer();

  // Enviar ataque P2P a un jugador específico
  const sendAttack = (
    targetPeerId: string,
    attack: Omit<P2PAttackRequest, 'type' | 'timestamp' | 'clientSentTime'>
  ) => {
    const clientSentTime = Date.now();
    const action: P2PAttackRequest = {
      ...attack,
      type: 'P2P_ATTACK_REQUEST',
      timestamp: clientSentTime, // Usar el mismo valor para evitar discrepancia
      clientSentTime,
    };
    
    console.log('[P2PAttack] Sending attack:', {
      attackId: attack.attackId,
      startTime: attack.startTime,
      endTime: attack.endTime,
      travelDuration: attack.endTime - attack.startTime,
      clientSentTime,
    });
    
    sendToPeer(targetPeerId, {
      type: 'P2P_ATTACK',
      payload: action,
      playerId: attack.attackerId,
      timestamp: clientSentTime,
    });
  };

  // Enviar resultado de batalla al defensor
  const sendBattleResult = (
    targetPeerId: string,
    result: P2PAttackResult
  ) => {
    sendToPeer(targetPeerId, {
      type: 'P2P_BATTLE_RESULT',
      payload: result,
      playerId: result.attackerId,
      timestamp: Date.now(),
    });
  };

  return { sendAttack, sendBattleResult };
};
