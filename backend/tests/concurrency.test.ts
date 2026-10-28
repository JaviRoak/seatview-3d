/**
 * Concurrencia: 50 solicitudes simultáneas de bloqueo del mismo asiento →
 * exactamente 1 éxito y 49 conflictos. Contra la API HTTP real y Redis real.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { signToken } from '../src/modules/auth/auth.service';
import { createFixture, cleanupFixture } from './helpers';
import { LockService } from '../src/modules/locks/locks.service';

let fx: Awaited<ReturnType<typeof createFixture>>;
const app = createApp();
beforeAll(async () => { fx = await createFixture(3); });
afterAll(async () => cleanupFixture(fx));

describe('Concurrencia de bloqueos', () => {
  it('50 usuarios distintos, mismo asiento: 1 × 201 y 49 × 409', async () => {
    const seatId = fx.eventSeatIds[0];
    const tokens = Array.from({ length: 50 }, (_, i) => signToken({ id: `concurrent-user-${i}`, email: `c${i}@t.local`, name: `C${i}`, role: 'USER' }));
    const responses = await Promise.all(tokens.map((t) => request(app).post('/api/locks').set('Authorization', `Bearer ${t}`).send({ eventId: fx.event.id, eventSeatId: seatId })));
    const codes = responses.map((r) => r.status);
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(49);
    expect(responses.filter((r) => r.status === 409).every((r) => r.body.code === 'SEAT_TAKEN')).toBe(true);
  });
  it('50 llamadas directas al servicio: exactamente 1 ACQUIRED', async () => {
    const svc = new LockService({ ttlSeconds: 30, maxPerUser: 6 });
    const results = await Promise.all(Array.from({ length: 50 }, (_, i) => svc.acquire(fx.event.id, fx.eventSeatIds[1], `svc-user-${i}`)));
    expect(results.filter((r) => r === 'ACQUIRED')).toHaveLength(1);
    expect(results.filter((r) => r === 'TAKEN')).toHaveLength(49);
  });
  it('rechaza bloquear sin JWT', async () => {
    const r = await request(app).post('/api/locks').send({ eventId: fx.event.id, eventSeatId: fx.eventSeatIds[2] });
    expect(r.status).toBe(401);
  });
});
