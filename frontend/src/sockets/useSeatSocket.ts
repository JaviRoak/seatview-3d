/** Socket.io autenticado (issue #6): se une a la sala del evento y aplica cambios al store. */
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/auth';
import { useSeatsStore } from '../store/seats';
import type { SeatUpdateEvent } from '../api/types';
import { SOCKET_URL } from '../api/config';

export function useSeatSocket(eventId: string | undefined) {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!eventId) return;
    const opts = { auth: token ? { token } : {}, transports: ['websocket', 'polling'] as string[] };
    // URL vacía = mismo origen: socket.io-client acepta io(opts) sin URL (usa location.origin).
    const socket = SOCKET_URL ? io(SOCKET_URL, opts) : io(opts);
    socket.on('connect', () => { setConnected(true); socket.emit('event:join', eventId); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('seats:update', (payload: SeatUpdateEvent) => {
      if (payload.eventId === eventId) useSeatsStore.getState().applyChanges(payload.changes, userId);
    });
    return () => { socket.emit('event:leave', eventId); socket.disconnect(); };
  }, [eventId, token, userId]);
  return { connected };
}
