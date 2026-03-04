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
import { P2PAttackResult } from '../types/multiplayer';
import { UnitType } from '../types/enums';
import type { BuildingType, ResourceType } from '../types/enums';
import type { IncomingAttack } from '../types/state';



export const useP2PBattleResolver = () => {
    const { gameState, applyP2PBattleResult } = useGame();
    const { localPlayerId, sendToPeer, remotePlayers } = useMultiplayer();
    const resolvedAttacksRef = useRef<Set<string>>(new Set());

    const resolveP2PBattle = useCallback(async (attack: IncomingAttack) => {
        if (!attack.isP2P || !attack.attackerId) return;
        if (resolvedAttacksRef.current.has(attack.id)) return;

        // Solo el ATACANTE resuelve (comparamos attackerId con localPlayerId)
        if (attack.attackerId !== localPlayerId) return;

        resolvedAttacksRef.current.add(attack.id);
        console.log('[P2PBattleResolver] Resolving P2P battle as ATTACKER:', attack.id);

        // Las tropas atacantes son las del ataque
        const attackerUnits = attack.units;

        // Buscamos el peer del defensor en remotePlayers
        // El targetId no está en IncomingAttack, usamos attackerName para identificar.
        // En realidad nosotros somos el atacante, el defensor es quien recibió el ataque.
        // Necesitamos las tropas del defensor – no las tenemos directamente.
        // SOLUCIÓN: El defensor envía su estado al atacante cuando el ataque llega.
        // Por ahora, estimamos las tropas del defensor con el score (como lo hacen los bots).
        // Esto es una aproximación; la implementación completa requeriría intercambio de datos adicional.

        // Como aproximación simple y válida según el plan:
        // "El atacante calcula la batalla usando las tropas del defensor"
        // Usamos las tropas actuales del defensor desde remotePlayers (no disponible directamente).
        // Para esta fase, usamos las unidades del atacante vs. un ejército estimado del defensor.

        // Por ahora calculamos la batalla usando nuestras tropas como atacante
        // y asumimos que el defensor tiene 0 tropas (será actualizado cuando se implemente
        // el intercambio de datos del defensor via P2P).
        // TODO: El defensor debe enviar sus tropas al atacante cuando detecta el ataque.

        const defenderEstimatedUnits: Partial<Record<UnitType, number>> = {};

        const battleResult = simulateCombat(attackerUnits, defenderEstimatedUnits, 1.0);

        // Calcular loot (solo si el atacante gana)
        let loot: Partial<Record<ResourceType, number>> = {};
        let stolenBuildings: Partial<Record<BuildingType, number>> = {};
        void loot;
        void stolenBuildings;

        if (battleResult.winner === 'PLAYER') {
            // El atacante (nosotros) ganó
            // No tenemos los recursos del defensor, ponemos loot vacío por ahora
            loot = {};
            stolenBuildings = {};
        }

        const result: P2PAttackResult = {
            type: 'P2P_ATTACK_RESULT',
            attackId: attack.id,
            attackerId: attack.attackerId,
            defenderId: 'DEFENDER', // El defensor se identifica a sí mismo
            battleResult,
            attackerCasualties: battleResult.totalPlayerCasualties, // Bajas del atacante
            defenderCasualties: battleResult.totalEnemyCasualties,  // Bajas del defensor
            loot,
            stolenBuildings,
            winner: battleResult.winner,
            timestamp: Date.now(),
        };

        // Enviar resultado al defensor via P2P
        // Buscamos el peer que corresponde al defensor
        // El ataque tiene attackerId (nuestro ID), necesitamos el ID del defensor
        // Por ahora, broadcast a todos los peers (el defensor filtrará por attackId)
        const peers = remotePlayers.map(p => p.id);
        for (const peerId of peers) {
            sendToPeer(peerId, {
                type: 'P2P_BATTLE_RESULT',
                payload: result,
                playerId: localPlayerId || '',
                timestamp: Date.now(),
            });
        }

        // Aplicar resultado localmente como atacante
        applyP2PBattleResult(result, true);

        console.log('[P2PBattleResolver] Battle resolved:', result.winner, 'attackId:', attack.id);
    }, [gameState, localPlayerId, remotePlayers, sendToPeer, applyP2PBattleResult]);

    // Monitorear los incomingAttacks P2P donde somos el atacante
    useEffect(() => {
        const now = Date.now();
        const p2pAsAttacker = gameState.incomingAttacks.filter(
            a => a.isP2P && a.attackerId === localPlayerId && a.endTime <= now
        );

        for (const attack of p2pAsAttacker) {
            resolveP2PBattle(attack);
        }
    }, [gameState.incomingAttacks, localPlayerId, resolveP2PBattle]);

    return { resolveP2PBattle };
};
