import { describe, it, expect, vi } from 'vitest';
import { resolveBaseUrl, warnIfMisconfigured, API_URL, SOCKET_URL } from './config';

describe('origen de la API', () => {
  it('vacío o ausente → mismo origen (cadena vacía), nunca localhost', () => {
    expect(resolveBaseUrl(undefined)).toBe('');
    expect(resolveBaseUrl('')).toBe('');
    expect(resolveBaseUrl('   ')).toBe('');
    expect(resolveBaseUrl('https://api.ejemplo.com/')).toBe('https://api.ejemplo.com');
    expect(API_URL).not.toContain('localhost');
    expect(SOCKET_URL).not.toContain('localhost');
  });
  it('en producción con la variable vacía avisa en consola sin lanzar', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => warnIfMisconfigured(true)).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(API_URL ? 0 : 1);
    spy.mockRestore();
  });
});
