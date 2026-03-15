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

1.  Crea un nuevo proyecto en **Supabase**.
2.  Obtén tus credenciales desde **Project Settings > Database**:
    *   **Transaction Connection String**: Para el uso normal de la API.
    *   **Direct Connection String (URI)**: Esta es la que usaremos para la variable `DATABASE_URL`. Asegúrate de habilitar el modo "Direct" si usas IPv4/v6.

---

## 3. Fase 2: Backend & Worker (Render)

Render desplegará dos servicios definidos en `render.yaml`: la API y el Worker de fondo.

### Despliegue Automático (Hard Reset):
El backend tiene una función de **autoinstalación** que crea todas las tablas y funciones por ti.

1.  En Render Dashboard, haz clic en **New +** > **Blueprint**.
2.  Conecta tu repositorio de GitHub.
3.  Render detectará `render.yaml`. Se te pedirán las siguientes variables:

#### Variables de Entorno en Render:
| Variable | Valor / Origen |
| :--- | :--- |
| `NODE_VERSION` | `20.x` |
| `SUPABASE_URL` | Tu Project URL de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Tu Service Role Key (secreta) |
| `DATABASE_URL` | La **Direct Connection URI** de Supabase |
| `DB_HARD_RESET` | Ponla en `true` para la primera ejecución, luego cámbiala a `false` |
| `NODE_ENV` | `production` |

4.  **Resultado**: Render creará `iron-dune-api` y `iron-dune-worker`. En el primer inicio de la API, se borrará la DB actual y se recreará todo el esquema de Iron Dune automáticamente.

---

## 4. Fase 3: Frontend (Vercel)

Vercel servirá la UI de React optimizada para alto rendimiento.

1.  En Vercel, haz clic en **Add New** > **Project**.
2.  Importa tu repositorio.
3.  **Configuración del proyecto:**
    *   **Framework Preset**: `Vite`
    *   **Root Directory**: `./` (La raíz del monorepo)
    *   **Build Command**: `npm run build -w apps/frontend`
    *   **Output Directory**: `apps/frontend/dist`
4.  **Variables de Entorno en Vercel:**
| Variable | Valor / Origen |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Tu Project URL de Supabase |
| `VITE_SUPABASE_ANON_KEY` | Tu Anon Key de Supabase (pública) |
| `VITE_API_URL` | La URL generada por Render para el servicio `iron-dune-api` (Ej: `https://iron-dune-api.onrender.com`) |

---

## 5. Mantenimiento y Comandos Útiles

### Desarrollo Local
```bash
npm install
npm run dev
```
Este comando (vía `concurrently`) lanza la API en el puerto 3001, el Worker y el Frontend en el puerto de Vite simultáneamente.

### Verificación del Hard Reset
Si el reset fue exitoso, verás en los logs de la API de Render:
`⚠️ DB_HARD_RESET is enabled. Resetting database...`
`✅ DB_HARD_RESET completado con éxito.`

---

## Seguridad Crítica
- **Autoridad Total**: No permitas escrituras directas desde el cliente en tablas de recursos.
- **Idempotencia**: Todas las acciones RPC de la DB (`fn_start_construction`) requieren una `idempotency_key` enviada por el frontend para evitar duplicidad por lag de red.
- **CORS**: La API está configurada para aceptar conexiones de cualquier origen por defecto (`cors: { origin: '*' }`), pero se recomienda limitarla a tu dominio de Vercel en producción.
