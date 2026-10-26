import http from 'http';
import { env, corsOrigins } from './config/env';
import { createApp } from './app';
import { initSockets } from './sockets';
import { startExpiryWatchers, stopExpiryWatchers } from './modules/locks/expiry';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

async function main() {
  const server = http.createServer(createApp());
  initSockets(server);
  startExpiryWatchers();
  server.listen(env.PORT, () => {
    console.log(`SeatView 3D API escuchando en http://localhost:${env.PORT}`);
    console.log(`  CORS: ${corsOrigins.join(', ')}`);
    console.log(`  bloqueo: ${env.LOCK_TTL_SECONDS}s · máx. por usuario: ${env.MAX_LOCKS_PER_USER} · expiración: ${env.LOCK_EXPIRY_STRATEGY}+sweep`);
  });
  const shutdown = async () => { stopExpiryWatchers(); server.close(); await prisma.$disconnect(); redis.disconnect(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
main().catch((e) => { console.error(e); process.exit(1); });
