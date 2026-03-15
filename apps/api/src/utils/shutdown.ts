import { Server } from 'http';
import logger from './logger.js';

/**
 * Cierre suave del servidor API.
 */
export function setupGracefulShutdown(httpServer: Server) {
    const shutdown = () => {
        logger.info('SIGTERM/SIGINT received. Shutting down gracefully...');
        
        httpServer.close(() => {
            logger.info('HTTP server closed.');
            process.exit(0);
        });

        // Forzar cierre si tarda demasiado
        setTimeout(() => {
            logger.error('Forceful shutdown after timeout');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
