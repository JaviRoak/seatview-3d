import { prisma } from '../../lib/prisma';
import { badRequest, conflict } from '../../lib/errors';
import { lockService } from './locks.service';
import { emitSeatUpdate } from '../../sockets';

export async function reserveZone(eventId: string, zoneId: string, quantity: number, userId: string) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > lockService.maxPerUser) throw badRequest(`Elige entre 1 y ${lockService.maxPerUser} entradas`);
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { venueId: true } });
  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!event || zone?.venueId !== event.venueId) throw badRequest('La zona no pertenece al evento');
  const candidates = await prisma.eventSeat.findMany({ where: { eventId, status: 'AVAILABLE', seat: { zoneId, row: 'GA' } }, select: { id: true }, orderBy: { seat: { idx: 'asc' } } });
  if (!candidates.length) throw conflict('La zona no tiene cupos disponibles', 'ZONE_FULL');
  const ids = await lockService.acquireQuantity(eventId, candidates.map(c=>c.id), quantity, userId);
  if (ids[0] === 'LIMIT') throw conflict(`Puedes apartar hasta ${lockService.maxPerUser} entradas a la vez`, 'LOCK_LIMIT');
  if (ids[0] === 'FULL') throw conflict('No quedan suficientes cupos para esa cantidad', 'ZONE_FULL');
  const locks = ids.map(eventSeatId=>({eventSeatId,ttl:lockService.ttl}));
  emitSeatUpdate(eventId, ids.map(eventSeatId=>({eventSeatId,status:1 as const,lockedBy:userId,ttl:lockService.ttl})));
  return { locks };
}
