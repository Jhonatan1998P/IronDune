import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

async function startWorker() {
  logger.info('Background Worker starting...');
  
  // Ciclo principal del worker
  while (true) {
    try {
      // logger.debug('Worker pulse...');
      // Aquí irá la lógica de procesar eventos vencidos
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5s
    } catch (error) {
      logger.error('Error in worker loop:', error);
      await new Promise(resolve => setTimeout(resolve, 10000)); // Esperar 10s tras error
    }
  }
}

startWorker().catch(err => {
  logger.error('Fatal worker error:', err);
  process.exit(1);
});
