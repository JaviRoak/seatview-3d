/**
 * Consulta de asientos y disponibilidad (issue #6).
 * El servidor es la fuente de verdad: combina el estado persistente
 * (PostgreSQL: AVAILABLE/SOLD) con los bloqueos efímeros (Redis).
 */
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';
import { getLocksForEvent } from '../locks/locks.service';
import { cachedViewQuality, distanceRange } from '../../lib/viewQuality';
import type { VenueLayout } from '../../lib/layout';

export type SeatStatus = 'AVAILABLE' | 'LOCKED' | 'SOLD';
export const STATUS_CODE: Record<SeatStatus, number> = { AVAILABLE: 0, LOCKED: 1, SOLD: 2 };

export interface EventSeatsPayload {
  eventId: string;
  count: number;
  /** ids de EventSeat, en orden de idx */
  ids: string[];
  seatIds: string[];
  zoneIdx: number[];
  rows: string[];
  numbers: number[];
  /** posiciones intercaladas x,y,z */
  positions: number[];
  rotations: number[];
  /** 0 = AVAILABLE, 1 = LOCKED, 2 = SOLD */
  status: number[];
  /** userId dueño del bloqueo por índice (solo donde status = 1) */
  lockedBy: Record<number, string>;
  /** percentil de calidad de vista 0..100 dentro del recinto (docs/calidad-vista.md) */
  viewPct: number[];
  /** rango de distancias usado para normalizar D (el cliente lo necesita para el desglose) */
  viewRange: { dMin: number; dMax: number };
  zones: Array<{ id: string; name: string; color: string; price: number; generalAdmission?: boolean; capacity?: number }>;
}

export async function getEventSeats(eventId: string): Promise<EventSeatsPayload> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, venueId: true, venue: { select: { layout: true } } } });
  if (!event) throw notFound('Evento no encontrado');
  const zones = await prisma.zone.findMany({ where: { venueId: event.venueId }, orderBy: { sortIdx: 'asc' } });
  const zoneIndex = new Map(zones.map((z, i) => [z.id, i]));
  const rows = await prisma.eventSeat.findMany({
    where: { eventId },
    select: { id: true, status: true, seat: { select: { id: true, idx: true, zoneId: true, row: true, number: true, posX: true, posY: true, posZ: true, rotY: true } } },
    orderBy: { seat: { idx: 'asc' } },
  });
  const locks = await getLocksForEvent(eventId);
  const n = rows.length;
  const payload: EventSeatsPayload = {
    eventId, count: n, ids: new Array(n), seatIds: new Array(n), zoneIdx: new Array(n), rows: new Array(n), numbers: new Array(n),
    positions: new Array(n * 3), rotations: new Array(n), status: new Array(n), lockedBy: {}, viewPct: new Array(n), viewRange: { dMin: 0, dMax: 1 },
    zones: zones.map((z) => ({ id: z.id, name: z.name, color: z.color, price: Number(z.price), generalAdmission: rows.some(r => r.seat.zoneId === z.id && r.seat.row === 'GA'), capacity: rows.filter(r => r.seat.zoneId === z.id).length })),
  };
  rows.forEach((r, i) => {
    payload.ids[i] = r.id;
    payload.seatIds[i] = r.seat.id;
    payload.zoneIdx[i] = zoneIndex.get(r.seat.zoneId) ?? 0;
    payload.rows[i] = r.seat.row;
    payload.numbers[i] = r.seat.number;
    payload.positions[i * 3] = r.seat.posX;
    payload.positions[i * 3 + 1] = r.seat.posY;
    payload.positions[i * 3 + 2] = r.seat.posZ;
    payload.rotations[i] = r.seat.rotY;
    const owner = locks.get(r.id);
    if (r.status === 'SOLD') payload.status[i] = STATUS_CODE.SOLD;
    else if (owner) { payload.status[i] = STATUS_CODE.LOCKED; payload.lockedBy[i] = owner; }
    else payload.status[i] = STATUS_CODE.AVAILABLE;
  });
  // Calidad de vista: percentil por recinto (cacheado por venueId).
  const layout = event.venue.layout as unknown as VenueLayout;
  const vq = cachedViewQuality(event.venueId, payload.positions, n, layout);
  for (let i = 0; i < n; i++) payload.viewPct[i] = vq.percentile[i];
  payload.viewRange = distanceRange(payload.positions, n);
  return payload;
}
