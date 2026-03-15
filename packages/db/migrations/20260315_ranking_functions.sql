-- FASE 9: Cálculo de puntos (RPC)
CREATE OR REPLACE FUNCTION fn_calculate_all_points()
RETURNS void AS $$
BEGIN
    -- Actualizar puntos de edificios
    INSERT INTO player_points (player_id, building_points, updated_at)
    SELECT 
        p.player_id, 
        SUM(pb.level * 10) as b_points, -- Ejemplo: 10 puntos por nivel
        now()
    FROM planets p
    JOIN planet_buildings pb ON p.id = pb.planet_id
    GROUP BY p.player_id
    ON CONFLICT (player_id) DO UPDATE SET
        building_points = EXCLUDED.building_points,
        total_points = EXCLUDED.building_points + player_points.research_points + player_points.fleet_points,
        updated_at = now();
END;
$$ LANGUAGE plpgsql;
