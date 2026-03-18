# Runbook de Incidentes - Server Modularizado

## Objetivo

Definir ownership por modulo y ruta de diagnostico para incidentes tras la modularizacion de `server/index.js`.

## Ownership por modulo

- `server/index.js`
  - Composition root (wiring de rutas/sockets, bootstrap de procesos).
- `server/socket/userStateRealtime.js`
  - Suscripcion autenticada y emision de `user_state_changed`.
- `server/socket/globalPresence.js`
  - Presencia y señalizacion multiplayer (`peer_join`, `peer_leave`, `remote_action`).
- `server/routes/commandRoutes.js`
  - Exposicion de `/api/command` y `/api/ops/command-metrics`.
- `server/services/commandService.js`
  - Idempotencia, revision locking, state patch autoritativo y persistencia de comandos.
- `server/middleware/commandRateLimit.js`
  - Limite de tasa de `/api/command`.
- `server/routes/bootstrapRoutes.js`
  - Exposicion de `/api/bootstrap`.
- `server/services/bootstrapService.js`
  - Snapshot canonico, lifecycle resolve, lectura normalizada opcional.
- `server/routes/profileRoutes.js`
  - Lectura/escritura de perfil legacy controlada por feature flag.
- `server/routes/resourceRoutes.js`
  - Endpoints legacy de recursos y bloqueo por feature flag.
- `server/middleware/auth.js`
  - Autenticacion `Bearer` para endpoints protegidos.
- `server/lib/trace.js`
  - `traceId`, normalizacion de errores, IDs cortos para logs.
- `server/lib/statePatch.js`
  - Utilidades de revision y estado parcial (`sanitize`/`build patch`).

## Triage rapido

1. Verificar `x-trace-id` del request y correlacionar logs.
2. Identificar dominio afectado (command/bootstrap/socket/profile/resource).
3. Validar feature flags activas (`FF_*`) impresas al iniciar server.
4. Revisar errores tipados (`REVISION_MISMATCH`, `COMMAND_FAILED`, `BAD_REQUEST`, `RATE_LIMITED`).
5. Determinar alcance (single user vs global).
6. Confirmar estado de entrega de alertas externas (`OPS_ALERT_WEBHOOK_URL`).

## Playbooks por incidente

- `REVISION_MISMATCH` elevado:
  - Confirmar latencia/reintentos del cliente.
  - Revisar ratio de idempotent replay en `/api/ops/command-metrics`.
  - Validar convergencia de `user_state_changed` entre pestañas.
- `COMMAND_FAILED`:
  - Usar `traceId` para inspeccionar falla en `commandService`.
  - Corroborar escritura en `player_commands.response_payload`.
  - Revisar RPCs y acceso a `profiles`/`player_resources`.
- Errores de bootstrap:
  - Verificar clasificación transient/terminal en `bootstrapService`.
  - Comprobar lectura de `server_metadata.last_reset_id`.
  - Confirmar consistencia de estado normalizado si `FF_NORMALIZED_READS=true`.
- Incidente multiplayer realtime:
  - Confirmar eventos `join_room`, `peer_join`, `peer_leave`, `remote_action`.
  - Revisar suscripción `subscribe_user_state` y room `user-state:*`.

## Escalamiento

- Si impacta comandos economicos o progreso: priorizar `commandService`.
- Si afecta inicio de sesión jugable: priorizar `bootstrapService`.
- Si afecta sincronización multitab/multiplayer: priorizar módulos de socket.

## Operación de seguridad y alertas

- Auditoría RLS + boundaries:
  - Ejecutar `npm run security:audit`.
  - Criterio de éxito: todas las escrituras directas cliente a tablas críticas son denegadas.
- Alertas operativas externas:
  - Configurar `OPS_ALERT_WEBHOOK_URL` y `OPS_ALERT_MIN_INTERVAL_MS`.
  - El server emite alertas cuando se superan `conflictsPerMin`, `errorRate`, `p95LatencyMs` o `retryRatio`.
