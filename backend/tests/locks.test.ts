/** Pruebas del servicio de bloqueo (issue #8) contra Redis real. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LockService } from '../src/modules/locks/locks.service';
import { redis } from '../src/lib/redis';

const eventId = 'evt-lock-test';
const seat = 'seat-1';
let svc: LockService;
const clean = async () => { const k = await redis.keys(`*${eventId}*`); if (k.length) await redis.del(...k); };

beforeAll(async () => { svc = new LockService({ ttlSeconds: 2, maxPerUser: 2 }); await clean(); });
afterAll(clean);

describe('LockService', () => {
  it('bloquea un asiento libre', async () => {
    expect(await svc.acquire(eventId, seat, 'u1')).toBe('ACQUIRED');
    expect(await svc.owner(eventId, seat)).toBe('u1');
    expect(await svc.ttlOf(eventId, seat)).toBeGreaterThan(0);
  });
  it('rechaza un segundo bloqueo de otro usuario', async () => {
    expect(await svc.acquire(eventId, seat, 'u2')).toBe('TAKEN');
    expect(await svc.owner(eventId, seat)).toBe('u1');
  });
  it('renueva si el mismo usuario vuelve a bloquear', async () => {
    expect(await svc.acquire(eventId, seat, 'u1')).toBe('RENEWED');
  });
  it('solo el dueño puede liberar', async () => {
    expect(await svc.release(eventId, seat, 'u2')).toBe(false);
    expect(await svc.owner(eventId, seat)).toBe('u1');
    expect(await svc.release(eventId, seat, 'u1')).toBe(true);
    expect(await svc.owner(eventId, seat)).toBeNull();
  });
  it('solo el dueño puede extender', async () => {
    await svc.acquire(eventId, seat, 'u1');
    expect(await svc.extend(eventId, seat, 'u2', 10)).toBe(false);
    expect(await svc.extend(eventId, seat, 'u1', 10)).toBe(true);
    expect(await svc.ttlOf(eventId, seat)).toBeGreaterThan(5);
    await svc.release(eventId, seat, 'u1');
  });
  it('aplica el límite de asientos por usuario', async () => {
    expect(await svc.acquire(eventId, 's-a', 'u3')).toBe('ACQUIRED');
    expect(await svc.acquire(eventId, 's-b', 'u3')).toBe('ACQUIRED');
    expect(await svc.acquire(eventId, 's-c', 'u3')).toBe('LIMIT');
    expect((await svc.listForUser(eventId, 'u3')).map((l) => l.eventSeatId).sort()).toEqual(['s-a', 's-b']);
    await svc.release(eventId, 's-a', 'u3');
    expect(await svc.acquire(eventId, 's-c', 'u3')).toBe('ACQUIRED');
  });
  it('el bloqueo expira y el asiento vuelve a estar libre', async () => {
    const short = new LockService({ ttlSeconds: 1, maxPerUser: 6 });
    expect(await short.acquire(eventId, 'exp-1', 'u9')).toBe('ACQUIRED');
    await new Promise((r) => setTimeout(r, 1300));
    expect(await short.owner(eventId, 'exp-1')).toBeNull();
    expect(await short.acquire(eventId, 'exp-1', 'u10')).toBe('ACQUIRED');
  });
  it('lista los bloqueos vivos de un evento', async () => {
    const map = await svc.listForEvent(eventId);
    expect(map.get('exp-1')).toBe('u10');
    expect(map.get('s-b')).toBe('u3');
  });
});
