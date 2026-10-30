import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { venueDefinitionSchema } from '../src/lib/venue/schema';

const load = () => JSON.parse(readFileSync(resolve(__dirname, '../../frontend/public/models/cuscatlan.venue.json'), 'utf8'));
describe('Cuscatlán y modelos externos', () => {
  it('conserva modelo y posiciones explícitas al validar la definición', () => {
    const definition = venueDefinitionSchema.parse(load());
    expect(definition.layout.model?.url).toBe('/models/cuscatlan-v5.glb');
    expect(definition.seats?.length).toBeGreaterThan(10000);
    expect(definition.events).toEqual([]);
    expect(new Set(definition.seats!.map((s) => `${s.zone}:${s.row}:${s.number}`)).size).toBe(definition.seats!.length);
  });
  it('no permite generar asientos procedurales sobre una estructura externa', () => {
    const definition = load(); delete definition.seats;
    expect(venueDefinitionSchema.safeParse(definition).success).toBe(false);
  });
  it('rechaza modelos fuera del directorio público previsto y envolventes inválidas', () => {
    for (const url of ['javascript:alert(1)', '//external.test/model.glb', '/models/../private.glb', '/models/model.txt']) {
      const definition = load(); definition.layout.model.url = url;
      expect(venueDefinitionSchema.safeParse(definition).success).toBe(false);
    }
    const definition = load(); definition.layout.model.radius = -1;
    expect(venueDefinitionSchema.safeParse(definition).success).toBe(false);
  });
});
