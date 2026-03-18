# Checklist de Avance - Plan Arquitectura Server-Authoritative

Fecha de corte: 2026-03-17
Referencia: `PLAN_ARQUITECTURA_SERVER_AUTORITATIVA.md`

## Criterio de estados

- [x] Cumplido
- [~] Parcial / en transición
- [ ] Pendiente

---

## Fase 0 - Estabilización de emergencia

- [x] Proteger `/api/battle/*` con `requireAuthUser`.
- [x] Deducción/suma de recursos atómica vía RPC SQL (`resource_deduct_atomic` / `resource_add_atomic`).
- [x] Creación garantizada de `player_resources` (`ensure_player_resources`) en caminos críticos.
- [~] Hardening de hidratación cliente contra estados parciales/undefined (state machine y bloqueo de juego ya están, falta cierre formal con criterio de cero crashes medido).
- [x] Logs estructurados y `traceId` consistente en errores críticos (incluye 401/409 en flujos clave).

Estado Fase 0: [~] Parcial alto

---

## Fase 1 - Command Gateway

- [x] `POST /api/command` implementado con `commandId`, `type`, `payload`, `expectedRevision`.
- [x] Idempotencia por `commandId` implementada con `player_commands`.
- [x] Concurrencia por `revision` con error tipado `REVISION_MISMATCH`.
- [x] Primer lote de comandos migrado (build/repair/recruit/research/speedup/trade/diamond/spy).
- [x] Segunda ola de comandos migrada (bank/tutorial/gift/diplomacy).
- [x] Validación por contrato por `command type` + normalización defensiva de payload vacío.
- [~] Objetivo "100% acciones economía por `/api/command`" en transición (gateway activo, pero persiste guardado legacy por blob para compatibilidad).

Estado Fase 1: [~] Parcial alto

---

## Fase 2 - Normalización de datos críticos

- [x] Tablas normalizadas creadas (`player_buildings`, `player_units`, `player_tech`, `player_queues`, `player_progress`).
- [x] Script/función de backfill disponible (`sync_player_domain_from_state` + `backfill_player_domain_from_profiles`).
- [x] Dual-write disponible con feature flag.
- [x] Read-switch disponible con feature flag (`FF_NORMALIZED_READS`).
- [ ] Corte completo de dependencia de `profiles.game_state` para dominio crítico.
- [ ] Congelar definitivamente campos legacy del blob para evitar divergencias.

Estado Fase 2: [~] Parcial

---

## Fase 3 - Bootstrap determinista

- [x] `GET /api/bootstrap` implementado con snapshot canónico y metadata (`revision`, `serverTime`, `resetId`).
- [x] State machine cliente implementada (`AUTHENTICATING -> SYNCING_TIME -> LOADING_BOOTSTRAP -> HYDRATED -> PLAYING`).
- [x] Bloqueo de vistas jugables hasta hidratación.
- [x] Manejo explícito de errores transitorios vs terminales + política de reintentos.

Estado Fase 3: [x] Cumplida

---

## Fase 4 - Integridad, seguridad y gobernanza

- [x] Versionado por `revision` activo en mutaciones del command gateway.
- [x] Rate limit por usuario/IP activo en `/api/command`.
- [~] Validación de payload robusta implementada (custom), pero pendiente adopción formal de esquema declarativo (Zod/Joi) si se mantiene ese criterio del plan.
- [ ] Auditoría completa de permisos RLS y límites service-role en todo el dominio nuevo.
- [ ] Rankings calculados desde tablas normalizadas (aún hay dependencia de `game_state` en ranking actual).
- [~] Endurecimiento de resets avanzado (`dbReset` robusto), pendiente cierre formal de hardening/secret hygiene de extremo a extremo.

Estado Fase 4: [~] Parcial

---

## Fase 5 - Observabilidad y pruebas de consistencia

- [x] Métricas clave implementadas: conflictos/min, error rate por comando, latencias p50/p95/p99, retry ratio.
- [x] Endpoint operativo de métricas de comandos disponible.
- [~] Logging estructurado amplio en backend, pendiente estandarización total en todos los flujos (incluyendo `commandId/revision` de forma uniforme).
- [ ] Suite E2E completa del plan (2 pestañas, offline/reconnect, colas, caídas parciales) no cerrada al 100%.
- [ ] Dashboard + alertas productivas conectadas a canal operativo (hoy hay señales/thresholds en código, falta circuito completo).

Estado Fase 5: [~] Parcial

---

## DoD global del plan

- [~] Ninguna acción crítica muta estado solo en cliente.
- [~] Recursos/progreso crítico mayormente autoritativos en servidor (no 100% cerrado por legado).
- [ ] `profiles.game_state` deja de ser fuente de verdad crítica.
- [~] Mutaciones críticas con `revision` + validación de schema (falta cierre formal declarativo global).
- [ ] E2E de concurrencia y reconexión completamente en verde.
- [~] Métricas activas en producción; falta cierre completo de alertas operativas externas.

---

## Plan paso a paso para completar lo pendiente (orden recomendado)

### Paso 1 - Cerrar legado de guardado por blob (impacto alto)

- [~] Introducir `FF_DISABLE_LEGACY_SAVE_BLOB` en backend+cliente (implementado en código; pendiente activación en entorno objetivo).
- [~] Redirigir definitivamente mutaciones de economía/progreso a `/api/command` únicamente (cliente ya opera por gateway; endpoints legacy `/api/resources/*` y `profile/save` quedan bloqueables por feature flag para corte gradual).
- [~] Dejar `profile/save` solo para compatibilidad temporal no crítica (implementado retorno controlado `LEGACY_SAVE_DISABLED` detrás de feature flag).
- [ ] Validar que no haya regresión en bootstrap ni en progreso al refrescar.

### Paso 2 - Server-authoritative real en colas/tiempos (build/recruit/research)

- [~] Mover cálculo de tiempos/costos definitivos al backend command handler (implementado para `BUILD_START`/`RECRUIT_START`/`RESEARCH_START` y `SPEEDUP` de colas críticas).
- [~] Hacer que el cliente deje de proponer parches críticos de colas y reciba `statePatch` autoritativo (migrado para comandos de lifecycle + speedup en build/recruit/research; falta extender al resto de comandos críticos).
- [~] Cubrir doble click/retry/reconexión con pruebas específicas (hay cobertura de idempotencia/revision mismatch e invariantes de lifecycle autoritativo; pendiente cierre E2E multi-tab de larga duración).

### Paso 3 - Ranking y progreso 100% normalizado

- [ ] Reescribir `/api/rankings/players` para leer exclusivamente tablas normalizadas.
- [ ] Calcular `empire_points` server-side desde datos normalizados.
- [ ] Eliminar dependencia de `rankingStats` dentro de `game_state` para ranking oficial.

### Paso 4 - Cerrar migración de datos crítica

- [ ] Ejecutar backfill validado en entorno objetivo.
- [ ] Activar dual-write estricto temporalmente y comparar consistencia.
- [ ] Activar `FF_NORMALIZED_READS=true` en producción con monitoreo.
- [ ] Congelar campos legacy críticos en blob y documentar deprecación.

### Paso 5 - Seguridad y gobernanza final

- [ ] Auditoría RLS completa sobre tablas normalizadas y comandos.
- [ ] Revisar y endurecer boundaries de service-role.
- [ ] Verificación explícita de secrets/config en reset y scripts operativos.

### Paso 6 - Observabilidad y operación

- [ ] Estandarizar log schema mínimo: `traceId`, `userId`, `commandId`, `expectedRevision`, `newRevision`, `errorCode`.
- [ ] Conectar thresholds actuales a alertas reales (Render + canal operativo).
- [ ] Definir runbook de incidentes para `REVISION_MISMATCH`, `COMMAND_FAILED`, `BAD_REQUEST` por tipo.

### Paso 7 - Suite de pruebas de consistencia (cierre de plan)

- [ ] E2E: 2 pestañas en paralelo durante 10+ min sin pérdida de progreso.
- [ ] E2E: offline/reconnect con replay idempotente correcto.
- [ ] E2E: queue lifecycle completo (build/recruit/research) tras refresh y reinicio backend.
- [ ] E2E: tolerancia a caídas parciales de backend sin corrupción de estado.

---

## Bloque de ejecución inmediata sugerido (sprint corto)

- [ ] Sprint A: Paso 1 + Paso 2.
- [ ] Sprint B: Paso 3 + Paso 4.
- [ ] Sprint C: Paso 5 + Paso 6 + Paso 7.

Objetivo de control por sprint:

- Sin regressions en `bootstrap`.
- Sin incremento sostenido de `badRequest` o `failed` en `/api/command`.
- Tendencia descendente de conflictos y divergencias cliente-servidor.
