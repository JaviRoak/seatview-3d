import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Color, InstancedMesh, MeshBasicMaterial } from 'three';
import { useAuthStore } from '../store/auth';
import { useSeatsStore } from '../store/seats';
import { useSeatInstanceColors } from './useSeatInstanceColors';

const indices = [1, 3, 4]; // GA entries are not chair instances.
let mesh: InstancedMesh;
const colorAt = (instance: number) => {
  const color = new Color();
  mesh.getColorAt(instance, color);
  return color.getHex();
};
function mount(mapped = true) {
  const ref = { current: mesh };
  const data = useSeatsStore.getState().data;
  return renderHook(() => useSeatInstanceColors(ref, data, mapped ? indices : undefined));
}
beforeEach(() => {
  useAuthStore.setState({ user: { id: 'me', name: 'Test', email: 'test@example.test', role: 'USER' } });
  useSeatsStore.getState().load('test', {
    eventId: 'test', count: 5, ids: ['ga1', 'table1', 'ga2', 'table2', 'vip'],
    seatIds: ['ga1', 'table1', 'ga2', 'table2', 'vip'],
    zoneIdx: [0, 0, 0, 0, 0], rows: ['GA', 'M001', 'GA', 'M001', 'A01'],
    numbers: [1, 1, 2, 2, 1], positions: Array(15).fill(0), rotations: Array(5).fill(0),
    status: [0, 0, 0, 0, 0], lockedBy: {},
    viewPct: [50, 50, 50, 50, 50], viewRange: { dMin: 0, dMax: 100 },
    zones: [{ id: 'z', name: 'Platinum', color: '#204060', price: 95 }],
  });
  mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 5);
});
afterEach(() => {
  cleanup(); mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose(); mesh.dispose();
  useSeatsStore.getState().reset(); useAuthStore.setState({ user: null });
});

describe('shared chair highlighting', () => {
  it('maps hover to the right table chair, restores the previous chair, and leaves transforms untouched', () => {
    mount();
    const paint = vi.spyOn(mesh, 'setColorAt');
    const matrixVersion = mesh.instanceMatrix.version;
    act(() => useSeatsStore.getState().setHovered(3));
    expect(colorAt(0)).toBe(0x204060);
    expect(colorAt(1)).toBe(0x6787a7);
    expect(paint.mock.calls.map(call => call[0])).toEqual([1]);
    act(() => useSeatsStore.getState().setHovered(1));
    expect(colorAt(0)).toBe(0x6787a7);
    expect(colorAt(1)).toBe(0x204060);
    act(() => useSeatsStore.getState().setHovered(null));
    expect(colorAt(0)).toBe(0x204060);
    expect(mesh.instanceMatrix.version).toBe(matrixVersion);
  });

  it('keeps the focused chair highlighted after pointer exit, and clears it on overview', () => {
    mount();
    act(() => { useSeatsStore.getState().setHovered(4); useSeatsStore.getState().setFocused(4); });
    act(() => useSeatsStore.getState().setHovered(null));
    expect(colorAt(2)).toBe(0x6787a7);
    act(() => useSeatsStore.getState().setFocused(null));
    expect(colorAt(2)).toBe(0x204060);
  });

  it('distinguishes my reservation, another person’s lock, sold seats and release', () => {
    mount();
    act(() => {
      useSeatsStore.getState().applyChanges([
        { eventSeatId: 'table1', status: 1, lockedBy: 'me' },
        { eventSeatId: 'table2', status: 1, lockedBy: 'other' },
        { eventSeatId: 'vip', status: 2 },
      ], 'me');
      useSeatsStore.getState().select(1, 300);
      useSeatsStore.getState().setHovered(4);
    });
    expect([colorAt(0), colorAt(1), colorAt(2)]).toEqual([0xffb020, 0x4b5563, 0x4a1d21]);
    act(() => useSeatsStore.getState().applyChanges([{ eventSeatId: 'table1', status: 0 }], 'me'));
    expect(colorAt(0)).toBe(0x204060);
  });

  it('ignores GA changes and repaints ownership when signing in without seat updates', () => {
    useSeatsStore.getState().applyChanges([{ eventSeatId: 'table1', status: 1, lockedBy: 'me' }], 'me');
    useAuthStore.setState({ user: null });
    mount();
    const paint = vi.spyOn(mesh, 'setColorAt');
    act(() => useSeatsStore.getState().setHovered(2));
    expect(paint).not.toHaveBeenCalled();
    expect(colorAt(0)).toBe(0x4b5563);
    act(() => useAuthStore.setState({ user: { id: 'me', name: 'Test', email: 'test@example.test', role: 'USER' } }));
    expect(colorAt(0)).toBe(0xffb020);
  });

  it('also supports the unfiltered renderer used by other events', () => {
    mount(false);
    act(() => useSeatsStore.getState().setHovered(3));
    expect(colorAt(1)).toBe(0x204060);
    expect(colorAt(3)).toBe(0x6787a7);
  });
});
