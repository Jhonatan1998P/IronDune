/**
 * useP2PBattleResolver
 *
 * Lo usa el ATACANTE para:
 * 1. Detectar cuando sus misiones PVP_ATTACK llegan a endTime
 * 2. Solicitar las tropas REALES del defensor en ese instante (handshake)
 * 3. Calcular el combate con simulateCombat
 * 4. Enviar el resultado al defensor via P2P
 * 5. Aplicar el resultado localmente (devolver supervivientes + loot si ganó)
 */

import { useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useMultiplayer } from './useMultiplayer';
import { simulateCombat } from '../utils/engine/combat';
import { P2PAttackResult, P2PBattleRequestTroops, P2PBattleDefenderTroops } from '../types/multiplayer';
import { UnitType, ResourceType } from '../types/enums';
import type { BuildingType } from '../types/enums';
import type { ActiveMission } from '../types/state';
import { gameEventBus } from '../utils/eventBus';
import { useP2PAttackLimits } from './useP2PAttackLimits';

export const useP2PBattleResolver = () => {
    const { gameState, applyP2PBattleResult } = useGame();
    const { localPlayerId, sendToPeer, remotePlayers } = useMultiplayer();
    const { getAttackCount } = useP2PAttackLimits();

    // Refs siempre actualizados — evitan closures stale en los listeners
    const activeMissionsRef = useRef<ActiveMission[]>([]);
    const localPlayerIdRef = useRef(localPlayerId);
    const sendToPeerRef = useRef(sendToPeer);
    const remotePlayersRef = useRef(remotePlayers);
    const applyP2PBattleResultRef = useRef(applyP2PBattleResult);
    const gameStateRef = useRef(gameState);
    const getAttackCountRef = useRef(getAttackCount);

    useEffect(() => { activeMissionsRef.current = gameState.activeMissions || []; }, [gameState.activeMissions]);
    useEffect(() => { localPlayerIdRef.current = localPlayerId; }, [localPlayerId]);
    useEffect(() => { sendToPeerRef.current = sendToPeer; }, [sendToPeer]);
    useEffect(() => { remotePlayersRef.current = remotePlayers; }, [remotePlayers]);
    useEffect(() => { applyP2PBattleResultRef.current = applyP2PBattleResult; }, [applyP2PBattleResult]);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
    useEffect(() => { getAttackCountRef.current = getAttackCount; }, [getAttackCount]);

    // Idempotencia: evitar doble solicitud o doble resolución del mismo ataque
    const requestedAttacksRef = useRef<Set<string>>(new Set());
    const resolvedAttacksRef = useRef<Set<string>>(new Set());

    // Timeouts de fallback por attackId (para cuando el defensor no responde)
    const timeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    // ──────────────────────────────────────────────────────────────────────────
    // Paso 3: ejecutar el combate con las tropas del defensor (reales o estimadas)
    // Implementado como ref-stable function (no useCallback con deps volátiles)
    // ──────────────────────────────────────────────────────────────────────────
    const executeBattleResolutionRef = useRef((
        mission: ActiveMission,
        defenderUnits: Partial<Record<UnitType, number>>
    ) => {
        if (resolvedAttacksRef.current.has(mission.id)) return;
        resolvedAttacksRef.current.add(mission.id);

        const attackerUnits = mission.units;
        const targetScore = mission.targetScore || 1000;

        const battleResult = simulateCombat(attackerUnits, defenderUnits, 1.0);

        // Loot estimado basado en el score del objetivo (solo si el atacante gana)
        let loot: Partial<Record<ResourceType, number>> = {};
        const stolenBuildings: Partial<Record<BuildingType, number>> = {};

        // Número de ataque del atacante contra este defensor (ya registrado antes del lanzamiento)
        const defenderId = mission.targetId || 'DEFENDER';
        const attackNumber = getAttackCountRef.current(defenderId); // 1-6

        if (battleResult.winner === 'PLAYER') {
            loot = {
                [ResourceType.GOLD]:  Math.floor(targetScore * 2),
                [ResourceType.OIL]:   Math.floor(targetScore * 1.5),
                [ResourceType.MONEY]: Math.floor(targetScore * 1.5),
            };

            // Regla 3: pérdida de edificios escalonada (33%/25%/15%/15%/15%/15%)
            // stolenBuildings aquí es una ESTIMACIÓN — el defensor re-calculará con sus edificios reales.
            // El atacante sólo necesita saber el attackNumber para que el defensor aplique la tasa correcta.
            // Enviamos stolenBuildings vacío; la tasa se calcula por attackNumber en el lado defensor.
        }

        const myId = localPlayerIdRef.current;
        const gs = gameStateRef.current;

        const result: P2PAttackResult = {
            type: 'P2P_ATTACK_RESULT',
            attackId: mission.id,
            attackerId: myId || 'UNKNOWN_PEER',
            attackerName: gs.playerName || 'Unknown',
            defenderId,
            defenderName: mission.targetName || 'Unknown',
            battleResult,
            attackerCasualties: battleResult.totalPlayerCasualties,
            defenderCasualties: battleResult.totalEnemyCasualties,
            loot,
            stolenBuildings,
            attackNumber, // Número de este ataque (para tasa de saqueo en el defensor)
            winner: battleResult.winner,
            timestamp: Date.now(),
        };

        // Paso 4: enviar resultado al defensor
        const peers = remotePlayersRef.current;
        if (peers.some(p => p.id === defenderId)) {
            sendToPeerRef.current(defenderId, {
                type: 'P2P_BATTLE_RESULT',
                payload: result,
                playerId: myId || '',
                timestamp: Date.now(),
            });
        } else {
            // Broadcast de rescate si el defensor no está en remotePlayers
            for (const peer of peers) {
                sendToPeerRef.current(peer.id, {
                    type: 'P2P_BATTLE_RESULT',
                    payload: result,
                    playerId: myId || '',
                    timestamp: Date.now(),
                });
            }
        }

        // Paso 5: aplicar localmente como atacante
        applyP2PBattleResultRef.current(result, true);

        // Cancelar timeout de fallback si ya lo resolvimos con las tropas reales
        if (timeoutRefs.current[mission.id]) {
            clearTimeout(timeoutRefs.current[mission.id]);
            delete timeoutRefs.current[mission.id];
        }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Paso 2: cuando llega el endTime, solicitar tropas reales al defensor
    // ──────────────────────────────────────────────────────────────────────────
    const initiateP2PBattleRef = useRef((mission: ActiveMission) => {
        if (mission.type !== 'PVP_ATTACK') return;
        if (requestedAttacksRef.current.has(mission.id)) return;
        requestedAttacksRef.current.add(mission.id);

        const myId = localPlayerIdRef.current;
        const defenderId = mission.targetId || 'DEFENDER';

        const requestTroopsPayload: P2PBattleRequestTroops = {
            type: 'P2P_BATTLE_REQUEST_TROOPS',
            attackId: mission.id,
            attackerId: myId || 'UNKNOWN_PEER',
            targetId: defenderId,
            timestamp: Date.now(),
        };

        sendToPeerRef.current(defenderId, {
            type: 'P2P_BATTLE_REQUEST_TROOPS',
            payload: requestTroopsPayload,
            playerId: myId || '',
            timestamp: Date.now(),
        });

        // Fallback: si el defensor no responde en 8 s, CANCELAR el ataque
        // NO creamos tropas inventadas - marcamos como W.O. y devolvemos todas las tropas al atacante
        timeoutRefs.current[mission.id] = setTimeout(() => {
            if (resolvedAttacksRef.current.has(mission.id)) return;
            resolvedAttacksRef.current.add(mission.id);

            const gs = gameStateRef.current;

            console.log('[P2PBattleResolver] Defender did not respond in time, applying W.O. result');

            // Log that the defender fled/disconnected
            gameEventBus.emit('ADD_LOG' as any, {
                messageKey: 'combat_p2p_defenseFail',
                type: 'combat',
                params: {
                    attacker: gs.playerName || 'Unknown',
                    defender: mission.targetName || 'Unknown',
                    reason: 'Defender disconnected/fled'
                }
            });

            // W.O. - Todas las tropas del atacante vuelven, el defensor no pierde tropas
            // NO usamos initialEnemyArmy vacío - esto es un caso especial de W.O.
            const zeroedUnits: Partial<Record<UnitType, number>> = {};
            const zeroedResult: P2PAttackResult = {
                type: 'P2P_ATTACK_RESULT',
                attackId: mission.id,
                attackerId: myId || 'UNKNOWN_PEER',
                attackerName: gs.playerName || 'Unknown',
                defenderId,
                defenderName: mission.targetName || 'Unknown',
                battleResult: {
                    winner: 'DRAW',
                    rounds: [],
                    initialPlayerArmy: mission.units,
                    initialEnemyArmy: zeroedUnits,
                    finalPlayerArmy: mission.units,
                    finalEnemyArmy: zeroedUnits,
                    totalPlayerCasualties: {},
                    totalEnemyCasualties: {},
                    playerTotalHpStart: 0,
                    playerTotalHpLost: 0,
                    enemyTotalHpStart: 0,
                    enemyTotalHpLost: 0,
                    playerDamageDealt: 0,
                    enemyDamageDealt: 0,
                },
                attackerCasualties: {},
                defenderCasualties: {},
                loot: {},
                stolenBuildings: {},
                winner: 'DRAW',
                timestamp: Date.now(),
            };

            applyP2PBattleResultRef.current(zeroedResult, true);
        }, 8000);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Listener: recibir tropas reales del defensor
    // Montado UNA sola vez — lee todo desde refs para evitar cierre stale
    // ──────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const handleDefenderTroops = (payload: any) => {
            const data = payload as P2PBattleDefenderTroops;
            if (data.attackerId !== localPlayerIdRef.current) return;

            console.log('[P2PBattleResolver] Received defender troops for attack:', data.attackId, 'units:', data.defenderUnits);

            // Buscar en el ref (siempre fresco)
            const mission = activeMissionsRef.current.find(m => m.id === data.attackId);
            if (!mission) {
                console.log('[P2PBattleResolver] Mission not found for attack:', data.attackId);
                return;
            }
            if (resolvedAttacksRef.current.has(mission.id)) return;

            console.log('[P2PBattleResolver] Executing battle with REAL defender units:', data.defenderUnits);
            executeBattleResolutionRef.current(mission, data.defenderUnits);
        };

        gameEventBus.on('P2P_BATTLE_DEFENDER_TROOPS' as any, handleDefenderTroops);
        return () => {
            gameEventBus.off('P2P_BATTLE_DEFENDER_TROOPS' as any, handleDefenderTroops);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Solo una vez — todos los datos frescos vienen de refs

    // ──────────────────────────────────────────────────────────────────────────
    // Paso 1: vigilar activeMissions y disparar handshake cuando endTime llegue
    // ──────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const now = Date.now();
        const expired = (gameState.activeMissions || []).filter(
            m => m.type === 'PVP_ATTACK' && m.endTime <= now
        );
        for (const mission of expired) {
            initiateP2PBattleRef.current(mission);
        }
    }, [gameState.activeMissions]);

    return { resolveP2PBattle: (mission: ActiveMission) => initiateP2PBattleRef.current(mission) };
};
