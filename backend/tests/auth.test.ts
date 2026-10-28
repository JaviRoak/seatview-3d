import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();
const email = `reg-${Date.now()}@test.local`;
afterAll(async () => { await prisma.user.deleteMany({ where: { email } }); });

describe('auth', () => {
  it('registra, inicia sesión y protege /me', async () => {
    const reg = await request(app).post('/api/auth/register').send({ email, password: 'Secret123!', name: 'Registro' });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeTruthy();
    expect((await request(app).post('/api/auth/register').send({ email, password: 'Secret123!', name: 'Registro' })).status).toBe(409);
    expect((await request(app).post('/api/auth/login').send({ email, password: 'wrong' })).status).toBe(401);
    const ok = await request(app).post('/api/auth/login').send({ email, password: 'Secret123!' });
    expect(ok.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${ok.body.token}`)).body.user.email).toBe(email);
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer token-invalido')).status).toBe(401);
  });
  it('valida el cuerpo con Zod', async () => {
    const r = await request(app).post('/api/auth/register').send({ email: 'no-es-correo', password: '1', name: '' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('BAD_REQUEST');
  });
});
