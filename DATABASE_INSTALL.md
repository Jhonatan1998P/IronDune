# Instalación Manual de Base de Datos - Iron Dune

Copia y pega el siguiente código en el **SQL Editor** de Supabase para reconstruir toda la infraestructura desde cero.

```sql
-- 1. LIMPIEZA INICIAL (Opcional, descomenta si quieres resetear todo)
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;
-- GRANT ALL ON SCHEMA public TO postgres;
-- GRANT ALL ON SCHEMA public TO anon;
-- GRANT ALL ON SCHEMA public TO authenticated;
-- GRANT ALL ON SCHEMA public TO service_role;

-- 2. TIPOS DE DATOS
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

-- 3. TABLA DE PERFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  username text UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  game_state jsonb NOT NULL DEFAULT '{}',
  empire_points bigint DEFAULT 0,
  last_active timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 4. ECONOMÍA
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
  last_calc_time bigint NOT NULL
);

-- 5. EDIFICIOS
CREATE TABLE IF NOT EXISTS public.player_buildings (
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  building_type text NOT NULL,
  level integer DEFAULT 0,
  quantity integer DEFAULT 0,
  upgrade_end_time bigint,
  PRIMARY KEY (player_id, building_type)
);

-- 6. INVESTIGACIÓN
CREATE TABLE IF NOT EXISTS public.player_research (
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  tech_type text NOT NULL,
  level integer DEFAULT 0,
  research_end_time bigint,
  PRIMARY KEY (player_id, tech_type)
);

-- 7. UNIDADES
CREATE TABLE IF NOT EXISTS public.player_units (
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_type text NOT NULL,
  count bigint DEFAULT 0,
  PRIMARY KEY (player_id, unit_type)
);

-- 8. BOTS GLOBALES
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

-- 9. CAMPOS DE SALVAMENTO
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

-- 10. MOVIMIENTOS
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

-- 11. INFORMES
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content jsonb NOT NULL,
  type report_type NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- 12. MENSAJERÍA (INBOX)
CREATE TABLE IF NOT EXISTS public.inbox (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  receiver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text,
  body text NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- 13. SEGURIDAD RLS (Row Level Security)
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

-- Políticas
CREATE POLICY "public_view" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "owner_access_eco" ON public.player_economy FOR ALL USING (auth.uid() = player_id);
CREATE POLICY "owner_access_buildings" ON public.player_buildings FOR ALL USING (auth.uid() = player_id);
CREATE POLICY "owner_access_research" ON public.player_research FOR ALL USING (auth.uid() = player_id);
CREATE POLICY "owner_access_units" ON public.player_units FOR ALL USING (auth.uid() = player_id);
CREATE POLICY "bots_read_only" ON public.bots FOR SELECT USING (true);
CREATE POLICY "all_access_salvage" ON public.salvage_fields FOR ALL USING (true);
CREATE POLICY "owner_access_movements" ON public.movements FOR ALL USING (auth.uid() = sender_id);
CREATE POLICY "owner_access_reports" ON public.reports FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_access_inbox" ON public.inbox FOR ALL USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- 14. TRIGGER DE INICIALIZACIÓN AUTOMÁTICA
CREATE OR REPLACE FUNCTION public.initialize_player_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Crear economía inicial
  INSERT INTO public.player_economy (player_id, last_calc_time)
  VALUES (NEW.id, EXTRACT(EPOCH FROM NOW()) * 1000)
  ON CONFLICT (player_id) DO NOTHING;

  -- Crear edificios iniciales (HOUSE y FACTORY son por QUANTITY)
  INSERT INTO public.player_buildings (player_id, building_type, quantity) VALUES (NEW.id, 'HOUSE', 1) ON CONFLICT DO NOTHING;
  INSERT INTO public.player_buildings (player_id, building_type, quantity) VALUES (NEW.id, 'FACTORY', 1) ON CONFLICT DO NOTHING;

  -- Asignar rol DEV automáticamente a dueños
  IF (NEW.username IN ('ADMIN', 'DEV_COMMANDER')) THEN
    UPDATE public.profiles SET role = 'dev' WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_init ON public.profiles;
CREATE TRIGGER on_profile_created_init
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.initialize_player_data();
```
