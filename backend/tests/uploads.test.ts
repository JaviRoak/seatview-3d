/** Carga de imágenes por administradores (issue #11): validaciones y registro MediaAsset. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { promises as fs } from 'fs';
import path from 'path';
import { createApp } from '../src/app';
import { signToken } from '../src/modules/auth/auth.service';
import { prisma } from '../src/lib/prisma';
import { UPLOADS_DIR } from '../src/lib/storage';
import { sniffImage } from '../src/lib/imageSniff';
import bcrypt from 'bcryptjs';
import { createFixture, cleanupFixture } from './helpers';

const app = createApp();
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
let admin: { id: string; email: string; name: string; role: 'USER' | 'ADMIN' };
let user: { id: string; email: string; name: string; role: 'USER' | 'ADMIN' };
let adminToken = '', userToken = '';
const created: string[] = [];

beforeAll(async () => {
  const tag = Date.now();
  const a = await prisma.user.create({ data: { email: `adm-${tag}@test.local`, name: 'Admin Test', role: 'ADMIN', passwordHash: await bcrypt.hash('x', 4) } });
  const u = await prisma.user.create({ data: { email: `usr-${tag}@test.local`, name: 'User Test', role: 'USER', passwordHash: await bcrypt.hash('x', 4) } });
  admin = { id: a.id, email: a.email, name: a.name, role: 'ADMIN' }; user = { id: u.id, email: u.email, name: u.name, role: 'USER' };
  adminToken = signToken(admin); userToken = signToken(user);
});
afterAll(async () => {
  for (const url of created) {
    await fs.unlink(path.join(UPLOADS_DIR, url.split('/').pop()!)).catch(() => undefined);
  }
  await prisma.mediaAsset.deleteMany({ where: { uploadedById: admin.id } });
  await prisma.user.deleteMany({ where: { id: { in: [admin.id, user.id] } } });
});

describe('sniffImage', () => {
  it('detecta PNG, JPEG y WebP por magic bytes y rechaza otros', () => {
    expect(sniffImage(PNG_1x1)?.mime).toBe('image/png');
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.mime).toBe('image/jpeg');
    expect(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]))?.mime).toBe('image/webp');
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImage(Buffer.from('GIF89a'))).toBeNull();
  });
});

describe('POST /api/admin/uploads', () => {
  it('rechaza sin rol ADMIN', async () => {
    expect((await request(app).post('/api/admin/uploads').attach('file', PNG_1x1, { filename: 'a.png', contentType: 'image/png' })).status).toBe(401);
    const r = await request(app).post('/api/admin/uploads').set('Authorization', `Bearer ${userToken}`).attach('file', PNG_1x1, { filename: 'a.png', contentType: 'image/png' });
    expect(r.status).toBe(403);
  });

  it('rechaza un tipo no permitido (declarado)', async () => {
    const r = await request(app).post('/api/admin/uploads').set('Authorization', `Bearer ${adminToken}`).attach('file', Buffer.from('%PDF-1.4'), { filename: 'doc.pdf', contentType: 'application/pdf' });
    expect(r.status).toBe(415);
    expect(r.body.code).toBe('UNSUPPORTED_TYPE');
  });

  it('rechaza un archivo cuyo contenido real no es imagen aunque diga image/png', async () => {
    const r = await request(app).post('/api/admin/uploads').set('Authorization', `Bearer ${adminToken}`).attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'falso.png', contentType: 'image/png' });
    expect(r.status).toBe(415);
  });

  it('rechaza por exceso de tamaño', async () => {
    const big = Buffer.concat([PNG_1x1, Buffer.alloc(3 * 1024 * 1024)]); // 3 MB > 2 MB
    const r = await request(app).post('/api/admin/uploads').set('Authorization', `Bearer ${adminToken}`).attach('file', big, { filename: 'grande.png', contentType: 'image/png' });
    expect(r.status).toBe(413);
    expect(r.body.code).toBe('FILE_TOO_LARGE');
  });

  it('sube correctamente, crea el MediaAsset con nombre UUID y permite asignarla a un evento', async () => {
    const r = await request(app).post('/api/admin/uploads').set('Authorization', `Bearer ${adminToken}`).attach('file', PNG_1x1, { filename: '../../evil name?.png', contentType: 'image/png' });
    expect(r.status).toBe(201);
    const { asset } = r.body;
    created.push(asset.url);
    expect(asset.mimeType).toBe('image/png');
    expect(asset.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(asset.filename).not.toContain('/');
    expect(await prisma.mediaAsset.findUnique({ where: { id: asset.id } })).not.toBeNull();
    await expect(fs.stat(path.join(UPLOADS_DIR, asset.url.split('/').pop()!))).resolves.toBeTruthy();

    // Servido estáticamente
    expect((await request(app).get(asset.url)).status).toBe(200);

    // Asignar al evento y luego borrar → el evento queda sin imagen
    const fx = await createFixture(1);
    const ev = fx.event;
    const p = await request(app).patch(`/api/admin/events/${ev.id}`).set('Authorization', `Bearer ${adminToken}`).send({ coverImageUrl: asset.url, category: 'CONCIERTO' });
    expect(p.status).toBe(200);
    expect(p.body.event.coverImageUrl).toBe(asset.url);
    const d = await request(app).delete(`/api/admin/uploads/${asset.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(d.status).toBe(200);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: ev.id } })).coverImageUrl).toBeNull();
    await cleanupFixture(fx);
    created.pop();
  });
});
