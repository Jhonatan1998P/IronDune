# Plan de Implementación: Sistema de Batallas P2P

## Visión General

El sistema de batallas P2P funcionará de manera **idéntica** al sistema de batallas contra bots, con la diferencia de que:
1. El **atacante es otro jugador** (no un bot)
2. El **defensor recibe el ataque** y puede espiarlo con oro
3. **Ambos aplican resultados** localmente después de la batalla

---

## FASE 1: Tipos de Datos y Estructuras

### 1.1 Extender `IncomingAttack` para P2P

El tipo `IncomingAttack` ya existe y tiene todos los campos necesarios:

```typescript
// types/state.ts - Ya existe
export interface IncomingAttack {
  id: string;
  attackerName: string;
  attackerScore: number;
  units: Partial<Record<UnitType, number>>;
  startTime: number;
  endTime: number;
  delayCount?: number;
  isWarWave?: boolean;
  isScouted?: boolean;
  // === NUEVO ===
  isP2P?: boolean;           // Flag para identificar ataques P2P
  attackerId?: string;       // ID del jugador atacante (para respuestas)
}
```

### 1.2 Crear tipo para solicitud de ataque P2P

```typescript
// types/multiplayer.ts - NUEVO
export interface P2PAttackRequest {
  type: 'P2P_ATTACK_REQUEST';
  attackId: string;
  attackerId: string;
  attackerName: string;
  attackerScore: number;
  units: Partial<Record<UnitType, number>>;
  targetId: string;          // ID del jugador defensor
  startTime: number;
  endTime: number;           // Tiempo de viaje (ej: 7.5 minutos)
  timestamp: number;
}
```

### 1.3 Crear tipo para resultado de ataque P2P

```typescript
// types/multiplayer.ts - NUEVO
export interface P2PAttackResult {
  type: 'P2P_ATTACK_RESULT';
  attackId: string;
  attackerId: string;
  defenderId: string;
  battleResult: BattleResult; // ← Ya existe tu tipo
  
  // IMPORTANTE: Ambos bandos siempre tienen bajas
  attackerCasualties: Partial<Record<UnitType, number>>;  // Bajas del atacante
  defenderCasualties: Partial<Record<UnitType, number>>;  // Bajas del defensor
  
  // Loot: SOLO si el atacante GANA
  loot?: Partial<Record<ResourceType, number>>;
  stolenBuildings?: Partial<Record<BuildingType, number>>;
  
  winner: 'PLAYER' | 'ENEMY' | 'DRAW';
  timestamp: number;
}
```

---

## FASE 2: Hook de Comunicación P2P

### 2.1 Extender `useMultiplayer` para ataques

```typescript
// hooks/useMultiplayerAttack.ts - NUEVO
import { useMultiplayer } from './useMultiplayer';
import { P2PAttackRequest, P2PAttackResult } from '../types/multiplayer';
import { IncomingAttack } from '../types';

export const useP2PAttack = () => {
  const { broadcastAction, sendToPeer, peers, remotePlayers } = useMultiplayer();

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
```

### 2.2 Registrar listeners en el proveedor

```typescript
// hooks/useMultiplayerInternal.tsx - MODIFICAR

// En el useEffect donde se listen los remote actions:
onRemoteAction((action) => {
  if (action.type === 'P2P_ATTACK') {
    const attackRequest = action.payload as P2PAttackRequest;
    // Convertir a IncomingAttack y añadir al estado del juego
    addIncomingAttack(convertToIncomingAttack(attackRequest));
  }
  
  if (action.type === 'P2P_BATTLE_RESULT') {
    const battleResult = action.payload as P2PAttackResult;
    // Procesar resultado de batalla
    applyBattleResult(battleResult);
  }
});
```

---

## FASE 3: Integración con el Estado del Juego

### 3.1 Función para añadir ataque entrante P2P

```typescript
// hooks/useP2PGameSync.ts - NUEVO
import { useGame } from '../context/GameContext';
import { P2PAttackRequest, P2PAttackResult } from '../types/multiplayer';
import { IncomingAttack } from '../types';

export const useP2PGameSync = () => {
  const { gameState, dispatch } = useGame();

  // Convertir ataque P2P a formato IncomingAttack
  const addIncomingP2PAttack = (request: P2PAttackRequest): IncomingAttack => {
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

  // Aplicar resultado de batalla (para el defensor)
  const applyP2PDefeat = (result: P2PAttackResult) => {
    // Esto es idéntico a processIncomingAttackInQueue
    // Ver utils/engine/attackQueue.ts:processIncomingAttackInQueue
    
    if (result.winner === 'PLAYER') {
      // El atacante ganó - restar bajas del defensor
      // + loot si corresponde
    } else {
      // El defensor ganó - restar bajas del atacante
    }
  };

  return { addIncomingP2PAttack, applyP2PDefeat };
};
```

---

## FASE 4: UI - Selector de Objetivo P2P

### 4.1 Modal de envío de ataque P2P

```tsx
// components/modals/P2PAttackModal.tsx - NUEVO
interface P2PAttackModalProps {
  targetPlayer: PlayerPresence; // Jugador a atacar
  playerUnits: Partial<Record<UnitType, number>>;
  onSendAttack: (units: Partial<Record<UnitType, number>>) => void;
  onClose: () => void;
}

// Componentes:
// - Selector de unidades (reutilizar de AttackModal o CampaignView)
// - Mostrar puntuación del objetivo
// - Tiempo de viaje (fijo, ej: 7.5 minutos)
// - Botón de confirmar ataque
```

### 4.2 Integración en RankingsView

```tsx
// components/views/RankingsView.tsx - MODIFICAR

// En RankingCard, añadir botón de ataque para jugadores P2P:
{entry.isP2P && (
  <button 
    onClick={() => openP2PAttackModal(entry)}
    className="text-xs text-red-400 hover:text-red-300"
  >
    ATACAR
  </button>
)}
```

---

## FASE 5: UI - Indicador de Ataque Entrante (Igual que Bots)

### 5.1 El sistema YA existe - solo modificar para P2P

Los componentes siguientes **ya funcionan** para P2P si el flag `isP2P` está presente:

| Componente | Funciona para P2P | Notas |
|------------|-------------------|-------|
| `ActiveAttacksIndicator.tsx` | ✅ SÍ | Muestra ataque entrante |
| `TacticalInterceptModal.tsx` | ✅ SÍ | Modal de espiar (ya tiene toda la lógica) |
| `GameHeader.tsx` | ✅ SÍ | Alerta de ataque entrante |
| `RightStatusPanel.tsx` | ✅ SÍ | Lista de ataques entrantes |

### 5.2 Modificar `TacticalInterceptModal` para mostrar "P2P"

```tsx
// components/modals/TacticalInterceptModal.tsx - AÑADIR

// En el header del modal, indicar si es P2P:
{attack.isP2P && (
  <div className="text-xs text-cyan-400 bg-cyan-900/30 px-2 py-1 rounded">
    JUGADOR P2P
  </div>
)}
```

---

## FASE 6: Lógica de Batalla

### 6.1 El atacante calcula la batalla

```typescript
// hooks/useP2PBattle.ts - NUEVO
export const useP2PBattle = () => {
  const { sendBattleResult } = useP2PAttack();
  const { gameState } = useGame();

  // Función para resolver batalla P2P
  const resolveP2PBattle = async (attackId: string) => {
    // 1. Obtener ataque de la cola
    const attack = gameState.incomingAttacks.find(a => a.id === attackId);
    if (!attack || !attack.isP2P) return;

    // 2. Calcular batalla (YA EXISTE - simulateCombat)
    const battleResult = simulateCombat(
      attack.units,           // tropas del atacante
      gameState.units,        // tropas del defensor (tu army)
      1.0
    );

    // 3. Calcular loot si ganó el atacante
    let loot: Partial<Record<ResourceType, number>> = {};
    let stolenBuildings: Partial<Record<BuildingType, number>> = {};
    
    // IMPORTANTE: Siempre se restan las bajas de ambos bandos
    // El loot solo se roba si el atacante GANA
    if (battleResult.winner === 'ENEMY') {
      // Ganó el atacante - calcular loot (igual que bots)
      loot = calculateLoot(gameState.resources);
      stolenBuildings = calculateStolenBuildings(gameState.buildings);
    } else {
      // Ganó el defensor o DRAW - no hay loot
      loot = {};
      stolenBuildings = {};
    }

    // 4. Enviar resultado al defensor
    const result: P2PAttackResult = {
      type: 'P2P_BATTLE_RESULT',
      attackId,
      attackerId: attack.attackerId!,
      defenderId: 'PLAYER', // Tu ID
      battleResult,
      loot,
      stolenBuildings,
      winner: battleResult.winner,
      // IMPORTANTE: Ambos bandos tienen bajas que aplicar
      attackerCasualties: battleResult.totalPlayerCasualties, // Bajas del defensor (desde perspectiva de quien recibe)
      defenderCasualties: battleResult.totalEnemyCasualties, // Bajas del atacante (desde perspectiva de quien recibe)
      timestamp: Date.now(),
    };

    // 5. Enviar vía P2P
    const defenderPeer = findPeerById(attack.attackerId);
    if (defenderPeer) {
      sendBattleResult(defenderPeer, result);
    }

    // 6. Aplicar resultado localmente (atacante aplica sus propias bajas)
    applyBattleResultLocally(result, isAttacker: true);
  };

  return { resolveP2PBattle };
};
```

### 6.2 Aplicar resultado (para ambos jugadores)

**REGLA IMPORTANTE**: En toda batalla P2P, SIN IMPORTAR el resultado, SIEMPRE se restan las bajas de AMBOS bandos.

```typescript
// Para AMBOS jugadores (atacante y defensor):
// Ambos siempre restan sus propias bajas según el BattleResult

// Ejemplo:
// - Atacante envía 100 tropas
// - Defensor tiene 50 tropas
// - Batalla: atacante pierde 30, defensor pierde 40
// - Resultado: GANA EL ATACANTE
//
// Ambos aplican:
// - Atacante: 100 - 30 = 70 tropas (las que regresan)
// - Defensor: 50 - 40 = 10 tropas (sobreviven)
// - Atacante ROBRA loot + edificios del defensor
// - Defensor PIERDE edificios (si los tenía)

---

## FASE 7: Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLUJO DE BATALLA P2P                               │
│                                                                             │
│  REGLA CLAVE: Ambos bandos SIEMPRE pierden tropas según las bajas         │
│  calculadas en la batalla, SIN IMPORTAR quién gane.                       │
│  El loot/edificios SOLO se roban si el atacante GANA.                     │
└─────────────────────────────────────────────────────────────────────────────┘

JUGADOR A (ATACANTE)                    JUGADOR B (DEFENSOR)
       │                                         │
       │  1. Selecciona objetivo P2P            │
       │     en Rankings                         │
       │  2. Elige unidades para atacar          │
       │  3. Confirma ataque                    │
       │                                         │
       ├────────────────────────────────────────►│
       │     P2P_ATTACK_REQUEST                 │
       │     (units, attackerName,               │
       │      attackerScore, endTime)           │
       │                                         │
       │                                    4.  Añadir a incomingAttacks
       │                                        como IncomingAttack{isP2P: true}
       │                                    5.  Mostrar en indicador
       │                                        (como ataque de bot)
       │                                    6.  ✓ Puede espiar con oro
       │                                        (TacticalInterceptModal)
       │                                    7.  ✓ Ve tropas del atacante
       │                                        (si espió)
       │                                         │
       │     [ESPERA HASTA endTime]             │
       │                                         │
       │  8. calculateCombat(attack.units,      │
       │                    defender.units)      │
       │  9. Genera BattleResult                │
       │     (incluye bajas de AMBOS)           │
       │                                         │
       │ 10. SI attacker GANA:                  │
       │     - Calcular loot                    │
       │     - Calcular edificios robados       │
       │     SI defender GANA o DRAW:           │
       │     - loot = vacío                     │
       │                                         │
       │ 11. Envía resultado via P2P           │
       │     P2P_BATTLE_RESULT                  │
       │     (battleResult, winner,             │
       │      attackerCasualties,               │
       │      defenderCasualties,               │
       │      loot, stolenBuildings)           │
       ├────────────────────────────────────────►│
       │                                    12. Recibir resultado
       │                                    13. Verificar validez
       │                                    14. Aplicar resultado:
       │                                        • AMBOS: Restar sus propias bajas
       │                                        • SI attacker GANA:
       │                                          - Atacante: +loot +edificios
       │                                          - Defensor: -edificios
       │                                    15. Generar informe de combate
       │                                    16. ✓ Mostrar en reports
       │                                         │
       │ 12. Aplicar resultado local:           │
       │     • Restar MIS propias bajas         │
       │       (defenderCasualties)             │
       │     • SI GANE: +loot +edificios       │
       │     • SI PERDI: solo bajas            │
       │                                    17. ✓ Mostrar en reports
       │                                         │
       │  ✓ COMPLETADO                          │                                         │
```

---

## FASE 8: Verificación de Integridad

### 8.1 El defensor verifica el ataque y el resultado

Para prevenir trampas, el defensor debe verificar tanto el ataque entrante como el resultado recibido:

```typescript
// hooks/useP2PDefense.ts

// VERIFICAR ATAQUE ENTRANTE
const verifyIncomingAttack = (attack: IncomingAttack, myUnits) => {
  const maxEnemyCasualties = countUnits(myUnits);
  const attackCasualties = countUnits(attack.units);
  
  // Las tropas del atacante no pueden exceder un límite razonable
  if (attackCasualties > maxEnemyCasualties * 3) {
    console.warn('P2P Attack verification FAILED: unrealistic army size');
    return false;
  }
  
  return true;
};

// VERIFICAR RESULTADO DE BATALLA
const verifyBattleResult = (
  result: P2PAttackResult,
  myUnitsBeforeBattle: Partial<Record<UnitType, number>>,
  myBuildingsBeforeBattle: Partial<Record<BuildingType, { level: number }>>
): { valid: boolean; reason?: string } => {
  
  // 1. Verificar que las bajas del defensor no excedan sus tropas actuales
  const myCasualties = result.defenderCasualties;
  const myCurrentUnits = countUnits(myUnitsBeforeBattle);
  const claimedCasualties = countUnits(myCasualties || {});
  
  if (claimedCasualties > myCurrentUnits) {
    return { valid: false, reason: 'Invalid defender casualties: exceeds current units' };
  }

  // 2. Verificar edificios robados (solo si el atacante ganó)
  if (result.winner === 'ENEMY' && result.stolenBuildings) {
    for (const [bType, count] of Object.entries(result.stolenBuildings)) {
      const myCount = myBuildingsBeforeBattle[bType as BuildingType]?.level || 0;
      if (count > myCount) {
        return { valid: false, reason: 'Invalid building theft: exceeds buildings owned' };
      }
    }
  }

  // 3. Verificar que el resultado sea consistente (ganador vs tropas restantes)
  const enemyCasualties = result.attackerCasualties;
  const enemyOriginal = countUnits(result.battleResult.initialPlayerArmy);
  const enemyRemaining = enemyOriginal - countUnits(enemyCasualties || {});
  
  // Si dice que ganó el atacante pero no le quedan tropas, es sospechoso
  if (result.winner === 'ENEMY' && enemyRemaining <= 0) {
    return { valid: false, reason: 'Inconsistent result: attacker won but has no survivors' };
  }

  return { valid: true };
};

---

## ARCHIVOS A CREAR

| Archivo | Acción |
|---------|--------|
| `types/multiplayer.ts` | Añadir `P2PAttackRequest`, `P2PAttackResult` |
| `hooks/useP2PAttack.ts` | Nuevo - enviar ataques y resultados |
| `hooks/useP2PGameSync.ts` | Nuevo - sincronizar con estado del juego |
| `hooks/useP2PBattle.ts` | Nuevo - resolver batallas P2P |
| `components/modals/P2PAttackModal.tsx` | Nuevo - modal de enviar ataque |
| `docs/P2P_ATTACK_PLAN.md` | Este documento |

## ARCHIVOS A MODIFICAR

| Archivo | Cambio |
|---------|--------|
| `types/state.ts` | Añadir `isP2P`, `attackerId` a `IncomingAttack` |
| `hooks/useMultiplayerInternal.tsx` | Añadir listeners para P2P_ATTACK y P2P_BATTLE_RESULT |
| `components/views/RankingsView.tsx` | Añadir botón de ataque para entradas P2P |
| `components/modals/TacticalInterceptModal.tsx` | Indicador visual P2P |
| `utils/engine/attackQueue.ts` | Añadir lógica para procesar ataques P2P |

---

## RESUMEN DE FUNCIONALIDADES

| Funcionalidad | Estado | Descripción |
|---------------|--------|-------------|
| Seleccionar jugador P2P como objetivo | 🔲 Por hacer | En RankingsView |
| Enviar ataque P2P | 🔲 Por hacer | Via Trystero |
| Ver indicador de ataque entrante | ✅ Ya existe | ActiveAttacksIndicator |
| Ver detalles del ataque (espiar) | ✅ Ya existe | TacticalInterceptModal |
| Resolver batalla | 🔲 Por hacer | simulateCombat + resultado |
| Aplicar bajas y loot | 🔲 Por hacer | Como batallas contra bots |
| Mostrar en informes | ✅ Ya existe | Sistema de logs existente |

---

## NOTAS IMPORTANTES

1. **REGLA DE BAJAS**: En toda batalla P2P, SIN IMPORTAR el resultado (gane quien gane), SIEMPRE se restan las bajas de AMBOS bandos. El loot y edificios solo se roban si el atacante GANA.

2. **No se requiere motor determinista**: El atacante calcula la batalla y envía el resultado. Ambos aplican el mismo resultado.

3. **El defensor puede verificar**: Si el resultado no tiene sentido (ej: el defensor perdió más tropas de las que tenía), puede rechazar el resultado.

4. **Tiempo de viaje fijo**: Usar 7.5 minutos (450 segundos) como en las misiones de campaña.

5. **Protección offline**: Los ataques P2P se guardan en el estado igual que los ataques de bots.

6. **Sistema de espía**: Funciona exactamente igual - el defensor paga oro para ver las tropas del atacante.
