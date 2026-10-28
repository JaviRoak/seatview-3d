import { describe, it, expect } from 'vitest';
import { defaultLayout, generateSeats } from '../src/lib/layout';
import { computeViewQuality, viewFactors, distanceRange, labelFor } from '../src/lib/viewQuality';

const layout = defaultLayout(8000);
const seats = generateSeats(layout);
const positions = new Float32Array(seats.length * 3);
seats.forEach((s, i) => { positions[i * 3] = s.x; positions[i * 3 + 1] = s.y; positions[i * 3 + 2] = s.z; });
const { raw, percentile } = computeViewQuality(positions, seats.length, layout);
const range = distanceRange(positions, seats.length);
const find = (pred: (s: (typeof seats)[number]) => boolean) => seats.findIndex(pred);

describe('calidad de vista (percentil por recinto)', () => {
  it('el percentil cubre el rango completo 0..100', () => {
    expect(Math.min(...percentile)).toBe(0);
    expect(Math.max(...percentile)).toBe(100);
  });

  it('la primera fila lateral central es de los mejores asientos (> 85) y supera a la última fila de esquina', () => {
    // Tribuna Norte (standIdx 1) es lateral: su centro angular cae sobre el eje corto del campo.
    const north = seats.filter((s) => s.standIdx === 1 && s.levelIdx === 0 && s.row === 'A');
    const central = north.reduce((best, s) => (Math.abs(s.x) < Math.abs(best.x) ? s : best));
    const frontCentral = percentile[central.idx];
    const lastLevel = layout.levels.length - 1;
    const corner = seats.filter((s) => s.levelIdx === lastLevel).reduce((best, s) => (Math.abs(s.x) + Math.abs(s.z) > Math.abs(best.x) + Math.abs(best.z) ? s : best));
    expect(frontCentral).toBeGreaterThan(85);
    expect(percentile[corner.idx]).toBeLessThan(35);
    expect(frontCentral).toBeGreaterThan(percentile[corner.idx]);
  });

  it('asientos simétricos respecto al centro del campo obtienen puntajes casi iguales', () => {
    const a = find((s) => s.standIdx === 1 && s.levelIdx === 0 && s.row === 'C' && s.number === 10);
    const sA = seats[a];
    // espejo por el eje X (misma tribuna) y por el eje Z (tribuna opuesta)
    const mirrorZ = seats.reduce((best, s) => (Math.hypot(s.x - sA.x, s.z + sA.z, s.y - sA.y) < Math.hypot(best.x - sA.x, best.z + sA.z, best.y - sA.y) ? s : best));
    const mirrorX = seats.reduce((best, s) => (Math.hypot(s.x + sA.x, s.z - sA.z, s.y - sA.y) < Math.hypot(best.x + sA.x, best.z - sA.z, best.y - sA.y) ? s : best));
    expect(Math.abs(raw[a] - raw[mirrorZ.idx])).toBeLessThan(0.01);
    expect(Math.abs(raw[a] - raw[mirrorX.idx])).toBeLessThan(0.01);
    expect(Math.abs(percentile[a] - percentile[mirrorZ.idx])).toBeLessThanOrEqual(2);
  });

  it('los factores están en [0,1] y las etiquetas siguen los cortes 90/75/55/35', () => {
    const f = viewFactors(0, 3, 40, layout, range);
    for (const k of ['D', 'A', 'E'] as const) { expect(f[k]).toBeGreaterThanOrEqual(0); expect(f[k]).toBeLessThanOrEqual(1); }
    expect(labelFor(95)).toBe('Excelente'); expect(labelFor(80)).toBe('Muy buena'); expect(labelFor(60)).toBe('Buena'); expect(labelFor(40)).toBe('Aceptable'); expect(labelFor(10)).toBe('Limitada');
  });
});
