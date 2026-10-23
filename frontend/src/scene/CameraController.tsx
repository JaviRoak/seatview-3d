/**
 * Control de cámara (issues #5 y #7).
 *  - Vista general: OrbitControls limitados.
 *  - POV: transición animada hasta el asiento (altura de ojos) y, al llegar,
 *    control PROPIO de orientación: yaw/pitch con arrastre (mouse o táctil) y
 *    FOV con la rueda. OrbitControls queda deshabilitado y desmontado mientras
 *    dura el POV: es el único código que toca la rotación de la cámara en POV
 *    (ningún useFrame llama a lookAt fuera de la transición).
 */
import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { VenueLayout } from '../api/types';
import { outerRadius, topHeight } from './contour';
import { attachLookInput, lookAtTarget, type LookState, FOV_DEFAULT } from './povLook';
import { eventTarget } from './eventTarget';

export interface PovTarget { position: [number, number, number]; rotY: number }
interface Anim { from: THREE.Vector3; to: THREE.Vector3; lookFrom: THREE.Vector3; lookTo: THREE.Vector3; t: number; dur: number }
export const EYE_HEIGHT = 1.2;

/** true si el último gesto de puntero fue un arrastre (para que soltar tras arrastrar no cuente como clic en un asiento). */
let lastGestureWasDrag = false;
export function consumeDragFlag(): boolean { const v = lastGestureWasDrag; lastGestureWasDrag = false; return v; }

interface Props { layout: VenueLayout; pov: PovTarget | null; onCameraMove?: (x: number, z: number) => void; onPovReady?: () => void }

export function CameraController({ layout, pov, onCameraMove, onPovReady }: Props) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, gl } = useThree();
  const anim = useRef<Anim | null>(null);
  const lookAt = useRef(new THREE.Vector3(0, 0, 0));
  const overviewPos = useRef(layout.concert?.kind==='bocelli' ? new THREE.Vector3(160,190,-180) : layout.concert ? new THREE.Vector3(-155,175,0) : new THREE.Vector3(0, topHeight(layout) * 3.6, outerRadius(layout) * 1.25));
  const inPov = useRef(false);
  const look = useRef<LookState | null>(null); // orientación libre activa (solo tras llegar al asiento)
  const [orbitMounted, setOrbitMounted] = useState(true); // OrbitControls solo existe en vista general
  const reportTick = useRef(0);
  const maxDist = outerRadius(layout) * 2.0, minDist = Math.min(layout.field.width, layout.field.depth) * 0.35;
  const concert = layout.concert?.kind;

  useEffect(() => { camera.position.copy(overviewPos.current); camera.lookAt(0, 0, 0); }, [camera]);

  // Entrada/salida/cambio de asiento en POV.
  useEffect(() => {
    const from = camera.position.clone();
    const lookFrom = look.current ? from.clone().add(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).negate().multiplyScalar(50)) : lookAt.current.clone();
    look.current = null;
    if (pov) {
      const [x, y, z] = pov.position;
      anim.current = { from, to: new THREE.Vector3(x, y + EYE_HEIGHT, z), lookFrom, lookTo: new THREE.Vector3(...eventTarget(layout)), t: 0, dur: inPov.current ? 0.9 : 1.4 };
      inPov.current = true;
      if (controls.current) controls.current.enabled = false;
      setOrbitMounted(false);
    } else if (inPov.current) {
      anim.current = { from, to: overviewPos.current.clone(), lookFrom, lookTo: new THREE.Vector3(0, 0, 0), t: 0, dur: 1.2 };
      inPov.current = false;
    }
  }, [pov, camera, concert]);

  // Eventos de puntero (mouse y táctil) y rueda → reductor de orientación. Solo actúan cuando look.current existe (POV listo).
  useEffect(() => attachLookInput(gl.domElement, () => look.current, (st) => { look.current = st; }, (moved) => { if (moved > 6) lastGestureWasDrag = true; }), [gl]);

  useFrame((_, delta) => {
    if (onCameraMove && ++reportTick.current % 6 === 0) onCameraMove(camera.position.x, camera.position.z);
    const a = anim.current;
    if (a) {
      a.t = Math.min(1, a.t + delta / a.dur);
      const e = a.t < 0.5 ? 2 * a.t * a.t : -1 + (4 - 2 * a.t) * a.t;
      camera.position.lerpVectors(a.from, a.to, e);
      lookAt.current.lerpVectors(a.lookFrom, a.lookTo, e);
      camera.lookAt(lookAt.current); // SOLO durante la transición
      if (a.t >= 1) {
        anim.current = null;
        if (inPov.current) {
          // Llegamos al asiento: orientación inicial hacia el centro con horizonte casi a media pantalla, y control libre.
          look.current = lookAtTarget(camera.position.toArray() as [number, number, number], a.lookTo.toArray() as [number, number, number], FOV_DEFAULT);
          onPovReady?.();
        } else {
          const cam = camera as THREE.PerspectiveCamera;
          if (cam.fov !== FOV_DEFAULT) { cam.fov = FOV_DEFAULT; cam.updateProjectionMatrix(); }
          setOrbitMounted(true); // se vuelve a montar OrbitControls con la cámara ya en la vista general
        }
      }
      return;
    }
    if (look.current) {
      camera.rotation.set(look.current.pitch, look.current.yaw, 0, 'YXZ');
      const cam = camera as THREE.PerspectiveCamera;
      if (cam.fov !== look.current.fov) { cam.fov = look.current.fov; cam.updateProjectionMatrix(); }
    }
  });

  // OrbitControls solo existe en vista general: en POV se desmonta por completo.
  if (!orbitMounted) return null;
  return (
    <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} target={[0, 0, 0]}
      minDistance={minDist} maxDistance={maxDist} maxPolarAngle={Math.PI / 2 - 0.12} minPolarAngle={0.15} enablePan={false}
      onChange={() => { if (!inPov.current) lookAt.current.set(0, 0, 0); }} />
  );
}
