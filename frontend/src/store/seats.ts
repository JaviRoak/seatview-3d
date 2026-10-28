/**
 * Estado de asientos del evento abierto (issues #6, #7, #8).
 * Los datos llegan del servidor (fuente de verdad) y se guardan en arrays
 * tipados para el InstancedMesh. El cliente nunca decide si un asiento está
 * libre: solo refleja la API y los eventos `seats:update` de Socket.io.
 * `dirty` acumula los índices cuyo color debe repintarse.
 */
import { create } from 'zustand';
import type { EventSeatsPayload, SeatChange, Zone } from '../api/types';

export interface SeatData {
  count: number; ids: string[]; idToIdx: Map<string, number>; zoneIdx: Uint8Array; rows: string[];
  numbers: Int32Array; positions: Float32Array; rotations: Float32Array; zones: Zone[];
  viewPct: Uint8Array; viewRange: { dMin: number; dMax: number };
}

interface SeatsState {
  eventId: string | null;
  data: SeatData | null;
  /** 0 disponible, 1 bloqueado, 2 vendido */
  status: Uint8Array;
  lockedBy: Map<number, string>;
  version: number;
  /** índices seleccionados por el usuario (bloqueados por él) */
  selected: number[];
  hovered: number | null;
  /** asiento en vista POV (resaltado, no reservado) */
  focused: number | null;
  ttls: Map<number, number>;
  dirty: Set<number>;
  repaintAll: boolean;
  load: (eventId: string, payload: EventSeatsPayload) => void;
  applyChanges: (changes: SeatChange[], myUserId: string | null) => void;
  setHovered: (idx: number | null) => void;
  setFocused: (idx: number | null) => void;
  select: (idx: number, ttl: number) => void;
  deselect: (idx: number) => void;
  clearSelection: () => void;
  setTtl: (idx: number, ttl: number) => void;
  markPainted: () => void;
  reset: () => void;
}

/** Convierte la respuesta de la API en arrays tipados. Puro, probado en seats.test.ts. */
export function buildSeatData(p: EventSeatsPayload): SeatData {
  const idToIdx = new Map<string, number>();
  p.ids.forEach((id, i) => idToIdx.set(id, i));
  return {
    count: p.count, ids: p.ids, idToIdx, zoneIdx: Uint8Array.from(p.zoneIdx), rows: p.rows, numbers: Int32Array.from(p.numbers),
    positions: Float32Array.from(p.positions), rotations: Float32Array.from(p.rotations), zones: p.zones,
    viewPct: Uint8Array.from(p.viewPct ?? new Array(p.count).fill(50)), viewRange: p.viewRange ?? { dMin: 0, dMax: 1 },
  };
}

export const useSeatsStore = create<SeatsState>((set, get) => ({
  eventId: null, data: null, status: new Uint8Array(0), lockedBy: new Map(), version: 0, selected: [], hovered: null, focused: null, ttls: new Map(), dirty: new Set(), repaintAll: true,

  load: (eventId, payload) => {
    const lockedBy = new Map<number, string>();
    for (const [k, v] of Object.entries(payload.lockedBy)) lockedBy.set(Number(k), v);
    set({ eventId, data: buildSeatData(payload), status: Uint8Array.from(payload.status), lockedBy, version: get().version + 1, selected: [], hovered: null, focused: null, ttls: new Map(), dirty: new Set(), repaintAll: true });
  },

  applyChanges: (changes, myUserId) => {
    const { data, status, lockedBy, selected, ttls, dirty } = get();
    if (!data) return;
    let selectedChanged = false;
    const nextSelected = [...selected];
    for (const c of changes) {
      const idx = data.idToIdx.get(c.eventSeatId);
      if (idx === undefined) continue;
      dirty.add(idx);
      status[idx] = c.status;
      if (c.status === 1 && c.lockedBy) {
        lockedBy.set(idx, c.lockedBy);
        if (c.lockedBy === myUserId && c.ttl !== undefined) ttls.set(idx, c.ttl);
      } else {
        lockedBy.delete(idx);
        ttls.delete(idx);
        const pos = nextSelected.indexOf(idx);
        if (pos >= 0) { nextSelected.splice(pos, 1); selectedChanged = true; } // perdí el asiento (expiró o se vendió)
      }
    }
    set({ version: get().version + 1, lockedBy: new Map(lockedBy), ttls: new Map(ttls), ...(selectedChanged ? { selected: nextSelected } : {}) });
  },

  setHovered: (idx) => {
    const prev = get().hovered;
    if (prev === idx) return;
    if (prev !== null) get().dirty.add(prev);
    if (idx !== null) get().dirty.add(idx);
    set({ hovered: idx, version: get().version + 1 });
  },
  setFocused: (idx) => {
    const prev = get().focused;
    if (prev === idx) return;
    if (prev !== null) get().dirty.add(prev);
    if (idx !== null) get().dirty.add(idx);
    set({ focused: idx, version: get().version + 1 });
  },
  select: (idx, ttl) => {
    const ttls = new Map(get().ttls); ttls.set(idx, ttl); get().dirty.add(idx);
    set({ selected: Array.from(new Set([...get().selected, idx])), ttls, version: get().version + 1 });
  },
  deselect: (idx) => {
    const ttls = new Map(get().ttls); ttls.delete(idx); get().dirty.add(idx);
    set({ selected: get().selected.filter((i) => i !== idx), ttls, version: get().version + 1 });
  },
  clearSelection: () => { for (const i of get().selected) get().dirty.add(i); set({ selected: [], ttls: new Map(), version: get().version + 1 }); },
  setTtl: (idx, ttl) => { const ttls = new Map(get().ttls); ttls.set(idx, ttl); set({ ttls }); },
  markPainted: () => { get().dirty.clear(); set({ repaintAll: false }); },
  reset: () => set({ eventId: null, data: null, status: new Uint8Array(0), lockedBy: new Map(), selected: [], hovered: null, focused: null, ttls: new Map(), version: 0, dirty: new Set(), repaintAll: true }),
}));

/** Etiqueta legible: "Tribuna Este · Nivel 1 · Fila C · Asiento 12". */
export function seatLabel(data: SeatData, idx: number): string {
  if (data.rows[idx] === 'GA') return `${data.zones[data.zoneIdx[idx]]?.name ?? 'Zona'} · Entrada sin asiento asignado`;
  return `${data.zones[data.zoneIdx[idx]]?.name ?? 'Zona'} · Fila ${data.rows[idx]} · Asiento ${data.numbers[idx]}`;
}
