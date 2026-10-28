import { describe, it, expect } from 'vitest';
import { defaultLayout, generateSeats, countSeats, rowLabel } from '../src/lib/layout';

describe('generación procedural de asientos', () => {
  it('produce al menos 8.000 asientos con el layout por defecto', () => {
    const layout = defaultLayout(8000);
    const seats = generateSeats(layout);
    expect(seats.length).toBeGreaterThanOrEqual(8000);
    expect(seats.length).toBe(countSeats(layout));
  });
  it('escala a 20.000 asientos', () => {
    expect(countSeats(defaultLayout(20000))).toBeGreaterThanOrEqual(20000);
  });
  it('índices contiguos, únicos y fuera del campo', () => {
    const layout = defaultLayout(3000);
    const seats = generateSeats(layout);
    seats.forEach((s, i) => expect(s.idx).toBe(i));
    const half = { x: layout.field.width / 2, z: layout.field.depth / 2 };
    for (const s of seats) {
      expect(Math.abs(s.x) > half.x || Math.abs(s.z) > half.z).toBe(true);
      expect(s.y).toBeGreaterThan(0);
    }
    expect(new Set(seats.map((s) => `${s.standIdx}-${s.levelIdx}-${s.row}-${s.number}`)).size).toBe(seats.length);
  });
  it('etiqueta filas sin letras ambiguas', () => {
    expect(rowLabel(0)).toBe('A');
    expect(rowLabel(8)).toBe('J');
    expect(rowLabel(24)).toBe('A2');
  });
});

describe('separación uniforme de asientos (regresión: huecos en el centro de las tribunas)', () => {
  it('la distancia entre asientos consecutivos de una fila es ≈ seatPitch en toda la fila', () => {
    const layout = defaultLayout(8000);
    const seats = generateSeats(layout);
    for (const standIdx of [0, 1, 2, 3]) {
      const row = seats.filter((s) => s.standIdx === standIdx && s.levelIdx === 0 && s.row === 'A');
      const gaps = row.slice(1).map((s, i) => Math.hypot(s.x - row[i].x, s.z - row[i].z));
      expect(Math.max(...gaps)).toBeLessThan(layout.seatPitch * 1.05);
      expect(Math.min(...gaps)).toBeGreaterThan(layout.seatPitch * 0.95);
    }
  });
  it('ningún par de asientos se superpone (distancia mínima ≥ ancho del asiento)', () => {
    const layout = defaultLayout(3000);
    const seats = generateSeats(layout);
    let minDist = Infinity;
    for (let i = 1; i < seats.length; i++) {
      const a = seats[i - 1], b = seats[i];
      if (a.row === b.row && a.standIdx === b.standIdx && a.levelIdx === b.levelIdx) minDist = Math.min(minDist, Math.hypot(a.x - b.x, a.z - b.z));
    }
    expect(minDist).toBeGreaterThanOrEqual(0.5);
  });
});
