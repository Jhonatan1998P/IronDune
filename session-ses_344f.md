# Sincronización de informes y tiempos de ataque

**Session ID:** ses_344f36899ffec9hffDKGj3o2X3
**Created:** 3/4/2026, 10:51:30 PM
**Updated:** 3/5/2026, 1:53:03 AM

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

## User

añde queel icono de vista de chat p2p tanto para desktop como para dispositivos moviles tenga atributo visual para denotar que hay movimiento en el chat p2p, ademas permitir que un jugador p2p pueda hacer ping a otro jugador p2p mediante el chat colocando @ seguido del nombre y el mensaje o solo la mencion lueg que se active un totooast de notificacion avisandole al jugador que el jugador (username) le ha hecho una mencion, dicha notificacion debe ser totalmente responsiva para dispositivos moviles como para deskto

---

## Assistant

**Tool: task**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: task**

---

## User

continua

---

## User

---

## Assistant

## Goal

The user wants to:
1. Add a visual indicator (badge/dot) on the P2P chat icon in both desktop (`GameSidebar`) and mobile (`MobileNavBar`) navigation to denote new/unread chat activity.
2. Allow P2P players to mention/ping another player using `@username` syntax in the chat, which triggers a responsive toast notification telling the pinged player they've been mentioned.

## Instructions

- The visual indicator must work on **both desktop sidebar and mobile bottom nav/bottom sheet**.
- The `@mention` toast must be **fully responsive** (mobile + desktop).
- The `@username` mention should work when a player types `@name message` OR just `@name` alone.
- The toast should say something like: "**[username]** te ha mencionado en el chat".
- Use existing patterns in the codebase — `gameEventBus` for cross-component events, existing toast system.
- The unread indicator should clear when the user navigates to the `chat` tab.

## Discoveries

- **Navigation files:**
  - Desktop sidebar: `/home/runner/workspace/components/GameSidebar.tsx` — contains `GameSidebar` component. Chat tab is defined at line 60: `{ id: 'chat' as TabType, label: 'Chat', icon: Icons.Chat, color: 'text-emerald-400' }`.
  - Mobile nav: `MobileNavBar` is also in `/home/runner/workspace/components/GameSidebar.tsx` (lines ~180+), with chat in `secondaryItems`.
  - Both receive `activeTab` and `setActiveTab` as props.

- **Chat event flow:**
  - Remote chat messages arrive via Trystero → `useMultiplayerInternal.tsx` intercepts `CHAT_MESSAGE` action (line 437) → emits `P2P_CHAT_MESSAGE` on `gameEventBus` with `{ text, senderName, playerId, timestamp, _senderPeerId }`.
  - `useP2PGameSync.ts` listens to `P2P_CHAT_MESSAGE` (the `handleChatMessage` handler added in previous session) → saves to `localStorage` (`ironDuneP2PChatMessages`, max 20) → emits `LOCAL_CHAT_UPDATED` with updated messages array.
  - `useMultiplayerChat.ts` listens to `LOCAL_CHAT_UPDATED` and updates `messages` state.
  - Own sent messages: saved directly to localStorage in `sendMessage` inside `useMultiplayerChat.ts`.

- **Toast system:** `gameEventBus.emit('SHOW_TOAST' as any, { message: '...', type: 'success' })` is already used elsewhere (e.g., in `useMultiplayerInternal.tsx` line 415 for gift gold). This is the existing toast mechanism.

- **localStorage key for chat:** `ironDuneP2PChatMessages` (max 20 messages, `ChatMessage[]`).

- **`ChatMessage` interface** (in `useMultiplayerChat.ts`):
  ```ts
  export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: number;
    isLocal: boolean;
  }
  ```

- **`gameEventBus`** is at `/home/runner/workspace/utils/eventBus.ts` and is used widely across the app for cross-component communication.

- **`localPlayerId`** is the custom `player_...` ID. `localPlayerName` / `playerName` comes from `gameState.playerName`.

- The existing war indicator badge pattern (active war red dot) in `GameSidebar.tsx` can be used as a model for the unread chat badge.

- The `hasNewReports` flag pattern from `GameContext` is a good model — a simple boolean state that gets cleared when user visits the relevant tab.

## Accomplished

### Completed in this session:
1. **Bug fixes for P2P attack system** (previous messages):
   - Fixed ID mismatch in `handleRequestTroops` (`useP2PGameSync.ts`) — removed broken `targetId !== myId` guard, use `_senderPeerId` for routing.
   - Fixed time desync in `convertToIncomingAttack` — rebases timestamps to defender's local clock.
   - `useMultiplayerInternal.tsx` — augments all P2P payloads with `_senderPeerId`.

2. **Periodic 1-minute sync for P2P ranking and player cards**:
   - `useMultiplayerSync.ts` — added 60s cooldown.
   - `useMultiplayerInternal.tsx` — changed `PRESENCE_BROADCAST_INTERVAL` from 5000ms to 60000ms.

3. **P2P Chat persistence (last 20 messages in localStorage)**:
   - `useMultiplayerChat.ts` — completely rewrote: loads from localStorage on mount, saves on send, listens to `LOCAL_CHAT_UPDATED` event. No longer uses `onRemoteAction` directly.
   - `useP2PGameSync.ts` — added `handleChatMessage` listener for `P2P_CHAT_MESSAGE` event: saves incoming remote messages to localStorage and emits `LOCAL_CHAT_UPDATED`.
   - `useMultiplayerInternal.tsx` — added `case 'CHAT_MESSAGE'` to the action switch to emit `P2P_CHAT_MESSAGE` on `gameEventBus`, imported `ChatMessagePayload` type.
   - `usePersistence.ts` — added `localStorage.removeItem('ironDuneP2PChatMessages')` in `resetGame`.

### Currently in progress (task was interrupted):
4. **Unread chat indicator + @mention ping** — Work was about to begin. The plan was:
   - Read the rest of `GameSidebar.tsx` (lines 101-317) to see the full mobile nav and button rendering to know where to inject the badge.
   - Create a `useUnreadChat` hook (or inline logic) that:
     - Listens to `LOCAL_CHAT_UPDATED` via `gameEventBus`.
     - Sets `hasUnreadChat = true` when a new message arrives and `activeTab !== 'chat'`.
     - Clears `hasUnreadChat` when `activeTab === 'chat'`.
   - In `useP2PGameSync.ts` `handleChatMessage`: parse `payload.text` for `@playerName` mention pattern, if found and `payload.senderName !== localPlayerName`, emit `SHOW_TOAST` with mention notification.
   - Modify `GameSidebar.tsx` chat button (desktop + mobile) to show a green pulsing dot badge when `hasUnreadChat` is true.

## Relevant files / directories

```
/home/runner/workspace/
├── components/
│   ├── GameSidebar.tsx              ← NEXT TO EDIT: add unread badge to chat icon (desktop + mobile)
│   └── views/
│       └── MultiplayerChatView.tsx  ← may need @mention detection UI (autocomplete)
├── hooks/
│   ├── useMultiplayerChat.ts        ← EDITED: persistence, LOCAL_CHAT_UPDATED listener
│   ├── useMultiplayerSync.ts        ← EDITED: 60s cooldown
│   ├── useMultiplayerInternal.tsx   ← EDITED: CHAT_MESSAGE → P2P_CHAT_MESSAGE event, ChatMessagePayload import
│   ├── useP2PGameSync.ts            ← EDITED: handleChatMessage, LOCAL_CHAT_UPDATED emit; NEXT: add @mention detection + SHOW_TOAST
│   └── usePersistence.ts            ← EDITED: clear chat on resetGame
├── types/
│   └── multiplayer.ts               ← ChatMessagePayload type defined here
└── utils/
    └── eventBus.ts                  ← gameEventBus used for cross-component events
```

---

## User

---

## Assistant

**Tool: todowrite**

---

## Assistant

Let me read the relevant files to pick up where we left off.

**Tool: read**

**Tool: read**

---

## Assistant

Good. Now let me also check the `useMultiplayerChat.ts` and `GameContext` to understand the `playerName` access pattern:

**Tool: read**

**Tool: grep**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: glob**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: bash**

**Tool: bash**

---

## Assistant

**Tool: bash**

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

**Tool: bash**

---

## Assistant

Now I have all the context I need. The plan:

1. **`useP2PGameSync.ts`**: In `handleChatMessage`, detect `@playerName` mentions against `gameStateRef.current.playerName`, and emit `SHOW_TOAST`.
2. **`GameSidebar.tsx`**: 
   - Listen to `LOCAL_CHAT_UPDATED` event + track `hasUnreadChat` state.
   - Clear it when `activeTab === 'chat'`.
   - Show a green pulsing dot on the chat button in both desktop and mobile.

**Tool: todowrite**

---

## Assistant

Now let me add the `@mention` detection in `useP2PGameSync.ts`:

**Tool: edit**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: todowrite**

---

## Assistant

Now let me update `GameSidebar.tsx` to add the unread chat indicator. I need to:
1. Import `gameEventBus` and wire up `LOCAL_CHAT_UPDATED` listener
2. Track `hasUnreadChat` state, clear it when `activeTab === 'chat'`
3. Render the badge on both desktop and mobile chat buttons

**Tool: edit**

---

## Assistant

Those errors will resolve once I use them. Now update `GameSidebar` component to track unread state:

**Tool: edit**

---

## Assistant

Good — that will resolve when I add the badge. Now add the badge to the desktop chat button (inside the `navGroups` map where `item.id === 'chat'`):

**Tool: edit**

---

## Assistant

**Tool: todowrite**

---

## Assistant

Now add the same unread state logic to `MobileNavBar` and render the badge on the secondary-sheet chat button:

**Tool: edit**

---

## Assistant

Now add the badge inside the secondary-sheet button for chat. The current render loop for `secondaryItems` renders the icon inside a `div` with `className={mb-1 ${item.color || ''} shrink-0}`. I need to wrap that in a `relative` div and conditionally add the badge dot for the chat item:

**Tool: edit**

---

## Assistant

Now verify the full file looks correct and has no lingering errors:

**Tool: bash**

---

## Assistant

No errors. Let me do a quick sanity check on the final state of the two files:

**Tool: read**

**Tool: read**

---

## Assistant

Everything looks good. Let me mark the last task done:

**Tool: todowrite**

---

## Assistant

All three tasks are done. Here's a summary of what was implemented:

---

### Changes made

**`hooks/useP2PGameSync.ts`** — `@mention` detection  
Inside `handleChatMessage`, after saving the new message and emitting `LOCAL_CHAT_UPDATED`, it now checks if the message text contains `@<localPlayerName>` (case-insensitive, regex-escaped). If it matches, it fires:
```ts
gameEventBus.emit('SHOW_TOAST', { message: `${senderName} te ha mencionado en el chat`, type: 'info' })
```

**`components/GameSidebar.tsx`** — Unread chat badge (desktop + mobile)

Both `GameSidebar` and `MobileNavBar` now:
- Track `hasUnreadChat` state initialized to `false`
- Listen to `LOCAL_CHAT_UPDATED` via `gameEventBus` — sets `hasUnreadChat = true` only when the chat tab is not active (uses a ref to avoid stale closure)
- Reset `hasUnreadChat = false` whenever `activeTab === 'chat'`

**Desktop** (`GameSidebar`): The same animated ping-dot pattern used for `hasNewReports` (red) is rendered for the chat button in emerald green when `hasUnreadChat` is true.

**Mobile** (`MobileNavBar`): The chat icon in the bottom sheet grid gets an absolute-positioned emerald dot at its top-right corner with the same ping animation.

---

