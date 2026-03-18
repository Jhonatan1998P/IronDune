# Regresión crítica en server y colas tras V6.1

**Session ID:** ses_2fd18cf91ffe404AZ1k1Y1ft1v
**Created:** 3/18/2026, 9:43:18 PM
**Updated:** 3/18/2026, 10:26:52 PM

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: bash**

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: grep**

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

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: read**

**Tool: read**

**Tool: read**

**Tool: read**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: read**

**Tool: read**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: bash**

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

**Tool: read**

**Tool: read**

**Tool: read**

---

## Assistant

Sí, esto huele a regresión de `V6.2` respecto a `V6.1`, y coincide con tus síntomas.

Hice el hotfix en el código para volver al comportamiento estable y agregar defensas para que no vuelva a romper aunque haya datos normalizados incompletos.

- La causa principal era que en `V6.2` se activaron por defecto flags de lectura normalizada/congelado de blob (`server/index.js:38`, `server/index.js:40`, `server/index.js:41`), cuando en `V6.1` eran opt-in.
- Eso provoca que el server lea colas/estado desde tablas normalizadas aunque estén vacías/inconsistentes, y por eso salen `QUEUE_FULL`, tutorial roto, botones sin efecto y progresos raros.
- Además, se estaba tolerando timestamp inválido de colas convirtiéndolo implícitamente a “ahora”; eso puede generar finalizaciones inmediatas.

Cambios aplicados:

- Volví los defaults de flags a modo seguro (como V6.1):
  - `server/index.js:38`
  - `server/index.js:40`
  - `server/index.js:41`
  - `server/.env.example:13`
  - `server/.env.example:14`
  - `server/.env.example:15`
  - `lib/backend.ts:22`
- Agregué fallback robusto a blob legacy si falla la lectura normalizada:
  - `server/services/commandService.js:140`
  - `server/services/bootstrapService.js:133`
- Endurecí validación de patch normalizado:
  - si no hay datos normalizados, no sobreescribe estado legacy (`server/index.js:466`)
  - si tiempos de cola son inválidos, se descarta esa lectura (`server/index.js:501`)
  - parse de tiempo inválido ya no cae en `Date.now()` (`server/index.js:398`)

Validación ejecutada:

- `npm run build` OK
- `node --check server/index.js && node --check server/services/commandService.js && node --check server/services/bootstrapService.js` OK

Acción inmediata recomendada en producción mientras despliegas:

1. Forzar env vars: `FF_NORMALIZED_READS=false`, `FF_FREEZE_LEGACY_BLOB_FIELDS=false`, `FF_DISABLE_LEGACY_SAVE_BLOB=false`.
2. Reiniciar el server.
3. Desplegar este hotfix.

Si quieres, en el siguiente paso te preparo también un script de saneamiento/backfill para las tablas normalizadas antes de volver a activar `FF_NORMALIZED_READS=true`.

---

## User

ok pero espera nunca me dijiste que eran estas constantes 1. Forzar env vars: `FF_NORMALIZED_READS=false`, `FF_FREEZE_LEGACY_BLOB_FIELDS=false`, `FF_DISABLE_LEGACY_SAVE_BLOB=false`.
2. Reiniciar el server.
3. Desplegar este hotfix.

Si quieres, en el siguiente paso te preparo también un script de saneamiento/backfill para las tablas normalizadas antes de volver a activar `FF_NORMALIZED_READS=true`.

--- ni para que sirve necesito saber y sin son muy importante so necesarias y si es un enfoqe profesional.

---

## Assistant

Tienes toda la razon, debi explicartelo antes.  
Estas constantes son *feature flags* (interruptores de comportamiento) del servidor.

**Que hace cada una**
- `FF_NORMALIZED_READS`: si esta en `true`, el server lee estado critico (colas, edificios, unidades, investigacion) desde tablas normalizadas; si esta en `false`, usa el blob legacy de `profiles.game_state`.
- `FF_FREEZE_LEGACY_BLOB_FIELDS`: si esta en `true`, al guardar comandos se eliminan del blob legacy campos criticos (`activeConstructions`, `activeRecruitments`, `activeResearch`, `buildings`, etc.) para “forzar” que la verdad viva en tablas normalizadas.
- `FF_DISABLE_LEGACY_SAVE_BLOB`: si esta en `true`, bloquea el endpoint legacy de guardado de perfil (`/api/profile/save`), o sea, desactiva ese camino viejo.

**Son importantes y necesarias?**
- Si, son importantes para migraciones sin downtime.
- Si, son necesarias en una migracion profesional, porque permiten encender/apagar rapido una ruta nueva sin rollback de codigo.
- Pero **no deben quedar encendidas “a ciegas”**: primero se valida consistencia de datos, luego se activa por etapas.

**Por que te pedi esos valores ahora (`false`)**
- Porque estamos en incidente de produccion y necesitas estabilidad inmediata (comportamiento tipo `V6.1`).
- Con esos 3 en `false` vuelves a la ruta conocida y evitas que datos normalizados incompletos rompan colas/tutorial/botones.
- Es una medida de contencion, no el estado final.

**Enfoque profesional (recomendado)**
- 1) Contener: flags en `false` + reinicio + monitoreo.
- 2) Reparar: backfill/saneamiento de tablas normalizadas desde `profiles.game_state`.
- 3) Verificar: comparar blob vs normalizado (muestras + metricas).
- 4) Activar gradual: primero `FF_NORMALIZED_READS=true` en canary, luego porcentaje/entorno completo.
- 5) Solo al final: `FF_FREEZE_LEGACY_BLOB_FIELDS=true` y despues evaluar `FF_DISABLE_LEGACY_SAVE_BLOB=true`.

Si quieres, ahora mismo te dejo un plan de migracion “enterprise” con checklist y comandos exactos para que el paso a normalizado sea seguro y auditable.

---

## User

es que  el juego no esta online ni nadie esta jugafo mas que yo que codifico y hago pruebas asique no es necesario ya que lo que quiero es que todo sirva en server-side es decir server-authoritative entonces si tengo que depender de variables pendejas para depender del frontend entonces eso esta mal y lo que hago es teer una curita para un rajadura enorme entonces no debe ser asi ebemos acabar con el prooblema desde la raiz porque necesitamos alto nivel de enfoque profesional en produccion no poner curitas

---

## Assistant

**Tool: read**

**Tool: read**

**Tool: glob**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: grep**

---

## Assistant

**Tool: grep**

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

**Tool: grep**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: grep**

**Tool: grep**

**Tool: grep**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: read**

**Tool: read**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: read**

**Tool: read**

**Tool: read**

**Tool: read**

**Tool: read**

**Tool: read**

**Tool: read**

**Tool: read**

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: read**

---

## Assistant

Totalmente de acuerdo contigo: si el sistema solo “funciona” al tocar flags, no es profesional.  
Ya ataqué la causa raíz, no solo el síntoma.

- La raíz del bug estaba en la sincronización SQL `sync_player_domain_from_state`: se guardaban `startTime/endTime` en milisegundos usando `to_timestamp(...)` (que espera segundos), corrompiendo colas en fechas absurdas y disparando comportamientos como `QUEUE_FULL` o tiempos incoherentes.
- Lo corregí en la definición base de migración para instalaciones nuevas en `server/migrations/004_normalized_player_domain.sql:176`.
- Lo corregí también en reset/hard-reset para que no vuelva a aparecer al recrear DB en `server/dbReset.js:367`.
- Creé una migración de reparación real para bases ya afectadas: `server/migrations/006_fix_normalized_queue_timestamps.sql:1`.
  - Reemplaza la función de sync con parseo robusto de epoch.
  - Repara filas corruptas existentes (`year >= 3000`) en `server/migrations/006_fix_normalized_queue_timestamps.sql:151`.
  - Normaliza casos `end_time < start_time` y añade constraint de integridad.
- Añadí script operativo one-shot para aplicar esa reparación sin depender del frontend: `server/scripts/apply-normalized-queue-fix.js:1`.
  - Expuesto como `npm run normalized:repair-queues` en `package.json:16` y `server/package.json:10`.
- Endurecí lectura server-side para no tragarse datos inválidos:
  - `server/index.js:399` (parse inválido ya no cae en “now” silencioso),
  - `server/index.js:467` (si normalized está vacío no pisa state),
  - `server/index.js:502` (valida timestamps fuera de rango).
- Mantuve fallback defensivo en runtime (profesional, no curita) para que si DB viene sucia no rompa gameplay mientras se repara:
  - `server/services/commandService.js:140`
  - `server/services/bootstrapService.js:133`
- Ajusté defaults para rollout serio (no romper legacy antes de tiempo):
  - `server/.env.example:13`
  - `server/.env.example:14`
  - `server/.env.example:15`
  - y documentado en `docs/RENDER_SERVER_ENV_SETUP.md:26`.

Validaciones que sí corrí:
- `npm run build` OK
- `node --check server/index.js ...` OK

Para dejarlo cerrado de raíz en tu entorno ahora:
1. Ejecuta `npm run normalized:repair-queues`.
2. Reinicia el server.
3. Prueba `BUILD_START`, `RECRUIT_START`, `RESEARCH_START` y confirma que ya no hay `QUEUE_FULL` espurio ni finalizaciones instantáneas.

Si quieres, en el siguiente mensaje te paso un checklist corto de verificación funcional (5 pruebas exactas) para validar que quedó como `server-authoritative` de verdad.

---

## User

amigo el hard reset se creo para hacer la limpieza total y hablo de TOTAL de supabase luego crear las tablas correctamente todas las tablas, luego crear las funcions necesarias, por ultimo establecer permisos entonces de esta manera con tan solo hacer deploy en render ya el porpio script limpiaria todo para que al iniciarse ya probaramos todo bien sin rasgos de antiguos sistema que podrian estar corrompidos ya que no hay que migrar tablas ni usuarios porque en realidad el juego aun esta en desarrollo no hayy nadie jugando asiquue lo mejor es borrar todo.

---

## Assistant

**Tool: read**

**Tool: read**

---

## Assistant

**Tool: grep**

**Tool: read**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: read**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: apply_patch**

---

## Assistant

**Tool: bash**

---

## Assistant

100% de acuerdo contigo.  
Para este proyecto en estado pre-release, el enfoque profesional es **reset total reproducible en cada deploy**, no “curitas”.

Ya lo dejé alineado a ese enfoque:

- El `hardResetDatabase()` ya hacía borrado total (Auth + tablas + funciones + permisos) y lo mantengo como camino principal.
- Lo reforcé para que el reset sea más robusto:
  - Ahora también limpia/crea `parse_epoch_timestamptz` dentro del reset (`server/dbReset.js`).
  - Añade constraint de integridad en colas (`end_time >= start_time`) al recrear esquema (`server/dbReset.js`).
- Lo hice más práctico para Render:
  - Si no defines `DB_HARD_RESET_REQUEST_ID`, ahora usa automáticamente `RENDER_GIT_COMMIT` o `RENDER_DEPLOY_ID` (`server/dbReset.js:7`).
  - Eso permite “deploy => reset total” sin tener que editar manualmente el request id en cada despliegue.

Importante sobre “dependencia del frontend”:
- La autoridad del juego está en backend (`/api/command`, recursos, colas, revisión).
- Estas variables son del **server**, no del cliente.
- El frontend no decide la lógica autoritativa; solo consume bootstrap/comandos.

Para operar exactamente como tú quieres (wipe total en cada deploy):
1. En Render deja:
   - `DB_HARD_RESET=true`
   - `DB_HARD_RESET_CONFIRM=I_UNDERSTAND_DATA_LOSS`
   - `DB_RESET_ADMIN_EMAIL=...`
   - `DB_RESET_ADMIN_PASSWORD=...`
   - `DB_RESET_ADMIN_USERNAME=Admin` (o el que quieras)
2. Puedes dejar vacío `DB_HARD_RESET_REQUEST_ID` (ya toma `RENDER_GIT_COMMIT/RENDER_DEPLOY_ID`).
3. Deploy y listo: reset total + esquema limpio + funciones + permisos + admin inicial.

Si quieres, en el siguiente paso te dejo un “modo desarrollo duro” (single switch) para que este comportamiento quede explícito y no tengas que tocar 5 variables nunca más.

---

## User

ahora no me deja iniciar sesion mira estos los en render 2026-03-18T22:23:39.757657066Z     errorRate: 0,
2026-03-18T22:23:39.757659236Z     retryRatio: 0,
2026-03-18T22:23:39.757681076Z     successRatio: 0
2026-03-18T22:23:39.757687007Z   },
2026-03-18T22:23:39.757689777Z   thresholds: {
2026-03-18T22:23:39.757692537Z     conflictsPerMin: 5,
2026-03-18T22:23:39.757695157Z     errorRate: 0.05,
2026-03-18T22:23:39.757697647Z     p95LatencyMs: 750,
2026-03-18T22:23:39.757699997Z     retryRatio: 0.2
2026-03-18T22:23:39.757702567Z   },
2026-03-18T22:23:39.757704977Z   alerts: {
2026-03-18T22:23:39.757707637Z     highConflicts: false,
2026-03-18T22:23:39.757710237Z     highErrorRate: false,
2026-03-18T22:23:39.757712637Z     highP95Latency: false,
2026-03-18T22:23:39.757726637Z     highRetryRatio: false
2026-03-18T22:23:39.757728698Z   }
2026-03-18T22:23:39.757730488Z }
2026-03-18T22:23:39.799350667Z [Scheduler] Checking 1 offline profiles...
2026-03-18T22:23:39.930652289Z [Scheduler] Error processing profile 82a21fdc-ad06-41a0-992c-0a090f4dd49e: TypeError: Cannot read properties of undefined (reading 'length')
2026-03-18T22:23:39.93068947Z     at processSingleProfile (file:///opt/render/project/src/server/scheduler.js:138:39)
2026-03-18T22:23:39.93069237Z     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
2026-03-18T22:23:39.93069525Z     at async Timeout.processOfflinePlayers [as _onTimeout] (file:///opt/render/project/src/server/scheduler.js:41:13)
2026-03-18T22:23:49.623659079Z [AuthMiddleware] Authenticated request {
2026-03-18T22:23:49.623706091Z   traceId: 'req-1773872629559-zmmr3l',
2026-03-18T22:23:49.623712331Z   userId: '82a2...d49e',
2026-03-18T22:23:49.623716711Z   commandId: null,
2026-03-18T22:23:49.623721411Z   expectedRevision: null,
2026-03-18T22:23:49.623724231Z   newRevision: null,
2026-03-18T22:23:49.623727051Z   errorCode: null,
2026-03-18T22:23:49.623729851Z   email: 'admin@gmail.com',
2026-03-18T22:23:49.623732671Z   path: '/api/bootstrap'
2026-03-18T22:23:49.623735461Z }
2026-03-18T22:23:49.776966185Z [BootstrapAPI] Falling back to profile blob read {
2026-03-18T22:23:49.776990636Z   traceId: 'req-1773872629559-zmmr3l',
2026-03-18T22:23:49.776995816Z   userId: '82a2...d49e',
2026-03-18T22:23:49.776999696Z   commandId: null,
2026-03-18T22:23:49.777003706Z   expectedRevision: null,
2026-03-18T22:23:49.777007386Z   newRevision: null,
2026-03-18T22:23:49.777011156Z   errorCode: 'NORMALIZED_READ_FALLBACK',
2026-03-18T22:23:49.777014876Z   error: {
2026-03-18T22:23:49.777018567Z     name: 'Error',
2026-03-18T22:23:49.777022156Z     message: 'NORMALIZED_QUEUE_TIME_INVALID',
2026-03-18T22:23:49.777025767Z     stack: 'Error: NORMALIZED_QUEUE_TIME_INVALID\n' +
2026-03-18T22:23:49.777029777Z       '    at loadNormalizedStatePatch (file:///opt/render/project/src/server/index.js:512:13)\n' +
2026-03-18T22:23:49.777034177Z       '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n' +
2026-03-18T22:23:49.777038337Z       '    at async handleBootstrap (file:///opt/render/project/src/server/services/bootstrapService.js:134:11)',
2026-03-18T22:23:49.777042567Z     code: undefined,
2026-03-18T22:23:49.777046307Z     status: undefined
2026-03-18T22:23:49.777049807Z   }
2026-03-18T22:23:49.777053437Z }

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

**Tool: apply_patch**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: bash**

---

## Assistant

**Tool: read**

---

## Assistant

Gracias por los logs, aquí sí se ve claro qué pasa.

- **No es fallo de auth**: el log muestra `Authenticated request` a `/api/bootstrap`, o sea el token/login sí entra.
- Tienes **dos problemas de servidor**:
  1. `scheduler.js` rompía con `Cannot read properties of undefined (reading 'length')` porque faltaba `await` en `processAttackQueue(...)`.
  2. Tu BD todavía tiene colas normalizadas con tiempo inválido (`NORMALIZED_QUEUE_TIME_INVALID`), por eso bootstrap cae a fallback.

Ya te dejé corregido el bug del scheduler en `server/scheduler.js:137` (con `await` y guardas defensivas).

Para dejarlo como tú quieres (reset total en cada deploy, sin arrastre viejo), haz esto en Render:

1. `DB_HARD_RESET=true`  
2. `DB_HARD_RESET_CONFIRM=I_UNDERSTAND_DATA_LOSS`  
3. `DB_RESET_ADMIN_EMAIL=...`  
4. `DB_RESET_ADMIN_PASSWORD=...`  
5. `DB_RESET_ADMIN_USERNAME=Admin`  
6. **Opcional** `DB_HARD_RESET_REQUEST_ID` (si lo dejas vacío, ahora usa `RENDER_GIT_COMMIT/RENDER_DEPLOY_ID` automáticamente con mi cambio en `server/dbReset.js:7`)

Luego redeploy.

Si quieres evitar wipe y solo reparar colas corruptas:
- ejecuta una vez `npm run normalized:repair-queues`.

Recomendación en tu caso (pre-release, solo tú): **haz hard reset total y redeploy**. Es lo más limpio y profesional para tu etapa actual.

---

