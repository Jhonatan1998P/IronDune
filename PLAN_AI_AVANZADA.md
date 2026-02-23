# 🎮 PLAN: Sistema de IA Avanzada para Iron Dune: Operations

## Resumen Ejecutivo

Transformar los 199 bots estáticos en agentes autónomos con economía simulada, sistema de alianzas dinámicas, diplomacia completa, y capacidad de toma de decisiones estratégicas. El jugador podrá participar activamente en este ecosistema político-militar.

### Objetivos Principales

- **Autonomía**: Bots que toman decisiones propias basadas en personalidad y contexto
- **Alianzas Dinámicas**: Sistema de facciones con formación, traiciones y guerras
- **Diplomacia Completa**: Pactos, comercio, amenazas, tributos entre bots y jugador
- **Ataques Coordinados**: Operaciones militares conjuntas entre aliados
- **Variedad de Gameplay**: Múltiples formas de interactuar con el mundo

---

## FASE 1: Sistema de Estado Persistente de Bots

### 1.1 Nuevo Modelo de Bot

**Archivo: `types/bot.ts`**

```typescript
export interface BotState {
  // ══════════════════════════════════════════
  // IDENTIDAD (migrado del sistema existente)
  // ══════════════════════════════════════════
  id: string;
  name: string;
  avatarId: number;
  country: string;
  personality: BotPersonality;
  
  // ══════════════════════════════════════════
  // ECONOMÍA SIMULADA
  // ══════════════════════════════════════════
  resources: Record<ResourceType, number>;
  buildings: Record<BuildingType, number>;
  techs: TechType[];
  productionRate: Record<ResourceType, number>;  // Calculado de edificios
  
  // ══════════════════════════════════════════
  // MILITAR PERSISTENTE
  // ══════════════════════════════════════════
  army: Record<UnitType, number>;
  armyScore: number;
  militaryCapacity: number;
  recruitmentQueue: RecruitmentOrder[];
  
  // ══════════════════════════════════════════
  // ESTADO POLÍTICO
  // ══════════════════════════════════════════
  factionId: string | null;
  factionRole: FactionRole;
  reputation: Record<string, number>;  // Reputación con cada facción
  playerReputation: number;            // Reputación con el jugador (-100 a 100)
  
  // ══════════════════════════════════════════
  // MEMORIA Y COMPORTAMIENTO
  // ══════════════════════════════════════════
  memory: BotMemory;
  currentGoal: BotGoal;
  goalProgress: number;
  lastDecisionTime: number;
  lastUpdateTime: number;
  
  // ══════════════════════════════════════════
  // RANKING (migrado)
  // ══════════════════════════════════════════
  stats: Record<RankingCategory, number>;
  ambition: number;
}

export interface BotMemory {
  // Historial de interacciones
  recentAttackers: AttackMemory[];     // Quién lo atacó recientemente
  recentAllies: AllyMemory[];          // Quiénes lo ayudaron
  betrayals: BetrayalMemory[];         // Traidores (nunca se olvida)
  
  // Historial con el jugador
  playerActions: PlayerActionMemory[];
  playerThreatLevel: number;           // 0-100
  
  // Historial de guerras
  warsParticipated: WarMemory[];
  
  // Propuestas diplomáticas pendientes
  pendingProposals: string[];          // IDs de propuestas
}

export interface AttackMemory {
  attackerId: string;
  timestamp: number;
  damageReceived: number;
  wasProvoked: boolean;
}

export interface AllyMemory {
  allyId: string;
  helpType: 'defense' | 'attack' | 'resources';
  timestamp: number;
  value: number;  // Cuánto ayudó
}

export interface BetrayalMemory {
  traitorId: string;
  context: string;
  timestamp: number;
  severity: number;  // 1-10
}

export interface PlayerActionMemory {
  action: 'attack' | 'help' | 'trade' | 'betray' | 'alliance';
  timestamp: number;
  impact: number;  // Positivo o negativo
}

export interface WarMemory {
  warId: string;
  side: 'attacker' | 'defender';
  outcome: 'victory' | 'defeat' | 'draw';
  contribution: number;
}

export enum BotGoal {
  EXPAND_ECONOMY = 'EXPAND_ECONOMY',
  BUILD_ARMY = 'BUILD_ARMY',
  SEEK_ALLIANCE = 'SEEK_ALLIANCE',
  REVENGE = 'REVENGE',
  DEFEND_ALLY = 'DEFEND_ALLY',
  BETRAY_FACTION = 'BETRAY_FACTION',
  DOMINATE_RANKING = 'DOMINATE_RANKING',
  SURVIVE = 'SURVIVE',
  RECRUIT_MEMBERS = 'RECRUIT_MEMBERS',
  CONSOLIDATE_POWER = 'CONSOLIDATE_POWER'
}

export enum FactionRole {
  NONE = 'NONE',
  MEMBER = 'MEMBER',
  OFFICER = 'OFFICER',
  LEADER = 'LEADER'
}
```

### 1.2 Simulación Económica Ligera

En lugar de simular tick-a-tick (muy costoso para 199 bots), usamos **cálculo diferido**:

**Archivo: `utils/engine/botSimulation.ts`**

```typescript
/**
 * Sistema de Simulación Económica para Bots
 * 
 * Usa cálculo diferido: en lugar de actualizar cada tick,
 * calculamos el progreso acumulado cuando es necesario.
 * 
 * Frecuencia de actualización: cada 10 minutos de tiempo de juego
 */

// Constantes de simulación
export const BOT_UPDATE_INTERVAL = 10 * 60 * 1000;  // 10 minutos
export const BOT_DECISION_INTERVAL = 5 * 60 * 1000; // 5 minutos

/**
 * Actualiza la economía de un bot basado en el tiempo transcurrido
 */
export function updateBotEconomy(bot: BotState, currentTime: number): BotState {
  const elapsedTime = currentTime - bot.lastUpdateTime;
  if (elapsedTime < BOT_UPDATE_INTERVAL) return bot;
  
  const elapsedMinutes = elapsedTime / 60000;
  
  // 1. Generar recursos basado en edificios
  const newResources = calculateResourceGeneration(bot, elapsedMinutes);
  
  // 2. Consumir recursos por mantenimiento de ejército
  const afterUpkeep = applyArmyUpkeep(newResources, bot.army, elapsedMinutes);
  
  // 3. Procesar cola de reclutamiento
  const { army, resources } = processRecruitmentQueue(
    bot.recruitmentQueue, 
    bot.army, 
    afterUpkeep,
    elapsedTime
  );
  
  // 4. IA decide siguiente construcción/reclutamiento
  const decisions = botDecisionEngine.makeEconomicDecisions(bot, resources);
  
  return {
    ...bot,
    resources,
    army,
    lastUpdateTime: currentTime,
    ...decisions
  };
}

/**
 * Calcula producción de recursos basado en edificios del bot
 */
function calculateResourceGeneration(
  bot: BotState, 
  minutes: number
): Record<ResourceType, number> {
  const production = { ...bot.resources };
  
  // Producción base por edificio (simplificada)
  const BUILDING_PRODUCTION = {
    [BuildingType.FACTORY]: { [ResourceType.MONEY]: 10 },
    [BuildingType.OIL_RIG]: { [ResourceType.OIL]: 5 },
    [BuildingType.MUNITIONS_FACTORY]: { [ResourceType.AMMO]: 5 },
    [BuildingType.GOLD_MINE]: { [ResourceType.GOLD]: 1 },
    [BuildingType.BARRACKS]: { [ResourceType.MONEY]: -2 },       // Consume dinero (mantenimiento)
    [BuildingType.RESEARCH_LAB]: { [ResourceType.MONEY]: -3 },   // Consume dinero
    [BuildingType.POWER_PLANT]: { [ResourceType.MONEY]: 5, [ResourceType.OIL]: -2 }, // Genera dinero, consume petróleo
    [BuildingType.WAREHOUSE]: {},                                  // No produce, aumenta capacidad
    [BuildingType.DEFENSE_TOWER]: { [ResourceType.MONEY]: -1 },  // Consume dinero (mantenimiento)
    [BuildingType.TRADE_POST]: { [ResourceType.MONEY]: 8, [ResourceType.GOLD]: 0.5 } // Genera dinero y oro
  };
  
  for (const [building, count] of Object.entries(bot.buildings)) {
    const rates = BUILDING_PRODUCTION[building as BuildingType];
    if (rates) {
      for (const [resource, rate] of Object.entries(rates)) {
        production[resource as ResourceType] += rate * count * minutes;
      }
    }
  }
  
  return production;
}

/**
 * Aplica el coste de mantenimiento del ejército
 * Cada unidad consume recursos por minuto
 */
function applyArmyUpkeep(
  resources: Record<ResourceType, number>,
  army: Record<UnitType, number>,
  minutes: number
): Record<ResourceType, number> {
  const result = { ...resources };
  
  // Coste de mantenimiento por tipo de unidad (por minuto)
  const UPKEEP_COSTS: Record<string, Partial<Record<ResourceType, number>>> = {
    [UnitType.INFANTRY]: { [ResourceType.MONEY]: 0.5, [ResourceType.AMMO]: 0.1 },
    [UnitType.TANK]: { [ResourceType.MONEY]: 2, [ResourceType.OIL]: 0.5, [ResourceType.AMMO]: 0.3 },
    [UnitType.ARTILLERY]: { [ResourceType.MONEY]: 1.5, [ResourceType.AMMO]: 0.5 },
    [UnitType.HELICOPTER]: { [ResourceType.MONEY]: 3, [ResourceType.OIL]: 1, [ResourceType.AMMO]: 0.2 },
    [UnitType.NAVY]: { [ResourceType.MONEY]: 4, [ResourceType.OIL]: 1.5 },
    [UnitType.SPECIAL_OPS]: { [ResourceType.MONEY]: 5, [ResourceType.AMMO]: 0.3 }
  };
  
  for (const [unitType, count] of Object.entries(army)) {
    const costs = UPKEEP_COSTS[unitType];
    if (!costs || count <= 0) continue;
    
    for (const [resource, costPerUnit] of Object.entries(costs)) {
      const totalCost = (costPerUnit as number) * count * minutes;
      result[resource as ResourceType] = Math.max(0, (result[resource as ResourceType] || 0) - totalCost);
    }
  }
  
  return result;
}

/**
 * Procesa la cola de reclutamiento del bot
 * Las unidades se producen con el tiempo y consumen recursos
 */
function processRecruitmentQueue(
  queue: RecruitmentOrder[],
  currentArmy: Record<UnitType, number>,
  resources: Record<ResourceType, number>,
  elapsedTime: number
): { army: Record<UnitType, number>; resources: Record<ResourceType, number>; remainingQueue: RecruitmentOrder[] } {
  const updatedArmy = { ...currentArmy };
  const updatedResources = { ...resources };
  const remainingQueue: RecruitmentOrder[] = [];
  
  // Coste de reclutamiento por tipo de unidad
  const RECRUITMENT_COSTS: Record<string, { 
    resources: Partial<Record<ResourceType, number>>; 
    timeMs: number  // Tiempo de producción en milisegundos
  }> = {
    [UnitType.INFANTRY]: { 
      resources: { [ResourceType.MONEY]: 100, [ResourceType.AMMO]: 20 },
      timeMs: 2 * 60 * 1000  // 2 minutos
    },
    [UnitType.TANK]: { 
      resources: { [ResourceType.MONEY]: 500, [ResourceType.OIL]: 100, [ResourceType.AMMO]: 50 },
      timeMs: 10 * 60 * 1000  // 10 minutos
    },
    [UnitType.ARTILLERY]: { 
      resources: { [ResourceType.MONEY]: 300, [ResourceType.AMMO]: 100 },
      timeMs: 8 * 60 * 1000   // 8 minutos
    },
    [UnitType.HELICOPTER]: { 
      resources: { [ResourceType.MONEY]: 800, [ResourceType.OIL]: 200 },
      timeMs: 15 * 60 * 1000  // 15 minutos
    },
    [UnitType.NAVY]: { 
      resources: { [ResourceType.MONEY]: 1000, [ResourceType.OIL]: 300 },
      timeMs: 20 * 60 * 1000  // 20 minutos
    },
    [UnitType.SPECIAL_OPS]: { 
      resources: { [ResourceType.MONEY]: 600, [ResourceType.AMMO]: 80, [ResourceType.GOLD]: 10 },
      timeMs: 12 * 60 * 1000  // 12 minutos
    }
  };
  
  for (const order of queue) {
    // ¿Ha pasado suficiente tiempo para completar esta orden?
    const recruitInfo = RECRUITMENT_COSTS[order.unitType];
    if (!recruitInfo) {
      remainingQueue.push(order);
      continue;
    }
    
    const timeRemaining = order.completionTime - (Date.now() - elapsedTime);
    
    if (timeRemaining <= 0) {
      // Orden completada: verificar que aún hay recursos
      let canAfford = true;
      for (const [res, cost] of Object.entries(recruitInfo.resources)) {
        if ((updatedResources[res as ResourceType] || 0) < (cost as number) * order.quantity) {
          canAfford = false;
          break;
        }
      }
      
      if (canAfford) {
        // Deducir recursos y añadir unidades
        for (const [res, cost] of Object.entries(recruitInfo.resources)) {
          updatedResources[res as ResourceType] -= (cost as number) * order.quantity;
        }
        updatedArmy[order.unitType] = (updatedArmy[order.unitType] || 0) + order.quantity;
      }
      // Si no puede pagar, la orden se pierde
    } else {
      // Orden aún en progreso
      remainingQueue.push(order);
    }
  }
  
  return { army: updatedArmy, resources: updatedResources, remainingQueue };
}

export interface RecruitmentOrder {
  unitType: UnitType;
  quantity: number;
  startTime: number;
  completionTime: number;
}

/**
 * Decisiones económicas automáticas del bot
 * Determina qué construir o reclutar con los recursos disponibles
 */
const botDecisionEngine = {
  makeEconomicDecisions(
    bot: BotState, 
    resources: Record<ResourceType, number>
  ): Partial<BotState> {
    const updates: Partial<BotState> = {};
    const newQueue: RecruitmentOrder[] = [...bot.recruitmentQueue];
    
    // No tomar decisiones si ya hay muchas órdenes en cola
    if (newQueue.length >= 3) return updates;
    
    const totalMoney = resources[ResourceType.MONEY] || 0;
    
    // Decisión basada en personalidad
    switch (bot.personality) {
      case BotPersonality.WARLORD:
        // Priorizar ejército
        if (totalMoney > 500) {
          newQueue.push({
            unitType: UnitType.TANK,
            quantity: Math.min(5, Math.floor(totalMoney / 500)),
            startTime: Date.now(),
            completionTime: Date.now() + 10 * 60 * 1000
          });
        }
        break;
      
      case BotPersonality.TURTLE:
        // Priorizar defensas y economía
        if (totalMoney > 300) {
          newQueue.push({
            unitType: UnitType.ARTILLERY,
            quantity: Math.min(3, Math.floor(totalMoney / 300)),
            startTime: Date.now(),
            completionTime: Date.now() + 8 * 60 * 1000
          });
        }
        break;
      
      case BotPersonality.TYCOON:
        // Priorizar edificios económicos (simulado como no reclutar)
        // Los tycoons acumulan recursos
        break;
      
      case BotPersonality.ROGUE:
        // Reclutar unidades rápidas
        if (totalMoney > 100) {
          newQueue.push({
            unitType: UnitType.INFANTRY,
            quantity: Math.min(20, Math.floor(totalMoney / 100)),
            startTime: Date.now(),
            completionTime: Date.now() + 2 * 60 * 1000
          });
        }
        break;
    }
    
    if (newQueue.length !== bot.recruitmentQueue.length) {
      updates.recruitmentQueue = newQueue;
    }
    
    return updates;
  }
};
```

### 1.3 Inicialización de Estado de Bots

**Archivo: `utils/engine/botInitialization.ts`**

```typescript
/**
 * Genera el estado inicial de un bot basado en su posición en el ranking
 */
export function initializeBotState(
  staticBot: StaticBot, 
  rankPosition: number
): BotState {
  // Escalar recursos/edificios/ejército basado en ranking
  const powerLevel = calculatePowerLevel(rankPosition);
  
  return {
    // Migrar datos existentes
    id: staticBot.id,
    name: staticBot.name,
    avatarId: staticBot.avatarId,
    country: staticBot.country,
    personality: staticBot.personality,
    stats: staticBot.stats,
    ambition: staticBot.ambition,
    
    // Generar economía inicial
    resources: generateInitialResources(powerLevel),
    buildings: generateInitialBuildings(powerLevel),
    techs: generateInitialTechs(powerLevel),
    productionRate: {}, // Se calcula después
    
    // Generar ejército inicial
    army: generateInitialArmy(powerLevel, staticBot.personality),
    armyScore: 0, // Se calcula después
    militaryCapacity: calculateMilitaryCapacity(powerLevel),
    recruitmentQueue: [],
    
    // Estado político inicial
    factionId: null,
    factionRole: FactionRole.NONE,
    reputation: {},
    playerReputation: 0,
    
    // Memoria vacía
    memory: {
      recentAttackers: [],
      recentAllies: [],
      betrayals: [],
      playerActions: [],
      playerThreatLevel: 0,
      warsParticipated: [],
      pendingProposals: []
    },
    
    // Objetivo inicial basado en personalidad
    currentGoal: getInitialGoal(staticBot.personality),
    goalProgress: 0,
    lastDecisionTime: Date.now(),
    lastUpdateTime: Date.now()
  };
}

function calculatePowerLevel(rankPosition: number): number {
  // Rank 1 = power 100, Rank 200 = power 1
  return Math.max(1, 100 - (rankPosition * 0.5));
}

function getInitialGoal(personality: BotPersonality): BotGoal {
  switch (personality) {
    case BotPersonality.WARLORD:
      return BotGoal.BUILD_ARMY;
    case BotPersonality.TURTLE:
      return BotGoal.EXPAND_ECONOMY;
    case BotPersonality.TYCOON:
      return BotGoal.EXPAND_ECONOMY;
    case BotPersonality.ROGUE:
      return BotGoal.SEEK_ALLIANCE;
    default:
      return BotGoal.EXPAND_ECONOMY;
  }
}
```

### 1.4 Archivos a Crear/Modificar - Fase 1

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `types/bot.ts` | **CREAR** | Interfaces completas de estado de bot |
| `utils/engine/botSimulation.ts` | **CREAR** | Simulación económica diferida |
| `utils/engine/botInitialization.ts` | **CREAR** | Inicialización de bots |
| `utils/engine/rankings.ts` | **MODIFICAR** | Usar nuevo BotState |
| `utils/engine/loop.ts` | **MODIFICAR** | Añadir tick de simulación de bots |
| `types/state.ts` | **MODIFICAR** | Añadir `botStates: Record<string, BotState>` |

---

## FASE 2: Sistema de Facciones y Alianzas

### 2.1 Estructura de Facciones

**Archivo: `types/faction.ts`**

```typescript
export interface Faction {
  // ══════════════════════════════════════════
  // IDENTIDAD
  // ══════════════════════════════════════════
  id: string;
  name: string;
  tag: string;              // Abreviatura (3-4 chars)
  motto: string;
  color: string;            // Para UI
  iconId: number;
  
  // ══════════════════════════════════════════
  // MEMBRESÍA
  // ══════════════════════════════════════════
  leaderId: string;         // Bot o 'player'
  officerIds: string[];     // Máximo 3
  memberIds: string[];      // Miembros regulares
  pendingInvites: string[]; // Invitaciones pendientes
  
  // ══════════════════════════════════════════
  // CARACTERÍSTICAS
  // ══════════════════════════════════════════
  ideology: FactionIdeology;
  founded: number;          // Timestamp
  
  // ══════════════════════════════════════════
  // RECURSOS COMPARTIDOS
  // ══════════════════════════════════════════
  treasury: Partial<Record<ResourceType, number>>;
  contributionHistory: Contribution[];
  
  // ══════════════════════════════════════════
  // RELACIONES EXTERNAS
  // ══════════════════════════════════════════
  allies: string[];         // IDs de facciones aliadas
  enemies: string[];        // IDs de facciones enemigas
  neutrals: string[];       // Pactos de no agresión
  activeWars: FactionWar[];
  
  // ══════════════════════════════════════════
  // MÉTRICAS
  // ══════════════════════════════════════════
  power: number;            // Suma del poder de miembros
  territory: number;        // Influencia en ranking
  stability: number;        // 0-100, baja = riesgo de fragmentación
  reputation: number;       // Reputación global de la facción
  
  // ══════════════════════════════════════════
  // HISTORIAL
  // ══════════════════════════════════════════
  history: FactionEvent[];
}

export enum FactionIdeology {
  MILITARIST = 'MILITARIST',       // Prioriza conquista militar
  MERCANTILE = 'MERCANTILE',       // Prioriza comercio y economía
  EXPANSIONIST = 'EXPANSIONIST',   // Recluta agresivamente
  ISOLATIONIST = 'ISOLATIONIST',   // Pocos miembros pero muy leales
  OPPORTUNIST = 'OPPORTUNIST'      // Cambia según conveniencia
}

export interface FactionWar {
  id: string;
  enemyFactionId: string;
  startTime: number;
  reason: WarReason;
  battles: WarBattle[];
  currentScore: { us: number; them: number };
  status: 'active' | 'won' | 'lost' | 'draw' | 'ceasefire';
}

export enum WarReason {
  TERRITORIAL = 'TERRITORIAL',
  REVENGE = 'REVENGE',
  BETRAYAL = 'BETRAYAL',
  IDEOLOGY = 'IDEOLOGY',
  OPPORTUNISTIC = 'OPPORTUNISTIC',
  DEFENSE_OF_ALLY = 'DEFENSE_OF_ALLY'
}

export interface WarBattle {
  timestamp: number;
  attackerId: string;
  defenderId: string;
  winner: string;
  casualties: { attacker: number; defender: number };
}

export interface Contribution {
  memberId: string;
  resource: ResourceType;
  amount: number;
  timestamp: number;
}

export interface FactionEvent {
  type: FactionEventType;
  timestamp: number;
  actorId: string;
  details: string;
}

export enum FactionEventType {
  FOUNDED = 'FOUNDED',
  MEMBER_JOINED = 'MEMBER_JOINED',
  MEMBER_LEFT = 'MEMBER_LEFT',
  MEMBER_KICKED = 'MEMBER_KICKED',
  OFFICER_PROMOTED = 'OFFICER_PROMOTED',
  LEADER_CHANGED = 'LEADER_CHANGED',
  WAR_DECLARED = 'WAR_DECLARED',
  WAR_WON = 'WAR_WON',
  WAR_LOST = 'WAR_LOST',
  ALLIANCE_FORMED = 'ALLIANCE_FORMED',
  ALLIANCE_BROKEN = 'ALLIANCE_BROKEN',
  BETRAYAL = 'BETRAYAL'
}

// Configuración de límites
export const FACTION_LIMITS = {
  MIN_MEMBERS: 2,
  MAX_MEMBERS: 15,
  MAX_OFFICERS: 3,
  MAX_ALLIES: 2,
  MAX_ACTIVE_FACTIONS: 8,  // Para mantener el drama
  STABILITY_DECAY_RATE: 0.1, // Por hora sin actividad
  WAR_DURATION_MIN: 2 * 60 * 60 * 1000,  // 2 horas mínimo
  WAR_DURATION_MAX: 24 * 60 * 60 * 1000  // 24 horas máximo
};
```

### 2.2 Facciones Iniciales

**Archivo: `data/factions.ts`**

```typescript
/**
 * Plantillas de facciones iniciales
 * Se poblarán con bots al iniciar el juego
 */
export const FACTION_TEMPLATES: Partial<Faction>[] = [
  {
    name: "Iron Legion",
    tag: "IRON",
    motto: "Strength Through Unity",
    color: "#8B0000",
    iconId: 1,
    ideology: FactionIdeology.MILITARIST
  },
  {
    name: "Golden Alliance",
    tag: "GOLD",
    motto: "Prosperity For All",
    color: "#FFD700",
    iconId: 2,
    ideology: FactionIdeology.MERCANTILE
  },
  {
    name: "Shadow Covenant",
    tag: "SHDW",
    motto: "From Darkness, Power",
    color: "#4B0082",
    iconId: 3,
    ideology: FactionIdeology.OPPORTUNIST
  },
  {
    name: "Steel Fortress",
    tag: "STFL",
    motto: "None Shall Pass",
    color: "#708090",
    iconId: 4,
    ideology: FactionIdeology.ISOLATIONIST
  },
  {
    name: "Rising Tide",
    tag: "TIDE",
    motto: "Ever Expanding",
    color: "#006994",
    iconId: 5,
    ideology: FactionIdeology.EXPANSIONIST
  }
];

/**
 * Nombres adicionales para facciones que se formen dinámicamente
 */
export const DYNAMIC_FACTION_NAMES = [
  "Northern Coalition",
  "Desert Hawks",
  "Crimson Guard",
  "Phantom Order",
  "Thunder Corps",
  "Vanguard Initiative",
  "Black Sun Syndicate",
  "Azure Command"
];
```

### 2.3 Lógica de Facciones

**Archivo: `utils/engine/factions.ts`**

```typescript
/**
 * Motor de gestión de facciones
 */

// ══════════════════════════════════════════
// FORMACIÓN DE FACCIONES
// ══════════════════════════════════════════

/**
 * Determina si un bot debería intentar formar/unirse a una facción
 */
export function shouldSeekFaction(bot: BotState, factions: Faction[]): boolean {
  // Ya está en una facción
  if (bot.factionId) return false;
  
  // Personalidades y su tendencia a buscar alianzas
  const FACTION_TENDENCY = {
    [BotPersonality.WARLORD]: 0.6,   // Quiere aliados para conquistar
    [BotPersonality.TURTLE]: 0.4,    // Prefiere estar solo pero acepta
    [BotPersonality.TYCOON]: 0.7,    // Busca oportunidades de comercio
    [BotPersonality.ROGUE]: 0.5      // Depende de la situación
  };
  
  const tendency = FACTION_TENDENCY[bot.personality];
  
  // Factores que aumentan la tendencia:
  // - Ataques recientes (necesita protección)
  // - Bajo poder militar (vulnerable)
  // - Alta ambición (quiere escalar ranking)
  
  const recentAttacks = bot.memory.recentAttackers.length;
  const vulnerabilityBonus = recentAttacks * 0.1;
  const ambitionBonus = bot.ambition * 0.2;
  
  return Math.random() < (tendency + vulnerabilityBonus + ambitionBonus);
}

/**
 * Encuentra la mejor facción para que un bot se una
 */
export function findBestFaction(
  bot: BotState, 
  factions: Faction[], 
  botStates: Record<string, BotState>
): Faction | null {
  const candidates = factions.filter(f => {
    // No está llena
    if (f.memberIds.length >= FACTION_LIMITS.MAX_MEMBERS) return false;
    // No es enemiga
    if (bot.memory.betrayals.some(b => f.memberIds.includes(b.traitorId))) return false;
    // Compatible ideológicamente
    return isIdeologyCompatible(bot.personality, f.ideology);
  });
  
  if (candidates.length === 0) return null;
  
  // Ordenar por compatibilidad
  return candidates.sort((a, b) => {
    const scoreA = calculateFactionCompatibility(bot, a, botStates);
    const scoreB = calculateFactionCompatibility(bot, b, botStates);
    return scoreB - scoreA;
  })[0];
}

function isIdeologyCompatible(
  personality: BotPersonality, 
  ideology: FactionIdeology
): boolean {
  const COMPATIBILITY = {
    [BotPersonality.WARLORD]: [FactionIdeology.MILITARIST, FactionIdeology.EXPANSIONIST],
    [BotPersonality.TURTLE]: [FactionIdeology.ISOLATIONIST, FactionIdeology.MERCANTILE],
    [BotPersonality.TYCOON]: [FactionIdeology.MERCANTILE, FactionIdeology.OPPORTUNIST],
    [BotPersonality.ROGUE]: [FactionIdeology.OPPORTUNIST, FactionIdeology.EXPANSIONIST]
  };
  
  return COMPATIBILITY[personality].includes(ideology);
}

// ══════════════════════════════════════════
// GESTIÓN DE MEMBRESÍA
// ══════════════════════════════════════════

export function addMemberToFaction(
  faction: Faction, 
  botId: string
): Faction {
  return {
    ...faction,
    memberIds: [...faction.memberIds, botId],
    power: recalculateFactionPower(faction),
    history: [...faction.history, {
      type: FactionEventType.MEMBER_JOINED,
      timestamp: Date.now(),
      actorId: botId,
      details: `New member joined`
    }]
  };
}

export function removeMemberFromFaction(
  faction: Faction, 
  botId: string,
  reason: 'left' | 'kicked' | 'betrayed'
): Faction {
  const eventType = reason === 'kicked' 
    ? FactionEventType.MEMBER_KICKED 
    : reason === 'betrayed'
      ? FactionEventType.BETRAYAL
      : FactionEventType.MEMBER_LEFT;
  
  // Si el líder se va, promover a un oficial o disolver
  let newLeaderId = faction.leaderId;
  if (botId === faction.leaderId) {
    newLeaderId = faction.officerIds[0] || faction.memberIds[0] || '';
  }
  
  return {
    ...faction,
    leaderId: newLeaderId,
    officerIds: faction.officerIds.filter(id => id !== botId),
    memberIds: faction.memberIds.filter(id => id !== botId),
    stability: Math.max(0, faction.stability - (reason === 'betrayed' ? 30 : 10)),
    history: [...faction.history, {
      type: eventType,
      timestamp: Date.now(),
      actorId: botId,
      details: `Member ${reason}`
    }]
  };
}

// ══════════════════════════════════════════
// GUERRAS ENTRE FACCIONES
// ══════════════════════════════════════════

export function declareWar(
  attacker: Faction, 
  defender: Faction,
  reason: WarReason
): { attacker: Faction; defender: Faction; war: FactionWar } {
  const war: FactionWar = {
    id: generateId(),
    enemyFactionId: defender.id,
    startTime: Date.now(),
    reason,
    battles: [],
    currentScore: { us: 0, them: 0 },
    status: 'active'
  };
  
  return {
    attacker: {
      ...attacker,
      enemies: [...attacker.enemies, defender.id],
      activeWars: [...attacker.activeWars, war],
      history: [...attacker.history, {
        type: FactionEventType.WAR_DECLARED,
        timestamp: Date.now(),
        actorId: attacker.leaderId,
        details: `War declared against ${defender.name}`
      }]
    },
    defender: {
      ...defender,
      enemies: [...defender.enemies, attacker.id],
      activeWars: [...defender.activeWars, {
        ...war,
        enemyFactionId: attacker.id
      }]
    },
    war
  };
}

// ══════════════════════════════════════════
// ESTABILIDAD Y FRAGMENTACIÓN
// ══════════════════════════════════════════

export function updateFactionStability(faction: Faction): Faction {
  let stabilityChange = 0;
  
  // Factores positivos
  if (faction.activeWars.some(w => w.status === 'active' && w.currentScore.us > w.currentScore.them)) {
    stabilityChange += 5; // Ganando guerra
  }
  if (faction.treasury[ResourceType.MONEY] > 10000) {
    stabilityChange += 2; // Tesorería rica
  }
  
  // Factores negativos
  if (faction.activeWars.some(w => w.status === 'active' && w.currentScore.us < w.currentScore.them)) {
    stabilityChange -= 10; // Perdiendo guerra
  }
  if (faction.memberIds.length < FACTION_LIMITS.MIN_MEMBERS) {
    stabilityChange -= 20; // Muy pocos miembros
  }
  
  // Decay natural
  stabilityChange -= FACTION_LIMITS.STABILITY_DECAY_RATE;
  
  return {
    ...faction,
    stability: Math.max(0, Math.min(100, faction.stability + stabilityChange))
  };
}

export function shouldFactionDissolve(faction: Faction): boolean {
  return faction.stability <= 0 || 
         faction.memberIds.length < FACTION_LIMITS.MIN_MEMBERS;
}

// ══════════════════════════════════════════
// CÁLCULOS DE COMPATIBILIDAD Y PODER
// ══════════════════════════════════════════

/**
 * Calcula qué tan compatible es un bot con una facción
 * Score más alto = mejor candidato para unirse
 */
function calculateFactionCompatibility(
  bot: BotState, 
  faction: Faction, 
  botStates: Record<string, BotState>
): number {
  let score = 0;
  
  // 1. Compatibilidad ideológica (0-30 puntos)
  if (isIdeologyCompatible(bot.personality, faction.ideology)) {
    score += 30;
  }
  
  // 2. Poder de la facción (0-20 puntos)
  // Bots prefieren facciones poderosas
  score += Math.min(20, faction.power / 500);
  
  // 3. Reputación con miembros existentes (−20 a +20 puntos)
  const allMemberIds = [...faction.memberIds, ...faction.officerIds, faction.leaderId];
  let totalRep = 0;
  let repCount = 0;
  for (const memberId of allMemberIds) {
    if (bot.reputation[memberId] !== undefined) {
      totalRep += bot.reputation[memberId];
      repCount++;
    }
  }
  if (repCount > 0) {
    const avgRep = totalRep / repCount;
    score += Math.max(-20, Math.min(20, avgRep / 5));
  }
  
  // 4. Tamaño de la facción (0-15 puntos)
  // Facciones medianas son preferidas (ni muy grandes ni muy pequeñas)
  const idealSize = FACTION_LIMITS.MAX_MEMBERS * 0.6;
  const sizeScore = 15 - Math.abs(allMemberIds.length - idealSize) * 2;
  score += Math.max(0, sizeScore);
  
  // 5. Estabilidad (0-15 puntos)
  score += faction.stability * 0.15;
  
  // 6. Sin enemigos personales en la facción (−50 o 0 puntos)
  const hasEnemies = bot.memory.betrayals.some(b => allMemberIds.includes(b.traitorId));
  if (hasEnemies) {
    score -= 50;
  }
  
  // 7. Beneficio económico potencial (0-10 puntos)
  const treasuryValue = Object.values(faction.treasury || {}).reduce((s, v) => s + (v || 0), 0);
  score += Math.min(10, treasuryValue / 1000);
  
  return score;
}

/**
 * Recalcula el poder total de una facción basado en sus miembros
 * Se debe llamar cada vez que cambia la membresía
 */
function recalculateFactionPower(
  faction: Faction,
  botStates?: Record<string, BotState>
): number {
  const allMemberIds = [...faction.memberIds, ...faction.officerIds, faction.leaderId]
    .filter(id => id !== '');
  
  if (!botStates) {
    // Estimación básica sin acceso al estado de bots
    return allMemberIds.length * 1000;
  }
  
  let totalPower = 0;
  
  for (const memberId of allMemberIds) {
    const bot = botStates[memberId];
    if (!bot) continue;
    
    // Poder militar
    totalPower += bot.armyScore;
    
    // Poder económico (contribuye menos)
    const economicPower = Object.values(bot.resources).reduce((s, v) => s + v, 0);
    totalPower += economicPower * 0.1;
    
    // Bonus por rol
    switch (bot.factionRole) {
      case FactionRole.LEADER:
        totalPower *= 1.0; // Sin bonus adicional, ya se cuenta su ejército
        break;
      case FactionRole.OFFICER:
        totalPower += 500; // Bonus por liderazgo
        break;
    }
  }
  
  // Bonus por estabilidad
  totalPower *= (0.5 + faction.stability / 200); // 0.5x a 1.0x
  
  // Bonus por alianzas
  totalPower *= (1 + faction.allies.length * 0.1);
  
  return Math.floor(totalPower);
}

// ══════════════════════════════════════════
// GESTIÓN DE FACCIONES DEL JUGADOR
// ══════════════════════════════════════════

/**
 * Permite al jugador crear su propia facción
 */
export function playerCreateFaction(
  state: GameState,
  name: string,
  tag: string,
  ideology: FactionIdeology
): { state: GameState; faction: Faction } {
  const newFaction: Faction = {
    id: `faction_player_${Date.now()}`,
    name,
    tag,
    motto: '',
    color: '#FF6600',
    iconId: 0,
    leaderId: 'player',
    officerIds: [],
    memberIds: [],
    pendingInvites: [],
    ideology,
    founded: Date.now(),
    treasury: {},
    contributionHistory: [],
    allies: [],
    enemies: [],
    neutrals: [],
    activeWars: [],
    power: 0,
    territory: 0,
    stability: 80, // Estabilidad inicial alta
    reputation: 0,
    history: [{
      type: FactionEventType.FOUNDED,
      timestamp: Date.now(),
      actorId: 'player',
      details: `${name} has been founded`
    }]
  };
  
  return {
    state: {
      ...state,
      factions: {
        ...state.factions,
        [newFaction.id]: newFaction
      }
    },
    faction: newFaction
  };
}

/**
 * Permite al jugador invitar a un bot a su facción
 */
export function playerInviteBotToFaction(
  state: GameState,
  factionId: string,
  botId: string
): GameState {
  const faction = state.factions[factionId];
  if (!faction || faction.leaderId !== 'player') return state;
  if (faction.memberIds.length >= FACTION_LIMITS.MAX_MEMBERS) return state;
  
  return {
    ...state,
    factions: {
      ...state.factions,
      [factionId]: {
        ...faction,
        pendingInvites: [...faction.pendingInvites, botId]
      }
    }
  };
}
```

### 2.4 Archivos a Crear/Modificar - Fase 2

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `types/faction.ts` | **CREAR** | Interfaces de facción |
| `data/factions.ts` | **CREAR** | Plantillas de facciones iniciales |
| `utils/engine/factions.ts` | **CREAR** | Lógica de gestión de facciones |
| `types/state.ts` | **MODIFICAR** | Añadir `factions: Record<string, Faction>` |
| `types/enums.ts` | **MODIFICAR** | Añadir FactionIdeology, WarReason, etc. |

---

## FASE 3: Sistema de Diplomacia

### 3.1 Acciones Diplomáticas

**Archivo: `types/diplomacy.ts`**

```typescript
// ══════════════════════════════════════════
// ACCIONES DIPLOMÁTICAS
// ══════════════════════════════════════════

export enum DiplomaticAction {
  // ─────────────────────────────────────────
  // Propuestas amistosas
  // ─────────────────────────────────────────
  PROPOSE_ALLIANCE = 'PROPOSE_ALLIANCE',
  PROPOSE_NON_AGGRESSION = 'PROPOSE_NON_AGGRESSION',
  PROPOSE_TRADE_DEAL = 'PROPOSE_TRADE_DEAL',
  PROPOSE_JOINT_ATTACK = 'PROPOSE_JOINT_ATTACK',
  OFFER_TRIBUTE = 'OFFER_TRIBUTE',
  REQUEST_AID = 'REQUEST_AID',
  INVITE_TO_FACTION = 'INVITE_TO_FACTION',
  
  // ─────────────────────────────────────────
  // Respuestas
  // ─────────────────────────────────────────
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  COUNTER_OFFER = 'COUNTER_OFFER',
  
  // ─────────────────────────────────────────
  // Acciones hostiles
  // ─────────────────────────────────────────
  DECLARE_WAR = 'DECLARE_WAR',
  BREAK_ALLIANCE = 'BREAK_ALLIANCE',
  BETRAY = 'BETRAY',
  EMBARGO = 'EMBARGO',
  EXPEL_FROM_FACTION = 'EXPEL_FROM_FACTION',
  
  // ─────────────────────────────────────────
  // Acciones especiales
  // ─────────────────────────────────────────
  SURRENDER = 'SURRENDER',
  DEMAND_TRIBUTE = 'DEMAND_TRIBUTE',
  THREATEN = 'THREATEN',
  OFFER_CEASEFIRE = 'OFFER_CEASEFIRE'
}

// ══════════════════════════════════════════
// PROPUESTAS DIPLOMÁTICAS
// ══════════════════════════════════════════

export interface DiplomaticProposal {
  id: string;
  type: DiplomaticAction;
  
  // Participantes
  fromId: string;           // Bot ID, Faction ID, o 'player'
  fromType: 'bot' | 'faction' | 'player';
  toId: string;
  toType: 'bot' | 'faction' | 'player';
  
  // Términos
  terms: DealTerms;
  
  // Estado
  status: ProposalStatus;
  createdAt: number;
  expiresAt: number;
  respondedAt?: number;
  response?: string;        // Mensaje de respuesta
}

export type ProposalStatus = 
  | 'pending' 
  | 'accepted' 
  | 'rejected' 
  | 'expired' 
  | 'withdrawn'
  | 'countered';

export interface DealTerms {
  // Recursos ofrecidos/solicitados
  resourcesOffered?: Partial<Record<ResourceType, number>>;
  resourcesRequested?: Partial<Record<ResourceType, number>>;
  
  // Duración del acuerdo
  duration?: number;        // En milisegundos (0 = permanente)
  
  // Para ataques conjuntos
  targetId?: string;
  targetType?: 'bot' | 'faction' | 'player';
  
  // Para tributos
  tributePercentage?: number;  // % de producción
  tributeFrequency?: number;   // Cada cuánto tiempo
  
  // Condiciones especiales
  conditions?: DealCondition[];
}

export interface DealCondition {
  type: 'mutual_defense' | 'no_expansion' | 'exclusive_trade' | 'intelligence_sharing';
  description: string;
}

// ══════════════════════════════════════════
// TRATADOS ACTIVOS
// ══════════════════════════════════════════

export interface ActiveTreaty {
  id: string;
  type: TreatyType;
  parties: string[];        // IDs de los participantes
  terms: DealTerms;
  startedAt: number;
  expiresAt: number | null; // null = permanente
  violations: TreatyViolation[];
}

export enum TreatyType {
  ALLIANCE = 'ALLIANCE',
  NON_AGGRESSION = 'NON_AGGRESSION',
  TRADE_AGREEMENT = 'TRADE_AGREEMENT',
  MUTUAL_DEFENSE = 'MUTUAL_DEFENSE',
  CEASEFIRE = 'CEASEFIRE',
  TRIBUTE = 'TRIBUTE'
}

export interface TreatyViolation {
  violatorId: string;
  timestamp: number;
  description: string;
  severity: 'minor' | 'major' | 'critical';
}

// ══════════════════════════════════════════
// ESTADO DIPLOMÁTICO DEL JUEGO
// ══════════════════════════════════════════

export interface DiplomacyState {
  proposals: Record<string, DiplomaticProposal>;
  treaties: Record<string, ActiveTreaty>;
  worldEvents: WorldEvent[];
}

export interface WorldEvent {
  id: string;
  type: WorldEventType;
  timestamp: number;
  actors: string[];
  description: string;
  impact: 'minor' | 'major' | 'critical';
}

export enum WorldEventType {
  WAR_DECLARED = 'WAR_DECLARED',
  WAR_ENDED = 'WAR_ENDED',
  ALLIANCE_FORMED = 'ALLIANCE_FORMED',
  ALLIANCE_BROKEN = 'ALLIANCE_BROKEN',
  FACTION_FORMED = 'FACTION_FORMED',
  FACTION_DISSOLVED = 'FACTION_DISSOLVED',
  BETRAYAL = 'BETRAYAL',
  MAJOR_BATTLE = 'MAJOR_BATTLE',
  POWER_SHIFT = 'POWER_SHIFT'
}
```

### 3.2 Sistema de Reputación

**Archivo: `utils/engine/reputation.ts`**

```typescript
/**
 * Sistema de Reputación
 * 
 * La reputación va de -100 (odiado) a +100 (adorado)
 * Afecta las decisiones de IA y las opciones diplomáticas disponibles
 */

// ══════════════════════════════════════════
// MODIFICADORES DE REPUTACIÓN
// ══════════════════════════════════════════

export const REPUTATION_MODIFIERS = {
  // Acciones positivas
  HONOR_ALLIANCE: +10,
  PROVIDE_AID_SMALL: +5,
  PROVIDE_AID_LARGE: +15,
  WIN_JOINT_WAR: +25,
  ACCEPT_SURRENDER: +5,
  DEFEND_ALLY: +20,
  GENEROUS_TRADE: +8,
  KEEP_PROMISE: +5,
  
  // Acciones negativas
  ATTACK_UNPROVOKED: -15,
  ATTACK_ALLY: -30,
  BREAK_ALLIANCE: -40,
  BREAK_NON_AGGRESSION: -25,
  BETRAY_IN_WAR: -80,
  REFUSE_AID_REQUEST: -10,
  REFUSE_SURRENDER: -10,
  UNFAIR_TRADE: -5,
  BREAK_PROMISE: -20,
  ATTACK_WEAK_TARGET: -5,
  
  // Acciones neutrales con contexto
  ATTACK_ENEMY: 0,           // Esperado
  REFUSE_ENEMY_PROPOSAL: 0,  // Normal
  
  // Decay
  REPUTATION_DECAY_RATE: -0.5  // Por hora hacia neutral
};

// ══════════════════════════════════════════
// UMBRALES DE REPUTACIÓN
// ══════════════════════════════════════════

export const REPUTATION_THRESHOLDS = {
  TRUSTED_ALLY: 75,      // Muy alta: tratados especiales disponibles
  FRIENDLY: 50,          // Alta: alianzas fáciles
  POSITIVE: 25,          // Positiva: comercio favorable
  NEUTRAL: 0,            // Neutral
  SUSPICIOUS: -25,       // Negativa: propuestas rechazadas más frecuentemente
  HOSTILE: -50,          // Hostil: ataques preventivos posibles
  HATED: -75             // Muy hostil: objetivo prioritario
};

// ══════════════════════════════════════════
// FUNCIONES DE REPUTACIÓN
// ══════════════════════════════════════════

/**
 * Calcula el cambio de reputación por una acción
 */
export function calculateReputationChange(
  action: DiplomaticAction,
  context: ReputationContext
): number {
  switch (action) {
    case DiplomaticAction.BREAK_ALLIANCE:
      // Peor si fue durante una guerra
      return context.duringWar 
        ? REPUTATION_MODIFIERS.BETRAY_IN_WAR 
        : REPUTATION_MODIFIERS.BREAK_ALLIANCE;
    
    case DiplomaticAction.OFFER_TRIBUTE:
      // Positivo para quien recibe
      return context.isGenerous 
        ? REPUTATION_MODIFIERS.PROVIDE_AID_LARGE 
        : REPUTATION_MODIFIERS.PROVIDE_AID_SMALL;
    
    case DiplomaticAction.DECLARE_WAR:
      // Depende del contexto
      if (context.wasProvoked) return REPUTATION_MODIFIERS.ATTACK_ENEMY;
      if (context.targetIsWeak) return REPUTATION_MODIFIERS.ATTACK_WEAK_TARGET;
      return REPUTATION_MODIFIERS.ATTACK_UNPROVOKED;
    
    case DiplomaticAction.PROPOSE_ALLIANCE:
      return context.brokePromise 
        ? REPUTATION_MODIFIERS.BREAK_PROMISE 
        : REPUTATION_MODIFIERS.HONOR_ALLIANCE;
    
    case DiplomaticAction.PROPOSE_JOINT_ATTACK:
      return REPUTATION_MODIFIERS.ATTACK_ENEMY;
    
    case DiplomaticAction.REQUEST_AID:
      return 0; // Neutral, la respuesta es lo que importa
    
    case DiplomaticAction.ACCEPT:
      return REPUTATION_MODIFIERS.KEEP_PROMISE;
    
    case DiplomaticAction.REJECT:
      return REPUTATION_MODIFIERS.REFUSE_AID_REQUEST;
    
    case DiplomaticAction.BETRAY:
      return context.duringWar
        ? REPUTATION_MODIFIERS.BETRAY_IN_WAR
        : REPUTATION_MODIFIERS.BREAK_ALLIANCE;
    
    case DiplomaticAction.EMBARGO:
      return REPUTATION_MODIFIERS.UNFAIR_TRADE;
    
    case DiplomaticAction.EXPEL_FROM_FACTION:
      return REPUTATION_MODIFIERS.ATTACK_UNPROVOKED;
    
    case DiplomaticAction.SURRENDER:
      return REPUTATION_MODIFIERS.ACCEPT_SURRENDER;
    
    case DiplomaticAction.DEMAND_TRIBUTE:
      return context.targetIsWeak
        ? REPUTATION_MODIFIERS.ATTACK_WEAK_TARGET
        : REPUTATION_MODIFIERS.ATTACK_UNPROVOKED;
    
    case DiplomaticAction.THREATEN:
      return REPUTATION_MODIFIERS.ATTACK_UNPROVOKED * 0.5;
    
    case DiplomaticAction.OFFER_CEASEFIRE:
      return REPUTATION_MODIFIERS.KEEP_PROMISE;
    
    case DiplomaticAction.PROPOSE_NON_AGGRESSION:
      return REPUTATION_MODIFIERS.HONOR_ALLIANCE * 0.5;
    
    case DiplomaticAction.PROPOSE_TRADE_DEAL:
      return context.isGenerous
        ? REPUTATION_MODIFIERS.GENEROUS_TRADE
        : 0;
    
    case DiplomaticAction.INVITE_TO_FACTION:
      return REPUTATION_MODIFIERS.PROVIDE_AID_SMALL;
    
    case DiplomaticAction.BREAK_NON_AGGRESSION:
      return REPUTATION_MODIFIERS.BREAK_NON_AGGRESSION;
    
    default:
      return 0;
  }
}

export interface ReputationContext {
  duringWar?: boolean;
  wasProvoked?: boolean;
  targetIsWeak?: boolean;
  isGenerous?: boolean;
  brokePromise?: boolean;
}

/**
 * Determina las opciones diplomáticas disponibles basado en reputación
 */
export function getAvailableDiplomaticActions(
  fromReputation: number,
  currentRelation: 'ally' | 'neutral' | 'enemy' | 'faction_member'
): DiplomaticAction[] {
  const actions: DiplomaticAction[] = [];
  
  // Siempre disponibles
  actions.push(DiplomaticAction.OFFER_TRIBUTE);
  actions.push(DiplomaticAction.REQUEST_AID);
  
  if (currentRelation === 'ally') {
    actions.push(DiplomaticAction.PROPOSE_JOINT_ATTACK);
    actions.push(DiplomaticAction.BREAK_ALLIANCE); // Siempre posible, pero con consecuencias
  }
  
  if (currentRelation === 'neutral') {
    if (fromReputation >= REPUTATION_THRESHOLDS.POSITIVE) {
      actions.push(DiplomaticAction.PROPOSE_ALLIANCE);
    }
    actions.push(DiplomaticAction.PROPOSE_NON_AGGRESSION);
    actions.push(DiplomaticAction.PROPOSE_TRADE_DEAL);
    actions.push(DiplomaticAction.DECLARE_WAR);
  }
  
  if (currentRelation === 'enemy') {
    actions.push(DiplomaticAction.OFFER_CEASEFIRE);
    actions.push(DiplomaticAction.SURRENDER);
    actions.push(DiplomaticAction.DEMAND_TRIBUTE);
  }
  
  return actions;
}

/**
 * Aplica decay de reputación hacia neutral
 */
export function applyReputationDecay(
  reputation: number, 
  hoursElapsed: number
): number {
  const decay = REPUTATION_MODIFIERS.REPUTATION_DECAY_RATE * hoursElapsed;
  
  if (reputation > 0) {
    return Math.max(0, reputation + decay);
  } else if (reputation < 0) {
    return Math.min(0, reputation - decay);
  }
  
  return 0;
}
```

### 3.3 Motor de Diplomacia

**Archivo: `utils/engine/diplomacy.ts`**

```typescript
/**
 * Motor de Diplomacia
 * Procesa propuestas, tratados y eventos diplomáticos
 */

// ══════════════════════════════════════════
// CREACIÓN DE PROPUESTAS
// ══════════════════════════════════════════

export function createProposal(
  from: { id: string; type: 'bot' | 'faction' | 'player' },
  to: { id: string; type: 'bot' | 'faction' | 'player' },
  action: DiplomaticAction,
  terms: DealTerms
): DiplomaticProposal {
  const PROPOSAL_DURATION = 30 * 60 * 1000; // 30 minutos para responder
  
  return {
    id: generateId(),
    type: action,
    fromId: from.id,
    fromType: from.type,
    toId: to.id,
    toType: to.type,
    terms,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + PROPOSAL_DURATION
  };
}

// ══════════════════════════════════════════
// EVALUACIÓN DE PROPUESTAS (IA)
// ══════════════════════════════════════════

export function evaluateProposal(
  proposal: DiplomaticProposal,
  evaluator: BotState,
  worldState: { factions: Record<string, Faction>; botStates: Record<string, BotState> }
): { decision: 'accept' | 'reject' | 'counter'; reason: string; counterTerms?: DealTerms } {
  
  const proposerReputation = evaluator.reputation[proposal.fromId] || 0;
  
  // Base: personalidad del bot
  const BASE_ACCEPTANCE = {
    [BotPersonality.WARLORD]: 0.3,   // Desconfiado
    [BotPersonality.TURTLE]: 0.5,    // Cauteloso
    [BotPersonality.TYCOON]: 0.7,    // Abierto a tratos
    [BotPersonality.ROGUE]: 0.4      // Impredecible
  };
  
  let acceptanceChance = BASE_ACCEPTANCE[evaluator.personality];
  
  // Modificar por reputación
  acceptanceChance += proposerReputation / 200; // -0.5 a +0.5
  
  // Modificar por tipo de propuesta
  switch (proposal.type) {
    case DiplomaticAction.PROPOSE_ALLIANCE:
      // Verificar si tiene sentido estratégico
      if (evaluator.memory.betrayals.some(b => b.traitorId === proposal.fromId)) {
        return { decision: 'reject', reason: 'Never forget betrayal' };
      }
      break;
    
    case DiplomaticAction.PROPOSE_JOINT_ATTACK:
      // Verificar si el objetivo es enemigo
      const targetId = proposal.terms.targetId;
      if (!targetId || evaluator.memory.recentAllies.some(a => a.allyId === targetId)) {
        return { decision: 'reject', reason: 'Will not attack allies' };
      }
      break;
    
    case DiplomaticAction.OFFER_TRIBUTE:
      // Casi siempre aceptar tributos
      acceptanceChance += 0.4;
      break;
  }
  
  // Decisión final
  if (Math.random() < acceptanceChance) {
    return { decision: 'accept', reason: 'Terms acceptable' };
  }
  
  // Considerar contraoferta
  if (Math.random() < 0.3) {
    return {
      decision: 'counter',
      reason: 'Better terms required',
      counterTerms: generateCounterTerms(proposal.terms, evaluator)
    };
  }
  
  return { decision: 'reject', reason: 'Not interested at this time' };
}

function generateCounterTerms(
  originalTerms: DealTerms, 
  evaluator: BotState
): DealTerms {
  // Pedir más o ofrecer menos
  const counter = { ...originalTerms };
  
  if (counter.resourcesOffered) {
    // Reducir lo que ofrecemos
    for (const resource in counter.resourcesOffered) {
      counter.resourcesOffered[resource as ResourceType] = 
        Math.floor(counter.resourcesOffered[resource as ResourceType]! * 0.7);
    }
  }
  
  if (counter.resourcesRequested) {
    // Aumentar lo que pedimos
    for (const resource in counter.resourcesRequested) {
      counter.resourcesRequested[resource as ResourceType] = 
        Math.floor(counter.resourcesRequested[resource as ResourceType]! * 1.3);
    }
  }
  
  return counter;
}

// ══════════════════════════════════════════
// PROCESAMIENTO DE TRATADOS
// ══════════════════════════════════════════

export function processTreaties(
  treaties: Record<string, ActiveTreaty>,
  currentTime: number
): { 
  updatedTreaties: Record<string, ActiveTreaty>; 
  expiredTreaties: ActiveTreaty[];
  events: WorldEvent[] 
} {
  const updated: Record<string, ActiveTreaty> = {};
  const expired: ActiveTreaty[] = [];
  const events: WorldEvent[] = [];
  
  for (const [id, treaty] of Object.entries(treaties)) {
    // Verificar expiración
    if (treaty.expiresAt && currentTime >= treaty.expiresAt) {
      expired.push(treaty);
      events.push({
        id: generateId(),
        type: WorldEventType.ALLIANCE_BROKEN,
        timestamp: currentTime,
        actors: treaty.parties,
        description: `${treaty.type} treaty expired`,
        impact: 'minor'
      });
      continue;
    }
    
    // Verificar violaciones críticas
    const criticalViolations = treaty.violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      expired.push(treaty);
      events.push({
        id: generateId(),
        type: WorldEventType.BETRAYAL,
        timestamp: currentTime,
        actors: [criticalViolations[0].violatorId],
        description: `Treaty violated: ${criticalViolations[0].description}`,
        impact: 'major'
      });
      continue;
    }
    
    updated[id] = treaty;
  }
  
  return { updatedTreaties: updated, expiredTreaties: expired, events };
}

// ══════════════════════════════════════════
// ACCIONES DEL JUGADOR
// ══════════════════════════════════════════

export function playerPropose(
  state: GameState,
  targetId: string,
  targetType: 'bot' | 'faction',
  action: DiplomaticAction,
  terms: DealTerms
): GameState {
  const proposal = createProposal(
    { id: 'player', type: 'player' },
    { id: targetId, type: targetType },
    action,
    terms
  );
  
  return {
    ...state,
    diplomacy: {
      ...state.diplomacy,
      proposals: {
        ...state.diplomacy.proposals,
        [proposal.id]: proposal
      }
    }
  };
}

export function playerRespond(
  state: GameState,
  proposalId: string,
  response: 'accept' | 'reject' | 'counter',
  counterTerms?: DealTerms
): GameState {
  const proposal = state.diplomacy.proposals[proposalId];
  if (!proposal || proposal.status !== 'pending') return state;
  
  let newStatus: ProposalStatus;
  let treaty: ActiveTreaty | null = null;
  
  switch (response) {
    case 'accept':
      newStatus = 'accepted';
      treaty = createTreatyFromProposal(proposal);
      break;
    case 'reject':
      newStatus = 'rejected';
      break;
    case 'counter':
      newStatus = 'countered';
      // Crear nueva propuesta con términos invertidos
      break;
  }
  
  return {\n    ...state,\n    diplomacy: {\n      ...state.diplomacy,
      proposals: {
        ...state.diplomacy.proposals,
        [proposalId]: { ...proposal, status: newStatus, respondedAt: Date.now() }
      },
      treaties: treaty ? {
        ...state.diplomacy.treaties,
        [treaty.id]: treaty
      } : state.diplomacy.treaties
    }
  };
}

// ══════════════════════════════════════════
// CREACIÓN DE TRATADOS DESDE PROPUESTAS
// ══════════════════════════════════════════

/**
 * Convierte una propuesta aceptada en un tratado activo
 */
function createTreatyFromProposal(proposal: DiplomaticProposal): ActiveTreaty {
  // Mapear tipo de propuesta a tipo de tratado
  const treatyTypeMap: Partial<Record<DiplomaticAction, TreatyType>> = {
    [DiplomaticAction.PROPOSE_ALLIANCE]: TreatyType.ALLIANCE,
    [DiplomaticAction.PROPOSE_NON_AGGRESSION]: TreatyType.NON_AGGRESSION,
    [DiplomaticAction.PROPOSE_TRADE_DEAL]: TreatyType.TRADE_AGREEMENT,
    [DiplomaticAction.OFFER_CEASEFIRE]: TreatyType.CEASEFIRE,
    [DiplomaticAction.OFFER_TRIBUTE]: TreatyType.TRIBUTE,
    [DiplomaticAction.PROPOSE_JOINT_ATTACK]: TreatyType.MUTUAL_DEFENSE
  };
  
  const treatyType = treatyTypeMap[proposal.type] || TreatyType.NON_AGGRESSION;
  
  // Calcular duración del tratado
  const DEFAULT_DURATIONS: Record<TreatyType, number | null> = {
    [TreatyType.ALLIANCE]: null,                    // Permanente
    [TreatyType.NON_AGGRESSION]: 4 * 60 * 60 * 1000, // 4 horas
    [TreatyType.TRADE_AGREEMENT]: 2 * 60 * 60 * 1000, // 2 horas
    [TreatyType.MUTUAL_DEFENSE]: null,               // Permanente
    [TreatyType.CEASEFIRE]: 1 * 60 * 60 * 1000,      // 1 hora
    [TreatyType.TRIBUTE]: 6 * 60 * 60 * 1000          // 6 horas
  };
  
  const duration = proposal.terms.duration || DEFAULT_DURATIONS[treatyType];
  
  return {
    id: `treaty_${proposal.id}_${Date.now()}`,
    type: treatyType,
    parties: [proposal.fromId, proposal.toId],
    terms: proposal.terms,
    startedAt: Date.now(),
    expiresAt: duration ? Date.now() + duration : null,
    violations: []
  };
}

/**
 * Verifica si una acción viola un tratado existente
 */
export function checkTreatyViolation(
  actorId: string,
  targetId: string,
  action: DiplomaticAction,
  treaties: Record<string, ActiveTreaty>
): { violated: boolean; treaty?: ActiveTreaty; severity: 'minor' | 'major' | 'critical' } {
  for (const treaty of Object.values(treaties)) {
    // Verificar si ambas partes están en el tratado
    if (!treaty.parties.includes(actorId) || !treaty.parties.includes(targetId)) {
      continue;
    }
    
    // Verificar violaciones según tipo de tratado y acción
    switch (treaty.type) {
      case TreatyType.ALLIANCE:
      case TreatyType.MUTUAL_DEFENSE:
        if (action === DiplomaticAction.DECLARE_WAR || action === DiplomaticAction.BETRAY) {
          return { violated: true, treaty, severity: 'critical' };
        }
        if (action === DiplomaticAction.EMBARGO) {
          return { violated: true, treaty, severity: 'major' };
        }
        break;
      
      case TreatyType.NON_AGGRESSION:
        if (action === DiplomaticAction.DECLARE_WAR) {
          return { violated: true, treaty, severity: 'critical' };
        }
        if (action === DiplomaticAction.THREATEN) {
          return { violated: true, treaty, severity: 'minor' };
        }
        break;
      
      case TreatyType.CEASEFIRE:
        if (action === DiplomaticAction.DECLARE_WAR) {
          return { violated: true, treaty, severity: 'critical' };
        }
        break;
      
      case TreatyType.TRADE_AGREEMENT:
        if (action === DiplomaticAction.EMBARGO) {
          return { violated: true, treaty, severity: 'major' };
        }
        break;
    }
  }
  
  return { violated: false, severity: 'minor' };
}
```

### 3.4 Archivos a Crear/Modificar - Fase 3

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `types/diplomacy.ts` | **CREAR** | Interfaces diplomáticas completas |
| `utils/engine/reputation.ts` | **CREAR** | Sistema de reputación |
| `utils/engine/diplomacy.ts` | **CREAR** | Motor de diplomacia |
| `types/state.ts` | **MODIFICAR** | Añadir `diplomacy: DiplomacyState` |

---

## FASE 4: IA de Toma de Decisiones

### 4.1 Motor de Decisiones Principal

**Archivo: `utils/ai/decisionEngine.ts`**

```typescript
/**
 * Motor de Decisiones de IA para Bots
 * 
 * Cada bot evalúa su situación y toma decisiones autónomas
 * basadas en su personalidad, memoria, y estado del mundo.
 */

import { PERSONALITY_WEIGHTS, PersonalityTraits } from './personalityWeights';

// ══════════════════════════════════════════
// ÁRBOL DE DECISIONES PRINCIPAL
// ══════════════════════════════════════════

export function makeBotDecision(
  bot: BotState,
  worldState: WorldState
): BotDecision {
  const traits = PERSONALITY_WEIGHTS[bot.personality];
  const context = analyzeContext(bot, worldState);
  
  // ─────────────────────────────────────────
  // PRIORIDAD 1: SUPERVIVENCIA
  // ─────────────────────────────────────────
  if (context.underAttack) {
    return handleUnderAttack(bot, context, traits);
  }
  
  // ─────────────────────────────────────────
  // PRIORIDAD 2: VENGANZA
  // ─────────────────────────────────────────
  if (bot.currentGoal === BotGoal.REVENGE && traits.revenge > 0.5) {
    const revenge = planRevenge(bot, context, traits);
    if (revenge) return revenge;
  }
  
  // ─────────────────────────────────────────
  // PRIORIDAD 3: OBLIGACIONES DE FACCIÓN
  // ─────────────────────────────────────────
  if (bot.factionId && context.factionAtWar) {
    return contributeToFactionWar(bot, context, traits);
  }
  
  // ─────────────────────────────────────────
  // PRIORIDAD 4: DEFENSA DE ALIADOS
  // ─────────────────────────────────────────
  if (context.allyUnderAttack && traits.loyalty > 0.6) {
    return defendAlly(bot, context, traits);
  }
  
  // ─────────────────────────────────────────
  // PRIORIDAD 5: TRAICIÓN (si es conveniente)
  // ─────────────────────────────────────────
  if (shouldConsiderBetrayal(bot, context, traits)) {
    const betrayal = planBetrayal(bot, context, traits);
    if (betrayal) return betrayal;
  }
  
  // ─────────────────────────────────────────
  // PRIORIDAD 6: EXPANSIÓN
  // ─────────────────────────────────────────
  if (context.canExpand && traits.aggression > 0.5) {
    const expansion = planExpansion(bot, context, traits);
    if (expansion) return expansion;
  }
  
  // ─────────────────────────────────────────
  // PRIORIDAD 7: DIPLOMACIA
  // ─────────────────────────────────────────
  if (shouldSeekDiplomacy(bot, context, traits)) {
    return planDiplomacy(bot, context, traits);
  }
  
  // ─────────────────────────────────────────
  // PRIORIDAD 8: DESARROLLO ECONÓMICO
  // ─────────────────────────────────────────
  return planEconomicDevelopment(bot, context, traits);
}

// ══════════════════════════════════════════
// ANÁLISIS DE CONTEXTO
// ══════════════════════════════════════════

interface BotContext {
  // Estado personal
  militaryStrength: number;      // Relativo al promedio
  economicStrength: number;
  isVulnerable: boolean;
  
  // Amenazas
  underAttack: boolean;
  incomingAttacks: string[];
  recentAttackers: string[];
  
  // Facción
  factionAtWar: boolean;
  factionStability: number;
  allyUnderAttack: string | null;
  
  // Oportunidades
  canExpand: boolean;
  weakTargets: string[];
  potentialAllies: string[];
  betrayalOpportunity: boolean;
  
  // Jugador
  playerThreatLevel: number;
  playerRelation: 'ally' | 'neutral' | 'enemy';
}

function analyzeContext(bot: BotState, worldState: WorldState): BotContext {
  const avgMilitary = calculateAverageMilitary(worldState);
  const avgEconomic = calculateAverageEconomic(worldState);
  
  return {
    militaryStrength: bot.armyScore / avgMilitary,
    economicStrength: getTotalResources(bot) / avgEconomic,
    isVulnerable: bot.armyScore < avgMilitary * 0.5,
    
    underAttack: worldState.incomingAttacks?.some(a => a.targetId === bot.id) || false,
    incomingAttacks: worldState.incomingAttacks
      ?.filter(a => a.targetId === bot.id)
      .map(a => a.attackerId) || [],
    recentAttackers: bot.memory.recentAttackers.map(a => a.attackerId),
    
    factionAtWar: bot.factionId 
      ? worldState.factions[bot.factionId]?.activeWars.some(w => w.status === 'active')
      : false,
    factionStability: bot.factionId
      ? worldState.factions[bot.factionId]?.stability || 0
      : 0,
    allyUnderAttack: findAllyUnderAttack(bot, worldState),
    
    canExpand: bot.militaryStrength > 1.2,
    weakTargets: findWeakTargets(bot, worldState),
    potentialAllies: findPotentialAllies(bot, worldState),
    betrayalOpportunity: assessBetrayalOpportunity(bot, worldState),
    
    playerThreatLevel: bot.memory.playerThreatLevel,
    playerRelation: determinePlayerRelation(bot, worldState)
  };
}

// ══════════════════════════════════════════
// MANEJADORES DE SITUACIÓN
// ══════════════════════════════════════════

function handleUnderAttack(
  bot: BotState, 
  context: BotContext,
  traits: PersonalityTraits
): BotDecision {
  // ¿Tengo aliados que puedan ayudar?
  if (bot.factionId && traits.loyalty > 0.4) {
    return {
      type: 'request_aid',
      targetId: bot.factionId,
      priority: 'critical',
      reason: 'Under attack, requesting faction support'
    };
  }
  
  // ¿Puedo defenderme solo?
  if (context.militaryStrength > 0.8) {
    return {
      type: 'defend',
      priority: 'high',
      reason: 'Defending against incoming attack'
    };
  }
  
  // ¿Debería rendirme o buscar alianza urgente?
  if (traits.riskTolerance < 0.3) {
    return {
      type: 'seek_emergency_alliance',
      targetId: context.potentialAllies[0],
      priority: 'critical',
      reason: 'Vulnerable, seeking protection'
    };
  }
  
  // Último recurso: defender con lo que hay
  return {
    type: 'defend',
    priority: 'high',
    reason: 'Defending despite odds'
  };
}

function shouldConsiderBetrayal(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): boolean {
  // Solo ROGUE considera traición frecuentemente
  if (bot.personality !== BotPersonality.ROGUE && Math.random() > 0.1) {
    return false;
  }
  
  // Factores que aumentan probabilidad de traición
  const factors = [
    context.factionStability < 30,          // Facción inestable
    context.betrayalOpportunity,            // Hay oportunidad clara
    traits.loyalty < 0.3,                   // Poca lealtad
    context.factionAtWar && context.militaryStrength < 0.5  // Perdiendo guerra
  ];
  
  const betrayalScore = factors.filter(Boolean).length / factors.length;
  return betrayalScore > 0.5;
}

function planBetrayal(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits,
  worldState: WorldState
): BotDecision | null {
  if (!bot.factionId) return null;
  
  // Encontrar facción enemiga que ofrezca mejor trato
  const currentFaction = bot.factionId;
  const enemyFactions = Object.values(worldState.factions)
    .filter(f => f.enemies.includes(currentFaction));
  
  if (enemyFactions.length === 0) return null;
  
  const bestOption = enemyFactions
    .sort((a, b) => b.power - a.power)[0];
  
  return {
    type: 'betray',
    currentFaction,
    targetFaction: bestOption.id,
    priority: 'high',
    reason: `Switching sides to ${bestOption.name} for better prospects`
  };
}

// ══════════════════════════════════════════
// INTERFACES DE DECISIÓN
// ══════════════════════════════════════════

export interface BotDecision {
  type: BotDecisionType;
  targetId?: string;
  currentFaction?: string;
  targetFaction?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  resources?: Partial<Record<ResourceType, number>>;
  army?: Partial<Record<UnitType, number>>;
  diplomaticAction?: DiplomaticAction;
  terms?: DealTerms;
}

export type BotDecisionType = 
  | 'defend'
  | 'attack'
  | 'request_aid'
  | 'seek_emergency_alliance'
  | 'revenge_attack'
  | 'contribute_to_war'
  | 'defend_ally'
  | 'betray'
  | 'expand_territory'
  | 'raid_resources'
  | 'propose_alliance'
  | 'propose_trade'
  | 'propose_non_aggression'
  | 'build_economy'
  | 'recruit_army'
  | 'upgrade_buildings'
  | 'research_tech'
  | 'idle';

export interface WorldState {
  botStates: Record<string, BotState>;
  factions: Record<string, Faction>;
  diplomacy: DiplomacyState;
  operations: Record<string, CoordinatedOperation>;
  incomingAttacks: IncomingAttack[];
  playerState: PlayerState;
  currentTime: number;
}

export interface IncomingAttack {
  attackerId: string;
  targetId: string;
  army: Record<UnitType, number>;
  arrivalTime: number;
}

export interface PlayerState {
  factionId: string | null;
  armyScore: number;
  resources: Record<ResourceType, number>;
  reputation: Record<string, number>;
}

// ══════════════════════════════════════════
// MANEJADORES DE SITUACIÓN (continuación)
// ══════════════════════════════════════════

function planRevenge(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): BotDecision | null {
  // Buscar al atacante más reciente que aún no haya sido castigado
  const unpunished = bot.memory.recentAttackers.filter(a => {
    // No atacar a alguien que ya castigamos
    return !bot.memory.recentAllies.some(ally => ally.allyId === a.attackerId);
  });
  
  if (unpunished.length === 0) return null;
  
  // Ordenar por daño recibido (priorizar al que más daño hizo)
  const target = unpunished.sort((a, b) => b.damageReceived - a.damageReceived)[0];
  
  // ¿Somos lo suficientemente fuertes para vengarnos?
  const targetBot = bot; // Se resuelve en el contexto real
  if (context.militaryStrength < 0.6 && traits.riskTolerance < 0.7) {
    // Demasiado débil, esperar
    return null;
  }
  
  return {
    type: 'revenge_attack',
    targetId: target.attackerId,
    priority: 'high',
    reason: `Revenge for ${target.damageReceived} damage received`
  };
}

function contributeToFactionWar(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): BotDecision {
  // Si la facción está en guerra, contribuir según lealtad
  if (traits.loyalty < 0.3 && context.militaryStrength < 0.5) {
    // Poca lealtad y débil: considerar desertar
    return {
      type: 'idle',
      priority: 'low',
      reason: 'Low loyalty, avoiding faction war contribution'
    };
  }
  
  // Contribuir al esfuerzo bélico
  if (context.militaryStrength > 1.0) {
    return {
      type: 'contribute_to_war',
      priority: 'high',
      reason: 'Strong enough to contribute to faction war'
    };
  }
  
  // Construir ejército para contribuir después
  return {
    type: 'recruit_army',
    priority: 'medium',
    reason: 'Building army for faction war effort'
  };
}

function defendAlly(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): BotDecision {
  if (!context.allyUnderAttack) {
    return {
      type: 'idle',
      priority: 'low',
      reason: 'No ally needs defense'
    };
  }
  
  // Evaluar si podemos ayudar
  if (context.militaryStrength > 0.7) {
    return {
      type: 'defend_ally',
      targetId: context.allyUnderAttack,
      priority: 'high',
      reason: `Defending ally under attack (loyalty: ${traits.loyalty.toFixed(2)})`
    };
  }
  
  // Pedir ayuda a otros aliados
  return {
    type: 'request_aid',
    targetId: bot.factionId || '',
    priority: 'high',
    reason: 'Cannot defend ally alone, requesting faction support'
  };
}

function planExpansion(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): BotDecision | null {
  if (context.weakTargets.length === 0) return null;
  
  // Seleccionar objetivo más débil y rico
  const bestTarget = context.weakTargets[0];
  
  // Verificar que no sea un aliado
  if (bot.memory.recentAllies.some(a => a.allyId === bestTarget)) {
    return null;
  }
  
  return {
    type: 'raid_resources',
    targetId: bestTarget,
    priority: 'medium',
    reason: 'Expanding territory by raiding weak target'
  };
}

function shouldSeekDiplomacy(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): boolean {
  // Los diplomáticos buscan alianzas frecuentemente
  if (traits.diplomacy > 0.6) return true;
  
  // Los vulnerables buscan protección
  if (context.isVulnerable && !bot.factionId) return true;
  
  // Los ambiciosos buscan alianzas para escalar
  if (bot.ambition > 0.7 && context.potentialAllies.length > 0) return true;
  
  return Math.random() < traits.diplomacy * 0.3;
}

function planDiplomacy(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): BotDecision {
  // ¿Necesita facción?
  if (!bot.factionId && context.potentialAllies.length > 0) {
    return {
      type: 'propose_alliance',
      targetId: context.potentialAllies[0],
      priority: 'medium',
      reason: 'Seeking faction membership for protection and growth'
    };
  }
  
  // ¿Buscar acuerdos comerciales?
  if (traits.greed > 0.5) {
    const tradePartner = context.potentialAllies.find(id => 
      !bot.memory.betrayals.some(b => b.traitorId === id)
    );
    if (tradePartner) {
      return {
        type: 'propose_trade',
        targetId: tradePartner,
        priority: 'low',
        reason: 'Seeking profitable trade agreement'
      };
    }
  }
  
  // Pacto de no agresión con vecinos fuertes
  if (context.isVulnerable) {
    const strongNeighbor = context.weakTargets.length > 0 
      ? undefined 
      : context.potentialAllies[0];
    if (strongNeighbor) {
      return {
        type: 'propose_non_aggression',
        targetId: strongNeighbor,
        priority: 'medium',
        reason: 'Seeking non-aggression pact with stronger neighbor'
      };
    }
  }
  
  // Default: desarrollo económico
  return planEconomicDevelopment(bot, context, traits);
}

function planEconomicDevelopment(
  bot: BotState,
  context: BotContext,
  traits: PersonalityTraits
): BotDecision {
  // Priorizar según necesidades
  const totalResources = Object.values(bot.resources).reduce((a, b) => a + b, 0);
  
  // Si tiene pocos recursos, construir economía
  if (totalResources < 5000) {
    return {
      type: 'build_economy',
      priority: 'medium',
      reason: 'Low resources, focusing on economic development'
    };
  }
  
  // Si tiene recursos pero poco ejército, reclutar
  if (context.militaryStrength < 0.8 && traits.aggression > 0.3) {
    return {
      type: 'recruit_army',
      priority: 'medium',
      reason: 'Building military capacity'
    };
  }
  
  // Si tiene recursos y ejército, mejorar edificios
  if (totalResources > 15000) {
    return {
      type: 'upgrade_buildings',
      priority: 'low',
      reason: 'Upgrading infrastructure with surplus resources'
    };
  }
  
  // Si todo está bien, investigar tecnología
  if (traits.patience > 0.5) {
    return {
      type: 'research_tech',
      priority: 'low',
      reason: 'Investing in long-term technology advantages'
    };
  }
  
  return {
    type: 'build_economy',
    priority: 'low',
    reason: 'Default economic development'
  };
}

// ══════════════════════════════════════════
// FUNCIONES AUXILIARES
// ══════════════════════════════════════════

function calculateAverageMilitary(worldState: WorldState): number {
  const bots = Object.values(worldState.botStates);
  if (bots.length === 0) return 1;
  return bots.reduce((sum, b) => sum + b.armyScore, 0) / bots.length;
}

function calculateAverageEconomic(worldState: WorldState): number {
  const bots = Object.values(worldState.botStates);
  if (bots.length === 0) return 1;
  return bots.reduce((sum, b) => sum + getTotalResources(b), 0) / bots.length;
}

function getTotalResources(bot: BotState): number {
  return Object.values(bot.resources).reduce((sum, val) => sum + val, 0);
}

function findAllyUnderAttack(bot: BotState, worldState: WorldState): string | null {
  if (!bot.factionId) return null;
  
  const faction = worldState.factions[bot.factionId];
  if (!faction) return null;
  
  const allMembers = [...faction.memberIds, ...faction.officerIds, faction.leaderId];
  
  for (const memberId of allMembers) {
    if (memberId === bot.id) continue;
    const isUnderAttack = worldState.incomingAttacks?.some(a => a.targetId === memberId);
    if (isUnderAttack) return memberId;
  }
  
  return null;
}

function findWeakTargets(bot: BotState, worldState: WorldState): string[] {
  return Object.values(worldState.botStates)
    .filter(target => {
      if (target.id === bot.id) return false;
      // No atacar aliados de facción
      if (bot.factionId && target.factionId === bot.factionId) return false;
      // Debe ser significativamente más débil
      return target.armyScore < bot.armyScore * 0.6;
    })
    .sort((a, b) => a.armyScore - b.armyScore)
    .slice(0, 5)
    .map(t => t.id);
}

function findPotentialAllies(bot: BotState, worldState: WorldState): string[] {
  return Object.values(worldState.botStates)
    .filter(candidate => {
      if (candidate.id === bot.id) return false;
      if (candidate.factionId && bot.factionId === candidate.factionId) return false;
      // No considerar traidores
      if (bot.memory.betrayals.some(b => b.traitorId === candidate.id)) return false;
      // Reputación mínima positiva
      const rep = bot.reputation[candidate.id] || 0;
      return rep >= -10;
    })
    .sort((a, b) => {
      const repA = bot.reputation[a.id] || 0;
      const repB = bot.reputation[b.id] || 0;
      return repB - repA;
    })
    .slice(0, 3)
    .map(c => c.id);
}

function assessBetrayalOpportunity(bot: BotState, worldState: WorldState): boolean {
  if (!bot.factionId) return false;
  
  const faction = worldState.factions[bot.factionId];
  if (!faction) return false;
  
  // Oportunidad si la facción está débil y hay mejor opción
  const factionWeak = faction.stability < 30;
  const betterOptions = Object.values(worldState.factions)
    .filter(f => f.id !== bot.factionId && f.power > faction.power * 1.5);
  
  return factionWeak && betterOptions.length > 0;
}

function determinePlayerRelation(
  bot: BotState, 
  worldState: WorldState
): 'ally' | 'neutral' | 'enemy' {
  if (bot.playerReputation > 50) return 'ally';
  if (bot.playerReputation < -50) return 'enemy';
  
  // Verificar si están en facciones enemigas
  if (bot.factionId && worldState.playerState.factionId) {
    const botFaction = worldState.factions[bot.factionId];
    if (botFaction?.enemies.includes(worldState.playerState.factionId)) {
      return 'enemy';
    }
    if (botFaction?.allies.includes(worldState.playerState.factionId)) {
      return 'ally';
    }
  }
  
  return 'neutral';
}
```

### 4.2 Pesos de Personalidad

**Archivo: `utils/ai/personalityWeights.ts`**

```typescript
/**
 * Configuración de personalidades de bots
 * 
 * Cada rasgo va de 0.0 a 1.0
 */

export interface PersonalityTraits {
  // Comportamiento militar
  aggression: number;       // Tendencia a atacar
  riskTolerance: number;    // Disposición a tomar riesgos
  revenge: number;          // Importancia de la venganza
  
  // Comportamiento social
  loyalty: number;          // Lealtad a aliados/facción
  diplomacy: number;        // Preferencia por soluciones diplomáticas
  greed: number;            // Importancia de recursos/ganancias
  
  // Comportamiento estratégico
  patience: number;         // Capacidad de esperar el momento correcto
  adaptability: number;     // Capacidad de cambiar estrategia
  opportunism: number;      // Aprovechar oportunidades
}

export const PERSONALITY_WEIGHTS: Record<BotPersonality, PersonalityTraits> = {
  [BotPersonality.WARLORD]: {
    aggression: 0.9,
    riskTolerance: 0.8,
    revenge: 0.95,
    loyalty: 0.4,
    diplomacy: 0.2,
    greed: 0.5,
    patience: 0.2,
    adaptability: 0.4,
    opportunism: 0.6
  },
  
  [BotPersonality.TURTLE]: {
    aggression: 0.2,
    riskTolerance: 0.2,
    revenge: 0.6,
    loyalty: 0.9,
    diplomacy: 0.7,
    greed: 0.3,
    patience: 0.95,
    adaptability: 0.5,
    opportunism: 0.3
  },
  
  [BotPersonality.TYCOON]: {
    aggression: 0.3,
    riskTolerance: 0.5,
    revenge: 0.3,
    loyalty: 0.6,
    diplomacy: 0.8,
    greed: 0.95,
    patience: 0.7,
    adaptability: 0.8,
    opportunism: 0.7
  },
  
  [BotPersonality.ROGUE]: {
    aggression: 0.6,
    riskTolerance: 0.9,
    revenge: 0.5,
    loyalty: 0.1,
    diplomacy: 0.4,
    greed: 0.8,
    patience: 0.3,
    adaptability: 0.95,
    opportunism: 0.95
  }
};

/**
 * Descripciones de comportamiento para UI/tooltips
 */
export const PERSONALITY_DESCRIPTIONS: Record<BotPersonality, string> = {
  [BotPersonality.WARLORD]: 
    "Agresivo y vengativo. Ataca rápido y no olvida las ofensas. " +
    "Busca alianzas para conquistar, pero puede abandonarlas si conviene.",
  
  [BotPersonality.TURTLE]: 
    "Defensivo y leal. Prefiere construir en paz y solo ataca si es provocado. " +
    "Excelente aliado, pero lento para actuar. Cuando ataca, lo hace con fuerza.",
  
  [BotPersonality.TYCOON]: 
    "Enfocado en la economía. Prefiere comerciar antes que luchar. " +
    "Busca acuerdos beneficiosos y evita conflictos costosos.",
  
  [BotPersonality.ROGUE]: 
    "Impredecible y oportunista. Puede ser tu mejor aliado un momento " +
    "y traicionarte al siguiente. Muy peligroso pero útil si sabes manejarlo."
};
```

### 4.3 Selección de Objetivos

**Archivo: `utils/ai/targetSelection.ts`**

```typescript
/**
 * Sistema de Selección de Objetivos
 * 
 * Determina a quién atacar basado en múltiples factores
 */

export interface TargetScore {
  targetId: string;
  score: number;
  reasons: string[];
}

export function selectAttackTarget(
  bot: BotState,
  candidates: string[],
  worldState: WorldState,
  traits: PersonalityTraits
): TargetScore | null {
  if (candidates.length === 0) return null;
  
  const scores: TargetScore[] = candidates.map(candidateId => {
    const candidate = worldState.botStates[candidateId];
    const reasons: string[] = [];
    let score = 0;
    
    // ─────────────────────────────────────────
    // FACTOR: Venganza
    // ─────────────────────────────────────────
    if (bot.memory.recentAttackers.some(a => a.attackerId === candidateId)) {
      const revengeScore = 50 * traits.revenge;
      score += revengeScore;
      reasons.push(`Revenge target (+${revengeScore.toFixed(0)})`);
    }
    
    // ─────────────────────────────────────────
    // FACTOR: Debilidad del objetivo
    // ─────────────────────────────────────────
    const strengthRatio = bot.armyScore / (candidate?.armyScore || 1);
    if (strengthRatio > 1.5) {
      const weaknessScore = 30 * traits.opportunism;
      score += weaknessScore;
      reasons.push(`Weak target (+${weaknessScore.toFixed(0)})`);
    }
    
    // ─────────────────────────────────────────
    // FACTOR: Riqueza del objetivo
    // ─────────────────────────────────────────
    const targetWealth = getTotalResources(candidate);
    if (targetWealth > 10000) {
      const wealthScore = 20 * traits.greed;
      score += wealthScore;
      reasons.push(`Rich target (+${wealthScore.toFixed(0)})`);
    }
    
    // ─────────────────────────────────────────
    // FACTOR: Enemigo de facción
    // ─────────────────────────────────────────
    if (bot.factionId && candidate?.factionId) {
      const myFaction = worldState.factions[bot.factionId];
      if (myFaction?.enemies.includes(candidate.factionId)) {
        const factionScore = 40 * traits.loyalty;
        score += factionScore;
        reasons.push(`Faction enemy (+${factionScore.toFixed(0)})`);
      }
    }
    
    // ─────────────────────────────────────────
    // FACTOR: Sin alianzas (objetivo fácil)
    // ─────────────────────────────────────────
    if (!candidate?.factionId) {
      const isolatedScore = 15 * traits.opportunism;
      score += isolatedScore;
      reasons.push(`Isolated target (+${isolatedScore.toFixed(0)})`);
    }
    
    // ─────────────────────────────────────────
    // PENALIZACIÓN: Aliado
    // ─────────────────────────────────────────
    if (bot.memory.recentAllies.some(a => a.allyId === candidateId)) {
      const allyPenalty = -100 * traits.loyalty;
      score += allyPenalty;
      reasons.push(`Ally (${allyPenalty.toFixed(0)})`);
    }
    
    // ─────────────────────────────────────────
    // PENALIZACIÓN: Muy fuerte
    // ─────────────────────────────────────────
    if (strengthRatio < 0.7) {
      const dangerPenalty = -50 * (1 - traits.riskTolerance);
      score += dangerPenalty;
      reasons.push(`Dangerous (${dangerPenalty.toFixed(0)})`);
    }
    
    return { targetId: candidateId, score, reasons };
  });
  
  // Ordenar por score y retornar el mejor
  scores.sort((a, b) => b.score - a.score);
  
  // Solo atacar si el score es positivo
  return scores[0]?.score > 0 ? scores[0] : null;
}

/**
 * Selecciona objetivo para el jugador específicamente
 */
export function shouldTargetPlayer(
  bot: BotState,
  playerState: PlayerState,
  worldState: WorldState,
  traits: PersonalityTraits
): { should: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  
  // Venganza contra el jugador
  if (bot.memory.playerActions.some(a => a.action === 'attack')) {
    const revengeScore = 60 * traits.revenge;
    score += revengeScore;
    reasons.push(`Player attacked us (+${revengeScore.toFixed(0)})`);
  }
  
  // El jugador traicionó
  if (bot.memory.playerActions.some(a => a.action === 'betray')) {
    score += 100;
    reasons.push('Player betrayed us (+100)');
  }
  
  // El jugador es amenaza
  if (bot.memory.playerThreatLevel > 50) {
    const threatScore = bot.memory.playerThreatLevel * traits.aggression * 0.5;
    score += threatScore;
    reasons.push(`High threat level (+${threatScore.toFixed(0)})`);
  }
  
  // Facción enemiga del jugador
  if (bot.factionId && playerState.factionId) {
    const myFaction = worldState.factions[bot.factionId];
    if (myFaction?.enemies.includes(playerState.factionId)) {
      score += 50;
      reasons.push('Player faction is enemy (+50)');
    }
  }
  
  // Oportunidad: jugador débil
  const strengthRatio = bot.armyScore / playerState.armyScore;
  if (strengthRatio > 2) {
    const oppScore = 30 * traits.opportunism;
    score += oppScore;
    reasons.push(`Player is weak (+${oppScore.toFixed(0)})`);
  }
  
  // Penalización: aliado
  if (bot.memory.playerActions.some(a => a.action === 'alliance' || a.action === 'help')) {
    const allyPenalty = -80 * traits.loyalty;
    score += allyPenalty;
    reasons.push(`Player is ally (${allyPenalty.toFixed(0)})`);
  }
  
  return {
    should: score > 30,
    score,
    reasons
  };
}
```

### 4.4 Archivos a Crear/Modificar - Fase 4

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `utils/ai/decisionEngine.ts` | **CREAR** | Motor de decisiones principal |
| `utils/ai/personalityWeights.ts` | **CREAR** | Configuración de personalidades |
| `utils/ai/targetSelection.ts` | **CREAR** | Lógica de selección de objetivos |
| `utils/ai/diplomaticAI.ts` | **CREAR** | IA para decisiones diplomáticas |
| `utils/ai/index.ts` | **CREAR** | Exportaciones del módulo de IA |

### 4.5 IA Diplomática

**Archivo: `utils/ai/diplomaticAI.ts`**

```typescript
/**
 * IA Diplomática
 * 
 * Gestiona las decisiones diplomáticas autónomas de los bots:
 * cuándo proponer alianzas, comerciar, amenazar o rendirse.
 */

import { BotState, BotPersonality, BotGoal } from '../../types/bot';
import { 
  DiplomaticAction, DiplomaticProposal, DealTerms, 
  ActiveTreaty, TreatyType 
} from '../../types/diplomacy';
import { Faction, FactionIdeology } from '../../types/faction';
import { PERSONALITY_WEIGHTS, PersonalityTraits } from './personalityWeights';
import { REPUTATION_THRESHOLDS } from '../engine/reputation';
import { WorldState } from './decisionEngine';

// ══════════════════════════════════════════
// GENERACIÓN DE PROPUESTAS DIPLOMÁTICAS
// ══════════════════════════════════════════

/**
 * Genera propuestas diplomáticas que un bot debería enviar
 * Se ejecuta periódicamente para cada bot
 */
export function generateDiplomaticProposals(
  bot: BotState,
  worldState: WorldState
): DiplomaticProposal[] {
  const traits = PERSONALITY_WEIGHTS[bot.personality];
  const proposals: DiplomaticProposal[] = [];
  
  // Limitar propuestas activas para no spamear
  const activePendingCount = bot.memory.pendingProposals.length;
  if (activePendingCount >= 3) return [];
  
  // ─────────────────────────────────────────
  // BUSCAR ALIANZAS (si no tiene facción)
  // ─────────────────────────────────────────
  if (!bot.factionId && traits.diplomacy > 0.4) {
    const allianceTarget = findAllianceTarget(bot, worldState, traits);
    if (allianceTarget) {
      proposals.push(createDiplomaticProposal(
        bot,
        allianceTarget,
        DiplomaticAction.PROPOSE_ALLIANCE,
        { duration: 0, conditions: [{ type: 'mutual_defense', description: 'Mutual defense pact' }] }
      ));
    }
  }
  
  // ─────────────────────────────────────────
  // PROPONER COMERCIO (si tiene exceso de recursos)
  // ─────────────────────────────────────────
  if (traits.greed > 0.4) {
    const tradeTarget = findTradeTarget(bot, worldState, traits);
    if (tradeTarget) {
      const terms = generateTradeTerms(bot, tradeTarget, worldState);
      if (terms) {
        proposals.push(createDiplomaticProposal(
          bot,
          tradeTarget,
          DiplomaticAction.PROPOSE_TRADE_DEAL,
          terms
        ));
      }
    }
  }
  
  // ─────────────────────────────────────────
  // OFRECER TRIBUTO (si está amenazado)
  // ─────────────────────────────────────────
  if (bot.memory.recentAttackers.length > 0 && traits.riskTolerance < 0.4) {
    const strongAttacker = findStrongestAttacker(bot, worldState);
    if (strongAttacker) {
      const tributeAmount = calculateTributeAmount(bot, strongAttacker, worldState);
      proposals.push(createDiplomaticProposal(
        bot,
        strongAttacker,
        DiplomaticAction.OFFER_TRIBUTE,
        { resourcesOffered: tributeAmount }
      ));
    }
  }
  
  // ─────────────────────────────────────────
  // AMENAZAR (si es fuerte y agresivo)
  // ─────────────────────────────────────────
  if (traits.aggression > 0.7 && bot.armyScore > 5000) {
    const threatTarget = findThreatTarget(bot, worldState, traits);
    if (threatTarget) {
      proposals.push(createDiplomaticProposal(
        bot,
        threatTarget,
        DiplomaticAction.DEMAND_TRIBUTE,
        { 
          tributePercentage: 10 + Math.floor(traits.greed * 20),
          tributeFrequency: 60 * 60 * 1000 // Cada hora
        }
      ));
    }
  }
  
  // ─────────────────────────────────────────
  // PROPONER ALTO AL FUEGO (si está perdiendo guerra)
  // ─────────────────────────────────────────
  if (bot.factionId) {
    const faction = worldState.factions[bot.factionId];
    if (faction) {
      const losingWar = faction.activeWars.find(w => 
        w.status === 'active' && w.currentScore.them > w.currentScore.us * 1.5
      );
      if (losingWar && traits.patience > 0.4) {
        proposals.push(createDiplomaticProposal(
          bot,
          losingWar.enemyFactionId,
          DiplomaticAction.OFFER_CEASEFIRE,
          { duration: 2 * 60 * 60 * 1000 } // 2 horas de alto al fuego
        ));
      }
    }
  }
  
  // ─────────────────────────────────────────
  // INVITAR A FACCIÓN (si es líder/oficial)
  // ─────────────────────────────────────────
  if (bot.factionId && (bot.factionRole === 'LEADER' || bot.factionRole === 'OFFICER')) {
    const faction = worldState.factions[bot.factionId];
    if (faction && faction.memberIds.length < 12) {
      const recruitTarget = findRecruitTarget(bot, faction, worldState, traits);
      if (recruitTarget) {
        proposals.push(createDiplomaticProposal(
          bot,
          recruitTarget,
          DiplomaticAction.INVITE_TO_FACTION,
          { conditions: [{ type: 'mutual_defense', description: `Join ${faction.name}` }] }
        ));
      }
    }
  }
  
  return proposals;
}

// ══════════════════════════════════════════
// FUNCIONES DE BÚSQUEDA DE OBJETIVOS
// ══════════════════════════════════════════

function findAllianceTarget(
  bot: BotState, 
  worldState: WorldState, 
  traits: PersonalityTraits
): string | null {
  const candidates = Object.values(worldState.botStates)
    .filter(candidate => {
      if (candidate.id === bot.id) return false;
      if (candidate.factionId) return false; // Ya está en facción
      // No considerar traidores
      if (bot.memory.betrayals.some(b => b.traitorId === candidate.id)) return false;
      // Reputación aceptable
      const rep = bot.reputation[candidate.id] || 0;
      return rep >= REPUTATION_THRESHOLDS.NEUTRAL;
    })
    .sort((a, b) => {
      const repA = bot.reputation[a.id] || 0;
      const repB = bot.reputation[b.id] || 0;
      return repB - repA;
    });
  
  return candidates.length > 0 ? candidates[0].id : null;
}

function findTradeTarget(
  bot: BotState, 
  worldState: WorldState, 
  traits: PersonalityTraits
): string | null {
  const candidates = Object.values(worldState.botStates)
    .filter(candidate => {
      if (candidate.id === bot.id) return false;
      // Preferir aliados de facción o bots con buena reputación
      const rep = bot.reputation[candidate.id] || 0;
      return rep >= REPUTATION_THRESHOLDS.NEUTRAL;
    })
    .sort((a, b) => {
      // Priorizar por compatibilidad de recursos (complementarios)
      const complementA = calculateResourceComplementarity(bot, a);
      const complementB = calculateResourceComplementarity(bot, b);
      return complementB - complementA;
    });
  
  return candidates.length > 0 ? candidates[0].id : null;
}

function findStrongestAttacker(
  bot: BotState, 
  worldState: WorldState
): string | null {
  if (bot.memory.recentAttackers.length === 0) return null;
  
  const attackers = bot.memory.recentAttackers
    .map(a => worldState.botStates[a.attackerId])
    .filter(Boolean)
    .sort((a, b) => b.armyScore - a.armyScore);
  
  return attackers.length > 0 ? attackers[0].id : null;
}

function findThreatTarget(
  bot: BotState, 
  worldState: WorldState, 
  traits: PersonalityTraits
): string | null {
  return Object.values(worldState.botStates)
    .filter(target => {
      if (target.id === bot.id) return false;
      if (target.factionId === bot.factionId && bot.factionId) return false;
      // Solo amenazar a los más débiles
      return target.armyScore < bot.armyScore * 0.5;
    })
    .sort((a, b) => {
      // Priorizar los más ricos y débiles
      const valueA = Object.values(a.resources).reduce((s, v) => s + v, 0) / (a.armyScore || 1);
      const valueB = Object.values(b.resources).reduce((s, v) => s + v, 0) / (b.armyScore || 1);
      return valueB - valueA;
    })
    .map(t => t.id)[0] || null;
}

function findRecruitTarget(
  bot: BotState, 
  faction: Faction, 
  worldState: WorldState, 
  traits: PersonalityTraits
): string | null {
  return Object.values(worldState.botStates)
    .filter(candidate => {
      if (candidate.id === bot.id) return false;
      if (candidate.factionId) return false; // Ya está en facción
      // Compatible ideológicamente
      const compatible = isPersonalityCompatibleWithIdeology(candidate.personality, faction.ideology);
      // No es enemigo
      const notEnemy = (bot.reputation[candidate.id] || 0) >= REPUTATION_THRESHOLDS.SUSPICIOUS;
      return compatible && notEnemy;
    })
    .sort((a, b) => b.armyScore - a.armyScore) // Reclutar fuertes primero
    .map(c => c.id)[0] || null;
}

// ══════════════════════════════════════════
// UTILIDADES
// ══════════════════════════════════════════

function calculateResourceComplementarity(botA: BotState, botB: BotState): number {
  let complementarity = 0;
  const resourceTypes = Object.keys(botA.resources) as ResourceType[];
  
  for (const resource of resourceTypes) {
    const aHas = botA.resources[resource] || 0;
    const bHas = botB.resources[resource] || 0;
    // Mayor complementariedad cuando uno tiene mucho y el otro poco
    complementarity += Math.abs(aHas - bHas);
  }
  
  return complementarity;
}

function calculateTributeAmount(
  bot: BotState, 
  targetId: string, 
  worldState: WorldState
): Partial<Record<ResourceType, number>> {
  const tribute: Partial<Record<ResourceType, number>> = {};
  
  // Ofrecer 10-20% de recursos como tributo
  for (const [resource, amount] of Object.entries(bot.resources)) {
    if (amount > 100) {
      tribute[resource as ResourceType] = Math.floor(amount * 0.15);
    }
  }
  
  return tribute;
}

function generateTradeTerms(
  bot: BotState, 
  targetId: string, 
  worldState: WorldState
): DealTerms | null {
  const target = worldState.botStates[targetId];
  if (!target) return null;
  
  // Encontrar recurso que nos sobra y le falta al target
  const resourceTypes = Object.keys(bot.resources) as ResourceType[];
  let bestOffer: ResourceType | null = null;
  let bestRequest: ResourceType | null = null;
  let bestRatio = 0;
  
  for (const res of resourceTypes) {
    const ourAmount = bot.resources[res] || 0;
    const theirAmount = target.resources[res] || 0;
    
    if (ourAmount > theirAmount * 2 && ourAmount > 500) {
      if (!bestOffer || ourAmount > (bot.resources[bestOffer] || 0)) {
        bestOffer = res;
      }
    }
    if (theirAmount > ourAmount * 2 && theirAmount > 500) {
      if (!bestRequest || theirAmount > (target.resources[bestRequest] || 0)) {
        bestRequest = res;
      }
    }
  }
  
  if (!bestOffer || !bestRequest) return null;
  
  const offerAmount = Math.floor((bot.resources[bestOffer] || 0) * 0.2);
  const requestAmount = Math.floor((target.resources[bestRequest] || 0) * 0.15);
  
  return {
    resourcesOffered: { [bestOffer]: offerAmount },
    resourcesRequested: { [bestRequest]: requestAmount },
    duration: 60 * 60 * 1000 // 1 hora de acuerdo comercial
  };
}

function isPersonalityCompatibleWithIdeology(
  personality: BotPersonality, 
  ideology: FactionIdeology
): boolean {
  const COMPAT: Record<BotPersonality, FactionIdeology[]> = {
    [BotPersonality.WARLORD]: [FactionIdeology.MILITARIST, FactionIdeology.EXPANSIONIST],
    [BotPersonality.TURTLE]: [FactionIdeology.ISOLATIONIST, FactionIdeology.MERCANTILE],
    [BotPersonality.TYCOON]: [FactionIdeology.MERCANTILE, FactionIdeology.OPPORTUNIST],
    [BotPersonality.ROGUE]: [FactionIdeology.OPPORTUNIST, FactionIdeology.EXPANSIONIST]
  };
  
  return COMPAT[personality]?.includes(ideology) || false;
}

function createDiplomaticProposal(
  bot: BotState,
  targetId: string,
  action: DiplomaticAction,
  terms: DealTerms
): DiplomaticProposal {
  const PROPOSAL_DURATION = 30 * 60 * 1000;
  
  return {
    id: `proposal_${bot.id}_${Date.now()}`,
    type: action,
    fromId: bot.id,
    fromType: 'bot',
    toId: targetId,
    toType: 'bot',
    terms,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + PROPOSAL_DURATION
  };
}

// ══════════════════════════════════════════
// RESPUESTA A PROPUESTAS DEL JUGADOR
// ══════════════════════════════════════════

/**
 * Evalúa una propuesta del jugador con más detalle
 * que la evaluación genérica entre bots
 */
export function evaluatePlayerProposal(
  proposal: DiplomaticProposal,
  bot: BotState,
  worldState: WorldState
): { 
  decision: 'accept' | 'reject' | 'counter'; 
  reason: string; 
  responseMessage: string;
  counterTerms?: DealTerms 
} {
  const traits = PERSONALITY_WEIGHTS[bot.personality];
  const playerRep = bot.playerReputation;
  
  // ─────────────────────────────────────────
  // RECHAZO AUTOMÁTICO
  // ─────────────────────────────────────────
  
  // Si el jugador nos traicionó antes
  if (bot.memory.playerActions.some(a => a.action === 'betray')) {
    return {
      decision: 'reject',
      reason: 'Player betrayed us before',
      responseMessage: getPersonalityResponse(bot.personality, 'betrayal_reject')
    };
  }
  
  // Si la reputación es muy baja
  if (playerRep < REPUTATION_THRESHOLDS.HOSTILE && traits.revenge > 0.5) {
    return {
      decision: 'reject',
      reason: 'Player reputation too low',
      responseMessage: getPersonalityResponse(bot.personality, 'hostile_reject')
    };
  }
  
  // ─────────────────────────────────────────
  // EVALUACIÓN POR TIPO
  // ─────────────────────────────────────────
  
  switch (proposal.type) {
    case DiplomaticAction.PROPOSE_ALLIANCE:
      return evaluateAllianceFromPlayer(bot, worldState, traits, playerRep);
    
    case DiplomaticAction.PROPOSE_TRADE_DEAL:
      return evaluateTradeFromPlayer(bot, proposal.terms, traits, playerRep);
    
    case DiplomaticAction.OFFER_TRIBUTE:
      return {
        decision: 'accept',
        reason: 'Tributes are always welcome',
        responseMessage: getPersonalityResponse(bot.personality, 'tribute_accept')
      };
    
    case DiplomaticAction.OFFER_CEASEFIRE:
      return evaluateCeasefireFromPlayer(bot, worldState, traits);
    
    default:
      return {
        decision: 'reject',
        reason: 'Unknown proposal type',
        responseMessage: 'We are not interested at this time.'
      };
  }
}

function evaluateAllianceFromPlayer(
  bot: BotState,
  worldState: WorldState,
  traits: PersonalityTraits,
  playerRep: number
): { decision: 'accept' | 'reject' | 'counter'; reason: string; responseMessage: string } {
  let chance = 0.3;
  
  chance += playerRep / 200; // -0.5 a +0.5
  chance += traits.diplomacy * 0.2;
  
  // Bonus si estamos amenazados
  if (bot.memory.recentAttackers.length > 2) chance += 0.2;
  
  if (Math.random() < chance) {
    return {
      decision: 'accept',
      reason: 'Alliance beneficial',
      responseMessage: getPersonalityResponse(bot.personality, 'alliance_accept')
    };
  }
  
  return {
    decision: 'reject',
    reason: 'Not ready for alliance',
    responseMessage: getPersonalityResponse(bot.personality, 'alliance_reject')
  };
}

function evaluateTradeFromPlayer(
  bot: BotState,
  terms: DealTerms,
  traits: PersonalityTraits,
  playerRep: number
): { decision: 'accept' | 'reject' | 'counter'; reason: string; responseMessage: string; counterTerms?: DealTerms } {
  // Calcular valor del trato
  const offeredValue = terms.resourcesOffered 
    ? Object.values(terms.resourcesOffered).reduce((s, v) => s + (v || 0), 0) 
    : 0;
  const requestedValue = terms.resourcesRequested 
    ? Object.values(terms.resourcesRequested).reduce((s, v) => s + (v || 0), 0) 
    : 0;
  
  const ratio = requestedValue > 0 ? offeredValue / requestedValue : Infinity;
  
  // Tycoons son más exigentes con el valor
  const minRatio = traits.greed > 0.7 ? 0.8 : 0.5;
  
  if (ratio >= minRatio) {
    return {
      decision: 'accept',
      reason: 'Fair trade deal',
      responseMessage: getPersonalityResponse(bot.personality, 'trade_accept')
    };
  }
  
  // Contraoferta
  if (ratio >= minRatio * 0.5) {
    return {
      decision: 'counter',
      reason: 'Trade needs better terms',
      responseMessage: getPersonalityResponse(bot.personality, 'trade_counter'),
      counterTerms: {
        ...terms,
        resourcesRequested: terms.resourcesRequested 
          ? Object.fromEntries(
              Object.entries(terms.resourcesRequested).map(([k, v]) => [k, Math.floor((v || 0) * 0.7)])
            )
          : undefined
      }
    };
  }
  
  return {
    decision: 'reject',
    reason: 'Trade too unfavorable',
    responseMessage: getPersonalityResponse(bot.personality, 'trade_reject')
  };
}

function evaluateCeasefireFromPlayer(
  bot: BotState,
  worldState: WorldState,
  traits: PersonalityTraits
): { decision: 'accept' | 'reject' | 'counter'; reason: string; responseMessage: string } {
  // Aceptar si estamos perdiendo o si somos pacíficos
  if (traits.aggression < 0.5 || bot.armyScore < 1000) {
    return {
      decision: 'accept',
      reason: 'Ceasefire beneficial',
      responseMessage: getPersonalityResponse(bot.personality, 'ceasefire_accept')
    };
  }
  
  // Rechazar si somos dominantes
  if (bot.armyScore > 5000 && traits.aggression > 0.7) {
    return {
      decision: 'reject',
      reason: 'We are winning, no ceasefire needed',
      responseMessage: getPersonalityResponse(bot.personality, 'ceasefire_reject')
    };
  }
  
  return {
    decision: 'accept',
    reason: 'Ceasefire acceptable',
    responseMessage: 'We agree to a temporary ceasefire.'
  };
}

// ══════════════════════════════════════════
// MENSAJES DE RESPUESTA POR PERSONALIDAD
// ══════════════════════════════════════════

type ResponseKey = 
  | 'betrayal_reject' | 'hostile_reject'
  | 'alliance_accept' | 'alliance_reject'
  | 'trade_accept' | 'trade_reject' | 'trade_counter'
  | 'tribute_accept'
  | 'ceasefire_accept' | 'ceasefire_reject';

const PERSONALITY_RESPONSES: Record<BotPersonality, Record<ResponseKey, string>> = {
  [BotPersonality.WARLORD]: {
    betrayal_reject: "You dare approach me after your treachery? Leave before I crush you.",
    hostile_reject: "I have no interest in dealing with weaklings.",
    alliance_accept: "Your strength has proven worthy. Together we will conquer.",
    alliance_reject: "I fight alone. Prove yourself in battle first.",
    trade_accept: "These terms are acceptable. Do not test my patience.",
    trade_reject: "This deal insults me. Come back with something worthy.",
    trade_counter: "Your offer is weak. Here are MY terms.",
    tribute_accept: "Smart move. Your tribute buys you another day.",
    ceasefire_accept: "I will pause... for now. Do not mistake this for mercy.",
    ceasefire_reject: "Ceasefire? I smell victory. No quarter given."
  },
  [BotPersonality.TURTLE]: {
    betrayal_reject: "Trust, once broken, cannot be repaired. Please leave.",
    hostile_reject: "I'm sorry, but our history makes this impossible.",
    alliance_accept: "I believe in building strong partnerships. Welcome, friend.",
    alliance_reject: "I appreciate the offer, but I need more time to consider.",
    trade_accept: "A fair deal benefits everyone. Agreed.",
    trade_reject: "I'm afraid these terms don't work for me.",
    trade_counter: "Could we adjust the terms slightly? I think this would be fairer.",
    tribute_accept: "Thank you for the generous gift. I won't forget this.",
    ceasefire_accept: "Peace is always the wisest choice. I accept.",
    ceasefire_reject: "I cannot accept until our people are safe."
  },
  [BotPersonality.TYCOON]: {
    betrayal_reject: "Bad business. I don't deal with unreliable partners.",
    hostile_reject: "The numbers don't add up. Not interested.",
    alliance_accept: "Excellent! This partnership will be very profitable.",
    alliance_reject: "I need to see the ROI on this alliance first.",
    trade_accept: "Deal! Pleasure doing business with you.",
    trade_reject: "Not profitable enough. Come back with better margins.",
    trade_counter: "Close, but I need better margins. How about these numbers?",
    tribute_accept: "A wise investment in our relationship. Noted.",
    ceasefire_accept: "War is expensive. Peace is profitable. Deal.",
    ceasefire_reject: "My war investments haven't paid off yet."
  },
  [BotPersonality.ROGUE]: {
    betrayal_reject: "Heh, you tried that trick once. Not falling for it again.",
    hostile_reject: "Maybe another time... when it suits me.",
    alliance_accept: "Sure, why not? Could be fun... for now.",
    alliance_reject: "Alliances are so boring. Maybe later.",
    trade_accept: "I'll take it. No guarantees on the return policy though.",
    trade_reject: "Nah, I can get a better deal elsewhere.",
    trade_counter: "Make it worth my while and we've got a deal.",
    tribute_accept: "Ooh, gifts! You know the way to my heart.",
    ceasefire_accept: "Fine, I was getting bored of fighting anyway.",
    ceasefire_reject: "Stop? But I'm just getting started!"
  }
};

function getPersonalityResponse(personality: BotPersonality, key: ResponseKey): string {
  return PERSONALITY_RESPONSES[personality]?.[key] || 'No response.';
}
```

### 4.6 Exportaciones del Módulo de IA

**Archivo: `utils/ai/index.ts`**

```typescript
/**
 * Módulo de IA - Exportaciones centralizadas
 * 
 * Punto de entrada para todo el sistema de inteligencia artificial
 * de los bots del juego.
 */

// Motor de decisiones principal
export { 
  makeBotDecision,
  type BotDecision,
  type BotDecisionType,
  type WorldState,
  type PlayerState,
  type IncomingAttack,
  type BotContext
} from './decisionEngine';

// Pesos de personalidad
export { 
  PERSONALITY_WEIGHTS,
  PERSONALITY_DESCRIPTIONS,
  type PersonalityTraits 
} from './personalityWeights';

// Selección de objetivos
export { 
  selectAttackTarget,
  shouldTargetPlayer,
  type TargetScore 
} from './targetSelection';

// IA diplomática
export { 
  generateDiplomaticProposals,
  evaluatePlayerProposal 
} from './diplomaticAI';

// ══════════════════════════════════════════
// ORQUESTADOR PRINCIPAL DE IA
// ══════════════════════════════════════════

import { makeBotDecision, WorldState, BotDecision } from './decisionEngine';
import { generateDiplomaticProposals } from './diplomaticAI';
import { BotState } from '../../types/bot';
import { DiplomaticProposal } from '../../types/diplomacy';

/**
 * Procesa todas las decisiones de IA para un tick del juego
 * 
 * @param botStates - Estado actual de todos los bots
 * @param worldState - Estado del mundo
 * @returns Decisiones y propuestas generadas
 */
export function processAITick(
  botStates: Record<string, BotState>,
  worldState: WorldState
): {
  decisions: Record<string, BotDecision>;
  proposals: DiplomaticProposal[];
} {
  const decisions: Record<string, BotDecision> = {};
  const proposals: DiplomaticProposal[] = [];
  
  for (const [botId, bot] of Object.entries(botStates)) {
    // Solo procesar bots que necesitan actualización
    const timeSinceLastDecision = worldState.currentTime - bot.lastDecisionTime;
    if (timeSinceLastDecision < 5 * 60 * 1000) continue; // 5 minutos entre decisiones
    
    // 1. Tomar decisión estratégica
    const decision = makeBotDecision(bot, worldState);
    decisions[botId] = decision;
    
    // 2. Generar propuestas diplomáticas (con menor frecuencia)
    if (timeSinceLastDecision > 15 * 60 * 1000) {
      const botProposals = generateDiplomaticProposals(bot, worldState);
      proposals.push(...botProposals);
    }
  }
  
  return { decisions, proposals };
}

/**
 * Constantes de configuración del sistema de IA
 */
export const AI_CONFIG = {
  DECISION_INTERVAL: 5 * 60 * 1000,       // 5 minutos entre decisiones
  DIPLOMACY_INTERVAL: 15 * 60 * 1000,     // 15 minutos entre propuestas
  MAX_PENDING_PROPOSALS: 3,               // Por bot
  PROPOSAL_EXPIRY: 30 * 60 * 1000,        // 30 minutos para responder
  MAX_SIMULTANEOUS_WARS: 2,               // Por facción
  BETRAYAL_COOLDOWN: 60 * 60 * 1000,      // 1 hora entre traiciones
  MEMORY_DECAY_HOURS: 48,                 // Las memorias se desvanecen después de 48h
  REVENGE_TIMEOUT: 24 * 60 * 60 * 1000    // 24 horas para buscar venganza
};
```

---

## FASE 5: Sistema de Ataques Coordinados

### 5.1 Tipos de Operaciones

**Archivo: `types/operations.ts`**

```typescript
/**
 * Sistema de Operaciones Militares Coordinadas
 */

export enum OperationType {
  // ─────────────────────────────────────────
  // Operaciones Ofensivas
  // ─────────────────────────────────────────
  PINCER_ATTACK = 'PINCER_ATTACK',       // Ataque simultáneo desde múltiples frentes
  WAVE_ASSAULT = 'WAVE_ASSAULT',         // Oleadas sucesivas que desgastan
  BLITZKRIEG = 'BLITZKRIEG',             // Ataque sorpresa masivo
  SIEGE = 'SIEGE',                       // Ataques continuos hasta rendición
  
  // ─────────────────────────────────────────
  // Operaciones Defensivas
  // ─────────────────────────────────────────
  MUTUAL_DEFENSE = 'MUTUAL_DEFENSE',     // Defensa coordinada de aliado
  COUNTER_OFFENSIVE = 'COUNTER_OFFENSIVE' // Contraataque tras defensa exitosa
}

export interface CoordinatedOperation {
  id: string;
  type: OperationType;
  
  // Organización
  organizerId: string;           // Facción o bot líder
  participantIds: string[];      // Bots participantes
  
  // Objetivo
  targetId: string;              // Bot, facción, o 'player'
  targetType: 'bot' | 'faction' | 'player';
  
  // Planificación
  plannedStartTime: number;
  phases: OperationPhase[];
  
  // Estado
  status: OperationStatus;
  currentPhase: number;
  results: OperationResult[];
  
  // Inteligencia (si el jugador tiene aliados que le avisen)
  detectedByPlayer: boolean;
  detectionTime?: number;
}

export type OperationStatus = 
  | 'planning'     // En fase de planificación
  | 'mobilizing'   // Preparando tropas
  | 'active'       // En ejecución
  | 'completed'    // Finalizada
  | 'failed'       // Falló (objetivo escapó, participantes se retiraron)
  | 'cancelled';   // Cancelada antes de iniciar

export interface OperationPhase {
  phaseNumber: number;
  attackerId: string;
  
  // Composición de ejército para esta fase
  army: Record<UnitType, number>;
  
  // Timing
  delayFromStart: number;       // Milisegundos desde inicio de operación
  estimatedDuration: number;
  
  // Objetivo de la fase
  objective: PhaseObjective;
  
  // Estado
  status: 'pending' | 'active' | 'completed' | 'failed';
  result?: BattleResult;
}

export type PhaseObjective = 
  | 'probe'           // Reconocimiento, identificar defensas
  | 'weaken'          // Desgastar defensas
  | 'main_assault'    // Ataque principal
  | 'cleanup'         // Eliminar resistencia restante
  | 'occupy';         // Mantener presión

export interface OperationResult {
  phaseNumber: number;
  success: boolean;
  casualties: {
    attacker: Record<UnitType, number>;
    defender: Record<UnitType, number>;
  };
  resourcesLooted?: Partial<Record<ResourceType, number>>;
}

// ══════════════════════════════════════════
// CONFIGURACIÓN DE OPERACIONES
// ══════════════════════════════════════════

export const OPERATION_CONFIG = {
  [OperationType.PINCER_ATTACK]: {
    minParticipants: 3,
    maxParticipants: 5,
    phases: 3,
    phaseDelay: 5 * 60 * 1000,        // 5 minutos entre fases
    warningTime: 15 * 60 * 1000,      // 15 minutos de aviso si detectado
    description: "Multiple attackers strike simultaneously from different angles"
  },
  
  [OperationType.WAVE_ASSAULT]: {
    minParticipants: 4,
    maxParticipants: 8,
    phases: 6,
    phaseDelay: 10 * 60 * 1000,       // 10 minutos entre oleadas
    warningTime: 30 * 60 * 1000,
    description: "Relentless waves that wear down defenses over time"
  },
  
  [OperationType.BLITZKRIEG]: {
    minParticipants: 2,
    maxParticipants: 4,
    phases: 1,
    phaseDelay: 0,                    // Todos atacan a la vez
    warningTime: 5 * 60 * 1000,       // Poco tiempo de aviso
    description: "Sudden, overwhelming strike with minimal warning"
  },
  
  [OperationType.SIEGE]: {
    minParticipants: 3,
    maxParticipants: 6,
    phases: 10,
    phaseDelay: 30 * 60 * 1000,       // 30 minutos entre ataques
    warningTime: 60 * 60 * 1000,      // 1 hora de aviso
    description: "Prolonged campaign to force surrender or destruction"
  }
};
```

### 5.2 Motor de Operaciones

**Archivo: `utils/engine/coordinatedAttacks.ts`**

```typescript
/**
 * Motor de Operaciones Coordinadas
 */

// ══════════════════════════════════════════
// PLANIFICACIÓN DE OPERACIONES
// ══════════════════════════════════════════

export function planCoordinatedAttack(
  organizer: BotState | Faction,
  participants: BotState[],
  target: { id: string; type: 'bot' | 'faction' | 'player' },
  operationType: OperationType,
  worldState: WorldState
): CoordinatedOperation {
  const config = OPERATION_CONFIG[operationType];
  
  // Generar fases de la operación
  const phases = generateOperationPhases(
    participants,
    target,
    operationType,
    config,
    worldState
  );
  
  // Tiempo de inicio (dar tiempo para preparación)
  const prepTime = 30 * 60 * 1000; // 30 minutos de preparación
  
  return {
    id: generateId(),
    type: operationType,
    organizerId: 'id' in organizer ? organizer.id : organizer.leaderId,
    participantIds: participants.map(p => p.id),
    targetId: target.id,
    targetType: target.type,
    plannedStartTime: Date.now() + prepTime,
    phases,
    status: 'planning',
    currentPhase: 0,
    results: [],
    detectedByPlayer: false
  };
}

// ══════════════════════════════════════════
// EJECUCIÓN DE OPERACIONES
// ══════════════════════════════════════════

export function processCoordinatedOperations(
  state: GameState,
  currentTime: number
): GameState {
  let updatedState = { ...state };
  
  for (const operation of Object.values(state.operations || {})) {
    if (operation.status !== 'active' && operation.status !== 'planning') {
      continue;
    }
    
    // ¿Debe iniciarse?
    if (operation.status === 'planning' && currentTime >= operation.plannedStartTime) {
      updatedState = activateOperation(updatedState, operation.id);
      continue;
    }
    
    // ¿Hay fases pendientes que deben ejecutarse?
    if (operation.status === 'active') {
      updatedState = processOperationPhases(updatedState, operation, currentTime);
    }
  }
  
  return updatedState;
}

// ══════════════════════════════════════════
// DETECCIÓN POR EL JUGADOR
// ══════════════════════════════════════════

export function checkPlayerDetection(
  operation: CoordinatedOperation,
  player: PlayerState,
  worldState: WorldState
): { detected: boolean; warningTime: number } {
  // El jugador detecta la operación si:
  // 1. Tiene aliados en la facción atacante (espías)
  // 2. Su reputación es muy alta con algún participante
  // 3. Tiene tecnología de inteligencia
  
  const config = OPERATION_CONFIG[operation.type];
  let detectionChance = 0.1; // 10% base
  
  // Aliados que pueden avisar
  const potentialSpies = operation.participantIds.filter(id => {
    const bot = worldState.botStates[id];
    return bot && bot.playerReputation > 50;
  });
  
  detectionChance += potentialSpies.length * 0.15;
  
  const detected = Math.random() < detectionChance;
  const warningTime = detected ? config.warningTime : 0;
  
  return { detected, warningTime };
}

// ══════════════════════════════════════════
// GENERACIÓN DE FASES DE OPERACIÓN
// ══════════════════════════════════════════

function generateOperationPhases(
  participants: BotState[],
  target: { id: string; type: 'bot' | 'faction' | 'player' },
  operationType: OperationType,
  config: typeof OPERATION_CONFIG[OperationType],
  worldState: WorldState
): OperationPhase[] {
  const phases: OperationPhase[] = [];
  
  switch (operationType) {
    case OperationType.PINCER_ATTACK: {
      // Fase 1: Sondeo con el participante más débil
      const sorted = [...participants].sort((a, b) => a.armyScore - b.armyScore);
      phases.push({
        phaseNumber: 1,
        attackerId: sorted[0].id,
        army: allocateArmy(sorted[0], 0.3), // 30% de su ejército
        delayFromStart: 0,
        estimatedDuration: 5 * 60 * 1000,
        objective: 'probe',
        status: 'pending'
      });
      
      // Fase 2: Ataque principal simultáneo
      for (let i = 1; i < sorted.length; i++) {
        phases.push({
          phaseNumber: 2,
          attackerId: sorted[i].id,
          army: allocateArmy(sorted[i], 0.7), // 70% de su ejército
          delayFromStart: config.phaseDelay,
          estimatedDuration: 10 * 60 * 1000,
          objective: 'main_assault',
          status: 'pending'
        });
      }
      
      // Fase 3: Limpieza
      phases.push({
        phaseNumber: 3,
        attackerId: sorted[sorted.length - 1].id,
        army: allocateArmy(sorted[sorted.length - 1], 0.5),
        delayFromStart: config.phaseDelay * 2,
        estimatedDuration: 5 * 60 * 1000,
        objective: 'cleanup',
        status: 'pending'
      });
      break;
    }
    
    case OperationType.WAVE_ASSAULT: {
      // Oleadas rotativas de participantes
      for (let wave = 0; wave < config.phases; wave++) {
        const attacker = participants[wave % participants.length];
        phases.push({
          phaseNumber: wave + 1,
          attackerId: attacker.id,
          army: allocateArmy(attacker, 0.4), // 40% por oleada
          delayFromStart: config.phaseDelay * wave,
          estimatedDuration: 8 * 60 * 1000,
          objective: wave === 0 ? 'probe' : wave === config.phases - 1 ? 'cleanup' : 'weaken',
          status: 'pending'
        });
      }
      break;
    }
    
    case OperationType.BLITZKRIEG: {
      // Todos atacan a la vez con máxima fuerza
      for (const participant of participants) {
        phases.push({
          phaseNumber: 1,
          attackerId: participant.id,
          army: allocateArmy(participant, 0.9), // 90% del ejército
          delayFromStart: 0,
          estimatedDuration: 3 * 60 * 1000,
          objective: 'main_assault',
          status: 'pending'
        });
      }
      break;
    }
    
    case OperationType.SIEGE: {
      // Ataques continuos espaciados
      for (let round = 0; round < config.phases; round++) {
        const attacker = participants[round % participants.length];
        const objective: PhaseObjective = 
          round < 2 ? 'probe' : 
          round < config.phases - 1 ? 'occupy' : 
          'main_assault';
        
        phases.push({
          phaseNumber: round + 1,
          attackerId: attacker.id,
          army: allocateArmy(attacker, 0.3), // 30% para conservar fuerzas
          delayFromStart: config.phaseDelay * round,
          estimatedDuration: 15 * 60 * 1000,
          objective,
          status: 'pending'
        });
      }
      break;
    }
    
    case OperationType.MUTUAL_DEFENSE: {
      // Todos refuerzan al aliado bajo ataque
      for (const participant of participants) {
        phases.push({
          phaseNumber: 1,
          attackerId: participant.id,
          army: allocateArmy(participant, 0.5),
          delayFromStart: Math.floor(Math.random() * 5 * 60 * 1000), // Llegada escalonada
          estimatedDuration: 10 * 60 * 1000,
          objective: 'main_assault',
          status: 'pending'
        });
      }
      break;
    }
    
    case OperationType.COUNTER_OFFENSIVE: {
      // Fase 1: Defensa
      phases.push({
        phaseNumber: 1,
        attackerId: participants[0].id,
        army: allocateArmy(participants[0], 0.6),
        delayFromStart: 0,
        estimatedDuration: 10 * 60 * 1000,
        objective: 'weaken',
        status: 'pending'
      });
      
      // Fase 2: Contraataque masivo
      for (let i = 1; i < participants.length; i++) {
        phases.push({
          phaseNumber: 2,
          attackerId: participants[i].id,
          army: allocateArmy(participants[i], 0.8),
          delayFromStart: 15 * 60 * 1000,
          estimatedDuration: 10 * 60 * 1000,
          objective: 'main_assault',
          status: 'pending'
        });
      }
      break;
    }
  }
  
  return phases;
}

/**
 * Asigna una porción del ejército de un bot para una fase
 */
function allocateArmy(
  bot: BotState, 
  percentage: number
): Record<UnitType, number> {
  const allocated: Record<string, number> = {};
  
  for (const [unitType, count] of Object.entries(bot.army)) {
    allocated[unitType] = Math.floor(count * percentage);
  }
  
  return allocated as Record<UnitType, number>;
}

// ══════════════════════════════════════════
// ACTIVACIÓN Y PROCESAMIENTO DE OPERACIONES
// ══════════════════════════════════════════

function activateOperation(
  state: GameState, 
  operationId: string
): GameState {
  const operation = state.operations[operationId];
  if (!operation) return state;
  
  // Verificar que todos los participantes siguen disponibles
  const allAvailable = operation.participantIds.every(id => {
    const bot = state.botStates[id];
    return bot && bot.armyScore > 0;
  });
  
  if (!allAvailable) {
    // Cancelar operación si faltan participantes
    return {
      ...state,
      operations: {
        ...state.operations,
        [operationId]: { ...operation, status: 'cancelled' }
      }
    };
  }
  
  // Activar la operación
  const updatedOperation: CoordinatedOperation = {
    ...operation,
    status: 'active',
    currentPhase: 1
  };
  
  // Generar evento mundial
  const worldEvent: WorldEvent = {
    id: `event_op_${operationId}`,
    type: WorldEventType.MAJOR_BATTLE,
    timestamp: Date.now(),
    actors: operation.participantIds,
    description: `A coordinated ${operation.type} operation has been launched against ${operation.targetId}`,
    impact: 'major'
  };
  
  return {
    ...state,
    operations: {
      ...state.operations,
      [operationId]: updatedOperation
    },
    diplomacy: {
      ...state.diplomacy,
      worldEvents: [...state.diplomacy.worldEvents, worldEvent]
    }
  };
}

function processOperationPhases(
  state: GameState,
  operation: CoordinatedOperation,
  currentTime: number
): GameState {
  let updatedState = { ...state };
  const operationStartTime = operation.plannedStartTime;
  
  for (const phase of operation.phases) {
    if (phase.status !== 'pending') continue;
    
    const phaseStartTime = operationStartTime + phase.delayFromStart;
    if (currentTime < phaseStartTime) continue;
    
    // Ejecutar la fase
    const phaseResult = executePhase(phase, operation, updatedState);
    
    // Actualizar estado de la fase
    const updatedPhases = operation.phases.map(p => 
      p.phaseNumber === phase.phaseNumber && p.attackerId === phase.attackerId
        ? { ...p, status: 'completed' as const, result: phaseResult.battleResult }
        : p
    );
    
    // Registrar resultado
    const result: OperationResult = {
      phaseNumber: phase.phaseNumber,
      success: phaseResult.success,
      casualties: phaseResult.casualties,
      resourcesLooted: phaseResult.resourcesLooted
    };
    
    // Determinar si la operación terminó
    const allPhasesComplete = updatedPhases.every(p => p.status === 'completed' || p.status === 'failed');
    const totalScore = operation.results.reduce((s, r) => s + (r.success ? 1 : 0), 0) + (phaseResult.success ? 1 : 0);
    const totalPhases = updatedPhases.length;
    
    const operationStatus: OperationStatus = allPhasesComplete
      ? (totalScore > totalPhases / 2 ? 'completed' : 'failed')
      : 'active';
    
    updatedState = {
      ...updatedState,
      operations: {
        ...updatedState.operations,
        [operation.id]: {
          ...operation,
          phases: updatedPhases,
          results: [...operation.results, result],
          status: operationStatus,
          currentPhase: phase.phaseNumber
        }
      },
      // Aplicar bajas a los participantes
      botStates: applyPhaseCasualties(updatedState.botStates, phase, phaseResult)
    };
  }
  
  return updatedState;
}

function executePhase(
  phase: OperationPhase,
  operation: CoordinatedOperation,
  state: GameState
): {
  success: boolean;
  battleResult: BattleResult;
  casualties: { attacker: Record<UnitType, number>; defender: Record<UnitType, number> };
  resourcesLooted?: Partial<Record<ResourceType, number>>;
} {
  const attacker = state.botStates[phase.attackerId];
  const defender = operation.targetType === 'player' 
    ? null  // Manejar jugador separadamente
    : state.botStates[operation.targetId];
  
  // Calcular fuerza de ataque
  const attackPower = Object.values(phase.army).reduce((sum, count) => sum + count * 10, 0);
  
  // Calcular fuerza de defensa
  const defensePower = defender 
    ? Object.values(defender.army).reduce((sum, count) => sum + count * 12, 0) // Bonus defensivo
    : 5000; // Valor por defecto para el jugador
  
  // Modificador por tipo de fase
  const phaseModifier = {
    'probe': 0.5,
    'weaken': 0.7,
    'main_assault': 1.0,
    'cleanup': 0.8,
    'occupy': 0.6
  }[phase.objective];
  
  const effectiveAttack = attackPower * phaseModifier;
  const success = effectiveAttack > defensePower * 0.8;
  
  // Calcular bajas (simplificado)
  const attackerLossRate = success ? 0.1 : 0.3;
  const defenderLossRate = success ? 0.3 : 0.1;
  
  const attackerCasualties: Record<string, number> = {};
  for (const [unit, count] of Object.entries(phase.army)) {
    attackerCasualties[unit] = Math.floor(count * attackerLossRate);
  }
  
  const defenderCasualties: Record<string, number> = {};
  if (defender) {
    for (const [unit, count] of Object.entries(defender.army)) {
      defenderCasualties[unit] = Math.floor(count * defenderLossRate);
    }
  }
  
  // Saqueo de recursos si tuvo éxito
  const resourcesLooted = success && defender ? {
    ...Object.fromEntries(
      Object.entries(defender.resources)
        .map(([res, amount]) => [res, Math.floor(amount * 0.1)])
    )
  } : undefined;
  
  return {
    success,
    battleResult: { 
      winner: success ? phase.attackerId : operation.targetId,
      attackPower: effectiveAttack,
      defensePower 
    } as BattleResult,
    casualties: {
      attacker: attackerCasualties as Record<UnitType, number>,
      defender: defenderCasualties as Record<UnitType, number>
    },
    resourcesLooted: resourcesLooted as Partial<Record<ResourceType, number>> | undefined
  };
}

function applyPhaseCasualties(
  botStates: Record<string, BotState>,
  phase: OperationPhase,
  result: { casualties: { attacker: Record<UnitType, number>; defender: Record<UnitType, number> } }
): Record<string, BotState> {
  const updated = { ...botStates };
  
  // Aplicar bajas al atacante
  const attacker = updated[phase.attackerId];
  if (attacker) {
    const newArmy = { ...attacker.army };
    for (const [unit, losses] of Object.entries(result.casualties.attacker)) {
      newArmy[unit as UnitType] = Math.max(0, (newArmy[unit as UnitType] || 0) - losses);
    }
    updated[phase.attackerId] = {
      ...attacker,
      army: newArmy,
      armyScore: Object.values(newArmy).reduce((s, v) => s + v * 10, 0)
    };
  }
  
  return updated;
}
```

### 5.3 Archivos a Crear/Modificar - Fase 5

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `types/operations.ts` | **CREAR** | Tipos de operaciones coordinadas |
| `utils/engine/coordinatedAttacks.ts` | **CREAR** | Motor de operaciones |
| `types/state.ts` | **MODIFICAR** | Añadir `operations: Record<string, CoordinatedOperation>` |
| `utils/engine/loop.ts` | **MODIFICAR** | Procesar operaciones cada tick |

---

## FASE 6: Integración UI y Notificaciones

### 6.1 Nuevos Componentes

**Estructura de directorios:**

```
src/components/
├── Diplomacy/
│   ├── DiplomacyPanel.tsx        # Panel principal
│   ├── ProposalInbox.tsx         # Propuestas pendientes
│   ├── RelationsOverview.tsx     # Vista de relaciones
│   ├── ProposalCard.tsx          # Tarjeta de propuesta
│   ├── DiplomaticActions.tsx     # Botones de acciones
│   └── TreatyList.tsx            # Tratados activos
│
├── Factions/
│   ├── FactionPanel.tsx          # Panel de facciones
│   ├── FactionCard.tsx           # Tarjeta de facción
│   ├── FactionDetails.tsx        # Detalles de facción
│   ├── MemberList.tsx            # Lista de miembros
│   ├── FactionWars.tsx           # Guerras activas
│   └── JoinFactionModal.tsx      # Modal para unirse
│
├── Intelligence/
│   ├── IntelPanel.tsx            # Panel de inteligencia
│   ├── ThreatAssessment.tsx      # Evaluación de amenazas
│   ├── IncomingOperations.tsx    # Operaciones detectadas
│   └── WorldEventsFeed.tsx       # Feed de eventos
│
└── BotProfile/
    ├── BotProfileModal.tsx       # Perfil detallado de bot
    ├── BotRelationship.tsx       # Relación con el jugador
    └── BotHistory.tsx            # Historial de interacciones
```

### 6.1.1 Componente: DiplomacyPanel

**Archivo: `components/Diplomacy/DiplomacyPanel.tsx`**

```typescript
import React, { useState, useMemo } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { ProposalInbox } from './ProposalInbox';
import { RelationsOverview } from './RelationsOverview';
import { DiplomaticActions } from './DiplomaticActions';
import { TreatyList } from './TreatyList';
import { DiplomaticProposal, ActiveTreaty, DiplomaticAction } from '../../types/diplomacy';

type DiplomacyTab = 'inbox' | 'relations' | 'treaties' | 'actions';

interface DiplomacyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiplomacyPanel: React.FC<DiplomacyPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<DiplomacyTab>('inbox');
  const { state, dispatch } = useGameState();
  
  const pendingProposals = useMemo(() => {
    return Object.values(state.diplomacy.proposals)
      .filter(p => p.status === 'pending' && p.toId === 'player')
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.diplomacy.proposals]);
  
  const activeTreaties = useMemo(() => {
    return Object.values(state.diplomacy.treaties)
      .filter(t => t.parties.includes('player'))
      .sort((a, b) => b.startedAt - a.startedAt);
  }, [state.diplomacy.treaties]);
  
  if (!isOpen) return null;
  
  const tabs: { id: DiplomacyTab; label: string; badge?: number }[] = [
    { id: 'inbox', label: 'Proposals', badge: pendingProposals.length },
    { id: 'relations', label: 'Relations' },
    { id: 'treaties', label: 'Treaties', badge: activeTreaties.length },
    { id: 'actions', label: 'Actions' }
  ];
  
  const handleAcceptProposal = (proposalId: string) => {
    dispatch({ type: 'PLAYER_RESPOND_PROPOSAL', payload: { proposalId, response: 'accept' } });
  };
  
  const handleRejectProposal = (proposalId: string) => {
    dispatch({ type: 'PLAYER_RESPOND_PROPOSAL', payload: { proposalId, response: 'reject' } });
  };
  
  const handleSendProposal = (
    targetId: string, 
    action: DiplomaticAction, 
    terms: DealTerms
  ) => {
    dispatch({ type: 'PLAYER_SEND_PROPOSAL', payload: { targetId, action, terms } });
  };
  
  return (
    <div className="diplomacy-panel panel-overlay">
      <div className="panel-header">
        <h2>Diplomacy</h2>
        <button onClick={onClose} className="close-btn">X</button>
      </div>
      
      <div className="tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.badge && tab.badge > 0 && (
              <span className="badge">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>
      
      <div className="tab-content">
        {activeTab === 'inbox' && (
          <ProposalInbox
            proposals={pendingProposals}
            botStates={state.botStates}
            onAccept={handleAcceptProposal}
            onReject={handleRejectProposal}
          />
        )}
        {activeTab === 'relations' && (
          <RelationsOverview
            botStates={state.botStates}
            factions={state.factions}
            playerFactionId={state.player?.factionId || null}
          />
        )}
        {activeTab === 'treaties' && (
          <TreatyList
            treaties={activeTreaties}
            botStates={state.botStates}
            factions={state.factions}
          />
        )}
        {activeTab === 'actions' && (
          <DiplomaticActions
            botStates={state.botStates}
            factions={state.factions}
            onSendProposal={handleSendProposal}
          />
        )}
      </div>
    </div>
  );
};
```

### 6.1.2 Componente: ProposalInbox

**Archivo: `components/Diplomacy/ProposalInbox.tsx`**

```typescript
import React from 'react';
import { ProposalCard } from './ProposalCard';
import { DiplomaticProposal } from '../../types/diplomacy';
import { BotState } from '../../types/bot';

interface ProposalInboxProps {
  proposals: DiplomaticProposal[];
  botStates: Record<string, BotState>;
  onAccept: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
}

export const ProposalInbox: React.FC<ProposalInboxProps> = ({
  proposals,
  botStates,
  onAccept,
  onReject
}) => {
  if (proposals.length === 0) {
    return (
      <div className="empty-inbox">
        <p>No pending diplomatic proposals.</p>
        <p className="hint">Interact with bots to receive proposals, or send your own from the Actions tab.</p>
      </div>
    );
  }
  
  return (
    <div className="proposal-inbox">
      <div className="inbox-header">
        <span>{proposals.length} pending proposal{proposals.length !== 1 ? 's' : ''}</span>
      </div>
      
      <div className="proposal-list">
        {proposals.map(proposal => {
          const sender = botStates[proposal.fromId];
          const timeRemaining = proposal.expiresAt - Date.now();
          const isExpiringSoon = timeRemaining < 5 * 60 * 1000; // 5 minutos
          
          return (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              senderName={sender?.name || 'Unknown'}
              senderPersonality={sender?.personality}
              senderReputation={sender?.playerReputation || 0}
              timeRemaining={timeRemaining}
              isExpiringSoon={isExpiringSoon}
              onAccept={() => onAccept(proposal.id)}
              onReject={() => onReject(proposal.id)}
            />
          );
        })}
      </div>
    </div>
  );
};
```

### 6.1.3 Componente: FactionPanel

**Archivo: `components/Factions/FactionPanel.tsx`**

```typescript
import React, { useState, useMemo } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { FactionCard } from './FactionCard';
import { FactionDetails } from './FactionDetails';
import { JoinFactionModal } from './JoinFactionModal';
import { Faction, FACTION_LIMITS } from '../../types/faction';

interface FactionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FactionPanel: React.FC<FactionPanelProps> = ({ isOpen, onClose }) => {
  const { state, dispatch } = useGameState();
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const playerFactionId = state.player?.factionId || null;
  const playerFaction = playerFactionId ? state.factions[playerFactionId] : null;
  
  const sortedFactions = useMemo(() => {
    return Object.values(state.factions)
      .sort((a, b) => b.power - a.power);
  }, [state.factions]);
  
  if (!isOpen) return null;
  
  const handleJoinFaction = (factionId: string) => {
    dispatch({ type: 'PLAYER_JOIN_FACTION', payload: { factionId } });
    setShowJoinModal(false);
  };
  
  const handleLeaveFaction = () => {
    if (playerFactionId) {
      dispatch({ type: 'PLAYER_LEAVE_FACTION', payload: { factionId: playerFactionId } });
    }
  };
  
  const handleCreateFaction = (name: string, tag: string, ideology: FactionIdeology) => {
    dispatch({ type: 'PLAYER_CREATE_FACTION', payload: { name, tag, ideology } });
    setShowCreateModal(false);
  };
  
  const handleInviteBot = (botId: string) => {
    if (playerFactionId) {
      dispatch({ type: 'PLAYER_INVITE_TO_FACTION', payload: { factionId: playerFactionId, botId } });
    }
  };
  
  return (
    <div className="faction-panel panel-overlay">
      <div className="panel-header">
        <h2>Factions</h2>
        <button onClick={onClose} className="close-btn">X</button>
      </div>
      
      {/* Estado de facción del jugador */}
      <div className="player-faction-status">
        {playerFaction ? (
          <div className="current-faction">
            <h3>Your Faction: {playerFaction.name} [{playerFaction.tag}]</h3>
            <div className="faction-stats">
              <span>Power: {playerFaction.power}</span>
              <span>Members: {playerFaction.memberIds.length + playerFaction.officerIds.length + 1}</span>
              <span>Stability: {playerFaction.stability}%</span>
              <span>Wars: {playerFaction.activeWars.filter(w => w.status === 'active').length}</span>
            </div>
            <div className="faction-actions">
              {playerFaction.leaderId === 'player' && (
                <button onClick={() => {/* Abrir panel de gestión */}} className="btn-primary">
                  Manage Faction
                </button>
              )}
              <button onClick={handleLeaveFaction} className="btn-danger">
                Leave Faction
              </button>
            </div>
          </div>
        ) : (
          <div className="no-faction">
            <p>You are not in any faction.</p>
            <div className="faction-options">
              <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                Create Faction
              </button>
              <button onClick={() => setShowJoinModal(true)} className="btn-secondary">
                Browse Factions
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Lista de todas las facciones */}
      <div className="faction-list">
        <h3>All Factions ({sortedFactions.length})</h3>
        {sortedFactions.map(faction => (
          <FactionCard
            key={faction.id}
            faction={faction}
            isPlayerFaction={faction.id === playerFactionId}
            isSelected={faction.id === selectedFaction}
            onClick={() => setSelectedFaction(
              selectedFaction === faction.id ? null : faction.id
            )}
          />
        ))}
      </div>
      
      {/* Detalles de facción seleccionada */}
      {selectedFaction && state.factions[selectedFaction] && (
        <FactionDetails
          faction={state.factions[selectedFaction]}
          botStates={state.botStates}
          isPlayerFaction={selectedFaction === playerFactionId}
          isPlayerLeader={state.factions[selectedFaction].leaderId === 'player'}
          onInviteBot={handleInviteBot}
          onClose={() => setSelectedFaction(null)}
        />
      )}
      
      {/* Modales */}
      {showJoinModal && (
        <JoinFactionModal
          factions={sortedFactions.filter(f => 
            f.memberIds.length < FACTION_LIMITS.MAX_MEMBERS
          )}
          onJoin={handleJoinFaction}
          onClose={() => setShowJoinModal(false)}
        />
      )}
    </div>
  );
};
```

### 6.1.4 Componente: IntelPanel

**Archivo: `components/Intelligence/IntelPanel.tsx`**

```typescript
import React, { useMemo } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { ThreatAssessment } from './ThreatAssessment';
import { IncomingOperations } from './IncomingOperations';
import { WorldEventsFeed } from './WorldEventsFeed';
import { CoordinatedOperation } from '../../types/operations';

interface IntelPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IntelPanel: React.FC<IntelPanelProps> = ({ isOpen, onClose }) => {
  const { state } = useGameState();
  
  // Operaciones detectadas contra el jugador
  const detectedOperations = useMemo(() => {
    return Object.values(state.operations || {})
      .filter((op: CoordinatedOperation) => 
        op.targetId === 'player' && 
        op.detectedByPlayer && 
        (op.status === 'planning' || op.status === 'mobilizing' || op.status === 'active')
      )
      .sort((a, b) => a.plannedStartTime - b.plannedStartTime);
  }, [state.operations]);
  
  // Evaluación de amenazas: bots con playerReputation < -25
  const threats = useMemo(() => {
    return Object.values(state.botStates)
      .filter(bot => bot.playerReputation < -25)
      .sort((a, b) => a.playerReputation - b.playerReputation)
      .slice(0, 10);
  }, [state.botStates]);
  
  // Posibles aliados: bots con playerReputation > 25
  const potentialAllies = useMemo(() => {
    return Object.values(state.botStates)
      .filter(bot => bot.playerReputation > 25 && !bot.factionId)
      .sort((a, b) => b.playerReputation - a.playerReputation)
      .slice(0, 5);
  }, [state.botStates]);
  
  // Eventos mundiales recientes
  const recentEvents = useMemo(() => {
    return (state.diplomacy.worldEvents || [])
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);
  }, [state.diplomacy.worldEvents]);
  
  if (!isOpen) return null;
  
  return (
    <div className="intel-panel panel-overlay">
      <div className="panel-header">
        <h2>Intelligence</h2>
        <button onClick={onClose} className="close-btn">X</button>
      </div>
      
      {/* Alertas de operaciones detectadas */}
      {detectedOperations.length > 0 && (
        <div className="alert-section">
          <h3 className="alert-title">INCOMING THREATS</h3>
          <IncomingOperations
            operations={detectedOperations}
            botStates={state.botStates}
            factions={state.factions}
          />
        </div>
      )}
      
      {/* Evaluación de amenazas */}
      <div className="threat-section">
        <h3>Threat Assessment</h3>
        <ThreatAssessment
          threats={threats}
          potentialAllies={potentialAllies}
          botStates={state.botStates}
          factions={state.factions}
        />
      </div>
      
      {/* Feed de eventos mundiales */}
      <div className="events-section">
        <h3>World Events</h3>
        <WorldEventsFeed
          events={recentEvents}
          botStates={state.botStates}
          factions={state.factions}
        />
      </div>
    </div>
  );
};
```

### 6.1.5 Componente: BotProfileModal

**Archivo: `components/BotProfile/BotProfileModal.tsx`**

```typescript
import React from 'react';
import { BotState, BotPersonality } from '../../types/bot';
import { BotRelationship } from './BotRelationship';
import { BotHistory } from './BotHistory';
import { PERSONALITY_DESCRIPTIONS } from '../../utils/ai/personalityWeights';
import { REPUTATION_THRESHOLDS } from '../../utils/engine/reputation';
import { DiplomaticAction } from '../../types/diplomacy';
import { getAvailableDiplomaticActions } from '../../utils/engine/reputation';

interface BotProfileModalProps {
  bot: BotState;
  isOpen: boolean;
  onClose: () => void;
  onDiplomaticAction: (action: DiplomaticAction, botId: string) => void;
}

export const BotProfileModal: React.FC<BotProfileModalProps> = ({
  bot,
  isOpen,
  onClose,
  onDiplomaticAction
}) => {
  if (!isOpen) return null;
  
  // Determinar relación actual
  const relation = bot.playerReputation > 50 ? 'ally' 
    : bot.playerReputation < -50 ? 'enemy' 
    : bot.factionId ? 'faction_member'
    : 'neutral';
  
  // Acciones diplomáticas disponibles
  const availableActions = getAvailableDiplomaticActions(bot.playerReputation, relation);
  
  // Nivel de reputación descriptivo
  const getReputationLabel = (rep: number): { label: string; color: string } => {
    if (rep >= REPUTATION_THRESHOLDS.TRUSTED_ALLY) return { label: 'Trusted Ally', color: '#00FF00' };
    if (rep >= REPUTATION_THRESHOLDS.FRIENDLY) return { label: 'Friendly', color: '#88FF00' };
    if (rep >= REPUTATION_THRESHOLDS.POSITIVE) return { label: 'Positive', color: '#CCFF00' };
    if (rep >= REPUTATION_THRESHOLDS.NEUTRAL) return { label: 'Neutral', color: '#FFCC00' };
    if (rep >= REPUTATION_THRESHOLDS.SUSPICIOUS) return { label: 'Suspicious', color: '#FF8800' };
    if (rep >= REPUTATION_THRESHOLDS.HOSTILE) return { label: 'Hostile', color: '#FF4400' };
    return { label: 'Hated', color: '#FF0000' };
  };
  
  const repInfo = getReputationLabel(bot.playerReputation);
  
  // Estadísticas militares
  const totalArmy = Object.values(bot.army).reduce((sum, count) => sum + count, 0);
  const totalResources = Object.values(bot.resources).reduce((sum, val) => sum + val, 0);
  
  return (
    <div className="bot-profile-modal modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="bot-identity">
            <img src={`/avatars/${bot.avatarId}.png`} alt={bot.name} className="bot-avatar" />
            <div>
              <h2>{bot.name}</h2>
              <span className="bot-country">{bot.country}</span>
              {bot.factionId && <span className="bot-faction-tag">[{bot.factionId}]</span>}
            </div>
          </div>
          <button onClick={onClose} className="close-btn">X</button>
        </div>
        
        {/* Personalidad */}
        <div className="section personality-section">
          <h3>Personality: {bot.personality}</h3>
          <p className="personality-desc">{PERSONALITY_DESCRIPTIONS[bot.personality]}</p>
        </div>
        
        {/* Relación con el jugador */}
        <BotRelationship
          reputation={bot.playerReputation}
          repLabel={repInfo.label}
          repColor={repInfo.color}
          threatLevel={bot.memory.playerThreatLevel}
          relation={relation}
        />
        
        {/* Estadísticas */}
        <div className="section stats-section">
          <h3>Intelligence Report</h3>
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Army Score</span>
              <span className="stat-value">{bot.armyScore.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Total Units</span>
              <span className="stat-value">{totalArmy.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Resources</span>
              <span className="stat-value">{totalResources.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Ambition</span>
              <span className="stat-value">{(bot.ambition * 100).toFixed(0)}%</span>
            </div>
            <div className="stat">
              <span className="stat-label">Current Goal</span>
              <span className="stat-value">{bot.currentGoal.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>
        
        {/* Historial de interacciones */}
        <BotHistory
          playerActions={bot.memory.playerActions}
          recentAttackers={bot.memory.recentAttackers}
          recentAllies={bot.memory.recentAllies}
          betrayals={bot.memory.betrayals}
        />
        
        {/* Acciones diplomáticas */}
        <div className="section actions-section">
          <h3>Diplomatic Actions</h3>
          <div className="action-buttons">
            {availableActions.map(action => (
              <button
                key={action}
                className={`action-btn action-${action.toLowerCase()}`}
                onClick={() => onDiplomaticAction(action, bot.id)}
              >
                {formatActionName(action)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function formatActionName(action: DiplomaticAction): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}
```

### 6.2 Sistema de Notificaciones Expandido

**Archivo: `types/notifications.ts` (expandir)**

```typescript
// Añadir a NotificationType existente

export enum NotificationType {
  // ─────────────────────────────────────────
  // Existentes (del sistema base)
  // ─────────────────────────────────────────
  ATTACK_RECEIVED = 'ATTACK_RECEIVED',
  ATTACK_RESULT = 'ATTACK_RESULT',
  BUILDING_COMPLETE = 'BUILDING_COMPLETE',
  RESEARCH_COMPLETE = 'RESEARCH_COMPLETE',
  RECRUITMENT_COMPLETE = 'RECRUITMENT_COMPLETE',
  RESOURCE_LOW = 'RESOURCE_LOW',
  RANKING_CHANGE = 'RANKING_CHANGE',
  ACHIEVEMENT_UNLOCKED = 'ACHIEVEMENT_UNLOCKED',
  MISSION_COMPLETE = 'MISSION_COMPLETE',
  NEMESIS_EVENT = 'NEMESIS_EVENT',
  
  // ─────────────────────────────────────────
  // Diplomacia
  // ─────────────────────────────────────────
  ALLIANCE_PROPOSAL_RECEIVED = 'ALLIANCE_PROPOSAL_RECEIVED',
  ALLIANCE_ACCEPTED = 'ALLIANCE_ACCEPTED',
  ALLIANCE_REJECTED = 'ALLIANCE_REJECTED',
  ALLIANCE_BROKEN = 'ALLIANCE_BROKEN',
  TRADE_PROPOSAL_RECEIVED = 'TRADE_PROPOSAL_RECEIVED',
  TRIBUTE_RECEIVED = 'TRIBUTE_RECEIVED',
  TRIBUTE_DEMANDED = 'TRIBUTE_DEMANDED',
  
  // ─────────────────────────────────────────
  // Facciones
  // ─────────────────────────────────────────
  FACTION_INVITE_RECEIVED = 'FACTION_INVITE_RECEIVED',
  FACTION_JOINED = 'FACTION_JOINED',
  FACTION_EXPELLED = 'FACTION_EXPELLED',
  FACTION_WAR_DECLARED = 'FACTION_WAR_DECLARED',
  FACTION_WAR_ENDED = 'FACTION_WAR_ENDED',
  FACTION_MEMBER_BETRAYED = 'FACTION_MEMBER_BETRAYED',
  
  // ─────────────────────────────────────────
  // Operaciones
  // ─────────────────────────────────────────
  COORDINATED_ATTACK_DETECTED = 'COORDINATED_ATTACK_DETECTED',
  COORDINATED_ATTACK_IMMINENT = 'COORDINATED_ATTACK_IMMINENT',
  COORDINATED_ATTACK_STARTED = 'COORDINATED_ATTACK_STARTED',
  
  // ─────────────────────────────────────────
  // Aliados
  // ─────────────────────────────────────────
  ALLY_UNDER_ATTACK = 'ALLY_UNDER_ATTACK',
  ALLY_REQUESTS_AID = 'ALLY_REQUESTS_AID',
  ALLY_BETRAYED_YOU = 'ALLY_BETRAYED_YOU',
  
  // ─────────────────────────────────────────
  // Eventos Mundiales
  // ─────────────────────────────────────────
  WORLD_EVENT_MAJOR = 'WORLD_EVENT_MAJOR',
  POWER_SHIFT = 'POWER_SHIFT',
  NEW_FACTION_FORMED = 'NEW_FACTION_FORMED'
}
```

### 6.3 Feed de Eventos Mundiales

```typescript
/**
 * Componente: WorldEventsFeed
 * 
 * Muestra eventos importantes del mundo del juego
 */

export interface WorldEventFeedItem {
  id: string;
  timestamp: number;
  type: WorldEventType;
  headline: string;
  description: string;
  actors: { id: string; name: string; isPlayer: boolean }[];
  impact: 'minor' | 'major' | 'critical';
  read: boolean;
}

// Ejemplos de eventos:
const SAMPLE_EVENTS: WorldEventFeedItem[] = [
  {
    id: '1',
    timestamp: Date.now(),
    type: WorldEventType.WAR_DECLARED,
    headline: "Iron Legion Declares War!",
    description: "The Iron Legion has declared war on the Golden Alliance.",
    actors: [
      { id: 'faction_1', name: 'Iron Legion', isPlayer: false },
      { id: 'faction_2', name: 'Golden Alliance', isPlayer: false }
    ],
    impact: 'major',
    read: false
  },
  {
    id: '2',
    timestamp: Date.now() - 3600000,
    type: WorldEventType.BETRAYAL,
    headline: "Shocking Betrayal!",
    description: "DarkWolf_Strike has betrayed the Shadow Covenant.",
    actors: [
      { id: 'bot_123', name: 'DarkWolf_Strike', isPlayer: false }
    ],
    impact: 'major',
    read: true
  }
];
```

### 6.4 Archivos a Crear/Modificar - Fase 6

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `components/Diplomacy/*.tsx` | **CREAR** | Componentes de diplomacia |
| `components/Factions/*.tsx` | **CREAR** | Componentes de facciones |
| `components/Intelligence/*.tsx` | **CREAR** | Componentes de inteligencia |
| `components/BotProfile/*.tsx` | **CREAR** | Perfil detallado de bots |
| `types/notifications.ts` | **MODIFICAR** | Nuevos tipos de notificación |
| `utils/notifications.ts` | **MODIFICAR** | Lógica de notificaciones |

---

## FASE 7: Integración con Game Loop

### 7.1 Game Loop Principal Modificado

**Archivo: `utils/engine/loop.ts` (modificar)**

```typescript
/**
 * Game Loop Principal - Integración del Sistema de IA Avanzada
 * 
 * Orden de procesamiento por tick:
 * 1. Actualizar economía de bots (diferido)
 * 2. Procesar decisiones de IA
 * 3. Procesar propuestas diplomáticas
 * 4. Actualizar facciones
 * 5. Procesar operaciones coordinadas
 * 6. Procesar tratados
 * 7. Generar eventos mundiales
 * 8. Actualizar rankings
 * 9. Generar notificaciones
 */

import { updateBotEconomy, BOT_UPDATE_INTERVAL } from './botSimulation';
import { processAITick, AI_CONFIG } from '../ai';
import { 
  updateFactionStability, 
  shouldFactionDissolve, 
  shouldSeekFaction, 
  findBestFaction, 
  addMemberToFaction 
} from './factions';
import { processTreaties, checkTreatyViolation } from './diplomacy';
import { processCoordinatedOperations, checkPlayerDetection } from './coordinatedAttacks';
import { applyReputationDecay } from './reputation';
import { GameState } from '../../types/state';

// ══════════════════════════════════════════
// CONFIGURACIÓN DEL GAME LOOP
// ══════════════════════════════════════════

export const GAME_LOOP_CONFIG = {
  TICK_INTERVAL: 1000,                    // 1 segundo entre ticks
  BOT_ECONOMY_BATCH_SIZE: 20,            // Bots procesados por tick (economía)
  BOT_AI_BATCH_SIZE: 10,                 // Bots procesados por tick (IA)
  FACTION_UPDATE_INTERVAL: 5 * 60 * 1000, // Actualizar facciones cada 5 min
  TREATY_CHECK_INTERVAL: 60 * 1000,       // Verificar tratados cada minuto
  WORLD_EVENT_INTERVAL: 10 * 60 * 1000,   // Generar eventos cada 10 min
  REPUTATION_DECAY_INTERVAL: 60 * 60 * 1000, // Decay de reputación cada hora
  RANKING_UPDATE_INTERVAL: 30 * 1000      // Actualizar rankings cada 30 seg
};

// ══════════════════════════════════════════
// TICK PRINCIPAL
// ══════════════════════════════════════════

let botEconomyIndex = 0;  // Índice rotativo para procesamiento por lotes
let botAIIndex = 0;
let lastFactionUpdate = 0;
let lastTreatyCheck = 0;
let lastReputationDecay = 0;
let lastWorldEventCheck = 0;

export function gameTick(state: GameState, currentTime: number): GameState {
  let updatedState = { ...state };
  
  // ─────────────────────────────────────────
  // PASO 1: Economía de bots (por lotes)
  // ─────────────────────────────────────────
  updatedState = processBotEconomyBatch(updatedState, currentTime);
  
  // ─────────────────────────────────────────
  // PASO 2: Decisiones de IA (por lotes)
  // ─────────────────────────────────────────
  updatedState = processBotAIBatch(updatedState, currentTime);
  
  // ─────────────────────────────────────────
  // PASO 3: Propuestas diplomáticas pendientes
  // ─────────────────────────────────────────
  updatedState = processPendingProposals(updatedState, currentTime);
  
  // ─────────────────────────────────────────
  // PASO 4: Actualización de facciones
  // ─────────────────────────────────────────
  if (currentTime - lastFactionUpdate >= GAME_LOOP_CONFIG.FACTION_UPDATE_INTERVAL) {
    updatedState = processFactionUpdates(updatedState, currentTime);
    lastFactionUpdate = currentTime;
  }
  
  // ─────────────────────────────────────────
  // PASO 5: Operaciones coordinadas
  // ─────────────────────────────────────────
  updatedState = processCoordinatedOperations(updatedState, currentTime);
  
  // ─────────────────────────────────────────
  // PASO 6: Tratados
  // ─────────────────────────────────────────
  if (currentTime - lastTreatyCheck >= GAME_LOOP_CONFIG.TREATY_CHECK_INTERVAL) {
    updatedState = processTreatyUpdates(updatedState, currentTime);
    lastTreatyCheck = currentTime;
  }
  
  // ─────────────────────────────────────────
  // PASO 7: Decay de reputación
  // ─────────────────────────────────────────
  if (currentTime - lastReputationDecay >= GAME_LOOP_CONFIG.REPUTATION_DECAY_INTERVAL) {
    updatedState = processReputationDecay(updatedState);
    lastReputationDecay = currentTime;
  }
  
  // ─────────────────────────────────────────
  // PASO 8: Eventos mundiales
  // ─────────────────────────────────────────
  if (currentTime - lastWorldEventCheck >= GAME_LOOP_CONFIG.WORLD_EVENT_INTERVAL) {
    updatedState = generateWorldEvents(updatedState, currentTime);
    lastWorldEventCheck = currentTime;
  }
  
  // ─────────────────────────────────────────
  // PASO 9: Detección de operaciones por el jugador
  // ─────────────────────────────────────────
  updatedState = checkOperationDetections(updatedState, currentTime);
  
  return updatedState;
}

// ══════════════════════════════════════════
// PROCESAMIENTO POR LOTES
// ══════════════════════════════════════════

/**
 * Procesa la economía de un lote de bots por tick
 * Esto distribuye la carga en múltiples ticks
 */
function processBotEconomyBatch(state: GameState, currentTime: number): GameState {
  const botIds = Object.keys(state.botStates);
  if (botIds.length === 0) return state;
  
  const updatedBotStates = { ...state.botStates };
  const batchEnd = Math.min(
    botEconomyIndex + GAME_LOOP_CONFIG.BOT_ECONOMY_BATCH_SIZE, 
    botIds.length
  );
  
  for (let i = botEconomyIndex; i < batchEnd; i++) {
    const botId = botIds[i];
    const bot = updatedBotStates[botId];
    if (!bot) continue;
    
    const updatedBot = updateBotEconomy(bot, currentTime);
    if (updatedBot !== bot) {
      updatedBotStates[botId] = updatedBot;
    }
  }
  
  // Avanzar índice rotativo
  botEconomyIndex = batchEnd >= botIds.length ? 0 : batchEnd;
  
  return { ...state, botStates: updatedBotStates };
}

/**
 * Procesa las decisiones de IA de un lote de bots por tick
 */
function processBotAIBatch(state: GameState, currentTime: number): GameState {
  const botIds = Object.keys(state.botStates);
  if (botIds.length === 0) return state;
  
  const updatedBotStates = { ...state.botStates };
  const newProposals = { ...state.diplomacy.proposals };
  
  const batchEnd = Math.min(
    botAIIndex + GAME_LOOP_CONFIG.BOT_AI_BATCH_SIZE, 
    botIds.length
  );
  
  // Construir WorldState para la IA
  const worldState: WorldState = {
    botStates: state.botStates,
    factions: state.factions,
    diplomacy: state.diplomacy,
    operations: state.operations || {},
    incomingAttacks: [], // Se calcula de operaciones activas
    playerState: {
      factionId: state.player?.factionId || null,
      armyScore: state.player?.armyScore || 0,
      resources: state.player?.resources || {},
      reputation: {}
    },
    currentTime
  };
  
  for (let i = botAIIndex; i < batchEnd; i++) {
    const botId = botIds[i];
    const bot = updatedBotStates[botId];
    if (!bot) continue;
    
    // Verificar si necesita tomar una decisión
    const timeSinceLastDecision = currentTime - bot.lastDecisionTime;
    if (timeSinceLastDecision < AI_CONFIG.DECISION_INTERVAL) continue;
    
    // Tomar decisión de IA
    const { decisions, proposals } = processAITick(
      { [botId]: bot }, 
      worldState
    );
    
    // Aplicar decisión
    if (decisions[botId]) {
      updatedBotStates[botId] = {
        ...bot,
        lastDecisionTime: currentTime,
        currentGoal: mapDecisionToGoal(decisions[botId].type)
      };
    }
    
    // Registrar propuestas
    for (const proposal of proposals) {
      newProposals[proposal.id] = proposal;
    }
  }
  
  // Avanzar índice rotativo
  botAIIndex = batchEnd >= botIds.length ? 0 : batchEnd;
  
  return { 
    ...state, 
    botStates: updatedBotStates,
    diplomacy: {
      ...state.diplomacy,
      proposals: newProposals
    }
  };
}

// ══════════════════════════════════════════
// PROCESAMIENTO DE SUBSISTEMAS
// ══════════════════════════════════════════

/**
 * Procesa propuestas diplomáticas pendientes (expiración, respuestas de bots)
 */
function processPendingProposals(state: GameState, currentTime: number): GameState {
  const updatedProposals = { ...state.diplomacy.proposals };
  const notifications: GameNotification[] = [];
  let changed = false;
  
  for (const [id, proposal] of Object.entries(updatedProposals)) {
    if (proposal.status !== 'pending') continue;
    
    // Verificar expiración
    if (currentTime >= proposal.expiresAt) {
      updatedProposals[id] = { ...proposal, status: 'expired' };
      changed = true;
      continue;
    }
    
    // Si es una propuesta dirigida a un bot, evaluarla
    if (proposal.toType === 'bot' && proposal.toId !== 'player') {
      const targetBot = state.botStates[proposal.toId];
      if (!targetBot) continue;
      
      // Los bots responden después de un delay aleatorio (1-5 minutos)
      const responseDelay = 60 * 1000 + Math.random() * 4 * 60 * 1000;
      if (currentTime - proposal.createdAt < responseDelay) continue;
      
      const { evaluateProposal } = require('./diplomacy');
      const worldState = { factions: state.factions, botStates: state.botStates };
      const evaluation = evaluateProposal(proposal, targetBot, worldState);
      
      updatedProposals[id] = {
        ...proposal,
        status: evaluation.decision === 'accept' ? 'accepted' 
          : evaluation.decision === 'counter' ? 'countered' 
          : 'rejected',
        respondedAt: currentTime,
        response: evaluation.reason
      };
      changed = true;
      
      // Generar notificación si la propuesta era del jugador
      if (proposal.fromId === 'player') {
        notifications.push({
          type: evaluation.decision === 'accept' 
            ? NotificationType.ALLIANCE_ACCEPTED 
            : NotificationType.ALLIANCE_REJECTED,
          message: `${targetBot.name} ${evaluation.decision}ed your proposal: ${evaluation.reason}`,
          timestamp: currentTime
        });
      }
    }
  }
  
  if (!changed) return state;
  
  return {
    ...state,
    diplomacy: {
      ...state.diplomacy,
      proposals: updatedProposals
    }
  };
}

/**
 * Actualiza estabilidad de facciones y procesa disoluciones
 */
function processFactionUpdates(state: GameState, currentTime: number): GameState {
  const updatedFactions = { ...state.factions };
  const updatedBotStates = { ...state.botStates };
  const worldEvents: WorldEvent[] = [];
  let changed = false;
  
  for (const [factionId, faction] of Object.entries(updatedFactions)) {
    // Actualizar estabilidad
    const updatedFaction = updateFactionStability(faction);
    
    // Verificar si debe disolverse
    if (shouldFactionDissolve(updatedFaction)) {
      // Liberar a todos los miembros
      const allMembers = [...updatedFaction.memberIds, ...updatedFaction.officerIds];
      if (updatedFaction.leaderId && updatedFaction.leaderId !== 'player') {
        allMembers.push(updatedFaction.leaderId);
      }
      
      for (const memberId of allMembers) {
        if (updatedBotStates[memberId]) {
          updatedBotStates[memberId] = {
            ...updatedBotStates[memberId],
            factionId: null,
            factionRole: FactionRole.NONE
          };
        }
      }
      
      delete updatedFactions[factionId];
      
      worldEvents.push({
        id: `event_dissolve_${factionId}`,
        type: WorldEventType.FACTION_DISSOLVED,
        timestamp: currentTime,
        actors: allMembers,
        description: `${faction.name} has been dissolved due to instability`,
        impact: 'major'
      });
      
      changed = true;
      continue;
    }
    
    updatedFactions[factionId] = updatedFaction;
    
    // Procesar bots sin facción que quieran unirse
    const freeAgents = Object.values(updatedBotStates)
      .filter(bot => !bot.factionId && shouldSeekFaction(bot, Object.values(updatedFactions)));
    
    for (const agent of freeAgents.slice(0, 2)) { // Máximo 2 por tick
      const bestFaction = findBestFaction(agent, Object.values(updatedFactions), updatedBotStates);
      if (bestFaction && bestFaction.id === factionId) {
        updatedFactions[factionId] = addMemberToFaction(updatedFactions[factionId], agent.id);
        updatedBotStates[agent.id] = {
          ...agent,
          factionId: factionId,
          factionRole: FactionRole.MEMBER
        };
        changed = true;
      }
    }
  }
  
  if (!changed && worldEvents.length === 0) return state;
  
  return {
    ...state,
    factions: updatedFactions,
    botStates: updatedBotStates,
    diplomacy: {
      ...state.diplomacy,
      worldEvents: [...(state.diplomacy.worldEvents || []), ...worldEvents]
    }
  };
}

/**
 * Procesa expiración y violaciones de tratados
 */
function processTreatyUpdates(state: GameState, currentTime: number): GameState {
  const { updatedTreaties, expiredTreaties, events } = processTreaties(
    state.diplomacy.treaties,
    currentTime
  );
  
  if (expiredTreaties.length === 0 && events.length === 0) return state;
  
  return {
    ...state,
    diplomacy: {
      ...state.diplomacy,
      treaties: updatedTreaties,
      worldEvents: [...(state.diplomacy.worldEvents || []), ...events]
    }
  };
}

/**
 * Aplica decay de reputación hacia neutral para todos los bots
 */
function processReputationDecay(state: GameState): GameState {
  const updatedBotStates = { ...state.botStates };
  let changed = false;
  
  for (const [botId, bot] of Object.entries(updatedBotStates)) {
    const newReputation = { ...bot.reputation };
    let botChanged = false;
    
    for (const [targetId, rep] of Object.entries(newReputation)) {
      const decayed = applyReputationDecay(rep, 1); // 1 hora
      if (decayed !== rep) {
        newReputation[targetId] = decayed;
        botChanged = true;
      }
    }
    
    // También decay de reputación con el jugador
    const newPlayerRep = applyReputationDecay(bot.playerReputation, 1);
    
    if (botChanged || newPlayerRep !== bot.playerReputation) {
      updatedBotStates[botId] = {
        ...bot,
        reputation: newReputation,
        playerReputation: newPlayerRep
      };
      changed = true;
    }
  }
  
  if (!changed) return state;
  return { ...state, botStates: updatedBotStates };
}

/**
 * Genera eventos mundiales basados en el estado actual
 */
function generateWorldEvents(state: GameState, currentTime: number): GameState {
  const events: WorldEvent[] = [];
  
  // Detectar cambios de poder significativos
  const factionsByPower = Object.values(state.factions).sort((a, b) => b.power - a.power);
  if (factionsByPower.length >= 2) {
    const topFaction = factionsByPower[0];
    const secondFaction = factionsByPower[1];
    
    // Si la facción líder tiene más del doble de poder
    if (topFaction.power > secondFaction.power * 2) {
      events.push({
        id: `event_power_${currentTime}`,
        type: WorldEventType.POWER_SHIFT,
        timestamp: currentTime,
        actors: [topFaction.id],
        description: `${topFaction.name} has become the dominant faction with overwhelming power`,
        impact: 'major'
      });
    }
  }
  
  // Detectar facciones nuevas formándose
  const recentFactions = Object.values(state.factions)
    .filter(f => currentTime - f.founded < GAME_LOOP_CONFIG.WORLD_EVENT_INTERVAL);
  
  for (const faction of recentFactions) {
    events.push({
      id: `event_new_faction_${faction.id}`,
      type: WorldEventType.FACTION_FORMED,
      timestamp: currentTime,
      actors: [faction.leaderId],
      description: `A new faction "${faction.name}" has been formed`,
      impact: 'minor'
    });
  }
  
  if (events.length === 0) return state;
  
  return {
    ...state,
    diplomacy: {
      ...state.diplomacy,
      worldEvents: [...(state.diplomacy.worldEvents || []), ...events].slice(-100) // Mantener últimos 100
    }
  };
}

/**
 * Verifica si el jugador detecta operaciones en curso contra él
 */
function checkOperationDetections(state: GameState, currentTime: number): GameState {
  const operations = state.operations || {};
  const updatedOperations = { ...operations };
  const notifications: GameNotification[] = [];
  let changed = false;
  
  for (const [opId, operation] of Object.entries(updatedOperations)) {
    if (operation.targetId !== 'player') continue;
    if (operation.detectedByPlayer) continue;
    if (operation.status !== 'planning' && operation.status !== 'mobilizing') continue;
    
    const detection = checkPlayerDetection(
      operation,
      state.player as PlayerState,
      { botStates: state.botStates, factions: state.factions } as WorldState
    );
    
    if (detection.detected) {
      updatedOperations[opId] = {
        ...operation,
        detectedByPlayer: true,
        detectionTime: currentTime
      };
      
      notifications.push({
        type: NotificationType.COORDINATED_ATTACK_DETECTED,
        message: `Intelligence report: A coordinated ${operation.type} operation has been detected! ETA: ${Math.ceil(detection.warningTime / 60000)} minutes`,
        timestamp: currentTime,
        priority: 'critical'
      });
      
      changed = true;
    }
  }
  
  if (!changed) return state;
  
  return {
    ...state,
    operations: updatedOperations
  };
}

// ══════════════════════════════════════════
// UTILIDADES DEL GAME LOOP
// ══════════════════════════════════════════

function mapDecisionToGoal(decisionType: string): BotGoal {
  const mapping: Record<string, BotGoal> = {
    'defend': BotGoal.SURVIVE,
    'attack': BotGoal.DOMINATE_RANKING,
    'request_aid': BotGoal.SURVIVE,
    'seek_emergency_alliance': BotGoal.SEEK_ALLIANCE,
    'revenge_attack': BotGoal.REVENGE,
    'contribute_to_war': BotGoal.DEFEND_ALLY,
    'defend_ally': BotGoal.DEFEND_ALLY,
    'betray': BotGoal.BETRAY_FACTION,
    'expand_territory': BotGoal.DOMINATE_RANKING,
    'raid_resources': BotGoal.EXPAND_ECONOMY,
    'propose_alliance': BotGoal.SEEK_ALLIANCE,
    'propose_trade': BotGoal.EXPAND_ECONOMY,
    'propose_non_aggression': BotGoal.SEEK_ALLIANCE,
    'build_economy': BotGoal.EXPAND_ECONOMY,
    'recruit_army': BotGoal.BUILD_ARMY,
    'upgrade_buildings': BotGoal.EXPAND_ECONOMY,
    'research_tech': BotGoal.CONSOLIDATE_POWER,
    'idle': BotGoal.EXPAND_ECONOMY
  };
  
  return mapping[decisionType] || BotGoal.EXPAND_ECONOMY;
}

interface GameNotification {
  type: NotificationType;
  message: string;
  timestamp: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}
```

### 7.2 Estado Global Modificado

**Archivo: `types/state.ts` (modificar)**

```typescript
import { BotState } from './bot';
import { Faction } from './faction';
import { DiplomacyState } from './diplomacy';
import { CoordinatedOperation } from './operations';

export interface GameState {
  // ══════════════════════════════════════════
  // ESTADO EXISTENTE (mantener)
  // ══════════════════════════════════════════
  player: PlayerGameState;
  resources: Record<ResourceType, number>;
  buildings: Record<BuildingType, number>;
  techs: TechType[];
  army: Record<UnitType, number>;
  // ... otros campos existentes ...
  
  // ══════════════════════════════════════════
  // NUEVO: Sistema de IA Avanzada
  // ══════════════════════════════════════════
  botStates: Record<string, BotState>;          // Estado persistente de 199 bots
  factions: Record<string, Faction>;             // Facciones activas
  diplomacy: DiplomacyState;                     // Propuestas, tratados, eventos
  operations: Record<string, CoordinatedOperation>; // Operaciones coordinadas
}

export interface PlayerGameState {
  // Campos existentes...
  id: string;
  name: string;
  
  // Nuevos campos para el sistema de IA
  factionId: string | null;
  factionRole: FactionRole;
  armyScore: number;
  reputation: Record<string, number>;  // Reputación con cada bot/facción
}
```

### 7.3 Actions/Reducers Nuevos

**Archivo: `utils/engine/actions.ts` (añadir)**

```typescript
/**
 * Acciones del sistema de IA Avanzada
 * Añadir al reducer principal del juego
 */

export type AIAction =
  // Diplomacia del jugador
  | { type: 'PLAYER_SEND_PROPOSAL'; payload: { targetId: string; action: DiplomaticAction; terms: DealTerms } }
  | { type: 'PLAYER_RESPOND_PROPOSAL'; payload: { proposalId: string; response: 'accept' | 'reject' | 'counter'; counterTerms?: DealTerms } }
  
  // Facciones del jugador
  | { type: 'PLAYER_CREATE_FACTION'; payload: { name: string; tag: string; ideology: FactionIdeology } }
  | { type: 'PLAYER_JOIN_FACTION'; payload: { factionId: string } }
  | { type: 'PLAYER_LEAVE_FACTION'; payload: { factionId: string } }
  | { type: 'PLAYER_INVITE_TO_FACTION'; payload: { factionId: string; botId: string } }
  | { type: 'PLAYER_KICK_FROM_FACTION'; payload: { factionId: string; botId: string } }
  | { type: 'PLAYER_PROMOTE_OFFICER'; payload: { factionId: string; botId: string } }
  
  // Contribuciones a facción
  | { type: 'PLAYER_CONTRIBUTE_RESOURCES'; payload: { factionId: string; resources: Partial<Record<ResourceType, number>> } }
  
  // Declaraciones de guerra
  | { type: 'PLAYER_DECLARE_FACTION_WAR'; payload: { targetFactionId: string; reason: WarReason } }
  | { type: 'PLAYER_PROPOSE_CEASEFIRE'; payload: { warId: string } }
  
  // Game loop
  | { type: 'GAME_TICK'; payload: { currentTime: number } }
  | { type: 'INITIALIZE_BOT_STATES'; payload: {} }
  | { type: 'INITIALIZE_FACTIONS'; payload: {} };

/**
 * Reducer para acciones de IA
 */
export function aiReducer(state: GameState, action: AIAction): GameState {
  switch (action.type) {
    case 'PLAYER_SEND_PROPOSAL': {
      const { targetId, action: diplomaticAction, terms } = action.payload;
      return playerPropose(state, targetId, 'bot', diplomaticAction, terms);
    }
    
    case 'PLAYER_RESPOND_PROPOSAL': {
      const { proposalId, response, counterTerms } = action.payload;
      return playerRespond(state, proposalId, response, counterTerms);
    }
    
    case 'PLAYER_CREATE_FACTION': {
      const { name, tag, ideology } = action.payload;
      const result = playerCreateFaction(state, name, tag, ideology);
      return {
        ...result.state,
        player: { ...state.player, factionId: result.faction.id, factionRole: FactionRole.LEADER }
      };
    }
    
    case 'PLAYER_JOIN_FACTION': {
      const { factionId } = action.payload;
      const faction = state.factions[factionId];
      if (!faction) return state;
      
      return {
        ...state,
        factions: {
          ...state.factions,
          [factionId]: addMemberToFaction(faction, 'player')
        },
        player: { ...state.player, factionId, factionRole: FactionRole.MEMBER }
      };
    }
    
    case 'PLAYER_LEAVE_FACTION': {
      const { factionId } = action.payload;
      const faction = state.factions[factionId];
      if (!faction) return state;
      
      return {
        ...state,
        factions: {
          ...state.factions,
          [factionId]: removeMemberFromFaction(faction, 'player', 'left')
        },
        player: { ...state.player, factionId: null, factionRole: FactionRole.NONE }
      };
    }
    
    case 'PLAYER_CONTRIBUTE_RESOURCES': {
      const { factionId, resources } = action.payload;
      const faction = state.factions[factionId];
      if (!faction) return state;
      
      // Deducir recursos del jugador
      const newPlayerResources = { ...state.resources };
      const newTreasury = { ...faction.treasury };
      
      for (const [res, amount] of Object.entries(resources)) {
        const available = newPlayerResources[res as ResourceType] || 0;
        const contribution = Math.min(available, amount || 0);
        newPlayerResources[res as ResourceType] = available - contribution;
        newTreasury[res as ResourceType] = (newTreasury[res as ResourceType] || 0) + contribution;
      }
      
      return {
        ...state,
        resources: newPlayerResources,
        factions: {
          ...state.factions,
          [factionId]: {
            ...faction,
            treasury: newTreasury,
            contributionHistory: [...faction.contributionHistory, {
              memberId: 'player',
              resource: Object.keys(resources)[0] as ResourceType,
              amount: Object.values(resources)[0] || 0,
              timestamp: Date.now()
            }]
          }
        }
      };
    }
    
    case 'GAME_TICK': {
      return gameTick(state, action.payload.currentTime);
    }
    
    default:
      return state;
  }
}
```

### 7.4 Archivos a Crear/Modificar - Fase 7

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `utils/engine/loop.ts` | **MODIFICAR** | Integrar procesamiento completo del game loop |
| `types/state.ts` | **MODIFICAR** | Añadir botStates, factions, diplomacy, operations |
| `utils/engine/actions.ts` | **CREAR** | Actions y reducer para el sistema de IA |
| `hooks/useGameState.ts` | **MODIFICAR** | Exponer nuevas acciones al UI |

---

## RESUMEN DE ARCHIVOS

### Archivos a CREAR (27 archivos)

| # | Archivo | Fase | Prioridad |
|---|---------|------|-----------|
| 1 | `types/bot.ts` | 1 | Alta |
| 2 | `utils/engine/botSimulation.ts` | 1 | Alta |
| 3 | `utils/engine/botInitialization.ts` | 1 | Alta |
| 4 | `types/faction.ts` | 2 | Alta |
| 5 | `data/factions.ts` | 2 | Alta |
| 6 | `utils/engine/factions.ts` | 2 | Alta |
| 7 | `types/diplomacy.ts` | 3 | Alta |
| 8 | `utils/engine/reputation.ts` | 3 | Media |
| 9 | `utils/engine/diplomacy.ts` | 3 | Alta |
| 10 | `utils/ai/decisionEngine.ts` | 4 | Crítica |
| 11 | `utils/ai/personalityWeights.ts` | 4 | Alta |
| 12 | `utils/ai/targetSelection.ts` | 4 | Alta |
| 13 | `utils/ai/diplomaticAI.ts` | 4 | Alta |
| 14 | `utils/ai/index.ts` | 4 | Media |
| 15 | `types/operations.ts` | 5 | Media |
| 16 | `utils/engine/coordinatedAttacks.ts` | 5 | Media |
| 17 | `components/Diplomacy/DiplomacyPanel.tsx` | 6 | Media |
| 18 | `components/Diplomacy/ProposalInbox.tsx` | 6 | Media |
| 19 | `components/Factions/FactionPanel.tsx` | 6 | Media |
| 20 | `components/Factions/FactionCard.tsx` | 6 | Baja |
| 21 | `components/Intelligence/IntelPanel.tsx` | 6 | Media |
| 22 | `components/Intelligence/WorldEventsFeed.tsx` | 6 | Baja |
| 23 | `components/BotProfile/BotProfileModal.tsx` | 6 | Media |
| 24 | `components/BotProfile/BotRelationship.tsx` | 6 | Baja |
| 25 | `components/BotProfile/BotHistory.tsx` | 6 | Baja |
| 26 | `utils/engine/actions.ts` | 7 | Crítica |
| 27 | `components/Factions/JoinFactionModal.tsx` | 6 | Baja |

### Archivos a MODIFICAR (9 archivos)

| # | Archivo | Cambios |
|---|---------|---------|
| 1 | `types/state.ts` | Añadir botStates, factions, diplomacy, operations, PlayerGameState |
| 2 | `types/enums.ts` | Añadir FactionIdeology, DiplomaticAction, OperationType, UnitType, ResourceType |
| 3 | `utils/engine/loop.ts` | Integrar game loop completo con procesamiento por lotes |
| 4 | `utils/engine/rankings.ts` | Migrar a nuevo sistema de BotState |
| 5 | `utils/engine/war.ts` | Soportar guerras de facciones y operaciones coordinadas |
| 6 | `utils/engine/nemesis.ts` | Integrar con sistema de reputación y memoria de bots |
| 7 | `types/notifications.ts` | Nuevos tipos de notificación (diplomacia, facciones, operaciones) |
| 8 | `utils/notifications.ts` | Lógica de notificaciones expandida con prioridades |
| 9 | `hooks/useGameState.ts` | Exponer nuevas acciones de IA al UI |

---

## ESTIMACIÓN DE TIEMPO

| Fase | Descripción | Tiempo Estimado |
|------|-------------|-----------------|
| **Fase 1** | Estado Persistente de Bots | 4-6 horas |
| **Fase 2** | Sistema de Facciones | 4-5 horas |
| **Fase 3** | Sistema de Diplomacia | 5-7 horas |
| **Fase 4** | IA de Toma de Decisiones | 6-8 horas |
| **Fase 5** | Ataques Coordinados | 3-4 horas |
| **Fase 6** | UI y Notificaciones | 4-6 horas |
| **Fase 7** | Integración con Game Loop | 5-7 horas |
| | **TOTAL** | **31-43 horas** |

---

## ORDEN DE IMPLEMENTACIÓN RECOMENDADO

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1: Estado Persistente                                     │
│  (Fundación - los bots necesitan estado para todo lo demás)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  FASE 4: IA de Toma de Decisiones                               │
│  (El corazón del sistema - define cómo actúan los bots)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  FASE 2: Sistema de Facciones                                   │
│  (Usa la IA para formar y gestionar grupos)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  FASE 3: Sistema de Diplomacia                                  │
│  (Conecta bots, facciones y jugador)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  FASE 5: Ataques Coordinados                                    │
│  (Culminación del sistema militar)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  FASE 7: Integración con Game Loop                              │
│  (Unir todos los sistemas en el ciclo principal del juego)      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  FASE 6: UI y Notificaciones                                    │
│  (Exponer todo al jugador)                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## NOTAS ADICIONALES

### Rendimiento
- La simulación de 199 bots debe ser eficiente
- Usar cálculo diferido en lugar de tick-a-tick
- Considerar web workers para procesamiento pesado

### Balanceo
- Ajustar dificultad según progreso del jugador
- Los bots más fuertes no deberían abusar de los más débiles
- Las alianzas deben tener contrapesos

### Pruebas
- Crear tests unitarios para la IA
- Simular miles de decisiones para detectar patrones problemáticos
- Balancear personalidades para que todas sean viables

---

*Documento generado para Iron Dune: Operations*
*Versión del plan: 1.0*
