# PLAN_ARQUITECTURA

## 1) Objetivo y criterios de exito

### Objetivo principal
Reducir de forma drastica las requests innecesarias a Supabase y mejorar la sincronizacion en tiempo real del frontend para un juego de estrategia tipo OGame, con backend autoritativo.

### Metas cuantitativas (KPI)
- Requests Supabase por usuario activo: de ~50/min a <10/min.
- Llamadas a `/api/bootstrap` durante gameplay: ~0 (solo login/reconexion/resync).
- p95 de `POST /api/command`: <250 ms.
- Latencia de actualizacion visual via socket: <300 ms.
- Incidentes de desincronizacion: <0.5% de sesiones.
- Disponibilidad de canal realtime (WS): >99%.

---

## 2) Diagnostico actual (resumen tecnico)

### Problemas estructurales detectados
1. **Polling redundante en cliente**
   - Sync periodico cada 5s que consulta bootstrap aunque exista socket.
2. **Autosave muy frecuente**
   - Guardado cada 10s del blob de estado desde frontend.
3. **Loops de backend con alta frecuencia**
   - Ciclos de 5s que disparan lecturas/escrituras continuas en Supabase.
4. **Arquitectura hibrida no consolidada**
   - Coexisten polling, realtime y guardado constante sin un flujo command-first unico.

### Impacto
- Costo alto y crecimiento no lineal de requests.
- Mayor riesgo de race conditions y conflictos por revision.
- Realtime menos estable por competir con polling agresivo.

---

## 3) Arquitectura objetivo (profesional)

## 3.1 Principio rector
**Backend autoritativo + Command Gateway + Event Push + Persistencia por lotes**.

## 3.2 Responsabilidades por capa

### Frontend (cliente)
- Renderizar estado y UX.
- Enviar solo comandos de intencion (`build`, `recruit`, `attack`, etc.).
- Aplicar deltas/eventos push del servidor.
- Usar bootstrap unicamente en login/reconexion/gap de eventos.

### Backend de juego (autoritativo)
- Validar y ejecutar comandos.
- Mantener secuencia de revisiones por jugador.
- Emitir eventos de cambio de estado por socket.
- Persistir snapshots/eventos de forma eficiente.

### Supabase/Postgres
- Auth/JWT y control de acceso.
- Persistencia durable (snapshots, command log, event log, rankings/reportes).
- No actuar como motor de tick en tiempo real del gameplay.

### Realtime
- Socket.io como canal principal de updates.
- Fallback a SSE/polling solo ante fallo de socket.

---

## 4) Modelo de datos recomendado

## 4.1 Tablas core

### `player_snapshots`
- `player_id` (pk parcial, indexado)
- `revision` (bigint)
- `state_json` (jsonb)
- `updated_at` (timestamptz)

### `player_commands`
- `command_id` (uuid unique)
- `player_id` (index)
- `expected_revision` (bigint)
- `command_type` (text)
- `payload_json` (jsonb)
- `response_payload` (jsonb)
- `created_at` (timestamptz)

### `player_events`
- `event_id` (bigserial o uuid monotono)
- `player_id` (index)
- `revision` (bigint, index)
- `event_type` (text)
- `delta_json` (jsonb)
- `created_at` (timestamptz)

## 4.2 Indices minimos
- `player_snapshots(player_id, revision desc)`
- `player_events(player_id, event_id desc)`
- `player_events(player_id, revision desc)`
- `player_commands(player_id, created_at desc)`
- `player_commands(command_id unique)`

---

## 5) Contratos de API y realtime

## 5.1 Bootstrap (solo inicial/recovery)
`GET /api/bootstrap`

Respuesta:
- `playerId`
- `serverTime`
- `revision`
- `state`
- `lastEventId`

## 5.2 Command gateway (unica puerta de mutaciones)
`POST /api/command`

Request:
- `commandId` (uuid)
- `type`
- `expectedRevision`
- `payload`

Response:
- `ok`
- `newRevision`
- `appliedDelta` (opcional)
- `errorCode` (si aplica)
- `traceId`

Reglas:
- Idempotencia estricta por `commandId`.
- Rechazo por `REVISION_MISMATCH` si `expectedRevision` no coincide.

## 5.3 Realtime (socket)
Eventos:
- `user_state_subscription` (ack de suscripcion)
- `user_state_changed` (delta + metadatos)

Payload recomendado para `user_state_changed`:
- `eventId`
- `playerId`
- `revision`
- `serverTime`
- `reason`
- `delta`

Reconexiones:
- Cliente envia `lastEventId`.
- Servidor reenvia backlog de eventos faltantes.
- Si no hay backlog suficiente: `force_resync=true` y cliente llama bootstrap.

---

## 6) Flujo operativo objetivo

1. Usuario inicia sesion y hace bootstrap.
2. Cliente abre socket y se suscribe al room del usuario.
3. Cliente ejecuta accion -> envia comando.
4. Backend valida/aplica comando (single-writer por jugador).
5. Backend persiste command + evento + snapshot (batch).
6. Backend responde ACK al comando y emite delta por socket.
7. Cliente aplica delta y actualiza UI por slices.

---

## 7) Estrategia de rendimiento y consistencia

## 7.1 Single-writer por jugador
- Garantizar que solo una ejecucion muta el estado de un jugador a la vez.
- Implementacion sugerida:
  - Con Redis: lock distribuido por `player_id` (recomendado).
  - Sin Redis: cola in-memory por proceso + afinidad por shard.

## 7.2 Persistencia eficiente
- Evitar guardar blob completo cada pocos segundos desde cliente.
- Persistir en backend:
  - en cada comando critico,
  - o en batch cada 2-5s para usuario activo,
  - y en eventos de cierre/reconexion.

## 7.3 Deltas en lugar de snapshots continuos
- Push de cambios minimos (resources, queues, timers, logs incrementales).
- Snapshot completo solo para bootstrap/resync.

## 7.4 Degradacion controlada
- Si socket falla: fallback temporal a polling con backoff (10s -> 20s -> 40s).
- Al recuperar socket: cortar polling inmediatamente.

---

## 8) Plan por fases (ejecutable)

## Fase 0 - Contencion inmediata (2-3 dias)
Objetivo: bajar trafico ya, sin rediseno completo.

Tareas:
- Subir intervalos actuales agresivos (polling/saves/ticks).
- Desactivar polling cuando socket este `SUBSCRIBED`.
- Limitar bootstrap a login/focus/reconnect con throttling.
- Instrumentar metricas base por endpoint y por usuario.

Entregable:
- Reduccion inicial de requests >40%.

## Fase 1 - Command-first real (1 semana)
Objetivo: consolidar mutaciones por un unico canal.

Tareas:
- Forzar que toda mutacion pase por `POST /api/command`.
- Eliminar autosave periodico del frontend.
- Responder comando con `newRevision` consistente.
- Emitir `user_state_changed` por cada mutacion aplicada.

Entregable:
- Frontend sin guardado por intervalo, solo por comandos.

## Fase 2 - Event stream + reconexion robusta (1-2 semanas)
Objetivo: realtime confiable y resync barato.

Tareas:
- Crear `player_events` y guardar deltas por revision.
- Implementar reconexion con `lastEventId`.
- Reenvio de backlog o `force_resync` segun gap.
- Cliente aplica eventos idempotentes por `eventId`.

Entregable:
- Recuperacion de sesion sin bootstrap repetitivo.

## Fase 3 - Proyecciones y escalado (1 semana)
Objetivo: separar gameplay de consultas secundarias.

Tareas:
- Worker async para rankings/reportes/logs historicos.
- Optimizar consultas de lectura con snapshots + proyecciones.
- Introducir sharding logico por `player_id` para command workers.

Entregable:
- Menor carga en path critico y mejor latencia p95.

## Fase 4 - Operacion continua (permanente)
Objetivo: observabilidad y control de costos.

Tareas:
- Dashboard de SLO/KPI (latencia, errores, req/min, desync).
- Alertas por regresion de request rate y conflict rate.
- Capacity planning mensual.

---

## 9) Mejoras especificas de frontend realtime

## 9.1 Store por slices
- Separar estado en dominios (`resources`, `queues`, `combat`, `reports`).
- Re-render granular y menor costo de reconciliacion.

## 9.2 Timers locales derivados
- No pedir al servidor cada segundo por countdowns.
- Derivar tiempo restante con `serverTime` y `endTime`.

## 9.3 Optimistic UI controlada
- Mostrar resultado inmediato local.
- Confirmar/ajustar con ACK + delta del servidor.
- Rollback automatico en errores de validacion.

## 9.4 Manejo de reconexion
- Estado `connecting/recovering/synced` visible en UI.
- Evitar acciones duplicadas mientras hay recovery.

---

## 10) Recomendaciones de infraestructura

## Recomendado (ideal)
- Backend Node.js + Socket.io + workers.
- Redis para locks, colas livianas y cache caliente por jugador.
- Supabase/Postgres para persistencia durable y auth.

## Minimo viable (sin Redis)
- Single instance con colas in-memory por jugador.
- Sticky sessions y afinidad por jugador.
- Limite de escala menor; valido para etapa temprana.

---

## 11) Riesgos y mitigacion

- **Desincronizacion cliente-servidor**
  - Mitigar con `revision`, `eventId`, resync controlado.
- **Duplicados por reintentos/red inestable**
  - Mitigar con idempotencia por `commandId` unique.
- **Races de concurrencia por jugador**
  - Mitigar con single-writer y lock por `player_id`.
- **Picos en guerras/eventos masivos**
  - Mitigar con sharding logico y colas por particion.

---

## 12) Checklist de implementacion inmediata (semana actual)

1. Reducir polling de bootstrap y apagarlo con socket activo.
2. Subir intervalo de autosave o eliminarlo en favor de command ACK.
3. Aumentar intervalo de loops de backend que escanean perfiles.
4. Centralizar mutaciones en `/api/command`.
5. Instrumentar metricas por endpoint + por jugador.
6. Definir contrato final de `user_state_changed` con `eventId` y `delta`.
7. Planificar migracion a `player_events` + reconexion por backlog.

---

## 13) Resultado esperado

Con este plan, el sistema pasa de una arquitectura reactiva por polling a una arquitectura profesional orientada a comandos y eventos, reduciendo costo de Supabase, mejorando consistencia y entregando una experiencia realtime robusta para un juego de estrategia en vivo.

---

## 14) Estado de avance (checklist vivo)

### Fase 0 - Contencion inmediata
- [x] Subir intervalos agresivos (autosave frontend y loops backend principales).
- [x] Desactivar polling agresivo cuando socket esta suscrito.
- [x] Limitar bootstrap en focus/reconnect con throttling.
- [x] Instrumentar metricas base por endpoint y por jugador.

### Fase 1 - Command-first real
- [x] Mantener `POST /api/command` como puerta principal de mutaciones.
- [x] Responder comando con `newRevision` consistente.
- [x] Emitir `user_state_changed` por cada mutacion aplicada.
- [x] Eliminar autosave periodico del loop frontend; persistencia legacy solo bajo guardado forzado/eventual.

### Fase 2 - Event stream + reconexion robusta
- [x] Crear `player_events` con indices y permisos/RLS.
- [x] Guardar deltas por evento al aplicar comandos.
- [x] Implementar reconexion con `lastEventId` en socket.
- [x] Reenvio de backlog o `force_resync` segun gap.
- [x] Cliente aplica eventos idempotentes por `eventId`.
- [x] Exponer `lastEventId` en bootstrap para recovery.

### Fase 3 - Proyecciones y escalado
- [ ] Worker async dedicado para rankings/reportes/log historico.
- [ ] Optimizar lecturas con snapshots/proyecciones separadas.
- [ ] Sharding logico por `player_id` para workers de comandos.

### Fase 4 - Operacion continua
- [~] Endpoints de metricas operativos (`/api/ops/command-metrics`, `/api/ops/endpoint-metrics`, `/api/ops/slo-summary`), pendiente dashboard.
- [x] Alertas automaticas backend por regresion de request rate/conflicts/error rate/latencia y disponibilidad de suscripcion socket (con cooldown).
- [ ] Capacity planning mensual formalizado.

### Infraestructura y operacion de reset
- [x] `DB_HARD_RESET` robusto para borrar objetos conocidos y desconocidos en schema `public`.
- [x] Recreacion integral de tablas core y politicas de seguridad tras reset.

### Proximo hito recomendado
- [~] Migracion incremental para `player_events` en entornos vivos: bootstrap automatico en startup con `exec_sql` cuando esta disponible; pendiente alternativa sin `exec_sql` para proyectos sin RPC habilitada.
