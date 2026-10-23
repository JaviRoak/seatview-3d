/**
 * Origen de la API y del socket. Semántica: variable vacía o ausente = cadena vacía =
 * MISMO ORIGEN (en desarrollo, el proxy de Vite; en producción, un backend servido bajo
 * el mismo dominio). Nunca se embebe un localhost en el bundle.
 */
export function resolveBaseUrl(raw: string | undefined): string {
  const v = (raw ?? '').trim().replace(/\/+$/, '');
  return v;
}

export const API_URL = resolveBaseUrl(import.meta.env.VITE_API_URL);
export const SOCKET_URL = resolveBaseUrl(import.meta.env.VITE_SOCKET_URL) || API_URL;

/**
 * En producción no hay forma de detectar automáticamente si el backend vive en otro
 * dominio, así que si la variable está vacía se avisa (sin bloquear la app).
 */
export function warnIfMisconfigured(isProd = import.meta.env.PROD) {
  if (isProd && !API_URL && typeof console !== 'undefined') {
    console.warn(
      '[SeatView 3D] VITE_API_URL está vacía: la app usará el mismo origen (%s) para /api y /socket.io. ' +
        'Si el backend está en otro dominio (p. ej. Railway), define VITE_API_URL y VITE_SOCKET_URL al compilar el frontend.',
      typeof location !== 'undefined' ? location.origin : '(desconocido)',
    );
  }
}
