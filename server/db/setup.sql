-- ==========================================
-- ESTRUCTURA MAESTRA FINAL DE IRON DUNE
-- ==========================================

-- 1. TIPOS DE DATOS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('user', 'premium', 'moderator', 'admin', 'dev');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_type') THEN
        CREATE TYPE movement_type AS ENUM ('attack', 'support', 'mission', 'patrol', 'salvage');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_type') THEN
        CREATE TYPE report_type AS ENUM ('combat', 'intel', 'system', 'trade');
    END IF;
END $$;

-- 2. TABLA DE PERFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  game_state jsonb NOT NULL DEFAULT '{}',
  empire_points bigint DEFAULT 0,
  last_active timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 3. ECONOMÍA
CREATE TABLE IF NOT EXISTS public.player_economy (
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  money numeric(20, 2) DEFAULT 10000,
  oil numeric(20, 2) DEFAULT 5000,
  ammo numeric(20, 2) DEFAULT 2000,
  gold numeric(20, 2) DEFAULT 0,
  diamond numeric(20, 2) DEFAULT 0,
  bank_balance numeric(20, 2) DEFAULT 0,
  money_prod numeric(20, 2) DEFAULT 0,
  oil_prod numeric(20, 2) DEFAULT 0,
  ammo_prod numeric(20, 2) DEFAULT 0,
  gold_prod numeric(20, 2) DEFAULT 0,
  last_calc_time bigint NOT NULL,
  last_production_sync timestamp with time zone DEFAULT now()
);

-- FUNCIÓN PARA CALCULAR Y ACTUALIZAR TASAS DE PRODUCCIÓN (_prod)
-- Basado en data/buildings.ts: rate = amount / 600 (10 mins en segundos)
CREATE OR REPLACE FUNCTION public.update_player_production_rates(p_id uuid)
RETURNS void AS $$
DECLARE
    v_money_prod numeric(20, 2) := 0;
    v_oil_prod numeric(20, 2) := 0;
    v_ammo_prod numeric(20, 2) := 0;
    v_gold_prod numeric(20, 2) := 0;
    v_diamond_prod numeric(20, 2) := 0;
BEGIN
    -- Sumar producción de edificios QUANTITY (House, Factory, Skyscraper, Oil Rig, Gold Mine, Munitions)
    SELECT 
        SUM(CASE 
            WHEN building_type = 'HOUSE' THEN quantity * 500.0 / 600.0
            WHEN building_type = 'FACTORY' THEN quantity * 2500.0 / 600.0
            WHEN building_type = 'SKYSCRAPER' THEN quantity * 12500.0 / 600.0
            ELSE 0 END),
        SUM(CASE WHEN building_type = 'OIL_RIG' THEN quantity * 200.0 / 600.0 ELSE 0 END),
        SUM(CASE WHEN building_type = 'MUNITIONS_FACTORY' THEN quantity * 700.0 / 600.0 ELSE 0 END),
        SUM(CASE WHEN building_type = 'GOLD_MINE' THEN quantity * 64.0 / 600.0 ELSE 0 END)
    INTO v_money_prod, v_oil_prod, v_ammo_prod, v_gold_prod
    FROM public.player_buildings
    WHERE player_id = p_id;

    -- Sumar producción de edificios LEVEL (Diamond Mine)
    SELECT 
        COALESCE(SUM(CASE WHEN building_type = 'DIAMOND_MINE' THEN level * (1.0/6.0) / 600.0 ELSE 0 END), 0)
    INTO v_diamond_prod
    FROM public.player_buildings
    WHERE player_id = p_id;

    -- Actualizar economía
    UPDATE public.player_economy
    SET 
        money_prod = COALESCE(v_money_prod, 0),
        oil_prod = COALESCE(v_oil_prod, 0),
        ammo_prod = COALESCE(v_ammo_prod, 0),
        gold_prod = COALESCE(v_gold_prod, 0)
        -- diamond_prod no existe en tabla pero podríamos añadirla si fuera necesario
    WHERE player_id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCIÓN MAESTRA DE PRODUCCIÓN OFFLINE (Llamada por el Scheduler)
CREATE OR REPLACE FUNCTION public.sync_all_production_v2()
RETURNS TABLE (processed_count integer) AS $$
DECLARE
    now_ms bigint := EXTRACT(EPOCH FROM NOW()) * 1000;
    limit_ms bigint := 6 * 60 * 60 * 1000; -- OFFLINE_PRODUCTION_LIMIT_MS de constants.js
BEGIN
    -- Actualizar recursos basados en tiempo transcurrido y tasas _prod
    UPDATE public.player_economy
    SET 
        money = money + (money_prod * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
        oil = oil + (oil_prod * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
        ammo = ammo + (ammo_prod * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
        gold = gold + (gold_prod * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
        last_calc_time = now_ms,
        last_production_sync = NOW()
    WHERE last_calc_time < now_ms;

    RETURN QUERY SELECT COUNT(*)::integer FROM public.player_economy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCIONES ATÓMICAS PARA RECURSOS (Uso en Batallas y Retornos)
CREATE OR REPLACE FUNCTION public.add_resources(p_id uuid, m numeric, o numeric, a numeric)
RETURNS void AS $$
BEGIN
  UPDATE public.player_economy
  SET money = money + m,
      oil = oil + o,
      ammo = ammo + a
  WHERE player_id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.subtract_resources(p_id uuid, m numeric, o numeric, a numeric)
RETURNS void AS $$
BEGIN
  UPDATE public.player_economy
  SET money = GREATEST(0, money - m),
      oil = GREATEST(0, oil - o),
      ammo = GREATEST(0, ammo - a)
  WHERE player_id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.on_building_change_update_prod()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.update_player_production_rates(COALESCE(NEW.player_id, OLD.player_id));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_prod_on_building ON public.player_buildings;
CREATE TRIGGER tr_update_prod_on_building
AFTER INSERT OR UPDATE OR DELETE ON public.player_buildings
FOR EACH ROW EXECUTE FUNCTION public.on_building_change_update_prod();

-- 4. EDIFICIOS
CREATE TABLE IF NOT EXISTS public.player_buildings (
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  building_type text NOT NULL,
  level integer DEFAULT 0,
  quantity integer DEFAULT 0,
  upgrade_end_time bigint,
  PRIMARY KEY (player_id, building_type)
);

-- 5. INVESTIGACIÓN
CREATE TABLE IF NOT EXISTS public.player_research (
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  tech_type text NOT NULL,
  level integer DEFAULT 0,
  research_end_time bigint,
  PRIMARY KEY (player_id, tech_type)
);

-- 6. UNIDADES
CREATE TABLE IF NOT EXISTS public.player_units (
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_type text NOT NULL,
  count bigint DEFAULT 0,
  PRIMARY KEY (player_id, unit_type)
);

-- 7. BOTS GLOBALES
CREATE TABLE IF NOT EXISTS public.bots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  personality text NOT NULL,
  score bigint DEFAULT 0,
  country text DEFAULT 'US',
  units jsonb NOT NULL DEFAULT '{}',
  stats jsonb NOT NULL DEFAULT '{}',
  reputation integer DEFAULT 50,
  created_at timestamp with time zone DEFAULT now()
);

-- 8. CAMPOS DE SALVAMENTO (SALVAGE FIELDS)
CREATE TABLE IF NOT EXISTS public.salvage_fields (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id text,
  origin text,
  resources jsonb NOT NULL,
  initial_resources jsonb,
  attacker_id uuid,
  attacker_name text,
  defender_id uuid,
  defender_name text,
  is_partially_harvested boolean DEFAULT false,
  harvest_count integer DEFAULT 0,
  total_value bigint DEFAULT 0,
  expires_at timestamp with time zone NOT NULL,
  war_id text,
  wave_number integer,
  created_at timestamp with time zone DEFAULT now()
);

-- 9. MOVIMIENTOS
CREATE TABLE IF NOT EXISTS public.movements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL,
  type movement_type NOT NULL,
  units jsonb NOT NULL,
  resources jsonb DEFAULT '{}',
  start_time bigint NOT NULL,
  end_time bigint NOT NULL,
  status text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now()
);

-- 10. INFORMES Y MENSAJES
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content jsonb NOT NULL,
  type report_type NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inbox (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  receiver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text,
  body text NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- 11. MERCADO GLOBAL Y ESTADO DEL SERVIDOR (Estilo OGame)
CREATE TABLE IF NOT EXISTS public.global_market (
  resource_type text PRIMARY KEY,
  base_price numeric(20, 4) NOT NULL,
  current_price numeric(20, 4) NOT NULL,
  buy_volume bigint DEFAULT 0,
  sell_volume bigint DEFAULT 0,
  last_update timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.world_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL, -- 'BONUS_PROD', 'CHEAPER_BUILD', 'ASTEROID_STORM'
  multiplier numeric(5, 2) DEFAULT 1.0,
  description text,
  starts_at timestamp with time zone NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 12. SEGURIDAD RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_economy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salvage_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_market ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_events ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS DE MERCADO (Lectura para todos, escritura solo para el servidor)
DROP POLICY IF EXISTS "market_read" ON public.global_market;
CREATE POLICY "market_read" ON public.global_market FOR SELECT USING (true);

DROP POLICY IF EXISTS "events_read" ON public.world_events;
CREATE POLICY "events_read" ON public.world_events FOR SELECT USING (true);

-- POLÍTICAS GENERALES
DROP POLICY IF EXISTS "public_view" ON public.profiles;
CREATE POLICY "public_view" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "self_insert" ON public.profiles;
CREATE POLICY "self_insert" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "self_update" ON public.profiles;
CREATE POLICY "self_update" ON public.profiles FOR UPDATE USING (true);

-- ECONOMÍA, EDIFICIOS, INVESTIGACIÓN, UNIDADES (Acceso total temporal)
DROP POLICY IF EXISTS "owner_access_eco" ON public.player_economy;
CREATE POLICY "owner_access_eco" ON public.player_economy FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_access_buildings" ON public.player_buildings;
CREATE POLICY "owner_access_buildings" ON public.player_buildings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_access_research" ON public.player_research;
CREATE POLICY "owner_access_research" ON public.player_research FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_access_units" ON public.player_units;
CREATE POLICY "owner_access_units" ON public.player_units FOR ALL USING (true) WITH CHECK (true);

-- BOTS (Lectura pública, sin escritura)
DROP POLICY IF EXISTS "bots_read_only" ON public.bots;
CREATE POLICY "bots_read_only" ON public.bots FOR SELECT USING (true);

-- SALVAGE (Público)
DROP POLICY IF EXISTS "all_access_salvage" ON public.salvage_fields;
CREATE POLICY "all_access_salvage" ON public.salvage_fields FOR ALL USING (true);

-- MOVIMIENTOS
DROP POLICY IF EXISTS "owner_access_movements" ON public.movements;
CREATE POLICY "owner_access_movements" ON public.movements FOR ALL USING (true);

-- REPORTS (Privados)
DROP POLICY IF EXISTS "owner_access_reports" ON public.reports;
CREATE POLICY "owner_access_reports" ON public.reports FOR ALL USING (true);

-- INBOX (Dueño o Remitente)
DROP POLICY IF EXISTS "owner_access_inbox" ON public.inbox;
CREATE POLICY "owner_access_inbox" ON public.inbox FOR ALL USING (true);

-- 12. TRIGGER DE INICIALIZACIÓN
CREATE OR REPLACE FUNCTION public.initialize_player_data()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.player_economy (player_id, last_calc_time)
  VALUES (NEW.id, EXTRACT(EPOCH FROM NOW()) * 1000)
  ON CONFLICT (player_id) DO NOTHING;

  -- Crear edificios iniciales (HOUSE y FACTORY son por QUANTITY)
  INSERT INTO public.player_buildings (player_id, building_type, quantity) VALUES (NEW.id, 'HOUSE', 1) ON CONFLICT DO NOTHING;
  INSERT INTO public.player_buildings (player_id, building_type, quantity) VALUES (NEW.id, 'FACTORY', 1) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_init ON public.profiles;
CREATE TRIGGER on_profile_created_init
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.initialize_player_data();

-- 13. HARD RESET (Limpieza total controlada)
-- DELETE FROM public.inbox;
-- DELETE FROM public.reports;
-- DELETE FROM public.movements;
-- DELETE FROM public.salvage_fields;
-- DELETE FROM public.player_units;
-- DELETE FROM public.player_research;
-- DELETE FROM public.player_buildings;
-- DELETE FROM public.player_economy;
-- DELETE FROM public.bots;
-- DELETE FROM public.profiles;
