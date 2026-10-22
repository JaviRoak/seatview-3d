import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../lib/errors';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor', code: 'INTERNAL' });
}
