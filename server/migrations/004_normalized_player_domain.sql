CREATE TABLE IF NOT EXISTS public.player_buildings (
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  building_type TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  is_damaged BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, building_type)
);

CREATE TABLE IF NOT EXISTS public.player_units (
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_type TEXT NOT NULL,
  count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, unit_type)
);

CREATE TABLE IF NOT EXISTS public.player_tech (
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tech_type TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  unlocked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, tech_type)
);

CREATE TABLE IF NOT EXISTS public.player_queues (
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

CREATE INDEX IF NOT EXISTS idx_player_queues_player_status
  ON public.player_queues (player_id, status, end_time);

CREATE TABLE IF NOT EXISTS public.player_progress (
  player_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_progress INTEGER NOT NULL DEFAULT 1,
  empire_points DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_save_time BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.player_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_tech ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'player_buildings' AND policyname = 'Users read own buildings'
  ) THEN
    CREATE POLICY "Users read own buildings" ON public.player_buildings
      FOR SELECT USING (auth.uid() = player_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'player_units' AND policyname = 'Users read own units'
  ) THEN
    CREATE POLICY "Users read own units" ON public.player_units
      FOR SELECT USING (auth.uid() = player_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'player_tech' AND policyname = 'Users read own tech'
  ) THEN
    CREATE POLICY "Users read own tech" ON public.player_tech
      FOR SELECT USING (auth.uid() = player_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'player_queues' AND policyname = 'Users read own queues'
  ) THEN
    CREATE POLICY "Users read own queues" ON public.player_queues
      FOR SELECT USING (auth.uid() = player_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'player_progress' AND policyname = 'Users read own progress'
  ) THEN
    CREATE POLICY "Users read own progress" ON public.player_progress
      FOR SELECT USING (auth.uid() = player_id);
  END IF;
END
$$;

GRANT SELECT ON TABLE public.player_buildings TO authenticated;
GRANT SELECT ON TABLE public.player_units TO authenticated;
GRANT SELECT ON TABLE public.player_tech TO authenticated;
GRANT SELECT ON TABLE public.player_queues TO authenticated;
GRANT SELECT ON TABLE public.player_progress TO authenticated;
GRANT ALL ON TABLE public.player_buildings TO postgres, service_role;
GRANT ALL ON TABLE public.player_units TO postgres, service_role;
GRANT ALL ON TABLE public.player_tech TO postgres, service_role;
GRANT ALL ON TABLE public.player_queues TO postgres, service_role;
GRANT ALL ON TABLE public.player_progress TO postgres, service_role;

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
    item->>'buildingType',
    item->>'buildingType',
    GREATEST(COALESCE((item->>'count')::INTEGER, 1), 1),
    to_timestamp(CASE
      WHEN ABS(COALESCE((item->>'startTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))) >= 100000000000
        THEN COALESCE((item->>'startTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW())) / 1000.0
      ELSE COALESCE((item->>'startTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))
    END),
    to_timestamp(CASE
      WHEN ABS(COALESCE((item->>'endTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))) >= 100000000000
        THEN COALESCE((item->>'endTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW())) / 1000.0
      ELSE COALESCE((item->>'endTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))
    END),
    'ACTIVE',
    NOW()
  FROM jsonb_array_elements(COALESCE(p_state->'activeConstructions', '[]'::jsonb)) item
  WHERE NULLIF(btrim(item->>'buildingType'), '') IS NOT NULL
    AND UPPER(btrim(item->>'buildingType')) <> 'UNKNOWN'
    AND UPPER(btrim(item->>'buildingType')) <> 'UNKNOW';

  INSERT INTO public.player_queues (id, player_id, queue_type, target_type, target_id, count, start_time, end_time, status, updated_at)
  SELECT
    COALESCE(item->>'id', CONCAT('recruit-', p_player_id::TEXT, '-', row_number() OVER ())),
    p_player_id,
    'RECRUIT',
    item->>'unitType',
    item->>'unitType',
    GREATEST(COALESCE((item->>'count')::INTEGER, 1), 1),
    to_timestamp(CASE
      WHEN ABS(COALESCE((item->>'startTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))) >= 100000000000
        THEN COALESCE((item->>'startTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW())) / 1000.0
      ELSE COALESCE((item->>'startTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))
    END),
    to_timestamp(CASE
      WHEN ABS(COALESCE((item->>'endTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))) >= 100000000000
        THEN COALESCE((item->>'endTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW())) / 1000.0
      ELSE COALESCE((item->>'endTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))
    END),
    'ACTIVE',
    NOW()
  FROM jsonb_array_elements(COALESCE(p_state->'activeRecruitments', '[]'::jsonb)) item
  WHERE NULLIF(btrim(item->>'unitType'), '') IS NOT NULL
    AND UPPER(btrim(item->>'unitType')) <> 'UNKNOWN'
    AND UPPER(btrim(item->>'unitType')) <> 'UNKNOW';

  IF (p_state ? 'activeResearch')
    AND p_state->'activeResearch' IS NOT NULL
    AND NULLIF(btrim(p_state->'activeResearch'->>'techId'), '') IS NOT NULL
    AND UPPER(btrim(p_state->'activeResearch'->>'techId')) <> 'UNKNOWN'
    AND UPPER(btrim(p_state->'activeResearch'->>'techId')) <> 'UNKNOW'
  THEN
    INSERT INTO public.player_queues (id, player_id, queue_type, target_type, target_id, count, start_time, end_time, status, updated_at)
    VALUES (
      CONCAT('research-', p_player_id::TEXT),
      p_player_id,
      'RESEARCH',
      btrim(p_state->'activeResearch'->>'techId'),
      p_state->'activeResearch'->>'techId',
      1,
      to_timestamp(CASE
        WHEN ABS(COALESCE((p_state->'activeResearch'->>'startTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))) >= 100000000000
          THEN COALESCE((p_state->'activeResearch'->>'startTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW())) / 1000.0
        ELSE COALESCE((p_state->'activeResearch'->>'startTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))
      END),
      to_timestamp(CASE
        WHEN ABS(COALESCE((p_state->'activeResearch'->>'endTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))) >= 100000000000
          THEN COALESCE((p_state->'activeResearch'->>'endTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW())) / 1000.0
        ELSE COALESCE((p_state->'activeResearch'->>'endTime')::DOUBLE PRECISION, EXTRACT(EPOCH FROM NOW()))
      END),
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

GRANT EXECUTE ON FUNCTION public.sync_player_domain_from_state(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_player_domain_from_profiles() TO service_role;
