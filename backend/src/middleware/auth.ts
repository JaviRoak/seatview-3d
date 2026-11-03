import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type AuthUser } from '../modules/auth/auth.service';
import { forbidden, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

/** Exige un JWT válido en Authorization: Bearer <token>. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(unauthorized());
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(unauthorized('Token inválido o expirado'));
  }
}

export function requireRole(role: 'ADMIN') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(unauthorized());

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { role: true },
      });

      if (!user || user.role !== role) {
        return next(forbidden());
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
