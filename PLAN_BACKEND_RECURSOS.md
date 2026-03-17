Perfecto. Con todas las decisiones tomadas y el codebase completamente analizado, aquí está el plan completo.

---

# Plan: Migración de Producción de Recursos al Servidor con Supabase Realtime

## Resumen Arquitectónico

```
ANTES (actual):
  Cliente (RAF loop) → calculateNextTick() → setGameState() → auto-save cada 10s → Supabase JSONB blob
  (Client-authoritative: el cliente calcula todo y sube)

DESPUÉS (objetivo):
  Server (setInterval 5s) → processEconomyTick() → escribe player_resources → Supabase Realtime
       ↓                                                        ↓
  Supabase DB (source of truth)                    Cliente recibe broadcast
       ↓                                                        ↓
  player_resources table                           Zustand store actualiza
                                                         ↓
                                              Interpolación visual 1s (RAF)
                                                         ↓
                                              ResourceDisplay se actualiza fluido
```

**Resultado visual**: Los recursos suben cada segundo en pantalla como en OGame/Travian. El servidor es autoritativo. El cliente interpola entre snapshots usando las tasas de producción recibidas por Realtime.

---

## FASE 1: Nueva tabla `player_resources` + migración SQL

### 1.1 Crear tabla `player_resources` en Supabase

**Archivo**: `server/dbReset.js` (modificar) + nuevo SQL migration

```sql
CREATE TABLE IF NOT EXISTS public.player_resources (
  player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  
  -- Recursos actuales
  money DOUBLE PRECISION NOT NULL DEFAULT 5000,
  oil DOUBLE PRECISION NOT NULL DEFAULT 2500,
  ammo DOUBLE PRECISION NOT NULL DEFAULT 1500,
  gold DOUBLE PRECISION NOT NULL DEFAULT 500,
  diamond DOUBLE PRECISION NOT NULL DEFAULT 5,
  
  -- Tasas de producción netas (por segundo) - calculadas por el servidor
  money_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  oil_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  ammo_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  gold_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  diamond_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  
  -- Capacidades máximas
  money_max DOUBLE PRECISION NOT NULL DEFAULT 999999999999999,
  oil_max DOUBLE PRECISION NOT NULL DEFAULT 999999999999999,
  ammo_max DOUBLE PRECISION NOT NULL DEFAULT 999999999999999,
  gold_max DOUBLE PRECISION NOT NULL DEFAULT 999999999999999,
  diamond_max DOUBLE PRECISION NOT NULL DEFAULT 10,
  
  -- Banco (server-managed)
  bank_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  interest_rate DOUBLE PRECISION NOT NULL DEFAULT 0.15,
  next_rate_change BIGINT NOT NULL DEFAULT 0,
  
  -- Timestamp del último tick del servidor
  last_tick_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: jugador solo lee su propia fila
ALTER TABLE public.player_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own resources" ON public.player_resources
  FOR SELECT USING (auth.uid() = player_id);

-- Habilitar Realtime en esta tabla
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_resources;
```

**Payload de Realtime estimado**: ~200 bytes por UPDATE (solo columnas cambiadas).

### 1.2 Modificar `server/dbReset.js`

Agregar la creación de `player_resources` al hard reset. Cuando se crea un profile, también crear la fila correspondiente en `player_resources` con los valores iniciales de `INITIAL_GAME_STATE`.

---

## FASE 2: Server-side Economy Engine

### 2.1 Nuevo archivo: `server/engine/economyTick.js`

Portar la lógica de `utils/engine/economy.ts` + `utils/engine/modifiers.ts` al servidor en JS. Este módulo es una traducción fiel de las funciones puras existentes:

- `calculateTechMultipliers(researchedTechs, techLevels)` - desde `modifiers.ts:17-39`
- `calculateProductionRates(buildings, multipliers)` - desde `modifiers.ts:65-95`
- `calculateUpkeepCosts(units)` - desde `modifiers.ts:97-119`
- `calculateMaxStorage(buildings, multipliers, empirePoints)` - desde `modifiers.ts:43-63`
- `processServerEconomyTick(gameState, deltaTimeMs, now)` - desde `economy.ts:16-103`

La función principal `processServerEconomyTick` retorna:
```js
{
  resources: { money, oil, ammo, gold, diamond },
  rates: { money_rate, oil_rate, ammo_rate, gold_rate, diamond_rate }, // NET rates (prod - upkeep)
  maxStorage: { money_max, oil_max, ammo_max, gold_max, diamond_max },
  bankBalance, interestRate, nextRateChange,
  marketOffers, activeMarketEvent, marketNextRefreshTime,
  lifetimeResourcesMined
}
```

### 2.2 Nuevo archivo: `server/engine/productionLoop.js`

El loop principal del servidor que procesa TODOS los jugadores activos:

```js
const TICK_INTERVAL_MS = 5000; // 5 segundos
const playerLastTick = new Map(); // player_id → timestamp

export function startProductionLoop() {
  console.log('[ProductionLoop] Starting server economy engine (5s interval)...');
  setInterval(processAllActivePlayers, TICK_INTERVAL_MS);
}

async function processAllActivePlayers() {
  // 1. Query profiles con updated_at reciente (jugadores online = última escritura < 5min)
  // 2. Para cada perfil:
  //    a. Leer game_state del perfil (buildings, units, techs, bank)
  //    b. Leer player_resources (recursos actuales)
  //    c. Calcular deltaTime desde last_tick_at
  //    d. Ejecutar processServerEconomyTick()
  //    e. Escribir resultado a player_resources (batch upsert)
  //    f. Sincronizar recursos de vuelta a game_state.resources en profiles
  // 3. Supabase Realtime propaga automáticamente el UPDATE a los clientes suscritos
}
```

**Optimización clave**: En vez de N queries individuales, usar:
- Un `SELECT` batch para todos los perfiles activos
- Un `UPSERT` batch para actualizar `player_resources`
- Sincronización periódica (cada 30s) de `player_resources` → `profiles.game_state.resources` para mantener coherencia del blob

### 2.3 Modificar `server/index.js`

- Importar y arrancar `startProductionLoop()` junto con `startScheduler()`
- Nuevo endpoint: `POST /api/resources/deduct` (auth required) - para cuando el cliente necesita gastar recursos (construir, reclutar, etc.) y el servidor debe validar y restar del `player_resources`
- Nuevo endpoint: `POST /api/resources/add` (auth required, internal) - para añadir recursos (recompensas de combate, trades, etc.)

### 2.4 Integración con `server/scheduler.js`

El scheduler existente (para jugadores offline) también debe actualizar `player_resources` cuando procesa un perfil offline. Agregar un paso de economy tick para jugadores offline (con cap de `OFFLINE_PRODUCTION_LIMIT_MS = 6 horas`).

---

## FASE 3: Supabase Realtime - Suscripción en el Cliente

### 3.1 Nuevo Zustand store: `stores/resourceStore.ts`

```typescript
interface ResourceState {
  // Datos autoritativos del servidor (último snapshot)
  resources: Record<ResourceType, number>;
  rates: Record<ResourceType, number>;      // NET per-second rates
  maxResources: Record<ResourceType, number>;
  bankBalance: number;
  interestRate: number;
  lastServerTick: number;                    // timestamp del último snapshot
  
  // Estado de conexión Realtime
  isRealtimeConnected: boolean;
  
  // Interpolación local
  interpolatedResources: Record<ResourceType, number>; // Lo que ve el usuario
  
  // Actions
  applyServerSnapshot: (payload: ServerResourceSnapshot) => void;
  interpolate: (now: number) => void;        // Llamado cada frame por RAF
  setRealtimeConnected: (connected: boolean) => void;
}
```

Este store es **separado** del `gameStore` para evitar re-renders innecesarios. Solo los componentes que muestran recursos se suscriben a él.

### 3.2 Nuevo hook: `hooks/useResourceRealtime.ts`

```typescript
export const useResourceRealtime = () => {
  const { user } = useAuth();
  const applyServerSnapshot = useResourceStore(s => s.applyServerSnapshot);
  const setConnected = useResourceStore(s => s.setRealtimeConnected);
  
  useEffect(() => {
    if (!user) return;
    
    // Suscribirse a cambios en player_resources para MI fila
    const channel = supabase
      .channel(`resources:${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'player_resources',
        filter: `player_id=eq.${user.id}`
      }, (payload) => {
        applyServerSnapshot(payload.new);
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });
    
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);
};
```

### 3.3 Nuevo hook: `hooks/useResourceInterpolation.ts`

Loop de interpolación visual a 30 FPS (reutilizando el patrón de `useGameLoop.ts`):

```typescript
export const useResourceInterpolation = () => {
  const interpolate = useResourceStore(s => s.interpolate);
  
  useEffect(() => {
    let frameId: number;
    const loop = () => {
      interpolate(Date.now());
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);
};
```

La función `interpolate(now)` calcula:
```
interpolatedResources[res] = lastServerValue + (rate * (now - lastServerTick) / 1000)
// Clamped a [0, maxResources[res]]
```

Esto produce el efecto visual de recursos subiendo cada segundo, idéntico a OGame.

### 3.4 Selectores para el resourceStore

```typescript
// stores/selectors/resourceSelectors.ts
export const selectInterpolatedResources = (s: ResourceState) => s.interpolatedResources;
export const selectResourceRates = (s: ResourceState) => s.rates;
export const selectMaxResources = (s: ResourceState) => s.maxResources;
export const selectBankBalance = (s: ResourceState) => s.bankBalance;
export const selectInterestRate = (s: ResourceState) => s.interestRate;
export const selectIsRealtimeConnected = (s: ResourceState) => s.isRealtimeConnected;
```

---

## FASE 4: Migrar el Frontend a Datos del Servidor

### 4.1 Modificar `components/GameHeader.tsx`

Cambiar de leer `gameState.resources` (del gameStore) a leer `interpolatedResources` (del resourceStore):

```typescript
// ANTES:
const gameState = useGameStoreSelector(selectGameState);
const { production, upkeep } = useMemo(() => getIncomeStats(gameState), [...]);
// Usa: gameState.resources[ResourceType.MONEY]

// DESPUÉS:
const resources = useResourceStore(selectInterpolatedResources);
const rates = useResourceStore(selectResourceRates);
const maxResources = useResourceStore(selectMaxResources);
// Usa: resources[ResourceType.MONEY]
// Las rates ya vienen netas del servidor, no need to calculate locally
```

### 4.2 Modificar `components/ui/ResourceDisplay.tsx`

Sin cambios en el componente en sí - solo cambian los props que recibe desde `GameHeader`. El componente sigue recibiendo `value`, `production`, `upkeep`, etc.

### 4.3 Modificar `hooks/useGameLoop.ts`

**Eliminar** la llamada a `processEconomyTick` del loop local. El loop sigue ejecutando:
- `processSystemTick` (construcciones, reclutamientos, research - para barras de progreso locales)
- Rankings, reputation decay, progression

```typescript
// EN loop.ts - QUITAR:
const ecoUpdates = processEconomyTick(state, deltaTimeMs, now);
state = { ...state, ...ecoUpdates };

// El economy tick ahora vive 100% en el servidor
```

### 4.4 Sincronizar resourceStore ↔ gameStore

Cuando el servidor envía un snapshot de recursos via Realtime, el `resourceStore` se actualiza. Pero `gameState.resources` en el `gameStore` también necesita estar sincronizado para que otras partes del código (acciones, validaciones de costo, etc.) funcionen correctamente.

Nuevo efecto en `gameBootstrap.tsx`:
```typescript
// Sincronizar recursos autoritativos del servidor → gameState
useEffect(() => {
  const unsubscribe = useResourceStore.subscribe(
    (state) => state.resources,
    (serverResources) => {
      setSnapshot(prev => ({
        ...prev,
        gameState: { ...prev.gameState, resources: serverResources }
      }));
    }
  );
  return unsubscribe;
}, []);
```

### 4.5 Modificar `hooks/useGameActions.ts`

Las acciones que gastan recursos (build, recruit, research, trade, etc.) ahora deben:

1. **Validar localmente** que hay suficientes recursos (UX inmediata)
2. **Llamar al servidor** `POST /api/resources/deduct` para restar autoritativamente
3. **Si el servidor confirma**, aplicar la acción al gameState local
4. **Si el servidor rechaza** (recursos insuficientes), revertir y mostrar error

Esto previene exploits donde el cliente modifica sus recursos locales.

### 4.6 Modificar `hooks/usePersistence.ts`

El auto-save (`performAutoSave`) ya no necesita guardar `resources` en el blob `game_state` - esos datos viven en `player_resources`. Pero debe seguir guardando todo lo demás (buildings, units, techs, missions, etc.) en `profiles.game_state`.

---

## FASE 5: Offline Progress + Reconexión

### 5.1 Modificar `utils/engine/offline.ts`

Al reconectar (login o tab focus):
1. El servidor ya procesó la producción offline via el `scheduler.js` + `productionLoop.js`
2. El cliente recibe el estado actualizado de `player_resources` via Realtime al reconectarse
3. El `offlineReport` se calcula comparando `resources al desconectar` vs `resources actuales del servidor`
4. No más cálculo local de `calculateOfflineProgress` para recursos - el servidor es autoritativo

### 5.2 Modificar `server/scheduler.js`

Integrar economy tick para jugadores offline:
```javascript
// En processSingleProfile():
// NUEVO: Antes de procesar eventos militares, ejecutar economy tick
const deltaTimeMs = Math.min(now - state.lastSaveTime, OFFLINE_PRODUCTION_LIMIT_MS);
if (deltaTimeMs > 0) {
  const ecoResult = processServerEconomyTick(state, deltaTimeMs, now);
  // Actualizar player_resources con el resultado
  await updatePlayerResources(profile.id, ecoResult);
  // Sincronizar de vuelta al game_state
  state.resources = ecoResult.resources;
  state.bankBalance = ecoResult.bankBalance;
  // ... etc
  modified = true;
}
```

---

## FASE 6: Anti-cheat y Validación Server-Side

### 6.1 Nuevo middleware: `server/engine/resourceValidator.js`

```javascript
// Valida que el cliente no puede:
// 1. Modificar sus recursos directamente (solo via server endpoints)
// 2. Construir/reclutar sin tener recursos suficientes en player_resources
// 3. Manipular tasas de producción

export function validateResourceDeduction(playerId, costs) {
  // 1. Leer player_resources actual
  // 2. Verificar que todos los recursos >= costos
  // 3. Si OK: restar y retornar nuevo estado
  // 4. Si NO: retornar error
}
```

### 6.2 Modificar endpoints existentes

Los endpoints que modifican el estado del juego (`/api/profile/save`) deben **ignorar** `resources`, `bankBalance`, `maxResources` del payload del cliente. Esos campos se leen exclusivamente de `player_resources`.

---

## FASE 7: Cleanup y Testing

### 7.1 Archivos nuevos a crear

| Archivo | Propósito |
|---------|-----------|
| `server/engine/economyTick.js` | Economy engine server-side (port de economy.ts + modifiers.ts) |
| `server/engine/productionLoop.js` | Loop de producción cada 5s para jugadores activos |
| `server/engine/resourceValidator.js` | Validación de recursos server-side |
| `stores/resourceStore.ts` | Zustand store para recursos en tiempo real |
| `stores/selectors/resourceSelectors.ts` | Selectores del resource store |
| `hooks/useResourceRealtime.ts` | Suscripción Supabase Realtime |
| `hooks/useResourceInterpolation.ts` | Interpolación visual RAF a 30fps |

### 7.2 Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `server/index.js` | Nuevos endpoints + arrancar productionLoop |
| `server/scheduler.js` | Integrar economy tick offline |
| `server/dbReset.js` | Crear tabla `player_resources` |
| `utils/engine/loop.ts` | Quitar processEconomyTick del loop local |
| `hooks/useGameLoop.ts` | Sin economy tick local |
| `hooks/useGameEngine.ts` | Integrar useResourceRealtime |
| `hooks/usePersistence.ts` | No guardar resources en blob |
| `hooks/useGameActions.ts` | Validar gastos contra servidor |
| `components/GameHeader.tsx` | Leer de resourceStore |
| `stores/gameBootstrap.tsx` | Sincronizar resourceStore → gameStore |
| `stores/selectors/gameSelectors.ts` | Nuevos selectores de recursos |

### 7.3 Tests

- Test de integración: economy tick server-side produce mismos resultados que el client-side
- Test de Realtime: suscripción recibe updates correctamente
- Test de interpolación: valores interpolados son correctos entre snapshots
- Test de anti-cheat: cliente no puede gastar recursos que no tiene
- Test de offline: reconexión muestra recursos correctos

---

## Orden de Ejecución

| Paso | Fase | Descripción | Dependencia |
|------|------|-------------|-------------|
| 1 | F1 | Crear tabla `player_resources` + SQL + modificar `dbReset.js` | - |
| 2 | F2.1 | Port economy engine al servidor (`economyTick.js`) | - |
| 3 | F2.2 | Crear `productionLoop.js` (loop 5s) | 1, 2 |
| 4 | F2.3 | Nuevos endpoints en `server/index.js` + arrancar loop | 3 |
| 5 | F3.1 | Crear `resourceStore.ts` (Zustand) | - |
| 6 | F3.2 | Crear `useResourceRealtime.ts` (Supabase Realtime) | 1, 5 |
| 7 | F3.3 | Crear `useResourceInterpolation.ts` (RAF loop) | 5 |
| 8 | F4.1-4.2 | Migrar `GameHeader.tsx` a leer de `resourceStore` | 5, 6, 7 |
| 9 | F4.3 | Quitar economy tick del loop local | 4 |
| 10 | F4.4 | Sincronizar `resourceStore` ↔ `gameStore` en bootstrap | 5, 8 |
| 11 | F4.5 | Migrar acciones a validar contra servidor | 4 |
| 12 | F4.6 | Ajustar persistence (no guardar resources en blob) | 4, 10 |
| 13 | F5 | Offline progress + reconexión | 4, 6 |
| 14 | F6 | Anti-cheat: validación server-side de gastos | 4 |
| 15 | F7 | Tests + cleanup | Todo |

---

Confirma si estás de acuerdo con el plan y procedo a implementar comenzando por la Fase 1.
