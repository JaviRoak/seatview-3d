/**
 * Modo estrés (?seats=N): genera N asientos sintéticos en el cliente con la
 * misma fórmula de contorno para medir el InstancedMesh sin depender de la BD.
 * NO son comprables; para datos reales existe `SEATS=20000 npm run db:seed`.
 */
import type { EventSeatsPayload, VenueLayout, Zone } from '../api/types';
import { arcTable, contourPoint } from './contour';
import { localPercentiles } from './seatInsights';

export function syntheticSeats(layout: VenueLayout, target: number, zones: Zone[], eventId: string): EventSeatsPayload {
  let scale = 1;
  let out: EventSeatsPayload = { eventId, count: 0, ids: [], seatIds: [], zoneIdx: [], rows: [], numbers: [], positions: [], rotations: [], status: [], lockedBy: {}, zones, viewPct: [], viewRange: { dMin: 0, dMax: 1 } };
  for (let iter = 0; iter < 12; iter++) {
    const ids: string[] = [], zoneIdx: number[] = [], rows: string[] = [], numbers: number[] = [], positions: number[] = [], rotations: number[] = [];
    let idx = 0;
    layout.levels.forEach((lvl, li) => {
      const rowsN = Math.max(2, Math.round(lvl.rows * scale));
      for (let si = 0; si < 4; si++) {
        const c = si * Math.PI / 2, t0 = c - Math.PI / 4 + layout.aisleAngle, t1 = c + Math.PI / 4 - layout.aisleAngle;
        for (let ri = 0; ri < rowsN; ri++) {
          const d = lvl.baseOffset + ri * lvl.rowDepth, y = lvl.baseHeight + ri * lvl.rowRise;
          const arc = arcTable(layout, t0, t1, d, 256);
          const count = Math.max(1, Math.floor(arc.length / layout.seatPitch));
          for (let n = 0; n < count; n++) {
            const p = contourPoint(layout, arc.tAt((n + 0.5) / count), d);
            ids.push(`syn-${idx++}`); zoneIdx.push((li * 4 + si) % Math.max(1, zones.length));
            rows.push(String.fromCharCode(65 + (ri % 26))); numbers.push(n + 1);
            positions.push(p.x, y, p.z); rotations.push(Math.atan2(-p.x, -p.z));
          }
        }
      }
    });
    out = { eventId, count: ids.length, ids, seatIds: ids, zoneIdx, rows, numbers, positions, rotations, status: new Array(ids.length).fill(0), lockedBy: {}, zones, ...localPercentiles(positions, ids.length, layout) };
    if (ids.length >= target) break;
    scale *= target / Math.max(1, ids.length) * 1.02;
  }
  return out;
}
