/**
 * Boletos electrónicos con QR (issue #10): generación al pagar, firma con
 * TICKET_SECRET, QR alterado rechazado y acceso solo a los boletos propios.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { checkout } from '../src/modules/payments/payments.service';
import { lockService } from '../src/modules/locks/locks.service';
import { signToken } from '../src/modules/auth/auth.service';
import { verifyTicketCode, listMyTickets } from '../src/modules/tickets/tickets.service';
import { createFixture, cleanupFixture, authUser, okCard } from './helpers';

let fx: Awaited<ReturnType<typeof createFixture>>;
let tickets: Array<{ id: string; eventSeatId: string; code: string; qrData: string }>;
let orderId: string;
const app = createApp();
const fastCharge = async () => ({ ok: true, authCode: 'SIM-TEST' });

beforeAll(async () => {
  fx = await createFixture(3);
  const ids = fx.eventSeatIds.slice(0, 2);
  for (const id of ids) await lockService.acquire(fx.event.id, id, fx.userA.id);
  const r = await checkout(authUser(fx.userA), { eventId: fx.event.id, eventSeatIds: ids, card: okCard }, { charge: fastCharge });
  tickets = r.tickets;
  orderId = r.orderId;
});
afterAll(async () => cleanupFixture(fx));

/** Cambia el asiento dentro del JWT sin volver a firmarlo. */
function tamper(code: string): string {
  const [header, payload, signature] = code.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  claims.esid = 'otro-asiento';
  return [header, Buffer.from(JSON.stringify(claims)).toString('base64url'), signature].join('.');
}

describe('generación de boletos', () => {
  it('crea un boleto por asiento con su QR en PNG', async () => {
    expect(tickets).toHaveLength(2);
    for (const t of tickets) expect(t.qrData.startsWith('data:image/png;base64,')).toBe(true);
    const mine = await listMyTickets(fx.userA.id);
    expect(mine.filter((t) => t.order.id === orderId)).toHaveLength(2);
  });
  it('el código está firmado con TICKET_SECRET y apunta a la orden, el asiento y el evento', () => {
    for (const t of tickets) {
      const claims = verifyTicketCode(t.code);
      expect(claims).toMatchObject({ tid: t.id, oid: orderId, esid: t.eventSeatId, eid: fx.event.id });
    }
  });
});

describe('POST /api/tickets/verify', () => {
  it('acepta un código válido y devuelve el asiento', async () => {
    const r = await request(app).post('/api/tickets/verify').send({ code: tickets[0].code });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ valid: true, usedAt: null });
    expect(r.body.seat).toMatch(/^A-\d+$/);
  });
  it('rechaza un QR alterado (firma que no coincide)', async () => {
    const forged = tamper(tickets[0].code);
    expect(() => verifyTicketCode(forged)).toThrow();
    const r = await request(app).post('/api/tickets/verify').send({ code: forged });
    expect(r.status).toBe(400);
    expect(r.body.valid).toBe(false);
  });
  it('rechaza un código firmado con otro secreto', async () => {
    const claims = verifyTicketCode(tickets[0].code);
    const other = jwt.sign({ tid: claims.tid, oid: claims.oid, esid: claims.esid, eid: claims.eid }, 'otro-secreto-que-no-es-el-del-servidor');
    expect((await request(app).post('/api/tickets/verify').send({ code: other })).status).toBe(400);
  });
});

describe('Mis boletos', () => {
  it('cada usuario ve solo sus boletos', async () => {
    const a = await request(app).get('/api/tickets/mine').set('Authorization', `Bearer ${signToken(authUser(fx.userA))}`);
    expect(a.status).toBe(200);
    expect(a.body.tickets.filter((t: { order: { id: string } }) => t.order.id === orderId)).toHaveLength(2);
    const b = await request(app).get('/api/tickets/mine').set('Authorization', `Bearer ${signToken(authUser(fx.userB))}`);
    expect(b.body.tickets.some((t: { order: { id: string } }) => t.order.id === orderId)).toBe(false);
  });
  it('el boleto de otro usuario responde 403 y sin token 401', async () => {
    const r = await request(app).get(`/api/tickets/${tickets[0].id}`).set('Authorization', `Bearer ${signToken(authUser(fx.userB))}`);
    expect(r.status).toBe(403);
    expect((await request(app).get('/api/tickets/mine')).status).toBe(401);
  });
});
