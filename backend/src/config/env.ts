/** Configuración centralizada. Secretos solo por variables de entorno; validado con Zod al arrancar. */
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(8),
  TICKET_SECRET: z.string().min(8),
  /** Orígenes permitidos separados por coma (Express y Socket.io). Con el proxy de Vite el origen que llega es el del frontend. */
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  /** Compatibilidad con la variable antigua en singular. */
  CORS_ORIGIN: z.string().optional(),
  LOCK_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  MAX_LOCKS_PER_USER: z.coerce.number().int().positive().default(6),
  LOCK_EXPIRY_STRATEGY: z.enum(['keyspace', 'sweep']).default('keyspace'),
  LOCK_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  MAIL_TRANSPORT: z.enum(['console', 'ethereal', 'smtp']).default('console'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('SeatView 3D <no-reply@seatview.local>'),
  /** Tamaño máximo de imagen subida por administradores (bytes). 2 MB por defecto. */
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;

/** Lista de orígenes permitidos (CORS_ORIGINS + CORS_ORIGIN legado), sin espacios ni vacíos. */
export const corsOrigins: string[] = Array.from(new Set(
  [env.CORS_ORIGINS, env.CORS_ORIGIN ?? ''].join(',').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean),
));
