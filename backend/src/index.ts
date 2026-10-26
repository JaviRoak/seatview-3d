import http from 'http';
import { env, corsOrigins } from './config/env';
import { createApp } from './app';
import { initSockets } from './sockets';
import { prisma } from './lib/prisma';

async function main() {
  const server = http.createServer(createApp());
  initSockets(server);
  server.listen(env.PORT, () => {
    console.log(`SeatView 3D API escuchando en http://localhost:${env.PORT}`);
    console.log(`  CORS: ${corsOrigins.join(', ')}`);
  });
  const shutdown = async () => { server.close(); await prisma.$disconnect(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
main().catch((e) => { console.error(e); process.exit(1); });
