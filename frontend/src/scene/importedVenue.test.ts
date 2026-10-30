import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { previewPayload, type VenueDefinition } from '../features/venues/previewData';
import { contourPoint, outerRadius, topHeight } from './contour';

const def: VenueDefinition = JSON.parse(readFileSync(resolve(process.cwd(), 'public/models/cuscatlan.venue.json'), 'utf8'));
describe('modelo y asientos Cuscatlán', () => {
  it('exporta GLB autosuficiente, Y arriba y pocos grupos de dibujo', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'public/models/cuscatlan-v5.glb'));
    expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
    expect(bytes.readUInt32LE(4)).toBe(2);
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trim());
    expect(json.meshes.length).toBeLessThan(30);
    expect(json.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true);
    expect(json.images ?? []).toHaveLength(0);
    expect(bytes.length).toBeLessThan(5 * 1024 * 1024);
  });
  it('apoya los pedestales sobre las 40 gradas y deja libres campo y entradas', () => {
    const holes = [[19,7,13],[19,18,24],[19,29,35],[67,7,13],[67,18,24],[67,29,35],[28,18,24],[28,29,35],[76,18,24],[76,29,35],[3,18,24],[92,18,24],[44,18,24],[51,18,24],[35,0,6]];
    for (const s of def.seats) {
      const row = Number(s.row) - 1;
      expect(s.y - .45).toBeCloseTo(1.4 + row * .46 - .21, 4);
      expect(row === 22 || row === 23).toBe(false);
      expect(Math.abs(s.x) >= 34.25 || Math.abs(s.z) >= 53.5).toBe(true);
      const d = row * .78 + (row >= 22 ? 1.7 : 0) + .39;
      const c = Math.sign(s.x) * Math.pow(Math.abs(s.x / (46 + d)), 1.4);
      const sn = Math.sign(-s.z) * Math.pow(Math.abs(s.z / (68 + d)), 1.4);
      const angle = (Math.atan2(sn, c) + 2 * Math.PI) % (2 * Math.PI);
      const segment = Math.floor(angle / (2 * Math.PI) * 96);
      expect(holes.some(([i, lo, hi]) => segment === i && row >= lo && row < hi)).toBe(false);
    }
  });
  it('usa dimensiones de modelo para cámara/minimapa y preserva el campo real', () => {
    expect(outerRadius(def.layout)).toBe(172);
    expect(topHeight(def.layout)).toBe(46);
    expect(contourPoint(def.layout, 0, .39).x).toBeCloseTo(46.39);
    expect(def.layout.field).toEqual({ width: 68.5, depth: 107 });
    const payload = previewPayload(def);
    expect(payload.positions.length).toBe(payload.count * 3);
    expect(payload.zoneIdx.every((i) => i >= 0 && i < def.zones.length)).toBe(true);
    expect(payload.ids.every((id) => id.startsWith('preview-'))).toBe(true);
  });
  it('numera filas contiguas sin saltar al otro extremo de una tribuna', () => {
    for (let i = 1; i < def.seats.length; i++) {
      const a = def.seats[i - 1], b = def.seats[i];
      if (a.zone !== b.zone || a.row !== b.row) continue;
      expect(b.number).toBe(a.number + 1);
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(.45);
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(35);
    }
  });
});
