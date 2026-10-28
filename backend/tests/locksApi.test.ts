/**
 * Endpoints de bloqueo (issue #8) por HTTP: apartar, SEAT_TAKEN, SEAT_SOLD,
 * LOCK_LIMIT y liberar solo el dueño. Contra la API real, PostgreSQL y Redis.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { env } from '../src/config/env';
import { signToken } from '../src/modules/auth/auth.service';
import { createFixture, cleanupFixture, authUser } from './helpers';

let fx: Awaited<ReturnType<typeof createFixture>>;
let tokenA: string;
let tokenB: string;
const app = createApp();
// Asientos suficientes para llegar al límite por usuario y pasarlo por uno.
beforeAll(async () => {
  fx = await createFixture(env.MAX_LOCKS_PER_USER + 3);
  tokenA = signToken(authUser(fx.userA));
  tokenB = signToken(authUser(fx.userB));
});
afterAll(async () => cleanupFixture(fx));

const lock = (token: string, eventSeatId: string) =>
  request(app).post('/api/locks').set('Authorization', `Bearer ${token}`).send({ eventId: fx.event.id, eventSeatId });
const unlock = (token: string, eventSeatId: string) =>
  request(app).delete('/api/locks').set('Authorization', `Bearer ${token}`).send({ eventId: fx.event.id, eventSeatId });

describe('POST /api/locks', () => {
  it('aparta un asiento libre y devuelve su TTL', async () => {
    const r = await lock(tokenA, fx.eventSeatIds[0]);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ eventSeatId: fx.eventSeatIds[0], renewed: false });
    expect(r.body.ttl).toBeGreaterThan(0);
  });
  it('rechaza con SEAT_TAKEN si otro usuario ya lo apartó', async () => {
    const r = await lock(tokenB, fx.eventSeatIds[0]);
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('SEAT_TAKEN');
  });
  it('rechaza con SEAT_SOLD un asiento vendido', async () => {
    await prisma.eventSeat.update({ where: { id: fx.eventSeatIds[1] }, data: { status: 'SOLD' } });
    const r = await lock(tokenA, fx.eventSeatIds[1]);
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('SEAT_SOLD');
  });
  it('rechaza con LOCK_LIMIT al pasar el límite de asientos por usuario', async () => {
    // A ya tiene 1 bloqueo (asiento 0); completa el límite con los asientos 2, 3, ...
    const free = fx.eventSeatIds.slice(2);
    for (let i = 0; i < env.MAX_LOCKS_PER_USER - 1; i++) expect((await lock(tokenA, free[i])).status).toBe(201);
    const r = await lock(tokenA, free[env.MAX_LOCKS_PER_USER - 1]);
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('LOCK_LIMIT');
  });
  it('responde 404 si el asiento no pertenece al evento', async () => {
    expect((await lock(tokenA, 'no-existe')).status).toBe(404);
  });
});

describe('DELETE /api/locks', () => {
  it('solo el dueño puede liberar el asiento', async () => {
    const byOther = await unlock(tokenB, fx.eventSeatIds[0]);
    expect(byOther.status).toBe(200);
    expect(byOther.body.released).toBe(false);
    const mine = await request(app).get(`/api/locks/${fx.event.id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(mine.body.locks.map((l: { eventSeatId: string }) => l.eventSeatId)).toContain(fx.eventSeatIds[0]);

    const byOwner = await unlock(tokenA, fx.eventSeatIds[0]);
    expect(byOwner.body.released).toBe(true);
    expect((await lock(tokenB, fx.eventSeatIds[0])).status).toBe(201);
  });
});
