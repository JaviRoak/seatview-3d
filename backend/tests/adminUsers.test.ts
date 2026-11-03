
import { describe, it, expect, beforeAll, afterAll } from 'vitest'; 
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/modules/auth/auth.service';

const app = createApp();

// Usuarios exclusivos de estas pruebas.
const testId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const adminEmail = `admin-${testId}@test.local`;
const userEmail = `user-${testId}@test.local`;

async function createTestUsers() {
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      name: 'Administrador de prueba',
      passwordHash: 'test-hash',
      role: 'ADMIN',
    },
  });

  const user = await prisma.user.create({
    data: {
      email: userEmail,
      name: 'Usuario de prueba',
      passwordHash: 'test-hash',
      role: 'USER',
    },
  });

    return { admin, user };
}

beforeAll(async () => {
  await createTestUsers();
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [adminEmail, userEmail] } },
  });
});

describe('Gestión administrativa de usuarios', () => {
  it('permite listar usuarios sin exponer contraseñas', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
  where: { email: adminEmail },
});

const adminToken = signToken(admin);

    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.users)).toBe(true);

    const testUser = response.body.users.find(
      (u: { email: string }) => u.email === userEmail
    );

    expect(testUser).toBeDefined();
    expect(testUser).not.toHaveProperty('passwordHash');
  });

  it('rechaza solicitudes sin autenticación', async () => {
    const response = await request(app).get('/api/admin/users');

    expect(response.status).toBe(401);
  });

  it('impide el acceso a usuarios normales', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: userEmail },
    });

    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(response.status).toBe(403);
  });

  it('permite cambiar el rol de un usuario', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: adminEmail },
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: userEmail },
    });

    const response = await request(app)
      .patch(`/api/admin/users/${user.id}/role`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ role: 'ADMIN' });

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('ADMIN');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    // Restaurar el rol original del usuario.
    const restoreResponse = await request(app)
        .patch(`/api/admin/users/${user.id}/role`)
        .set('Authorization', `Bearer ${signToken(admin)}`)
        .send({ role: 'USER' });

    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body.user.role).toBe('USER');
  });

  it('rechaza roles inválidos', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: adminEmail },
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: userEmail },
    });

    const response = await request(app)
      .patch(`/api/admin/users/${user.id}/role`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ role: 'SUPERADMIN' });

    expect(response.status).toBe(400);
  });

  it('impide que un administrador cambie su propio rol', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: adminEmail },
    });

    const response = await request(app)
      .patch(`/api/admin/users/${admin.id}/role`)
      .set('Authorization', `Bearer ${signToken(admin)}`)
      .send({ role: 'USER' });

    expect(response.status).toBe(403);
  });

  
  it('revoca permisos administrativos de tokens antiguos', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: userEmail },
    });

    // Primero concedemos permisos administrativos.
    const promotedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    });

    // Generamos un token mientras tiene permisos de administrador.
    const oldAdminToken = signToken(promotedUser);

    // Después revocamos esos permisos.
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'USER' },
    });

    // El token antiguo ya no debe permitir acceso.
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${oldAdminToken}`);

    expect(response.status).toBe(403);
  });
});
