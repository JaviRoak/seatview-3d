/**
 * Estadio Cuscatlán en configuración de fútbol (Final Nacional): modelo V5,
 * 49.500 cupos en 8 zonas. Platea (3.000) es numerada sobre las posiciones del
 * modelo; el resto se vende por zona, sin asiento asignado (fila "GA").
 * Cupos ilustrativos, no un inventario oficial.
 */
import type { PrismaClient } from '../../src/generated/prisma/client';
import { venueDefinitionSchema } from '../../src/lib/venue/schema';
import { assertUniqueSeats, createVenueWithEvent, readModel, type SeatRow } from './inventory';

export const FINAL_EVENT_ID = 'final-nacional-2026';

const ZONES = [
  { name: 'Sol General', capacity: 18000, color: '#61cadd', price: 67.5 },
  { name: 'Sol Preferente Sur', capacity: 7800, color: '#48b6cf', price: 45 },
  { name: 'Sol Preferente Norte', capacity: 5200, color: '#80cfba', price: 45 },
  { name: 'Sombra Norte', capacity: 5000, color: '#57a9b8', price: 37.5 },
  { name: 'Sombra Sur', capacity: 4000, color: '#679cc8', price: 37.5 },
  { name: 'Tribuna Sur', capacity: 4000, color: '#8cafdf', price: 37.5 },
  { name: 'Platea', capacity: 3000, color: '#a1d9ec', price: 67.5 },
  { name: 'Tribuna Norte', capacity: 2500, color: '#91b9ca', price: 37.5 },
] as const;
const PLATEA = 6;

/** Sector aproximado de una posición del modelo (no es un plano oficial). */
function sector(x: number, z: number, row: number) {
  if (x > 0 && Math.abs(z) < Math.abs(x) * 1.5) return 0;
  if (Math.abs(z) >= Math.abs(x) * 1.5) return z > 0 ? 1 : 2;
  if (row <= 22) return PLATEA;
  return row <= 31 ? (z < 0 ? 3 : 4) : (z < 0 ? 7 : 5);
}

export function buildCuscatlan() {
  const def = venueDefinitionSchema.parse(readModel('cuscatlan.venue.json'));
  const samples = def.seats!.map((s) => ({ ...s, rotY: s.rotY ?? 0, sector: sector(s.x, s.z, Number(s.row)) }));
  // Cada butaca del modelo en Platea se divide en dos lugares para llegar a 3.000.
  const platea = samples.filter((s) => s.sector === PLATEA).flatMap((s) => [-0.24, 0.24].map((offset) => ({ ...s, x: s.x + Math.cos(s.rotY) * offset, z: s.z - Math.sin(s.rotY) * offset })));
  if (platea.length < ZONES[PLATEA].capacity) throw new Error('Faltan posiciones para Platea');

  const seats: SeatRow[] = [];
  ZONES.forEach((zone, zi) => {
    const numbering = new Map<string, number>();
    for (let n = 0; n < zone.capacity; n++) {
      const s = zi === PLATEA ? platea[Math.floor((n * platea.length) / zone.capacity)] : null;
      const row = s?.row ?? 'GA';
      const number = (numbering.get(row) ?? 0) + 1;
      numbering.set(row, number);
      seats.push({ zone: zi, row, number, x: s?.x ?? 0, y: s?.y ?? 0, z: s?.z ?? 0, rotY: s?.rotY ?? 0 });
    }
  });
  assertUniqueSeats(seats);
  const crowd = { sectors: ZONES.map((z) => ({ name: z.name, capacity: z.capacity })), points: samples.filter((s) => s.sector !== PLATEA).map((s) => [s.x, s.y, s.z, s.rotY, s.sector]) };
  const layout = { ...def.layout, admission: { mode: 'mixed' as const, crowdUrl: '/models/cuscatlan-crowd.json' } };
  return { layout, seats, crowd };
}

export async function seedCuscatlan(prisma: PrismaClient) {
  const { layout, seats } = buildCuscatlan();
  return createVenueWithEvent(prisma, {
    venue: { name: 'Estadio Cuscatlán', city: 'San Salvador', description: 'Venta por zonas; Platea numerada. Cupos y límites ilustrativos configurables.', layout },
    zones: ZONES,
    seats,
    event: {
      id: FINAL_EVENT_ID, name: 'Final Nacional de Fútbol', category: 'FUTBOL', date: new Date('2026-11-16T01:00:00Z'),
      description: 'Gran final del campeonato. Elige tu zona y explora la vista; Platea con lugares numerados.',
      coverImageUrl: '/models/cuscatlan-event.png', featured: true,
    },
  });
}
