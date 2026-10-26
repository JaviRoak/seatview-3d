import { api } from './client';
import type { AuthUser, EventDetail, EventSeatsPayload, EventSummary } from './types';

export const authApi = {
  login: (email: string, password: string) => api<{ user: AuthUser; token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, name: string) => api<{ user: AuthUser; token: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
};

export const eventsApi = {
  list: () => api<{ events: EventSummary[] }>('/events'),
  get: (id: string) => api<{ event: EventDetail }>(`/events/${id}`),
  seats: (id: string) => api<EventSeatsPayload>(`/events/${id}/seats`),
};
export const locksApi = {
  acquire: (eventId: string, eventSeatId: string) => api<{ eventSeatId: string; ttl: number; renewed: boolean }>('/locks', { method: 'POST', body: JSON.stringify({ eventId, eventSeatId }) }),
  release: (eventId: string, eventSeatId: string) => api<{ released: boolean }>('/locks', { method: 'DELETE', body: JSON.stringify({ eventId, eventSeatId }) }),
  extend: (eventId: string, eventSeatId: string) => api<{ eventSeatId: string; ttl: number }>('/locks/extend', { method: 'POST', body: JSON.stringify({ eventId, eventSeatId }) }),
  mine: (eventId: string) => api<{ locks: Array<{ eventSeatId: string; ttl: number }> }>(`/locks/${eventId}`),
};
