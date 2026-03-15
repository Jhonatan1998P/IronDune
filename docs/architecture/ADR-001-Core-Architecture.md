# ADR 001: Arquitectura del Backend del MMO Persistente

## Estado
Propuesto

## Contexto
El juego requiere una base sólida para manejar miles de jugadores de forma persistente, con una economía en tiempo real y movimientos de flotas que ocurren incluso cuando el jugador está offline. El frontend actual usa lógica local que debe ser migrada al backend.

## Decisiones

### 1. Modelo de Datos: Snapshot + Eventos Futuros
- **Snapshot**: Estado actual calculado de un planeta/jugador en un momento `T`.
- **Eventos**: Acciones programadas (construcción terminada, llegada de flota).
- **Proceso**: El estado en `now` se calcula como `snapshot(T) + sum(producción desde T hasta now) - sum(eventos procesados)`.

### 2. Atomicidad e Idempotencia
- Todas las acciones críticas (gastar recursos, iniciar colas) se envuelven en transacciones de Postgres.
- Se usará una tabla de `idempotency_keys` para evitar dobles ejecuciones por reintentos de red.

### 3. Backend Separado (API vs Worker)
- **API (Web Service)**: Maneja peticiones HTTP y Sockets. Valida acciones y escribe en la DB.
- **Worker (Background)**: Procesa eventos vencidos. Es el "reloj" del universo.

### 4. Comunicación: Socket.IO + Patches
- No se enviará el estado completo en cada cambio.
- Se enviarán `patches` (objetos con los cambios parciales) y un `version_id` para asegurar el orden.

### 5. Economía de Precisión Fija
- Se usarán enteros (`BIGINT`) para evitar errores de redondeo de punto flotante en cálculos financieros y de recursos.

## Consecuencias
- Mayor complejidad inicial en el backend.
- Consistencia garantizada.
- El frontend se simplifica a ser una capa de visualización.
