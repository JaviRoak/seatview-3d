/**
 * Boletos electrónicos con QR (issue #10).
 * El código es un JWT HS256 firmado con TICKET_SECRET (ticketId, orderId,
 * eventSeatId, eventId). El QR codifica ese JWT: un lector puede verificar la
 * firma sin BD y luego comprobar que no se haya usado.
 */
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { notFound, forbidden } from '../../lib/errors';

export interface TicketClaims { tid: string; oid: string; esid: string; eid: string }

export const signTicketCode = (claims: TicketClaims) => jwt.sign(claims, env.TICKET_SECRET, { algorithm: 'HS256' });
export const verifyTicketCode = (code: string) => jwt.verify(code, env.TICKET_SECRET, { algorithms: ['HS256'] }) as TicketClaims;
export const makeQrDataUrl = (code: string) => QRCode.toDataURL(code, { errorCorrectionLevel: 'M', margin: 1, width: 320 });

const include = {
  order: { select: { id: true, total: true, createdAt: true, userId: true } },
  eventSeat: { include: { seat: { include: { zone: true } }, event: { include: { venue: true } } } },
} as const;

export async function listMyTickets(userId: string) {
  const tickets = await prisma.ticket.findMany({ where: { order: { userId } }, orderBy: { createdAt: 'desc' }, include });
  return tickets.map(serialize);
}

export async function getTicket(ticketId: string, userId: string) {
  const t = await prisma.ticket.findUnique({ where: { id: ticketId }, include });
  if (!t) throw notFound('Boleto no encontrado');
  if (t.order.userId !== userId) throw forbidden('Este boleto no es tuyo');
  return serialize(t);
}

/** Verificación de un código escaneado (demo de control de acceso). */
export async function verifyScanned(code: string) {
  const claims = verifyTicketCode(code);
  const t = await prisma.ticket.findUnique({ where: { id: claims.tid }, include: { eventSeat: { include: { seat: true, event: true } } } });
  if (!t || t.code !== code) throw notFound('Boleto no válido');
  return { valid: true, usedAt: t.usedAt, event: t.eventSeat.event.name, seat: t.eventSeat.seat.row === 'GA' ? 'Acceso por zona · Sin asiento asignado' : `${t.eventSeat.seat.row}-${t.eventSeat.seat.number}` };
}

type Row = NonNullable<Awaited<ReturnType<typeof prisma.ticket.findUnique<{ where: { id: string }; include: typeof include }>>>>;

function serialize(t: Row) {
  return {
    id: t.id, code: t.code, qrData: t.qrData, usedAt: t.usedAt, createdAt: t.createdAt,
    order: { id: t.order.id, total: Number(t.order.total), createdAt: t.order.createdAt },
    event: { id: t.eventSeat.event.id, name: t.eventSeat.event.name, date: t.eventSeat.event.date, venue: t.eventSeat.event.venue.name, city: t.eventSeat.event.venue.city },
    seat: {
      eventSeatId: t.eventSeat.id, zone: t.eventSeat.seat.zone.name, zoneColor: t.eventSeat.seat.zone.color,
      price: Number(t.eventSeat.seat.zone.price), row: t.eventSeat.seat.row, number: t.eventSeat.seat.number,
    },
  };
}
