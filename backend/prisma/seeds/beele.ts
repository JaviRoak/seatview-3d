/**
 * Beéle en el Estadio Cuscatlán (modelo de concierto): 4.820 sillas numeradas en
 * cancha según el plano público (scripts/data/beele-map.json) y 9.500 cupos de
 * prueba en gradas. Las capacidades de gradas son de demostración.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { layoutSchema } from '../../src/lib/venue/schema';
import { BEELE_ZONES, beelePoint, beeleSector } from '../../../frontend/src/scene/beeleLayout';
import { assertUniqueSeats, createVenueWithEvent, generalAdmission, readModel, type SeatRow } from './inventory';

export const BEELE_EVENT_ID = 'beele-cuscatlan-2026';
const CAPACITIES = [1980, 1400, 1440, 0, 0, 0, 0, 2500, 3000, 4000];

interface MapSeat { section: string; zone: string; row: string | number; number: string | number; x: number; y: number }

export function buildBeele() {
  const reference: { seats: MapSeat[] } = JSON.parse(readFileSync(resolve(__dirname, '../../scripts/data/beele-map.json'), 'utf8'));
  const stadium = readModel('cuscatlan.venue.json');
  const seats: SeatRow[] = [], tables: { x: number; z: number; zone: number }[] = [], grouped = new Map<string, MapSeat[]>();
  for (const s of reference.seats) grouped.set(s.section, [...(grouped.get(s.section) ?? []), s]);
  for (const [section, group] of grouped) {
    const zone = BEELE_ZONES.findIndex((z) => z.name === group[0].zone);
    // El SVG de origen omite un cy (Platinum, mesa 60, silla 8): se interpola entre sus vecinas.
    for (const s of group) if (!s.y) {
      const a = group.find((t) => Number(t.number) === Number(s.number) - 1), b = group.find((t) => Number(t.number) === Number(s.number) + 1);
      if (!a?.y || !b?.y) throw new Error('Coordenada faltante sin vecinos');
      s.y = (a.y + b.y) / 2;
    }
    if (section.includes('Mesa')) {
      const p = beelePoint(group.reduce((n, s) => n + s.x, 0) / group.length, group.reduce((n, s) => n + s.y, 0) / group.length);
      tables.push({ x: p[0], z: p[2], zone });
    }
    if (zone < 0) continue; // El Palco Cosmo es solo visual.
    for (const s of group) {
      const p = beelePoint(s.x, s.y), table = section.match(/Mesa (\d+)/)?.[1], block = section.match(/Bloque ([A-F])/)?.[1];
      if (p.some((v) => !Number.isFinite(v)) || Math.abs(p[0]) > 35 || Math.abs(p[2]) > 56) throw new Error('Posición de cancha fuera de límites');
      seats.push({ zone, row: table ? `M${table.padStart(3, '0')}` : `${block}${String(s.row).padStart(2, '0')}`, number: Number(s.number), x: p[0], y: p[1], z: p[2], rotY: Math.PI / 2 });
    }
  }
  if (seats.length !== 4820) throw new Error(`Se esperaban 4820 sillas, hay ${seats.length}`);
  for (const zi of [7, 8, 9]) seats.push(...generalAdmission(zi, CAPACITIES[zi]));
  assertUniqueSeats(seats);
  // Público ilustrativo solo en gradas: las sillas de cancha se dibujan como asientos numerados.
  const points = stadium.seats.filter((s: any) => [7, 8, 9].includes(beeleSector(s.x, s.z))).map((s: any) => [s.x, s.y, s.z, Math.atan2(39 - s.x, -s.z), beeleSector(s.x, s.z)]);
  const layout = layoutSchema.parse({ ...stadium.layout, model: { ...stadium.layout.model, url: '/models/cuscatlan-concert.glb' }, admission: { mode: 'mixed', crowdUrl: '/models/beele-crowd.json' }, concert: { kind: 'beele', demo: true } });
  const crowd = { sectors: BEELE_ZONES.map((z, i) => ({ name: z.name, capacity: CAPACITIES[i] })), points, tables };
  return { layout, seats, crowd };
}

export async function seedBeele(prisma: PrismaClient) {
  const { layout, seats } = buildBeele();
  return createVenueWithEvent(prisma, {
    venue: { name: 'Estadio Cuscatlán', city: 'San Salvador', description: 'Configuración Beéle: cancha según plano público, gradas con cupos de prueba.', layout },
    zones: BEELE_ZONES,
    seats,
    event: {
      id: BEELE_EVENT_ID, name: 'Beéle', category: 'CONCIERTO', date: new Date('2026-12-11T03:00:00Z'),
      description: '10 de diciembre · Escenario, mesas y VIP en cancha. Vista 3D de demostración con cupos de prueba en gradas.',
      coverImageUrl: '/models/beele-event.png', featured: true,
    },
  });
}
