-- FASE 6: Función para reclamar eventos (RPC)
CREATE OR REPLACE FUNCTION fn_claim_events(p_batch_size INTEGER)
RETURNS SETOF game_events AS $$
BEGIN
    RETURN QUERY
    UPDATE game_events
    SET status = 'in_progress'
    WHERE id IN (
        SELECT id FROM game_events
        WHERE status = 'pending' AND scheduled_at <= now()
        ORDER BY scheduled_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$ LANGUAGE plpgsql;
