/**
 * Guarda los archivos en backend/uploads/ (ignorado por git, con .gitkeep) y
 * los sirve estáticamente en /uploads. Los nombres son UUID + extensión: el
 * nombre original nunca toca el disco (evita colisiones y path traversal).
 */
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { StorageProvider, SavedFile } from './StorageProvider';

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly dir: string, private readonly publicPath = '/uploads') {}

  async save(buffer: Buffer, ext: string): Promise<SavedFile> {
    await fs.mkdir(this.dir, { recursive: true });
    const key = `${randomUUID()}.${ext}`;
    await fs.writeFile(path.join(this.dir, key), buffer);
    return { key, url: this.getUrl(key) };
  }

  async delete(key: string): Promise<void> {
    // Solo nombres planos: nunca rutas.
    if (!/^[\w.-]+$/.test(key)) throw new Error('Clave de archivo inválida');
    await fs.unlink(path.join(this.dir, key)).catch((e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e; });
  }

  getUrl(key: string): string {
    return `${this.publicPath}/${key}`;
  }
}
