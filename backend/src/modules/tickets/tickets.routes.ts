import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as tickets from './tickets.service';

export const ticketsRouter = Router();

ticketsRouter.get('/mine', requireAuth, async (req, res, next) => {
  try { res.json({ tickets: await tickets.listMyTickets(req.user!.id) }); } catch (e) { next(e); }
});
ticketsRouter.get('/:ticketId', requireAuth, validate('params', z.object({ ticketId: z.string().min(1) })), async (req, res, next) => {
  try { res.json({ ticket: await tickets.getTicket(req.params.ticketId, req.user!.id) }); } catch (e) { next(e); }
});
/** Verificación de un QR escaneado (demo de control de acceso). */
ticketsRouter.post('/verify', validate('body', z.object({ code: z.string().min(10) })), async (req, res) => {
  try { res.json(await tickets.verifyScanned(req.body.code)); } catch { res.status(400).json({ valid: false, error: 'Código inválido o firma incorrecta' }); }
});
