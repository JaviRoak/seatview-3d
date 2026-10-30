import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reservationFrom, useReservationStore } from './reservation';
import { useSeatsStore } from './seats';
import type { EventSeatsPayload } from '../api/types';

const payload: EventSeatsPayload = {
  eventId: 'ev1', count: 2, ids: ['a', 'b'], seatIds: ['s1', 's2'], zoneIdx: [0, 1], rows: ['A', 'GA'], numbers: [1, 1],
  positions: [0, 0, 0, 1, 0, 0], rotations: [0, 0], status: [0, 0], lockedBy: {}, viewPct: [50, 50], viewRange: { dMin: 0, dMax: 1 },
  zones: [{ id: 'z1', name: 'Platea', color: '#fff', price: 60 }, { id: 'z2', name: 'Sol', color: '#fff', price: 25 }],
};

describe('reserva visible en todas las pantallas', () => {
  beforeEach(() => { useSeatsStore.getState().reset(); useReservationStore.getState().set(null); });
  afterEach(() => { vi.useRealTimers(); });

  it('calcula conteo, total y el vencimiento del asiento que vence primero', () => {
    const r = reservationFrom('ev1', [0, 1], new Map([[0, 301_000], [1, 121_000]]), (i) => [60, 25][i]);
    expect(r).toEqual({ eventId: 'ev1', count: 2, total: 85, expiresAt: 121_000 });
    expect(reservationFrom('ev1', [], new Map(), () => 0)).toBeNull();
  });

  it('sigue al store de asientos y se vacía al liberar o pagar', () => {
    useSeatsStore.getState().load('ev1', payload);
    useSeatsStore.getState().select(0, 300);
    useSeatsStore.getState().select(1, 300);
    expect(useReservationStore.getState().current).toMatchObject({ eventId: 'ev1', count: 2, total: 85 });
    useSeatsStore.getState().clearSelection();
    expect(useReservationStore.getState().current).toBeNull();
  });

  it('cargar otro evento no borra la reserva del anterior', () => {
    useSeatsStore.getState().load('ev1', payload);
    useSeatsStore.getState().select(0, 300);
    useSeatsStore.getState().load('ev2', { ...payload, eventId: 'ev2' });
    expect(useReservationStore.getState().current?.eventId).toBe('ev1');
  });

  it('el vencimiento no se reinicia con eventos ajenos ni al apartar otro asiento', () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    useSeatsStore.getState().load('ev1', payload);
    useSeatsStore.getState().select(0, 300);
    vi.setSystemTime(200_000);
    useSeatsStore.getState().applyChanges([{ eventSeatId: 'b', status: 1, lockedBy: 'otro' }], 'yo');
    expect(useReservationStore.getState().current?.expiresAt).toBe(300_000);
    useSeatsStore.getState().applyChanges([{ eventSeatId: 'b', status: 0 }], 'yo');
    useSeatsStore.getState().select(1, 300);
    expect(useReservationStore.getState().current?.expiresAt).toBe(300_000);
    useSeatsStore.getState().setTtl(0, 300); // extender renueva aunque el TTL sea el mismo
    expect(useReservationStore.getState().current?.expiresAt).toBe(500_000);
  });
});
