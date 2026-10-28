/** Cliente HTTP mínimo: adjunta el JWT y normaliza los errores de la API en ApiError. */
import { useAuthStore } from '../store/auth';
import { API_URL } from './config';

export { API_URL } from './config';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = 'ERROR', public details?: unknown) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && token) useAuthStore.getState().logout();
    throw new ApiError(res.status, body?.error ?? res.statusText, body?.code, body?.details);
  }
  return body as T;
}
