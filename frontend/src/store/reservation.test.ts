import { describe, it, expect, beforeEach } from 'vitest';
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

  it('calcula conteo, total y el vencimiento del asiento que vence primero', () => {
    const r = reservationFrom('ev1', [0, 1], new Map([[0, 300], [1, 120]]), (i) => [60, 25][i], 1_000);
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
});
