/** Recintos reales del seed: inventario esperado y público coherente con los JSON del repositorio. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCuscatlan } from '../prisma/seeds/cuscatlan';
import { buildBeele } from '../prisma/seeds/beele';
import { buildBocelli } from '../prisma/seeds/bocelli';
import { layoutSchema } from '../src/lib/venue/schema';

const committed = (file: string) => JSON.parse(readFileSync(resolve(__dirname, '../../frontend/public/models', file), 'utf8'));
// Igual que al escribirlo en disco (JSON convierte -0 en 0).
const asJson = (v: unknown) => JSON.parse(JSON.stringify(v));
const numbered = (seats: { row: string }[]) => seats.filter((s) => s.row !== 'GA').length;

describe('recintos reales del seed', () => {
  it('Cuscatlán fútbol: 49.500 cupos, 3.000 numerados en Platea', () => {
    const { seats, layout, crowd } = buildCuscatlan();
    expect(seats).toHaveLength(49_500);
    expect(numbered(seats)).toBe(3000);
    expect(new Set(seats.filter((s) => s.row !== 'GA').map((s) => s.zone))).toEqual(new Set([6]));
    expect(layout.model?.url).toBe('/models/cuscatlan-v5.glb');
    expect(asJson(crowd)).toEqual(committed('cuscatlan-crowd.json'));
  });

  it('Beéle: 14.320 lugares, 4.820 sillas numeradas en cancha', () => {
    const { seats, layout, crowd } = buildBeele();
    expect(seats).toHaveLength(14_320);
    expect(numbered(seats)).toBe(4820);
    expect(layout.concert).toEqual({ kind: 'beele', demo: true });
    expect(asJson(crowd)).toEqual(committed('beele-crowd.json'));
  });

  it('Bocelli: 11.285 lugares con admisión mixta', () => {
    const { seats, layout, crowd } = buildBocelli();
    expect(seats).toHaveLength(11_285);
    expect(layoutSchema.parse(layout).admission?.crowdUrl).toBe('/models/bocelli-crowd.json');
    expect(asJson(crowd)).toEqual(committed('bocelli-crowd.json'));
  });
});
