# Configuración de Supabase para Iron Dune

Para que la persistencia de datos y la autenticación funcionen correctamente, debes configurar un proyecto en Supabase siguiendo estos pasos:

## 1. Crear un Proyecto en Supabase
1. Ve a [Supabase](https://supabase.com/) y crea una cuenta si no la tienes.
2. Crea un nuevo proyecto.
3. Una vez creado, ve a **Project Settings > API** para obtener tu `URL` y la `anon key`.

## 2. Configurar Variables de Entorno
Crea un archivo `.env` en la raíz de tu proyecto (o agrégalas a tu entorno de despliegue) con los siguientes valores:

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
```

## 3. Configurar la Base de Datos
Ve al **SQL Editor** en tu panel de Supabase y ejecuta el siguiente script para crear la tabla necesaria:

```sql
-- Crear tabla de perfiles para guardar el estado del juego
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  game_state jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Política: Los usuarios pueden ver solo su propio perfil (solo lectura desde cliente)
create policy "Users can view own profile"
  on public.profiles for select
  using ( auth.uid() = id );

-- Permisos de lectura para usuarios autenticados
grant select on table public.profiles to authenticated;
```

## 4. Configurar Autenticación
1. Ve a **Authentication > Providers**.
2. Asegúrate de que **Email** esté habilitado.
3. (Opcional) Deshabilita "Confirm Email" si quieres que los usuarios puedan entrar inmediatamente sin verificar su correo (útil para pruebas).

## 5. Resumen de Cambios
- **Autenticación**: Ahora es obligatoria para entrar al juego.
- **Persistencia**: Todos los datos se guardan en `profiles.game_state` (JSONB).
- **Escritura segura**: El cliente no puede insertar/actualizar/borrar `profiles`; solo el servidor escribe con `service_role`.
- **Auto-guardado**: El juego se guarda en la nube mediante el servidor.
- **Migración**: Al iniciar sesión, se migra la partida local (si existe) al servidor y se borra de `localStorage`.
