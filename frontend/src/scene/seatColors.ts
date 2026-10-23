/**
 * Mapeo estado → color de cada instancia (issue #6). Puro, sin Three.js, probado con Vitest.
 * Las zonas llegan del servidor en tonos apagados; los estados usan los únicos colores saturados.
 */
export const SeatStatus = { AVAILABLE: 0, LOCKED: 1, SOLD: 2 } as const;
export type SeatStatusCode = 0 | 1 | 2;
export interface SeatVisualState { status: SeatStatusCode; mine: boolean; hovered: boolean; selected: boolean; focused?: boolean }
export const COLORS = { lockedOther: '#4b5563', lockedMine: '#ffb020', sold: '#4a1d21', focus: '#ffffff', hoverBoost: 0.28 };

export function seatColorHex(state: SeatVisualState, zoneColor: string): number {
  let base: string;
  if (state.status === SeatStatus.SOLD) base = COLORS.sold;
  else if (state.status === SeatStatus.LOCKED) base = state.mine ? COLORS.lockedMine : COLORS.lockedOther;
  else base = zoneColor;
  let [r, g, b] = hexToRgb(base);
  if (state.selected && state.status !== SeatStatus.SOLD) {
    const [ar, ag, ab] = hexToRgb(COLORS.lockedMine);
    r = (r + ar) / 2; g = (g + ag) / 2; b = (b + ab) / 2;
  }
  if ((state.hovered || state.focused) && state.status !== SeatStatus.SOLD) {
    r = Math.min(1, r + COLORS.hoverBoost); g = Math.min(1, g + COLORS.hoverBoost); b = Math.min(1, b + COLORS.hoverBoost);
  }
  return rgbToHex(r, g, b);
}
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function rgbToHex(r: number, g: number, b: number): number {
  const c = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return (c(r) << 16) | (c(g) << 8) | c(b);
}
