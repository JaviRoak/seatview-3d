import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import * as events from './events.service';
import * as seats from '../seats/seats.service';

export const eventsRouter = Router();
const idParam = z.object({ eventId: z.string().min(1) });

eventsRouter.get('/', async (_req, res, next) => {
  try { res.json({ events: await events.listEvents() }); } catch (e) { next(e); }
});
eventsRouter.get('/:eventId', validate('params', idParam), async (req, res, next) => {
  try { res.json({ event: await events.getEvent(req.params.eventId) }); } catch (e) { next(e); }
});
/** Asientos del evento con su estado actual. Arrays paralelos para un JSON compacto. */
eventsRouter.get('/:eventId/seats', validate('params', idParam), async (req, res, next) => {
  try { res.json(await seats.getEventSeats(req.params.eventId)); } catch (e) { next(e); }
});
