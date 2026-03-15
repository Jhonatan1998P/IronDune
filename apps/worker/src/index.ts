import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import { processEvent } from './processor.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function startWorker() {
  logger.info('Iron Dune Background Worker started');
  
  while (true) {
    try {
      // Reclamar eventos vencidos y pendientes
      // Usamos una transacción para marcar como "in_progress"
      const { data: events, error } = await supabase.rpc('fn_claim_events', {
          p_batch_size: 10
      });

      if (error) throw error;

      if (events && events.length > 0) {
          logger.info(`Processing ${events.length} events...`);
          
          for (const event of events) {
              try {
                  await processEvent(supabase, event);
                  
                  // Marcar como procesado
                  await supabase
                      .from('game_events')
                      .update({ status: 'completed', processed_at: new Date().toISOString() })
                      .eq('id', event.id);
                      
              } catch (eventError: any) {
                  logger.error(`Error processing event ${event.id}:`, eventError);
                  await supabase
                      .from('game_events')
                      .update({ status: 'failed', error_log: eventError.message })
                      .eq('id', event.id);
              }
          }
      }

      await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2s
    } catch (error) {
      logger.error('Worker loop error:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

startWorker();
