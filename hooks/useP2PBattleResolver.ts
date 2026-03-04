/**
 * useP2PBattleResolver
 *
 * Lo usa el ATACANTE para:
 * 1. Detectar cuando sus misiones de tipo PVP_ATTACK llegan a endTime
 * 2. Obtener las tropas del DEFENSOR al momento del combate
 * 3. Calcular la batalla usando simulateCombat
 * 4. Enviar el resultado al defensor via P2P (sendBattleResult)
 * 5. Aplicar el resultado localmente (sus propias bajas y el loot si ganó)
 *
 * El DEFENSOR recibe el resultado via gameEventBus 'P2P_BATTLE_RESULT'
 * y lo aplica en useP2PGameSync.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { useMultiplayer } from './useMultiplayer';
import { simulateCombat } from '../utils/engine/combat';
import { P2PAttackResult, P2PBattleRequestTroops, P2PBattleDefenderTroops } from '../types/multiplayer';
import { UnitType, ResourceType } from '../types/enums';
import type { BuildingType } from '../types/enums';
import type { ActiveMission } from '../types/state';
import { gameEventBus } from '../utils/eventBus';

export const useP2PBattleResolver = () => {
    const { gameState, applyP2PBattleResult } = useGame();
    const { localPlayerId, sendToPeer, remotePlayers } = useMultiplayer();
    
    // Set to ensure we don't request twice for the same attack
    const requestedAttacksRef = useRef<Set<string>>(new Set());
    
    // Set to ensure we don't resolve twice for the same attack
    const resolvedAttacksRef = useRef<Set<string>>(new Set());
    
    // Almacena un timeout ID para limpiar ataques "huérfanos" (defensor desconectado)
    const timeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    // Función que resuelve finalmente el combate con las tropas reales (o estimadas en fallback)
    const executeBattleResolution = useCallback((mission: ActiveMission, defenderUnits: Partial<Record<UnitType, number>>) => {
        if (resolvedAttacksRef.current.has(mission.id)) return;
        resolvedAttacksRef.current.add(mission.id);

        console.log('[P2PBattleResolver] Executing final P2P battle for:', mission.id, 'with defender troops:', defenderUnits);

        const attackerUnits = mission.units;
        const targetScore = mission.targetScore || 1000;
        
        const battleResult = simulateCombat(attackerUnits, defenderUnits, 1.0);

        // Calcular loot (solo si el atacante gana)
        let loot: Partial<Record<ResourceType, number>> = {};
        const stolenBuildings: Partial<Record<BuildingType, number>> = {};

        if (battleResult.winner === 'PLAYER') {
            // El atacante (nosotros) ganó
            // Como el atacante no sabe los recursos reales del defensor a menos que los pida, 
            // usamos un estimado basado en su score para el botín
            loot = {
                [ResourceType.GOLD]: Math.floor(targetScore * 2),
                [ResourceType.OIL]: Math.floor(targetScore * 1.5),
                [ResourceType.MONEY]: Math.floor(targetScore * 1.5)
            };
        }

        const defenderId = mission.targetId || 'DEFENDER';
        
        const result: P2PAttackResult = {
            type: 'P2P_ATTACK_RESULT',
            attackId: mission.id,
            attackerId: localPlayerId || 'UNKNOWN_PEER',
            defenderId: defenderId,
            battleResult,
            attackerCasualties: battleResult.totalPlayerCasualties,
            defenderCasualties: battleResult.totalEnemyCasualties,
            loot,
            stolenBuildings,
            winner: battleResult.winner,
            timestamp: Date.now(),
        };

        // Enviar resultado al defensor via P2P
        const targetPeerId = defenderId;
        const peerExists = remotePlayers.some(p => p.id === targetPeerId);
        
        if (peerExists) {
            sendToPeer(targetPeerId, {
                type: 'P2P_BATTLE_RESULT',
                payload: result,
                playerId: localPlayerId || '',
                timestamp: Date.now(),
            });
        } else {
             // Si no está, broadcast de rescate
             for (const peerId of remotePlayers.map(p => p.id)) {
                sendToPeer(peerId, {
                    type: 'P2P_BATTLE_RESULT',
                    payload: result,
                    playerId: localPlayerId || '',
                    timestamp: Date.now(),
                });
            }
        }

        // Aplicar resultado localmente como atacante
        applyP2PBattleResult(result, true);

        console.log('[P2PBattleResolver] Battle resolved:', result.winner, 'attackId:', mission.id);
        
        // Limpiar timeout de fallback si existía
        if (timeoutRefs.current[mission.id]) {
            clearTimeout(timeoutRefs.current[mission.id]);
            delete timeoutRefs.current[mission.id];
        }

    }, [localPlayerId, remotePlayers, sendToPeer, applyP2PBattleResult]);

    // Función inicial para solicitar las tropas reales al defensor cuando llega el endTime
    const initiateP2PBattle = useCallback(async (mission: ActiveMission) => {
        if (mission.type !== 'PVP_ATTACK') return;
        if (requestedAttacksRef.current.has(mission.id)) return;

        requestedAttacksRef.current.add(mission.id);
        console.log('[P2PBattleResolver] Initiating P2P battle, requesting troops for:', mission.id);

        const defenderId = mission.targetId || 'DEFENDER';
        
        // Pedimos al defensor que nos pase sus tropas reales
        const requestTroopsPayload: P2PBattleRequestTroops = {
            type: 'P2P_BATTLE_REQUEST_TROOPS',
            attackId: mission.id,
            attackerId: localPlayerId || 'UNKNOWN_PEER',
            targetId: defenderId,
            timestamp: Date.now()
        };

        sendToPeer(defenderId, {
            type: 'P2P_BATTLE_REQUEST_TROOPS',
            payload: requestTroopsPayload,
            playerId: localPlayerId || '',
            timestamp: Date.now()
        });

        // Configurar un Fallback (por si el defensor se ha desconectado o huye de la batalla apagando la red)
        timeoutRefs.current[mission.id] = setTimeout(() => {
            if (resolvedAttacksRef.current.has(mission.id)) return;
            
            console.log(`[P2PBattleResolver] Timeout waiting for defender ${defenderId} on attack ${mission.id}. Using estimated troops as fallback.`);
            
            // Si el defensor nunca respondió (desconexión o abandono de sala), usamos el estimado inicial 
            const targetScore = mission.targetScore || 1000;
            const defenderEstimatedUnits: Partial<Record<UnitType, number>> = {
                [UnitType.CYBER_MARINE]: Math.floor(targetScore / 10),
                [UnitType.SCOUT_TANK]: Math.floor(targetScore / 50),
                [UnitType.TITAN_MBT]: Math.floor(targetScore / 150)
            };
            
            executeBattleResolution(mission, defenderEstimatedUnits);
        }, 8000); // 8 segundos de tolerancia para recibir respuesta
        
    }, [localPlayerId, sendToPeer, executeBattleResolution]);

    // Listener para recibir las tropas reales del defensor
    useEffect(() => {
        const handleDefenderTroops = (payload: any) => {
            const data = payload as P2PBattleDefenderTroops;
            if (data.attackerId !== localPlayerId) return;

            console.log('[P2PBattleResolver] Received real troops from defender for attack:', data.attackId);
            
            // Buscamos la misión local a la que pertenece
            const mission = (gameState.activeMissions || []).find(m => m.id === data.attackId);
            
            if (mission && !resolvedAttacksRef.current.has(mission.id)) {
                // Ejecutamos la batalla con las tropas REALES que nos acaba de mandar el defensor
                executeBattleResolution(mission, data.defenderUnits);
            }
        };

        gameEventBus.on('P2P_BATTLE_DEFENDER_TROOPS' as any, handleDefenderTroops);
        return () => {
            gameEventBus.off('P2P_BATTLE_DEFENDER_TROOPS' as any, handleDefenderTroops);
        };
    }, [gameState.activeMissions, executeBattleResolution, localPlayerId]);

    // Monitorear las activeMissions donde type === 'PVP_ATTACK' y ya venció el tiempo
    useEffect(() => {
        const now = Date.now();
        const outboundP2P = (gameState.activeMissions || []).filter(
            m => m.type === 'PVP_ATTACK' && m.endTime <= now
        );

        for (const mission of outboundP2P) {
            initiateP2PBattle(mission);
        }
    }, [gameState.activeMissions, initiateP2PBattle]);

    return { resolveP2PBattle: initiateP2PBattle };
};
