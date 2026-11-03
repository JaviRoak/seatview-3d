
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';

export const supportRouter = Router();

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(5000),
});

supportRouter.post('/contact', async (req, res, next) => {
  try {
    const result = contactSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Datos de contacto inválidos',
        code: 'BAD_REQUEST',
        details: result.error.flatten(),
      });
      return;
    }

    const ticket = await prisma.supportTicket.create({
      data: result.data,
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: 'Consulta recibida correctamente',
      ticket,
    });
  } catch (error) {
    next(error);
  }
});