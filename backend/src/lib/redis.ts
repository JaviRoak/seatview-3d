import Redis from 'ioredis';
import { env } from '../config/env';

/** Conexión principal (comandos). Las suscripciones necesitan una conexión aparte: createSubscriber(). */
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
redis.on('error', (err) => console.error('[redis]', err.message));

export function createSubscriber(): Redis {
  return new Redis(env.REDIS_URL);
}
