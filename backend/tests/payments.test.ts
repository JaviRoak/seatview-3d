/** Pago y confirmación (issue #9) contra PostgreSQL y Redis reales. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { checkout } from '../src/modules/payments/payments.service';
import { LockService, lockService } from '../src/modules/locks/locks.service';
import { prisma } from '../src/lib/prisma';
import { createFixture, cleanupFixture, authUser, okCard, badCard } from './helpers';

let fx: Awaited<ReturnType<typeof createFixture>>;
const fastCharge = async (card: { number: string }) => (card.number === badCard.number ? { ok: false, reason: 'rechazada' } : { ok: true, authCode: 'SIM-TEST' });
beforeAll(async () => { fx = await createFixture(6); });
afterAll(async () => cleanupFixture(fx));

describe('checkout', () => {
  it('falla con LOCK_LOST si el usuario no tiene el bloqueo', async () => {
    await expect(checkout(authUser(fx.userA), { eventId: fx.event.id, eventSeatIds: [fx.eventSeatIds[0]], card: okCard }, { charge: fastCharge }))
      .rejects.toMatchObject({ status: 409, code: 'LOCK_LOST' });
  });
  it('falla si el bloqueo pertenece a otro usuario', async () => {
    await lockService.acquire(fx.event.id, fx.eventSeatIds[0], fx.userB.id);
    await expect(checkout(authUser(fx.userA), { eventId: fx.event.id, eventSeatIds: [fx.eventSeatIds[0]], card: okCard }, { charge: fastCharge }))
      .rejects.toMatchObject({ code: 'LOCK_LOST' });
    await lockService.release(fx.event.id, fx.eventSeatIds[0], fx.userB.id);
  });
  it('falla si el bloqueo expiró antes de pagar', async () => {
    const short = new LockService({ ttlSeconds: 1, maxPerUser: 6 });
    await short.acquire(fx.event.id, fx.eventSeatIds[1], fx.userA.id);
    await new Promise((r) => setTimeout(r, 1200));
    await expect(checkout(authUser(fx.userA), { eventId: fx.event.id, eventSeatIds: [fx.eventSeatIds[1]], card: okCard }, { charge: fastCharge }))
      .rejects.toMatchObject({ code: 'LOCK_LOST' });
    expect((await prisma.eventSeat.findUnique({ where: { id: fx.eventSeatIds[1] } }))?.status).toBe('AVAILABLE');
  });
  it('con tarjeta rechazada registra orden FAILED y no vende', async () => {
    await lockService.acquire(fx.event.id, fx.eventSeatIds[2], fx.userA.id);
    await expect(checkout(authUser(fx.userA), { eventId: fx.event.id, eventSeatIds: [fx.eventSeatIds[2]], card: badCard }, { charge: fastCharge }))
      .rejects.toMatchObject({ status: 402, code: 'PAYMENT_DECLINED' });
    expect((await prisma.eventSeat.findUnique({ where: { id: fx.eventSeatIds[2] } }))?.status).toBe('AVAILABLE');
    expect(await lockService.owner(fx.event.id, fx.eventSeatIds[2])).toBe(fx.userA.id); // el bloqueo sigue vivo
    expect(await prisma.order.findFirst({ where: { eventId: fx.event.id, status: 'FAILED' } })).not.toBeNull();
  });
  it('el pago exitoso marca vendidos y libera Redis', async () => {
    const ids = [fx.eventSeatIds[3], fx.eventSeatIds[4]];
    for (const id of ids) await lockService.acquire(fx.event.id, id, fx.userA.id);
    const result = await checkout(authUser(fx.userA), { eventId: fx.event.id, eventSeatIds: ids, card: okCard }, { charge: fastCharge });
    expect(result.total).toBe(20);
    expect(result.seats).toHaveLength(2);
    expect((await prisma.order.findUnique({ where: { id: result.orderId } }))?.status).toBe('PAID');
    const rows = await prisma.eventSeat.findMany({ where: { id: { in: ids } } });
    expect(rows.every((r) => r.status === 'SOLD' && r.orderId === result.orderId)).toBe(true);
    for (const id of ids) expect(await lockService.owner(fx.event.id, id)).toBeNull();
  });
  it('nunca vende un asiento ya vendido aunque haya bloqueo', async () => {
    const id = fx.eventSeatIds[3];
    await lockService.acquire(fx.event.id, id, fx.userB.id);
    await expect(checkout(authUser(fx.userB), { eventId: fx.event.id, eventSeatIds: [id], card: okCard }, { charge: fastCharge }))
      .rejects.toMatchObject({ code: 'SEAT_SOLD' });
    await lockService.release(fx.event.id, id, fx.userB.id);
  });
});
