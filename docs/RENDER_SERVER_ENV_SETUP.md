# Render - Server Env Setup (incluye hard reset seguro)

Este proyecto no requiere `.env` en Render. Todas las variables se configuran en el panel del servicio.

## Modo minimo (solo DB + reset + logs)

Si quieres operar con el minimo de variables, usa solo estas:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DB_HARD_RESET`
- `DB_HARD_RESET_CONFIRM`
- `DB_HARD_RESET_REQUEST_ID` (opcional en Render: si no se define, se usa `RENDER_GIT_COMMIT`/`RENDER_DEPLOY_ID`)
- `DB_RESET_ADMIN_EMAIL`
- `DB_RESET_ADMIN_PASSWORD`
- `DB_RESET_ADMIN_USERNAME`
- `SERVER_LOGS_ENABLED`

## 1) Variables obligatorias (produccion)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `PORT` (Render suele inyectarlo automaticamente)

## 2) Flags recomendadas para arquitectura autoritativa

Base profesional (segura):

- `FF_NORMALIZED_READS=true`
- `FF_DUAL_WRITE_NORMALIZED=true`
- `FF_DUAL_WRITE_STRICT=false`
- `FF_FREEZE_LEGACY_BLOB_FIELDS=false`
- `FF_DISABLE_LEGACY_SAVE_BLOB=false`

Nota de rollout:

- Activa `FF_FREEZE_LEGACY_BLOB_FIELDS=true` solo cuando el reporte de consistencia este limpio.
- Activa `FF_DISABLE_LEGACY_SAVE_BLOB=true` en la fase final, cuando ya no dependes de endpoints legacy.

Si vienes de una version con colas corruptas por timestamp, ejecuta una vez:

- `npm run normalized:repair-queues`

## 3) Observabilidad recomendada

- `OPS_METRICS_KEY=<token-largo-aleatorio>`
- `OPS_ALERT_WEBHOOK_URL=<webhook canal operativo>`
- `OPS_ALERT_MIN_INTERVAL_MS=60000`
- `COMMAND_RATE_WINDOW_MS=60000`
- `COMMAND_RATE_MAX_REQUESTS=120`

## 4) Hard reset seguro en Render (one-shot)

Usar solo en mantenimiento controlado.

Variables requeridas para ejecutar reset:

- `DB_HARD_RESET=true`
- `DB_HARD_RESET_CONFIRM=I_UNDERSTAND_DATA_LOSS`
- `DB_HARD_RESET_REQUEST_ID=<id-unico-por-ejecucion>` (opcional en Render)
- `DB_RESET_ADMIN_EMAIL=<admin-email>`
- `DB_RESET_ADMIN_PASSWORD=<admin-password-fuerte>`
- `DB_RESET_ADMIN_USERNAME=Admin` (o personalizado)

Comportamiento de seguridad:

- Si falta confirmacion o request id: el reset se cancela.
- Si falta request id, en Render se usa automaticamente el id del deploy/commit.
- Si el mismo `DB_HARD_RESET_REQUEST_ID` ya fue procesado: se salta el reset para evitar borrados repetidos en reinicios.

Despues de completar reset:

1. Cambiar `DB_HARD_RESET=false`.
2. Rotar/limpiar `DB_HARD_RESET_REQUEST_ID`.
3. Verificar health + bootstrap + command gateway.

## 5) Verificacion post-deploy

- `GET /health` responde OK.
- `GET /api/bootstrap` autenticado responde snapshot valido.
- `POST /api/command` procesa comandos con revision e idempotencia.
- Alertas webhook reciben al menos una prueba controlada.
