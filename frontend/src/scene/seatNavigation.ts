/**
 * Navegación entre asientos vecinos en POV (Cambio 1): asiento de al lado
 * (misma fila y zona) y fila de adelante/atrás (misma zona, mismo número o el
 * más cercano en ángulo). Los índices son contiguos por zona → fila → número.
 */
import type { SeatData } from '../store/seats';

export type Direction = 'left' | 'right' | 'front' | 'back';

export function neighborSeat(data: SeatData, idx: number, dir: Direction): number | null {
  const z = data.zoneIdx[idx], r = data.rows[idx];
  if (dir === 'left' || dir === 'right') {
    const j = dir === 'left' ? idx - 1 : idx + 1;
    return j >= 0 && j < data.count && data.zoneIdx[j] === z && data.rows[j] === r ? j : null;
  }
  // Filas: la fila "A" es la más cercana al campo; adelante = fila anterior.
  const rowOrder = zoneRows(data, z);
  const pos = rowOrder.indexOf(r);
  const targetRow = rowOrder[dir === 'front' ? pos - 1 : pos + 1];
  if (!targetRow) return null;
  // Asiento de la fila destino con ángulo más cercano (misma proporción dentro de la fila).
  const [a0, a1] = rowRange(data, idx);
  const frac = (idx - a0) / Math.max(1, a1 - a0);
  const [b0, b1] = rowRangeByKey(data, z, targetRow);
  return Math.round(b0 + frac * (b1 - b0));
}

function zoneRows(data: SeatData, z: number): string[] {
  const rows: string[] = [];
  for (let i = 0; i < data.count; i++) if (data.zoneIdx[i] === z && rows[rows.length - 1] !== data.rows[i]) rows.push(data.rows[i]);
  return rows;
}
function rowRange(data: SeatData, idx: number): [number, number] {
  const z = data.zoneIdx[idx], r = data.rows[idx];
  let a = idx, b = idx;
  while (a > 0 && data.zoneIdx[a - 1] === z && data.rows[a - 1] === r) a--;
  while (b < data.count - 1 && data.zoneIdx[b + 1] === z && data.rows[b + 1] === r) b++;
  return [a, b];
}
function rowRangeByKey(data: SeatData, z: number, r: string): [number, number] {
  let a = -1, b = -1;
  for (let i = 0; i < data.count; i++) {
    if (data.zoneIdx[i] === z && data.rows[i] === r) { if (a < 0) a = i; b = i; }
    else if (a >= 0) break;
  }
  return [a, b];
}
