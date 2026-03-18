# Regresión crítica en server y colas tras V6.1

**Session ID:** ses_2fd18cf91ffe404AZ1k1Y1ft1v
**Created:** 3/18/2026, 9:43:18 PM
**Updated:** 3/18/2026, 10:18:13 PM

---

## User

se ha cometido una regresion important en el server pues mira stos logs 2026-03-18T21:40:34.79356227Z [AuthMiddleware] Authenticated request {
2026-03-18T21:40:34.79358561Z   traceId: 'req-1773870034750-7vtntv',
2026-03-18T21:40:34.79359091Z   userId: '82a2...d49e',
2026-03-18T21:40:34.79359487Z   commandId: null,
2026-03-18T21:40:34.7935999Z   expectedRevision: null,
2026-03-18T21:40:34.79360395Z   newRevision: null,
2026-03-18T21:40:34.79360784Z   errorCode: null,
2026-03-18T21:40:34.793611571Z   email: 'admin@gmail.com',
2026-03-18T21:40:34.793615931Z   path: '/api/bootstrap'
2026-03-18T21:40:34.793620211Z }
2026-03-18T21:40:39.602102955Z [AuthMiddleware] Authenticated request {
2026-03-18T21:40:39.602128236Z   traceId: 'req-1773870039559-2s42hf',
2026-03-18T21:40:39.602148227Z   userId: '82a2...d49e',
2026-03-18T21:40:39.602151947Z   commandId: null,
2026-03-18T21:40:39.602155857Z   expectedRevision: null,
2026-03-18T21:40:39.602159037Z   newRevision: null,
2026-03-18T21:40:39.602162137Z   errorCode: null,
2026-03-18T21:40:39.602165207Z   email: 'admin@gmail.com',
2026-03-18T21:40:39.602168247Z   path: '/api/bootstrap'
2026-03-18T21:40:39.602171417Z }
2026-03-18T21:40:44.791773448Z [AuthMiddleware] Authenticated request {
2026-03-18T21:40:44.791801369Z   traceId: 'req-1773870044744-zfu3al',
2026-03-18T21:40:44.791807269Z   userId: '82a2...d49e',
2026-03-18T21:40:44.791811449Z   commandId: null,
2026-03-18T21:40:44.791815989Z   expectedRevision: null,
2026-03-18T21:40:44.791820359Z   newRevision: null,
2026-03-18T21:40:44.79182498Z   errorCode: null,
2026-03-18T21:40:44.791828149Z   email: 'admin@gmail.com',
2026-03-18T21:40:44.791831009Z   path: '/api/bootstrap'
2026-03-18T21:40:44.79183394Z }
2026-03-18T21:40:49.621685183Z [AuthMiddleware] Authenticated request {
2026-03-18T21:40:49.621714683Z   traceId: 'req-1773870049574-9gpp5z',
2026-03-18T21:40:49.621720513Z   userId: '82a2...d49e',
2026-03-18T21:40:49.621724603Z   commandId: null,
2026-03-18T21:40:49.621729564Z   expectedRevision: null,
2026-03-18T21:40:49.621733353Z   newRevision: null,
2026-03-18T21:40:49.621737184Z   errorCode: null,
2026-03-18T21:40:49.621741354Z   email: 'admin@gmail.com',
2026-03-18T21:40:49.621745754Z   path: '/api/bootstrap'
2026-03-18T21:40:49.621749984Z }
2026-03-18T21:40:50.844134771Z [AuthMiddleware] Authenticated request {
2026-03-18T21:40:50.844167742Z   traceId: 'req-1773870050805-pg50hk',
2026-03-18T21:40:50.844172742Z   userId: '82a2...d49e',
2026-03-18T21:40:50.844176792Z   commandId: null,
2026-03-18T21:40:50.844181602Z   expectedRevision: null,
2026-03-18T21:40:50.844185382Z   newRevision: null,
2026-03-18T21:40:50.844189022Z   errorCode: null,
2026-03-18T21:40:50.844192782Z   email: 'admin@gmail.com',
2026-03-18T21:40:50.844196483Z   path: '/api/bootstrap'
2026-03-18T21:40:50.844200203Z }
2026-03-18T21:40:51.149449259Z [AuthMiddleware] Authenticated request {
2026-03-18T21:40:51.14992937Z   traceId: 'req-1773870051110-a9u7js',
2026-03-18T21:40:51.14994048Z   userId: '82a2...d49e',
2026-03-18T21:40:51.14994562Z   commandId: null,
2026-03-18T21:40:51.14995044Z   expectedRevision: null,
2026-03-18T21:40:51.14995506Z   newRevision: null,
2026-03-18T21:40:51.14995822Z   errorCode: null,
2026-03-18T21:40:51.14996097Z   email: 'admin@gmail.com',
2026-03-18T21:40:51.14996512Z   path: '/api/bootstrap'
2026-03-18T21:40:51.14996992Z }
2026-03-18T21:40:51.569560828Z [AuthMiddleware] Authenticated request {
2026-03-18T21:40:51.569584439Z   traceId: 'req-1773870051529-8x3tpv',
2026-03-18T21:40:51.569590189Z   userId: '82a2...d49e',
2026-03-18T21:40:51.569594599Z   commandId: null,
2026-03-18T21:40:51.569599799Z   expectedRevision: null,
2026-03-18T21:40:51.569603989Z   newRevision: null,
2026-03-18T21:40:51.569608519Z   errorCode: null,
2026-03-18T21:40:51.569612749Z   email: 'admin@gmail.com',
2026-03-18T21:40:51.56961727Z   path: '/api/bootstrap'
2026-03-18T21:40:51.56962139Z }
2026-03-18T21:40:54.382075846Z [AuthMiddleware] Authenticated request {
2026-03-18T21:40:54.382098107Z   traceId: 'req-1773870054341-ft6qp8',
2026-03-18T21:40:54.382103477Z   userId: '82a2...d49e',
2026-03-18T21:40:54.382107867Z   commandId: null,
2026-03-18T21:40:54.382112937Z   expectedRevision: null,
2026-03-18T21:40:54.382117367Z   newRevision: null,
2026-03-18T21:40:54.382134938Z   errorCode: null,
2026-03-18T21:40:54.382138248Z   email: 'admin@gmail.com',
2026-03-18T21:40:54.382140728Z   path: '/api/command'
2026-03-18T21:40:54.382143178Z }
2026-03-18T21:40:55.729197612Z [AuthMiddleware] Authenticated request {
2026-03-18T21:40:55.729215292Z   traceId: 'req-1773870055686-ckfz60',
2026-03-18T21:40:55.729218613Z   userId: '82a2...d49e',
2026-03-18T21:40:55.729221053Z   commandId: null,
2026-03-18T21:40:55.729223742Z   expectedRevision: null,
2026-03-18T21:40:55.729226113Z   newRevision: null,
2026-03-18T21:40:55.729228213Z   errorCode: null,
2026-03-18T21:40:55.729230683Z   email: 'admin@gmail.com',
2026-03-18T21:40:55.729232793Z   path: '/api/bootstrap'
2026-03-18T21:40:55.729234823Z }
2026-03-18T21:40:55.839252839Z [CommandMetrics] Snapshot {
2026-03-18T21:40:55.83926658Z   uptimeMs: 423839,
2026-03-18T21:40:55.839269169Z   windowMs: 900000,
2026-03-18T21:40:55.839271469Z   totals: {
2026-03-18T21:40:55.83927366Z     requests: 9,
2026-03-18T21:40:55.83927596Z     success: 6,
2026-03-18T21:40:55.83927814Z     conflicts: 0,
2026-03-18T21:40:55.83928028Z     badRequest: 3,
2026-03-18T21:40:55.83928233Z     rateLimited: 0,
2026-03-18T21:40:55.8393068Z     failed: 0,
2026-03-18T21:40:55.83931033Z     idempotentReplays: 0,
2026-03-18T21:40:55.839313761Z     inProgressCollisions: 0,
2026-03-18T21:40:55.83931689Z     revisionMismatches: 0
2026-03-18T21:40:55.839320281Z   },
2026-03-18T21:40:55.839324121Z   byType: {
2026-03-18T21:40:55.839327391Z     TUTORIAL_CLAIM_REWARD: {
2026-03-18T21:40:55.839329741Z       requests: 3,
2026-03-18T21:40:55.839331831Z       success: 3,
2026-03-18T21:40:55.839333911Z       conflicts: 0,
2026-03-18T21:40:55.839335991Z       badRequest: 0,
2026-03-18T21:40:55.839338041Z       failed: 0,
2026-03-18T21:40:55.839340211Z       rateLimited: 0,
2026-03-18T21:40:55.839342291Z       idempotentReplays: 0,
2026-03-18T21:40:55.839344371Z       revisionMismatches: 0
2026-03-18T21:40:55.839346521Z     },
2026-03-18T21:40:55.839348641Z     BUILD_START: {
2026-03-18T21:40:55.839350721Z       requests: 6,
2026-03-18T21:40:55.839352791Z       success: 3,
2026-03-18T21:40:55.839354951Z       conflicts: 0,
2026-03-18T21:40:55.839357082Z       badRequest: 3,
2026-03-18T21:40:55.839359171Z       failed: 0,
2026-03-18T21:40:55.839361291Z       rateLimited: 0,
2026-03-18T21:40:55.839363402Z       idempotentReplays: 0,
2026-03-18T21:40:55.839365502Z       revisionMismatches: 0
2026-03-18T21:40:55.839367612Z     }
2026-03-18T21:40:55.839369672Z   },
2026-03-18T21:40:55.839372742Z   byErrorCode: { QUEUE_FULL: 3 },
2026-03-18T21:40:55.839375262Z   latencyMs: {
2026-03-18T21:40:55.839377432Z     count: 9,
2026-03-18T21:40:55.839379542Z     min: 180,
2026-03-18T21:40:55.839381592Z     max: 627,
2026-03-18T21:40:55.839383682Z     avg: 410,
2026-03-18T21:40:55.839385732Z     p50: 445,
2026-03-18T21:40:55.839387802Z     p95: 627,
2026-03-18T21:40:55.839389862Z     p99: 627
2026-03-18T21:40:55.839391982Z   },
2026-03-18T21:40:55.839394072Z   rates: {
2026-03-18T21:40:55.839396132Z     conflictsPerMin: 0,
2026-03-18T21:40:55.839398222Z     failedPerMin: 0,
2026-03-18T21:40:55.839400332Z     rateLimitedPerMin: 0,
2026-03-18T21:40:55.839402472Z     revisionMismatchesPerMin: 0,
2026-03-18T21:40:55.839404692Z     errorRate: 0.3333,
2026-03-18T21:40:55.839406823Z     retryRatio: 0,
2026-03-18T21:40:55.839408943Z     successRatio: 0.6667
2026-03-18T21:40:55.839432043Z   },
2026-03-18T21:40:55.839434303Z   thresholds: {
2026-03-18T21:40:55.839436393Z     conflictsPerMin: 5,
2026-03-18T21:40:55.839438503Z     errorRate: 0.05,
2026-03-18T21:40:55.839440613Z     p95LatencyMs: 750,
2026-03-18T21:40:55.839442683Z     retryRatio: 0.2
2026-03-18T21:40:55.839444733Z   },
2026-03-18T21:40:55.839446863Z   alerts: {
2026-03-18T21:40:55.839448953Z     highConflicts: false,
2026-03-18T21:40:55.839451064Z     highErrorRate: true,
2026-03-18T21:40:55.839453153Z     highP95Latency: false,
2026-03-18T21:40:55.839455304Z     highRetryRatio: false
2026-03-18T21:40:55.839457454Z   }
2026-03-18T21:40:55.839459614Z }
2026-03-18T21:40:56.062752248Z [AuthMiddleware] Authenticated request {
2026-03-18T21:40:56.062774988Z   traceId: 'req-1773870056025-f6erjz',
2026-03-18T21:40:56.062778868Z   userId: '82a2...d49e',
2026-03-18T21:40:56.062781538Z   commandId: null,
2026-03-18T21:40:56.062785109Z   expectedRevision: null,
2026-03-18T21:40:56.062787409Z   newRevision: null,
2026-03-18T21:40:56.062789989Z   errorCode: null,
2026-03-18T21:40:56.062792249Z   email: 'admin@gmail.com',
2026-03-18T21:40:56.062794979Z   path: '/api/command'
2026-03-18T21:40:56.062797389Z }
2026-03-18T21:41:01.788704042Z [AuthMiddleware] Authenticated request {
2026-03-18T21:41:01.788734693Z   traceId: 'req-1773870061744-uhivv6',
2026-03-18T21:41:01.788739843Z   userId: '82a2...d49e',
2026-03-18T21:41:01.788743793Z   commandId: null,
2026-03-18T21:41:01.788748123Z   expectedRevision: null,
2026-03-18T21:41:01.788752073Z   newRevision: null,
2026-03-18T21:41:01.788755953Z   errorCode: null,
2026-03-18T21:41:01.788759953Z   email: 'admin@gmail.com',
2026-03-18T21:41:01.788764104Z   path: '/api/bootstrap'
2026-03-18T21:41:01.788767813Z } se reportan fallos en construccion, reclutamiento, investigacion, en las colas, los dificios s terminan de forma inmediata y no en el tiempo dado, el tutorial esta oto y los botones no funcionan nada que ver con la version mas estable que tiene el commit V6.1 Estable

---

## Assistant

**Tool: read**

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

