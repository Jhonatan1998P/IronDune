# 🎮 Arquitectura Multijugador P2P para ShadowBound

> **Documentación completa del sistema multijugador peer-to-peer usando Trystero (WebRTC)**

---

## 📋 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura General](#arquitectura-general)
3. [Tecnologías Utilizadas](#tecnologías-utilizadas)
4. [Estructura de Archivos](#estructura-de-archivos)
5. [Hook Global: useMultiplayer](#hook-global-usemultiplayer)
6. [Provider: MultiplayerProvider](#provider-multiplayerprovider)
7. [Componentes UI](#componentes-ui)
8. [Flujos de Conexión](#flujos-de-conexión)
9. [Sistema de Presencia](#sistema-de-presencia)
10. [Comunicación Peer-to-Peer](#comunicación-peer-to-peer)
11. [Manejo de Errores y Reconexión](#manejo-de-errores-y-reconexión)
12. [Bugs Comunes y Soluciones](#bugs-comunes-y-soluciones)
13. [Guía de Implementación en Otro Proyecto](#guía-de-implementación-en-otro-proyecto)
14. [API Reference](#api-reference)

---

## 📌 Resumen Ejecutivo

Este sistema multijugador permite:
- ✅ **Crear salas** con códigos únicos compartibles
- ✅ **Unirse a salas** existentes mediante código
- ✅ **Reconectar** a la última sala después de desconexión
- ✅ **Sincronización en tiempo real** de estado de jugadores
- ✅ **Envío de datos** entre peers (ej: oro, acciones)
- ✅ **Detección automática** de conexión/desconexión de peers
- ✅ **Sin servidor central** - P2P puro con WebRTC

**Características clave:**
- **Sin backend**: Usa Trystero para WebRTC mesh
- **React + TypeScript**: Hooks, Context API, refs
- **Estado descentralizado**: Cada peer mantiene su estado local
- **Reconexión inteligente**: Mantiene roomId para reconectar

---

## 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA P2P                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌──────────┐         ┌──────────┐         ┌──────────┐      │
│    │  Peer A  │◄───────►│  Peer B  │◄───────►│  Peer C  │      │
│    │  (Host)  │  WebRTC │ Jugador  │  WebRTC │ Jugador  │      │
│    └────┬─────┘  Mesh   └────┬─────┘  Mesh   └────┬─────┘      │
│         │                    │                    │             │
│         │    ┌───────────────┴───────────────┐    │             │
│         │    │                               │    │             │
│         ▼    ▼                               ▼    ▼             │
│    ┌─────────────────────────────────────────────────────┐     │
│    │           Trystero (WebRTC Signaling)               │     │
│    │     - Usa DHT/Tracker para descubrimiento          │     │
│    │     - Sin servidor de juego central                │     │
│    └─────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de Datos

```
┌──────────────────────────────────────────────────────────────┐
│                    FLUJO DE DATOS                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Componente UI                                               │
│       │                                                      │
│       ▼                                                      │
│  useMultiplayer() hook                                       │
│       │                                                      │
│       ▼                                                      │
│  MultiplayerProvider (Context)                               │
│       │                                                      │
│       ▼                                                      │
│  Trystero Room (WebRTC)                                      │
│       │                                                      │
│       ▼                                                      │
│  Peers remotos (broadcast/unicast)                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tecnologías Utilizadas

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **React** | 19.2.3 | Framework UI |
| **TypeScript** | ~5.8.2 | Type safety |
| **Trystero** | ^0.22.0 | WebRTC P2P networking |
| **yjs** | ^13.6.29 | CRDT para estado compartido (opcional) |
| **y-trystero** | ^0.0.5 | Integración Yjs + Trystero |

### ¿Por qué Trystero?

```typescript
// Trystero provee:
// 1. Conexión WebRTC sin servidor signaling propio
// 2. API simple tipo "room"
// 3. Broadcast y unicast de mensajes
// 4. Detección de peer join/leave
// 5. Funciona detrás de NAT (usa trackers públicos)

import { joinRoom } from 'trystero/torrent';

const room = joinRoom({ appId: 'mi-app' }, 'roomId');
```

---

## 📁 Estructura de Archivos

```
src/
├── hooks/
│   └── useMultiplayer.tsx          # Hook principal + Provider
├── components/
│   └── UI/
│       ├── MultiplayerMenu.tsx     # Menú de creación/unión
│       └── RankingsView.tsx        # Vista de jugadores online
├── services/
│   └── eventBus.ts                 # Event bus para toasts/eventos
├── types.ts                        # Tipos compartidos
└── App.tsx                         # Integración con el juego
```

---

## 🪝 Hook Global: useMultiplayer

### Arquitectura del Hook

```typescript
┌─────────────────────────────────────────────────────────────┐
│                    useMultiplayer.tsx                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  MultiplayerProvider (Component)                     │   │
│  │  - Estado React (isConnected, peers, etc.)          │   │
│  │  - Refs para acceso síncrono (playerId, roomId)     │   │
│  │  - Cleanup automático al desmontar                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  useMultiplayer() (Custom Hook)                      │   │
│  │  - Expone funciones: createRoom, joinRoom, leave    │   │
│  │  - Expone estado: isConnected, remotePlayers, etc.  │   │
│  │  - Expone reconexión: reconnect(), currentRoomId    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Estado React (useState)

```typescript
const [isInitialized, setIsInitialized] = useState(false);
const [isConnected, setIsConnected] = useState(false);
const [isConnecting, setIsConnecting] = useState(false);
const [connectionError, setConnectionError] = useState<string | null>(null);
const [peers, setPeers] = useState<string[]>([]);
const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
const [remotePlayers, setRemotePlayers] = useState<PlayerPresence[]>([]);
const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
```

### Refs para Acceso Síncrono

**¿Por qué refs?** Los callbacks de Trystero se ejecutan asíncronamente. El estado de React puede no estar actualizado cuando se necesitan los valores.

```typescript
const roomRef = useRef<Room | null>(null);
const sendActionRef = useRef<ReturnType<Room['makeAction']>[0] | null>(null);
const getActionRef = useRef<ReturnType<Room['makeAction']>[1] | null>(null);
const actionsCallbackRef = useRef<((action: MultiplayerAction) => void) | null>(null);
const playersRef = useRef<Map<string, PlayerPresence>>(new Map());

// Refs para estado que cambia frecuentemente
const localPlayerIdRef = useRef<string | null>(null);
const currentRoomIdRef = useRef<string | null>(null);
const isConnectedRef = useRef(false);

// Timeouts pendientes para cleanup
const pendingTimeoutsRef = useRef<PendingTimeouts>({
  presenceTimeout: null,
  uiTimeout: null,
  broadcastTimeout: null,
});
```

### Funciones Principales

#### 1. `generatePlayerId()`

```typescript
const generatePlayerId = useCallback(() => {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}, []);
```

**Importante:** Siempre genera un ID nuevo. **NUNCA** uses `selfId` de Trystero porque persiste entre sesiones y causa que aparezcas como tu propio remote player.

#### 2. `initRoom(roomId)`

```typescript
const initRoom = useCallback((roomId: string): boolean => {
  // 1. Prevenir múltiples inicializaciones
  if (isConnecting || (isConnected && currentRoomIdRef.current === roomId)) {
    return false;
  }

  // 2. Cleanup de sala anterior
  if (roomRef.current) {
    cleanupRoom();
  }

  // 3. Resetear estado
  setIsConnecting(true);
  setConnectionError(null);
  setPeers([]);
  setRemotePlayers([]);
  playersRef.current.clear();

  // 4. Generar NUEVO playerId siempre
  const playerId = generatePlayerId();
  setLocalPlayerId(playerId);
  localPlayerIdRef.current = playerId;
  currentRoomIdRef.current = roomId;

  // 5. Crear room de Trystero
  const room = joinRoom({ appId: APP_ID }, roomId);
  roomRef.current = room;

  // 6. Configurar acciones
  const [sendAction, getAction] = room.makeAction('gameAction');
  sendActionRef.current = sendAction;
  getActionRef.current = getAction;

  // 7. Registrar listeners...
  // (ver sección de listeners más abajo)

  return true;
}, [/* dependencies */]);
```

#### 3. `cleanupRoom()`

```typescript
const cleanupRoom = useCallback(() => {
  // 1. Limpiar timeouts
  clearAllTimeouts();
  
  // 2. Dejar room de Trystero
  if (roomRef.current) {
    try {
      roomRef.current.leave();
    } catch (e) {
      console.warn('Error leaving room:', e);
    }
    roomRef.current = null;
  }
  
  // 3. Limpiar refs
  sendActionRef.current = null;
  getActionRef.current = null;
  playersRef.current.clear();
  
  // 4. Resetear estado React
  setIsConnected(false);
  setIsConnecting(false);
  setPeers([]);
  setRemotePlayers([]);
}, [clearAllTimeouts]);
```

#### 4. `broadcastPresence(playerId?)`

```typescript
const broadcastPresence = useCallback((usePlayerId?: string) => {
  const idToUse = usePlayerId || localPlayerIdRef.current;
  if (!sendActionRef.current || !idToUse || !isConnectedRef.current) return;

  const playerData = playersRef.current.get(idToUse);
  if (playerData) {
    try {
      sendActionRef.current({
        type: 'PRESENCE_UPDATE',
        payload: playerData,
        playerId: idToUse,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn('Error broadcasting presence:', e);
    }
  }
}, []);
```

**Nota:** Acepta `playerId` opcional para evitar race conditions cuando el estado de React aún no se actualizó.

#### 5. `updateRemotePlayers()`

```typescript
const updateRemotePlayers = useCallback(() => {
  const currentId = localPlayerIdRef.current;
  const allPlayers = Array.from(playersRef.current.values());
  // CRÍTICO: Excluir tu propio playerId de remotePlayers
  const filtered = currentId 
    ? allPlayers.filter(p => p.id !== currentId)
    : allPlayers;
  setRemotePlayers(filtered);
}, []);
```

---

## 🏢 Provider: MultiplayerProvider

### Context Setup

```typescript
interface MultiplayerContextType extends UseMultiplayerReturn {
  isInitialized: boolean;
}

const MultiplayerContext = createContext<MultiplayerContextType | null>(null);

export const useMultiplayerContext = (): MultiplayerContextType => {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error('useMultiplayerContext must be used within MultiplayerProvider');
  }
  return context;
};
```

### Provider Component

```typescript
export const MultiplayerProvider: React.FC<MultiplayerProviderProps> = ({ children }) => {
  // ... estado y refs ...

  return (
    <MultiplayerContext.Provider
      value={{
        isInitialized,
        isConnected,
        isConnecting,
        peers,
        localPlayerId,
        remotePlayers,
        syncPlayer,
        broadcastAction,
        sendToPeer,
        onRemoteAction,
        createRoom,
        joinRoomById,
        leave,
        reconnect,
        currentRoomId,
      }}
    >
      {children}
    </MultiplayerContext.Provider>
  );
};
```

### Cleanup al Desmontar

```typescript
// Cleanup automático cuando el provider se desmonta
useEffect(() => {
  return () => {
    cleanupRoom();
    isConnectedRef.current = false;
    localPlayerIdRef.current = null;
    currentRoomIdRef.current = null;
  };
}, [cleanupRoom]);
```

---

## 🎨 Componentes UI

### 1. MultiplayerMenu.tsx

**Propósito:** Menú modal para crear/unirse/reconectar a salas.

```typescript
interface MultiplayerMenuProps {
  onClose: () => void;
}

export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = ({ onClose }) => {
  const {
    isConnected,
    isConnecting,
    peers,
    remotePlayers,
    createRoom,
    joinRoomById,
    leave,
    reconnect,        // ← Nueva función
    currentRoomId,    // ← Nuevo estado
  } = useMultiplayer();

  // ... handlers ...

  return (
    <div className="fixed inset-0 z-50...">
      {/* Estado: Conectando */}
      {isConnecting && !isConnected && (
        <Loader2 className="animate-spin" />
      )}

      {/* Estado: Desconectado */}
      {!isConnected && !isConnecting && (
        <>
          {/* Botón de reconectar (si hay sala previa) */}
          {currentRoomId && (
            <button onClick={reconnect}>
              <RefreshCw /> Reconectar a sala anterior
            </button>
          )}

          {/* Crear sala */}
          <button onClick={createRoom}>
            <PlusCircle /> Crear Sala
          </button>

          {/* Unirse con código */}
          <input value={roomIdInput} onChange={...} />
          <button onClick={() => joinRoomById(roomIdInput)}>
            <LogIn /> Unirse
          </button>
        </>
      )}

      {/* Estado: Conectado */}
      {isConnected && (
        <>
          {/* Info de conexión */}
          <div>Conectado - {peers.length} jugadores</div>

          {/* Código de sala (copiable) */}
          <code>{currentRoomId}</code>
          <button onClick={copyToClipboard}>Copiar</button>

          {/* Lista de jugadores */}
          {remotePlayers.map(player => (
            <div key={player.id}>{player.name} - Lvl {player.level}</div>
          ))}

          {/* Salir */}
          <button onClick={leave}>
            <WifiOff /> Salir de la sala
          </button>
        </>
      )}
    </div>
  );
};
```

### 2. RankingsView.tsx

**Propósito:** Mostrar jugadores online en la sala + enviar oro.

```typescript
interface RankingsViewProps {
  player: Player;
  ladder: ArenaOpponent[];
  remotePlayers?: { id: string; name: string; level: number }[];
  onSendGold?: (playerId: string, amount: number) => void;
}

export const RankingsView: React.FC<RankingsViewProps> = ({ 
  player, 
  ladder, 
  remotePlayers = [],
  onSendGold 
}) => {
  return (
    <>
      {/* Sección de jugadores online */}
      {remotePlayers.length > 0 && (
        <div className="bg-green-900/20...">
          <Wifi /> Jugadores en la Sala ({remotePlayers.length})
          {remotePlayers.map(remote => (
            <button onClick={() => onSendGold?.(remote.id, 100)}>
              <User /> {remote.name} - Lvl {remote.level}
              <Send />
            </button>
          ))}
        </div>
      )}

      {/* Ranking de arena... */}
    </>
  );
};
```

---

## 🔄 Flujos de Conexión

### Flujo 1: Crear Sala

```typescript
// 1. Usuario hace click en "Crear Sala"
handleCreateRoom() → createRoom()

// 2. Generar roomId único
const roomId = `sb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

// 3. Inicializar room
initRoom(roomId)

// 4. Dentro de initRoom:
//    a. Cleanup previo si existe
//    b. Generar playerId nuevo
//    c. joinRoom({ appId: APP_ID }, roomId)
//    d. Configurar listeners
//    e. Broadcast presence inicial
//    f. Retornar roomId

// 5. UI muestra:
//    - Código de sala (copiable)
//    - "Esperando jugadores..."
//    - Botón "Salir de la sala"
```

### Flujo 2: Unirse a Sala

```typescript
// 1. Usuario ingresa código
handleJoinRoom() → joinRoomById(roomIdInput)

// 2. Validar código
if (!roomId || roomId.trim() === '') {
  showToast('Código inválido');
  return false;
}

// 3. Inicializar room (mismo flujo que crear)
initRoom(roomId.trim())

// 4. Broadcast presence + REQUEST_PRESENCE a peers existentes

// 5. UI muestra:
//    - Lista de jugadores existentes
//    - Botón "Salir de la sala"
```

### Flujo 3: Reconectar

```typescript
// 1. Usuario desconectado pero tiene currentRoomId
// 2. Click en "Reconectar a sala anterior"
handleReconnect() → reconnect()

// 3. Verificar si hay sala para reconectar
if (!currentRoomIdRef.current) {
  showToast('No hay sala para reconectar');
  return false;
}

// 4. Verificar si ya está conectado
if (isConnectedRef.current) {
  showToast('Ya estás conectado');
  return false;
}

// 5. Reconectar con mismo roomId (nuevo playerId)
initRoom(currentRoomIdRef.current)

// 6. UI muestra:
//    - "Reconectando..."
//    - Luego lista de jugadores actualizada
```

### Flujo 4: Salir de Sala

```typescript
// 1. Click en "Salir de la sala"
handleLeave() → leave()

// 2. Cleanup completo
cleanupRoom()
  → clearAllTimeouts()
  → room.leave() (notifica a otros peers)
  → limpiar refs
  → resetear estado React

// 3. Resetear refs adicionales
setCurrentRoomId(null);
setLocalPlayerId(null);
currentRoomIdRef.current = null;
localPlayerIdRef.current = null;
isConnectedRef.current = false;

// 4. UI vuelve a estado inicial
//    - Muestra botón "Reconectar" (porque currentRoomId se guardó antes)
```

---

## 👥 Sistema de Presencia

### Tipos de Presencia

```typescript
export interface PlayerPresence {
  id: string;        // playerId único
  name: string;      // Nombre del jugador
  level: number;     // Nivel del jugador
  lastSeen: number;  // Timestamp de última actualización
}
```

### Tipos de Acciones

```typescript
export interface MultiplayerAction {
  type: string;      // 'PRESENCE_UPDATE', 'REQUEST_PRESENCE', 'GIFT_GOLD'
  payload: unknown;  // Datos de la acción
  playerId: string;  // Quién envía
  timestamp: number; // Cuándo
  playerName?: string;
  playerLevel?: number;
}
```

### Listeners de Trystero

```typescript
// 1. Peer Join
room.onPeerJoin((peerId: string) => {
  setPeers(prev => [...new Set([...prev, peerId])]);
  
  // Request presence del nuevo peer
  sendAction({
    type: 'REQUEST_PRESENCE',
    payload: null,
    playerId: playerId,
    timestamp: Date.now(),
  }, peerId);

  // Broadcast nuestra presencia
  broadcastPresence(playerId);

  // Actualizar UI con delay
  setTimeout(() => updateRemotePlayers(), 500);
});

// 2. Peer Leave
room.onPeerLeave((peerId: string) => {
  setPeers(prev => prev.filter(p => p !== peerId));
  playersRef.current.delete(peerId);
  updateRemotePlayers();
});

// 3. Recepción de Acciones
getAction((action: any, peerId: string) => {
  // Ignorar nuestras propias acciones
  if (action.playerId === playerId) return;

  switch (action.type) {
    case 'PRESENCE_UPDATE':
      const playerData = action.payload as PlayerPresence;
      playersRef.current.set(peerId, { ...playerData, id: peerId });
      updateRemotePlayers();
      break;

    case 'REQUEST_PRESENCE':
      broadcastPresence(playerId);
      break;

    case 'GIFT_GOLD':
      const giftData = action.payload as { amount: number };
      if (giftData.amount > 0) {
        eventBus.emit(EventTypes.RECEIVE_GOLD, { amount: giftData.amount });
      }
      break;
  }
});
```

### Sincronización de Estado del Jugador

```typescript
// En App.tsx o componente padre
const multiplayer = useMultiplayer();

// Cuando el jugador cambia (nombre, nivel, etc.)
useEffect(() => {
  if (multiplayer.isConnected && player) {
    multiplayer.syncPlayer(player);
  }
}, [multiplayer.isConnected, player?.name, player?.level]);

// syncPlayer actualiza playersRef y broadcast a todos
const syncPlayer = useCallback((player: Player) => {
  const currentId = localPlayerIdRef.current;
  if (!currentId || !isConnectedRef.current) return;

  const playerData: PlayerPresence = {
    id: currentId,
    name: player.name,
    level: player.level,
    lastSeen: Date.now(),
  };

  playersRef.current.set(currentId, playerData);
  broadcastPresence();
}, [broadcastPresence]);
```

---

## 📡 Comunicación Peer-to-Peer

### Broadcast a Todos

```typescript
const broadcastAction = useCallback((action: MultiplayerAction) => {
  if (!sendActionRef.current || !localPlayerIdRef.current || !isConnectedRef.current) return;

  const actionWithPlayer = {
    ...action,
    playerId: localPlayerIdRef.current,
    timestamp: Date.now(),
  };

  try {
    sendActionRef.current(actionWithPlayer); // Sin peerId = broadcast
  } catch (e) {
    console.warn('Error broadcasting action:', e);
  }
}, []);
```

### Unicast a Peer Específico

```typescript
const sendToPeer = useCallback((peerId: string, action: MultiplayerAction) => {
  if (!sendActionRef.current || !localPlayerIdRef.current || !isConnectedRef.current) return;

  const actionWithPlayer = {
    ...action,
    playerId: localPlayerIdRef.current,
    timestamp: Date.now(),
  };

  try {
    sendActionRef.current(actionWithPlayer, peerId); // Con peerId = unicast
  } catch (e) {
    console.warn('Error sending to peer:', e);
  }
}, []);
```

### Ejemplo: Enviar Oro

```typescript
// En RankingsView.tsx
onSendGold={(peerId, amount) => {
  if (actions.spendGold(amount)) {
    multiplayer.sendToPeer(peerId, {
      type: 'GIFT_GOLD',
      payload: { amount },
      playerId: '',
      timestamp: 0
    });
  }
}}

// En el receptor (useMultiplayer.tsx)
case 'GIFT_GOLD':
  const giftData = action.payload as { amount: number };
  if (giftData.amount > 0) {
    eventBus.emit(EventTypes.SHOW_TOAST, {
      message: `¡Recibiste ${giftData.amount} oro!`,
      type: 'success',
    });
    eventBus.emit(EventTypes.RECEIVE_GOLD, { amount: giftData.amount });
  }
  break;
```

### Suscribirse a Acciones Remotas

```typescript
// En cualquier componente
const multiplayer = useMultiplayer();

useEffect(() => {
  multiplayer.onRemoteAction((action) => {
    console.log('Acción remota recibida:', action);
    // Manejar acción custom
  });
}, [multiplayer]);
```

---

## ⚠️ Manejo de Errores y Reconexión

### Error Handling en initRoom

```typescript
try {
  const room = joinRoom({ appId: APP_ID }, roomId);
  // ... configurar room ...
} catch (error) {
  console.error('Error connecting to room:', error);
  
  // Cleanup en caso de error
  if (room) {
    try {
      room.leave();
    } catch (e) {
      // Ignorar
    }
  }
  roomRef.current = null;
  sendActionRef.current = null;
  getActionRef.current = null;
  
  setIsConnecting(false);
  setIsConnected(false);
  setConnectionError('Error de conexión. Intenta de nuevo.');
  isConnectedRef.current = false;
  
  eventBus.emit(EventTypes.SHOW_TOAST, {
    message: 'Error al conectar. Intenta de nuevo.',
    type: 'error',
    duration: 4000
  });
  
  return false;
}
```

### Prevenir Múltiples Inicializaciones

```typescript
const initRoom = useCallback((roomId: string): boolean => {
  // Prevenir múltiples inicializaciones simultáneas
  if (isConnecting || (isConnected && currentRoomIdRef.current === roomId)) {
    console.warn('Already connecting or connected to this room');
    return false;
  }
  // ...
}, []);
```

### Timeout Cleanup

```typescript
interface PendingTimeouts {
  presenceTimeout: ReturnType<typeof setTimeout> | null;
  uiTimeout: ReturnType<typeof setTimeout> | null;
  broadcastTimeout: ReturnType<typeof setTimeout> | null;
}

const clearAllTimeouts = useCallback(() => {
  const timeouts = pendingTimeoutsRef.current;
  if (timeouts.presenceTimeout) clearTimeout(timeouts.presenceTimeout);
  if (timeouts.uiTimeout) clearTimeout(timeouts.uiTimeout);
  if (timeouts.broadcastTimeout) clearTimeout(timeouts.broadcastTimeout);
  pendingTimeoutsRef.current = { presenceTimeout: null, uiTimeout: null, broadcastTimeout: null };
}, []);
```

---

## 🐛 Bugs Comunes y Soluciones

### Bug 1: Apareces en Tu Propia Lista de Remote Players

**Causa:** `selfId` de Trystero persiste entre sesiones.

**Solución:**
```typescript
// ❌ MAL
const playerId = selfId || generatePlayerId();

// ✅ BIEN
const playerId = generatePlayerId(); // Siempre nuevo
```

**Filtro crítico:**
```typescript
// Siempre filtrar tu propio ID de remotePlayers
const filtered = allPlayers.filter(p => p.id !== currentId);
```

---

### Bug 2: Race Condition con playerId en Callbacks

**Causa:** `playerId` es variable local, pero los callbacks se ejecutan asíncronamente.

**Solución:** Usar refs para acceso síncrono.
```typescript
// Refs
const localPlayerIdRef = useRef<string | null>(null);

// Setear ambos
setLocalPlayerId(playerId);
localPlayerIdRef.current = playerId;

// En callbacks, usar ref
const idToUse = localPlayerIdRef.current;
```

---

### Bug 3: Memory Leaks con setTimeout

**Causa:** Timeouts no se limpian al desmontar o reconectar.

**Solución:**
```typescript
// Tracking de timeouts
const pendingTimeoutsRef = useRef<PendingTimeouts>({...});

// Cleanup function
const clearAllTimeouts = useCallback(() => {
  // Clear all...
}, []);

// Llamar en cleanupRoom y useEffect de desmontaje
```

---

### Bug 4: Listeners Duplicados

**Causa:** `initRoom` se llama múltiples veces sin cleanup previo.

**Solución:**
```typescript
// Prevenir re-inicialización
if (isConnecting || (isConnected && currentRoomIdRef.current === roomId)) {
  return false;
}

// Cleanup previo
if (roomRef.current) {
  cleanupRoom();
}
```

---

### Bug 5: Estado Stale Después de Reconexión

**Causa:** `playersRef` mantiene datos de sesión anterior.

**Solución:**
```typescript
// Limpiar en initRoom
playersRef.current.clear();

// Limpiar en cleanupRoom
playersRef.current.clear();
```

---

## 🚀 Guía de Implementación en Otro Proyecto

### Paso 1: Instalar Dependencias

```bash
npm install trystero yjs y-trystero
```

### Paso 2: Copiar Archivos Base

1. Copiar `hooks/useMultiplayer.tsx` a tu proyecto
2. Copiar `components/UI/MultiplayerMenu.tsx` (adaptar según necesites)
3. Copiar tipos a tu `types.ts`

### Paso 3: Configurar Provider en App

```typescript
// App.tsx
import { MultiplayerProvider } from './hooks/useMultiplayer';

export default function App() {
  return (
    <MultiplayerProvider>
      <AppContent />
    </MultiplayerProvider>
  );
}

function AppContent() {
  const multiplayer = useMultiplayer();
  // ... tu lógica ...
}
```

### Paso 4: Integrar con Tu Juego

```typescript
// En tu componente principal
const multiplayer = useMultiplayer();

// Sincronizar estado del jugador
useEffect(() => {
  if (multiplayer.isConnected && player) {
    multiplayer.syncPlayer(player);
  }
}, [multiplayer.isConnected, player?.name, player?.level]);

// Escuchar eventos custom
useEffect(() => {
  multiplayer.onRemoteAction((action) => {
    switch (action.type) {
      case 'TU_ACCION_CUSTOM':
        // Manejar acción
        break;
    }
  });
}, [multiplayer]);
```

### Paso 5: Agregar UI de Conexión

```typescript
// Botón para abrir menú
<button onClick={() => setShowMultiplayer(true)}>
  <Users /> Multijugador
</button>

{showMultiplayer && (
  <MultiplayerMenu onClose={() => setShowMultiplayer(false)} />
)}
```

### Paso 6: Personalizar APP_ID

```typescript
// En useMultiplayer.tsx
const APP_ID = 'tu-app-unique-id'; // Cambiar para evitar colisiones
```

### Paso 7: Agregar Tus Propias Acciones

```typescript
// Definir tipos
type CustomActionType = 'SYNC_SCORE' | 'PLAYER_MOVE' | 'CHAT_MESSAGE';

// Enviar
multiplayer.broadcastAction({
  type: 'SYNC_SCORE',
  payload: { score: 100 },
  playerId: '',
  timestamp: Date.now(),
});

// Recibir
multiplayer.onRemoteAction((action) => {
  if (action.type === 'SYNC_SCORE') {
    const { score } = action.payload as { score: number };
    // Actualizar UI
  }
});
```

---

## 📖 API Reference

### useMultiplayer() Hook

```typescript
interface UseMultiplayerReturn {
  // Estado
  isInitialized: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  peers: string[];                    // IDs de peers conectados
  localPlayerId: string | null;       // Tu playerId
  remotePlayers: PlayerPresence[];    // Jugadores remotos
  currentRoomId: string | null;       // roomId actual

  // Funciones de conexión
  createRoom: () => string;           // Crea sala, retorna roomId
  joinRoomById: (roomId: string) => boolean; // Unirse a sala
  leave: () => void;                  // Salir de sala
  reconnect: () => boolean;           // Reconectar a última sala

  // Sincronización
  syncPlayer: (player: Player) => void; // Actualizar tu presencia

  // Comunicación
  broadcastAction: (action: MultiplayerAction) => void; // A todos
  sendToPeer: (peerId: string, action: MultiplayerAction) => void; // A uno
  onRemoteAction: (callback: (action: MultiplayerAction) => void) => void; // Escuchar
}
```

### Tipos

```typescript
interface PlayerPresence {
  id: string;
  name: string;
  level: number;
  lastSeen: number;
}

interface MultiplayerAction {
  type: string;
  payload: unknown;
  playerId: string;
  timestamp: number;
  playerName?: string;
  playerLevel?: number;
}
```

### Acciones Built-in

| Acción | Tipo | Payload | Dirección | Propósito |
|--------|------|---------|-----------|-----------|
| `PRESENCE_UPDATE` | Sistema | `PlayerPresence` | Broadcast | Actualizar presencia |
| `REQUEST_PRESENCE` | Sistema | `null` | Unicast | Pedir presencia |
| `GIFT_GOLD` | Custom | `{ amount: number }` | Unicast | Enviar oro |

---

## 📝 Checklist de Implementación

- [ ] Copiar `useMultiplayer.tsx`
- [ ] Copiar `MultiplayerMenu.tsx`
- [ ] Configurar `APP_ID` único
- [ ] Envolver app con `MultiplayerProvider`
- [ ] Agregar botón para abrir menú
- [ ] Implementar `syncPlayer` con tu estado
- [ ] Definir acciones custom para tu juego
- [ ] Implementar handlers para acciones recibidas
- [ ] Testear: crear sala, unirse, reconectar, salir
- [ ] Testear: múltiples peers simultáneos
- [ ] Testear: desconexión y reconexión

---

## 🔐 Consideraciones de Seguridad

1. **No hay autenticación**: Cualquier puede unirse con el roomId
2. **No hay encriptación**: Los mensajes van en claro (WebRTC los encripta, pero el roomId es público)
3. **Validar payloads**: Siempre validar datos recibidos antes de usarlos
4. **Rate limiting**: Implementar si es necesario para evitar spam
5. **RoomId único**: Usar timestamp + random para evitar colisiones

---

## 📊 Limitaciones

| Limitación | Descripción | Workaround |
|------------|-------------|------------|
| **Mesh P2P** | Cada peer se conecta a todos | Máx ~10-15 peers por sala |
| **NAT/Firewall** | Algunos routers bloquean WebRTC | Usar TURN server (no incluido) |
| **Sin persistencia** | Datos se pierden al salir | Usar y-indexeddb para persistencia local |
| **Sin servidor** | No hay autoridad central | Implementar consenso para estado crítico |

---

## 🎯 Mejoras Futuras

1. **Host migration**: Si el host sale, elegir nuevo host
2. **Voice chat**: Usar WebRTC data channels para audio
3. **Lobby system**: Estado de "ready" antes de empezar
4. **Spectator mode**: Ver partida sin jugar
5. **Replay system**: Grabar acciones para replay

---

## 📞 Soporte

Para issues o preguntas, revisar:
- [Documentación de Trystero](https://github.com/dmotz/trystero)
- [WebRTC API](https://webrtc.org/)
- [Yjs CRDT](https://docs.yjs.dev/)

---

**Versión del documento:** 1.0  
**Última actualización:** 2026  
**Autor:** ShadowBound Development Team
