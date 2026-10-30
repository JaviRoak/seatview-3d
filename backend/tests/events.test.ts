/**
 * API de eventos (issue #11): listado, detalle con recinto y zonas, mapa de
 * asientos (arrays paralelos con estado combinado PostgreSQL + Redis) y 404.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { defaultLayout } from '../src/lib/layout';
import { signToken } from '../src/modules/auth/auth.service';
import { createFixture, cleanupFixture, authUser } from './helpers';

let fx: Awaited<ReturnType<typeof createFixture>>;
const app = createApp();
beforeAll(async () => {
  fx = await createFixture(5);
  // El mapa de asientos calcula la calidad de vista con las medidas del campo del layout.
  await prisma.venue.update({ where: { id: fx.venue.id }, data: { layout: JSON.parse(JSON.stringify(defaultLayout())) } });
});
afterAll(async () => cleanupFixture(fx));

describe('GET /api/events', () => {
  it('lista el evento con su recinto y el conteo de localidades', async () => {
    const r = await request(app).get('/api/events');
    expect(r.status).toBe(200);
    const ev = r.body.events.find((e: { id: string }) => e.id === fx.event.id);
    expect(ev).toBeTruthy();
    expect(ev.venue).toMatchObject({ id: fx.venue.id, name: fx.venue.name });
    expect(ev.totalSeats).toBe(5);
    expect(ev.soldSeats).toBe(0);
    expect(ev.featured).toBe(false);
  });
  it('minPrice es la zona más barata con lugares; ignora zonas vacías', async () => {
    const empty = await prisma.zone.create({ data: { venueId: fx.venue.id, name: 'Palco cerrado', color: '#000000', price: 1 } });
    try {
      const r = await request(app).get('/api/events');
      expect(r.body.events.find((e: { id: string }) => e.id === fx.event.id).minPrice).toBe(10);
    } finally { await prisma.zone.delete({ where: { id: empty.id } }); }
  });
});

describe('GET /api/events/:eventId', () => {
  it('devuelve el detalle con el layout del recinto y sus zonas', async () => {
    const r = await request(app).get(`/api/events/${fx.event.id}`);
    expect(r.status).toBe(200);
    expect(r.body.event.id).toBe(fx.event.id);
    expect(r.body.event.venue.layout.field).toBeTruthy();
    expect(r.body.event.venue.zones).toHaveLength(1);
    expect(r.body.event.venue.zones[0]).toMatchObject({ id: fx.zone.id, price: 10, capacity: 5 });
  });
  it('responde 404 si el evento no existe', async () => {
    const r = await request(app).get('/api/events/no-existe');
    expect(r.status).toBe(404);
    expect(r.body.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/events/:eventId/seats', () => {
  it('devuelve arrays paralelos del mismo largo, todos disponibles', async () => {
    const r = await request(app).get(`/api/events/${fx.event.id}/seats`);
    expect(r.status).toBe(200);
    const p = r.body;
    expect(p.count).toBe(5);
    for (const key of ['ids', 'seatIds', 'zoneIdx', 'rows', 'numbers', 'rotations', 'status', 'viewPct']) expect(p[key]).toHaveLength(5);
    expect(p.positions).toHaveLength(15);
    expect(p.status.every((s: number) => s === 0)).toBe(true);
    expect(p.lockedBy).toEqual({});
  });
  it('refleja un asiento apartado (Redis) y uno vendido (PostgreSQL)', async () => {
    const token = signToken(authUser(fx.userA));
    const lock = await request(app).post('/api/locks').set('Authorization', `Bearer ${token}`).send({ eventId: fx.event.id, eventSeatId: fx.eventSeatIds[0] });
    expect(lock.status).toBe(201);
    await prisma.eventSeat.update({ where: { id: fx.eventSeatIds[1] }, data: { status: 'SOLD' } });

    const p = (await request(app).get(`/api/events/${fx.event.id}/seats`)).body;
    const i0 = p.ids.indexOf(fx.eventSeatIds[0]);
    const i1 = p.ids.indexOf(fx.eventSeatIds[1]);
    expect(p.status[i0]).toBe(1);
    expect(p.lockedBy[i0]).toBe(fx.userA.id);
    expect(p.status[i1]).toBe(2);
  });
  it('responde 404 si el evento no existe', async () => {
    expect((await request(app).get('/api/events/no-existe/seats')).status).toBe(404);
  });
});
