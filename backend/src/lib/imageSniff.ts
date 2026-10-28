/**
 * Detección del tipo REAL de imagen por "magic bytes", sin confiar en la
 * extensión ni en el Content-Type que envía el cliente.
 *  JPEG: FF D8 FF · PNG: 89 50 4E 47 0D 0A 1A 0A · WebP: "RIFF" .... "WEBP"
 */
export type ImageKind = { mime: 'image/jpeg'; ext: 'jpg' } | { mime: 'image/png'; ext: 'png' } | { mime: 'image/webp'; ext: 'webp' };

export function sniffImage(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}

/** Nombre de archivo saneado solo para mostrar en el registro (no se usa en disco). */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'archivo';
  return base.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]/g, '_').slice(0, 120) || 'archivo';
}
