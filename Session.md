# Resumen de Sesión: Migración a Infraestructura MMO - Iron Dune

**Objetivo Principal:** Transformar el sistema de guardado monolítico (JSONB) en una arquitectura de base de datos relacional escalable en Supabase, implementando seguridad RBAC y sistemas de comunicación peer-to-peer.

## 1. Infraestructura y Sincronización
Se ha establecido un sistema de "Source of Truth" para la base de datos, eliminando la gestión manual en el panel de Supabase y asegurando la consistencia entre entornos (Replit, Render, Vercel).
- **Archivo Maestro:** `server/db/setup.sql`.
- **Automatización:** Script de migración en Node.js que sincroniza cambios estructurales mediante comandos SQL seguros.
- **Limpieza Total:** Script de "Hard Reset" (`db:clear`) para vaciar el esquema `public` y reconstruir la infraestructura desde cero.

## 2. Normalización de Datos
Se migró de un objeto único a **12 tablas especializadas** para optimizar el rendimiento y permitir el procesamiento de lógica en el servidor (Server-Side Processing):
1.  **`profiles`**: Gestión de identidad y roles de usuario.
2.  **`player_economy`**: Control profesional de recursos (Dinero, Petróleo, Munición, Oro, Diamantes) y tasas de producción/consumo (SQL-Native).
3.  **`player_buildings`**: Niveles y cantidades de edificios.
4.  **`player_research`**: Seguimiento de progreso tecnológico e investigaciones.
5.  **`player_units`**: Conteo relacional de tropas en base.
6.  **`bots`**: Base de datos global unificada de enemigos para todos los jugadores.
7.  **`movements`**: Registro de tropas en tránsito (ataques, apoyos, misiones, salvamento).
8.  **`salvage_fields`**: Campos de escombros generados tras batallas, compartidos en el mapa.
9.  **`reports`**: Sistema de informes de combate, inteligencia y sistema.
10. **`inbox`**: Mensajería privada P2P entre comandantes.
11. **`global_market`**: Precios dinámicos sincronizados para todo el servidor.
12. **`world_events`**: Orquestador de eventos globales y bonificaciones temporales.

## 3. Seguridad y Roles (RBAC)
- **Jerarquía de Roles:** `user`, `premium`, `moderator`, `admin`, `dev`.
- **Automatización de Rango:** Implementación de un **Trigger en Postgres** que asigna automáticamente el rol `dev` a correos autorizados y genera los datos económicos/edificios iniciales al registrarse.
- **RLS (Row Level Security):** Políticas configuradas en todas las tablas para garantizar que cada jugador solo pueda acceder a su propia información confidencial.

## 4. Hitos de Desarrollo e Interfaz
- **Admin Control Panel:** Implementación de una consola de mando para desarrolladores que permite la manipulación de recursos y supervisión del estado global.
- **Messages View:** Interfaz de comunicaciones responsiva (Mobile-First) con sistema de redacción, bandejas de entrada y estados de lectura.
- **Global Bot Engine:** Script de población (`seed:bots`) que genera 50 bots con puntuaciones progresivas, sincronizados para toda la comunidad.

## 5. Comandos de Mantenimiento (CLI)
- `npm run db:migrate --prefix server`: Sincroniza la estructura del SQL maestro.
- `npm run db:clear --prefix server`: Ejecuta un borrado total de la base de datos (Uso con precaución).
- `npm run seed:bots --prefix server`: Repuebla el mundo con los bots globales.
- `node server/scripts/seed_market.js`: Inicializa los precios del mercado global.
- `node server/scripts/init_production.js`: Sincroniza las tasas de producción offline iniciales.

## 6. Motor de Guerra Autoritativo (Punto 3 Completo)
Se ha implementado un motor de batalla en el servidor que arbitra todos los movimientos de forma precisa y obligatoria:
- **Bash Limit Real-Time**: Bloqueo estricto de ataques (Máx 3/1h y 6/24h) consultando el historial de reportes.
- **Robo Físico de Edificios**: Transferencia real de propiedad (25% en el primer ataque, 15% en los siguientes). Los edificios se restan del defensor y se añaden al atacante.
- **Salvamento Universal (30%)**: Todas las bajas de batalla (Atacante, Defensor, Aliados) generan un 30% de escombros en el mapa.
- **Informes de Alta Precisión**: Estructura de reporte detallada con desgloses de tropas enviadas, supervivientes y edificios transferidos.
- **Movimientos de Retorno**: El servidor genera automáticamente el retorno de las tropas supervivientes con el botín tras la batalla.

## Estado de la Conexión
El sistema de persistencia (`usePersistence.ts`) en el frontend y el motor offline (`scheduler.js`) en el backend han sido refactorizados para operar de forma granular sobre las tablas normalizadas, garantizando que el juego sea escalable y capaz de procesar eventos en tiempo real sin intervención del usuario.
