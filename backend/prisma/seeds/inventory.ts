/**
 * Creación de un recinto con su evento e inventario en una sola transacción.
 * La usan el seed y los scripts de recintos (backend/scripts/create-*-event.ts).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaClient } from '../../src/generated/prisma/client';

export interface SeatRow { zone: number; row: string; number: number; x: number; y: number; z: number; rotY: number }
export interface ZoneSpec { name: string; color: string; price: number }
export interface VenueSeed {
  venue: { name: string; city: string; description: string; layout: object };
  zones: readonly ZoneSpec[];
  seats: SeatRow[];
  event: { id: string; name: string; description: string; date: Date; category: 'FUTBOL' | 'CONCIERTO' | 'OTRO'; coverImageUrl: string | null; featured: boolean };
}

const CHUNK = 2000;
const MODELS = resolve(__dirname, '../../../frontend/public/models');

/** Lee un JSON de frontend/public/models (modelos, posiciones y público). */
export const readModel = <T = any>(file: string): T => JSON.parse(readFileSync(resolve(MODELS, file), 'utf8'));

/** Falla si dos lugares comparten zona, fila y número o si alguna coordenada no es finita. */
export function assertUniqueSeats(seats: SeatRow[]) {
  const seen = new Set<string>();
  for (const s of seats) {
    const key = `${s.zone}/${s.row}/${s.number}`;
    if (seen.has(key) || ![s.x, s.y, s.z, s.rotY].every(Number.isFinite)) throw new Error(`Asiento inválido ${key}`);
    seen.add(key);
  }
}

/** Agrega `count` cupos sin ubicación (fila "GA") a una zona. */
export function generalAdmission(zone: number, count: number): SeatRow[] {
  return Array.from({ length: count }, (_, i) => ({ zone, row: 'GA', number: i + 1, x: 0, y: 0, z: 0, rotY: 0 }));
}

export async function createVenueWithEvent(prisma: PrismaClient, def: VenueSeed) {
  return prisma.$transaction(async (tx) => {
    const venue = await tx.venue.create({ data: def.venue });
    const zoneIds: string[] = [];
    for (let i = 0; i < def.zones.length; i++) {
      const { name, color, price } = def.zones[i];
      zoneIds.push((await tx.zone.create({ data: { venueId: venue.id, name, color, price, sortIdx: i } })).id);
    }
    for (let i = 0; i < def.seats.length; i += CHUNK) {
      await tx.seat.createMany({
        data: def.seats.slice(i, i + CHUNK).map((s, k) => ({
          venueId: venue.id, zoneId: zoneIds[s.zone], idx: i + k, row: s.row, number: s.number, posX: s.x, posY: s.y, posZ: s.z, rotY: s.rotY,
        })),
      });
    }
    const event = await tx.event.create({ data: { ...def.event, venueId: venue.id } });
    const seatIds = await tx.seat.findMany({ where: { venueId: venue.id }, select: { id: true }, orderBy: { idx: 'asc' } });
    for (let i = 0; i < seatIds.length; i += CHUNK) {
      await tx.eventSeat.createMany({ data: seatIds.slice(i, i + CHUNK).map((s) => ({ eventId: event.id, seatId: s.id })) });
    }
    return { venueId: venue.id, eventId: event.id, seats: seatIds.length };
  }, { timeout: 120_000 });
}
