import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { drag, wheel, lookAtTarget, forward, attachLookInput, PITCH_MIN, PITCH_MAX, FOV_MIN, FOV_MAX } from './povLook';

describe('control de orientación en POV', () => {
  it('un arrastre modifica yaw y pitch y respeta los límites', () => {
    let s = { yaw: 0, pitch: 0, fov: 55 };
    s = drag(s, 100, 0);
    expect(s.yaw).not.toBe(0);
    s = drag(s, 0, -100000); // arrastrar hacia arriba muchísimo
    expect(s.pitch).toBe(PITCH_MAX);
    s = drag(s, 0, 100000);
    expect(s.pitch).toBe(PITCH_MIN);
    for (let i = 0; i < 50; i++) s = drag(s, 500, 0); // yaw libre: da vueltas sin bloquearse
    expect(s.yaw).toBeGreaterThanOrEqual(0);
    expect(s.yaw).toBeLessThan(Math.PI * 2);
  });

  it('la rueda cambia el FOV dentro de [35, 75] sin tocar yaw/pitch', () => {
    let s = { yaw: 1, pitch: -0.1, fov: 55 };
    for (let i = 0; i < 30; i++) s = wheel(s, 100);
    expect(s.fov).toBe(FOV_MAX);
    for (let i = 0; i < 60; i++) s = wheel(s, -100);
    expect(s.fov).toBe(FOV_MIN);
    expect(s.yaw).toBe(1); expect(s.pitch).toBe(-0.1);
  });

  it('la orientación inicial mira hacia el centro del campo con el horizonte casi a media pantalla', () => {
    const from: [number, number, number] = [0, 15, 60];
    const s = lookAtTarget(from, [0, 0, 0]);
    const f = forward(s);
    expect(f[2]).toBeLessThan(-0.9); // hacia -Z (el centro está en -Z desde +Z)
    expect(Math.abs(f[0])).toBeLessThan(1e-9);
    expect(s.pitch).toBeLessThanOrEqual(0);
    expect(s.pitch).toBeGreaterThanOrEqual((-10 * Math.PI) / 180);
    // Coincide con la convención de three.js: aplicar la rotación a una cámara da el mismo vector
    const cam = new THREE.PerspectiveCamera();
    cam.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    expect(dir.x).toBeCloseTo(f[0], 6); expect(dir.y).toBeCloseTo(f[1], 6); expect(dir.z).toBeCloseTo(f[2], 6);
  });

  it('la posición de la cámara no cambia al mirar alrededor', () => {
    const cam = new THREE.PerspectiveCamera(); cam.position.set(10, 5, -20);
    let s = lookAtTarget([10, 5, -20], [0, 0, 0]);
    for (let i = 0; i < 20; i++) { s = drag(s, 37, -11); s = wheel(s, 1); cam.rotation.set(s.pitch, s.yaw, 0, 'YXZ'); cam.fov = s.fov; }
    expect(cam.position.toArray()).toEqual([10, 5, -20]);
  });
});

describe('entrada de puntero conectada al elemento (jsdom)', () => {
  it('un arrastre sobre el canvas cambia yaw/pitch, la rueda el FOV, y se distingue arrastre de clic', () => {
    const el = document.createElement('div');
    let state: { yaw: number; pitch: number; fov: number } | null = { yaw: 0, pitch: 0, fov: 55 };
    let lastMoved = -1;
    const detach = attachLookInput(el, () => state, (s) => { state = s; }, (m) => { lastMoved = m; });
    // jsdom no implementa PointerEvent: se simula con MouseEvent + pointerId (misma interfaz que leen los manejadores)
    const pe = (type: string, x: number, y: number) => { const ev = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }); Object.defineProperty(ev, 'pointerId', { value: 1 }); return el.dispatchEvent(ev); };
    pe('pointerdown', 100, 100); pe('pointermove', 160, 80); pe('pointerup', 160, 80);
    expect(state!.yaw).not.toBe(0);
    expect(state!.pitch).toBeGreaterThan(0); // arrastrar hacia arriba levanta la vista
    expect(lastMoved).toBe(80);
    pe('pointerdown', 10, 10); pe('pointermove', 12, 10); pe('pointerup', 12, 10);
    expect(lastMoved).toBe(2); // un clic apenas se mueve
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));
    expect(state!.fov).toBe(52);
    state = null; // POV desactivado: los eventos no hacen nada
    pe('pointerdown', 0, 0); pe('pointermove', 50, 50);
    expect(state).toBeNull();
    detach();
  });
});
