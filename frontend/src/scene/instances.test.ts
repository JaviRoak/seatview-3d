/**
 * Verificación del Problema 1 (huecos en el centro de las tribunas):
 *  1) el número de instancias escritas en la InstancedMesh es igual al de asientos,
 *  2) la envolvente cubre todas las instancias,
 *  3) los asientos sintéticos (misma fórmula que el seed) tienen separación uniforme.
 * Corre en Node con three (sin WebGL): InstancedMesh no necesita renderer.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { writeInstanceMatrices, buildSeatGeometry } from './SeatsInstanced';
import { syntheticSeats } from './stress';
import { buildSeatData } from '../store/seats';
import type { VenueLayout } from '../api/types';

const layout: VenueLayout = {
  field: { width: 105, depth: 68 }, corner: 0.25, seatPitch: 0.8, aisleAngle: 0.2, stands: ['E', 'N', 'O', 'S'],
  levels: [{ name: 'Nivel 1', rows: 11, rowDepth: 0.85, rowRise: 0.55, baseHeight: 1, baseOffset: 3.5 }, { name: 'Nivel 2', rows: 8, rowDepth: 0.85, rowRise: 0.68, baseHeight: 9.7, baseOffset: 13.6 }],
};
const zones = [{ id: 'z', name: 'Z', color: '#888', price: 1 }];

describe('InstancedMesh de asientos', () => {
  const payload = syntheticSeats(layout, 8000, zones, 'e');
  const data = buildSeatData(payload);

  it('escribe exactamente una instancia por asiento y count coincide', () => {
    const mesh = new THREE.InstancedMesh(buildSeatGeometry(), new THREE.MeshBasicMaterial(), data.count);
    const written = writeInstanceMatrices(mesh, data);
    expect(data.count).toBeGreaterThanOrEqual(8000);
    expect(written).toBe(data.count);
    expect(mesh.count).toBe(data.count);
    expect(mesh.instanceMatrix.count).toBe(data.count); // el buffer no es más chico que lo necesario
    // la última instancia tiene su matriz escrita (no quedó en identidad)
    const m = new THREE.Matrix4(); mesh.getMatrixAt(data.count - 1, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    expect(p.x).toBeCloseTo(data.positions[(data.count - 1) * 3], 3);
  });

  it('la envolvente cubre todas las instancias', () => {
    const mesh = new THREE.InstancedMesh(buildSeatGeometry(), new THREE.MeshBasicMaterial(), data.count);
    writeInstanceMatrices(mesh, data);
    const sphere = mesh.boundingSphere!;
    for (let i = 0; i < data.count; i += 97) {
      const d = sphere.center.distanceTo(new THREE.Vector3(data.positions[i * 3], data.positions[i * 3 + 1], data.positions[i * 3 + 2]));
      expect(d).toBeLessThanOrEqual(sphere.radius + 0.01);
    }
    expect(sphere.radius).toBeGreaterThan(40); // no es la esfera de un solo asiento (~0.4 m)
  });

  it('la separación entre asientos consecutivos de una fila es uniforme (sin huecos en el centro)', () => {
    let a = 0;
    while (a < data.count && !(data.zoneIdx[a] === 0 && data.rows[a] === 'A')) a++;
    const gaps: number[] = [];
    for (let i = a + 1; i < data.count && data.rows[i] === 'A' && data.zoneIdx[i] === data.zoneIdx[a]; i++) {
      gaps.push(Math.hypot(data.positions[i * 3] - data.positions[(i - 1) * 3], data.positions[i * 3 + 2] - data.positions[(i - 1) * 3 + 2]));
    }
    expect(gaps.length).toBeGreaterThan(20);
    expect(Math.max(...gaps)).toBeLessThan(layout.seatPitch * 1.05);
    expect(Math.min(...gaps)).toBeGreaterThan(layout.seatPitch * 0.95);
  });
});
