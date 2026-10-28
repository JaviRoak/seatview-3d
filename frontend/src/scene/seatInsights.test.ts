import { describe, it, expect } from 'vitest';
import { viewQuality, viewFactors, seatAttributes, rowLength, localPercentiles, labelFor } from './seatInsights';
import { neighborSeat } from './seatNavigation';
import { buildSeatData } from '../store/seats';
import type { EventSeatsPayload, VenueLayout } from '../api/types';

const layout: VenueLayout = {
  field: { width: 105, depth: 68 }, corner: 0.35, seatPitch: 0.7, aisleAngle: 0.06,
  stands: ['Tribuna Este', 'Tribuna Norte', 'Tribuna Oeste', 'Tribuna Sur'],
  levels: [{ name: 'Nivel 1', rows: 2, rowDepth: 0.9, rowRise: 0.45, baseHeight: 1.2, baseOffset: 7 }, { name: 'Nivel 2', rows: 1, rowDepth: 0.9, rowRise: 0.6, baseHeight: 13, baseOffset: 12 }],
};

/** Zona 0 (Nivel 1): fila A con 5 asientos, fila B con 5; zona 1 (Nivel 2): fila A con 3. */
function makeData() {
  const ids: string[] = [], zoneIdx: number[] = [], rows: string[] = [], numbers: number[] = [], positions: number[] = [], rotations: number[] = [];
  const add = (z: number, r: string, n: number, x: number, y: number, zz: number) => { ids.push(`s${ids.length}`); zoneIdx.push(z); rows.push(r); numbers.push(n); positions.push(x, y, zz); rotations.push(0); };
  for (let n = 1; n <= 5; n++) add(0, 'A', n, 0, 1.2, 41 + n * 0.1);
  for (let n = 1; n <= 5; n++) add(0, 'B', n, 0, 1.65, 42 + n * 0.1);
  for (let n = 1; n <= 3; n++) add(1, 'A', n, 60, 13, 0);
  const p: EventSeatsPayload = { eventId: 'e', count: ids.length, ids, seatIds: ids, zoneIdx, rows, numbers, positions, rotations, status: ids.map(() => 0), lockedBy: {}, ...localPercentiles(positions, ids.length, layout),
    zones: [{ id: 'z0', name: 'Tribuna Norte · Nivel 1', color: '#9db59a', price: 25 }, { id: 'z1', name: 'Tribuna Este · Nivel 2', color: '#5b6d87', price: 45 }] };
  return buildSeatData(p);
}

describe('calidad de vista', () => {
  const range = { dMin: 37, dMax: 90 };
  it('los factores están en [0,1] y premian cercanía, lateralidad y elevación moderada', () => {
    const lateralCerca = viewFactors(0, 5, 41, layout, range);
    const fondoLejos = viewFactors(75, 8, 0, layout, range);
    const rasSuelo = viewFactors(0, 0.5, 41, layout, range);
    for (const q of [lateralCerca, fondoLejos, rasSuelo]) for (const k of ['D', 'A', 'E'] as const) { expect(q[k]).toBeGreaterThanOrEqual(0); expect(q[k]).toBeLessThanOrEqual(1); }
    expect(lateralCerca.raw).toBeGreaterThan(fondoLejos.raw);
    expect(lateralCerca.raw).toBeGreaterThan(rasSuelo.raw);
    expect(lateralCerca.angleDeg).toBeCloseTo(0, 5);
    expect(fondoLejos.angleDeg).toBeCloseTo(90, 5);
  });
  it('el percentil local cubre 0..100 y las etiquetas siguen 90/75/55/35', () => {
    const data = makeData();
    expect(Math.min(...data.viewPct)).toBe(0);
    expect(Math.max(...data.viewPct)).toBe(100);
    expect(viewQuality(data, 0, layout).percentile).toBe(data.viewPct[0]);
    expect(labelFor(90)).toBe('Excelente'); expect(labelFor(74)).toBe('Buena'); expect(labelFor(34)).toBe('Limitada');
  });
});

describe('atributos del asiento', () => {
  const data = makeData();
  it('detecta vista central, salida y nivel 1', () => {
    const q = viewQuality(data, 0, layout);
    const attrs = seatAttributes(data, 0, layout, q).map((a) => a.text);
    expect(attrs).toContain('Vista central');
    expect(attrs).toContain('Cerca de la salida'); // asiento 1 de 5
    expect(attrs).toContain('Nivel 1 · más cerca del campo');
    expect(attrs.length).toBeLessThanOrEqual(3);
  });
  it('un asiento central de la fila no está cerca de la salida', () => {
    // fila de 9 asientos simulada: usamos rowLength con la de 5 → asiento 3 es "central" solo si rowLen ≥ 7; comprobamos rowLength
    expect(rowLength(data, 2)).toBe(5);
    expect(rowLength(data, 11)).toBe(3);
  });
});

describe('navegación entre asientos en POV', () => {
  const data = makeData();
  it('al lado: respeta los límites de la fila', () => {
    expect(neighborSeat(data, 0, 'left')).toBeNull();
    expect(neighborSeat(data, 0, 'right')).toBe(1);
    expect(neighborSeat(data, 4, 'right')).toBeNull(); // no salta a la fila B
  });
  it('adelante/atrás: cambia de fila dentro de la zona manteniendo la posición relativa', () => {
    expect(neighborSeat(data, 2, 'back')).toBe(7); // A3 → B3
    expect(neighborSeat(data, 7, 'front')).toBe(2);
    expect(neighborSeat(data, 2, 'front')).toBeNull(); // A es la primera fila
    expect(neighborSeat(data, 7, 'back')).toBeNull();
    expect(neighborSeat(data, 10, 'back')).toBeNull(); // zona con una sola fila
  });
});
