/**
 * Nivel de calidad gráfica (docs/rendimiento.md).
 * Auto: se considera "low" en equipos modestos (≤ 4 GB de RAM reportados, ≤ 4 hilos o dispositivo móvil).
 * Se puede forzar con ?quality=low | high.
 */
export type Quality = 'low' | 'high';

export function detectQuality(search: string = typeof location !== 'undefined' ? location.search : ''): Quality {
  const forced = new URLSearchParams(search).get('quality');
  if (forced === 'low' || forced === 'high') return forced;
  if (typeof navigator === 'undefined') return 'high';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mobile = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent);
  const lowMem = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const fewCores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4;
  return mobile || lowMem || fewCores ? 'low' : 'high';
}

export const QUALITY_PRESETS: Record<Quality, { dpr: number | [number, number]; antialias: boolean; /** distancia (× radio exterior) a partir de la cual los asientos usan la geometría simple */ lodFactor: number }> = {
  high: { dpr: [1, 1.5], antialias: true, lodFactor: 1.1 },
  low: { dpr: 1, antialias: false, lodFactor: 0.0 }, // low: geometría simple siempre salvo en POV (ver SeatsInstanced)
};
