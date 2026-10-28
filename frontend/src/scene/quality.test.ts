import { describe, it, expect } from 'vitest';
import { detectQuality } from './quality';
import { buildSeatGeometry, buildSeatGeometryLow } from './SeatsInstanced';

describe('calidad gráfica y LOD', () => {
  it('?quality fuerza el nivel', () => {
    expect(detectQuality('?quality=low')).toBe('low');
    expect(detectQuality('?quality=high')).toBe('high');
  });
  it('la geometría simple tiene 3× menos triángulos que la completa', () => {
    const g = buildSeatGeometry(); const full = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    const low = buildSeatGeometryLow().index!.count / 3;
    expect(low).toBe(12);
    expect(full).toBe(36);
  });
});
