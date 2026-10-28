/**
 * Pago simulado y confirmación de compra (issue #9).
 *
 * Flujo de `checkout`:
 *  1. Verificar que cada bloqueo en Redis sigue perteneciendo al usuario.
 *  2. Cobrar en la pasarela SIMULADA (1–2 s; la tarjeta 4000 0000 0000 0002 siempre falla).
 *  3. En UNA transacción de Prisma: re-verificar bloqueo, crear la orden y
 *     marcar EventSeat → SOLD solo si sigue AVAILABLE.
 *  4. Borrar las claves de Redis y emitir el cambio por Socket.io.
 *
 * Por qué es seguro: el bloqueo garantiza que solo un usuario llega al paso 3
 * para un asiento; el `updateMany` condicional (status = AVAILABLE) dentro de
 * la transacción garantiza que, aun si el bloqueo expirase entre 1 y 3, nunca
 * se venda dos veces (count < esperado → rollback).
 */
import { prisma } from '../../lib/prisma';
import { conflict, badRequest, HttpError } from '../../lib/errors';
import { lockService, seatKey, userSetKey } from '../locks/locks.service';
import { emitSeatUpdate } from '../../sockets';
import { redis } from '../../lib/redis';
import type { AuthUser } from '../auth/auth.service';

export interface CardInput { holder: string; number: string; expMonth: number; expYear: number; cvc: string }

/** Tarjeta de prueba que siempre es rechazada. */
export const DECLINED_CARD = '4000000000000002';
export const TEST_CARD_OK = '4242424242424242';

export interface GatewayResult { ok: boolean; authCode?: string; reason?: string }

/** Pasarela simulada: no guarda datos de tarjeta, solo decide y tarda un poco. */
export async function simulatedGatewayCharge(card: CardInput, amount: number, delayMs?: number): Promise<GatewayResult> {
  await new Promise((r) => setTimeout(r, delayMs ?? 1000 + Math.random() * 1000));
  if (card.number === DECLINED_CARD) return { ok: false, reason: 'Tarjeta rechazada por el emisor' };
  if (!luhnValid(card.number)) return { ok: false, reason: 'Número de tarjeta inválido' };
  if (new Date(card.expYear, card.expMonth, 0) < new Date()) return { ok: false, reason: 'Tarjeta vencida' };
  if (amount <= 0) return { ok: false, reason: 'Monto inválido' };
  return { ok: true, authCode: 'SIM-' + Math.random().toString(36).slice(2, 10).toUpperCase() };
}

export function luhnValid(num: string): boolean {
  if (!/^\d{12,19}$/.test(num)) return false;
  let sum = 0, dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return sum % 10 === 0;
}

export interface CheckoutInput { eventId: string; eventSeatIds: string[]; card: CardInput }
export interface CheckoutDeps { charge?: typeof simulatedGatewayCharge }

export async function checkout(user: AuthUser, input: CheckoutInput, deps: CheckoutDeps = {}) {
  const charge = deps.charge ?? simulatedGatewayCharge;
  const { eventId } = input;
  const eventSeatIds = Array.from(new Set(input.eventSeatIds));
  if (eventSeatIds.length === 0) throw badRequest('Selecciona al menos un asiento');

  // 1. Los bloqueos deben seguir siendo del usuario.
  const lost: string[] = [];
  for (const id of eventSeatIds) if ((await lockService.owner(eventId, id)) !== user.id) lost.push(id);
  if (lost.length) throw conflict('El tiempo de reserva de uno o más asientos expiró. Vuelve a seleccionarlos.', 'LOCK_LOST', { eventSeatIds: lost });

  // Precio calculado en el servidor, nunca desde el cliente.
  const rows = await prisma.eventSeat.findMany({
    where: { id: { in: eventSeatIds }, eventId },
    include: { seat: { include: { zone: true } }, event: { select: { name: true, date: true } } },
  });
  if (rows.length !== eventSeatIds.length) throw badRequest('Algún asiento no pertenece a este evento');
  if (rows.some((r) => r.status === 'SOLD')) throw conflict('Un asiento ya fue vendido', 'SEAT_SOLD');
  const total = rows.reduce((acc, r) => acc + Number(r.seat.zone.price), 0);

  // 2. Cobro simulado.
  const gw = await charge(input.card, total);
  if (!gw.ok) {
    await prisma.order.create({ data: { userId: user.id, eventId, total, status: 'FAILED', cardLast4: input.card.number.slice(-4) } });
    throw new HttpError(402, gw.reason ?? 'Pago rechazado', 'PAYMENT_DECLINED');
  }

  // 3. Transacción.
  const result = await prisma.$transaction(async (tx) => {
    for (const id of eventSeatIds) {
      if ((await lockService.owner(eventId, id)) !== user.id) throw conflict('La reserva expiró durante el pago', 'LOCK_LOST', { eventSeatIds: [id] });
    }
    const order = await tx.order.create({ data: { userId: user.id, eventId, total, status: 'PAID', cardLast4: input.card.number.slice(-4) } });
    const updated = await tx.eventSeat.updateMany({ where: { id: { in: eventSeatIds }, eventId, status: 'AVAILABLE' }, data: { status: 'SOLD', orderId: order.id } });
    if (updated.count !== eventSeatIds.length) throw conflict('Un asiento dejó de estar disponible', 'SEAT_SOLD'); // rollback
    return { order };
  });

  // 4. Liberar Redis y notificar.
  await redis.del(...eventSeatIds.map((id) => seatKey(eventId, id)));
  await redis.srem(userSetKey(eventId, user.id), ...eventSeatIds);
  emitSeatUpdate(eventId, eventSeatIds.map((id) => ({ eventSeatId: id, status: 2 as const })));

  return {
    orderId: result.order.id, total, authCode: gw.authCode,
    seats: rows.map((r) => ({ eventSeatId: r.id, zone: r.seat.zone.name, row: r.seat.row, number: r.seat.number, price: Number(r.seat.zone.price) })),
  };
}
