# Arquitectura y Configuración de Supabase - Iron Dune

Este documento es la **Fuente de Verdad** para la infraestructura de base de datos y conexión del proyecto. **IMPORTANTE:** Siempre que se modifique, añada o edite una tabla o política, este archivo debe ser actualizado.

## 1. Sistema de Sincronización Automática (Migraciones)
Ya no es necesario ejecutar SQL manualmente en el panel de Supabase para cambios estructurales. Hemos implementado un sistema de "Source of Truth" en el código:

- **Archivo Maestro:** `server/db/setup.sql` (Contiene todas las tablas, roles y políticas).
- **Script de Ejecución:** `server/scripts/migrate.js`.
- **Comando:** `npm run db:migrate --prefix server`.

### Cómo usarlo:
1. Edita `server/db/setup.sql` con los cambios deseados.
2. Ejecuta `npm run db:migrate --prefix server`.
3. El script aplicará los cambios sin borrar los datos existentes gracias al uso de `IF NOT EXISTS` y bloques `DO`.

---

## 2. Variables de Entorno (Secrets)

Para que el sistema funcione, las siguientes variables deben estar configuradas en sus respectivas plataformas:

### A. Frontend (Vercel)
Variables necesarias para la build de Vite:
- `VITE_SUPABASE_URL`: URL del proyecto Supabase.
- `VITE_SUPABASE_ANON_KEY`: API Key pública (anon).
- `VITE_SOCKET_SERVER_URL`: URL del servidor en Render (ej: `https://irondune.onrender.com`).

### B. Backend (Render)
Variables necesarias para el motor de batalla y persistencia:
- `SUPABASE_URL`: URL del proyecto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: **CLAVE SECRETA** (Service Role) para que el servidor pueda saltarse el RLS y procesar batallas offline.
- `DATABASE_URL`: URI de conexión directa a Postgres (Necesaria para las migraciones). Se obtiene en *Settings > Database > Connection String (URI)*.
- `PORT`: Generalmente `10000`.

---

## 3. Estructura de la Base de Datos Actual

### Tablas Maestras (Nueva Arquitectura)
1. **`profiles`**: Datos identitarios y configuración.
2. **`player_economy`**: Gestión profesional de recursos, producción y banco.
3. **`player_buildings`**: Niveles y estados de construcción.
4. **`player_research`**: Progreso tecnológico.
5. **`player_units`**: Conteo de tropas en tiempo real.
6. **`movements`**: Tráfico de tropas (ataques, misiones, apoyos).
7. **`bots`**: Base de datos de bots GLOBAL e idéntica para todos.
8. **`reports`**: Informes de combate y sistema.
9. **`inbox`**: Mensajería privada.

---

## 5. Hard Reset y Limpieza
Para realizar un reinicio total manteniendo la estructura:
1. Ejecuta `npm run db:migrate --prefix server`. El script incluye comandos `DELETE` para limpiar todas las tablas antes de reiniciar.
2. Se recomienda correr `node scripts/seedBots.js` para repoblar la lista global de enemigos.

---

## 6. Flujo de Conexión y Persistencia
El frontend (`usePersistence.ts`) ahora no guarda un objeto gigante, sino que distribuye los datos entre las tablas correspondientes (`upsert` múltiple). Al cargar, realiza un `Promise.all` para reconstruir el estado del juego de forma eficiente.

---

## ⚠️ NOTA PARA AGENTES Y DESARROLLADORES
Si vas a realizar cambios en la base de datos:
1. **SIEMPRE** modifica primero `server/db/setup.sql`.
2. **NUNCA** borres la tabla `profiles` si hay usuarios activos; usa `ALTER TABLE`.
3. Actualiza este archivo con la nueva estructura de tablas si añades una.
