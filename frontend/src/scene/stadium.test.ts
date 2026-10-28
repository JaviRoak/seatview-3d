/** Geometría del recinto: sin normales inválidas (triángulos negros), tamaño acotado y cerramiento por encima de la última fila. */
import { describe, it, expect } from 'vitest';
import { buildTier, buildEnclosure } from './Stadium';
import type { VenueLayout } from '../api/types';

const layout: VenueLayout = {
  field: { width: 105, depth: 68 }, corner: 0.25, seatPitch: 0.8, aisleAngle: 0.2, stands: ['E', 'N', 'O', 'S'],
  levels: [{ name: 'Nivel 1', rows: 11, rowDepth: 0.85, rowRise: 0.55, baseHeight: 1, baseOffset: 3.5 }, { name: 'Nivel 2', rows: 8, rowDepth: 0.85, rowRise: 0.68, baseHeight: 9.7, baseOffset: 13.6 }],
};

function stats(g: { getAttribute: (n: string) => { array: ArrayLike<number>; count: number } }) {
  const n = g.getAttribute('normal').array, p = g.getAttribute('position').array;
  let bad = 0, maxY = -Infinity;
  for (let i = 0; i < n.length; i++) if (!Number.isFinite(n[i])) bad++;
  for (let i = 1; i < p.length; i += 3) maxY = Math.max(maxY, p[i]);
  return { tris: g.getAttribute('position').count / 3, bad, maxY };
}

describe('geometría del estadio', () => {
  it('ninguna normal es NaN (no hay quads degenerados → no hay triángulos negros)', () => {
    const all = [...layout.levels.flatMap((_, i) => Object.values(buildTier(layout, i))), ...Object.values(buildEnclosure(layout))];
    for (const g of all) expect(stats(g).bad).toBe(0);
  });
  it('el cerramiento se eleva por encima de la última fila y el total de triángulos es acotado', () => {
    const enc = buildEnclosure(layout);
    const top = layout.levels[1].baseHeight + 7 * 0.68;
    expect(stats(enc.concrete).maxY).toBeGreaterThan(top + 3);
    expect(stats(enc.roof).maxY).toBeGreaterThan(top + 4);
    const total = [...layout.levels.flatMap((_, i) => Object.values(buildTier(layout, i))), ...Object.values(enc)].reduce((a, g) => a + stats(g).tris, 0);
    console.log('triángulos estructura (gradas + cerramiento):', total);
    expect(total).toBeLessThan(120_000); // muy por debajo de los ~306k de los asientos
  });
});
