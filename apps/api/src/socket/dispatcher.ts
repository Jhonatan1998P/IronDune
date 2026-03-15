import { Server } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';
import logger from '../utils/logger.js';

export async function startOutboxDispatcher(io: Server, supabase: SupabaseClient) {
    logger.info('Outbox Dispatcher started');

    setInterval(async () => {
        try {
            // Obtener eventos no enviados
            const { data: events, error } = await supabase
                .from('event_outbox')
                .select('*')
                .is('sent_at', null)
                .order('id', { ascending: true })
                .limit(50);

            if (error) throw error;

            if (events && events.length > 0) {
                for (const event of events) {
                    const room = `player:${event.player_id}`;
                    
                    // Emitir patch al jugador
                    io.to(room).emit(event.event_type, {
                        ...event.payload,
                        serverTime: new Date().toISOString()
                    });

                    // Marcar como enviado
                    await supabase
                        .from('event_outbox')
                        .update({ sent_at: new Date().toISOString() })
                        .eq('id', event.id);
                }
            }
        } catch (error) {
            logger.error('Error in outbox dispatcher:', error);
        }
    }, 1000); // Poll cada segundo
}
