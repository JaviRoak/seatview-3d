
import { Router } from 'express';
import { z } from 'zod';

export const supportRouter = Router();

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(5000),
});

supportRouter.post('/contact', (req, res) => {
  const result = contactSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: 'Datos de contacto inválidos',
      code: 'BAD_REQUEST',
      details: result.error.flatten(),
    });
    return;
  }

  res.status(501).json({
    error: 'El envío de consultas todavía no está configurado',
    code: 'NOT_IMPLEMENTED',
  });
});
