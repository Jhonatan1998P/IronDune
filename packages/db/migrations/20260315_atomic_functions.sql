-- FASE 5: Funciones Atómicas (RPC)

-- Función para iniciar una construcción de forma atómica
CREATE OR REPLACE FUNCTION fn_start_construction(
    p_player_id UUID,
    p_planet_id UUID,
    p_building_id TEXT,
    p_cost_money BIGINT,
    p_cost_oil BIGINT,
    p_cost_ammo BIGINT,
    p_duration_sec INTEGER,
    p_idempotency_key TEXT
) RETURNS JSONB AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_finish_at TIMESTAMPTZ;
    v_current_money BIGINT;
    v_current_oil BIGINT;
    v_current_ammo BIGINT;
    v_snapshot planet_snapshots%ROWTYPE;
    v_response JSONB;
BEGIN
    -- 1. Verificar idempotencia
    IF EXISTS (SELECT 1 FROM idempotency_keys WHERE key = p_idempotency_key) THEN
        SELECT response_body INTO v_response FROM idempotency_keys WHERE key = p_idempotency_key;
        RETURN v_response;
    END IF;

    -- 2. Bloquear planeta y obtener snapshot
    -- SELECT ... FOR UPDATE asegura que nadie más toque este planeta hasta el COMMIT
    SELECT * INTO v_snapshot FROM planet_snapshots WHERE planet_id = p_planet_id FOR UPDATE;
    
    -- 3. Calcular recursos actuales (interpolación)
    v_current_money := v_snapshot.money + (v_snapshot.money_rate_per_sec * EXTRACT(EPOCH FROM (v_now - v_snapshot.last_update_at))::BIGINT);
    v_current_oil := v_snapshot.oil + (v_snapshot.oil_rate_per_sec * EXTRACT(EPOCH FROM (v_now - v_snapshot.last_update_at))::BIGINT);
    v_current_ammo := v_snapshot.ammo + (v_snapshot.ammo_rate_per_sec * EXTRACT(EPOCH FROM (v_now - v_snapshot.last_update_at))::BIGINT);

    -- 4. Validar recursos
    IF v_current_money < p_cost_money OR v_current_oil < p_cost_oil OR v_current_ammo < p_cost_ammo THEN
        RAISE EXCEPTION 'Insufficient resources';
    END IF;

    -- 5. Validar cola vacía (solo 1 construcción a la vez)
    IF EXISTS (SELECT 1 FROM building_queue WHERE planet_id = p_planet_id AND status = 'in_progress') THEN
        RAISE EXCEPTION 'Queue busy';
    END IF;

    -- 6. Deducir recursos y actualizar snapshot
    UPDATE planet_snapshots SET
        money = v_current_money - p_cost_money,
        oil = v_current_oil - p_cost_oil,
        ammo = v_current_ammo - p_cost_ammo,
        last_update_at = v_now,
        version = version + 1
    WHERE planet_id = p_planet_id;

    -- 7. Insertar en cola
    v_finish_at := v_now + (p_duration_sec || ' seconds')::INTERVAL;
    INSERT INTO building_queue (planet_id, building_id, target_level, started_at, finished_at, status)
    VALUES (p_planet_id, p_building_id, 1, v_now, v_finish_at, 'in_progress')
    RETURNING id INTO v_response;

    -- 8. Registrar evento para el worker
    INSERT INTO game_events (type, scheduled_at, data)
    VALUES ('building_finish', v_finish_at, jsonb_build_object(
        'planet_id', p_planet_id,
        'building_id', p_building_id,
        'queue_item_id', v_response
    ));

    -- 9. Guardar idempotencia
    v_response := jsonb_build_object('success', true, 'queue_item_id', v_response, 'finished_at', v_finish_at);
    INSERT INTO idempotency_keys (key, player_id, response_code, response_body)
    VALUES (p_idempotency_key, p_player_id, 200, v_response);

    RETURN v_response;
END;
$$ LANGUAGE plpgsql;
