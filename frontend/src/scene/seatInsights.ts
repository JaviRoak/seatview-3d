/**
 * Calidad de vista y atributos del asiento (docs/calidad-vista.md).
 * El PERCENTIL viene del backend (calculado y cacheado por recinto); aquí solo
 * se reconstruye el desglose de factores con la misma fórmula para el tooltip.
 */
import type { VenueLayout, Zone } from '../api/types';
import type { SeatData } from '../store/seats';

export const WEIGHTS = { D: 0.45, A: 0.4, E: 0.15 } as const;
export type QualityLabel = 'Excelente' | 'Muy buena' | 'Buena' | 'Aceptable' | 'Limitada';

export interface ViewFactors { D: number; A: number; E: number; distance: number; angleDeg: number; elevationDeg: number; raw: number }
export interface ViewQuality extends ViewFactors { percentile: number; label: QualityLabel }

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function viewFactors(x: number, y: number, z: number, layout: Pick<VenueLayout, 'field'>, range: { dMin: number; dMax: number }): ViewFactors {
  const distance = Math.hypot(x, z);
  const D = clamp(1 - (distance - range.dMin) / Math.max(1, range.dMax - range.dMin));
  const angleDeg = (Math.atan2(Math.abs(x) / (layout.field.width / 2), Math.abs(z) / (layout.field.depth / 2)) * 180) / Math.PI;
  const A = 1 - angleDeg / 90;
  const elevationDeg = (Math.atan2(y, distance) * 180) / Math.PI;
  const E = elevationDeg < 6 ? clamp(0.35 + (0.65 * elevationDeg) / 6) : elevationDeg <= 30 ? 1 : clamp(1 - (elevationDeg - 30) / 40);
  return { D, A, E, distance, angleDeg, elevationDeg, raw: WEIGHTS.D * D + WEIGHTS.A * A + WEIGHTS.E * E };
}

export function labelFor(percentile: number): QualityLabel {
  return percentile >= 90 ? 'Excelente' : percentile >= 75 ? 'Muy buena' : percentile >= 55 ? 'Buena' : percentile >= 35 ? 'Aceptable' : 'Limitada';
}

/** Calidad de vista de un asiento del store (percentil del backend + desglose local). */
export function viewQuality(data: SeatData, idx: number, layout: VenueLayout): ViewQuality {
  const f = viewFactors(data.positions[idx * 3], data.positions[idx * 3 + 1], data.positions[idx * 3 + 2], layout, data.viewRange);
  const percentile = data.viewPct[idx] ?? 50;
  return { ...f, percentile, label: labelFor(percentile) };
}

/** Percentiles locales (solo modo estrés, donde no hay backend): misma regla que backend/src/lib/viewQuality.ts. */
export function localPercentiles(positions: number[], count: number, layout: Pick<VenueLayout, 'field'>): { viewPct: number[]; viewRange: { dMin: number; dMax: number } } {
  let dMin = Infinity, dMax = 0;
  for (let i = 0; i < count; i++) { const d = Math.hypot(positions[i * 3], positions[i * 3 + 2]); dMin = Math.min(dMin, d); dMax = Math.max(dMax, d); }
  const range = { dMin, dMax: Math.max(dMax, dMin + 1) };
  const raw = Array.from({ length: count }, (_, i) => viewFactors(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], layout, range).raw);
  const order = raw.map((_, i) => i).sort((a, b) => raw[a] - raw[b]);
  const viewPct = new Array<number>(count);
  order.forEach((idx, rank) => { viewPct[idx] = count > 1 ? Math.round((100 * rank) / (count - 1)) : 100; });
  return { viewPct, viewRange: range };
}

export interface SeatAttribute { icon: 'center' | 'exit' | 'front' | 'high' | 'aisle'; text: string }

/**
 * Atributos derivados (máximo 3):
 *  - "Vista central": θ ≤ 20°  · "Cerca de la salida": 3 primeros/últimos asientos de la fila
 *  - "Nivel 1 · más cerca del campo": zona del primer nivel · "Primera fila del nivel": fila A · "Vista elevada": elevación > 20°
 */
export function seatAttributes(data: SeatData, idx: number, layout: VenueLayout, quality: ViewFactors): SeatAttribute[] {
  const out: SeatAttribute[] = [];
  const zone: Zone | undefined = data.zones[data.zoneIdx[idx]];
  const n = data.numbers[idx];
  const rowLen = rowLength(data, idx);
  if (quality.angleDeg <= 20) out.push({ icon: 'center', text: 'Vista central' });
  if (n <= 3 || n > rowLen - 3) out.push({ icon: 'exit', text: 'Cerca de la salida' });
  if (zone?.name.includes(layout.levels[0].name)) out.push({ icon: 'front', text: `${layout.levels[0].name} · más cerca del campo` });
  if (out.length < 3 && data.rows[idx] === 'A') out.push({ icon: 'aisle', text: 'Primera fila del nivel' });
  if (out.length < 3 && quality.elevationDeg > 20) out.push({ icon: 'high', text: 'Vista elevada' });
  return out.slice(0, 3);
}

export function rowLength(data: SeatData, idx: number): number {
  const z = data.zoneIdx[idx], r = data.rows[idx];
  let a = idx, b = idx;
  while (a > 0 && data.zoneIdx[a - 1] === z && data.rows[a - 1] === r) a--;
  while (b < data.count - 1 && data.zoneIdx[b + 1] === z && data.rows[b + 1] === r) b++;
  return b - a + 1;
}
