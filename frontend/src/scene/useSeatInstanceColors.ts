import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Color, type InstancedMesh } from 'three';
import { useAuthStore } from '../store/auth';
import { useSeatsStore, type SeatData } from '../store/seats';
import { seatColorHex } from './seatColors';

/** Shared visual states, including meshes that contain only numbered seats. */
export function useSeatInstanceColors(meshRef: RefObject<InstancedMesh>, data: SeatData | null, indices?: number[]) {
  const version = useSeatsStore(s => s.version);
  const userId = useAuthStore(s => s.user?.id ?? null);
  const instances = useMemo(() => indices ? new Map(indices.map((seat, instance) => [seat, instance])) : null, [indices]);
  const previous = useRef<{ data: SeatData; userId: string | null; indices?: number[]; mesh: InstancedMesh }>();

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !data) return;
    const state = useSeatsStore.getState();
    const selected = new Set(state.selected);
    const color = new Color();
    const paint = (seat: number, instance: number) => {
      color.setHex(seatColorHex({
        status: state.status[seat] as 0 | 1 | 2,
        mine: userId !== null && state.lockedBy.get(seat) === userId,
        hovered: state.hovered === seat,
        focused: state.focused === seat,
        selected: selected.has(seat),
      }, data.zones[data.zoneIdx[seat]]?.color ?? '#888888'));
      mesh.setColorAt(instance, color);
    };
    const prev = previous.current;
    if (state.repaintAll || !mesh.instanceColor || prev?.mesh !== mesh || prev.data !== data || prev.userId !== userId || prev.indices !== indices) {
      if (indices) indices.forEach(paint);
      else for (let seat = 0; seat < data.count; seat++) paint(seat, seat);
    } else {
      for (const seat of state.dirty) {
        const instance = instances ? instances.get(seat) : seat;
        if (instance !== undefined) paint(seat, instance);
      }
    }
    previous.current = { data, userId, indices, mesh };
    state.markPainted();
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [version, data, userId, indices, instances, meshRef]);
}
