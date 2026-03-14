-- ==========================================
-- REESTRUCTURACIÓN COMPLETA Y PROFESIONAL DE IRON DUNE
-- ==========================================

-- 1. TIPOS DE DATOS (Enums)
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

-- 2. TABLA DE PERFILES (Datos Identitarios)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  username text UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  game_state jsonb NOT NULL DEFAULT '{}', -- Configuración de UI y flags menores
  empire_points bigint DEFAULT 0,
  last_active timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 3. ECONOMÍA DEL JUGADOR (Recursos, Banco y Producción)
CREATE TABLE IF NOT EXISTS public.player_economy (
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  money numeric(20, 2) DEFAULT 0,
  oil numeric(20, 2) DEFAULT 0,
  ammo numeric(20, 2) DEFAULT 0,
  gold numeric(20, 2) DEFAULT 0,
  diamond numeric(20, 2) DEFAULT 0,
  bank_balance numeric(20, 2) DEFAULT 0,
  -- Tasas de producción por hora
  money_prod numeric(20, 2) DEFAULT 0,
  oil_prod numeric(20, 2) DEFAULT 0,
  ammo_prod numeric(20, 2) DEFAULT 0,
  gold_prod numeric(20, 2) DEFAULT 0,
  -- Tasas de consumo por hora
  money_cons numeric(20, 2) DEFAULT 0,
  oil_cons numeric(20, 2) DEFAULT 0,
  ammo_cons numeric(20, 2) DEFAULT 0,
  gold_cons numeric(20, 2) DEFAULT 0,
  last_calc_time bigint NOT NULL -- Timestamp MS de la última actualización
);

-- 4. EDIFICIOS DEL JUGADOR
CREATE TABLE IF NOT EXISTS public.player_buildings (
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  building_type text NOT NULL,
  level integer DEFAULT 0,
  upgrade_end_time bigint, -- Si está en construcción, timestamp de fin
  PRIMARY KEY (player_id, building_type)
);

-- 5. INVESTIGACIONES (TECNOLOGÍAS)
CREATE TABLE IF NOT EXISTS public.player_research (
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  tech_type text NOT NULL,
  level integer DEFAULT 0,
  research_end_time bigint, -- Si está en proceso, timestamp de fin
  PRIMARY KEY (player_id, tech_type)
);

-- 6. TROPAS DEL JUGADOR
CREATE TABLE IF NOT EXISTS public.player_units (
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_type text NOT NULL,
  count bigint DEFAULT 0,
  PRIMARY KEY (player_id, unit_type)
);

-- 7. TABLA DE BOTS (Globales)
CREATE TABLE IF NOT EXISTS public.bots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  personality text NOT NULL,
  score bigint DEFAULT 0,
  units jsonb NOT NULL DEFAULT '{}',
  stats jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- 8. REPUTACIÓN JUGADOR-BOT
CREATE TABLE IF NOT EXISTS public.bot_reputations (
  player_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  bot_id uuid REFERENCES public.bots(id) ON DELETE CASCADE,
  reputation integer DEFAULT 50 CHECK (reputation >= 0 AND reputation <= 100),
  PRIMARY KEY (player_id, bot_id)
);

-- 9. MOVIMIENTOS EN TIEMPO REAL
CREATE TABLE IF NOT EXISTS public.movements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL, -- ID de bot o jugador
  type movement_type NOT NULL,
  units jsonb NOT NULL,
  resources jsonb DEFAULT '{}',
  start_time bigint NOT NULL,
  end_time bigint NOT NULL,
  status text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now()
);

-- 10. INFORMES, MENSAJES Y CHAT
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

CREATE TABLE IF NOT EXISTS public.chat_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  message text,
  type text DEFAULT 'text',
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- 11. CAMPOS DE SALVAMENTO
CREATE TABLE IF NOT EXISTS public.salvage_fields (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  origin_battle_id uuid,
  resources jsonb NOT NULL,
  total_value bigint DEFAULT 0,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 12. SEGURIDAD (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_economy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad (Simplificadas para evitar conflictos de esquemas internos)
DROP POLICY IF EXISTS "Global profile view" ON public.profiles;
CREATE POLICY "Global profile view" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Economy access" ON public.player_economy;
CREATE POLICY "Economy access" ON public.player_economy FOR ALL USING (true);

DROP POLICY IF EXISTS "Buildings access" ON public.player_buildings;
CREATE POLICY "Buildings access" ON public.player_buildings FOR ALL USING (true);

DROP POLICY IF EXISTS "Research access" ON public.player_research;
CREATE POLICY "Research access" ON public.player_research FOR ALL USING (true);

DROP POLICY IF EXISTS "Units access" ON public.player_units;
CREATE POLICY "Units access" ON public.player_units FOR ALL USING (true);

DROP POLICY IF EXISTS "Movements access" ON public.movements;
CREATE POLICY "Movements access" ON public.movements FOR ALL USING (true);

-- 13. TRIGGERS DE INICIALIZACIÓN
-- Crear automáticamente las entradas de economía y edificios básicos al crear un perfil
CREATE OR REPLACE FUNCTION public.initialize_player_data()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Inicializar Economía
  INSERT INTO public.player_economy (player_id, last_calc_time)
  VALUES (NEW.id, EXTRACT(EPOCH FROM NOW()) * 1000);

  -- 2. Inicializar Edificios Básicos (Nivel 1 para Casa y Fábrica como ejemplo)
  INSERT INTO public.player_buildings (player_id, building_type, level) VALUES (NEW.id, 'HOUSE', 1);
  INSERT INTO public.player_buildings (player_id, building_type, level) VALUES (NEW.id, 'FACTORY', 1);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_init ON public.profiles;
CREATE TRIGGER on_profile_created_init
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.initialize_player_data();

-- 14. HARD RESET (LIMPIEZA TOTAL)
DELETE FROM public.profiles;
DELETE FROM public.bots;
DELETE FROM public.salvage_fields;
DELETE FROM public.chat_history;
DELETE FROM public.movements;
