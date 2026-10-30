/**
 * Reserva en curso, visible en todas las pantallas (chip del encabezado).
 * Se deriva del store de asientos: usa el vencimiento absoluto de cada asiento,
 * que solo cambia al apartarlo o extenderlo (no con cada evento del socket). Se guarda en localStorage
 * para que el chip sobreviva a una recarga; el servidor sigue siendo la fuente
 * de verdad y `refresh` la confirma con GET /locks/:eventId.
 */
import { create } from 'zustand';
import { locksApi } from '../api';
import { useSeatsStore } from './seats';

export interface Reservation { eventId: string; count: number; total: number; expiresAt: number }
interface ReservationState {
  current: Reservation | null;
  set: (r: Reservation | null) => void;
  /** Confirma la reserva guardada contra el servidor (tras una recarga o al iniciar sesión). */
  refresh: () => Promise<void>;
}

const KEY = 'seatview.reservation';
function load(): Reservation | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Reservation | null;
    return r && r.expiresAt > Date.now() ? r : null;
  } catch { return null; }
}

export const useReservationStore = create<ReservationState>((set, get) => ({
  current: load(),
  set: (current) => {
    try { if (current) localStorage.setItem(KEY, JSON.stringify(current)); else localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
    set({ current });
  },
  refresh: async () => {
    const r = get().current;
    if (!r) return;
    try {
      const { locks } = await locksApi.mine(r.eventId);
      if (!locks.length) return get().set(null);
      get().set({ ...r, count: locks.length, expiresAt: Date.now() + Math.min(...locks.map((l) => l.ttl)) * 1000 });
    } catch { get().set(null); }
  },
}));

/** La reserva vence cuando vence el primero de sus asientos. */
export function reservationFrom(eventId: string | null, selected: number[], expiresAt: Map<number, number>, price: (i: number) => number): Reservation | null {
  if (!eventId || !selected.length) return null;
  return { eventId, count: selected.length, total: selected.reduce((a, i) => a + price(i), 0), expiresAt: Math.min(...selected.map((i) => expiresAt.get(i) ?? 0)) };
}

useSeatsStore.subscribe((s, prev) => {
  if (s.selected === prev.selected && s.expiresAt === prev.expiresAt) return;
  const current = useReservationStore.getState().current;
  // Cargar otro evento vacía la selección local, pero no libera la reserva de su evento en el servidor.
  if (!s.selected.length && current && current.eventId !== s.eventId) return;
  useReservationStore.getState().set(reservationFrom(s.eventId, s.selected, s.expiresAt, (i) => s.data?.zones[s.data.zoneIdx[i]]?.price ?? 0));
});
