/**
 * Andrea Bocelli en el Estadio Mágico González: plano provisional basado en el de
 * Maná, con bloques numerados en cancha y gradas por zona. Precios, numeración y
 * cupos de prueba, no oficiales.
 */
import type { PrismaClient } from '../../src/generated/prisma/client';
import { layoutSchema } from '../../src/lib/venue/schema';
import { BOCELLI_REFERENCE, BOCELLI_SOURCE, BOCELLI_TARGET, BOCELLI_ZONES, bocelliSeats } from '../../../frontend/src/scene/bocelliLayout';
import { assertUniqueSeats, createVenueWithEvent, generalAdmission, readModel, type SeatRow } from './inventory';

export const BOCELLI_EVENT_ID = 'andrea-bocelli-magico-2026';
// Póster guardado en el repo, sin enlaces a servidores ajenos (docs/adr/0001).
const COVER = '/models/bocelli-event.jpg';

export function buildBocelli() {
  const stadium = readModel('magico-seating.json');
  const seats: SeatRow[] = bocelliSeats();
  const points: number[][] = seats.map((s) => [s.x, s.y, s.z, s.rotY, s.zone]);
  for (const [x, y, z, zone] of stadium.points as number[][]) points.push([x, y, z, Math.atan2(BOCELLI_TARGET[0] - x, BOCELLI_TARGET[2] - z), zone]);
  const capacities = BOCELLI_ZONES.map((_, i) => points.filter((p) => p[4] === i).length);
  for (let zone = 12; zone < 15; zone++) seats.push(...generalAdmission(zone, capacities[zone]));
  assertUniqueSeats(seats);
  const layout = layoutSchema.parse({ ...stadium.layout, admission: { mode: 'mixed', crowdUrl: '/models/bocelli-crowd.json' }, concert: { kind: 'bocelli', demo: true } });
  const zones = BOCELLI_ZONES.map((z, i) => ({ ...z, capacity: capacities[i] }));
  return { layout, seats, crowd: { sectors: zones, points }, report: { source: BOCELLI_SOURCE, layoutReference: BOCELLI_REFERENCE, zones } };
}

export async function seedBocelli(prisma: PrismaClient) {
  const { layout, seats } = buildBocelli();
  return createVenueWithEvent(prisma, {
    venue: { name: 'Estadio Jorge “Mágico” González', city: 'San Salvador', description: 'Modelo low poly v5. Plano de concierto provisional basado en Maná; cupos y precios de prueba.', layout },
    zones: BOCELLI_ZONES,
    seats,
    event: {
      id: BOCELLI_EVENT_ID, name: 'Andrea Bocelli · Romanza World Tour', category: 'CONCIERTO', date: new Date('2026-12-06T02:00:00Z'),
      description: '5 de diciembre de 2026 · 8:00 p. m. · El Salvador. Demo: plano provisional basado en Maná; precios, numeración y cupos de prueba, no oficiales.',
      coverImageUrl: COVER, featured: true,
    },
  });
}
