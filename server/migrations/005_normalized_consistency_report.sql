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
    RETURN jsonb_build_object(
      'consistent', FALSE,
      'reason', 'missing_profile'
    );
  END IF;

  WITH state_buildings AS (
    SELECT
      key AS building_type,
      GREATEST(COALESCE((value->>'level')::INTEGER, 0), 0) AS level,
      COALESCE((value->>'isDamaged')::BOOLEAN, FALSE) AS is_damaged
    FROM jsonb_each(COALESCE(v_state->'buildings', '{}'::jsonb))
  ), norm_buildings AS (
    SELECT
      building_type,
      level,
      is_damaged
    FROM public.player_buildings
    WHERE player_id = p_player_id
  )
  SELECT COUNT(*) INTO v_building_mismatch_count
  FROM (
    SELECT COALESCE(sb.building_type, nb.building_type)
    FROM state_buildings sb
    FULL OUTER JOIN norm_buildings nb USING (building_type)
    WHERE sb.building_type IS NULL
      OR nb.building_type IS NULL
      OR sb.level <> nb.level
      OR sb.is_damaged <> nb.is_damaged
  ) mismatch;

  WITH state_units AS (
    SELECT
      key AS unit_type,
      GREATEST(COALESCE((value)::BIGINT, 0), 0) AS count
    FROM jsonb_each(COALESCE(v_state->'units', '{}'::jsonb))
  ), norm_units AS (
    SELECT
      unit_type,
      count
    FROM public.player_units
    WHERE player_id = p_player_id
  )
  SELECT COUNT(*) INTO v_unit_mismatch_count
  FROM (
    SELECT COALESCE(su.unit_type, nu.unit_type)
    FROM state_units su
    FULL OUTER JOIN norm_units nu USING (unit_type)
    WHERE su.unit_type IS NULL
      OR nu.unit_type IS NULL
      OR su.count <> nu.count
  ) mismatch;

  WITH state_tech AS (
    SELECT
      key AS tech_type,
      GREATEST(COALESCE((value)::INTEGER, 1), 1) AS level
    FROM jsonb_each(COALESCE(v_state->'techLevels', '{}'::jsonb))
  ), norm_tech AS (
    SELECT
      tech_type,
      level
    FROM public.player_tech
    WHERE player_id = p_player_id
  )
  SELECT COUNT(*) INTO v_tech_mismatch_count
  FROM (
    SELECT COALESCE(st.tech_type, nt.tech_type)
    FROM state_tech st
    FULL OUTER JOIN norm_tech nt USING (tech_type)
    WHERE st.tech_type IS NULL
      OR nt.tech_type IS NULL
      OR st.level <> nt.level
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
    SELECT 1
    FROM public.player_progress pp
    WHERE pp.player_id = p_player_id
  )
  LIMIT 1;

  v_progress_mismatch_count := COALESCE(v_progress_mismatch_count, 0);

  v_state_build_count := jsonb_array_length(COALESCE(v_state->'activeConstructions', '[]'::jsonb));
  v_state_recruit_count := jsonb_array_length(COALESCE(v_state->'activeRecruitments', '[]'::jsonb));
  v_state_research_count := CASE WHEN (v_state ? 'activeResearch') AND v_state->'activeResearch' IS NOT NULL THEN 1 ELSE 0 END;

  SELECT COUNT(*) INTO v_norm_build_count
  FROM public.player_queues
  WHERE player_id = p_player_id
    AND queue_type = 'BUILD'
    AND status = 'ACTIVE';

  SELECT COUNT(*) INTO v_norm_recruit_count
  FROM public.player_queues
  WHERE player_id = p_player_id
    AND queue_type = 'RECRUIT'
    AND status = 'ACTIVE';

  SELECT COUNT(*) INTO v_norm_research_count
  FROM public.player_queues
  WHERE player_id = p_player_id
    AND queue_type = 'RESEARCH'
    AND status = 'ACTIVE';

  v_queue_mismatch_count :=
    ABS(v_state_build_count - v_norm_build_count) +
    ABS(v_state_recruit_count - v_norm_recruit_count) +
    ABS(v_state_research_count - v_norm_research_count);

  v_consistent :=
    v_building_mismatch_count = 0
    AND v_unit_mismatch_count = 0
    AND v_tech_mismatch_count = 0
    AND v_progress_mismatch_count = 0
    AND v_queue_mismatch_count = 0;

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

GRANT EXECUTE ON FUNCTION public.compare_player_domain_state(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.normalized_consistency_report(INTEGER) TO service_role;
