# Plan de migracion a Zustand (5 fases)

## Objetivo
Migrar el manejo de estado global basado en Context API hacia Zustand de forma incremental, con riesgo controlado, sin detener desarrollo y con mejoras medibles de rendimiento y mantenibilidad.

## Alcance inicial
- Migracion prioritaria: estado de juego (`GameContext`) por ser el mas grande y de mayor impacto en rerenders.
- Migracion posterior: `AuthContext` y `LanguageContext`.
- `MultiplayerContext` se evalua al final por su complejidad de sockets y side effects.

## Criterios de exito global
- No romper flujo de juego, guardado/carga ni autenticacion.
- Reducir rerenders en vistas principales (medido con React DevTools Profiler).
- Mantener tests existentes en verde (`npm run test`, `npm run typecheck`, `npm run build`).
- Eliminar providers no necesarios sin degradar DX.

---

## Fase 1 - Baseline y diseno de arquitectura (1 dia)

### Objetivo
Definir arquitectura de stores, establecer metricas base y preparar una migracion sin big-bang.

### Tareas
1. Levantar baseline tecnico:
   - Medir render count y commit time en: `components/layout/GameLayout.tsx`, `components/layout/ViewRouter.tsx`, `components/GameHeader.tsx`, `components/GameSidebar.tsx`.
   - Documentar estado actual de providers en `App.tsx`.
2. Definir estructura de store:
   - Crear carpeta objetivo: `stores/`.
   - Diseñar `gameStore` con slices:
     - `core`: `status`, `gameState`, `offlineReport`, `hasNewReports`.
     - `actions`: acciones de juego hoy expuestas por `useGameEngine`.
     - `persistence`: adaptacion de `usePersistence`.
3. Definir estrategia de compatibilidad:
   - Mantener temporalmente `useGame()` como wrapper para no romper imports.
   - Introducir hooks selector: `useGameStore(selector)` y selectores reutilizables.

### Entregables
- Documento corto de arquitectura (este archivo + decisiones en PR).
- Lista de metricas baseline antes de migrar.

### Criterio de aceptacion
- Equipo alineado en estructura de store, nomenclatura y estrategia de migracion incremental.

---

## Fase 2 - Implementacion del gameStore y adaptadores (1-2 dias)

### Objetivo
Crear `gameStore` funcional en paralelo al Context actual, sin cambiar aun todo el consumo.

### Tareas
1. Instalar y configurar:
   - Agregar dependencia `zustand`.
   - Evaluar middleware `subscribeWithSelector` y `devtools`.
2. Implementar store base:
   - Nuevo archivo sugerido: `stores/gameStore.ts`.
   - Mover estado y acciones desde `hooks/useGameEngine.ts` y `hooks/useGameActions.ts`.
   - Mantener semantica de negocio y contratos existentes.
3. Integrar side effects:
   - Encapsular loop/persistencia/eventBus con funciones de inicializacion/cleanup para evitar fugas.
   - Definir inicializacion unica al montar app.
4. Crear capa de compatibilidad:
   - Reescribir `context/GameContext.tsx` como bridge temporal al store.
   - Mantener API actual de `useGame()` para minimizar churn.

### Entregables
- `gameStore` operativo con compatibilidad retroactiva.
- PR sin cambios masivos en componentes (solo infraestructura).

### Criterio de aceptacion
- Juego funciona igual que antes, tests pasan y no hay regresion funcional visible.

---

## Fase 3 - Migracion de consumidores a selectors finos (1-2 dias)

### Objetivo
Reducir rerenders migrando componentes de `useGame()` completo a selectores especificos.

### Tareas
1. Priorizar componentes de alto impacto:
   - `components/layout/GameLayout.tsx`
   - `components/layout/ViewRouter.tsx`
   - `components/GameHeader.tsx`
   - `components/GameSidebar.tsx`
2. Migrar patrones de consumo:
   - De `const { gameState } = useGame()`
   - A `useGameStore(s => s.gameState.<subcampo>)` o selectores memoizados.
3. Crear modulo de selectores:
   - `stores/selectors/gameSelectors.ts` con selectores reutilizables.
4. Validar rendimiento:
   - Comparar con baseline de Fase 1 (render count y commit time).

### Entregables
- Componentes criticos migrados a selectors.
- Evidencia de mejora de rerender en al menos 2 vistas principales.

### Criterio de aceptacion
- Reduccion medible de renders innecesarios sin perdida de funcionalidad.

---

## Fase 4 - Migracion de contextos secundarios y limpieza (1-2 dias)

### Objetivo
Reducir complejidad del arbol de providers y unificar patron de estado global.

### Tareas
1. Migrar `AuthContext` a `authStore`:
   - Estado: `session`, `user`, `loading`.
   - Acciones: `signOut`, suscripcion a `supabase.auth.onAuthStateChange`.
2. Migrar `LanguageContext` a `languageStore`:
   - Estado: `language`.
   - Derivado: diccionario `t`.
3. Evaluar `MultiplayerContext`:
   - Si se migra, hacerlo con store dedicado y control estricto de lifecycle de socket.
   - Si no se migra, documentar decision tecnica y razones.
4. Limpiar `App.tsx`:
   - Remover providers obsoletos y simplificar composicion.

### Entregables
- `authStore` y `languageStore` en produccion.
- `App.tsx` simplificado.
- Decision registrada sobre `MultiplayerContext`.

### Criterio de aceptacion
- Menor cantidad de providers, sin romper auth, idioma ni multiplayer.

---

## Fase 5 - Hardening, QA y cierre (1 dia)

### Objetivo
Cerrar migracion con calidad de produccion, pruebas y documentacion operativa.

### Tareas
1. QA funcional y tecnica:
   - Flujo completo de login/logout.
   - Flujo principal de juego (build, recruit, research, missions, reportes).
   - Persistencia y recuperacion de partida.
2. Pruebas automatizadas:
   - Ejecutar `npm run test`.
   - Ejecutar `npm run typecheck`.
   - Ejecutar `npm run build`.
3. Observabilidad y DX:
   - Integrar `devtools` de Zustand (solo desarrollo).
   - Verificar ausencia de memory leaks por subscripciones.
4. Documentacion final:
   - Guia corta de patrones: cuando usar selector, cuando usar accion, anti-patrones.
   - Checklist para nuevas features.

### Entregables
- Migracion estable y documentada.
- Checklist de mantenimiento post-migracion.

### Criterio de aceptacion
- Build y tests verdes, sin regresiones criticas y con mejora de rendimiento validada.

---

## Riesgos y mitigaciones
- Riesgo: regresiones por side effects acoplados en `useGameEngine`.
  - Mitigacion: fase de bridge, PRs pequenos, tests por modulo.
- Riesgo: rerenders no mejoran por selectores mal definidos.
  - Mitigacion: centralizar selectores y usar comparadores cuando aplique.
- Riesgo: complejidad en multiplayer por sockets.
  - Mitigacion: migracion opcional y separada del core game state.

## Estrategia de PRs recomendada
1. PR1: Infraestructura Zustand + `gameStore` base.
2. PR2: Bridge de `GameContext` y validacion funcional.
3. PR3: Migracion de consumidores criticos a selectors.
4. PR4: `authStore` + `languageStore` + limpieza de providers.
5. PR5: Hardening, docs y cierre.

## Estimacion total
- Escenario conservador: 6-8 dias habiles.
- Escenario optimista (sin bloqueos de multiplayer): 5-6 dias habiles.
