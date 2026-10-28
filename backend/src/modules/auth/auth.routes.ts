import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import * as auth from './auth.service';

export const authRouter = Router();
const registerSchema = z.object({ email: z.string().email(), password: z.string().min(8, 'Mínimo 8 caracteres').max(72), name: z.string().min(2).max(60) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post('/register', validate('body', registerSchema), async (req, res, next) => {
  try { res.status(201).json(await auth.register(req.body)); } catch (e) { next(e); }
});
authRouter.post('/login', validate('body', loginSchema), async (req, res, next) => {
  try { res.json(await auth.login(req.body)); } catch (e) { next(e); }
});
authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
