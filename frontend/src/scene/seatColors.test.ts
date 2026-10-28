import { describe, it, expect } from 'vitest';
import { seatColorHex, hexToRgb, rgbToHex, COLORS, SeatStatus } from './seatColors';

const base = { mine: false, hovered: false, selected: false } as const;

describe('mapeo estado → color', () => {
  it('disponible usa el color de la zona', () => {
    expect(seatColorHex({ ...base, status: SeatStatus.AVAILABLE }, '#3b82f6')).toBe(0x3b82f6);
  });
  it('bloqueado por otro es gris; bloqueado por mí es ámbar', () => {
    expect(seatColorHex({ ...base, status: SeatStatus.LOCKED }, '#3b82f6')).toBe(parseInt(COLORS.lockedOther.slice(1), 16));
    expect(seatColorHex({ ...base, status: SeatStatus.LOCKED, mine: true }, '#3b82f6')).toBe(parseInt(COLORS.lockedMine.slice(1), 16));
  });
  it('vendido ignora zona, hover y selección', () => {
    const sold = parseInt(COLORS.sold.slice(1), 16);
    expect(seatColorHex({ ...base, status: SeatStatus.SOLD }, '#3b82f6')).toBe(sold);
    expect(seatColorHex({ ...base, status: SeatStatus.SOLD, hovered: true, selected: true }, '#3b82f6')).toBe(sold);
  });
  it('hover aclara el color', () => {
    const normal = seatColorHex({ ...base, status: SeatStatus.AVAILABLE }, '#204060');
    const hover = seatColorHex({ ...base, status: SeatStatus.AVAILABLE, hovered: true }, '#204060');
    expect(hover).toBeGreaterThan(normal);
  });
  it('conversión hex ↔ rgb es consistente', () => {
    expect(rgbToHex(...hexToRgb('#ffb020'))).toBe(0xffb020);
    expect(hexToRgb('#fff')).toEqual([1, 1, 1]);
  });
});
