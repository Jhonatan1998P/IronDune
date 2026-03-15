import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import logger from './utils/logger.js';
import { startOutboxDispatcher } from './socket/dispatcher.js';
// @ts-ignore
import { runHardReset } from '../../../packages/db/src/index.ts';

dotenv.config();

// Check for Hard Reset
if (process.env.DB_HARD_RESET === 'true') {
  logger.warn('⚠️ DB_HARD_RESET is enabled. Resetting database...');
  await runHardReset().catch((err: any) => {
    logger.error('❌ Failed to hard reset database:', err);
    process.exit(1);
  });
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Auth Middleware (Simplificado para el ejemplo)
app.use((_req, _res, next) => {
    // Validar JWT de Supabase aquí
    next();
});

io.on('connection', (socket) => {
  const playerId = socket.handshake.query.playerId as string;
  if (playerId) {
    socket.join(`player:${playerId}`);
    logger.info(`Player ${playerId} connected via socket ${socket.id}`);
  }

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Iniciar dispatcher de eventos
startOutboxDispatcher(io, supabase);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  logger.info(`API Server with Outbox Dispatcher running on port ${PORT}`);
});
