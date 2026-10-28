/**
 * Contorno procedural del recinto (issue #5). Misma fórmula que el backend
 * (superelipse alrededor del campo) para que las gradas coincidan con las
 * posiciones que envía la API. Geometría propia, sin código de terceros.
 */
import type { VenueLayout } from '../api/types';

export function contourPoint(layout: VenueLayout, t: number, d: number): { x: number; z: number } {
  const footprint = layout.model?.seatingFootprint ?? layout.field;
  const a = footprint.width / 2 + d, b = footprint.depth / 2 + d;
  const n = 2 + (1 - layout.corner) * 5;
  const c = Math.cos(t), s = Math.sin(t);
  return { x: Math.sign(c) * a * Math.pow(Math.abs(c), 2 / n), z: Math.sign(s) * b * Math.pow(Math.abs(s), 2 / n) };
}
/** Distancia de la fachada exterior detrás de la última fila (m). */
export const FACADE_OFFSET = 3.0;
/** Radio exterior aproximado (límites de cámara). */
export function outerRadius(layout: VenueLayout): number {
  if (layout.model) return layout.model.radius;
  const last = layout.levels[layout.levels.length - 1];
  const d = last.baseOffset + last.rows * last.rowDepth + FACADE_OFFSET + 2;
  return Math.hypot(layout.field.width / 2 + d, layout.field.depth / 2 + d);
}
export function topHeight(layout: VenueLayout): number {
  if (layout.model) return layout.model.height;
  const last = layout.levels[layout.levels.length - 1];
  return last.baseHeight + last.rows * last.rowRise;
}

/**
 * Tabla de longitud de arco (misma lógica que backend/src/lib/layout.ts): el
 * parámetro t de la superelipse no es proporcional a la distancia recorrida.
 * `tAt(f)` devuelve el t que está a la fracción f de la longitud del tramo.
 */
export function arcTable(layout: VenueLayout, t0: number, t1: number, d: number, steps = 512): { length: number; tAt: (fraction: number) => number } {
  const center = (t0 + t1) / 2, half = (t1 - t0) / 2;
  const warp = (u: number) => { const v = 2 * u - 1; return center + half * Math.sign(v) * Math.pow(Math.abs(v), 4); };
  const ts: number[] = [t0], cum: number[] = [0];
  let prev = contourPoint(layout, t0, d);
  for (let i = 1; i <= steps; i++) {
    const t = i === steps ? t1 : warp(i / steps);
    const p = contourPoint(layout, t, d);
    cum.push(cum[i - 1] + Math.hypot(p.x - prev.x, p.z - prev.z));
    ts.push(t); prev = p;
  }
  const length = cum[steps];
  const tAt = (fraction: number) => {
    const target = Math.max(0, Math.min(1, fraction)) * length;
    let lo = 0, hi = steps;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; }
    if (lo === 0) return ts[0];
    const seg = cum[lo] - cum[lo - 1];
    return ts[lo - 1] + (ts[lo] - ts[lo - 1]) * (seg > 0 ? (target - cum[lo - 1]) / seg : 0);
  };
  return { length, tAt };
}
