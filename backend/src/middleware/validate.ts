import type { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { badRequest } from '../lib/errors';

type Part = 'body' | 'params' | 'query';

/** Valida req[part] con Zod y reemplaza el valor por el resultado tipado. */
export function validate(part: Part, schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) return next(badRequest('Datos inválidos', result.error.flatten()));
    (req as unknown as Record<Part, unknown>)[part] = result.data;
    next();
  };
}
