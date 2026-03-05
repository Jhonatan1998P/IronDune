import { useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useMultiplayer } from './useMultiplayer';
import { P2PAttackRequest, P2PAttackResult, P2PBattleRequestTroops, P2PBattleDefenderTroops } from '../types/multiplayer';
import { IncomingAttack } from '../types/state';
import { gameEventBus } from '../utils/eventBus';
import type { UnitType, BuildingType } from '../types/enums';

// ============================================================================
// Verificación de Integridad del resultado de batalla
// ============================================================================

const countUnits = (units: Partial<Record<string, number>>): number =>
  Object.values(units).reduce((a: number, b) => a + (b || 0), 0);

const verifyBattleResult = (
  result: P2PAttackResult,
  myUnits: Record<UnitType, number>,
  myBuildings: Record<BuildingType, { level: number }>
): { valid: boolean; reason?: string } => {
  // 1. Las bajas reclamadas no pueden superar las tropas actuales del defensor
  const claimedCasualties = countUnits(result.defenderCasualties || {});
  const myCurrentUnits = countUnits(myUnits);

  if (claimedCasualties > myCurrentUnits) {
    return { valid: false, reason: `Invalid defender casualties (${claimedCasualties}) > current units (${myCurrentUnits})` };
  }

  // 2. Edificios robados solo si el atacante ganó (winner === 'PLAYER')
  if (result.winner === 'PLAYER' && result.stolenBuildings) {
    for (const [bType, count] of Object.entries(result.stolenBuildings)) {
      const myCount = myBuildings[bType as BuildingType]?.level || 0;
      if ((count as number) > myCount) {
        return { valid: false, reason: `Invalid building theft: exceeds buildings owned (${bType})` };
      }
    }
  }

  // 3. Si el atacante ganó, debe haber sobrevivientes en su ejército
  const attackerOriginal = countUnits(result.battleResult?.initialPlayerArmy || {});
  const attackerCasualtiesCount = countUnits(result.attackerCasualties || {});
  const attackerRemaining = attackerOriginal - attackerCasualtiesCount;

  if (result.winner === 'PLAYER' && attackerRemaining <= 0 && attackerOriginal > 0) {
    return { valid: false, reason: 'Inconsistent result: attacker claimed victory but has no survivors' };
  }

  return { valid: true };
};

export const useP2PGameSync = () => {
  const { addP2PIncomingAttack, applyP2PBattleResult, gameState } = useGame();
  const { sendToPeer, localPlayerId } = useMultiplayer();

  // Refs para evitar closures stale en los listeners del eventBus
  const gameStateRef = useRef(gameState);
  const localPlayerIdRef = useRef(localPlayerId);
  const sendToPeerRef = useRef(sendToPeer);
  const applyP2PBattleResultRef = useRef(applyP2PBattleResult);
  const addP2PIncomingAttackRef = useRef(addP2PIncomingAttack);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { localPlayerIdRef.current = localPlayerId; }, [localPlayerId]);
  useEffect(() => { sendToPeerRef.current = sendToPeer; }, [sendToPeer]);
  useEffect(() => { applyP2PBattleResultRef.current = applyP2PBattleResult; }, [applyP2PBattleResult]);
  useEffect(() => { addP2PIncomingAttackRef.current = addP2PIncomingAttack; }, [addP2PIncomingAttack]);

  // Convertir ataque P2P a formato IncomingAttack
  // IMPORTANTE: Rebasamos los timestamps al reloj LOCAL del defensor para evitar
  // desincronización cuando los relojes de los jugadores difieren.
  // Solo preservamos la duración del viaje (endTime - startTime) y la aplicamos
  // al Date.now() del defensor.
  const convertToIncomingAttack = (request: P2PAttackRequest): IncomingAttack => {
    const travelDuration = request.endTime - request.startTime;
    const now = Date.now();

    return {
      id: request.attackId,
      attackerName: request.attackerName,
      attackerScore: request.attackerScore,
      units: request.units,
      startTime: now,
      endTime: now + travelDuration,
      isP2P: true,
      attackerId: request.attackerId,
      isScouted: false,
    };
  };

  // Registrar listeners UNA sola vez — usan refs internamente para datos frescos
  useEffect(() => {
    const handleIncomingAttack = (payload: any) => {
      const request = payload as P2PAttackRequest;
      const attack = convertToIncomingAttack(request);
      addP2PIncomingAttackRef.current(attack);
    };

    const handleBattleResult = (payload: any) => {
      const result = payload as P2PAttackResult;
      const gs = gameStateRef.current;

      // Verificar integridad antes de aplicar
      const verification = verifyBattleResult(result, gs.units, gs.buildings);
      if (!verification.valid) {
        console.warn('[P2PGameSync] Battle result rejected:', verification.reason, result);
        return;
      }

      // Aplicar como defensor
      applyP2PBattleResultRef.current(result, false);
    };

    const handleRequestTroops = (payload: any) => {
      const request = payload as P2PBattleRequestTroops;
      const gs = gameStateRef.current;
      const myId = localPlayerIdRef.current;

      const senderPeerId: string | undefined = (payload as any)._senderPeerId;

      console.log('[P2PGameSync] REQUEST_TROOPS received — attackId:', request.attackId,
        'targetId:', request.targetId, 'myId:', myId, 'senderPeerId:', senderPeerId);

      const hasAttack = gs.incomingAttacks.some(a => a.id === request.attackId);
      if (!hasAttack) {
          console.log('[P2PGameSync] Attack not found in incomingAttacks, responding anyway (Trystero routing guarantees target)');
      }

      const snapshot: Partial<Record<UnitType, number>> = {};
      for (const [k, v] of Object.entries(gs.units)) {
        if (v > 0) snapshot[k as UnitType] = v;
      }

      const reply: P2PBattleDefenderTroops = {
        type: 'P2P_BATTLE_DEFENDER_TROOPS',
        attackId: request.attackId,
        attackerId: request.attackerId,
        defenderId: myId || 'UNKNOWN_DEFENDER',
        defenderUnits: snapshot,
        timestamp: Date.now(),
      };

      const replyTarget = senderPeerId || request.attackerId;
      sendToPeerRef.current(replyTarget, {
        type: 'P2P_BATTLE_DEFENDER_TROOPS',
        payload: reply,
        playerId: myId || '',
        timestamp: Date.now(),
      });
    };

    const handleChatMessage = (payload: any) => {
      try {
        const saved = localStorage.getItem('ironDuneP2PChatMessages');
        let messages = saved ? JSON.parse(saved) : [];
        
        const newMessage = {
          id: `${payload.playerId}-${payload.timestamp}`,
          senderId: payload.playerId,
          senderName: payload.senderName || 'Jugador Desconocido',
          text: payload.text,
          timestamp: payload.timestamp,
          isLocal: false,
        };

        if (!messages.some((m: any) => m.id === newMessage.id)) {
          messages.push(newMessage);
          messages = messages.slice(-20);
          localStorage.setItem('ironDuneP2PChatMessages', JSON.stringify(messages));
          // Emitir un evento secundario para que la UI se actualice si está abierta
          gameEventBus.emit('LOCAL_CHAT_UPDATED' as any, messages);

          // Detectar mención @playerName
          const myName = gameStateRef.current.playerName;
          if (myName) {
            // Escapar caracteres especiales de regex
            const escapedName = myName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Usar lookahead en lugar de \b para manejar nombres con caracteres no-ASCII
            const mentionPattern = new RegExp(`@${escapedName}(?=[^\\w]|$)`, 'i');
            const messageText = payload.text ?? '';
            if (mentionPattern.test(messageText)) {
              const senderName = payload.senderName || 'Jugador Desconocido';
              gameEventBus.emit('SHOW_TOAST' as any, {
                message: `${senderName} te ha mencionado en el chat`,
                type: 'info',
              });
            }
          }
        }
      } catch (e) {
        console.error('Error saving background chat message:', e);
      }
    };

    gameEventBus.on('INCOMING_P2P_ATTACK' as any, handleIncomingAttack);
    gameEventBus.on('P2P_BATTLE_RESULT' as any, handleBattleResult);
    gameEventBus.on('P2P_BATTLE_REQUEST_TROOPS' as any, handleRequestTroops);
    gameEventBus.on('P2P_CHAT_MESSAGE' as any, handleChatMessage);

    return () => {
      gameEventBus.off('INCOMING_P2P_ATTACK' as any, handleIncomingAttack);
      gameEventBus.off('P2P_BATTLE_RESULT' as any, handleBattleResult);
      gameEventBus.off('P2P_BATTLE_REQUEST_TROOPS' as any, handleRequestTroops);
      gameEventBus.off('P2P_CHAT_MESSAGE' as any, handleChatMessage);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo una vez — datos frescos vienen de los refs

  return { convertToIncomingAttack };
};
