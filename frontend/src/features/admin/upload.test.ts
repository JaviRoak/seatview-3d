import { describe, it, expect } from 'vitest';
import { validateImageFile } from './UploadDrop';

const mk = (type: string, size: number) => new File([new Uint8Array(size)], 'x', { type });

describe('validación local de imágenes', () => {
  it('acepta jpeg/png/webp dentro del límite', () => {
    expect(validateImageFile(mk('image/png', 1000))).toBeNull();
    expect(validateImageFile(mk('image/webp', 1000))).toBeNull();
  });
  it('rechaza tipo no permitido y exceso de tamaño con mensajes en español', () => {
    expect(validateImageFile(mk('image/gif', 1000))).toMatch(/JPEG, PNG o WebP/);
    expect(validateImageFile(mk('image/png', 3 * 1024 * 1024))).toMatch(/máximo es 2 MB/);
  });
});
