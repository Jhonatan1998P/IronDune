# Iron Dune: Operations — Instalación de Base de Datos

> ⚠️ **REGLA DE ORO**: El contenido SQL de este archivo DEBE ser idéntico al de `server/db/setup.sql`.
> Copia y pega el bloque SQL de abajo **completo** en el **SQL Editor** de Supabase y presiona **Run**.  
> Este script hace un hard reset: borra todo lo anterior, recrea el esquema, configura permisos RLS y crea todas las funciones que el servidor necesita.

---

## SCRIPT ÚNICO (Reset + Tablas + Permisos + Funciones)

```sql
-- ══════════════════════════════════════════════════════════════════
-- IRON DUNE OPERATIONS — SCRIPT MAESTRO DE BASE DE DATOS
-- ⚠️ IMPORTANTE: Este archivo es la FUENTE DE VERDAD. 
-- Cualquier cambio aquí DEBE replicarse en DATABASE_INSTALL.md
-- Uso: ejecutar completo para hard reset + reconstrucción total.
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- SECCIÓN 1: LIMPIEZA TOTAL (Drop de todo lo anterior)
-- ─────────────────────────────────────────────────────────────────

-- Intentar borrar triggers de auth si existen (suelen causar el error "Database error saving new user")
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    END IF;
END $$;

DROP TRIGGER IF EXISTS on_profile_created_init ON public.profiles;
DROP TRIGGER IF EXISTS tr_update_prod_on_building ON public.player_buildings;

DROP FUNCTION IF EXISTS public.initialize_player_data() CASCADE;
DROP FUNCTION IF EXISTS public.on_building_change_update_prod() CASCADE;
DROP FUNCTION IF EXISTS public.update_player_production_rates(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.sync_all_production_v2() CASCADE;
DROP FUNCTION IF EXISTS public.add_resources(uuid, numeric, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.subtract_resources(uuid, numeric, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.process_queues() CASCADE;
DROP FUNCTION IF EXISTS public.check_queue_limits() CASCADE;

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
DROP TABLE IF EXISTS public.construction_queue CASCADE;
DROP TABLE IF EXISTS public.research_queue     CASCADE;
DROP TABLE IF EXISTS public.unit_queue         CASCADE;

DROP TYPE IF EXISTS public.report_type   CASCADE;
DROP TYPE IF EXISTS public.movement_type CASCADE;
DROP TYPE IF EXISTS public.user_role     CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- SECCIÓN 2: TIPOS DE DATOS
-- ─────────────────────────────────────────────────────────────────
CREATE TYPE public.user_role     AS ENUM ('user', 'premium', 'moderator', 'admin', 'dev');
CREATE TYPE public.movement_type AS ENUM ('attack', 'support', 'mission', 'patrol', 'salvage', 'return');
CREATE TYPE public.report_type   AS ENUM ('COMBAT', 'INTEL', 'SYSTEM', 'TRADE');

-- ─────────────────────────────────────────────────────────────────
-- SECCIÓN 3: TABLAS
-- ─────────────────────────────────────────────────────────────────

-- Perfiles de jugadores
CREATE TABLE public.profiles (
  id               uuid PRIMARY KEY,
  username         text UNIQUE NOT NULL,
  role             public.user_role NOT NULL DEFAULT 'user',
  empire_points    bigint DEFAULT 0,
  combat_points    bigint DEFAULT 0,
  economy_points   bigint DEFAULT 0,
  campaign_points  bigint DEFAULT 0,
  game_state       jsonb NOT NULL DEFAULT '{}',
  last_active      timestamp with time zone DEFAULT now(),
  updated_at       timestamp with time zone DEFAULT now()
);

-- Colas de Construcción e Investigación (Máx 3)
CREATE TABLE public.construction_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  building_type text NOT NULL,
  target_level integer NOT NULL,
  end_time bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.research_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  tech_type text NOT NULL,
  target_level integer NOT NULL,
  end_time bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Cola de Reclutamiento (Máx 5)
CREATE TABLE public.unit_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_type text NOT NULL,
  amount integer NOT NULL,
  end_time bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Trigger para límites de cola
CREATE OR REPLACE FUNCTION public.check_queue_limits()
RETURNS TRIGGER AS $$
DECLARE
    current_count integer;
    max_limit integer;
BEGIN
    IF TG_TABLE_NAME = 'construction_queue' THEN max_limit := 3;
    ELSIF TG_TABLE_NAME = 'research_queue' THEN max_limit := 3;
    ELSIF TG_TABLE_NAME = 'unit_queue' THEN max_limit := 5;
    ELSE max_limit := 10;
    END IF;

    EXECUTE format('SELECT count(*)::integer FROM public.%I WHERE player_id = $1', TG_TABLE_NAME)
    INTO current_count
    USING NEW.player_id;

    IF current_count >= max_limit THEN
        RAISE EXCEPTION 'Queue limit reached for % (max %)', TG_TABLE_NAME, max_limit;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_construction_limit BEFORE INSERT ON public.construction_queue FOR EACH ROW EXECUTE FUNCTION public.check_queue_limits();
CREATE TRIGGER tr_check_research_limit BEFORE INSERT ON public.research_queue FOR EACH ROW EXECUTE FUNCTION public.check_queue_limits();
CREATE TRIGGER tr_check_unit_limit BEFORE INSERT ON public.unit_queue FOR EACH ROW EXECUTE FUNCTION public.check_queue_limits();

-- Economía del jugador
CREATE TABLE public.player_economy (
  player_id            uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  money                numeric(20, 2) DEFAULT 10000,
  oil                  numeric(20, 2) DEFAULT 5000,
  ammo                 numeric(20, 2) DEFAULT 2000,
  gold                 numeric(20, 2) DEFAULT 0,
  diamond              numeric(20, 2) DEFAULT 0,
  bank_balance         numeric(20, 2) DEFAULT 0,
  money_prod           numeric(20, 2) DEFAULT 0,
  oil_prod             numeric(20, 2) DEFAULT 0,
  ammo_prod            numeric(20, 2) DEFAULT 0,
  gold_prod            numeric(20, 2) DEFAULT 0,
  last_calc_time       bigint NOT NULL DEFAULT 0,
  last_production_sync timestamp with time zone DEFAULT now()
);

-- Edificios del jugador
CREATE TABLE public.player_buildings (
  player_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  building_type    text NOT NULL,
  level            integer DEFAULT 0,
  quantity         integer DEFAULT 0,
  upgrade_end_time bigint,
  PRIMARY KEY (player_id, building_type)
);

-- Investigación del jugador
CREATE TABLE public.player_research (
  player_id         uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  tech_type         text NOT NULL,
  level             integer DEFAULT 0,
  research_end_time bigint,
  PRIMARY KEY (player_id, tech_type)
);

-- Unidades del jugador
CREATE TABLE public.player_units (
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_type text NOT NULL,
  count     bigint DEFAULT 0,
  PRIMARY KEY (player_id, unit_type)
);

-- Bots globales
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

-- Campos de salvamento
CREATE TABLE public.salvage_fields (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id              text,
  origin                 text,
  resources              jsonb NOT NULL,
  initial_resources      jsonb,
  attacker_id            uuid,
  attacker_name          text,
  defender_id            uuid,
  defender_name          text,
  is_partially_harvested boolean DEFAULT false,
  harvest_count          integer DEFAULT 0,
  total_value            bigint DEFAULT 0,
  expires_at             timestamp with time zone NOT NULL,
  war_id                 text,
  wave_number            integer,
  created_at             timestamp with time zone DEFAULT now()
);

-- Movimientos de tropas
CREATE TABLE public.movements (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id  uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id  uuid NOT NULL,
  type       text NOT NULL,
  units      jsonb NOT NULL,
  resources  jsonb DEFAULT '{}',
  start_time bigint NOT NULL,
  end_time   bigint NOT NULL,
  status     text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now()
);

-- Informes de batalla y sistema
CREATE TABLE public.reports (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      text NOT NULL,
  content    jsonb NOT NULL,
  type       text NOT NULL,
  is_read    boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Mensajes privados
CREATE TABLE public.inbox (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  receiver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject     text,
  body        text NOT NULL,
  read_at     timestamp with time zone,
  created_at  timestamp with time zone DEFAULT now()
);

-- Mercado global
CREATE TABLE public.global_market (
  resource_type text PRIMARY KEY,
  base_price    numeric(20, 4) NOT NULL,
  current_price numeric(20, 4) NOT NULL,
  buy_volume    bigint DEFAULT 0,
  sell_volume   bigint DEFAULT 0,
  last_update   timestamp with time zone DEFAULT now()
);

-- Eventos mundiales
CREATE TABLE public.world_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type  text NOT NULL,
  multiplier  numeric(5, 2) DEFAULT 1.0,
  description text,
  starts_at   timestamp with time zone NOT NULL,
  expires_at  timestamp with time zone NOT NULL,
  created_at  timestamp with time zone DEFAULT now()
);

-- Vista de Ranking Global (Jugadores + Bots)
CREATE OR REPLACE VIEW public.v_global_ranking AS
SELECT 
    id, 
    username as name, 
    empire_points as score_dominion, 
    combat_points as score_combat, 
    economy_points as score_economy, 
    campaign_points as score_campaign, 
    'player' as type,
    role,
    updated_at
FROM public.profiles
UNION ALL
SELECT 
    id, 
    name, 
    score as score_dominion, 
    COALESCE((stats->>'MILITARY')::bigint, 0) as score_combat,
    COALESCE((stats->>'ECONOMY')::bigint, 0) as score_economy,
    COALESCE((stats->>'DOMINION')::bigint, 0) as score_campaign, -- Reusando dominion para campaña en bots
    'bot' as type,
    'user'::user_role as role,
    created_at as updated_at
FROM public.bots;

-- Función para procesar colas terminadas
CREATE OR REPLACE FUNCTION public.process_queues()
RETURNS TABLE (processed_constructions integer, processed_research integer, processed_units integer) AS $$
DECLARE
    now_ms bigint := EXTRACT(EPOCH FROM NOW()) * 1000;
    c_count integer := 0;
    r_count integer := 0;
    u_count integer := 0;
    rec record;
BEGIN
    -- 1. Procesar Construcciones
    FOR rec IN (SELECT * FROM public.construction_queue WHERE end_time <= now_ms) LOOP
        INSERT INTO public.player_buildings (player_id, building_type, level, quantity)
        VALUES (rec.player_id, rec.building_type, rec.target_level, 0)
        ON CONFLICT (player_id, building_type) DO UPDATE SET 
            level = EXCLUDED.level,
            quantity = CASE WHEN public.player_buildings.quantity > 0 THEN EXCLUDED.level ELSE public.player_buildings.quantity END;
        
        DELETE FROM public.construction_queue WHERE id = rec.id;
        c_count := c_count + 1;
    END LOOP;

    -- 2. Procesar Investigación
    FOR rec IN (SELECT * FROM public.research_queue WHERE end_time <= now_ms) LOOP
        INSERT INTO public.player_research (player_id, tech_type, level)
        VALUES (rec.player_id, rec.tech_type, rec.target_level)
        ON CONFLICT (player_id, tech_type) DO UPDATE SET level = EXCLUDED.level;
        
        DELETE FROM public.research_queue WHERE id = rec.id;
        r_count := r_count + 1;
    END LOOP;

    -- 3. Procesar Unidades
    FOR rec IN (SELECT * FROM public.unit_queue WHERE end_time <= now_ms) LOOP
        INSERT INTO public.player_units (player_id, unit_type, count)
        VALUES (rec.player_id, rec.unit_type, rec.amount)
        ON CONFLICT (player_id, unit_type) DO UPDATE SET count = public.player_units.count + EXCLUDED.count;
        
        DELETE FROM public.unit_queue WHERE id = rec.id;
        u_count := u_count + 1;
    END LOOP;

    RETURN QUERY SELECT c_count, r_count, u_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- SECCIÓN 4: SEGURIDAD (Row Level Security)
-- ─────────────────────────────────────────────────────────────────
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
ALTER TABLE public.construction_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_queue     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_queue         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_events      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "construction_queue_all" ON public.construction_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "research_queue_all"     ON public.research_queue     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "unit_queue_all"         ON public.unit_queue         FOR ALL USING (true) WITH CHECK (true);

-- profiles: lectura pública; insert/update abierto (el server usa service_role que bypasa RLS)
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (true);

-- economía, edificios, investigación, unidades: acceso total (el server usa service_role que bypass RLS)
CREATE POLICY "economy_all"   ON public.player_economy   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "buildings_all" ON public.player_buildings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "research_all"  ON public.player_research  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "units_all"     ON public.player_units     FOR ALL USING (true) WITH CHECK (true);

-- bots: solo lectura pública
CREATE POLICY "bots_read" ON public.bots FOR SELECT USING (true);

-- salvage: lectura pública, escritura libre (el server es el único que escribe)
CREATE POLICY "salvage_read"      ON public.salvage_fields FOR SELECT USING (true);
CREATE POLICY "salvage_write_all" ON public.salvage_fields FOR ALL   USING (true) WITH CHECK (true);

-- movimientos y reportes: acceso total (el server escribe desde service_role)
CREATE POLICY "movements_all" ON public.movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "reports_all"   ON public.reports   FOR ALL USING (true) WITH CHECK (true);

-- inbox
CREATE POLICY "inbox_all" ON public.inbox FOR ALL USING (true) WITH CHECK (true);

-- mercado y eventos: solo lectura pública
CREATE POLICY "market_read" ON public.global_market FOR SELECT USING (true);
CREATE POLICY "events_read" ON public.world_events  FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────
-- SECCIÓN 5: FUNCIONES RPC (requeridas por el Scheduler del servidor)
-- ─────────────────────────────────────────────────────────────────

-- Sumar recursos de forma atómica (usado en combate y retorno de tropas)
CREATE OR REPLACE FUNCTION public.add_resources(p_id uuid, m numeric, o numeric, a numeric)
RETURNS void AS $$
BEGIN
  UPDATE public.player_economy
  SET money = money + m, oil = oil + o, ammo = ammo + a
  WHERE player_id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restar recursos de forma atómica, nunca por debajo de 0
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

-- Recalcular tasas de producción (_prod) a partir de edificios actuales.
-- Llamada automáticamente por el trigger tr_update_prod_on_building.
CREATE OR REPLACE FUNCTION public.update_player_production_rates(p_id uuid)
RETURNS void AS $$
DECLARE
  v_money_prod numeric(20, 2) := 0;
  v_oil_prod   numeric(20, 2) := 0;
  v_ammo_prod  numeric(20, 2) := 0;
  v_gold_prod  numeric(20, 2) := 0;
BEGIN
  SELECT
    COALESCE(SUM(CASE building_type
      WHEN 'HOUSE'      THEN quantity * 500.0   / 600.0
      WHEN 'FACTORY'    THEN quantity * 2500.0  / 600.0
      WHEN 'SKYSCRAPER' THEN quantity * 12500.0 / 600.0
      ELSE 0 END), 0),
    COALESCE(SUM(CASE building_type WHEN 'OIL_RIG'           THEN quantity * 200.0 / 600.0 ELSE 0 END), 0),
    COALESCE(SUM(CASE building_type WHEN 'MUNITIONS_FACTORY' THEN quantity * 700.0 / 600.0 ELSE 0 END), 0),
    COALESCE(SUM(CASE building_type WHEN 'GOLD_MINE'         THEN quantity * 64.0  / 600.0 ELSE 0 END), 0)
  INTO v_money_prod, v_oil_prod, v_ammo_prod, v_gold_prod
  FROM public.player_buildings
  WHERE player_id = p_id;

  UPDATE public.player_economy
  SET money_prod = v_money_prod,
      oil_prod   = v_oil_prod,
      ammo_prod  = v_ammo_prod,
      gold_prod  = v_gold_prod
  WHERE player_id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sincronización de producción offline y procesamiento de colas para TODOS los jugadores.
-- Llamada por el Scheduler cada minuto vía: supabase.rpc('sync_all_production_v2')
CREATE OR REPLACE FUNCTION public.sync_all_production_v2()
RETURNS TABLE (processed_players integer, processed_constructions integer, processed_research integer, processed_units integer) AS $$
DECLARE
  now_ms   bigint := EXTRACT(EPOCH FROM NOW()) * 1000;
  limit_ms bigint := 6 * 60 * 60 * 1000; -- tope de 6 horas de producción offline
  p_count  integer;
  q_results record;
BEGIN
  -- 1. Procesar Producción
  UPDATE public.player_economy
  SET
    money  = money  + (money_prod  * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
    oil    = oil    + (oil_prod    * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
    ammo   = ammo   + (ammo_prod   * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
    gold   = gold   + (gold_prod   * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
    last_calc_time       = now_ms,
    last_production_sync = NOW()
  WHERE last_calc_time < now_ms;

  SELECT COUNT(*)::integer INTO p_count FROM public.player_economy;

  -- 2. Procesar Colas
  SELECT * INTO q_results FROM public.process_queues();

  RETURN QUERY SELECT p_count, q_results.processed_constructions, q_results.processed_research, q_results.processed_units;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- SECCIÓN 6: TRIGGERS
-- ─────────────────────────────────────────────────────────────────

-- Trigger: recalcular producción cuando cambian los edificios del jugador
CREATE OR REPLACE FUNCTION public.on_building_change_update_prod()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.update_player_production_rates(COALESCE(NEW.player_id, OLD.player_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_prod_on_building
  AFTER INSERT OR UPDATE OR DELETE ON public.player_buildings
  FOR EACH ROW EXECUTE FUNCTION public.on_building_change_update_prod();

-- Trigger: inicializar datos económicos y edificios al crear un perfil
CREATE OR REPLACE FUNCTION public.initialize_player_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Crear economía inicial con recursos de inicio (estilo OGame)
  INSERT INTO public.player_economy (player_id, last_calc_time, money, oil, ammo)
  VALUES (NEW.id, EXTRACT(EPOCH FROM NOW()) * 1000, 10000, 5000, 2000)
  ON CONFLICT (player_id) DO NOTHING;

  -- Crear edificios iniciales (producción básica)
  INSERT INTO public.player_buildings (player_id, building_type, quantity)
  VALUES (NEW.id, 'HOUSE', 1), (NEW.id, 'FACTORY', 1)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_init
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.initialize_player_data();
```

---

## Notas

**Confirmación de email**: Desactívala en Supabase para desarrollo:  
`Authentication → Settings → Email Auth → "Confirm email" → OFF`

**Service Role**: El servidor Node.js siempre usa `SUPABASE_SERVICE_ROLE_KEY` para saltarse RLS.  
El cliente del navegador usa `VITE_SUPABASE_ANON_KEY` (respeta RLS).

**Variables de entorno requeridas en el servidor**:
```
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
DATABASE_URL=postgresql://postgres...
VITE_SOCKET_SERVER_URL=https://irondune.onrender.com
```

**Hard reset desde la shell local**:
```bash
npm run db:reset --prefix server
```

**Hard reset en el próximo deploy de Render**:  
Agrega `DB_HARD_RESET=true` a las variables de entorno de Render, haz el deploy, y luego **elimínala** para que no se ejecute en deploys futuros.
