/**
 * Tiempo real con Socket.io (issue #6).
 * - Handshake autenticado con JWT (auth.token); sin token se permite solo
 *   espectador (ver mapa).
 * - Salas por evento: `event:{eventId}`. Cada cambio se emite con el mínimo
 *   de datos (id + nuevo estado), no el mapa completo.
 */
import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { verifyToken } from '../modules/auth/auth.service';
import { corsOrigins } from '../config/env';

export type SeatStatusCode = 0 | 1 | 2; // AVAILABLE, LOCKED, SOLD
export interface SeatChange { eventSeatId: string; status: SeatStatusCode; lockedBy?: string; ttl?: number }
export interface SeatUpdateEvent { eventId: string; changes: SeatChange[]; at: number }

let io: Server | null = null;

export function initSockets(server: HttpServer): Server {
  io = new Server(server, { cors: { origin: corsOrigins, credentials: true } });

  io.use((socket, next) => {
    const token = (socket.handshake.auth?.token as string | undefined) ?? null;
    if (!token) { socket.data.user = null; return next(); }
    try { socket.data.user = verifyToken(token); next(); } catch { next(new Error('Token inválido')); }
  });

  io.on('connection', (socket: Socket) => {
    socket.on('event:join', (eventId: unknown) => {
      if (typeof eventId !== 'string' || eventId.length > 64) return;
      for (const room of socket.rooms) if (room.startsWith('event:')) socket.leave(room);
      socket.join(`event:${eventId}`);
    });
    socket.on('event:leave', (eventId: unknown) => { if (typeof eventId === 'string') socket.leave(`event:${eventId}`); });
  });
  return io;
}

/** Emite cambios de asientos a todos los clientes viendo el evento. */
export function emitSeatUpdate(eventId: string, changes: SeatChange[]) {
  if (!io || changes.length === 0) return;
  const payload: SeatUpdateEvent = { eventId, changes, at: Date.now() };
  io.to(`event:${eventId}`).emit('seats:update', payload);
}
