/** Error HTTP con código de estado y código de negocio legible. */
export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly code: string = 'ERROR', public readonly details?: unknown) {
    super(message);
  }
}
export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, 'BAD_REQUEST', details);
export const unauthorized = (msg = 'No autenticado') => new HttpError(401, msg, 'UNAUTHORIZED');
export const forbidden = (msg = 'Sin permisos') => new HttpError(403, msg, 'FORBIDDEN');
export const notFound = (msg = 'No encontrado') => new HttpError(404, msg, 'NOT_FOUND');
export const conflict = (msg: string, code = 'CONFLICT', details?: unknown) => new HttpError(409, msg, code, details);
