# ADR-001: Modularizacion de `server/index.js`

## Estado

Aprobado.

## Contexto

El archivo `server/index.js` acumulaba responsabilidades de transporte HTTP, sockets, autenticacion, rate limit, lógica de negocio de comandos y bootstrap, lo que elevaba el riesgo operacional y la complejidad ciclomática.

## Decisión

Se separa por responsabilidades sin cambiar contratos externos:

- Sockets:
  - `server/socket/userStateRealtime.js`
  - `server/socket/globalPresence.js`
- Rutas HTTP:
  - `server/routes/commandRoutes.js`
  - `server/routes/bootstrapRoutes.js`
  - `server/routes/profileRoutes.js`
  - `server/routes/resourceRoutes.js`
- Servicios de dominio:
  - `server/services/commandService.js`
  - `server/services/bootstrapService.js`
- Middleware:
  - `server/middleware/auth.js`
  - `server/middleware/commandRateLimit.js`
- Utilidades compartidas:
  - `server/lib/trace.js`
  - `server/lib/statePatch.js`

`server/index.js` queda como composition root (wiring, bootstrap de server y scheduler).

## Contratos de eventos socket

- Room global:
  - Entrada: `join_room`, `broadcast_action`, `send_to_peer`, `presence_update`
  - Salida: `room_joined`, `peer_join`, `peer_leave`, `remote_action`
- Room de estado por usuario:
  - Entrada: `subscribe_user_state`
  - Salida: `user_state_subscription`, `user_state_changed`

## Consecuencias

- Positivas:
  - Menor acoplamiento y mejor mantenibilidad.
  - Testing y hardening focalizado por módulo.
  - Rollback más preciso por subfase.
- Riesgos:
  - Mayor superficie de wiring por inyección de dependencias.
  - Posibles regresiones de integración si no se valida smoke E2E.
