/**
 * Importación de un recinto desde JSON (Ruta B de docs/agregar-recinto.md).
 * Crea Venue, Zone, Seat, Event y EventSeat en una transacción.
 */
import { prisma } from '../prisma';
import { venueDefinitionSchema, type VenueDefinition } from './schema';
import { generateSeats, stack, type VenueLayout } from '../layout';
import { clearViewQualityCache } from '../viewQuality';

export interface ImportReport { venueId: string; zones: number; seats: number; events: number; warnings: string[] }

/** Formatea errores de Zod como lista legible: "seats[3].zone: la zona "x" no existe". */
export function formatIssues(err: { issues: Array<{ path: (string | number)[]; message: string }> }): string[] {
  return err.issues.map((i) => `${i.path.map((p, k) => (typeof p === 'number' ? `[${p}]` : k ? `.${p}` : p)).join('') || '(raíz)'}: ${i.message}`);
}

export function validateVenueDefinition(input: unknown): { ok: true; value: VenueDefinition } | { ok: false; errors: string[] } {
  const r = venueDefinitionSchema.safeParse(input);
  return r.success ? { ok: true, value: r.data } : { ok: false, errors: formatIssues(r.error) };
}

export async function importVenue(def: VenueDefinition): Promise<ImportReport> {
  const warnings: string[] = [];
  const layout: VenueLayout = def.seats ? def.layout : stack(def.layout);

  // Asientos: explícitos o generados.
  type Row = { zoneKey: string; row: string; number: number; x: number; y: number; z: number; rotY: number };
  let rows: Row[];
  if (def.seats) {
    rows = def.seats.map((s) => ({ zoneKey: s.zone, row: s.row, number: s.number, x: s.x, y: s.y, z: s.z, rotY: s.rotY ?? Math.atan2(-s.x, -s.z) }));
  } else {
    const gen = generateSeats(layout);
    const zoneByCell = new Map(def.zones.map((z) => [`${z.standIdx}-${z.levelIdx}`, z.key]));
    rows = gen.map((s) => ({ zoneKey: zoneByCell.get(`${s.standIdx}-${s.levelIdx}`)!, row: s.row, number: s.number, x: s.x, y: s.y, z: s.z, rotY: s.rotY }));
  }
  if (rows.length === 0) throw new Error('El recinto no tiene asientos');

  // Advertencias: asientos dentro del campo o demasiado juntos.
  const hw = layout.field.width / 2, hd = layout.field.depth / 2;
  const inside = rows.filter((r) => Math.abs(r.x) < hw && Math.abs(r.z) < hd).length;
  if (inside) warnings.push(`${inside} asiento(s) están dentro del rectángulo del campo`);
  let tooClose = 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (a.zoneKey === b.zoneKey && a.row === b.row && Math.hypot(a.x - b.x, a.z - b.z, a.y - b.y) < 0.45) tooClose++;
  }
  if (tooClose) warnings.push(`${tooClose} par(es) de asientos consecutivos a menos de 0,45 m (se solapan)`);

  const result = await prisma.$transaction(async (tx) => {
    const venue = await tx.venue.create({ data: { name: def.venue.name, city: def.venue.city, description: def.venue.description, layout: layout as object } });
    const zoneIds = new Map<string, string>();
    for (let i = 0; i < def.zones.length; i++) {
      const z = def.zones[i];
      const created = await tx.zone.create({ data: { venueId: venue.id, name: z.name, color: z.color, price: z.price, sortIdx: i } });
      zoneIds.set(z.key, created.id);
    }
    const CHUNK = 2000;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await tx.seat.createMany({
        data: rows.slice(i, i + CHUNK).map((r, k) => ({ venueId: venue.id, zoneId: zoneIds.get(r.zoneKey)!, idx: i + k, row: r.row, number: r.number, posX: r.x, posY: r.y, posZ: r.z, rotY: r.rotY })),
      });
    }
    const seatIds = await tx.seat.findMany({ where: { venueId: venue.id }, select: { id: true }, orderBy: { idx: 'asc' } });
    for (const ev of def.events) {
      const created = await tx.event.create({ data: { venueId: venue.id, name: ev.name, description: ev.description, date: new Date(ev.date), category: ev.category } });
      for (let i = 0; i < seatIds.length; i += CHUNK) {
        await tx.eventSeat.createMany({ data: seatIds.slice(i, i + CHUNK).map((s) => ({ eventId: created.id, seatId: s.id })) });
      }
    }
    return venue;
  }, { timeout: 120_000 });

  clearViewQualityCache();
  return { venueId: result.id, zones: def.zones.length, seats: rows.length, events: def.events.length, warnings };
}
