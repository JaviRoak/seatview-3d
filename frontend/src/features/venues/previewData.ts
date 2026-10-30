import type { EventSeatsPayload, VenueLayout } from '../../api/types';

export interface VenueDefinition {
  venue: { name: string; city: string; description?: string };
  layout: VenueLayout;
  zones: Array<{ key: string; name: string; color: string; price: number }>;
  seats: Array<{ zone: string; row: string; number: number; x: number; y: number; z: number; rotY: number }>;
}

/** Preview IDs are deliberately separate from database event/seat IDs. */
export function previewPayload(def: VenueDefinition): EventSeatsPayload {
  const count = def.seats.length;
  const indices = new Map(def.zones.map((z, i) => [z.key, i]));
  const ids = def.seats.map((_, i) => `preview-cuscatlan-${i}`);
  const zoneIdx = def.seats.map((s) => {
    const index = indices.get(s.zone);
    if (index === undefined) throw new Error(`Zona desconocida: ${s.zone}`);
    return index;
  });
  return {
    eventId: 'preview-cuscatlan', count, ids, seatIds: ids, zoneIdx,
    rows: def.seats.map((s) => s.row), numbers: def.seats.map((s) => s.number),
    positions: def.seats.flatMap((s) => [s.x, s.y, s.z]), rotations: def.seats.map((s) => s.rotY),
    status: new Array(count).fill(0), lockedBy: {},
    zones: def.zones.map((z) => ({ id: z.key, name: z.name, color: z.color, price: z.price })),
    viewPct: new Array(count).fill(50), viewRange: { dMin: 0, dMax: 200 },
  };
}
