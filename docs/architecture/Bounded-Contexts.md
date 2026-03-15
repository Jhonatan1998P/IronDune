# Bounded Contexts - Iron Dune Operations

## 1. Auth & Players
- **Dominio**: Registro, login, perfiles públicos y privados.
- **Invariantes**: Un jugador solo puede tener una sesión activa o el servidor debe poder desconectar la anterior.
- **Entidades**: `User`, `Player`, `Session`.

## 2. Planets & Economy
- **Dominio**: Recursos (Money, Oil, Ammo, Gold, Diamond), edificios y producción pasiva.
- **Invariantes**: El balance de recursos nunca puede ser negativo. La producción de recursos depende de los niveles de edificios y sliders de producción.
- **Entidades**: `Planet`, `ResourceSnapshot`, `Building`.

## 3. Queues (Colas de construcción)
- **Dominio**: Edificios, investigaciones y astillero.
- **Invariantes**: Solo puede haber un edificio en construcción a la vez por planeta (a menos que se añada una cola múltiple). Los recursos se descuentan al iniciar la construcción.
- **Entidades**: `BuildingQueueItem`, `ShipyardQueueItem`.

## 4. Fleets (Flotas)
- **Dominio**: Movimiento de tropas entre planetas, misiones de ataque, transporte, despliegue.
- **Invariantes**: Las naves en movimiento no están disponibles en el planeta de origen ni destino hasta que lleguen.
- **Entidades**: `FleetMovement`, `FleetComposition`.

## 5. Ranking
- **Dominio**: Puntos de jugadores y alianzas, clasificación global.
- **Invariantes**: Los puntos se recalculan periódicamente o mediante triggers de base de datos para no sobrecargar la API.
- **Entidades**: `Leaderboard`, `PlayerPoints`.

## 6. Notifications & Reports
- **Dominio**: Avisos de ataques, informes de combate, mensajes del sistema.
- **Entidades**: `Notification`, `CombatReport`.

---

# Invariantes del Juego
1. **Tiempo Real**: Los eventos ocurren en `server_time` (UTC).
2. **Consistencia de Recursos**: No se permite gastar más de lo que se tiene en `now`.
3. **Atomicidad**: Una acción de construcción o ataque es atómica o no ocurre.
4. **Idempotencia**: Reenviar la misma acción no genera duplicados.

# Anti-objetivos
- No se implementará lógica de combate en el frontend.
- No se permitirán scripts automatizados (macros) mediante validaciones de rate limit.
- No se usarán websockets para la lógica de verdad, solo para notificaciones y patches de estado.
