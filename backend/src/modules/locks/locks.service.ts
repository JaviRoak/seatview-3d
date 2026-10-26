/**
 * Bloqueo temporal de asientos en Redis (issue #8).
 *
 * Clave: seat:{eventId}:{eventSeatId} → userId, con TTL.
 * Índice auxiliar: locks:user:{eventId}:{userId} (SET) para el límite por usuario.
 *
 * Garantías:
 *  - Adquirir: SET key userId NX EX ttl → solo un cliente gana (atómico en Redis).
 *  - Liberar / extender: script Lua que comprueba el dueño y actúa en el mismo
 *    paso (sin carrera entre GET y DEL).
 *  - El límite por usuario se aplica dentro del mismo script Lua.
 * Ver docs/concurrencia.md.
 */
import type Redis from 'ioredis';
import { redis as defaultRedis } from '../../lib/redis';
import { env } from '../../config/env';

export const seatKey = (eventId: string, eventSeatId: string) => `seat:${eventId}:${eventSeatId}`;
export const userSetKey = (eventId: string, userId: string) => `locks:user:${eventId}:${userId}`;

/**
 * KEYS[1] = seat key, KEYS[2] = user set
 * ARGV[1] = userId, ARGV[2] = ttl, ARGV[3] = maxPerUser, ARGV[4] = eventSeatId
 * Devuelve: 1 ok, 0 ocupado por otro, -1 límite alcanzado, 2 ya era mío (renueva)
 */
const ACQUIRE_LUA = `
local owner = redis.call('GET', KEYS[1])
if owner == ARGV[1] then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  redis.call('SADD', KEYS[2], ARGV[4])
  redis.call('EXPIRE', KEYS[2], ARGV[2])
  return 2
end
if owner then return 0 end
if redis.call('SCARD', KEYS[2]) >= tonumber(ARGV[3]) then return -1 end
local ok = redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2])
if not ok then return 0 end
redis.call('SADD', KEYS[2], ARGV[4])
redis.call('EXPIRE', KEYS[2], ARGV[2])
return 1
`;
/** Libera solo si el dueño coincide. */
const RELEASE_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('DEL', KEYS[1])
  redis.call('SREM', KEYS[2], ARGV[2])
  return 1
end
return 0
`;
/** Extiende el TTL solo si el dueño coincide. */
const EXTEND_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  redis.call('EXPIRE', KEYS[2], ARGV[2])
  return 1
end
return 0
`;

export type AcquireResult = 'ACQUIRED' | 'RENEWED' | 'TAKEN' | 'LIMIT';

export class LockService {
  private readonly redis: Redis;
  readonly ttl: number;
  readonly maxPerUser: number;

  constructor(opts: { ttlSeconds?: number; maxPerUser?: number; client?: Redis } = {}) {
    this.redis = opts.client ?? defaultRedis;
    this.ttl = opts.ttlSeconds ?? env.LOCK_TTL_SECONDS;
    this.maxPerUser = opts.maxPerUser ?? env.MAX_LOCKS_PER_USER;
  }

  async acquire(eventId: string, eventSeatId: string, userId: string): Promise<AcquireResult> {
    const r = (await this.redis.eval(ACQUIRE_LUA, 2, seatKey(eventId, eventSeatId), userSetKey(eventId, userId), userId, String(this.ttl), String(this.maxPerUser), eventSeatId)) as number;
    return r === 1 ? 'ACQUIRED' : r === 2 ? 'RENEWED' : r === -1 ? 'LIMIT' : 'TAKEN';
  }

  async release(eventId: string, eventSeatId: string, userId: string): Promise<boolean> {
    return ((await this.redis.eval(RELEASE_LUA, 2, seatKey(eventId, eventSeatId), userSetKey(eventId, userId), userId, eventSeatId)) as number) === 1;
  }

  /** Atomic all-or-nothing allocation of quantity from anonymous zone inventory. */
  async acquireQuantity(eventId: string, candidates: string[], quantity: number, userId: string): Promise<string[]> {
    const result = await this.redis.eval(`
      local prefix = 'seat:' .. ARGV[1] .. ':'
      for _, id in ipairs(redis.call('SMEMBERS', KEYS[1])) do
        if redis.call('GET', prefix .. id) ~= ARGV[2] then redis.call('SREM', KEYS[1], id) end
      end
      local quantity = tonumber(ARGV[3])
      if redis.call('SCARD', KEYS[1]) + quantity > tonumber(ARGV[5]) then return {'LIMIT'} end
      local picked = {}
      for i = 6, #ARGV do
        if redis.call('EXISTS', prefix .. ARGV[i]) == 0 then table.insert(picked, ARGV[i]) end
        if #picked == quantity then break end
      end
      if #picked < quantity then return {'FULL'} end
      for _, id in ipairs(picked) do
        redis.call('SET', prefix .. id, ARGV[2], 'EX', ARGV[4])
        redis.call('SADD', KEYS[1], id)
      end
      redis.call('EXPIRE', KEYS[1], ARGV[4])
      return picked
    `, 1, userSetKey(eventId, userId), eventId, userId, quantity, this.ttl, this.maxPerUser, ...candidates) as string[];
    return result;
  }

  async extend(eventId: string, eventSeatId: string, userId: string, ttl = this.ttl): Promise<boolean> {
    return ((await this.redis.eval(EXTEND_LUA, 2, seatKey(eventId, eventSeatId), userSetKey(eventId, userId), userId, String(ttl))) as number) === 1;
  }

  owner(eventId: string, eventSeatId: string): Promise<string | null> {
    return this.redis.get(seatKey(eventId, eventSeatId));
  }

  ttlOf(eventId: string, eventSeatId: string): Promise<number> {
    return this.redis.ttl(seatKey(eventId, eventSeatId));
  }

  /** Bloqueos vivos del usuario en un evento (verificados contra la clave real). */
  async listForUser(eventId: string, userId: string): Promise<Array<{ eventSeatId: string; ttl: number }>> {
    const ids = await this.redis.smembers(userSetKey(eventId, userId));
    if (ids.length === 0) return [];
    const pipeline = this.redis.pipeline();
    for (const id of ids) { pipeline.get(seatKey(eventId, id)); pipeline.ttl(seatKey(eventId, id)); }
    const res = await pipeline.exec();
    const out: Array<{ eventSeatId: string; ttl: number }> = [];
    const stale: string[] = [];
    ids.forEach((id, i) => {
      const owner = res?.[i * 2]?.[1] as string | null;
      const ttl = res?.[i * 2 + 1]?.[1] as number;
      if (owner === userId) out.push({ eventSeatId: id, ttl }); else stale.push(id);
    });
    if (stale.length) await this.redis.srem(userSetKey(eventId, userId), ...stale);
    return out;
  }

  /** Mapa eventSeatId → userId de todos los bloqueos vivos de un evento. */
  async listForEvent(eventId: string): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const pattern = `seat:${eventId}:*`;
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
      cursor = next;
      if (keys.length) {
        const values = await this.redis.mget(...keys);
        keys.forEach((k, i) => { if (values[i]) out.set(k.slice(pattern.length - 1), values[i]!); });
      }
    } while (cursor !== '0');
    return out;
  }
}

export const lockService = new LockService();
export const getLocksForEvent = (eventId: string) => lockService.listForEvent(eventId);

export function parseSeatKey(key: string): { eventId: string; eventSeatId: string } | null {
  const parts = key.split(':');
  if (parts.length !== 3 || parts[0] !== 'seat') return null;
  return { eventId: parts[1], eventSeatId: parts[2] };
}
