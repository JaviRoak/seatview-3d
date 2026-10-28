/**
 * Endpoints de bloqueo temporal (issue #8). Todos requieren JWT.
 *  POST   /api/locks          { eventId, eventSeatId } → 201 | 409 SEAT_TAKEN | 409 LOCK_LIMIT | 409 SEAT_SOLD
 *  DELETE /api/locks          { eventId, eventSeatId } → 200 (solo el dueño)
 *  POST   /api/locks/extend   { eventId, eventSeatId } → 200 | 409 LOCK_LOST
 *  GET    /api/locks/:eventId → mis bloqueos vivos con TTL
 */
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { lockService } from './locks.service';
import { prisma } from '../../lib/prisma';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { emitSeatUpdate } from '../../sockets';

export const locksRouter = Router();
locksRouter.use(requireAuth);
const body = z.object({ eventId: z.string().min(1), eventSeatId: z.string().min(1) });

locksRouter.post('/', validate('body', body), async (req, res, next) => {
  try {
    const { eventId, eventSeatId } = req.body;
    const userId = req.user!.id;
    const es = await prisma.eventSeat.findUnique({ where: { id: eventSeatId }, select: { eventId: true, status: true, seat: { select: { row: true } } } });
    if (!es || es.eventId !== eventId) throw notFound('Asiento no encontrado en este evento');
    if (es.seat.row === 'GA') throw badRequest('Esta zona se reserva por cantidad, sin elegir ubicación');
    if (es.status === 'SOLD') throw conflict('Este asiento ya fue vendido', 'SEAT_SOLD');
    const result = await lockService.acquire(eventId, eventSeatId, userId);
    if (result === 'TAKEN') throw conflict('Otro usuario está comprando este asiento', 'SEAT_TAKEN');
    if (result === 'LIMIT') throw conflict(`Solo puedes bloquear ${lockService.maxPerUser} asientos a la vez`, 'LOCK_LIMIT');
    const ttl = await lockService.ttlOf(eventId, eventSeatId);
    emitSeatUpdate(eventId, [{ eventSeatId, status: 1, lockedBy: userId, ttl }]);
    res.status(201).json({ eventSeatId, ttl, renewed: result === 'RENEWED' });
  } catch (e) { next(e); }
});

locksRouter.delete('/', validate('body', body), async (req, res, next) => {
  try {
    const { eventId, eventSeatId } = req.body;
    const released = await lockService.release(eventId, eventSeatId, req.user!.id);
    if (released) emitSeatUpdate(eventId, [{ eventSeatId, status: 0 }]);
    res.json({ released });
  } catch (e) { next(e); }
});

locksRouter.post('/extend', validate('body', body), async (req, res, next) => {
  try {
    const { eventId, eventSeatId } = req.body;
    if (!(await lockService.extend(eventId, eventSeatId, req.user!.id))) throw conflict('El bloqueo ya no te pertenece o expiró', 'LOCK_LOST');
    const ttl = await lockService.ttlOf(eventId, eventSeatId);
    emitSeatUpdate(eventId, [{ eventSeatId, status: 1, lockedBy: req.user!.id, ttl }]);
    res.json({ eventSeatId, ttl });
  } catch (e) { next(e); }
});

locksRouter.get('/:eventId', validate('params', z.object({ eventId: z.string().min(1) })), async (req, res, next) => {
  try { res.json({ locks: await lockService.listForUser(req.params.eventId, req.user!.id) }); } catch (e) { next(e); }
});
