/** Tipos compartidos con la API (espejo de las respuestas del backend). */
export interface AuthUser { id: string; email: string; name: string; role: 'USER' | 'ADMIN' }
export type EventCategory = 'FUTBOL' | 'CONCIERTO' | 'OTRO';
export interface EventSummary { id: string; name: string; description: string | null; date: string; category: EventCategory; coverImageUrl: string | null; venue: { id: string; name: string; city: string }; totalSeats: number; soldSeats: number }
export interface Zone { id: string; name: string; color: string; price: number; generalAdmission?: boolean; capacity?: number }
export interface LevelSpec { name: string; rows: number; rowDepth: number; rowRise: number; baseHeight: number; baseOffset: number }
export interface VenueModel { url: string; radius: number; height: number; seatingFootprint: { width: number; depth: number } }
export interface VenueLayout { concert?: { kind: 'beele' | 'bocelli'; demo: boolean }; admission?: { mode: 'mixed'; crowdUrl: string }; model?: VenueModel; field: { width: number; depth: number }; corner: number; seatPitch: number; aisleAngle: number; levels: LevelSpec[]; stands: string[] }
export interface EventDetail { id: string; name: string; description: string | null; date: string; category: EventCategory; coverImageUrl: string | null; venue: { id: string; name: string; city: string; imageUrl: string | null; layout: VenueLayout; zones: Zone[] } }
/** Respuesta compacta de /events/:id/seats (arrays paralelos). */
export interface EventSeatsPayload {
  eventId: string; count: number; ids: string[]; seatIds: string[]; zoneIdx: number[]; rows: string[]; numbers: number[];
  positions: number[]; rotations: number[]; status: number[]; lockedBy: Record<number, string>; zones: Zone[];
  /** percentil de calidad de vista 0..100 dentro del recinto */
  viewPct: number[];
  viewRange: { dMin: number; dMax: number };
}
export interface SeatChange { eventSeatId: string; status: 0 | 1 | 2; lockedBy?: string; ttl?: number }
