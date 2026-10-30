/** Ruta B: validación Zod e importación real de un recinto desde JSON. */
import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateVenueDefinition, importVenue } from '../src/lib/venue/import';
import { prisma } from '../src/lib/prisma';

const created: string[] = [];
afterAll(async () => { for (const id of created) await prisma.venue.delete({ where: { id } }).catch(() => undefined); });

const load = (f: string) => JSON.parse(readFileSync(resolve(__dirname, '../../docs/ejemplos', f), 'utf8'));

describe('importador de recintos', () => {
  it('rechaza definiciones inválidas con mensajes claros y rutas de campo', () => {
    const bad = load('mini-arena.json');
    bad.zones[0].color = 'verde';
    bad.seats[1].zone = 'inexistente';
    bad.seats[2] = { ...bad.seats[0] }; // duplicado
    const r = validateVenueDefinition(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.startsWith('zones[0].color'))).toBe(true);
      expect(r.errors.some((e) => e.includes('seats[1].zone') && e.includes('no existe'))).toBe(true);
      expect(r.errors.some((e) => e.includes('duplicado'))).toBe(true);
    }
    const noZones = load('estadio-generado.json');
    noZones.zones = noZones.zones.slice(0, 7);
    const r2 = validateVenueDefinition(noZones);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors.some((e) => e.includes('falta una zona'))).toBe(true);
  });

  it('importa asientos explícitos (mini-arena) y crea evento con EventSeat por asiento', async () => {
    const r = validateVenueDefinition(load('mini-arena.json'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rep = await importVenue(r.value);
    created.push(rep.venueId);
    expect(rep.seats).toBe(22);
    expect(rep.zones).toBe(2);
    expect(rep.events).toBe(1);
    expect(await prisma.seat.count({ where: { venueId: rep.venueId } })).toBe(22);
    const ev = await prisma.event.findFirstOrThrow({ where: { venueId: rep.venueId } });
    expect(await prisma.eventSeat.count({ where: { eventId: ev.id } })).toBe(22);
    const s = await prisma.seat.findFirstOrThrow({ where: { venueId: rep.venueId, idx: 0 } });
    expect(Math.abs(s.rotY - Math.atan2(4, 10))).toBeLessThan(1e-6); // mira al centro
  });

  it('importa un estadio generado desde layout (zonas por tribuna y nivel)', async () => {
    const r = validateVenueDefinition(load('estadio-generado.json'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rep = await importVenue(r.value);
    created.push(rep.venueId);
    expect(rep.seats).toBeGreaterThan(1000);
    expect(rep.warnings).toEqual([]);
    const venue = await prisma.venue.findUniqueOrThrow({ where: { id: rep.venueId } });
    const layout = venue.layout as { levels: Array<{ baseHeight: number; baseOffset: number }> };
    expect(layout.levels[1].baseHeight).toBeGreaterThan(layout.levels[0].baseHeight); // stack() apiló el nivel 2
  });
});
