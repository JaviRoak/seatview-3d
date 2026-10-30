import { api } from './client';
import type { AdminEvent, AuthUser, EventCategory, EventDetail, EventSeatsPayload, EventSummary, MediaAsset, Ticket } from './types';
import { API_URL } from './client';
import { useAuthStore } from '../store/auth';

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
  /** Zonas sin asiento: aparta `quantity` cupos de la zona. */
  zone: (eventId: string, zoneId: string, quantity: number) => api<{ locks: Array<{ eventSeatId: string; ttl: number }> }>('/locks/zone', { method: 'POST', body: JSON.stringify({ eventId, zoneId, quantity }) }),
  mine: (eventId: string) => api<{ locks: Array<{ eventSeatId: string; ttl: number }> }>(`/locks/${eventId}`),
};
export interface CardInput { holder: string; number: string; expMonth: number; expYear: number; cvc: string }
export const paymentsApi = {
  checkout: (eventId: string, eventSeatIds: string[], card: CardInput) =>
    api<{ orderId: string; total: number; authCode: string; tickets: Array<{ id: string; eventSeatId: string; code: string; qrData: string }> }>('/payments/checkout', { method: 'POST', body: JSON.stringify({ eventId, eventSeatIds, card }) }),
};
export const ticketsApi = { mine: () => api<{ tickets: Ticket[] }>('/tickets/mine') };

export const adminApi = {
  events: () => api<{ events: AdminEvent[] }>('/admin/events'),
  patchEvent: (id: string, body: { coverImageUrl?: string | null; category?: EventCategory }) => api<{ event: AdminEvent }>(`/admin/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUpload: (id: string) => api<{ deleted: boolean }>(`/admin/uploads/${id}`, { method: 'DELETE' }),
  /** Subida con XMLHttpRequest para poder reportar progreso. */
  upload: (file: File, onProgress: (pct: number) => void) =>
    new Promise<MediaAsset>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api/admin/uploads`);
      const token = useAuthStore.getState().token;
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) resolve(body.asset);
          else reject(new Error(body.error ?? `Error ${xhr.status}`));
        } catch { reject(new Error('Respuesta inválida del servidor')); }
      };
      xhr.onerror = () => reject(new Error('No se pudo conectar con el servidor'));
      const fd = new FormData();
      fd.append('file', file);
      xhr.send(fd);
    }),
};
