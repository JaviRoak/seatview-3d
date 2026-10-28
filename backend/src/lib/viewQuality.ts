/**
 * Calidad de vista de un asiento (docs/calidad-vista.md).
 *
 *   raw = 0.45·D + 0.40·A + 0.15·E            (0..1)
 *   D  cercanía al campo      (1 en la primera fila, 0 en la más lejana del recinto)
 *   A  alineación con el eje  (1 frente al centro del campo, 0 detrás de la portería)
 *   E  ángulo de visión útil  (1 entre 6° y 30° de elevación; baja a ras del césped y muy alto)
 *
 * El puntaje que ve el usuario es el PERCENTIL de `raw` dentro del propio
 * recinto (0..100), calculado una vez por recinto y cacheado: así siempre hay
 * asientos de 0 y de 100 y las etiquetas significan lo mismo en cualquier recinto.
 */
import type { VenueLayout } from './layout';

export interface ViewFactors { D: number; A: number; E: number; distance: number; angleDeg: number; elevationDeg: number; raw: number }

export const WEIGHTS = { D: 0.45, A: 0.4, E: 0.15 } as const;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** Distancias mínima y máxima al centro entre todos los asientos (para normalizar D). */
export function distanceRange(positions: ArrayLike<number>, count: number): { dMin: number; dMax: number } {
  let dMin = Infinity, dMax = 0;
  for (let i = 0; i < count; i++) {
    const d = Math.hypot(positions[i * 3], positions[i * 3 + 2]);
    if (d < dMin) dMin = d;
    if (d > dMax) dMax = d;
  }
  return { dMin, dMax: Math.max(dMax, dMin + 1) };
}

export function viewFactors(x: number, y: number, z: number, layout: Pick<VenueLayout, 'field'>, range: { dMin: number; dMax: number }): ViewFactors {
  const distance = Math.hypot(x, z);
  const D = clamp(1 - (distance - range.dMin) / (range.dMax - range.dMin));
  // θ = 0° cuando el asiento está sobre el eje corto (frente al centro), 90° detrás de la portería.
  const angleDeg = (Math.atan2(Math.abs(x) / (layout.field.width / 2), Math.abs(z) / (layout.field.depth / 2)) * 180) / Math.PI;
  const A = 1 - angleDeg / 90;
  const elevationDeg = (Math.atan2(y, distance) * 180) / Math.PI;
  const E = elevationDeg < 6 ? clamp(0.35 + (0.65 * elevationDeg) / 6) : elevationDeg <= 30 ? 1 : clamp(1 - (elevationDeg - 30) / 40);
  const raw = WEIGHTS.D * D + WEIGHTS.A * A + WEIGHTS.E * E;
  return { D, A, E, distance, angleDeg, elevationDeg, raw };
}

export function labelFor(percentile: number): 'Excelente' | 'Muy buena' | 'Buena' | 'Aceptable' | 'Limitada' {
  return percentile >= 90 ? 'Excelente' : percentile >= 75 ? 'Muy buena' : percentile >= 55 ? 'Buena' : percentile >= 35 ? 'Aceptable' : 'Limitada';
}

/**
 * Percentil (0..100) de cada asiento: porcentaje de asientos del recinto con
 * raw estrictamente menor. Devuelve también raw para el desglose.
 */
export function computeViewQuality(positions: ArrayLike<number>, count: number, layout: Pick<VenueLayout, 'field'>): { raw: Float32Array; percentile: Uint8Array } {
  const range = distanceRange(positions, count);
  const raw = new Float32Array(count);
  for (let i = 0; i < count; i++) raw[i] = viewFactors(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], layout, range).raw;
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => raw[a] - raw[b]);
  const percentile = new Uint8Array(count);
  let i = 0;
  while (i < count) {
    let j = i;
    while (j + 1 < count && raw[order[j + 1]] === raw[order[i]]) j++; // empates comparten percentil
    const p = count > 1 ? Math.round((100 * i) / (count - 1)) : 100;
    for (let k = i; k <= j; k++) percentile[order[k]] = p;
    i = j + 1;
  }
  return { raw, percentile };
}

/** Caché por recinto: las posiciones no cambian salvo reseed/import (se invalida por venueId + count). */
const cache = new Map<string, { count: number; raw: Float32Array; percentile: Uint8Array }>();
export function cachedViewQuality(venueId: string, positions: ArrayLike<number>, count: number, layout: Pick<VenueLayout, 'field'>) {
  const hit = cache.get(venueId);
  if (hit && hit.count === count) return hit;
  const res = { count, ...computeViewQuality(positions, count, layout) };
  cache.set(venueId, res);
  return res;
}
export const clearViewQualityCache = () => cache.clear();
