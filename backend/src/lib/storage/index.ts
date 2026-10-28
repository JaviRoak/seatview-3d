import path from 'path';
import { LocalStorageProvider } from './LocalStorageProvider';
import type { StorageProvider } from './StorageProvider';

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
export const storage: StorageProvider = new LocalStorageProvider(UPLOADS_DIR);
export type { StorageProvider } from './StorageProvider';
