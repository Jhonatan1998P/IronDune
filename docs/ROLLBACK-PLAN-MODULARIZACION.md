# Rollback Plan por Subfase - Modularizacion Server

## Alcance

Rollback de codigo por subfase sin tocar migraciones de datos.

## M1 - Sockets

- Revertir solo:
  - `server/socket/userStateRealtime.js`
  - `server/socket/globalPresence.js`
  - Wiring asociado en `server/index.js`
- Señal de rollback:
  - Regresion en `peer_join`/`peer_leave`/`remote_action` o en `user_state_changed`.

## M2 - Rutas HTTP

- Revertir solo:
  - `server/routes/*.js`
  - Wiring de rutas en `server/index.js`
- Señal de rollback:
  - Cambios inesperados en status codes/payloads de `/api/command`, `/api/bootstrap`, `/api/profile/*`, `/api/resources/*`.

## M3 - Servicios, middleware y libs

- Revertir solo:
  - `server/services/*.js`
  - `server/middleware/*.js`
  - `server/lib/trace.js`, `server/lib/statePatch.js`
  - Wiring dependiente en rutas/index
- Señal de rollback:
  - Fallas de autenticacion, rate-limit anomalo o divergencia en statePatch/revision.

## Operativa de rollback

1. Identificar subfase y modulo causal por `traceId`.
2. Revertir commit(s) de subfase afectada de forma puntual.
3. Reiniciar servicio y verificar smoke minimo.
4. Monitorear 30-60 min: `failed`, `badRequest`, `revisionMismatch`, p95 latencia.
