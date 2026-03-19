# Plan Maestro - Migracion a Arquitectura Server-Authoritative
Fecha: 2026-03-17  
Proyecto: Iron Dune Operations  
Modalidad: Ejecucion secuencial (1 desarrollador)

---

## 1) Objetivo tecnico

Eliminar perdidas de progreso, reinicios por conflictos, y divergencia cliente-servidor migrando de:

- **Modelo actual**: estado monolitico en cliente + autosave por blob.
- **Modelo objetivo**: **comandos server-side + estado critico autoritativo en backend + cliente como proyeccion/UI**.

---

## 2) Principios no negociables

1. **Single Source of Truth**: recursos, progreso persistente y validaciones criticas viven en servidor.
2. **Command-first**: el cliente no "sube estado"; envia intencion (`BUILD`, `RECRUIT`, etc.).
3. **Concurrencia explicita**: toda mutacion con `revision` (optimistic locking).
4. **Modelo de datos normalizado** para dominio critico.
5. **Bootstrap determinista**: no entra a PLAYING hasta estado integro validado.
6. **Observabilidad total**: metricas, trazas y alertas de conflictos/errores.

---

## 3) Estado actual (riesgos detectados)

- Endpoints de batalla sin auth (riesgo de abuso).
- Operaciones de recursos con patron read-then-write (riesgo de carrera).
- Varias acciones solo locales que alteran recursos/progreso.
- Guardado periodico por blob que puede pisar progreso con conflictos.
- Dependencia de `game_state` JSONB para datos criticos/ranking.

---

## 4) Estrategia de migracion (Strangler Fig)

No reescribir todo de una vez.  
Se rodea el sistema viejo con capas nuevas y se migra por dominio:

1. **Estabilizar** (evitar perdida de progreso ya).
2. **Introducir command gateway**.
3. **Migrar acciones una por una** (feature flags).
4. **Normalizar tablas criticas**.
5. **Retirar gradualmente rutas legacy**.

---

## 5) Fases de ejecucion (0 -> 5)

## Fase 0 - Estabilizacion de emergencia (Dia 1-2)

### Objetivo
Cerrar fugas graves sin cambiar aun el paradigma completo.

### Tareas
- [ ] Proteger `/api/battle/*` con `requireAuthUser`.
- [ ] Hacer deduccion/suma de recursos atomica (SQL transaccional o funcion RPC).
- [ ] Unificar creacion garantizada de `player_resources` en todos los caminos de guardado/carga.
- [ ] Hardening de hidratacion en cliente para evitar `undefined` en campos criticos.
- [ ] Anadir logs estructurados en errores 401/404/409 y traceId consistente.

### Entregables
- Endpoints criticos autenticados.
- Recursos sin race condition basica.
- Cliente no crashea por payload parcial.

### Criterios de aceptacion
- 0 crashes por `resources undefined`.
- 0 saves perdidos por conflicto simple en prueba de 2 pestanas durante 10 minutos.
- Todos los `/api/battle/*` devuelven 401 sin token.

### Rollback
- Feature flag `SAFE_MODE_ATOMIC_RESOURCES=false` para volver al metodo previo temporalmente.

---

## Fase 1 - Command Gateway (Dia 3-9)

### Objetivo
Cambiar "estado por blob" por "intenciones validadas en servidor".

### Diseno
Crear endpoint unico:
- `POST /api/command`
- Payload:
  - `commandId` (uuid)
  - `type` (enum)
  - `payload` (schema por comando)
  - `expectedRevision` (number)

Respuesta:
- `ok`
- `newRevision`
- `statePatch` (solo campos impactados)
- `serverTime`
- `diagnostics` (warnings)

### Comandos iniciales (MVP)
- `BUILD_START`
- `BUILD_REPAIR`
- `RECRUIT_START`
- `RESEARCH_START`
- `SPEEDUP`
- `TRADE_EXECUTE`
- `DIAMOND_EXCHANGE`
- `ESPIONAGE_START`

### Comandos segunda ola
- `BANK_DEPOSIT`
- `BANK_WITHDRAW`
- `TUTORIAL_CLAIM_REWARD`
- `GIFT_CODE_REDEEM`
- `DIPLOMACY_GIFT`
- `DIPLOMACY_PROPOSE_ALLIANCE`
- `DIPLOMACY_PROPOSE_PEACE`

### Cambios cliente
- Reemplazar `applyActionWithServerValidation` por `dispatchCommand()`.
- Optimistic UI opcional + reconciliacion por `statePatch`.
- Retries idempotentes con `commandId`.

### Entregables
- Gateway funcional con validacion por comando.
- Primer lote de acciones migrado.
- Tabla/registro de comandos procesados para idempotencia (si aplica).

### Criterios de aceptacion
- 100% de acciones de economia pasan por `/api/command`.
- Doble click o reintento de red no duplica efectos.
- Conflictos devuelven error tipado (`REVISION_MISMATCH`) con politica de re-sync.

---

## Fase 2 - Normalizacion de datos criticos (Dia 10-19)

### Objetivo
Sacar dominio critico de `profiles.game_state`.

### Nuevas tablas
- `player_buildings(player_id, building_type, level, is_damaged, updated_at)`
- `player_units(player_id, unit_type, count, updated_at)`
- `player_tech(player_id, tech_type, level, unlocked_at, updated_at)`
- `player_queues(id, player_id, queue_type, target_type, target_id, count, start_time, end_time, status)`
- `player_progress(player_id, campaign_progress, empire_points, last_save_time, updated_at)`  
(ajusta naming segun convenciones del proyecto)

### Plan de migracion de datos
1. Script backfill desde `profiles.game_state` a nuevas tablas.
2. Validar conteos/consistencia.
3. Activar dual-write temporal (legacy + nuevo).
4. Cortar lectura legacy por feature flag.
5. Congelar campos legacy en blob.

### Entregables
- Dominio critico en tablas normalizadas.
- Backfill ejecutado y validado.
- Dual-write y luego read-switch seguro.

### Criterios de aceptacion
- `empire_points` calculado server-side.
- Acciones criticas no dependen de campos criticos del JSONB.
- Integridad referencial completa.

---

## Fase 3 - Bootstrap determinista de cliente (Dia 20-23)

### Objetivo
Eliminar estados intermedios inestables y cargas parciales.

### Tareas
- [ ] Crear `GET /api/bootstrap` que retorne snapshot canonico:
  - perfil basico
  - recursos y rates
  - buildings/units/tech/progress
  - queues activas
  - metadata (`revision`, `serverTime`, `resetId`)
- [ ] Implementar state machine cliente:
  - `AUTHENTICATING -> SYNCING_TIME -> LOADING_BOOTSTRAP -> HYDRATED -> PLAYING`
- [ ] Bloquear render de pantallas jugables hasta `HYDRATED`.
- [ ] Manejo explicito de errores transitorios vs terminales.

### Entregables
- Carga inicial atomica.
- Desaparicion de race de "UI antes de datos".

### Criterios de aceptacion
- No hay acceso a vistas jugables con estado incompleto.
- No aparecen `404/409` como efecto visible de "reseteo" para usuario.

---

## Fase 4 - Integridad, seguridad y gobernanza (Dia 24-30)

### Objetivo
Blindar consistencia de produccion.

### Tareas
- [ ] Versionado obligatorio (`revision`) en todas las mutaciones.
- [ ] Validacion de payload (Zod/Joi) en comandos y bootstrap.
- [ ] Rate limit por usuario/IP para command gateway.
- [ ] Auditoria de permisos RLS y service-role boundaries.
- [ ] Rankings calculados desde tablas normalizadas (no JSONB cliente).
- [ ] Endurecer resets y remover credenciales hardcoded.

### Entregables
- Seguridad de superficie API mejorada.
- Concurrencia controlada y auditable.
- Ranking anti-manipulacion cliente.

### Criterios de aceptacion
- Pruebas de manipulacion de payload no alteran estado critico.
- Limites/rate limiting activos y medidos.

---

## Fase 5 - Observabilidad y pruebas de consistencia (Dia 31-35)

### Objetivo
Operar con confianza y detectar regresiones temprano.

### Tareas
- [ ] Metricas:
  - conflictos por minuto
  - tasa de error por comando
  - latencia p50/p95/p99
  - retry ratio
- [ ] Logging estructurado con `traceId`, `userId`, `commandId`, `revision`.
- [ ] Suite E2E:
  - 2 pestanas concurrentes
  - reconexion tras offline
  - creacion de cuenta + primer guardado
  - cola de construcciones/reclutamiento/research
  - caidas parciales de backend
- [ ] Dashboard y alertas (umbral de 409/5xx).

### Entregables
- Telemetria util para operacion diaria.
- Pruebas de regresion de consistencia.

### Criterios de aceptacion
- MTTD bajo (deteccion rapida de incidentes).
- 0 regresiones en flujo "new account -> play -> refresh -> progress intact".

---

## 6) Orden exacto de migracion de acciones (quirurgico)

1. `build`, `repair`, `recruit`, `research`, `speedUp`
2. `trade`, `diamondExchange`, `spy`
3. `bankDeposit/withdraw`
4. `tutorialClaimReward`, `giftCodeRedeem`
5. `diplomacy*`
6. P2P recursos y batalla (ultimo bloque por complejidad)

No avanzar al bloque siguiente hasta pasar pruebas del bloque actual.

---

## 7) Feature flags recomendadas

- `FF_COMMAND_GATEWAY`
- `FF_NORMALIZED_READS`
- `FF_DUAL_WRITE_NORMALIZED`
- `FF_BOOTSTRAP_V2`
- `FF_RANKING_SERVER_ONLY`
- `FF_DISABLE_LEGACY_SAVE_BLOB`

---

## 8) Definicion de Done global (DoD)

Se considera migracion completada cuando:

- [ ] Ninguna accion critica muta estado solo en cliente.
- [ ] Recursos/progreso critico 100% autoritativos en servidor.
- [ ] `profiles.game_state` ya no es fuente de verdad para dominio critico.
- [ ] Todas las mutaciones usan `revision` + validacion de schema.
- [ ] E2E de concurrencia y reconexion en verde.
- [ ] Metricas y alertas activas en produccion.

---

## 9) Checklist operativo diario (1 dev)

Cada dia:
1. Implementar 1 bloque pequeno.
2. Correr tests unitarios + integracion.
3. Ejecutar prueba manual de 2 pestanas.
4. Revisar metricas de errores/conflictos.
5. Documentar cambios y decisiones.

No mezclar mas de 1 eje critico por dia (concurrencia, schema, bootstrap, etc.).

---

## 10) Riesgos y mitigaciones

- **Riesgo**: migracion de datos inconsistente  
  **Mitigacion**: backfill + dual-write + compare job nocturno.
- **Riesgo**: regressions UI por nuevo bootstrap  
  **Mitigacion**: feature flag + rollout progresivo.
- **Riesgo**: aumento temporal de latencia  
  **Mitigacion**: `statePatch` en vez de snapshot completo y profiling.
- **Riesgo**: conflictos de revision en picos  
  **Mitigacion**: re-sync automatico + retry idempotente acotado.

---

## 11) Resultado esperado al finalizar

- No mas "se recarga y pierdo progreso".
- No mas economia divergente entre cliente/servidor.
- Estado consistente multi-pestana/multi-dispositivo.
- Plataforma lista para escalar features sin deuda de sincronizacion.
