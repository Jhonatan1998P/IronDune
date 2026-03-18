# Cierre Operativo - Server Authoritative (A/B/C)

Objetivo: cerrar los 3 pendientes operativos del plan maestro y dejar DoD global en 100%.

Referencia: `PLAN_ARQUITECTURA_SERVER_AUTORITATIVA.md` (seccion "Que falta realmente para cerrar al 100%")

---

## A) Alertas en produccion conectadas y probadas

### Paso A1 - Configurar webhook real

- Definir `OPS_ALERT_WEBHOOK_URL` en entorno server productivo.
- Definir `OPS_ALERT_MIN_INTERVAL_MS` (recomendado: `60000`).
- Reiniciar servicio y validar log de feature flags al arranque.

### Paso A2 - Probar extremo a extremo

- Disparar escenario controlado que supere umbral (`failedPerMin`, `errorRate`, `p95LatencyMs` o `retryRatio`).
- Confirmar llegada al canal operativo (Slack/Discord/PagerDuty).
- Confirmar deduplicacion anti-spam (no flood con mismo signature).

### Evidencia minima

- Captura/log de arranque con webhook configurado.
- Captura del mensaje recibido en canal.
- Timestamps de primera alerta y alerta repetida bloqueada.

### Criterio de cierre A

- Al menos 1 alerta real recibida por canal productivo.
- On-call/owner asignado y documentado.

---

## B) Cierre formal del bloque P2P recursos/batalla

### Paso B1 - Ventana de estabilidad

- Ejecutar smoke multiplayer en ventana sostenida (recomendado: 30-60 min).
- Validar eventos `peer_join`, `peer_leave`, `remote_action` y convergencia de estado.

### Paso B2 - Registro operativo

- Registrar fecha/hora, entorno, participantes y resultado.
- Registrar incidentes observados (si aplica) y mitigacion.

### Evidencia minima

- Log/acta de smoke con resultado "pass".
- Cero corrupciones de estado o divergencias permanentes durante la ventana.

### Criterio de cierre B

- Bloque P2P pasa smoke sostenido sin incidentes criticos.

---

## C) Evidencia continua pre/post de no degradacion

### Paso C1 - Capturar baseline pre-release

- Exportar snapshot de metricas de comandos (JSON pre).
- Guardar en artefacto de release.

### Paso C2 - Capturar post-release (24h recomendado)

- Exportar snapshot post con misma ventana temporal.
- Ejecutar:

```bash
npm run metrics:compare -- pre.json post.json
```

### Paso C3 - Registrar conclusion

- Adjuntar deltas de `failedPerMin`, `errorRate`, `revisionMismatchesPerMin`, `p95LatencyMs`.
- Decidir `continue` / `rollback` con base en umbrales.

### Evidencia minima

- `pre.json`, `post.json`, salida del comparador.
- Decision operativa registrada por release.

### Criterio de cierre C

- Sin degradacion estadistica fuera de umbral definido.

---

## Comandos utiles

- Auditoria de seguridad/RLS:

```bash
npm run security:audit
```

- Comparacion pre/post:

```bash
npm run metrics:compare -- pre.json post.json
```

- Suite de regresion:

```bash
npm test
```

---

## Checklist de salida (DoD final)

- [ ] A cerrado (alertas reales en canal productivo)
- [ ] B cerrado (bloque P2P formalmente validado)
- [ ] C cerrado (comparacion pre/post registrada por release)
- [ ] Actualizar `PLAN_ARQUITECTURA_SERVER_AUTORITATIVA.md` y marcar los tres como `[x]`
