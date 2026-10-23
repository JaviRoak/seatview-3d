/**
 * Asientos con InstancedMesh (issues #5, #6, #7).
 * Una sola malla y una sola draw call para todos los asientos:
 *  - Geometría low-poly compartida (asiento + respaldo fusionados).
 *  - Matrices calculadas una vez a partir de las posiciones de la API.
 *  - `instanceColor` refleja el estado; solo se reescriben las instancias
 *    marcadas en `dirty` por el store y luego needsUpdate = true.
 *  - Hover/clic por raycasting: R3F entrega `instanceId` en el evento.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ThreeEvent } from '@react-three/fiber';
import { useSeatsStore, type SeatData } from '../store/seats';
import { useSeatInstanceColors } from './useSeatInstanceColors';

const SEAT_W = 0.5, SEAT_D = 0.5, SEAT_T = 0.09, BACK_H = 0.5;

/**
 * Geometría simple para vista general (12 triángulos): una caja del tamaño del
 * asiento + respaldo. A distancia es indistinguible y reduce 3× los triángulos.
 */
export function buildSeatGeometryLow(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(SEAT_W, BACK_H + SEAT_T, SEAT_D);
  g.translate(0, (BACK_H + SEAT_T) / 2, 0);
  g.computeBoundingSphere();
  return g;
}

export function buildSeatGeometry(): THREE.BufferGeometry {
  const seat = new THREE.BoxGeometry(SEAT_W, SEAT_T, SEAT_D);
  seat.translate(0, SEAT_T / 2, 0);
  const back = new THREE.BoxGeometry(SEAT_W, BACK_H, 0.08);
  back.translate(0, BACK_H / 2 + SEAT_T, -SEAT_D / 2 + 0.04); // respaldo atrás (-Z local); el asiento mira a +Z
  // Pedestal: une el asiento con el escalón de concreto (45 cm más abajo) para que no "flote".
  const pedestal = new THREE.BoxGeometry(0.16, 0.45, 0.16);
  pedestal.translate(0, -0.225, -0.05);
  const merged = mergeGeometries([seat, back, pedestal], false)!;
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Escribe una matriz por asiento y recalcula la envolvente del conjunto.
 * Devuelve cuántas instancias se escribieron (debe ser = data.count).
 * Nota: la malla se renderiza con frustumCulled=false; aun así la envolvente
 * se recalcula para que el raycasting y cualquier culling futuro sean correctos.
 */
export function writeInstanceMatrices(mesh: THREE.InstancedMesh, data: SeatData): number {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  let written = 0;
  for (let i = 0; i < data.count; i++) {
    pos.set(data.positions[i * 3], data.positions[i * 3 + 1], data.positions[i * 3 + 2]);
    q.setFromAxisAngle(up, data.rotations[i]);
    mesh.setMatrixAt(i, m.compose(pos, q, one));
    written++;
  }
  mesh.count = data.count;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.computeBoundingBox();
  return written;
}

interface Props { onSelect: (idx: number) => void; onHover: (idx: number | null, screen: { x: number; y: number } | null) => void; /** distancia de cámara al centro a partir de la cual se usa la geometría simple; 0 = siempre simple fuera de POV */ lodDistance: number; inPov: boolean }

export function SeatsInstanced({ onSelect, onHover, lodDistance, inPov }: Props) {
  const data = useSeatsStore((s) => s.data);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(buildSeatGeometry, []);
  const geometryLow = useMemo(buildSeatGeometryLow, []);
  const { camera } = useThree();
  const lodTick = useRef(0);
  const lastHover = useRef<number | null>(null);

  // Matrices: una vez por carga de datos.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !data) return;
    writeInstanceMatrices(mesh, data);
    useSeatsStore.setState({ repaintAll: true });
  }, [data]);

  // Colores: completo la primera vez; después solo las instancias sucias.
  useSeatInstanceColors(meshRef, data);

  // Nivel de detalle: geometría completa en POV o cerca; caja simple en vista general.
  // Cambiar la geometría no toca instanceMatrix ni instanceColor (mismos buffers).
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || ++lodTick.current % 10 !== 0) return;
    const far = !inPov && camera.position.length() > lodDistance;
    const want = far ? geometryLow : geometry;
    if (mesh.geometry !== want) mesh.geometry = want;
  });

  if (!data) return null;

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const id = e.instanceId ?? null;
    if (id !== lastHover.current) { lastHover.current = id; useSeatsStore.getState().setHovered(id); }
    onHover(id, id === null ? null : { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  };
  const handleOut = () => { lastHover.current = null; useSeatsStore.getState().setHovered(null); onHover(null, null); };

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, data.count]} frustumCulled={false}
      onPointerMove={handleMove} onPointerOut={handleOut}
      onClick={(e) => { e.stopPropagation(); if (e.instanceId !== undefined) onSelect(e.instanceId); }}>
      <meshLambertMaterial />
    </instancedMesh>
  );
}
