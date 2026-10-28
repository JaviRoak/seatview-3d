/**
 * Control de orientación en POV (Problema 1): la POSICIÓN queda anclada al
 * asiento y la ORIENTACIÓN es libre. Reductor puro (probado en povLook.test.ts):
 *  - drag(dx, dy): yaw libre 360°, pitch acotado a [-60°, +45°]
 *  - wheel(dy): FOV entre 35° y 75° (enfocar), sin mover la cámara
 *  - lookAtTarget(): orientación inicial mirando al centro del campo con el
 *    horizonte cerca de media pantalla (pitch inicial acotado a [-10°, 0])
 * Sin OrbitControls: se aplica directamente a camera.rotation (orden 'YXZ').
 */
export interface LookState { yaw: number; pitch: number; fov: number }

export const PITCH_MIN = (-60 * Math.PI) / 180;
export const PITCH_MAX = (45 * Math.PI) / 180;
export const FOV_MIN = 35;
export const FOV_MAX = 75;
export const FOV_DEFAULT = 55;
/** radianes por píxel arrastrado */
export const DRAG_SENSITIVITY = 0.0032;
export const INITIAL_PITCH_MIN = (-10 * Math.PI) / 180;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => { const t = Math.PI * 2; return ((a % t) + t) % t; };

export function drag(state: LookState, dx: number, dy: number, sensitivity = DRAG_SENSITIVITY): LookState {
  return { ...state, yaw: wrap(state.yaw - dx * sensitivity), pitch: clamp(state.pitch - dy * sensitivity, PITCH_MIN, PITCH_MAX) };
}

export function wheel(state: LookState, deltaY: number): LookState {
  return { ...state, fov: clamp(state.fov + Math.sign(deltaY) * 3, FOV_MIN, FOV_MAX) };
}

/**
 * Orientación inicial desde la posición de la cámara hacia un objetivo.
 * Convención three.js: con rotation = (pitch, yaw, 0, 'YXZ') la cámara mira
 * hacia (-sin yaw · cos pitch, sin pitch, -cos yaw · cos pitch).
 */
export function lookAtTarget(from: [number, number, number], target: [number, number, number], fov = FOV_DEFAULT): LookState {
  const dx = target[0] - from[0], dy = target[1] - from[1], dz = target[2] - from[2];
  const yaw = wrap(Math.atan2(-dx, -dz));
  const downAngle = Math.atan2(dy, Math.hypot(dx, dz)); // negativo si el objetivo está por debajo
  // Horizonte cerca de media pantalla: solo una inclinación suave hacia el campo.
  const pitch = clamp(downAngle * 0.5, INITIAL_PITCH_MIN, 0);
  return { yaw, pitch, fov };
}

/** Vector de mirada para una orientación dada (usado en pruebas). */
export function forward(state: LookState): [number, number, number] {
  return [-Math.sin(state.yaw) * Math.cos(state.pitch), Math.sin(state.pitch), -Math.cos(state.yaw) * Math.cos(state.pitch)];
}

/**
 * Conecta los eventos de puntero (mouse y táctil) y la rueda de un elemento al
 * reductor. `get` devuelve el estado actual o null si el POV no está activo.
 * Devuelve una función para desconectar. `onDragEnd(moved)` recibe los píxeles
 * recorridos para distinguir arrastre de clic.
 */
export function attachLookInput(el: HTMLElement, get: () => LookState | null, set: (s: LookState) => void, onDragEnd?: (moved: number) => void): () => void {
  let dragging = false, lastX = 0, lastY = 0, moved = 0, pointerId = -1;
  const onDown = (e: PointerEvent) => {
    if (!get() || (e.button !== 0 && e.button !== -1)) return;
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; pointerId = e.pointerId;
    el.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    const s = get();
    if (!dragging || !s || e.pointerId !== pointerId) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    set(drag(s, dx, dy));
  };
  const onUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    onDragEnd?.(moved);
    try { el.releasePointerCapture?.(e.pointerId); } catch { /* jsdom */ }
  };
  const onWheel = (e: WheelEvent) => { const s = get(); if (!s) return; e.preventDefault(); set(wheel(s, e.deltaY)); };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp); el.removeEventListener('wheel', onWheel);
  };
}
