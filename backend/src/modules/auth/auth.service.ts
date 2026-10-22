/** Autenticación con JWT + bcrypt (requisito transversal de seguridad). */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { conflict, unauthorized } from '../../lib/errors';

export interface AuthUser { id: string; email: string; name: string; role: 'USER' | 'ADMIN' }

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: '12h', subject: user.id });
}

export function verifyToken(token: string): AuthUser {
  const p = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & AuthUser;
  return { id: p.id, email: p.email, name: p.name, role: p.role };
}

export async function register(input: { email: string; password: string; name: string }) {
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw conflict('Ya existe una cuenta con ese correo', 'EMAIL_TAKEN');
  const user = await prisma.user.create({ data: { email: input.email, name: input.name, passwordHash: await bcrypt.hash(input.password, 10) } });
  const authUser: AuthUser = { id: user.id, email: user.email, name: user.name, role: user.role };
  return { user: authUser, token: signToken(authUser) };
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw unauthorized('Correo o contraseña incorrectos');
  const authUser: AuthUser = { id: user.id, email: user.email, name: user.name, role: user.role };
  return { user: authUser, token: signToken(authUser) };
}
