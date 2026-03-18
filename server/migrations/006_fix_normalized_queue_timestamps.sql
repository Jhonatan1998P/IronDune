CREATE OR REPLACE FUNCTION public.parse_epoch_timestamptz(p_value TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_numeric DOUBLE PRECISION;
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;

  IF p_value !~ '^-?[0-9]+(\.[0-9]+)?$' THEN
    RETURN NULL;
  END IF;

  v_numeric := p_value::DOUBLE PRECISION;
  IF NOT isfinite(v_numeric) THEN
    RETURN NULL;
  END IF;

  IF ABS(v_numeric) >= 100000000000 THEN
    RETURN to_timestamp(v_numeric / 1000.0);
  END IF;

  RETURN to_timestamp(v_numeric);
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
    queue_times.start_time,
    GREATEST(queue_times.end_time, queue_times.start_time),
    'ACTIVE',
    NOW()
  FROM jsonb_array_elements(COALESCE(p_state->'activeConstructions', '[]'::jsonb)) item
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(public.parse_epoch_timestamptz(item->>'startTime'), NOW()) AS start_time,
      COALESCE(public.parse_epoch_timestamptz(item->>'endTime'), NOW()) AS end_time
  ) queue_times;

  INSERT INTO public.player_queues (id, player_id, queue_type, target_type, target_id, count, start_time, end_time, status, updated_at)
  SELECT
    COALESCE(item->>'id', CONCAT('recruit-', p_player_id::TEXT, '-', row_number() OVER ())),
    p_player_id,
    'RECRUIT',
    COALESCE(item->>'unitType', 'UNKNOWN'),
    item->>'unitType',
    GREATEST(COALESCE((item->>'count')::INTEGER, 1), 1),
    queue_times.start_time,
    GREATEST(queue_times.end_time, queue_times.start_time),
    'ACTIVE',
    NOW()
  FROM jsonb_array_elements(COALESCE(p_state->'activeRecruitments', '[]'::jsonb)) item
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(public.parse_epoch_timestamptz(item->>'startTime'), NOW()) AS start_time,
      COALESCE(public.parse_epoch_timestamptz(item->>'endTime'), NOW()) AS end_time
  ) queue_times;

  IF (p_state ? 'activeResearch') AND p_state->'activeResearch' IS NOT NULL THEN
    INSERT INTO public.player_queues (id, player_id, queue_type, target_type, target_id, count, start_time, end_time, status, updated_at)
    VALUES (
      CONCAT('research-', p_player_id::TEXT),
      p_player_id,
      'RESEARCH',
      COALESCE(p_state->'activeResearch'->>'techId', 'UNKNOWN'),
      p_state->'activeResearch'->>'techId',
      1,
      COALESCE(public.parse_epoch_timestamptz(p_state->'activeResearch'->>'startTime'), NOW()),
      GREATEST(
        COALESCE(public.parse_epoch_timestamptz(p_state->'activeResearch'->>'endTime'), NOW()),
        COALESCE(public.parse_epoch_timestamptz(p_state->'activeResearch'->>'startTime'), NOW())
      ),
      'ACTIVE',
      NOW()
    );
  END IF;
END;
$$;

UPDATE public.player_queues
SET
  start_time = to_timestamp(EXTRACT(EPOCH FROM start_time) / 1000.0),
  end_time = to_timestamp(EXTRACT(EPOCH FROM end_time) / 1000.0),
  updated_at = NOW()
WHERE start_time >= TIMESTAMPTZ '3000-01-01 00:00:00+00'
   OR end_time >= TIMESTAMPTZ '3000-01-01 00:00:00+00';

UPDATE public.player_queues
SET
  end_time = start_time,
  updated_at = NOW()
WHERE end_time < start_time;

ALTER TABLE public.player_queues
  DROP CONSTRAINT IF EXISTS player_queues_end_after_start;

ALTER TABLE public.player_queues
  ADD CONSTRAINT player_queues_end_after_start CHECK (end_time >= start_time);

GRANT EXECUTE ON FUNCTION public.parse_epoch_timestamptz(TEXT) TO service_role;
