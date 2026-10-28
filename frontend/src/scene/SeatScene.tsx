/** Canvas principal (issue #5): estadio, asientos instanciados, cámara, luces y FPS opcional. */
import { Canvas } from '@react-three/fiber';
import type { VenueLayout } from '../api/types';
import { Stadium } from './Stadium';
import { ImportedStadium } from './ImportedStadium';
import { SeatsInstanced } from './SeatsInstanced';
import { CameraController, type PovTarget } from './CameraController';
import { FpsProbe, type FpsSample } from './FpsMeter';
import { QUALITY_PRESETS, type Quality } from './quality';
import { outerRadius } from './contour';
import type { ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  layout: VenueLayout; pov: PovTarget | null; debug: boolean; quality: Quality;
  onSelect: (idx: number) => void; onHover: (idx: number | null, screen: { x: number; y: number } | null) => void; onFps: (s: FpsSample) => void; onCameraMove?: (x: number, z: number) => void; onPovReady?: () => void;
}

export function SeatScene({ layout, pov, debug, quality, onSelect, onHover, onFps, onCameraMove, onPovReady, children }: Props) {
  const preset = QUALITY_PRESETS[quality];
  return (
    <Canvas dpr={preset.dpr} gl={{ antialias: preset.antialias, powerPreference: 'high-performance' }} camera={{ fov: 55, near: 0.3, far: 2500 }} onPointerMissed={() => onHover(null, null)}>
      <color attach="background" args={['#0d1626']} />
      <fog attach="fog" args={['#16243a', 260, 700]} />
      {/* Sin sombras por instancia (coste prohibitivo con miles de asientos): el volumen viene de la luz clave + relleno + hemisférica */}
      <hemisphereLight args={['#cfe0ff', '#2a2f3a', 0.75]} />
      <directionalLight position={[140, 200, 90]} intensity={1.35} color="#fff4e0" />
      <directionalLight position={[-160, 110, -120]} intensity={0.45} color="#9fb8ff" />
      <ambientLight intensity={0.12} />
      {layout.model ? <ImportedStadium url={layout.model.url} /> : <Stadium layout={layout} />}
      {!layout.admission && <SeatsInstanced onSelect={onSelect} onHover={onHover} lodDistance={outerRadius(layout) * preset.lodFactor} inPov={pov !== null} />}
      {children}
      <CameraController layout={layout} pov={pov} onCameraMove={onCameraMove} onPovReady={onPovReady} />
      {debug && <FpsProbe onSample={onFps} />}
    </Canvas>
  );
}
