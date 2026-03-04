import { useMultiplayer } from './useMultiplayer';
import { P2PAttackRequest, P2PAttackResult } from '../types/multiplayer';

export const useP2PAttack = () => {
  const { sendToPeer } = useMultiplayer();

  // Enviar ataque P2P a un jugador específico
  const sendAttack = (
    targetPeerId: string,
    attack: Omit<P2PAttackRequest, 'type' | 'timestamp'>
  ) => {
    const action: P2PAttackRequest = {
      ...attack,
      type: 'P2P_ATTACK_REQUEST',
      timestamp: Date.now(),
    };
    
    sendToPeer(targetPeerId, {
      type: 'P2P_ATTACK',
      payload: action,
      playerId: attack.attackerId,
      timestamp: Date.now(),
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
