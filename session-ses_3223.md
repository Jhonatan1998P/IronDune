# Plan Guerra Total P2P con Trystero y escombros

**Session ID:** ses_3223e6d3fffeO72Vp3ovF9XAp3
**Created:** 3/11/2026, 4:36:16 PM
**Updated:** 3/12/2026, 1:11:25 AM

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: write**

---

## Assistant

**Tool: edit**

**Tool: edit**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: edit**

**Tool: edit**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: bash**

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

**Tool: edit**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: bash**

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

**Tool: edit**

---

## Assistant

**Tool: edit**

**Tool: edit**

**Tool: edit**

**Tool: edit**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: bash**

---

## Assistant

He completado la implementación del sistema de **Botín Logístico** (anteriormente "escombros") integrando perfectamente las mecánicas de OGame en Iron Dune, con las modificaciones solicitadas para el juego entre bots y jugadores.

### Cambios Principales Realizados:

1.  **Eliminación del Loot Pool de Guerra**: Se ha eliminado el antiguo sistema de recompensas automáticas al finalizar una guerra. Ahora, la **única forma** de obtener ganancias económicas de los conflictos es a través del **Botín Logístico**.
2.  **Motor de Botín Logístico**:
    *   Creado `utils/engine/logisticLoot.ts` para gestionar la generación de botín (30% del coste de unidades destruidas), su expiración y recolección.
    *   Implementada la fusión de todos los restos de una guerra en un **Mega Botín Logístico** al finalizar el conflicto.
3.  **Unidad de Salvamento (Salvager Drone)**:
    *   Nueva unidad logística dedicada exclusivamente a la recolección.
    *   Nueva tecnología `Logística de Salvamento` para desbloquearla.
4.  **IA de Bots Recolectores**:
    *   Los bots ahora compiten por los botines disponibles. Bots con personalidades *Rogue* o *Warlord* tienen más probabilidades de intentar "robar" restos de batallas ajenas.
5.  **Vista Dedicada (Salvage Zone)**:
    *   Se ha añadido una nueva pestaña en la navegación llamada **Salvamento**.
    *   Desde esta vista, el jugador puede ver todos los botines activos, su tiempo de expiración y enviar drones para recolectarlos.
6.  **Persistencia y Ciclo de Juego**:
    *   Integración total en el `GameState` (versión 7) y cálculo de progreso offline.
    *   Los botines que expiran sin ser recolectados se autoliquidan al 10% de su valor en el banco (reciclaje automático).

### Archivos Nuevos:
*   `utils/engine/logisticLoot.ts` (Motor core)
*   `utils/engine/salvage.ts` (Resolución de misiones)
*   `utils/engine/botSalvage.ts` (IA de bots)
*   `components/views/SalvageZoneView.tsx` (Nueva interfaz)

El sistema ahora crea un ciclo económico de guerra mucho más dinámico, donde defender tu base no solo te protege, sino que te permite recolectar los restos de la fuerza invasora enemiga.

---

## User

ataque a un bot y perdieron tropas tanto el bot como yo pero nunca se crearon suministros para poder recojerlos. 

---

## Assistant

Es probable que el problema esté en la integración entre el resultado de la misión y la actualización del estado global. He revisado el código y, aunque `resolveMission` genera el botín, **`processSystemTick` no lo estaba agregando al array global de campos de botín**.

Voy a corregir esto ahora mismo en `utils/engine/systems.ts`.

### 1. Corregir `processSystemTick` en `systems.ts`
Necesito asegurarme de que cuando una misión de ataque termina, el botín generado se añada a `updatedLootFields`.

```typescript
// utils/engine/systems.ts

// ... dentro del bucle de misiones salientes ...
const outcome = resolveMission(...);

// NUEVO: Agregar el botín generado por la batalla al estado global
if (outcome.generatedLogisticLoot) {
    updatedLootFields.push(outcome.generatedLogisticLoot);
}
```

### 2. Verificar el umbral mínimo en `logisticLoot.ts`
También hay un check en `logisticLoot.ts` que ignora botines de valor menor a 1000. Si la batalla fue muy pequeña, podría no generarse.

Voy a aplicar la corrección en `systems.ts` de inmediato.

**Tool: read**

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

Tienes razón, el problema era que el sistema procesaba la batalla pero **se olvidaba de guardar el botín generado en el estado global**. 

He realizado dos correcciones críticas:
1.  **En `systems.ts`**: Ahora el motor de misiones captura el `generatedLogisticLoot` devuelto por la batalla y lo añade correctamente a la lista de botines activos del jugador.
2.  **En `logisticLoot.ts`**: He reducido el umbral mínimo de generación de 1000 a 10. Antes, si las pérdidas totales en la batalla eran pequeñas, el sistema simplemente descartaba el botín por ser "insignificante".

Ahora, cualquier ataque (PvP contra bots, Campaña o Guerra) que resulte en bajas debería generar suministros visibles en la pestaña **Salvamento**. 

¿Podrías intentar un ataque pequeño ahora? Deberías ver los suministros aparecer casi instantáneamente al terminar la misión.

---

## User

---

## Assistant

---
## Goal

The user is implementing a new **"Guerra Total" (Total War)** system for the Iron Dune game, which merges current combat mechanics with an OGame-inspired **"Botín Logístico" (Logistic Loot)** system. The objective is to replace direct resource gains from war/raids with recoverable debris fields generated after units are destroyed in combat.

## Instructions

- **Botín Logístico**: This is the new name for the "debris fields". It represents 30% of the production cost of destroyed units (Money, Oil, Ammo).
- **Economic Shift**: Direct loot pools from war have been removed. Players must now deploy **Salvager Drones** to collect resources from the battlefield.
- **Shared Access**: Botín Logístico fields are visible and accessible to both players and bots. Bots can actively "steal" resources from these fields.
- **Dedicated View**: A new "Salvamento" (Salvage) tab allows players to monitor active fields and manage salvage missions.
- **Persistence**: The system must integrate perfectly with the existing save system (migrated to Version 7) and Trystero (P2P).

## Discoveries

- **State Sync**: In `utils/engine/systems.ts`, the generated loot from `resolveMission` must be explicitly pushed to the global `logisticLootFields` array; otherwise, combat results won't appear in the UI.
- **Thresholding**: In `utils/engine/logisticLoot.ts`, the `totalValue` threshold for field generation was reduced from 1000 to 10 to ensure small skirmishes also produce visible loot for testing.
- **Removal of lootPool**: `WarState.lootPool` has been entirely removed from the types and engine, replaced by `warLogisticLootIds` and related accumulators.

## Accomplished

### Core Implementation
- **Plan Created**: `Plan_Guerra_Total.md` contains the full design spec.
- **Types & Enums**: Defined `LogisticLootField`, `SALVAGER_DRONE` unit, and `UNLOCK_SALVAGER_DRONE` tech.
- **Engine**: Created `utils/engine/logisticLoot.ts` (generation, tick, harvest) and `utils/engine/salvage.ts` (mission resolution).
- **Migration**: Incremented `SAVE_VERSION` to 7 and updated `migration.ts` to handle new state fields.

### Integration
- **War Logic**: Modified `war.ts` to remove `lootPool` logic and generate loot fields per wave, merging them into a "Mega Loot" at the end of the war.
- **Missions**: Updated `missions.ts` and `systems.ts` to generate loot from PvP and Campaign attacks and resolve `SALVAGE` missions.
- **Loop & Offline**: Integrated the loot tick into `loop.ts` and `offline.ts` for expiration and auto-salvage (10% recovery upon expiry).
- **Bot AI**: Created `utils/engine/botSalvage.ts` where bots occasionally harvest active fields.

### UI & UX
- **Salvage View**: Created `components/views/SalvageZoneView.tsx` and registered it in the `ViewRouter`.
- **Navigation**: Added the "Salvamento" tab to `GameSidebar.tsx`.
- **I18n**: Added English and Spanish translations for all new logs, units, and UI elements.

## Relevant files / directories

- **`utils/engine/`**: `logisticLoot.ts`, `salvage.ts`, `botSalvage.ts`, `war.ts`, `missions.ts`, `systems.ts`, `loop.ts`, `offline.ts`, `migration.ts`.
- **`types/`**: `state.ts`, `enums.ts`, `multiplayer.ts`, `events.ts`, `defs.ts`.
- **`data/`**: `units.ts`, `techs.ts`, `initialState.ts`.
- **`components/views/`**: `SalvageZoneView.tsx`.
- **`components/`**: `GameSidebar.tsx`, `layout/ViewRouter.tsx`.
- **`i18n/`**: `en/`, `es/`.
- **`Plan_Guerra_Total.md`**: Implementation roadmap.

## Next Steps

1.  **Testing**: Verify that combat with bots now consistently generates fields in the "Salvamento" tab.
2.  **P2P Integration**: Implement Phase 5 of the plan, enabling `DEBRIS_ANNOUNCE` and `DEBRIS_CLAIM` actions via Trystero so remote players can see and contest loot fields.
3.  **UI Polish**: Add visual notifications (toasts) when a new loot field is generated or when a bot steals resources.
4.  **Escort Mechanic**: Implement the "Escort" logic in `salvage.ts` to allow military units to protect drones during collection.

---

## User

bien ahora hay que asegurarnos de que los suministros de una batalla se creen sean en ataqu/defensiva del bot vs jugador o jugador vs bot. hay que asegurarnos de que cuando todos os suministros sean recogidos y lleguen a 0 deben eliminarse. Asegurae que los suministros que aun no son recogidos tengan persistencia en el localstorage de forma precisa y robusta

---

## Assistant

Entendido. Voy a revisar y robustecer la lógica de generación, limpieza y persistencia del **Botín Logístico**.

### Plan de acción:
1.  **Verificación de Generación**: Comprobar en `systems.ts`, `missions.ts` y `war.ts` que `generateLogisticLootFromCombat` se llame en todos los flujos (Atacante/Defensor, Jugador/Bot).
2.  **Limpieza Automática**: Asegurar que en `harvestLogisticLoot` o en el loop de actualización se eliminen los campos cuyos recursos sean 0.
3.  **Persistencia**: Verificar que `logisticLootFields` esté correctamente integrado en el estado global y el sistema de guardado (Version 7).

Empezaré explorando los archivos relevantes.

**Tool: glob**

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

**Tool: edit**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: glob**

---

## Assistant

**Tool: glob**

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

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: glob**

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

**Tool: read**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: edit**

---

## Assistant

He robustecido el sistema de **Botín Logístico** para asegurar que sea preciso, persistente y que se limpie correctamente.

### Cambios realizados:

1.  **Generación Universal de Botín**:
    *   **Ataques Entrantes (Bot vs Jugador)**: He actualizado `processIncomingAttackInQueue` en `attackQueue.ts` para que genere escombros tras la batalla. Antes solo los ataques salientes lo hacían.
    *   **Integración en el Motor**: En `systems.ts`, ahora se capturan y guardan los escombros generados por ataques de bots contra el jugador.
    *   **Guerra y Campaña**: Se ha verificado que tanto las oleadas de guerra como las misiones de campaña sigan generando escombros correctamente.

2.  **Limpieza Automática de Campos Vacíos**:
    *   **Tick de Actualización**: He modificado `processLogisticLootTick` en `logisticLoot.ts` para que elimine inmediatamente cualquier campo cuyo `totalValue` sea 0.
    *   **Resolución Inmediata**: En `systems.ts`, al resolver una misión de salvamento, si el campo queda vacío se elimina del estado sin esperar al siguiente tick, mejorando la respuesta de la UI.
    *   **Reordenación del Loop**: En `loop.ts` y `offline.ts`, he movido el proceso de limpieza al final de la secuencia de combate y robos de bots, asegurando que el estado guardado nunca contenga campos vacíos.

3.  **Persistencia y Migración Robustas**:
    *   **Migración de Datos**: He actualizado `migration.ts` para incluir los campos `logisticLootFields`, `visibleLogisticLootFields` y `lifetimeLogisticStats` en el bloque de migración de versión (V7). Esto asegura que los datos no se pierdan al actualizar el juego o importar partidas.
    *   **Estado Inicial**: Se ha confirmado que `initialState.ts` inicializa correctamente estas estructuras para nuevas partidas.

4.  **Procesamiento Offline**:
    *   Se ha integrado la limpieza y generación de botín en el cálculo offline, permitiendo que las batallas que ocurrieron mientras el jugador no estaba también dejen escombros listos para ser recogidos al volver.

Con estos cambios, el sistema de "Guerra Total" es ahora el único motor económico de conflicto, eliminando por completo el antiguo `lootPool` y forzando el uso de **Salvager Drones** para la recuperación de recursos.

---

## User

bien trate de enviar los drones que ya tengo, 40, a recuperar 19M de dinero, 470k de municion y petroleo pero no se envia nunca la mision de recuperacion de resttos de batalla ni se inicia el movimiento ni la alerta de movimiento parecida a las alertas de ataque saliente, patrullaje etc.

---

## Assistant

**Tool: glob**

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

**Tool: glob**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: glob**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: glob**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: glob**

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

**Tool: edit**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: glob**

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

**Tool: edit**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: edit**

---

## Assistant

**Tool: glob**

---

## Assistant

**Tool: glob**

---

## Assistant

**Tool: read**

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

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

He identificado y corregido el problema por el cual las misiones de salvamento no se iniciaban ni mostraban alertas de movimiento.

### Problemas solucionados:

1.  **Error de Cableado en la Vista (ViewRouter)**:
    *   La pestaña de "Salvamento" estaba vinculada erróneamente a la función `startMission` (diseñada para patrullas PvE) en lugar de `startSalvageMission`. Esto causaba que, al hacer clic en el botón, se llamara a la función incorrecta con argumentos incompatibles, por lo que la misión nunca se creaba.
    *   He actualizado `ViewRouter.tsx` para que pase la acción correcta: `startSalvageMission`.

2.  **Faltaba la Acción en el Contexto Global**:
    *   La función `startSalvageMission` no estaba expuesta a través de `GameContext.tsx`, lo que impedía que los componentes de la interfaz pudieran acceder a ella. He añadido la exportación necesaria en el proveedor de estado.

3.  **Faltaban Alertas Visuales**:
    *   El componente `ActiveAttacksIndicator.tsx` (que muestra las alertas de movimiento como "Ataque Enviado", "Patrulla", etc.) no tenía configurado el tipo de misión `SALVAGE`.
    *   He añadido una nueva categoría de alerta de color amarillo con el icono de herramientas, específicamente para el salvamento de escombros. Ahora verás una alerta similar a la de un ataque saliente cuando tus drones estén en camino.

4.  **Localización e Idiomas**:
    *   He añadido las claves de traducción faltantes (`mission_salvage`, `salvages_active`) tanto en inglés como en español para que los textos de las alertas aparezcan correctamente.

Con estos cambios, al enviar tus 40 drones (con capacidad para 20M), deberías ver inmediatamente la alerta de movimiento en la parte superior/derecha de la pantalla y los drones se descontarán de tu base hasta que regresen con los suministros.

---

