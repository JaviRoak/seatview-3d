import { afterAll, describe, expect, it } from 'vitest';
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { buildZoneSurfaces, isZoneClick } from './ClickableZones';

describe('selección de zonas sobre las gradas', () => {
  const geometries = buildZoneSurfaces();
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const meshes = geometries.map(g => new Mesh(g, material));
  afterAll(() => { geometries.forEach(g => g.dispose()); material.dispose(); });
  function hit(x: number, z: number) {
    const ray = new Raycaster(new Vector3(x, 100, z), new Vector3(0, -1, 0));
    return ray.intersectObjects(meshes).map(h => meshes.findIndex(mesh => mesh === h.object));
  }
  it('permite alcanzar las ocho zonas en sus superficies', () => {
    geometries.forEach((g, sector) => {
      const p = g.getAttribute('position');
      expect(p.count).toBeGreaterThan(0);
      const x = (p.getX(0) + p.getX(1) + p.getX(2)) / 3;
      const z = (p.getZ(0) + p.getZ(1) + p.getZ(2)) / 3;
      expect(hit(x, z)[0]).toBe(sector);
    });
  });
  it('deja la cancha y el túnel de jugadores sin selección', () => {
    expect(hit(0, 0)).toEqual([]);
    const angle = Math.PI * 2 * 35.5 / 96;
    const d = 2.5 * .78;
    expect(hit((46+d)*Math.sign(Math.cos(angle))*Math.abs(Math.cos(angle))**(2/2.8), -(68+d)*Math.sign(Math.sin(angle))*Math.abs(Math.sin(angle))**(2/2.8))).toEqual([]);
  });
  it('distingue un clic de un arrastre o del botón secundario', () => {
    expect(isZoneClick(2, 0)).toBe(true);
    expect(isZoneClick(20, 0)).toBe(false);
    expect(isZoneClick(0, 2)).toBe(false);
  });
});
