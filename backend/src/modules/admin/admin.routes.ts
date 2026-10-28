/**
 * Administración (issue #11): carga de imágenes y edición de eventos.
 * Todas las rutas requieren JWT con rol ADMIN.
 *  POST   /api/admin/uploads          multipart "file" → { asset }
 *  DELETE /api/admin/uploads/:id      borra archivo y registro; desasigna de eventos
 *  GET    /api/admin/events           lista con imagen y categoría
 *  PATCH  /api/admin/events/:id       { coverImageUrl?, category? }
 */
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { storage } from '../../lib/storage';
import { sniffImage, sanitizeFilename } from '../../lib/imageSniff';
import { HttpError, notFound, badRequest } from '../../lib/errors';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    // Primer filtro (barato) por el tipo declarado; el tipo real se verifica después con magic bytes.
    if (!ALLOWED_MIME.includes(file.mimetype)) return cb(new HttpError(415, 'Solo se permiten imágenes JPEG, PNG o WebP', 'UNSUPPORTED_TYPE'));
    cb(null, true);
  },
});

adminRouter.post('/uploads', (req, res, next) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, `La imagen supera el tamaño máximo de ${Math.round(env.UPLOAD_MAX_BYTES / 1024 / 1024)} MB`, 'FILE_TOO_LARGE'));
    }
    if (err) return next(err);
    next();
  });
}, async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw badRequest('Falta el archivo (campo "file")');
    const kind = sniffImage(file.buffer);
    if (!kind) throw new HttpError(415, 'El contenido del archivo no es una imagen JPEG, PNG o WebP válida', 'UNSUPPORTED_TYPE');
    const saved = await storage.save(file.buffer, kind.ext, kind.mime);
    const asset = await prisma.mediaAsset.create({
      data: { filename: sanitizeFilename(file.originalname), mimeType: kind.mime, size: file.size, url: saved.url, uploadedById: req.user!.id },
    });
    res.status(201).json({ asset });
  } catch (e) { next(e); }
});

adminRouter.delete('/uploads/:id', validate('params', z.object({ id: z.string().min(1) })), async (req, res, next) => {
  try {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) throw notFound('Archivo no encontrado');
    const key = asset.url.split('/').pop()!;
    await storage.delete(key);
    await prisma.$transaction([
      prisma.event.updateMany({ where: { coverImageUrl: asset.url }, data: { coverImageUrl: null } }),
      prisma.venue.updateMany({ where: { imageUrl: asset.url }, data: { imageUrl: null } }),
      prisma.mediaAsset.delete({ where: { id: asset.id } }),
    ]);
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

adminRouter.get('/events', async (_req, res, next) => {
  try {
    const events = await prisma.event.findMany({ orderBy: { date: 'asc' }, include: { venue: { select: { name: true } } } });
    const assets = await prisma.mediaAsset.findMany({ select: { id: true, url: true } });
    const assetByUrl = new Map(assets.map((a) => [a.url, a.id]));
    res.json({
      events: events.map((e) => ({ id: e.id, name: e.name, date: e.date, category: e.category, coverImageUrl: e.coverImageUrl, venue: e.venue.name, assetId: e.coverImageUrl ? assetByUrl.get(e.coverImageUrl) ?? null : null })),
    });
  } catch (e) { next(e); }
});

const patchSchema = z.object({
  coverImageUrl: z.string().max(500).nullable().optional(),
  category: z.enum(['FUTBOL', 'CONCIERTO', 'OTRO']).optional(),
});

adminRouter.patch('/events/:id', validate('params', z.object({ id: z.string().min(1) })), validate('body', patchSchema), async (req, res, next) => {
  try {
    const { coverImageUrl, category } = req.body as z.infer<typeof patchSchema>;
    if (coverImageUrl) {
      const known = await prisma.mediaAsset.findUnique({ where: { url: coverImageUrl } });
      if (!known && !/^https?:\/\//.test(coverImageUrl)) throw badRequest('La URL debe corresponder a un archivo subido o ser una URL absoluta');
    }
    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: { ...(coverImageUrl !== undefined ? { coverImageUrl } : {}), ...(category ? { category } : {}) },
    });
    res.json({ event: { id: event.id, name: event.name, category: event.category, coverImageUrl: event.coverImageUrl } });
  } catch (e) { next(e); }
});
