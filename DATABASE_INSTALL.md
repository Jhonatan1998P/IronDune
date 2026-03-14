# Instalación Manual de Base de Datos - Iron Dune

> **PARCHE CRÍTICO (ejecutar si ya tienes las tablas)**  
> Si el login funciona pero los datos no se guardan en Supabase, copia y ejecuta este bloque en el SQL Editor de Supabase:
> 
> ```sql
> -- Política de escritura propia en profiles (estaba faltando)
> DROP POLICY IF EXISTS "public_view" ON public.profiles;
> CREATE POLICY "profiles_select_all"  ON public.profiles FOR SELECT USING (true);
> CREATE POLICY "profiles_insert_own"  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
> CREATE POLICY "profiles_update_own"  ON public.profiles FOR UPDATE USING (auth.uid() = id);
> CREATE POLICY "profiles_delete_own"  ON public.profiles FOR DELETE USING (auth.uid() = id);
> 
> -- Política propia en reports
> DROP POLICY IF EXISTS "reports_policy" ON public.reports;
> CREATE POLICY "reports_own"   ON public.reports FOR ALL USING (auth.uid() = user_id);
> 
> -- Confirmar que player_economy/buildings/units tienen política de escritura
> DROP POLICY IF EXISTS "owner_access_eco" ON public.player_economy;
> DROP POLICY IF EXISTS "owner_access_buildings" ON public.player_buildings;
> DROP POLICY IF EXISTS "owner_access_units" ON public.player_units;
> CREATE POLICY "eco_own"       ON public.player_economy   FOR ALL USING (auth.uid() = player_id);
> CREATE POLICY "buildings_own" ON public.player_buildings FOR ALL USING (auth.uid() = player_id);
> CREATE POLICY "units_own"     ON public.player_units     FOR ALL USING (auth.uid() = player_id);
> CREATE POLICY "research_own"  ON public.player_research  FOR ALL USING (auth.uid() = player_id);
> ```

---

Copia y pega el siguiente código en el **SQL Editor** de Supabase para reconstruir toda la infraestructura desde cero. Este script incluye todas las tablas normalizadas, funciones de producción SQL y el motor de batalla.

```sql
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
  id uuid PRIMARY KEY,
  username text UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  game_state jsonb NOT NULL DEFAULT '{}',
  empire_points bigint DEFAULT 0,
  last_active timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 3. ECONOMÍA Y PRODUCCIÓN SQL
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

-- 7. BOTS Y MUNDO GLOBAL
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

-- 8. MOVIMIENTOS Y COMUNICACIÓN
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

-- 9. MERCADO Y EVENTOS
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
  event_type text NOT NULL,
  multiplier numeric(5, 2) DEFAULT 1.0,
  description text,
  starts_at timestamp with time zone NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 10. FUNCIONES LÓGICAS (RPC)
CREATE OR REPLACE FUNCTION public.add_resources(p_id uuid, m numeric, o numeric, a numeric)
RETURNS void AS $$
BEGIN
  UPDATE public.player_economy
  SET money = money + m, oil = oil + o, ammo = ammo + a
  WHERE player_id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.subtract_resources(p_id uuid, m numeric, o numeric, a numeric)
RETURNS void AS $$
BEGIN
  UPDATE public.player_economy
  SET money = GREATEST(0, money - m), oil = GREATEST(0, oil - o), ammo = GREATEST(0, ammo - a)
  WHERE player_id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_player_production_rates(p_id uuid)
RETURNS void AS $$
DECLARE
    v_money_prod numeric(20, 2) := 0;
    v_oil_prod numeric(20, 2) := 0;
    v_ammo_prod numeric(20, 2) := 0;
    v_gold_prod numeric(20, 2) := 0;
BEGIN
    SELECT 
        SUM(CASE WHEN building_type = 'HOUSE' THEN quantity * 500.0 / 600.0
                 WHEN building_type = 'FACTORY' THEN quantity * 2500.0 / 600.0
                 WHEN building_type = 'SKYSCRAPER' THEN quantity * 12500.0 / 600.0 ELSE 0 END),
        SUM(CASE WHEN building_type = 'OIL_RIG' THEN quantity * 200.0 / 600.0 ELSE 0 END),
        SUM(CASE WHEN building_type = 'MUNITIONS_FACTORY' THEN quantity * 700.0 / 600.0 ELSE 0 END),
        SUM(CASE WHEN building_type = 'GOLD_MINE' THEN quantity * 64.0 / 600.0 ELSE 0 END)
    INTO v_money_prod, v_oil_prod, v_ammo_prod, v_gold_prod
    FROM public.player_buildings WHERE player_id = p_id;

    UPDATE public.player_economy SET money_prod = COALESCE(v_money_prod, 0), oil_prod = COALESCE(v_oil_prod, 0),
        ammo_prod = COALESCE(v_ammo_prod, 0), gold_prod = COALESCE(v_gold_prod, 0)
    WHERE player_id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_all_production_v2()
RETURNS TABLE (processed_count integer) AS $$
DECLARE
    now_ms bigint := EXTRACT(EPOCH FROM NOW()) * 1000;
    limit_ms bigint := 6 * 60 * 60 * 1000;
BEGIN
    UPDATE public.player_economy
    SET money = money + (money_prod * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
        oil = oil + (oil_prod * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
        ammo = ammo + (ammo_prod * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
        gold = gold + (gold_prod * LEAST(now_ms - last_calc_time, limit_ms) / 1000.0),
        last_calc_time = now_ms, last_production_sync = NOW()
    WHERE last_calc_time < now_ms;
    RETURN QUERY SELECT COUNT(*)::integer FROM public.player_economy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. TRIGGERS Y SEGURIDAD (RLS)
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

-- Políticas RLS correctas
CREATE POLICY "profiles_select_all"  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own"  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own"  ON public.profiles FOR DELETE USING (auth.uid() = id);

CREATE POLICY "eco_own"       ON public.player_economy   FOR ALL USING (auth.uid() = player_id);
CREATE POLICY "buildings_own" ON public.player_buildings FOR ALL USING (auth.uid() = player_id);
CREATE POLICY "units_own"     ON public.player_units     FOR ALL USING (auth.uid() = player_id);
CREATE POLICY "research_own"  ON public.player_research  FOR ALL USING (auth.uid() = player_id);
CREATE POLICY "reports_own"   ON public.reports          FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "inbox_own"     ON public.inbox            FOR ALL USING (auth.uid() = receiver_id OR auth.uid() = sender_id);
CREATE POLICY "market_read"   ON public.global_market    FOR SELECT USING (true);
CREATE POLICY "events_read"   ON public.world_events     FOR SELECT USING (true);
CREATE POLICY "bots_read"     ON public.bots             FOR SELECT USING (true);

-- Trigger de Inicialización
CREATE OR REPLACE FUNCTION public.initialize_player_data() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.player_economy (player_id, last_calc_time) VALUES (NEW.id, EXTRACT(EPOCH FROM NOW()) * 1000);
  INSERT INTO public.player_buildings (player_id, building_type, quantity) VALUES (NEW.id, 'HOUSE', 1), (NEW.id, 'FACTORY', 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_init AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.initialize_player_data();
```
