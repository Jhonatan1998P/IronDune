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

GRANT EXECUTE ON FUNCTION public.ensure_player_resources(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.resource_deduct_atomic(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO service_role;
GRANT EXECUTE ON FUNCTION public.resource_add_atomic(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO service_role;
