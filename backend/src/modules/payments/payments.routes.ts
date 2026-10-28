/** POST /api/payments/checkout (issue #9) — requiere JWT. */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { checkout, TEST_CARD_OK, DECLINED_CARD } from './payments.service';

export const paymentsRouter = Router();

const cardSchema = z.object({
  holder: z.string().min(3).max(60),
  number: z.string().transform((s) => s.replace(/\s|-/g, '')).pipe(z.string().regex(/^\d{12,19}$/, 'Número de tarjeta inválido')),
  expMonth: z.coerce.number().int().min(1).max(12),
  expYear: z.coerce.number().int().min(2024).max(2060),
  cvc: z.string().regex(/^\d{3,4}$/),
});
const checkoutSchema = z.object({ eventId: z.string().min(1), eventSeatIds: z.array(z.string().min(1)).min(1).max(10), card: cardSchema });

paymentsRouter.get('/test-cards', (_req, res) => res.json({ ok: TEST_CARD_OK, declined: DECLINED_CARD }));
paymentsRouter.post('/checkout', requireAuth, validate('body', checkoutSchema), async (req, res, next) => {
  try { res.status(201).json(await checkout(req.user!, req.body)); } catch (e) { next(e); }
});
