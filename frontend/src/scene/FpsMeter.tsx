/**
 * Medidor de FPS (requisito de rendimiento), activo con ?debug=1.
 * Muestrea cada 500 ms y conserva min/máx/promedio de los últimos 10 s.
 */
import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

export interface FpsSample { fps: number; avg: number; min: number; max: number; drawCalls: number; triangles: number }

export function FpsProbe({ onSample }: { onSample: (s: FpsSample) => void }) {
  const frames = useRef(0), last = useRef(performance.now()), history = useRef<number[]>([]);
  const { gl } = useThree();
  useFrame(() => {
    frames.current++;
    const now = performance.now();
    if (now - last.current >= 500) {
      const fps = (frames.current * 1000) / (now - last.current);
      frames.current = 0; last.current = now;
      history.current.push(fps); if (history.current.length > 20) history.current.shift();
      const h = history.current;
      onSample({ fps, avg: h.reduce((a, b) => a + b, 0) / h.length, min: Math.min(...h), max: Math.max(...h), drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles });
    }
  });
  return null;
}

export function FpsOverlay({ sample, seats, quality, unit='asientos' }: { sample: FpsSample | null; seats: number; quality?: string; unit?: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'f' && setVisible((v) => !v);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!visible || !sample) return null;
  return (
    <div className="panel fps" title="Tecla F para ocultar">
      {sample.fps.toFixed(0)} fps · prom {sample.avg.toFixed(0)} · min {sample.min.toFixed(0)} · máx {sample.max.toFixed(0)}<br />
      {seats.toLocaleString('es')} {unit} · {sample.drawCalls} draw calls · {(sample.triangles / 1000).toFixed(0)}k tri{quality ? ` · calidad ${quality}` : ''}
    </div>
  );
}
