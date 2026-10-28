/**
 * Abstracción de almacenamiento de archivos subidos (imágenes de eventos).
 * Solo se implementa LocalStorageProvider; ver docs/imagenes.md para añadir
 * S3, Cloudinary o Supabase Storage (necesario en Railway, cuyo sistema de
 * archivos no persiste entre despliegues).
 */
export interface SavedFile {
  /** Identificador estable del archivo dentro del proveedor (p. ej. "3f9c….webp") */
  key: string;
  /** URL pública (relativa o absoluta) */
  url: string;
}

export interface StorageProvider {
  save(buffer: Buffer, ext: string, mimeType: string): Promise<SavedFile>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}
