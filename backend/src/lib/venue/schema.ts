/**
 * Formato de definición de recinto (docs/agregar-recinto.md, Ruta B).
 * Validado con Zod; los mensajes están en español y señalan el campo exacto.
 */
import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color en formato #RRGGBB');

export const levelSchema = z.object({
  name: z.string().min(1),
  rows: z.number().int().min(1).max(200),
  rowDepth: z.number().positive().max(5),
  rowRise: z.number().min(0).max(3),
  baseHeight: z.number().min(0).max(100),
  baseOffset: z.number().min(0).max(200),
});

export const layoutSchema = z.object({
  concert: z.object({ kind: z.enum(['beele', 'bocelli']), demo: z.boolean() }).optional(),
  admission: z.object({ mode: z.literal('mixed'), crowdUrl: z.string().regex(/^\/models\/[a-zA-Z0-9_-]+\.json$/) }).optional(),
  model: z.object({
    url: z.string().regex(/^\/models\/[a-zA-Z0-9_/-]+\.glb$/, 'modelo GLB dentro de /models/'),
    radius: z.number().positive().max(1000), height: z.number().positive().max(300),
    seatingFootprint: z.object({ width: z.number().positive().max(1000), depth: z.number().positive().max(1000) }),
  }).optional(),
  field: z.object({ width: z.number().positive().max(500), depth: z.number().positive().max(500) }),
  corner: z.number().min(0).max(1).default(0.25),
  seatPitch: z.number().min(0.4).max(2).default(0.8),
  aisleAngle: z.number().min(0).max(0.6).default(0.2),
  stands: z.array(z.string().min(1)).length(4).default(['Tribuna Este', 'Tribuna Norte', 'Tribuna Oeste', 'Tribuna Sur']),
  levels: z.array(levelSchema).min(1).max(6),
});

export const zoneSchema = z.object({
  key: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  color: hex,
  price: z.number().nonnegative(),
  /** Solo para asientos generados: tribuna (0..3) y nivel (índice en layout.levels) que cubre esta zona */
  standIdx: z.number().int().min(0).max(3).optional(),
  levelIdx: z.number().int().min(0).optional(),
});

export const seatSchema = z.object({
  zone: z.string().min(1),
  row: z.string().min(1).max(4),
  number: z.number().int().min(1),
  x: z.number(), y: z.number(), z: z.number(),
  /** rotación en Y (rad); si falta, el asiento mira al centro (0,0,0) */
  rotY: z.number().optional(),
});

export const eventSchema = z.object({
  name: z.string().min(1).max(120),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, 'fecha ISO (YYYY-MM-DD o YYYY-MM-DDTHH:mm)')),
  description: z.string().max(500).optional(),
  category: z.enum(['FUTBOL', 'CONCIERTO', 'OTRO']).default('OTRO'),
});

export const venueDefinitionSchema = z.object({
  venue: z.object({ name: z.string().min(1).max(120), city: z.string().min(1).max(80), description: z.string().max(500).optional() }),
  layout: layoutSchema,
  zones: z.array(zoneSchema).min(1),
  /** Si se omite, los asientos se generan proceduralmente desde `layout` y las zonas deben traer standIdx/levelIdx. */
  seats: z.array(seatSchema).optional(),
  events: z.array(eventSchema).default([]),
}).superRefine((v, ctx) => {
  if (v.layout.model && !v.seats?.length) ctx.addIssue({ code: 'custom', path: ['seats'], message: 'un modelo externo necesita asientos explícitos alineados con su geometría' });
  const keys = new Set<string>();
  v.zones.forEach((z, i) => { if (keys.has(z.key)) ctx.addIssue({ code: 'custom', path: ['zones', i, 'key'], message: `zona duplicada "${z.key}"` }); keys.add(z.key); });
  if (v.seats) {
    const seen = new Set<string>();
    v.seats.forEach((s, i) => {
      if (!keys.has(s.zone)) ctx.addIssue({ code: 'custom', path: ['seats', i, 'zone'], message: `la zona "${s.zone}" no existe en "zones"` });
      const k = `${s.zone}|${s.row}|${s.number}`;
      if (seen.has(k)) ctx.addIssue({ code: 'custom', path: ['seats', i], message: `asiento duplicado: zona ${s.zone}, fila ${s.row}, número ${s.number}` });
      seen.add(k);
    });
  } else {
    v.zones.forEach((z, i) => {
      if (z.standIdx === undefined || z.levelIdx === undefined) ctx.addIssue({ code: 'custom', path: ['zones', i], message: 'sin "seats" explícitos cada zona necesita standIdx (0..3) y levelIdx' });
      else if (z.levelIdx >= v.layout.levels.length) ctx.addIssue({ code: 'custom', path: ['zones', i, 'levelIdx'], message: `levelIdx ${z.levelIdx} fuera de rango (hay ${v.layout.levels.length} niveles)` });
    });
    for (let si = 0; si < 4; si++) for (let li = 0; li < v.layout.levels.length; li++) {
      if (!v.zones.some((z) => z.standIdx === si && z.levelIdx === li)) ctx.addIssue({ code: 'custom', path: ['zones'], message: `falta una zona para la tribuna ${si} en el nivel ${li}` });
    }
  }
});

export type VenueDefinition = z.infer<typeof venueDefinitionSchema>;
