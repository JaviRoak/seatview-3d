import { describe, it, expect, beforeEach } from 'vitest';
import { buildSeatData, seatLabel, useSeatsStore } from './seats';
import type { EventSeatsPayload } from '../api/types';

const payload: EventSeatsPayload = {
  eventId: 'ev1', count: 3, ids: ['a', 'b', 'c'], seatIds: ['s1', 's2', 's3'], zoneIdx: [0, 0, 1], rows: ['A', 'A', 'B'], numbers: [1, 2, 1],
  positions: [1, 0, 0, 2, 0, 0, 3, 1, 0], rotations: [0, 0.5, 1], status: [0, 1, 2], lockedBy: { 1: 'user-x' }, viewPct: [50, 60, 70], viewRange: { dMin: 1, dMax: 3 },
  zones: [{ id: 'z1', name: 'Tribuna Este · Nivel 1', color: '#3b82f6', price: 45 }, { id: 'z2', name: 'Tribuna Norte · Nivel 1', color: '#8b5cf6', price: 25 }],
};

describe('mapeo de asientos de la API al store', () => {
  beforeEach(() => useSeatsStore.getState().reset());

  it('construye arrays tipados e índice inverso', () => {
    const d = buildSeatData(payload);
    expect(d.count).toBe(3);
    expect(d.positions).toBeInstanceOf(Float32Array);
    expect(d.positions.length).toBe(9);
    expect(d.idToIdx.get('c')).toBe(2);
    expect(d.zoneIdx[2]).toBe(1);
    expect(seatLabel(d, 2)).toBe('Tribuna Norte · Nivel 1 · Fila B · Asiento 1');
  });

  it('carga estado y dueños de bloqueo', () => {
    useSeatsStore.getState().load('ev1', payload);
    const st = useSeatsStore.getState();
    expect(Array.from(st.status)).toEqual([0, 1, 2]);
    expect(st.lockedBy.get(1)).toBe('user-x');
    expect(st.repaintAll).toBe(true);
  });

  it('aplica cambios de sockets tocando solo las instancias afectadas', () => {
    useSeatsStore.getState().load('ev1', payload);
    useSeatsStore.getState().markPainted();
    useSeatsStore.getState().applyChanges([{ eventSeatId: 'a', status: 1, lockedBy: 'me', ttl: 300 }], 'me');
    const st = useSeatsStore.getState();
    expect(st.status[0]).toBe(1);
    expect(st.lockedBy.get(0)).toBe('me');
    expect(st.ttls.get(0)).toBe(300);
    expect(Array.from(st.dirty)).toEqual([0]);
    expect(st.repaintAll).toBe(false);
  });

  it('quita de la selección un asiento cuyo bloqueo expiró o se vendió', () => {
    useSeatsStore.getState().load('ev1', payload);
    useSeatsStore.getState().select(0, 300);
    expect(useSeatsStore.getState().selected).toEqual([0]);
    useSeatsStore.getState().applyChanges([{ eventSeatId: 'a', status: 0 }], 'me');
    expect(useSeatsStore.getState().selected).toEqual([]);
    expect(useSeatsStore.getState().ttls.has(0)).toBe(false);
  });

  it('ignora ids desconocidos', () => {
    useSeatsStore.getState().load('ev1', payload);
    expect(() => useSeatsStore.getState().applyChanges([{ eventSeatId: 'zzz', status: 2 }], null)).not.toThrow();
  });
});
