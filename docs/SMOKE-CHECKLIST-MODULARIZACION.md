# Smoke Checklist - Modularizacion Server

Ejecutar manualmente al cierre del plan critico.

## Flujo base

1. Login valido y carga inicial.
2. `GET /api/bootstrap` responde con snapshot valido y `metadata.revision`.
3. Ejecutar `BUILD_START`, `RECRUIT_START`, `RESEARCH_START`, `SPEEDUP` via `/api/command`.
4. Validar claim de tutorial/recompensa que muta estado.
5. Refresh de cliente y verificar persistencia de progreso.

## Realtime

1. Dos pestañas con mismo usuario: cambio en una pestaña se refleja por `user_state_changed`.
2. Multiplayer room global: `peer_join`, `peer_leave`, `remote_action` sin regresiones.

## Criterio de aprobación

- Sin errores 5xx nuevos en flujos smoke.
- Sin pérdida de progreso tras refresh.
- Sin divergencia visible entre pestañas para acciones criticas.
