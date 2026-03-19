import { supabase } from './lib/supabase.js';

const ADMIN_USERNAME = 'Admin';
const ADMIN_EMAIL = 'Admin@gmail.com';
const ADMIN_PASSWORD = '26335828JP';
const ADMIN_ROLE = 'Admin';
const DEFAULT_ROLE = 'Usuario';
const PGRST_RELOAD_SQL = "NOTIFY pgrst, 'reload schema'; NOTIFY pgrst, 'reload';";

/**
 * Realiza un reinicio total de la base de datos:
 * 1. Borra todos los usuarios de Auth
 * 2. Borra (DROP) todas las tablas públicas
 * 3. Recrea las tablas con su esquema preciso
 * 4. Configura funciones, RLS y permisos
 */
export async function hardResetDatabase() {
  if (process.env.DB_HARD_RESET !== 'true') {
    return;
  }

  console.warn('⚠️ [DB Reset] DB_HARD_RESET=true detectado. Iniciando reinicio TOTAL...');

  try {
    // 1. Primero borramos los usuarios de la autenticación de Supabase
    await deleteAllAuthUsers();

    // 2. Ejecutamos el SQL para limpiar y recrear todo
    // Nota: Necesitamos una función RPC 'exec_sql' en Supabase para ejecutar SQL arbitrario
    const sqlScript = `
      -- 1. Limpieza robusta: elimina objetos existentes/desconocidos en schema public
      DO $$
      DECLARE
        obj RECORD;
      BEGIN
        -- Vistas materializadas
        FOR obj IN
          SELECT schemaname, matviewname AS object_name
          FROM pg_matviews
          WHERE schemaname = 'public'
        LOOP
          BEGIN
            EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.%I CASCADE', obj.schemaname, obj.object_name);
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[DB Reset] Skip matview %.%: %', obj.schemaname, obj.object_name, SQLERRM;
          END;
        END LOOP;

        -- Vistas
        FOR obj IN
          SELECT table_schema AS schemaname, table_name AS object_name
          FROM information_schema.views
          WHERE table_schema = 'public'
        LOOP
          BEGIN
            EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', obj.schemaname, obj.object_name);
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[DB Reset] Skip view %.%: %', obj.schemaname, obj.object_name, SQLERRM;
          END;
        END LOOP;

        -- Tablas (incluye particionadas y tablas desconocidas)
        FOR obj IN
          SELECT schemaname, tablename AS object_name
          FROM pg_tables
          WHERE schemaname = 'public'
        LOOP
          BEGIN
            EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', obj.schemaname, obj.object_name);
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[DB Reset] Skip table %.%: %', obj.schemaname, obj.object_name, SQLERRM;
          END;
        END LOOP;

        -- Secuencias remanentes
        FOR obj IN
          SELECT sequence_schema AS schemaname, sequence_name AS object_name
          FROM information_schema.sequences
          WHERE sequence_schema = 'public'
        LOOP
          BEGIN
            EXECUTE format('DROP SEQUENCE IF EXISTS %I.%I CASCADE', obj.schemaname, obj.object_name);
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[DB Reset] Skip sequence %.%: %', obj.schemaname, obj.object_name, SQLERRM;
          END;
        END LOOP;

        -- Funciones y procedimientos definidos en public
        FOR obj IN
          SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public'
        LOOP
          BEGIN
            EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', obj.proname, obj.args);
          EXCEPTION WHEN OTHERS THEN
            BEGIN
              EXECUTE format('DROP PROCEDURE IF EXISTS public.%I(%s) CASCADE', obj.proname, obj.args);
            EXCEPTION WHEN OTHERS THEN
              RAISE NOTICE '[DB Reset] Skip routine public.%(%): %', obj.proname, obj.args, SQLERRM;
            END;
          END;
        END LOOP;
      END
      $$;

      -- 1.5 Tabla de metadatos (para control de resets)
      CREATE TABLE public.server_metadata (
        key text PRIMARY KEY,
        value text,
        updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      -- Insertar el ID del nuevo reset
      INSERT INTO public.server_metadata (key, value) VALUES ('last_reset_id', '${Date.now()}');

      -- 2. Recreación de tabla: profiles
      CREATE TABLE public.profiles (
        id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
        role text NOT NULL DEFAULT '${DEFAULT_ROLE}',
        game_state jsonb NOT NULL,
        updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      -- 2.2 Recursos autoritativos por jugador
      CREATE TABLE public.player_resources (
        player_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
        money double precision NOT NULL DEFAULT 5000,
        oil double precision NOT NULL DEFAULT 2500,
        ammo double precision NOT NULL DEFAULT 1500,
        gold double precision NOT NULL DEFAULT 500,
        diamond double precision NOT NULL DEFAULT 5,
        money_rate double precision NOT NULL DEFAULT 0,
        oil_rate double precision NOT NULL DEFAULT 0,
        ammo_rate double precision NOT NULL DEFAULT 0,
        gold_rate double precision NOT NULL DEFAULT 0,
        diamond_rate double precision NOT NULL DEFAULT 0,
        money_max double precision NOT NULL DEFAULT 999999999999999,
        oil_max double precision NOT NULL DEFAULT 999999999999999,
        ammo_max double precision NOT NULL DEFAULT 999999999999999,
        gold_max double precision NOT NULL DEFAULT 999999999999999,
        diamond_max double precision NOT NULL DEFAULT 10,
        bank_balance double precision NOT NULL DEFAULT 0,
        interest_rate double precision NOT NULL DEFAULT 0.15,
        next_rate_change bigint NOT NULL DEFAULT 0,
        last_tick_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE public.player_commands (
        id BIGSERIAL PRIMARY KEY,
        player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        command_id UUID NOT NULL,
        command_type TEXT NOT NULL,
        expected_revision BIGINT NOT NULL,
        resulting_revision BIGINT,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX idx_player_commands_player_command
        ON public.player_commands (player_id, command_id);

      CREATE INDEX idx_player_commands_player_created
        ON public.player_commands (player_id, created_at DESC);

      CREATE TABLE public.player_events (
        event_id BIGSERIAL PRIMARY KEY,
        player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        revision BIGINT NOT NULL,
        event_type TEXT NOT NULL,
        delta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        command_id UUID,
        server_time BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_player_events_player_event
        ON public.player_events (player_id, event_id DESC);

      CREATE INDEX idx_player_events_player_revision
        ON public.player_events (player_id, revision DESC);

      CREATE TABLE public.player_buildings (
        player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        building_type TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 0,
        is_damaged BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (player_id, building_type)
      );

      CREATE TABLE public.player_units (
        player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        unit_type TEXT NOT NULL,
        count BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (player_id, unit_type)
      );

      CREATE TABLE public.player_tech (
        player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        tech_type TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        unlocked_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (player_id, tech_type)
      );

      CREATE TABLE public.player_queues (
        id TEXT PRIMARY KEY,
        player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        queue_type TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT,
        count INTEGER NOT NULL DEFAULT 1,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_player_queues_player_status
        ON public.player_queues (player_id, status, end_time);

      CREATE TABLE public.player_progress (
        player_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        campaign_progress INTEGER NOT NULL DEFAULT 1,
        empire_points DOUBLE PRECISION NOT NULL DEFAULT 0,
        last_save_time BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE OR REPLACE FUNCTION public.ensure_player_resources(p_player_id UUID)
      RETURNS public.player_resources
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        v_row public.player_resources;
      BEGIN
        INSERT INTO public.player_resources (player_id)
        VALUES (p_player_id)
        ON CONFLICT (player_id) DO NOTHING;

        SELECT * INTO v_row
        FROM public.player_resources
        WHERE player_id = p_player_id;

        RETURN v_row;
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.resource_deduct_atomic(
        p_player_id UUID,
        p_money DOUBLE PRECISION DEFAULT 0,
        p_oil DOUBLE PRECISION DEFAULT 0,
        p_ammo DOUBLE PRECISION DEFAULT 0,
        p_gold DOUBLE PRECISION DEFAULT 0,
        p_diamond DOUBLE PRECISION DEFAULT 0
      )
      RETURNS TABLE(ok BOOLEAN, reason TEXT, failed_resource TEXT)
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        v_row public.player_resources;
      BEGIN
        PERFORM public.ensure_player_resources(p_player_id);

        UPDATE public.player_resources
        SET
          money = money - GREATEST(p_money, 0),
          oil = oil - GREATEST(p_oil, 0),
          ammo = ammo - GREATEST(p_ammo, 0),
          gold = gold - GREATEST(p_gold, 0),
          diamond = diamond - GREATEST(p_diamond, 0),
          updated_at = NOW()
        WHERE player_id = p_player_id
          AND money >= GREATEST(p_money, 0)
          AND oil >= GREATEST(p_oil, 0)
          AND ammo >= GREATEST(p_ammo, 0)
          AND gold >= GREATEST(p_gold, 0)
          AND diamond >= GREATEST(p_diamond, 0);

        IF FOUND THEN
          RETURN QUERY SELECT TRUE, NULL::TEXT, NULL::TEXT;
          RETURN;
        END IF;

        SELECT * INTO v_row
        FROM public.player_resources
        WHERE player_id = p_player_id;

        IF v_row.money < GREATEST(p_money, 0) THEN
          RETURN QUERY SELECT FALSE, 'insufficient_funds'::TEXT, 'MONEY'::TEXT;
        ELSIF v_row.oil < GREATEST(p_oil, 0) THEN
          RETURN QUERY SELECT FALSE, 'insufficient_funds'::TEXT, 'OIL'::TEXT;
        ELSIF v_row.ammo < GREATEST(p_ammo, 0) THEN
          RETURN QUERY SELECT FALSE, 'insufficient_funds'::TEXT, 'AMMO'::TEXT;
        ELSIF v_row.gold < GREATEST(p_gold, 0) THEN
          RETURN QUERY SELECT FALSE, 'insufficient_funds'::TEXT, 'GOLD'::TEXT;
        ELSIF v_row.diamond < GREATEST(p_diamond, 0) THEN
          RETURN QUERY SELECT FALSE, 'insufficient_funds'::TEXT, 'DIAMOND'::TEXT;
        ELSE
          RETURN QUERY SELECT FALSE, 'deduct_failed'::TEXT, NULL::TEXT;
        END IF;
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.resource_add_atomic(
        p_player_id UUID,
        p_money DOUBLE PRECISION DEFAULT 0,
        p_oil DOUBLE PRECISION DEFAULT 0,
        p_ammo DOUBLE PRECISION DEFAULT 0,
        p_gold DOUBLE PRECISION DEFAULT 0,
        p_diamond DOUBLE PRECISION DEFAULT 0
      )
      RETURNS TABLE(ok BOOLEAN, reason TEXT)
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        PERFORM public.ensure_player_resources(p_player_id);

        UPDATE public.player_resources
        SET
          money = LEAST(money_max, money + GREATEST(p_money, 0)),
          oil = LEAST(oil_max, oil + GREATEST(p_oil, 0)),
          ammo = LEAST(ammo_max, ammo + GREATEST(p_ammo, 0)),
          gold = LEAST(gold_max, gold + GREATEST(p_gold, 0)),
          diamond = LEAST(diamond_max, diamond + GREATEST(p_diamond, 0)),
          updated_at = NOW()
        WHERE player_id = p_player_id;

        IF FOUND THEN
          RETURN QUERY SELECT TRUE, NULL::TEXT;
        ELSE
          RETURN QUERY SELECT FALSE, 'add_failed'::TEXT;
        END IF;
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.sync_player_domain_from_state(
        p_player_id UUID,
        p_state JSONB
      )
      RETURNS VOID
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        DELETE FROM public.player_buildings WHERE player_id = p_player_id;
        INSERT INTO public.player_buildings (player_id, building_type, level, is_damaged, updated_at)
        SELECT
          p_player_id,
          key,
          GREATEST(COALESCE((value->>'level')::INTEGER, 0), 0),
          COALESCE((value->>'isDamaged')::BOOLEAN, FALSE),
          NOW()
        FROM jsonb_each(COALESCE(p_state->'buildings', '{}'::jsonb));

        DELETE FROM public.player_units WHERE player_id = p_player_id;
        INSERT INTO public.player_units (player_id, unit_type, count, updated_at)
        SELECT
          p_player_id,
          key,
          GREATEST(COALESCE((value)::BIGINT, 0), 0),
          NOW()
        FROM jsonb_each(COALESCE(p_state->'units', '{}'::jsonb));

        DELETE FROM public.player_tech WHERE player_id = p_player_id;
        INSERT INTO public.player_tech (player_id, tech_type, level, unlocked_at, updated_at)
        SELECT
          p_player_id,
          key,
          GREATEST(COALESCE((value)::INTEGER, 1), 1),
          NOW(),
          NOW()
        FROM jsonb_each(COALESCE(p_state->'techLevels', '{}'::jsonb));

        INSERT INTO public.player_progress (player_id, campaign_progress, empire_points, last_save_time, updated_at)
        VALUES (
          p_player_id,
          GREATEST(COALESCE((p_state->>'campaignProgress')::INTEGER, 1), 1),
          GREATEST(COALESCE((p_state->>'empirePoints')::DOUBLE PRECISION, 0), 0),
          GREATEST(COALESCE((p_state->>'lastSaveTime')::BIGINT, 0), 0),
          NOW()
        )
        ON CONFLICT (player_id)
        DO UPDATE SET
          campaign_progress = EXCLUDED.campaign_progress,
          empire_points = EXCLUDED.empire_points,
          last_save_time = EXCLUDED.last_save_time,
          updated_at = NOW();

        DELETE FROM public.player_queues WHERE player_id = p_player_id;

        INSERT INTO public.player_queues (id, player_id, queue_type, target_type, target_id, count, start_time, end_time, status, updated_at)
        SELECT
          COALESCE(item->>'id', CONCAT('build-', p_player_id::TEXT, '-', row_number() OVER ())),
          p_player_id,
          'BUILD',
          COALESCE(item->>'buildingType', 'UNKNOWN'),
          item->>'buildingType',
          GREATEST(COALESCE((item->>'count')::INTEGER, 1), 1),
          to_timestamp(COALESCE((item->>'startTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))),
          to_timestamp(COALESCE((item->>'endTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))),
          'ACTIVE',
          NOW()
        FROM jsonb_array_elements(COALESCE(p_state->'activeConstructions', '[]'::jsonb)) item;

        INSERT INTO public.player_queues (id, player_id, queue_type, target_type, target_id, count, start_time, end_time, status, updated_at)
        SELECT
          COALESCE(item->>'id', CONCAT('recruit-', p_player_id::TEXT, '-', row_number() OVER ())),
          p_player_id,
          'RECRUIT',
          COALESCE(item->>'unitType', 'UNKNOWN'),
          item->>'unitType',
          GREATEST(COALESCE((item->>'count')::INTEGER, 1), 1),
          to_timestamp(COALESCE((item->>'startTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))),
          to_timestamp(COALESCE((item->>'endTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))),
          'ACTIVE',
          NOW()
        FROM jsonb_array_elements(COALESCE(p_state->'activeRecruitments', '[]'::jsonb)) item;

        IF (p_state ? 'activeResearch') AND p_state->'activeResearch' IS NOT NULL THEN
          INSERT INTO public.player_queues (id, player_id, queue_type, target_type, target_id, count, start_time, end_time, status, updated_at)
          VALUES (
            CONCAT('research-', p_player_id::TEXT),
            p_player_id,
            'RESEARCH',
            COALESCE(p_state->'activeResearch'->>'techId', 'UNKNOWN'),
            p_state->'activeResearch'->>'techId',
            1,
            to_timestamp(COALESCE((p_state->'activeResearch'->>'startTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))),
            to_timestamp(COALESCE((p_state->'activeResearch'->>'endTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))),
            'ACTIVE',
            NOW()
          );
        END IF;
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.backfill_player_domain_from_profiles()
      RETURNS INTEGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        row_data RECORD;
        migrated_count INTEGER := 0;
      BEGIN
        FOR row_data IN
          SELECT id, game_state FROM public.profiles
        LOOP
          PERFORM public.sync_player_domain_from_state(row_data.id, row_data.game_state);
          migrated_count := migrated_count + 1;
        END LOOP;

        RETURN migrated_count;
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.compare_player_domain_state(p_player_id UUID)
      RETURNS JSONB
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        v_state JSONB;
        v_building_mismatch_count INTEGER := 0;
        v_unit_mismatch_count INTEGER := 0;
        v_tech_mismatch_count INTEGER := 0;
        v_progress_mismatch_count INTEGER := 0;
        v_queue_mismatch_count INTEGER := 0;
        v_state_build_count INTEGER := 0;
        v_norm_build_count INTEGER := 0;
        v_state_recruit_count INTEGER := 0;
        v_norm_recruit_count INTEGER := 0;
        v_state_research_count INTEGER := 0;
        v_norm_research_count INTEGER := 0;
        v_consistent BOOLEAN := FALSE;
      BEGIN
        SELECT game_state INTO v_state
        FROM public.profiles
        WHERE id = p_player_id;

        IF v_state IS NULL THEN
          RETURN jsonb_build_object('consistent', FALSE, 'reason', 'missing_profile');
        END IF;

        WITH state_buildings AS (
          SELECT key AS building_type, GREATEST(COALESCE((value->>'level')::INTEGER, 0), 0) AS level, COALESCE((value->>'isDamaged')::BOOLEAN, FALSE) AS is_damaged
          FROM jsonb_each(COALESCE(v_state->'buildings', '{}'::jsonb))
        ), norm_buildings AS (
          SELECT building_type, level, is_damaged
          FROM public.player_buildings
          WHERE player_id = p_player_id
        )
        SELECT COUNT(*) INTO v_building_mismatch_count
        FROM (
          SELECT COALESCE(sb.building_type, nb.building_type)
          FROM state_buildings sb
          FULL OUTER JOIN norm_buildings nb USING (building_type)
          WHERE sb.building_type IS NULL OR nb.building_type IS NULL OR sb.level <> nb.level OR sb.is_damaged <> nb.is_damaged
        ) mismatch;

        WITH state_units AS (
          SELECT key AS unit_type, GREATEST(COALESCE((value)::BIGINT, 0), 0) AS count
          FROM jsonb_each(COALESCE(v_state->'units', '{}'::jsonb))
        ), norm_units AS (
          SELECT unit_type, count
          FROM public.player_units
          WHERE player_id = p_player_id
        )
        SELECT COUNT(*) INTO v_unit_mismatch_count
        FROM (
          SELECT COALESCE(su.unit_type, nu.unit_type)
          FROM state_units su
          FULL OUTER JOIN norm_units nu USING (unit_type)
          WHERE su.unit_type IS NULL OR nu.unit_type IS NULL OR su.count <> nu.count
        ) mismatch;

        WITH state_tech AS (
          SELECT key AS tech_type, GREATEST(COALESCE((value)::INTEGER, 1), 1) AS level
          FROM jsonb_each(COALESCE(v_state->'techLevels', '{}'::jsonb))
        ), norm_tech AS (
          SELECT tech_type, level
          FROM public.player_tech
          WHERE player_id = p_player_id
        )
        SELECT COUNT(*) INTO v_tech_mismatch_count
        FROM (
          SELECT COALESCE(st.tech_type, nt.tech_type)
          FROM state_tech st
          FULL OUTER JOIN norm_tech nt USING (tech_type)
          WHERE st.tech_type IS NULL OR nt.tech_type IS NULL OR st.level <> nt.level
        ) mismatch;

        SELECT CASE
          WHEN pp.player_id IS NULL THEN 1
          WHEN pp.campaign_progress <> GREATEST(COALESCE((v_state->>'campaignProgress')::INTEGER, 1), 1) THEN 1
          WHEN pp.empire_points <> GREATEST(COALESCE((v_state->>'empirePoints')::DOUBLE PRECISION, 0), 0) THEN 1
          WHEN pp.last_save_time <> GREATEST(COALESCE((v_state->>'lastSaveTime')::BIGINT, 0), 0) THEN 1
          ELSE 0
        END INTO v_progress_mismatch_count
        FROM public.player_progress pp
        WHERE pp.player_id = p_player_id
        UNION ALL
        SELECT 1
        WHERE NOT EXISTS (
          SELECT 1 FROM public.player_progress pp WHERE pp.player_id = p_player_id
        )
        LIMIT 1;

        v_progress_mismatch_count := COALESCE(v_progress_mismatch_count, 0);

        v_state_build_count := jsonb_array_length(COALESCE(v_state->'activeConstructions', '[]'::jsonb));
        v_state_recruit_count := jsonb_array_length(COALESCE(v_state->'activeRecruitments', '[]'::jsonb));
        v_state_research_count := CASE WHEN (v_state ? 'activeResearch') AND v_state->'activeResearch' IS NOT NULL THEN 1 ELSE 0 END;

        SELECT COUNT(*) INTO v_norm_build_count
        FROM public.player_queues
        WHERE player_id = p_player_id AND queue_type = 'BUILD' AND status = 'ACTIVE';

        SELECT COUNT(*) INTO v_norm_recruit_count
        FROM public.player_queues
        WHERE player_id = p_player_id AND queue_type = 'RECRUIT' AND status = 'ACTIVE';

        SELECT COUNT(*) INTO v_norm_research_count
        FROM public.player_queues
        WHERE player_id = p_player_id AND queue_type = 'RESEARCH' AND status = 'ACTIVE';

        v_queue_mismatch_count := ABS(v_state_build_count - v_norm_build_count) + ABS(v_state_recruit_count - v_norm_recruit_count) + ABS(v_state_research_count - v_norm_research_count);

        v_consistent := v_building_mismatch_count = 0 AND v_unit_mismatch_count = 0 AND v_tech_mismatch_count = 0 AND v_progress_mismatch_count = 0 AND v_queue_mismatch_count = 0;

        RETURN jsonb_build_object(
          'consistent', v_consistent,
          'buildingsMismatchCount', v_building_mismatch_count,
          'unitsMismatchCount', v_unit_mismatch_count,
          'techMismatchCount', v_tech_mismatch_count,
          'progressMismatchCount', v_progress_mismatch_count,
          'queueMismatchCount', v_queue_mismatch_count,
          'queueCounts', jsonb_build_object(
            'stateBuild', v_state_build_count,
            'normalizedBuild', v_norm_build_count,
            'stateRecruit', v_state_recruit_count,
            'normalizedRecruit', v_norm_recruit_count,
            'stateResearch', v_state_research_count,
            'normalizedResearch', v_norm_research_count
          )
        );
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.normalized_consistency_report(p_limit INTEGER DEFAULT 200)
      RETURNS TABLE(player_id UUID, consistent BOOLEAN, details JSONB)
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        row_data RECORD;
        result JSONB;
      BEGIN
        FOR row_data IN
          SELECT id
          FROM public.profiles
          ORDER BY updated_at DESC
          LIMIT GREATEST(COALESCE(p_limit, 200), 1)
        LOOP
          result := public.compare_player_domain_state(row_data.id);
          player_id := row_data.id;
          consistent := COALESCE((result->>'consistent')::BOOLEAN, FALSE);
          details := result;
          RETURN NEXT;
        END LOOP;
      END;
      $$;

      -- 2.5 Habilitar RLS en metadata
      ALTER TABLE public.server_metadata ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Public read access for metadata" ON public.server_metadata FOR SELECT USING (true);
      GRANT SELECT ON TABLE public.server_metadata TO anon, authenticated;
      GRANT ALL ON TABLE public.server_metadata TO postgres, service_role;

      -- 3. Recreación de tabla: logistic_loot
      CREATE TABLE public.logistic_loot (
        id text PRIMARY KEY,
        battle_id text,
        origin text,
        resources jsonb,
        initial_resources jsonb,
        attacker_id text,
        attacker_name text,
        defender_id text,
        defender_name text,
        is_partially_harvested boolean DEFAULT false,
        harvest_count integer DEFAULT 0,
        total_value integer DEFAULT 0,
        expires_at timestamp with time zone,
        war_id text,
        wave_number integer,
        created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      -- 4. Recreación de tabla: game_bots
      CREATE TABLE public.game_bots (
        id text PRIMARY KEY,
        name text NOT NULL,
        avatar_id integer,
        country text,
        stats jsonb,
        personality text,
        last_rank integer,
        created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      -- 5. Configuración de RLS (Row Level Security)
      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.player_resources ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.player_commands ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.player_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.player_buildings ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.player_units ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.player_tech ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.player_queues ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.player_progress ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.logistic_loot ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.game_bots ENABLE ROW LEVEL SECURITY;

      -- 6. Políticas para 'profiles' (solo lectura desde cliente)
      CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
      CREATE POLICY "Users read own resources" ON public.player_resources FOR SELECT USING (auth.uid() = player_id);
      CREATE POLICY "Users read own commands" ON public.player_commands FOR SELECT USING (auth.uid() = player_id);
      CREATE POLICY "Users read own events" ON public.player_events FOR SELECT USING (auth.uid() = player_id);
      CREATE POLICY "Users read own buildings" ON public.player_buildings FOR SELECT USING (auth.uid() = player_id);
      CREATE POLICY "Users read own units" ON public.player_units FOR SELECT USING (auth.uid() = player_id);
      CREATE POLICY "Users read own tech" ON public.player_tech FOR SELECT USING (auth.uid() = player_id);
      CREATE POLICY "Users read own queues" ON public.player_queues FOR SELECT USING (auth.uid() = player_id);
      CREATE POLICY "Users read own progress" ON public.player_progress FOR SELECT USING (auth.uid() = player_id);

      -- 7. Políticas para 'logistic_loot' (Acceso público de lectura, escritura protegida si fuera necesario)
      CREATE POLICY "Public read access for logistic_loot" ON public.logistic_loot FOR SELECT USING (true);
      CREATE POLICY "Authenticated insert for logistic_loot" ON public.logistic_loot FOR INSERT WITH CHECK (auth.role() = 'authenticated');
      CREATE POLICY "Authenticated update for logistic_loot" ON public.logistic_loot FOR UPDATE USING (auth.role() = 'authenticated');
      CREATE POLICY "Authenticated delete for logistic_loot" ON public.logistic_loot FOR DELETE USING (auth.role() = 'authenticated');

      -- 8. Políticas para 'game_bots'
      CREATE POLICY "Public read access for game_bots" ON public.game_bots FOR SELECT USING (true);
      CREATE POLICY "Service role full access for game_bots" ON public.game_bots FOR ALL USING (true);

       -- 9. Permisos adicionales
       GRANT ALL ON TABLE public.profiles TO postgres, service_role;
       GRANT ALL ON TABLE public.player_resources TO postgres, service_role;
       GRANT ALL ON TABLE public.player_commands TO postgres, service_role;
       GRANT ALL ON TABLE public.player_events TO postgres, service_role;
       GRANT ALL ON TABLE public.player_buildings TO postgres, service_role;
       GRANT ALL ON TABLE public.player_units TO postgres, service_role;
       GRANT ALL ON TABLE public.player_tech TO postgres, service_role;
       GRANT ALL ON TABLE public.player_queues TO postgres, service_role;
       GRANT ALL ON TABLE public.player_progress TO postgres, service_role;
       GRANT ALL ON TABLE public.logistic_loot TO postgres, service_role;
       GRANT ALL ON TABLE public.game_bots TO postgres, service_role;
      
      GRANT SELECT ON TABLE public.profiles TO authenticated;
      GRANT SELECT ON TABLE public.player_resources TO authenticated;
      GRANT SELECT ON TABLE public.player_commands TO authenticated;
      GRANT SELECT ON TABLE public.player_events TO authenticated;
      GRANT SELECT ON TABLE public.player_buildings TO authenticated;
      GRANT SELECT ON TABLE public.player_units TO authenticated;
      GRANT SELECT ON TABLE public.player_tech TO authenticated;
      GRANT SELECT ON TABLE public.player_queues TO authenticated;
      GRANT SELECT ON TABLE public.player_progress TO authenticated;
      GRANT SELECT ON TABLE public.logistic_loot TO anon, authenticated;
       GRANT SELECT ON TABLE public.game_bots TO anon, authenticated;

      GRANT USAGE, SELECT ON SEQUENCE public.player_commands_id_seq TO postgres, service_role;
      GRANT USAGE, SELECT ON SEQUENCE public.player_events_event_id_seq TO postgres, service_role;

      GRANT EXECUTE ON FUNCTION public.ensure_player_resources(UUID) TO service_role;
      GRANT EXECUTE ON FUNCTION public.resource_deduct_atomic(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO service_role;
      GRANT EXECUTE ON FUNCTION public.resource_add_atomic(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO service_role;
      GRANT EXECUTE ON FUNCTION public.sync_player_domain_from_state(UUID, JSONB) TO service_role;
      GRANT EXECUTE ON FUNCTION public.backfill_player_domain_from_profiles() TO service_role;
      GRANT EXECUTE ON FUNCTION public.compare_player_domain_state(UUID) TO service_role;
      GRANT EXECUTE ON FUNCTION public.normalized_consistency_report(INTEGER) TO service_role;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime'
            AND schemaname = 'public'
            AND tablename = 'player_resources'
        ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.player_resources;
        END IF;
      END
      $$;

       -- 10. Refresh PostgREST schema cache
       ${PGRST_RELOAD_SQL}
     `;

    console.log('[DB Reset] Ejecutando script SQL de recreación...');
    const { error: sqlError } = await supabase.rpc('exec_sql', { sql: sqlScript });

    if (sqlError) {
      if (sqlError.message.includes('function "exec_sql" does not exist')) {
        console.error('❌ [DB Reset] La función RPC "exec_sql" no existe en Supabase.');
        console.info('Para habilitarla, ejecuta este SQL manualmente en el panel de Supabase una vez:');
        console.info(`
          CREATE OR REPLACE FUNCTION exec_sql(sql text)
          RETURNS void
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          BEGIN
            EXECUTE sql;
          END;
          $$;
        `);
        throw new Error('RPC exec_sql missing');
      }
      throw sqlError;
    }

    await createAdminUserAndProfile();

    console.log('✅ [DB Reset] Reinicio de base de datos completado con éxito.');
  } catch (error) {
    console.error('❌ [DB Reset] Error crítico durante el hard reset:', error.message);
  }
}

async function deleteAllAuthUsers() {
  console.log('[DB Reset] Eliminando todos los usuarios de Auth...');
  
  let allUsers = [];
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
        page: page,
        perPage: 1000
      });

      if (listError) throw listError;

      if (!users || users.length === 0) {
        hasMore = false;
      } else {
        allUsers = allUsers.concat(users);
        page++;
      }
    }

    console.log(`[DB Reset] Encontrados ${allUsers.length} usuarios para eliminar.`);

    for (const user of allUsers) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error(`[DB Reset] Error eliminando usuario ${user.id}:`, deleteError.message);
      }
    }
  } catch (error) {
    console.error('[DB Reset] Error al listar/eliminar usuarios:', error.message);
    // No lanzamos error para intentar continuar con la recreación de tablas
  }
}

async function createAdminUserAndProfile() {
  console.log('[DB Reset] Creando cuenta admin...');

  try {
    const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        username: ADMIN_USERNAME
      },
      app_metadata: {
        role: ADMIN_ROLE
      }
    });

    if (adminError) {
      console.error('[DB Reset] Error creando usuario admin:', adminError.message);
      return;
    }

    const adminUserId = adminData?.user?.id;
    if (!adminUserId) {
      console.error('[DB Reset] No se pudo obtener el ID del usuario admin.');
      return;
    }

    const { data: metaData, error: metaError } = await supabase
      .from('server_metadata')
      .select('value')
      .eq('key', 'last_reset_id')
      .single();

    if (metaError) {
      console.warn('[DB Reset] No se pudo obtener last_reset_id:', metaError.message);
    }

    const adminGameState = {
      playerName: ADMIN_USERNAME,
      lastResetId: metaData?.value,
      lastSaveTime: Date.now()
    };

    const adminGameStateJson = JSON.stringify(adminGameState).replace(/'/g, "''");
    const adminUpdatedAt = new Date().toISOString();
    const profileSql = `
      INSERT INTO public.profiles (id, role, game_state, updated_at)
      VALUES ('${adminUserId}', '${ADMIN_ROLE}', '${adminGameStateJson}'::jsonb, '${adminUpdatedAt}')
      ON CONFLICT (id)
      DO UPDATE SET role = EXCLUDED.role, game_state = EXCLUDED.game_state, updated_at = EXCLUDED.updated_at;
    `;

    const resourcesSql = `
      INSERT INTO public.player_resources (
        player_id, money, oil, ammo, gold, diamond,
        bank_balance, interest_rate, next_rate_change, last_tick_at, updated_at
      )
      VALUES (
        '${adminUserId}', 5000, 2500, 1500, 500, 5,
        0, 0.15, ${Date.now() + (24 * 60 * 60 * 1000)}, now(), now()
      )
      ON CONFLICT (player_id) DO NOTHING;
    `;

    const { error: profileSqlError } = await supabase.rpc('exec_sql', { sql: profileSql });

    if (profileSqlError) {
      console.error('[DB Reset] Error creando perfil admin:', profileSqlError.message);
      return;
    }

    const { error: resourcesSqlError } = await supabase.rpc('exec_sql', { sql: resourcesSql });
    if (resourcesSqlError) {
      console.error('[DB Reset] Error creando recursos admin:', resourcesSqlError.message);
      return;
    }

    console.log('[DB Reset] Cuenta admin creada con perfil de juego.');
  } catch (error) {
    console.error('[DB Reset] Error inesperado creando cuenta admin:', error.message);
  }
}
