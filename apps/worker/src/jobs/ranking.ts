import { SupabaseClient } from '@supabase/supabase-js';
import logger from '../utils/logger.js';

/**
 * Calcula los puntos de todos los jugadores activos.
 * 1 Edificio = X puntos, 1 Nave = Y puntos, etc.
 */
export async function updateAllPlayerPoints(supabase: SupabaseClient) {
    logger.info('Starting global points recalculation...');

    try {
        // Ejecutar función RPC que hace el cálculo masivo en el servidor para mayor eficiencia
        const { error } = await supabase.rpc('fn_calculate_all_points');

        if (error) throw error;

        // Crear snapshot de la tabla de puntos para el leaderboard
        const { data: topPlayers } = await supabase
            .from('player_points')
            .select('player_id, total_points, players(username)')
            .order('total_points', { ascending: false })
            .limit(100);

        await supabase
            .from('leaderboard_snapshots')
            .insert({ data: topPlayers });

        logger.info('Ranking update completed successfully');
    } catch (error) {
        logger.error('Error updating ranking:', error);
    }
}
