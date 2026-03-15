import { SupabaseClient } from '@supabase/supabase-js';
import logger from './utils/logger.js';

export async function processEvent(supabase: SupabaseClient, event: any) {
    const { type, data } = event;
    
    switch (type) {
        case 'building_finish':
            await handleBuildingFinish(supabase, data);
            break;
        // Otros casos: research_finish, fleet_arrival
        default:
            logger.warn(`Unknown event type: ${type}`);
    }
}

async function handleBuildingFinish(supabase: SupabaseClient, data: any) {
    const { planet_id, building_id, queue_item_id } = data;
    
    // Iniciar transacción de finalización
    const { error } = await supabase.rpc('fn_complete_building', {
        p_planet_id: planet_id,
        p_building_id: building_id,
        p_queue_item_id: queue_item_id
    });

    if (error) throw error;
    
    logger.info(`Building finished: ${building_id} on planet ${planet_id}`);
}
