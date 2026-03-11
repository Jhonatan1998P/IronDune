# Plan Guerra Total v2.0 — Sistema Hybrid: Escombros + Guerra P2P/Bot

> Iron Dune: Operations — Documento de Diseño Técnico  
> Fecha: Marzo 2026  
> Estado: Plan de Implementación

---

## 1. RESUMEN EJECUTIVO

Este plan fusiona el sistema de **Guerra Total** actual de Iron Dune con las mecánicas de **Campos de Escombros** (Debris Fields) inspiradas en OGame/PBBG, adaptadas al contexto militar-moderno del juego. El resultado es un sistema donde **cada batalla genera residuos recuperables**, creando una economía de guerra circular donde atacar, defender y reciclar son estrategias igualmente válidas.

### Principios de Diseño

1. **Cada batalla tiene consecuencias económicas reales** — las unidades destruidas generan escombros recuperables
2. **Riesgo-recompensa tangible** — atacar genera loot pero también escombros que el enemigo puede reciclar
3. **Terceros actores** — en P2P, otros jugadores conectados pueden disputar los escombros
4. **Persistencia total** — los escombros persisten en el estado del juego y se sincronizan vía Trystero
5. **Integración no-invasiva** — el sistema se construye SOBRE el motor de combate existente (`combat.ts`) sin modificar su lógica core

---

## 2. ANÁLISIS DEL SISTEMA ACTUAL

### 2.1 Motor de Combate (`utils/engine/combat.ts`)

El motor actual ya calcula todo lo necesario para generar escombros:

| Dato disponible | Ubicación | Uso para Escombros |
|---|---|---|
| `totalPlayerCasualties` | `BattleResult:326` | Base para calcular escombros del jugador |
| `totalEnemyCasualties` | `BattleResult:327` | Base para calcular escombros del enemigo |
| `totalAllyCasualties` | `BattleResult:342` | Escombros generados por aliados caídos |
| `playerDamageDealt` | `BattleResult:332` | Factor de bonus por daño excesivo |
| `UNIT_DEFS[type].cost` | `data/units.ts` | Valor en recursos de cada unidad destruida |

### 2.2 Sistema de Guerra (`utils/engine/war.ts`)

- 8 oleadas base con overtime en empate (`constants.ts:49-52`)
- Loot pool acumulativo (`WarState.lootPool` en `types/state.ts:166`)
- Guarnición enemiga persistente (`WarState.currentEnemyGarrison` en `types/state.ts:175`)
- Distribución de botín al final de la guerra (`distributeWarLoot` en `war.ts:373`)

### 2.3 Sistema P2P (`hooks/useMultiplayerInternal.tsx`)

- Trystero via WebTorrent con 5 trackers (`useMultiplayerInternal.tsx:42-48`)
- Sala global compartida (`GLOBAL_ROOM_ID = 'iron-dune-global-v1'`)
- Handshake de batalla: `P2PAttackRequest` -> `P2PBattleRequestTroops` -> `P2PBattleDefenderTroops` -> `P2PAttackResult`
- Event bus desacoplado (`utils/eventBus.ts`) con tipos en `types/events.ts`

### 2.4 Persistencia (`hooks/usePersistence.ts`)

- `localStorage` con key `ironDuneSave`
- Auto-save cada 30 segundos (`AUTO_SAVE_INTERVAL_MS`)
- Save completo en `beforeunload`
- Export/Import con codificación segura

---

## 3. SISTEMA DE CAMPOS DE ESCOMBROS (DEBRIS FIELDS)

### 3.1 Concepto Core

En OGame, cuando se destruyen naves en combate, un porcentaje del coste en recursos de esas naves se convierte en un "campo de escombros" flotante que cualquier jugador con naves recicladoras puede recoger. En Iron Dune adaptamos esto así:

> **Cuando unidades son destruidas en cualquier combate (raid, guerra, P2P), un porcentaje del coste de producción de esas unidades se convierte en un Campo de Escombros (Salvage Zone) que puede ser recolectado.**

### 3.2 Fórmula de Generación de Escombros

```typescript
// Constantes propuestas
const DEBRIS_RATIO_ATTACKER = 0.30;    // 30% del coste de unidades atacantes destruidas
const DEBRIS_RATIO_DEFENDER = 0.30;    // 30% del coste de unidades defensoras destruidas
const DEBRIS_RATIO_ALLY = 0.20;        // 20% del coste de unidades aliadas destruidas (menos por ser refuerzos)

// Recursos que generan escombros (NO todos)
const DEBRIS_ELIGIBLE_RESOURCES = [
    ResourceType.MONEY,   // Equivale a "metal" en OGame
    ResourceType.OIL,     // Equivale a "cristal" en OGame
    ResourceType.AMMO     // Recurso adicional de Iron Dune
];
// GOLD y DIAMOND NO generan escombros (recursos premium, se pierden al 100%)
```

**Ejemplo concreto:**
- Un `TITAN_MBT` cuesta `{money: 250000, oil: 500, ammo: 1500}`
- Si muere en combate, genera escombros:
  - `money: 250000 * 0.30 = 75,000`
  - `oil: 500 * 0.30 = 150`
  - `ammo: 1500 * 0.30 = 450`
- Un `PHANTOM_SUB` cuesta `{money: 15000000, oil: 1500000, ammo: 5000000}`
- Si muere: genera `{money: 4,500,000, oil: 450,000, ammo: 1,500,000}` en escombros

### 3.3 Estructura de Datos — `DebrisField`

```typescript
// types/state.ts - NUEVA INTERFACE
export interface DebrisField {
    id: string;                                          // "debris-{battleId}-{timestamp}"
    battleId: string;                                    // ID de la batalla que lo generó
    origin: 'WAR' | 'RAID' | 'P2P' | 'CAMPAIGN';       // Tipo de combate que lo generó
    
    // Recursos disponibles para recolectar
    resources: Partial<Record<ResourceType, number>>;    // Solo MONEY, OIL, AMMO
    
    // Metadata
    createdAt: number;                                   // Timestamp de creación
    expiresAt: number;                                   // Timestamp de expiración (si no se recolecta)
    totalValue: number;                                  // Valor total original (para UI/sorting)
    
    // Jugadores involucrados (para prioridad de recolección)
    attackerId: string;                                  // ID del atacante (bot o player)
    attackerName: string;
    defenderId: string;                                  // ID del defensor (bot o player)
    defenderName: string;
    
    // Estado de recolección
    isPartiallyHarvested: boolean;                       // Si alguien ya sacó algo
    harvestedBy: string[];                               // IDs de quienes han recolectado
    
    // P2P sync
    isP2P: boolean;                                      // Si fue generado en combate P2P
    p2pBroadcasted: boolean;                             // Si ya se anunció a la red P2P
    
    // Contexto de guerra (si aplica)
    warId?: string;                                      // ID de la guerra activa
    waveNumber?: number;                                 // Oleada que lo generó
}
```

### 3.4 Reglas de Expiración

| Origen | Duración | Razón |
|---|---|---|
| `RAID` (bot ataca jugador) | 60 minutos | Recompensa rápida por defender |
| `WAR` (oleadas de guerra) | Hasta fin de guerra + 30 min | Se acumulan durante la guerra, se recogen al final |
| `P2P` (jugador vs jugador) | 120 minutos | Tiempo para disputar con naves de salvamento |
| `CAMPAIGN` | 30 minutos | Menor importancia económica |

```typescript
// constants.ts - NUEVAS CONSTANTES
export const DEBRIS_EXPIRY_RAID_MS = 60 * 60 * 1000;        // 1 hora
export const DEBRIS_EXPIRY_WAR_BUFFER_MS = 30 * 60 * 1000;  // 30 min después de fin de guerra
export const DEBRIS_EXPIRY_P2P_MS = 120 * 60 * 1000;        // 2 horas
export const DEBRIS_EXPIRY_CAMPAIGN_MS = 30 * 60 * 1000;    // 30 minutos
export const DEBRIS_MAX_ACTIVE = 20;                         // Máximo campos activos simultáneos
export const DEBRIS_RATIO_ATTACKER = 0.30;
export const DEBRIS_RATIO_DEFENDER = 0.30;
export const DEBRIS_RATIO_ALLY = 0.20;
```

---

## 4. UNIDAD DE SALVAMENTO — SALVAGER DRONE

### 4.1 Concepto

En OGame existe el "Recycler" (Reciclador), una nave diseñada para recolectar campos de escombros. En Iron Dune, introducimos el **Salvager Drone** — un dron autónomo de recuperación de materiales.

**Diferencia clave vs OGame:** El Salvager Drone NO es una unidad de combate. Es puramente logístico, sin ataque ni defensa. Esto lo hace un **target jugoso** si es interceptado.

### 4.2 Definición de Unidad

```typescript
// types/enums.ts - AÑADIR al enum UnitType
export enum UnitType {
    // ... existentes ...
    SALVAGER_DRONE = 'SALVAGER_DRONE'
}

// data/units.ts - NUEVA DEFINICIÓN
[UnitType.SALVAGER_DRONE]: {
    id: UnitType.SALVAGER_DRONE,
    category: UnitCategory.GROUND,           // Categoría logística
    translationKey: 'salvager_drone',
    reqTech: TechType.UNLOCK_SALVAGER_DRONE, // Nueva tech requerida
    hp: 500,                                  // Resistente pero no tanque
    attack: 1,                                // Prácticamente nulo (no combate)
    defense: 100,                             // Algo de blindaje para sobrevivir
    threshold: 0.0,                           // Sin threshold
    recruitTime: 90000,                       // 1.5 minutos
    cost: { money: 100000, oil: 500, ammo: 0 },  // Barato en ammo (no es militar)
    upkeep: { [ResourceType.MONEY]: rate(100), [ResourceType.OIL]: rate(15) },
    rapidFire: {},                            // Sin rapidFire
    score: 10,                                // Bajo score (no es militar)
    
    // NUEVO campo específico para Salvager
    cargoCapacity: 500000,                    // Cada dron puede cargar 500K en valor de recursos
}
```

### 4.3 Nueva Tecnología

```typescript
// types/enums.ts - AÑADIR al enum TechType
UNLOCK_SALVAGER_DRONE = 'UNLOCK_SALVAGER_DRONE'

// data/techs.ts - NUEVA DEFINICIÓN
[TechType.UNLOCK_SALVAGER_DRONE]: {
    id: TechType.UNLOCK_SALVAGER_DRONE,
    category: TechCategory.LOGISTICS,
    cost: { money: 200000, oil: 1000, ammo: 500 },
    translationKey: 'unlock_salvager_drone',
    researchTime: 300000,                    // 5 minutos
    reqUniversityLevel: 3,
    reqTechs: [TechType.PATROL_TRAINING],    // Requiere patrullas básicas
    score: 25,
}
```

### 4.4 Mecánica de Capacidad de Carga

```typescript
// Cada SALVAGER_DRONE puede cargar hasta 500,000 en valor total de recursos
// El valor se calcula como: money * 1 + oil * 10 + ammo * 5
// (usando los mismos ratios de conversión del loot de guerra)

const CARGO_CONVERSION_RATES: Record<ResourceType, number> = {
    [ResourceType.MONEY]: 1,
    [ResourceType.OIL]: 10,
    [ResourceType.AMMO]: 5,
    [ResourceType.GOLD]: 50,      // No aplica a escombros pero para consistencia
    [ResourceType.DIAMOND]: 500,  // No aplica a escombros
};

const SALVAGER_CARGO_CAPACITY = 500000; // por dron

// Función: calcular cuántos drones se necesitan para vaciar un campo
const calculateRequiredDrones = (debris: DebrisField): number => {
    let totalValue = 0;
    for (const [res, amount] of Object.entries(debris.resources)) {
        totalValue += (amount || 0) * (CARGO_CONVERSION_RATES[res as ResourceType] || 1);
    }
    return Math.ceil(totalValue / SALVAGER_CARGO_CAPACITY);
};
```

---

## 5. MISIÓN DE SALVAMENTO — NUEVA MISIÓN

### 5.1 Flujo de Misión

```
[Jugador ve Debris Field en UI] 
    → [Selecciona campo + asigna Salvager Drones]
    → [Misión tipo 'SALVAGE' se crea con travel time]
    → [Al llegar, se recolectan recursos proporcionales a drones enviados]
    → [Drones regresan con carga]
    → [Si el campo era P2P, otros jugadores pueden interceptar los drones de regreso]
```

### 5.2 Tipo de Misión

```typescript
// types/state.ts - AMPLIAR ActiveMission.type
export interface ActiveMission {
    id: string;
    type: 'PATROL' | 'CAMPAIGN_ATTACK' | 'PVP_ATTACK' | 'SALVAGE'; // NUEVO: SALVAGE
    // ... campos existentes ...
    debrisFieldId?: string;    // ID del campo de escombros objetivo
    cargoCapacity?: number;    // Capacidad total de carga de los drones enviados
    harvestedResources?: Partial<Record<ResourceType, number>>; // Recursos recolectados (se llena al resolver)
}
```

### 5.3 Tiempo de Viaje

```typescript
// El salvamento es más rápido que un ataque (drones logísticos, no ejército)
export const SALVAGE_TRAVEL_TIME_MS = 7.5 * 60 * 1000;  // 7.5 minutos (mitad del travel normal)
export const SALVAGE_TRAVEL_TIME_WAR_MS = 5 * 60 * 1000; // 5 minutos durante guerra activa (prioridad)
```

### 5.4 Resolución de Salvamento

```typescript
// utils/engine/salvage.ts - NUEVO ARCHIVO

export const resolveSalvageMission = (
    mission: ActiveMission,
    debrisField: DebrisField,
    currentResources: Record<ResourceType, number>,
    maxResources: Record<ResourceType, number>
): SalvageResult => {
    
    // 1. Verificar que el campo aún existe y tiene recursos
    if (!debrisField || debrisField.expiresAt < Date.now()) {
        return { success: false, reason: 'EXPIRED', resources: {} };
    }
    
    // 2. Calcular capacidad de carga total de los drones enviados
    const dronesCount = mission.units?.[UnitType.SALVAGER_DRONE] || 0;
    const totalCapacity = dronesCount * SALVAGER_CARGO_CAPACITY;
    
    // 3. Recolectar recursos proporcionalmente hasta llenar capacidad
    const harvested: Partial<Record<ResourceType, number>> = {};
    let capacityUsed = 0;
    
    for (const res of DEBRIS_ELIGIBLE_RESOURCES) {
        const available = debrisField.resources[res] || 0;
        if (available <= 0) continue;
        
        const valuePerUnit = CARGO_CONVERSION_RATES[res];
        const maxCanTake = Math.floor((totalCapacity - capacityUsed) / valuePerUnit);
        const toTake = Math.min(available, maxCanTake);
        
        if (toTake > 0) {
            harvested[res] = toTake;
            capacityUsed += toTake * valuePerUnit;
        }
        
        if (capacityUsed >= totalCapacity) break;
    }
    
    return {
        success: true,
        reason: 'HARVESTED',
        resources: harvested,
        dronesReturned: dronesCount, // Todos regresan (no hay combate en salvamento puro)
        remainingDebris: calculateRemainingDebris(debrisField, harvested)
    };
};
```

---

## 6. INTEGRACIÓN CON GUERRA TOTAL (BOTS)

### 6.1 Escombros en Oleadas de Guerra

Actualmente, `processWarTick` en `war.ts:648` procesa oleadas y acumula pérdidas en `lootPool`. El nuevo sistema **mantiene el lootPool** pero TAMBIÉN genera campos de escombros:

```typescript
// war.ts - MODIFICACIÓN en processIncomingAttacks (línea ~934)

// DESPUÉS de resolver combate (línea 940):
const combat = attack.isWarWave && activeWar
    ? resolveWarCombat(units, attack.units, 1.0, state)
    : resolveRaidCombat(units, attack.units, buildings, 1.0, state);

// NUEVO: Generar campo de escombros
const debrisField = generateDebrisFromCombat(
    combat,
    attack.isWarWave ? 'WAR' : 'RAID',
    attack.id,
    {
        attackerId: attack.attackerId || activeWar?.enemyId || 'UNKNOWN',
        attackerName: attack.attackerName,
        defenderId: state.gameId,
        defenderName: state.playerName
    },
    activeWar?.id
);

if (debrisField && debrisField.totalValue > 0) {
    // Añadir al estado
    state.debrisFields = [...(state.debrisFields || []), debrisField];
}
```

### 6.2 Escombros en Ataques del Jugador (Raids a Bots)

Cuando el jugador ataca a un bot, se genera un campo de escombros con las bajas de AMBOS bandos:

```typescript
// missions.ts - MODIFICACIÓN en resolveMission para PVP_ATTACK

// Después de simulateCombat:
const debris = generateDebrisFromCombat(
    battleResult,
    'RAID',
    mission.id,
    {
        attackerId: 'PLAYER',
        attackerName: playerName,
        defenderId: mission.targetId || 'BOT',
        defenderName: mission.targetName || 'Unknown'
    }
);

// Incluir en el resultado de la misión
missionResult.generatedDebris = debris;
```

### 6.3 Nuevo Flujo de Guerra Total con Escombros

```
FASE 1: DECLARACIÓN DE GUERRA
├── Se genera guarnición enemiga (sin cambio)
├── Se envía primera oleada (sin cambio)
└── NUEVO: Se inicializa warDebrisPool = []

FASE 2: OLEADAS (1-8)
├── Oleada llega → simulateCombat (sin cambio)
├── Se aplican bajas (sin cambio)
├── Se actualiza lootPool (sin cambio)
├── NUEVO: Se genera DebrisField por oleada
├── NUEVO: El jugador puede enviar Salvager Drones ENTRE oleadas
└── NUEVO: Los drones regresan con recursos recuperados de escombros

FASE 3: CONTRAATAQUES DEL JUGADOR (hasta 8)
├── Jugador ataca guarnición (sin cambio)
├── Se generan bajas en ambos bandos (sin cambio)
├── NUEVO: Se genera DebrisField por cada contraataque
└── NUEVO: El jugador puede enviar drones simultáneamente con ataques

FASE 4: FIN DE GUERRA
├── Se determina ganador (sin cambio)
├── Se distribuye lootPool (sin cambio)
├── NUEVO: Todos los DebrisFields de la guerra se fusionan en un MEGA campo
├── NUEVO: El mega campo dura 30 min extra después de la guerra
└── NUEVO: Si hay jugadores P2P conectados, el mega campo es VISIBLE y DISPUTABLE

FASE 5: POST-GUERRA (NUEVA)
├── El jugador ganador tiene 5 minutos de prioridad para enviar drones
├── Después, el campo se abre a terceros (P2P)
└── Escombros restantes se autoliquidan al expirar (MONEY agregado al banco)
```

### 6.4 Estado de Guerra Actualizado

```typescript
// types/state.ts - MODIFICAR WarState
export interface WarState {
    // ... campos existentes sin cambio ...
    
    // NUEVOS campos de escombros de guerra
    warDebrisIds: string[];                              // IDs de debris generados durante la guerra
    totalDebrisGenerated: Record<ResourceType, number>;  // Acumulador de escombros totales
    debrisHarvestedDuringWar: Record<ResourceType, number>; // Lo que el jugador ya recogió mid-war
}
```

---

## 7. INTEGRACIÓN P2P CON TRYSTERO

### 7.1 Nuevos Tipos de Acción Multiplayer

```typescript
// types/multiplayer.ts - NUEVOS TIPOS

// Acciones P2P para el sistema de escombros
export enum MultiplayerActionType {
    // ... existentes ...
    
    // Debris System
    DEBRIS_ANNOUNCE = 'DEBRIS_ANNOUNCE',          // Anunciar campo de escombros a la red
    DEBRIS_CLAIM = 'DEBRIS_CLAIM',                // Reclamar salvamento de un campo
    DEBRIS_DISPUTE = 'DEBRIS_DISPUTE',            // Disputar un campo ya reclamado
    DEBRIS_HARVESTED = 'DEBRIS_HARVESTED',        // Confirmar que se recolectaron recursos
    DEBRIS_EXPIRED = 'DEBRIS_EXPIRED',            // Notificar que un campo expiró
}

// Payload de anuncio de escombros
export interface DebrisAnnouncePayload {
    debrisField: DebrisField;
    battleSummary: {
        attackerName: string;
        defenderName: string;
        attackerCasualties: number;  // Total units lost
        defenderCasualties: number;
        winner: 'PLAYER' | 'ENEMY' | 'DRAW';
    };
}

// Payload de reclamo de salvamento
export interface DebrisClaimPayload {
    debrisId: string;
    claimerId: string;
    claimerName: string;
    dronesCount: number;
    estimatedArrival: number;  // Timestamp
}

// Payload de disputa
export interface DebrisDisputePayload {
    debrisId: string;
    disputerId: string;
    disputerName: string;
    dronesCount: number;
    escortUnits?: Partial<Record<UnitType, number>>; // Puede enviar escolta militar
}
```

### 7.2 Flujo P2P de Escombros

```
JUGADOR A ataca JUGADOR B via P2P (sistema existente)
    │
    ├── Batalla se resuelve en el atacante (useP2PBattleResolver.ts)
    │   ├── Se envía P2PAttackResult al defensor (sin cambio)
    │   └── NUEVO: Se genera DebrisField y se broadcast a la sala
    │
    ├── TODOS los jugadores en la sala reciben DEBRIS_ANNOUNCE
    │   ├── Ven el campo en su UI (panel de Intel/Escombros)
    │   └── Pueden enviar drones a recolectar
    │
    ├── PRIORIDAD: Los combatientes (A y B) tienen 5 min de ventaja
    │   ├── Solo ellos pueden enviar drones los primeros 5 min
    │   └── Después se abre a todos
    │
    └── DISPUTA: Si dos jugadores envían drones al mismo campo
        ├── El que llega primero recolecta primero
        ├── Si hay escolta militar con los drones → combate previo
        └── Ganador del combate recolecta, perdedor pierde drones
```

### 7.3 Hook de Sincronización de Escombros

```typescript
// hooks/useP2PDebrisSync.ts - NUEVO ARCHIVO

export const useP2PDebrisSync = () => {
    const { broadcastAction, localPlayerId, remotePlayers } = useMultiplayer();
    const { gameState } = useGame();
    
    // Anunciar nuevo campo de escombros a la red P2P
    const announceDebris = useCallback((debris: DebrisField, battleSummary: any) => {
        if (!debris.isP2P) return; // Solo anunciar escombros P2P
        
        broadcastAction({
            type: MultiplayerActionType.DEBRIS_ANNOUNCE,
            payload: { debrisField: debris, battleSummary },
            playerId: localPlayerId || '',
            timestamp: Date.now()
        });
    }, [broadcastAction, localPlayerId]);
    
    // Escuchar anuncios de escombros de otros jugadores
    useEffect(() => {
        const handleDebrisAnnounce = (payload: DebrisAnnouncePayload) => {
            // Añadir campo visible (pero no propio) al estado local
            setGameState(prev => ({
                ...prev,
                visibleDebrisFields: [
                    ...(prev.visibleDebrisFields || []),
                    { ...payload.debrisField, isRemote: true }
                ]
            }));
        };
        
        gameEventBus.on(GameEventType.DEBRIS_ANNOUNCE, handleDebrisAnnounce);
        return () => gameEventBus.off(GameEventType.DEBRIS_ANNOUNCE, handleDebrisAnnounce);
    }, []);
    
    // Reclamar un campo
    const claimDebris = useCallback((debrisId: string, dronesCount: number) => {
        broadcastAction({
            type: MultiplayerActionType.DEBRIS_CLAIM,
            payload: {
                debrisId,
                claimerId: localPlayerId || '',
                claimerName: gameState.playerName,
                dronesCount,
                estimatedArrival: Date.now() + SALVAGE_TRAVEL_TIME_MS
            },
            playerId: localPlayerId || '',
            timestamp: Date.now()
        });
    }, [broadcastAction, localPlayerId, gameState.playerName]);
    
    return { announceDebris, claimDebris };
};
```

### 7.4 Escolta y Combate por Escombros

Mecánica completamente nueva: un jugador puede enviar **drones + escolta militar** a un campo de escombros. Si otro jugador también reclama el mismo campo, se produce un **combate de escolta** antes de la recolección.

```typescript
// Resolución de disputa por escombros
const resolveDebrisDispute = (
    claimer: { units: Partial<Record<UnitType, number>>, drones: number },
    disputer: { units: Partial<Record<UnitType, number>>, drones: number }
): DebrisDisputeResult => {
    
    // Separar drones de unidades de combate
    const claimerCombatUnits = { ...claimer.units };
    delete claimerCombatUnits[UnitType.SALVAGER_DRONE];
    
    const disputerCombatUnits = { ...disputer.units };
    delete disputerCombatUnits[UnitType.SALVAGER_DRONE];
    
    // Si ninguno tiene escolta, se reparten 50/50
    const claimerHasEscort = Object.values(claimerCombatUnits).some(v => (v || 0) > 0);
    const disputerHasEscort = Object.values(disputerCombatUnits).some(v => (v || 0) > 0);
    
    if (!claimerHasEscort && !disputerHasEscort) {
        return { winner: 'SPLIT', splitRatio: 0.5 };
    }
    
    if (claimerHasEscort && !disputerHasEscort) {
        // Los drones del disputer se destruyen
        return { winner: 'CLAIMER', disputerDronesLost: disputer.drones };
    }
    
    if (!claimerHasEscort && disputerHasEscort) {
        return { winner: 'DISPUTER', claimerDronesLost: claimer.drones };
    }
    
    // Ambos tienen escolta → combate real
    const battleResult = simulateCombat(claimerCombatUnits, disputerCombatUnits, 1.0);
    
    // El combate por escombros TAMBIÉN genera escombros (recursivo pero limitado a 1 nivel)
    return {
        winner: battleResult.winner === 'PLAYER' ? 'CLAIMER' : 'DISPUTER',
        battleResult,
        secondaryDebris: generateDebrisFromCombat(battleResult, 'SALVAGE_DISPUTE', ...)
    };
};
```

---

## 8. PERSISTENCIA TOTAL

### 8.1 Estado del Juego Ampliado

```typescript
// types/state.ts - AÑADIR a GameState
export interface GameState {
    // ... campos existentes ...
    
    // NUEVO: Sistema de Escombros
    debrisFields: DebrisField[];                                // Campos locales (generados por el jugador)
    visibleDebrisFields: (DebrisField & { isRemote: boolean })[]; // Campos P2P visibles
    salvageMissions: ActiveMission[];                            // Misiones de salvamento activas
    
    // Estadísticas de salvamento
    lifetimeDebrisStats: {
        totalGenerated: number;       // Valor total de escombros generados
        totalHarvested: number;       // Valor total recolectado
        totalExpired: number;         // Valor total perdido por expiración
        totalDisputed: number;        // Veces que se disputó un campo
        totalDisputeWins: number;     // Victorias en disputas
        fieldsCreated: number;        // Número de campos creados
        fieldsHarvested: number;      // Número de campos recolectados
    };
}
```

### 8.2 Persistencia en localStorage

Los campos de escombros se persisten junto con el GameState existente:

```typescript
// hooks/usePersistence.ts - MODIFICACIONES

// En saveGame (línea ~286): Ya se incluye automáticamente por ser parte de GameState
// En loadGame (línea ~139): Ya se carga automáticamente
// En calculateOfflineProgress (offline.ts): NUEVO manejo

// Procesar escombros expirados durante offline
const processOfflineDebris = (state: GameState, now: number): GameState => {
    const activeDebris: DebrisField[] = [];
    let expiredValue = 0;
    
    for (const debris of (state.debrisFields || [])) {
        if (debris.expiresAt <= now) {
            // Expiró - autoliquidar 10% al banco como "residuo vendido"
            const autoSalvageRate = 0.10;
            const moneyRecovered = (debris.resources[ResourceType.MONEY] || 0) * autoSalvageRate;
            expiredValue += moneyRecovered;
            
            state.lifetimeDebrisStats.totalExpired += debris.totalValue;
        } else {
            activeDebris.push(debris);
        }
    }
    
    return {
        ...state,
        debrisFields: activeDebris,
        bankBalance: state.bankBalance + Math.floor(expiredValue)
    };
};
```

### 8.3 Sincronización P2P de Escombros Persistentes

```typescript
// Cuando un jugador se conecta a la sala global, recibe los escombros activos de otros jugadores
// via PRESENCE_UPDATE extendido

export interface PlayerPresence {
    // ... campos existentes ...
    activeDebrisCount: number;        // Cuántos campos tiene activos
    totalDebrisValue: number;         // Valor total de sus campos (para UI de ranking)
}

// Al reconectar, solicitar campos activos a peers
const requestActiveDebris = () => {
    broadcastAction({
        type: 'REQUEST_DEBRIS_LIST',
        payload: null,
        playerId: localPlayerId || '',
        timestamp: Date.now()
    });
};
```

---

## 9. INTERFAZ DE USUARIO

### 9.1 Nuevo Panel: "Zona de Salvamento" / "Salvage Zone"

Ubicación: Nuevo tab en la navegación inferior, entre Intel y Market.

```
┌─────────────────────────────────────────────────┐
│  SALVAGE ZONE                        [3 Active] │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─ LOCAL FIELDS ─────────────────────────────┐ │
│  │                                             │ │
│  │  [!] War Debris - Wave 3 vs Iron Viper     │ │
│  │      $2.4M | 1.2K Oil | 800 Ammo           │ │
│  │      ⏱ 45min remaining                     │ │
│  │      [Send 5 Drones] [Auto-Harvest]        │ │
│  │                                             │ │
│  │  [*] Raid Debris - Defended vs Rogue Rex    │ │
│  │      $890K | 200 Oil | 150 Ammo             │ │
│  │      ⏱ 12min remaining                     │ │
│  │      [Send 2 Drones]                        │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─ P2P CONTESTED FIELDS ────────────────────┐  │
│  │                                             │ │
│  │  [P2P] Battle: Player_X vs Player_Y        │ │
│  │      $5.1M | 3K Oil | 2K Ammo              │ │
│  │      ⏱ 1h 20min remaining                  │ │
│  │      🔒 Priority window: 3min left          │ │
│  │      [Claim with 8 Drones + Escort]        │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─ ACTIVE SALVAGE MISSIONS ──────────────────┐ │
│  │  🚁 5 Drones → War Debris    ETA: 4:30     │ │
│  │  🚁 2 Drones → Raid Debris   ETA: 6:15     │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  SALVAGER DRONES: 12/12 Available               │
│  Lifetime Harvested: $45.2M total value          │
└─────────────────────────────────────────────────┘
```

### 9.2 Indicadores en WarHUD

Modificar `components/WarHUD.tsx` para mostrar escombros acumulados durante la guerra:

```
┌─ WAR STATUS ───────────────────────────────┐
│  [Oleada 4/8]  Player: 3  |  Enemy: 1     │
│  Loot Pool: $12.5M                         │
│  ── NUEVO ──                               │
│  Debris Generated: $4.8M (harvestable)     │
│  Debris Harvested: $1.2M (recovered)       │
│  Drones Available: 8/12                    │
│  [Quick Harvest All]                        │
└────────────────────────────────────────────┘
```

### 9.3 Notificación de Escombros P2P

Toast notification cuando otro jugador anuncia escombros:

```
┌──────────────────────────────────────────┐
│  ⚡ SALVAGE OPPORTUNITY                   │
│  Battle between Player_X and Player_Y     │
│  generated $3.2M in recoverable debris!   │
│  [View] [Dismiss]                         │
└──────────────────────────────────────────┘
```

---

## 10. MOTOR DE ESCOMBROS — ARCHIVO NUEVO

### 10.1 Estructura del Archivo

```
utils/engine/debris.ts          — Motor principal de escombros
utils/engine/debrisValidation.ts — Validación y sanitización
hooks/useP2PDebrisSync.ts       — Sincronización P2P
components/SalvageZone.tsx      — UI del panel de salvamento
```

### 10.2 API del Motor de Escombros

```typescript
// utils/engine/debris.ts - NUEVO ARCHIVO COMPLETO

import { BattleResult, DebrisField, ResourceType, UnitType } from '../../types';
import { UNIT_DEFS } from '../../data/units';
import {
    DEBRIS_RATIO_ATTACKER,
    DEBRIS_RATIO_DEFENDER,
    DEBRIS_RATIO_ALLY,
    DEBRIS_ELIGIBLE_RESOURCES,
    DEBRIS_EXPIRY_RAID_MS,
    DEBRIS_EXPIRY_WAR_BUFFER_MS,
    DEBRIS_EXPIRY_P2P_MS,
    DEBRIS_EXPIRY_CAMPAIGN_MS,
    DEBRIS_MAX_ACTIVE
} from '../../constants';
import { calculateResourceCost } from './missions';

// ─── Generación de Escombros ──────────────────────────────────────────

export const generateDebrisFromCombat = (
    battleResult: BattleResult,
    origin: DebrisField['origin'],
    battleId: string,
    participants: {
        attackerId: string;
        attackerName: string;
        defenderId: string;
        defenderName: string;
    },
    warId?: string,
    waveNumber?: number
): DebrisField | null => {
    
    const now = Date.now();
    
    // Calcular coste de todas las bajas
    const attackerCasualtyResources = calculateResourceCost(battleResult.totalPlayerCasualties);
    const defenderCasualtyResources = calculateResourceCost(battleResult.totalEnemyCasualties);
    
    // Calcular coste de bajas aliadas (si existen)
    let allyCasualtyResources: Record<ResourceType, number> = {
        [ResourceType.MONEY]: 0, [ResourceType.OIL]: 0, [ResourceType.AMMO]: 0,
        [ResourceType.GOLD]: 0, [ResourceType.DIAMOND]: 0
    };
    if (battleResult.totalAllyCasualties) {
        for (const allyCasualties of Object.values(battleResult.totalAllyCasualties)) {
            const allyRes = calculateResourceCost(allyCasualties);
            for (const res of Object.keys(allyRes) as ResourceType[]) {
                allyCasualtyResources[res] += allyRes[res];
            }
        }
    }
    
    // Aplicar ratio de escombros SOLO a recursos elegibles
    const debrisResources: Partial<Record<ResourceType, number>> = {};
    let totalValue = 0;
    
    for (const res of DEBRIS_ELIGIBLE_RESOURCES) {
        const fromAttacker = Math.floor((attackerCasualtyResources[res] || 0) * DEBRIS_RATIO_ATTACKER);
        const fromDefender = Math.floor((defenderCasualtyResources[res] || 0) * DEBRIS_RATIO_DEFENDER);
        const fromAllies = Math.floor((allyCasualtyResources[res] || 0) * DEBRIS_RATIO_ALLY);
        
        const total = fromAttacker + fromDefender + fromAllies;
        if (total > 0) {
            debrisResources[res] = total;
            totalValue += total;
        }
    }
    
    // No generar campo si el valor es insignificante
    if (totalValue < 1000) return null;
    
    // Calcular expiración según origen
    const expiryMap = {
        'WAR': now + DEBRIS_EXPIRY_WAR_BUFFER_MS + (130 * 60 * 1000), // Fin de guerra + buffer
        'RAID': now + DEBRIS_EXPIRY_RAID_MS,
        'P2P': now + DEBRIS_EXPIRY_P2P_MS,
        'CAMPAIGN': now + DEBRIS_EXPIRY_CAMPAIGN_MS
    };
    
    return {
        id: `debris-${battleId}-${now}`,
        battleId,
        origin,
        resources: debrisResources,
        createdAt: now,
        expiresAt: expiryMap[origin],
        totalValue,
        attackerId: participants.attackerId,
        attackerName: participants.attackerName,
        defenderId: participants.defenderId,
        defenderName: participants.defenderName,
        isPartiallyHarvested: false,
        harvestedBy: [],
        isP2P: origin === 'P2P',
        p2pBroadcasted: false,
        warId,
        waveNumber
    };
};

// ─── Procesamiento de Tick ────────────────────────────────────────────

export const processDebrisTick = (
    debrisFields: DebrisField[],
    now: number
): { active: DebrisField[]; expired: DebrisField[]; autoSalvageValue: number } => {
    const active: DebrisField[] = [];
    const expired: DebrisField[] = [];
    let autoSalvageValue = 0;
    
    for (const debris of debrisFields) {
        if (debris.expiresAt <= now) {
            expired.push(debris);
            // Auto-salvage: 10% del valor en MONEY va al banco
            autoSalvageValue += Math.floor((debris.resources[ResourceType.MONEY] || 0) * 0.10);
        } else {
            active.push(debris);
        }
    }
    
    // Limitar campos activos
    while (active.length > DEBRIS_MAX_ACTIVE) {
        const oldest = active.shift();
        if (oldest) {
            expired.push(oldest);
            autoSalvageValue += Math.floor((oldest.resources[ResourceType.MONEY] || 0) * 0.10);
        }
    }
    
    return { active, expired, autoSalvageValue };
};

// ─── Fusión de Escombros de Guerra ────────────────────────────────────

export const mergeWarDebris = (
    debrisFields: DebrisField[],
    warId: string
): DebrisField | null => {
    const warDebris = debrisFields.filter(d => d.warId === warId);
    
    if (warDebris.length === 0) return null;
    
    const merged: Partial<Record<ResourceType, number>> = {};
    let totalValue = 0;
    
    for (const debris of warDebris) {
        for (const [res, amount] of Object.entries(debris.resources)) {
            merged[res as ResourceType] = (merged[res as ResourceType] || 0) + (amount || 0);
            totalValue += amount || 0;
        }
    }
    
    const now = Date.now();
    const firstDebris = warDebris[0];
    
    return {
        id: `mega-debris-${warId}-${now}`,
        battleId: warId,
        origin: 'WAR',
        resources: merged,
        createdAt: now,
        expiresAt: now + DEBRIS_EXPIRY_WAR_BUFFER_MS,
        totalValue,
        attackerId: firstDebris.attackerId,
        attackerName: firstDebris.attackerName,
        defenderId: firstDebris.defenderId,
        defenderName: firstDebris.defenderName,
        isPartiallyHarvested: false,
        harvestedBy: [],
        isP2P: false,
        p2pBroadcasted: false,
        warId
    };
};

// ─── Harvest (recolectar parcialmente) ────────────────────────────────

export const harvestDebrisField = (
    debris: DebrisField,
    droneCount: number,
    cargoCapacityPerDrone: number
): { harvested: Partial<Record<ResourceType, number>>; remaining: DebrisField } => {
    const totalCapacity = droneCount * cargoCapacityPerDrone;
    const CARGO_RATES: Record<ResourceType, number> = {
        [ResourceType.MONEY]: 1,
        [ResourceType.OIL]: 10,
        [ResourceType.AMMO]: 5,
        [ResourceType.GOLD]: 50,
        [ResourceType.DIAMOND]: 500
    };
    
    const harvested: Partial<Record<ResourceType, number>> = {};
    let used = 0;
    const remaining = { ...debris.resources };
    
    for (const res of DEBRIS_ELIGIBLE_RESOURCES) {
        const available = remaining[res] || 0;
        if (available <= 0) continue;
        
        const rate = CARGO_RATES[res];
        const maxCanTake = Math.floor((totalCapacity - used) / rate);
        const toTake = Math.min(available, maxCanTake);
        
        if (toTake > 0) {
            harvested[res] = toTake;
            remaining[res] = available - toTake;
            used += toTake * rate;
        }
        if (used >= totalCapacity) break;
    }
    
    const newDebris: DebrisField = {
        ...debris,
        resources: remaining,
        isPartiallyHarvested: true,
        totalValue: Object.values(remaining).reduce((a, b) => a + (b || 0), 0)
    };
    
    return { harvested, remaining: newDebris };
};
```

---

## 11. INTEGRACIÓN CON EL GAME LOOP

### 11.1 Modificaciones al Loop Principal

```typescript
// hooks/useGameLoop.ts - AÑADIR al tick principal

// En el tick principal (después de processWarTick):
// 1. Procesar expiración de escombros
const debrisResult = processDebrisTick(gameState.debrisFields || [], now);

if (debrisResult.expired.length > 0) {
    // Auto-salvage de campos expirados
    newState.bankBalance += debrisResult.autoSalvageValue;
    newState.debrisFields = debrisResult.active;
    
    // Log
    if (debrisResult.autoSalvageValue > 0) {
        logs.push({
            id: `debris-autosalvage-${now}`,
            messageKey: 'log_debris_expired',
            type: 'economy',
            timestamp: now,
            params: {
                count: debrisResult.expired.length,
                autoSalvageValue: debrisResult.autoSalvageValue
            }
        });
    }
}

// 2. Resolver misiones de salvamento completadas
for (const mission of newState.activeMissions.filter(m => m.type === 'SALVAGE' && m.endTime <= now)) {
    const debris = newState.debrisFields.find(d => d.id === mission.debrisFieldId);
    if (debris) {
        const result = resolveSalvageMission(mission, debris, newState.resources, newState.maxResources);
        if (result.success) {
            // Añadir recursos recuperados
            for (const [res, amount] of Object.entries(result.resources)) {
                newState.resources[res as ResourceType] = Math.min(
                    newState.maxResources[res as ResourceType],
                    newState.resources[res as ResourceType] + (amount || 0)
                );
            }
            // Actualizar campo de escombros
            const updatedDebrisIndex = newState.debrisFields.findIndex(d => d.id === debris.id);
            if (updatedDebrisIndex >= 0) {
                newState.debrisFields[updatedDebrisIndex] = result.remainingDebris;
            }
        }
    }
}
```

---

## 12. PLAN DE IMPLEMENTACIÓN — FASES

### Fase 1: Core Engine (Estimado: 4-6 horas)

| Tarea | Archivos | Prioridad |
|---|---|---|
| Crear `DebrisField` interface en `types/state.ts` | `types/state.ts` | ALTA |
| Añadir constantes de escombros | `constants.ts` | ALTA |
| Crear `utils/engine/debris.ts` con generación + tick + harvest | NUEVO | ALTA |
| Crear `utils/engine/debrisValidation.ts` | NUEVO | ALTA |
| Añadir `debrisFields` al `GameState` | `types/state.ts` | ALTA |
| Añadir `debrisFields` al `INITIAL_GAME_STATE` | `data/initialState.ts` | ALTA |
| Migración de save (versión 7) | `utils/engine/migration.ts` | ALTA |

### Fase 2: Integración con Combate (Estimado: 3-4 horas)

| Tarea | Archivos | Prioridad |
|---|---|---|
| Generar escombros post-combate en `war.ts` | `utils/engine/war.ts` | ALTA |
| Generar escombros en raids de bots | `utils/engine/war.ts` | ALTA |
| Generar escombros en ataques del jugador | `utils/engine/missions.ts` | ALTA |
| Generar escombros en campañas | `utils/engine/missions.ts` | MEDIA |
| Fusionar escombros de guerra al final | `utils/engine/war.ts` | ALTA |
| Procesar escombros en game loop | `hooks/useGameLoop.ts` | ALTA |
| Procesar escombros offline | `utils/engine/offline.ts` | MEDIA |

### Fase 3: Salvager Drone (Estimado: 2-3 horas)

| Tarea | Archivos | Prioridad |
|---|---|---|
| Añadir `SALVAGER_DRONE` a enums | `types/enums.ts` | ALTA |
| Definir unidad en `data/units.ts` | `data/units.ts` | ALTA |
| Añadir tech `UNLOCK_SALVAGER_DRONE` | `data/techs.ts`, `types/enums.ts` | ALTA |
| Misión tipo `SALVAGE` en `missions.ts` | `utils/engine/missions.ts` | ALTA |
| Resolver misiones de salvamento en loop | `hooks/useGameLoop.ts` | ALTA |
| Excluir drone del combate normal (ataque=1) | `utils/engine/combat.ts` | MEDIA |

### Fase 4: UI (Estimado: 4-5 horas)

| Tarea | Archivos | Prioridad |
|---|---|---|
| Crear `SalvageZone.tsx` panel completo | NUEVO | ALTA |
| Integrar tab en navegación | `components/layout/GameLayout.tsx` | ALTA |
| Añadir indicador de escombros al `WarHUD.tsx` | `components/WarHUD.tsx` | MEDIA |
| Toast de escombros generados | `components/` | MEDIA |
| Traducciones i18n (en + es) | `i18n/` | MEDIA |
| Añadir iconos de escombros y drone | `components/Icons.tsx` | BAJA |

### Fase 5: P2P via Trystero (Estimado: 4-5 horas)

| Tarea | Archivos | Prioridad |
|---|---|---|
| Nuevos tipos `DEBRIS_*` en multiplayer | `types/multiplayer.ts` | ALTA |
| Nuevos eventos en `types/events.ts` | `types/events.ts` | ALTA |
| Crear `useP2PDebrisSync.ts` | NUEVO | ALTA |
| Broadcast de escombros P2P | `hooks/useP2PBattleResolver.ts` | ALTA |
| Recepción + visualización de escombros remotos | `hooks/useP2PGameSync.ts` | ALTA |
| Disputa de escombros P2P | `utils/engine/debris.ts` | MEDIA |
| Escolta militar en disputas | `utils/engine/debris.ts` | MEDIA |
| Verificación de integridad anti-cheat | `hooks/useP2PGameSync.ts` | ALTA |

### Fase 6: Testing (Estimado: 2-3 horas)

| Test | Archivo | Cobertura |
|---|---|---|
| Generación de escombros post-combate | `tests/debris-generation.test.ts` | Core |
| Expiración y auto-salvage | `tests/debris-expiry.test.ts` | Core |
| Misión de salvamento | `tests/salvage-mission.test.ts` | Core |
| Fusión de escombros de guerra | `tests/war-debris-merge.test.ts` | Core |
| Disputa P2P | `tests/debris-dispute.test.ts` | P2P |
| Persistencia y migración | `tests/debris-persistence.test.ts` | Persistencia |
| Capacidad de carga de drones | `tests/salvager-drone.test.ts` | Unidad |
| Integración offline | `tests/debris-offline.test.ts` | Offline |

---

## 13. BALANCEO ECONÓMICO

### 13.1 Impacto en la Economía

| Escenario | Sin Escombros (actual) | Con Escombros (nuevo) |
|---|---|---|
| Batalla con 100 TITAN_MBT perdidos | Pérdida total: $25M + 50K Oil + 150K Ammo | Recuperable: $7.5M + 15K Oil + 45K Ammo (30%) |
| Guerra completa (8 oleadas) | Todo va al Loot Pool (50%) | Loot Pool (50%) + Escombros (~30% adicional) |
| Raid defensivo exitoso | Solo conservas tus unidades | Conservas unidades + escombros del enemigo muerto |
| P2P batalla masiva | Ganador lleva loot fijo | Ganador lleva loot + ambos generan escombros disputables |

### 13.2 Equilibrio de Riesgo

```
ATACANTE:
  Gana → Obtiene loot + puede recolectar escombros del defensor
  Pierde → Pierde unidades, pero el defensor puede recolectar sus escombros
  
DEFENSOR:
  Gana → Conserva base + recolecta escombros del atacante
  Pierde → Pierde edificios + pero puede enviar drones a recoger sus propios escombros

TERCERO (P2P):
  Ve batalla → Puede disputar escombros con drones (riesgo: si hay escolta, combate)
  No actúa → Pierde oportunidad
```

### 13.3 Anti-Exploit

| Exploit Potencial | Contramedida |
|---|---|
| Farming de escombros con batallas falsas P2P | Mínimo de unidades para generar escombros (totalValue > 1000) |
| Infinitos campos activos | Límite de 20 campos simultáneos (`DEBRIS_MAX_ACTIVE`) |
| Manipulación de timestamps P2P | Verificación de integridad en `useP2PGameSync.ts` |
| Drones sin riesgo | Los drones SIN escolta pueden ser destruidos por disputantes |
| Acumulación infinita de guerra | Fusión al final + expiración post-guerra |

---

## 14. RESUMEN DE ARCHIVOS A CREAR/MODIFICAR

### Archivos NUEVOS (5)

| Archivo | Propósito |
|---|---|
| `utils/engine/debris.ts` | Motor principal de escombros |
| `utils/engine/debrisValidation.ts` | Validación y sanitización |
| `hooks/useP2PDebrisSync.ts` | Sincronización P2P de escombros |
| `components/SalvageZone.tsx` | Panel UI de salvamento |
| `tests/debris-generation.test.ts` | Suite de tests |

### Archivos a MODIFICAR (15)

| Archivo | Cambios |
|---|---|
| `types/state.ts` | +`DebrisField`, +campos en `GameState`, +campos en `WarState` |
| `types/enums.ts` | +`SALVAGER_DRONE`, +`UNLOCK_SALVAGER_DRONE` |
| `types/multiplayer.ts` | +tipos `DEBRIS_*` |
| `types/events.ts` | +eventos de escombros |
| `constants.ts` | +constantes de escombros y salvamento |
| `data/units.ts` | +definición `SALVAGER_DRONE` |
| `data/techs.ts` | +definición `UNLOCK_SALVAGER_DRONE` |
| `data/initialState.ts` | +campos iniciales de escombros |
| `utils/engine/war.ts` | +generación de escombros post-combate, +fusión post-guerra |
| `utils/engine/missions.ts` | +generación de escombros en raids, +misión SALVAGE |
| `utils/engine/offline.ts` | +procesamiento offline de escombros |
| `utils/engine/migration.ts` | +migración save v6→v7 |
| `hooks/useGameLoop.ts` | +tick de escombros, +resolución de salvamento |
| `hooks/useP2PBattleResolver.ts` | +broadcast de escombros post-batalla P2P |
| `hooks/useP2PGameSync.ts` | +recepción de escombros remotos |

---

## 15. GLOSARIO TÉCNICO

| Término Iron Dune | Equivalente OGame | Descripción |
|---|---|---|
| **Debris Field** / Campo de Escombros | Debris Field | Recursos recuperables generados tras combate |
| **Salvager Drone** | Recycler | Unidad logística para recolectar escombros |
| **Salvage Zone** | N/A | Panel UI donde se ven y gestionan escombros |
| **Cargo Capacity** | Cargo Capacity | Capacidad de carga de cada dron |
| **Priority Window** | N/A (nuevo) | 5 min de ventaja para combatientes antes de abrir a terceros |
| **Mega Debris** | N/A (nuevo) | Fusión de todos los escombros de una guerra |
| **Auto-Salvage** | N/A (nuevo) | 10% recuperado automáticamente al expirar |
| **Escort Dispute** | N/A (nuevo) | Combate entre escoltas que protegen drones en disputa |
| **DEBRIS_RATIO** | Debris % | Porcentaje del coste que se convierte en escombros (30%) |

---

> **Nota Final:** Este sistema se integra de forma modular — cada fase puede implementarse y probarse independientemente. La Fase 1 (Core Engine) y Fase 2 (Integración Combate) son suficientes para tener un sistema funcional contra bots. Las fases 4 y 5 (UI + P2P) añaden la capa social competitiva.
