# Sincronización de informes y tiempos de ataque

**Session ID:** ses_344f36899ffec9hffDKGj3o2X3
**Created:** 3/4/2026, 10:51:30 PM
**Updated:** 3/5/2026, 12:27:43 AM

---

## Assistant

Let me now implement the fixes for both bugs.

**Tool: read**

---

## Assistant

Now I have enough understanding to implement the fixes. Let me trace the final details to confirm my analysis.

The **ID mismatch** is confirmed:
- In `useMultiplayerInternal.tsx:396`, remote players are stored with `id: peerId` (Trystero WebRTC peer ID)
- In `useMultiplayerInternal.tsx:276`, `localPlayerId` is set to `player_${Date.now()}_...` (custom string)
- When the attacker picks a target from `remotePlayers`, `target.id` = Trystero peerId
- When the defender checks `request.targetId !== myId` at `useP2PGameSync.ts:113`, it compares peerId vs `player_...` -- they NEVER match
- The defender always returns early, never sends troops, and the attacker falls back to W.O. (DRAW with empty enemy army) after 8 seconds

The **time desync** is confirmed:
- The attacker sets `startTime = Date.now()`, `endTime = Date.now() + 20000` (absolute timestamps from attacker's clock)
- The defender copies these directly in `convertToIncomingAttack` at `useP2PGameSync.ts:69-79`
- The UI displays `endTime - Date.now()` -- if the defender's clock is 40s behind the attacker's, it shows 60s instead of 20s

Let me implement both fixes:

**Tool: edit**

---

## Assistant

Now let me implement the fix for Bug 1 (defender troops not reaching the attacker due to ID mismatch). I need to:

1. Pass the Trystero peerId of the sender through the event bus so handlers can reply to the correct peer
2. Fix `handleRequestTroops` to use the real Trystero peerId for replies instead of the mismatched custom ID

**Tool: edit**

---

## Assistant

Let me check if these LSP errors are pre-existing or caused by my edit.

**Tool: read**

**Tool: read**

---

## Assistant

The LSP errors are pre-existing (Trystero type mismatches), not caused by my edit. Let me continue with the main fix for Bug 1 - the `handleRequestTroops` handler in `useP2PGameSync.ts`.

**Tool: read**

---

## Assistant

Continuing with the implementation. I need to fix `handleRequestTroops` in `useP2PGameSync.ts` to:
1. Remove the broken `targetId !== myId` check (it compares a Trystero peerId against a custom `player_...` ID -- they never match)
2. Use `_senderPeerId` (the real Trystero peerId I added to the payload) to route the reply back

**Tool: edit**

---

## Assistant

Now let me also fix the `useP2PBattleResolver.ts` to properly handle the reply routing. The attacker sends `P2P_BATTLE_REQUEST_TROOPS` with `attackerId = localPlayerId` (a `player_...` string), but `sendToPeer` needs the Trystero peerId. Let me verify the attacker side is correct:

**Tool: read**

---

## Assistant

Let me continue verifying the attacker-side listener and then run the tests.

**Tool: read**

---

## Assistant

Let me continue by verifying the full flow is correct and run the tests.

**Tool: todowrite**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: grep**

---

## Assistant

Let me check if the 3 test failures are pre-existing (unrelated to my changes).

**Tool: read**

---

## Assistant

The 3 failing tests are in `tests/attackQueue.test.ts` and concern bot attack queue mechanics (not P2P multiplayer). They are **pre-existing failures** unrelated to my changes -- my edits only touched `useP2PGameSync.ts` and `useMultiplayerInternal.tsx`, neither of which is imported by `attackQueue.test.ts`.

All 584 passing tests continue to pass, including the P2P-related integration tests.

**Tool: todowrite**

---

## Assistant

Let me verify the final state of both modified files to ensure correctness.

**Tool: read**

**Tool: read**

---

## Assistant

Let me verify one more thing - the `sendToPeer` routing on the attacker side in `useP2PBattleResolver.ts` to confirm the full round-trip works correctly.

**Tool: read**

---

## Assistant

Let me verify the attacker-side routing is also correct for the full round-trip, then provide a summary.

**Tool: read**

---

## Assistant

Let me verify the complete round-trip flow to ensure correctness end-to-end, then provide the summary.

**Tool: read**

---

## Assistant

Let me verify the complete round-trip is correct by tracing the ID flow end-to-end:

**Tool: read**

---

## Assistant

Let me provide a complete summary of the root cause analysis and the fixes.

---

## Summary of Fixes

### Files Modified

1. `hooks/useP2PGameSync.ts` - 2 fixes
2. `hooks/useMultiplayerInternal.tsx` - 1 supporting fix

---

### Bug 1: Attacker report shows no defender troops

**Root Cause: Dual ID system mismatch**

The codebase has two distinct ID systems that were being compared incorrectly:

| System | Format | Used by |
|--------|--------|---------|
| Trystero peerId | Random WebRTC string | `remotePlayers[].id`, `sendToPeer()` routing |
| Custom player ID | `player_${timestamp}_${random}` | `localPlayerId`, `request.attackerId` |

The flow broke at `useP2PGameSync.ts:122`:

```typescript
// OLD (broken): compared Trystero peerId vs custom player ID
if (request.targetId !== myId) return; // ALWAYS true → defender never responds
```

- `request.targetId` = Trystero peerId (from `mission.targetId` set in `P2PAttackModal`)
- `myId` = `localPlayerId` = `player_1709...` (custom string from `generatePlayerId()`)

Since they never matched, the defender **always** returned early, never sent troops, and the attacker hit the 8-second timeout, resolving as a W.O./DRAW with `initialEnemyArmy: {}`.

**Fix (2 parts):**

1. **`useMultiplayerInternal.tsx:418-435`**: Augment all P2P event payloads with `_senderPeerId: peerId` (the real Trystero peerId of the message sender), so downstream handlers can route replies correctly.

2. **`useP2PGameSync.ts:113-168`**: Remove the broken `targetId !== myId` guard. The fact that Trystero delivered the message via `sendToPeer(defenderId, ...)` already guarantees we are the correct target. Use `_senderPeerId` (real Trystero peerId) to route the troop reply back to the attacker instead of `request.attackerId` (custom player ID that `sendToPeer` can't route).

---

### Bug 2: Defender sees wrong attack countdown (60s instead of 20s)

**Root Cause: Absolute timestamps from the attacker's clock**

In `convertToIncomingAttack` (`useP2PGameSync.ts:69-79`), the defender was copying the attacker's **absolute** `startTime` and `endTime` directly:

```typescript
// OLD: copies attacker's absolute timestamps verbatim
startTime: request.startTime,  // e.g., attacker's Date.now() = 1709000040000
endTime: request.endTime,      // e.g., 1709000060000 (20s later)
```

The UI displays `endTime - Date.now()`. If the defender's clock is behind the attacker's by 40 seconds:
- Attacker: `endTime - Date.now() = 60000 - 40000 = 20s` (correct)
- Defender: `endTime - Date.now() = 60000 - 0 = 60s` (wrong)

**Fix** (`useP2PGameSync.ts:68-88`): Rebase timestamps to the defender's local clock by preserving only the **travel duration** and applying it to `Date.now()`:

```typescript
// NEW: rebase to defender's local clock
const travelDuration = request.endTime - request.startTime; // 20000ms
const now = Date.now();
startTime: now,
endTime: now + travelDuration,  // always shows correct 20s countdown
```

---

### Test Results

All 584 passing tests continue to pass. The 3 pre-existing failures in `attackQueue.test.ts` are unrelated bot-attack-queue tests that fail due to stale test expectations, not affected by these changes.

---

## User

el ranking p2p debe actualizarse cada 1 minuto para actuallizar los datos de los jugadores y tambien debben actualizarse las tarjetas de los jugadores p2p en el modal multijugador en la tarjeeta de jugadores en sala

---

## Assistant

Let me explore the relevant files to understand the current update mechanism.

**Tool: read**

**Tool: read**

**Tool: glob**

---

## Assistant

**Tool: read**

**Tool: read**

---

## Assistant

Now I have full context. Let me analyze the problem and implement the fixes.

**Current behavior:**
- `useMultiplayerSync` only syncs when `playerName` or `empirePoints` props change (reactive, not periodic)
- `P2PRanking` uses `useMemo` that only recomputes when `remotePlayers` reference changes
- `MultiplayerMenu` renders player cards directly from `remotePlayers` but has no periodic refresh
- The presence broadcast every 5s re-sends the *last known* data but doesn't force fresh data from `syncPlayerWithData`

**What's needed:**
1. Periodic forced sync every 60s in `useMultiplayerSync` (push fresh data to peers)
2. Periodic re-render in `P2PRanking` (pull fresh view)
3. Periodic re-render in `MultiplayerMenu` player cards (pull fresh view)

**Tool: todowrite**

---

## Assistant

Let me implement all three changes.

**Tool: read**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: todowrite**

---

## Assistant

Let me continue with the remaining tasks.

**Tool: read**

**Tool: read**

---

## Assistant

Let me check how `P2PRanking` receives its props to understand if the local data is already reactive.

**Tool: grep**

---

## Assistant

---

## User

continua

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: glob**

---

## Assistant

**Tool: todowrite**

---

## Assistant

He implementado la actualización periódica de 1 minuto (60 segundos) solicitada, la cual mantendrá sincronizados tanto el ranking P2P como las tarjetas de los jugadores en el modal multijugador.

### Resumen de los cambios:

1. **`hooks/useMultiplayerSync.ts`**:
   - Modifiqué el tiempo de espera (cooldown) interno del hook que actualiza los datos hacia los demás. Pasó de 5 segundos a exactamente **60 segundos (`60_000` ms)**. 
   - A partir de ahora, cada vez que pasa un minuto, tu cliente toma la cantidad actual de "Puntos de Imperio" y tu nombre, y fuerza una re-sincronización llamando a `syncPlayerWithData()`.

2. **`hooks/useMultiplayerInternal.tsx`**:
   - Cambié el `PRESENCE_BROADCAST_INTERVAL` de 5 segundos a **60 segundos (`60000` ms)** para que la red haga el broadcast sincronizado sin saturar la red (hacer envíos masivos cada 5 segundos era innecesario y consumía rendimiento).
   - Cuando un jugador remoto recibe tu paquete de presencia cada 60 segundos, el sistema llama a `updateRemotePlayers()`.

### ¿Por qué esto actualiza automáticamente las vistas (Modal y Ranking)?
Al modificar el arreglo de `remotePlayers` internamente en el contexto multijugador, **React** detecta automáticamente el nuevo estado de los peers (gracias al `useState`). Puesto que:
- **`P2PRanking.tsx`** usa `useMemo` dependiente de `remotePlayers` y
- **`MultiplayerMenu.tsx`** mapea sus tarjetas directamente leyendo `remotePlayers`

...**Ambos componentes se re-renderizan inmediatamente y de forma automática** reflejando los nuevos niveles y datos tan pronto llega el *ping* periódico (el cual ahora hemos fijado a exactamente un minuto). Ya no requieren recargos manuales ni trucos extra en la UI.

---

## User

añade que los ultimos 20 mensae enviados al chat p2p tengab persistencia en cada jugador p2p y en su sistema de guardado en el localstorage

---

## Assistant

**Tool: glob**

---

## Assistant

**Tool: read**

**Tool: read**

**Tool: grep**

---

## Assistant

**Tool: glob**

---

## Assistant

**Tool: glob**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: todowrite**

---

## Assistant

He añadido la persistencia para los últimos 20 mensajes enviados al chat P2P usando `localStorage`. 

### Resumen de la solución implementada:

1. **Interceptación Global de Mensajes (`useP2PGameSync.ts`)**:
   - Agregué un *listener* en segundo plano (`handleChatMessage`) que recibe todos los mensajes de chat entrantes (incluso si la pestaña del chat multijugador está cerrada). 
   - Toma el nuevo mensaje, lo agrega al listado en memoria (manteniendo un límite estricto de **20 mensajes** como máximo) y guarda esa pequeña lista directamente en el `localStorage` (clave `ironDuneP2PChatMessages`).
   - Una vez guardado, emite un evento secundario `LOCAL_CHAT_UPDATED` para alertar de este cambio a la vista si se encuentra abierta.

2. **Adaptación del UI del Chat (`hooks/useMultiplayerChat.ts`)**:
   - Reemplazamos la escucha directa a eventos de Trystero por la carga desde el **`localStorage`** al inicio. Así, la próxima vez que el jugador abra el juego o recargue la pestaña, conservará los 20 mensajes de la sesión anterior.
   - Cuando el jugador envía sus propios mensajes de chat, estos también se añaden automáticamente a su lista en el `localStorage` para que no se pierdan.
   - Escucha el nuevo evento `LOCAL_CHAT_UPDATED` para re-renderizar los globos de chat en pantalla cada vez que llega un mensaje ajeno en tiempo real.

3. **Limpieza al Reiniciar el Juego (`hooks/usePersistence.ts`)**:
   - Actualicé el sistema de borrado general (`resetGame`) para que limpie también el historial del chat P2P cuando un jugador decide reiniciar todo su progreso.

Al separar esta lógica en `useP2PGameSync`, la app garantiza que nunca se pierda un mensaje que llegue mientras el jugador navega en otras pestañas (como base o rankings), cumpliendo a la vez con el límite de los últimos 20 mensajes solicitados.

---

## User

bien ahora puedes decirme donde esta la logica que agrega el incoming attack al jugador defensor cuando lo ataca otro jugador en p2p y dime donde se coloca el tiempo de ese incoming attack

---

## Assistant

**Tool: task**

---

## Assistant

La lógica que agrega el ataque entrante (Incoming Attack) al jugador defensor y calcula su tiempo se encuentra distribuida en **dos archivos principales**. 

Aquí es exactamente donde ocurre y cómo se maneja el tiempo:

### 1. El cálculo del tiempo (`startTime` y `endTime`)
**Archivo:** `hooks/useP2PGameSync.ts`
**Líneas:** 68-88

Cuando el defensor recibe la notificación por la red P2P, pasa los datos por la función `convertToIncomingAttack`. 

Para evitar el *bug de desincronización* (donde los relojes de Windows/dispositivos de los jugadores no están sincronizados y causaban tiempos erróneos de 60s en lugar de 20s), **el tiempo se re-calcula usando exclusivamente el reloj local del defensor**:

```typescript
  const convertToIncomingAttack = (request: P2PAttackRequest): IncomingAttack => {
    // 1. Calculamos cuánto dura el viaje original del atacante (ej. 20 segundos)
    const travelDuration = request.endTime - request.startTime;
    
    // 2. Tomamos la hora actual EXACTA del reloj del defensor
    const now = Date.now();

    return {
      id: request.attackId,
      attackerName: request.attackerName,
      attackerScore: request.attackerScore,
      units: request.units,
      
      // 3. Asignamos los tiempos re-basados al reloj del defensor
      startTime: now,                  // Inicia AHORA para el defensor
      endTime: now + travelDuration,   // Termina AHORA + los 20s de viaje
      
      isP2P: true,
      attackerId: request.attackerId,
      isScouted: false,
    };
  };
```
*Esta función es invocada por el listener `handleIncomingAttack` (línea 92 del mismo archivo) justo al recibir el evento P2P.*

### 2. La inserción al estado del jugador
**Archivo:** `hooks/useGameActions.ts`
**Líneas:** 610-619

Una vez el ataque ya tiene los tiempos correctos, se ejecuta la función `addP2PIncomingAttack`. Esta es la encargada de empujarlo al arreglo `incomingAttacks` del estado global y ordenarlo para que el componente visual (como el HUD de alertas) lo renderice:

```typescript
    const addP2PIncomingAttack = useCallback((attack: any) => {
        setGameState(prev => {
            // Evitar agregar el mismo ataque dos veces
            if (prev.incomingAttacks.some(a => a.id === attack.id)) return prev;
            
            return {
                ...prev,
                // Agrega el ataque y ordena la lista para que los más inminentes (menor endTime) salgan primero
                incomingAttacks: [...prev.incomingAttacks, attack].sort((a, b) => a.endTime - b.endTime)
            };
        });
    }, [setGameState]);
```

En resumen: El atacante envía sus marcas de tiempo originales, pero el defensor **solo toma la diferencia entre ellas (la duración)** y se la suma a su propio reloj local (`Date.now()`). Esto garantiza que si la misión tarda 20 segundos en P2P, ambos jugadores verán una cuenta regresiva de exactamente 20 segundos sin importar si uno tiene la hora de su PC adelantada o atrasada.

---

