# Guía Maestra de Instalación - Iron Dune Operations (V4 Monorepo)

Esta guía detalla el proceso de despliegue completo del motor de juego persistente Iron Dune, utilizando la arquitectura de autoridad total del servidor (Backend: Render, Frontend: Vercel, DB: Supabase).

---

## 1. Requisitos Previos
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Render](https://render.com)
- Cuenta en [Vercel](https://vercel.com)
- Repositorio de GitHub con el código del monorepo.

---

## 2. Fase 1: Base de Datos (Supabase)

Iron Dune utiliza lógica procedural en PostgreSQL para garantizar la atomicidad de las acciones.

1. Crea un nuevo proyecto en **Supabase**.
2. Ve al **SQL Editor**.
3. Ejecuta los siguientes scripts en orden (ubicados en `packages/db/migrations/`):
   - `20260315_initial_schema.sql`: Crea las tablas core, índices y habilita RLS.
   - `20260315_atomic_functions.sql`: Implementa `fn_start_construction` (lógica de recursos segura).
   - `20260315_worker_functions.sql`: Implementa `fn_claim_events` para el procesamiento del worker.
   - `20260315_ranking_functions.sql`: Implementa el cálculo de puntos global.

4. **Variables de Supabase a guardar:**
   - `Project URL`: (Ej. `https://xyz.supabase.co`)
   - `Service Role Key`: (Clave secreta que permite al backend saltar RLS). **NUNCA la compartas.**

---

## 3. Fase 2: Backend & Worker (Render)

Render desplegará dos servicios definidos en `render.yaml`.

1. En Render Dashboard, haz clic en **New +** > **Blueprint**.
2. Selecciona tu repositorio de GitHub.
3. Render detectará el archivo `render.yaml` y te pedirá configurar las variables de entorno.

### Variables de Entorno en Render:
| Variable | Valor / Origen |
| :--- | :--- |
| `NODE_VERSION` | `20.x` |
| `SUPABASE_URL` | Tu Project URL de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Tu Service Role Key (secreta) |
| `NODE_ENV` | `production` |
| `PORT` | `10000` (Render lo asigna por defecto) |

4. Render creará automáticamente:
   - **Web Service (`iron-dune-api`)**: Expone la API y los WebSockets.
   - **Background Worker (`iron-dune-worker`)**: Procesa las colas en segundo plano.

---

## 4. Fase 3: Frontend (Vercel)

Vercel servirá la UI de React optimizada.

1. En Vercel, haz clic en **Add New** > **Project**.
2. Importa tu repositorio.
3. **Configuración del proyecto:**
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (La raíz del monorepo)
   - **Build Command**: `npm run build -w apps/frontend`
   - **Output Directory**: `apps/frontend/dist`
4. **Variables de Entorno en Vercel:**
| Variable | Valor / Origen |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Tu Project URL de Supabase |
| `VITE_SUPABASE_ANON_KEY` | Tu Anon Key de Supabase (pública) |
| `VITE_API_URL` | La URL generada por Render para el servicio `iron-dune-api` (Ej: `https://iron-dune-api.onrender.com`) |

---

## 5. Mantenimiento y Comandos Útiles

### Desarrollo Local
Para trabajar en todo el sistema a la vez:
```bash
npm install
npm run dev
```
Esto lanzará la API, el Worker y el Frontend simultáneamente.

### Verificación de Salud
- **API Health**: `GET https://tu-url-render.com/health`
- **Logs del Worker**: Revisa los logs en Render para ver el procesamiento de eventos (ej: `Building finished: mine_1`).

---

## Seguridad Crítica
- **Autoridad**: El frontend nunca descuenta recursos. Si intentas hackear el cliente, el backend rechazará la transacción mediante las funciones SQL.
- **Caché**: Vercel está configurado mediante `vercel.json` para evitar que el navegador guarde versiones viejas del `index.html`, asegurando que los jugadores siempre tengan el código más reciente.
