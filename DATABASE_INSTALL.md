# Iron Dune: Operations — Instalación de Base de Datos

> Copia y pega este script **completo** en el **SQL Editor** de Supabase y presiona **Run**.  
> Está dividido en 3 bloques. Puedes ejecutarlos juntos o uno a uno.  
> ⚠️ El **Bloque 1 elimina TODOS los datos existentes** — úsalo solo para una instalación limpia.

---

## BLOQUE 1 — RESET TOTAL (Eliminar todo lo anterior)

```sql
-- ══════════════════════════════════════════════════════════════════
-- BLOQUE 1: RESET TOTAL
-- Elimina todas las tablas, funciones, triggers y tipos personalizados.
-- ⚠️  BORRA TODOS LOS DATOS. Solo ejecutar en instalación limpia.
-- ══════════════════════════════════════════════════════════════════

-- 1.1 Eliminar triggers antes que las funciones que los usan
DROP TRIGGER IF EXISTS on_profile_created_init ON public.profiles;

-- 1.2 Eliminar funciones
DROP FUNCTION IF EXISTS public.initialize_player_data() CASCADE;
DROP FUNCTION IF EXISTS public.add_resources(uuid, numeric, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.subtract_resources(uuid, numeric, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.update_player_production_rates(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.sync_all_production_v2() CASCADE;

-- 1.3 Eliminar tablas (CASCADE elimina automáticamente las FK dependientes)
DROP TABLE IF EXISTS public.inbox             CASCADE;
DROP TABLE IF EXISTS public.reports           CASCADE;
DROP TABLE IF EXISTS public.movements         CASCADE;
DROP TABLE IF EXISTS public.salvage_fields    CASCADE;
DROP TABLE IF EXISTS public.world_events      CASCADE;
DROP TABLE IF EXISTS public.global_market     CASCADE;
DROP TABLE IF EXISTS public.player_units      CASCADE;
DROP TABLE IF EXISTS public.player_research   CASCADE;
DROP TABLE IF EXISTS public.player_buildings  CASCADE;
DROP TABLE IF EXISTS public.player_economy    CASCADE;
DROP TABLE IF EXISTS public.bots              CASCADE;
DROP TABLE IF EXISTS public.profiles          CASCADE;

-- 1.4 Eliminar tipos ENUM personalizados
DROP TYPE IF EXISTS public.report_type   CASCADE;
DROP TYPE IF EXISTS public.movement_type CASCADE;
DROP TYPE IF EXISTS public.user_role     CASCADE;
```

---

## BLOQUE 2 — CREAR TABLAS Y FUNCIONES

```sql
-- ══════════════════════════════════════════════════════════════════
-- BLOQUE 2: CREAR ESQUEMA COMPLETO
-- ══════════════════════════════════════════════════════════════════

-- 2.1 Tipos ENUM
CREATE TYPE public.user_role     AS ENUM ('user', 'premium', 'moderator', 'admin', 'dev');
CREATE TYPE public.movement_type AS ENUM ('attack', 'support', 'mission', 'patrol', 'salvage');
CREATE TYPE public.report_type   AS ENUM ('combat', 'intel', 'system', 'trade');

-- ─────────────────────────────────────────────────────────────────
-- 2.2 Tabla principal de perfiles
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id             uuid PRIMARY KEY,              -- mismo UUID que auth.users
  username       text UNIQUE NOT NULL,          -- nombre de comandante elegido al registrarse
  role           public.user_role NOT NULL DEFAULT 'user',
  empire_points  bigint DEFAULT 0,
  game_state     jsonb NOT NULL DEFAULT '{}',   -- campos misceláneos (tutorial, bandera, etc.)
  last_active    timestamp with time zone DEFAULT now(),
  updated_at     timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- 2.3 Economía del jugador
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE public.player_economy (
  player_id            uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  money                numeric(20, 2) DEFAULT 10000,
  oil                  numeric(20, 2) DEFAULT 5000,
  ammo                 numeric(20, 2) DEFAULT 2000,
  gold                 numeric(20, 2) DEFAULT 0,
  diamond              numeric(20, 2) DEFAULT 0,
  bank_balance         numeric(20, 2) DEFAULT 0,
  money_prod           numeric(20, 2) DEFAULT 0,   -- producción por segundo (calculado)
  oil_prod             numeric(20, 2) DEFAULT 0,
  ammo_prod            numeric(20, 2) DEFAULT 0,
  gold_prod            numeric(20, 2) DEFAULT 0,
  last_calc_time       bigint NOT NULL DEFAULT 0,  -- timestamp ms del último sync
  last_production_sync timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- 2.4 Edificios del jugador
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE public.player_buildings (
  player_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  building_type    text NOT NULL,
  level            integer DEFAULT 0,     -- para edificios de nivel (WALL, RADAR, etc.)
  quantity         integer DEFAULT 0,     -- para edificios de cantidad (HOUSE, FACTORY, etc.)
  upgrade_end_time bigint,                -- timestamp ms de fin de mejora en curso
  PRIMARY KEY (player_id, building_type)
);

-- ─────────────────────────────────────────────────────────────────
-- 2.5 Investigación del jugador
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE public.player_research (
  player_id         uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  tech_type         text NOT NULL,
  level             integer DEFAULT 0,
  research_end_time bigint,
  PRIMARY KEY (player_id, tech_type)
);

-- ─────────────────────────────────────────────────────────────────
-- 2.6 Unidades del jugador
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE public.player_units (
  player_id  uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_type  text NOT NULL,
  count      bigint DEFAULT 0,
  PRIMARY KEY (player_id, unit_type)
);

-- ─────────────────────────────────────────────────────────────────
-- 2.7 Bots (NPC del mundo)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE public.bots (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  personality text NOT NULL,
  score       bigint DEFAULT 0,
  country     text DEFAULT 'US',
  units       jsonb NOT NULL DEFAULT '{}',
  stats       jsonb NOT NULL DEFAULT '{}',
  reputation  integer DEFAULT 50,
  created_at  timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- 2.8 Campos de salvamento (post-batalla)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE public.salvage_fields (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id             text,
  origin                text,
  resources             jsonb NOT NULL,
  initial_resources     jsonb,
  attacker_id           uuid,
  attacker_name         text,
  defender_id           uuid,
  defender_name         text,
  is_partially_harvested boolean DEFAULT false,
  harvest_count         integer DEFAULT 0,
  total_value           bigint DEFAULT 0,
  expires_at            timestamp with time zone NOT NULL,
  war_id                text,
  wave_number           integer,
  created_at            timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- 2.9 Movimientos militares
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE public.movements (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id   uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id   uuid NOT NULL,
  type        public.movement_type NOT NULL,
  units       jsonb NOT NULL,
  resources   jsonb DEFAULT '{}',
  start_time  bigint NOT NULL,
  end_time    bigint NOT NULL,
  status      text DEFAULT 'active',
  created_at  timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- 2.10 Reportes / Logs de combate
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE public.reports (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      text NOT NULL,
  content    jsonb NOT NULL,
  type       public.report_type NOT NULL,
  is_read    boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- 2.11 Bandeja de entrada (mensajes entre jugadores)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE public.inbox (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  receiver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject     text,
  body        text NOT NULL,
  read_at     timestamp with time zone,
  created_at  timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- 2.12 Mercado global y eventos del mundo
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE public.global_market (
  resource_type text PRIMARY KEY,
  base_price    numeric(20, 4) NOT NULL,
  current_price numeric(20, 4) NOT NULL,
  buy_volume    bigint DEFAULT 0,
  sell_volume   bigint DEFAULT 0,
  last_update   timestamp with time zone DEFAULT now()
);

CREATE TABLE public.world_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type  text NOT NULL,
  multiplier  numeric(5, 2) DEFAULT 1.0,
  description text,
  starts_at   timestamp with time zone NOT NULL,
  expires_at  timestamp with time zone NOT NULL,
  created_at  timestamp with time zone DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- 2.13 Funciones RPC (llamadas desde el cliente)
-- ─────────────────────────────────────────────────────────────────

-- Sumar recursos a un jugador
CREATE OR REPLACE FUNCTION public.add_resources(p_id uuid, m numeric, o numeric, a numeric)
RETURNS void AS $$
BEGIN
  UPDATE public.player_economy
  SET money = money + m,
      oil   = oil   + o,
      ammo  = ammo  + a
  WHERE player_id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restar recursos (sin bajar de 0)
CREATE OR REPLACE FUNCTION public.subtract_resources(p_id uuid, m numeric, o numeric, a numeric)
RETURNS void AS $$
BEGIN
  UPDATE public.player_economy
  SET money = GREATEST(0, money - m),
      oil   = GREATEST(0, oil   - o),
      ammo  = GREATEST(0, ammo  - a)
  WHERE player_id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recalcular tasas de producción desde los edificios actuales
CREATE OR REPLACE FUNCTION public.update_player_production_rates(p_id uuid)
RETURNS void AS $$
DECLARE
  v_money_prod numeric(20, 2) := 0;
  v_oil_prod   numeric(20, 2) := 0;
  v_ammo_prod  numeric(20, 2) := 0;
  v_gold_prod  numeric(20, 2) := 0;
BEGIN
  SELECT
    SUM(CASE building_type
          WHEN 'HOUSE'               THEN quantity * 500.0   / 600.0
          WHEN 'FACTORY'             THEN quantity * 2500.0  / 600.0
          WHEN 'SKYSCRAPER'          THEN quantity * 12500.0 / 600.0
          ELSE 0 END),
    SUM(CASE building_type
          WHEN 'OIL_RIG'             THEN quantity * 200.0  / 600.0
          ELSE 0 END),
    SUM(CASE building_type
          WHEN 'MUNITIONS_FACTORY'   THEN quantity * 700.0  / 600.0
          ELSE 0 END),
    SUM(CASE building_type
          WHEN 'GOLD_MINE'           THEN quantity * 64.0   / 600.0
          ELSE 0 END)
  INTO v_money_prod, v_oil_prod, v_ammo_prod, v_gold_prod
  FROM public.player_buildings
  WHERE player_id = p_id;

  UPDATE public.player_economy
  SET money_prod = COALESCE(v_money_prod, 0),
      oil_prod   = COALESCE(v_oil_prod,   0),
      ammo_prod  = COALESCE(v_ammo_prod,  0),
      gold_prod  = COALESCE(v_gold_prod,  0)
  WHERE player_id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sincronizar producción offline de TODOS los jugadores (llamar desde cron job)
CREATE OR REPLACE FUNCTION public.sync_all_production_v2()
RETURNS TABLE (processed_count integer) AS $$
DECLARE
  now_ms   bigint := EXTRACT(EPOCH FROM NOW()) * 1000;
  limit_ms bigint := 6 * 60 * 60 * 1000;  -- máximo 6 horas de producción offline
BEGIN
  UPDATE public.player_economy
  SET
    money          = money + (money_prod * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
    oil            = oil   + (oil_prod   * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
    ammo           = ammo  + (ammo_prod  * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
    gold           = gold  + (gold_prod  * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
    last_calc_time         = now_ms,
    last_production_sync   = NOW()
  WHERE last_calc_time < now_ms;

  RETURN QUERY SELECT COUNT(*)::integer FROM public.player_economy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- 2.14 Trigger: inicializar datos del jugador al crear su perfil
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.initialize_player_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Crear economía inicial
  INSERT INTO public.player_economy (player_id, last_calc_time)
  VALUES (NEW.id, EXTRACT(EPOCH FROM NOW()) * 1000);

  -- Crear edificios iniciales
  INSERT INTO public.player_buildings (player_id, building_type, quantity)
  VALUES
    (NEW.id, 'HOUSE',   1),
    (NEW.id, 'FACTORY', 1);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_init
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_player_data();
```

---

## BLOQUE 3 — ROW LEVEL SECURITY (Permisos por tabla)

```sql
-- ══════════════════════════════════════════════════════════════════
-- BLOQUE 3: SEGURIDAD (RLS)
-- Habilita RLS en todas las tablas y define quién puede hacer qué.
-- Regla general: cada usuario solo lee/escribe sus propios datos.
-- ══════════════════════════════════════════════════════════════════

-- 3.1 Habilitar RLS en todas las tablas
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_economy   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_research  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_units     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bots             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salvage_fields   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_market    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_events     ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────
-- 3.2 PROFILES
-- Todos pueden leer (rankings, búsqueda de jugadores).
-- Solo el dueño puede insertar, actualizar y eliminar su perfil.
-- ─────────────────────────────────────────────────────────────────
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────
-- 3.3 PLAYER_ECONOMY
-- Solo el dueño accede y modifica sus recursos.
-- ─────────────────────────────────────────────────────────────────
CREATE POLICY "economy_own"
  ON public.player_economy FOR ALL
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

-- ─────────────────────────────────────────────────────────────────
-- 3.4 PLAYER_BUILDINGS
-- Solo el dueño accede y modifica sus edificios.
-- ─────────────────────────────────────────────────────────────────
CREATE POLICY "buildings_own"
  ON public.player_buildings FOR ALL
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

-- ─────────────────────────────────────────────────────────────────
-- 3.5 PLAYER_RESEARCH
-- Solo el dueño accede y modifica su investigación.
-- ─────────────────────────────────────────────────────────────────
CREATE POLICY "research_own"
  ON public.player_research FOR ALL
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

-- ─────────────────────────────────────────────────────────────────
-- 3.6 PLAYER_UNITS
-- Solo el dueño accede y modifica sus unidades.
-- ─────────────────────────────────────────────────────────────────
CREATE POLICY "units_own"
  ON public.player_units FOR ALL
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

-- ─────────────────────────────────────────────────────────────────
-- 3.7 BOTS
-- Todos pueden leer los bots (son NPCs públicos).
-- Nadie puede modificarlos desde el cliente (solo el servidor).
-- ─────────────────────────────────────────────────────────────────
CREATE POLICY "bots_read"
  ON public.bots FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────────────
-- 3.8 SALVAGE_FIELDS
-- Todos pueden leer campos de salvamento (mundo compartido).
-- Solo el atacante que los creó puede modificarlos.
-- ─────────────────────────────────────────────────────────────────
CREATE POLICY "salvage_read"
  ON public.salvage_fields FOR SELECT
  USING (true);

CREATE POLICY "salvage_update_own"
  ON public.salvage_fields FOR UPDATE
  USING (auth.uid() = attacker_id);

-- ─────────────────────────────────────────────────────────────────
-- 3.9 MOVEMENTS
-- El jugador ve sus propios movimientos (enviados o recibidos).
-- ─────────────────────────────────────────────────────────────────
CREATE POLICY "movements_own"
  ON public.movements FOR ALL
  USING (auth.uid() = sender_id OR auth.uid()::text = target_id::text);

-- ─────────────────────────────────────────────────────────────────
-- 3.10 REPORTS
-- Cada jugador solo ve y gestiona sus propios reportes.
-- ─────────────────────────────────────────────────────────────────
CREATE POLICY "reports_own"
  ON public.reports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────
-- 3.11 INBOX
-- El remitente puede enviar; el receptor puede leer y eliminar.
-- ─────────────────────────────────────────────────────────────────
CREATE POLICY "inbox_sender"
  ON public.inbox FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "inbox_receiver"
  ON public.inbox FOR SELECT
  USING (auth.uid() = receiver_id);

CREATE POLICY "inbox_delete"
  ON public.inbox FOR DELETE
  USING (auth.uid() = receiver_id);

-- ─────────────────────────────────────────────────────────────────
-- 3.12 GLOBAL_MARKET y WORLD_EVENTS
-- Solo lectura pública (el servidor los actualiza mediante service_role).
-- ─────────────────────────────────────────────────────────────────
CREATE POLICY "market_read"
  ON public.global_market FOR SELECT
  USING (true);

CREATE POLICY "events_read"
  ON public.world_events FOR SELECT
  USING (true);
```

---

## Notas adicionales

**Confirmación de email**: Por defecto Supabase requiere que el usuario confirme su correo antes de iniciar sesión. Para desactivarlo durante desarrollo ve a  
`Supabase → Authentication → Settings → Email Auth → "Confirm email" → OFF`.

**Service Role**: Las funciones `sync_all_production_v2()` y cualquier operación administrativa deben llamarse con la clave `service_role` (nunca exponer esa clave en el cliente).

**Variables de entorno requeridas en el frontend**:
```
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_SOCKET_SERVER_URL=https://irondune.onrender.com
```
