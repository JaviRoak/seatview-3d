/** Aplicación Express. Rutas: /api/auth, /api/events, /api/locks, /api/payments, /api/tickets, /api/health */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { corsOrigins } from './config/env';
import { authRouter } from './modules/auth/auth.routes';
import { eventsRouter } from './modules/events/events.routes';
import { locksRouter } from './modules/locks/locks.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { ticketsRouter } from './modules/tickets/tickets.routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(compression()); // el mapa de asientos (≈750 KB / 8k asientos) viaja gzip
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: '200kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'seatview-3d-api', time: new Date().toISOString() }));
  app.use('/api/auth', authRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/locks', locksRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/tickets', ticketsRouter);

  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada', code: 'NOT_FOUND' }));
  app.use(errorHandler);
  return app;
}
