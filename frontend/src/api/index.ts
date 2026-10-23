import { api } from './client';
import type { EventDetail, EventSeatsPayload, EventSummary } from './types';

export const eventsApi = {
  list: () => api<{ events: EventSummary[] }>('/events'),
  get: (id: string) => api<{ event: EventDetail }>(`/events/${id}`),
  seats: (id: string) => api<EventSeatsPayload>(`/events/${id}/seats`),
};
