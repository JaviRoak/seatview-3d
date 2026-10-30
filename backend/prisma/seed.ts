/**
 * Seed de la base de datos (issue #11).
 * Crea usuarios de prueba (USER y ADMIN) y 4 recintos con su evento:
 *  1. Estadio Cuscatlán (fútbol) · Final Nacional de Fútbol      (prisma/seeds/cuscatlan.ts)
 *  2. Estadio Mágico González · Andrea Bocelli                    (prisma/seeds/bocelli.ts)
 *  3. Estadio Cuscatlán (concierto) · Beéle                       (prisma/seeds/beele.ts)
 *  4. Estadio Cuscatlán Virtual, procedural (≥ 8.000) · Concierto Sinfónico, no destacado
 * Uso: npm run db:seed   (o SEATS=20000 npm run db:seed para modo estrés del recinto procedural)
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';
import { defaultLayout, generateSeats, zoneSpecs } from '../src/lib/layout';
import { FINAL_EVENT_ID, seedCuscatlan } from './seeds/cuscatlan';
import { seedBocelli } from './seeds/bocelli';
import { seedBeele } from './seeds/beele';

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

export const TEST_USERS = [
  { email: 'javier.polanco@seatview.test', password: 'Javier12345!', name: 'Javier Polanco', role: 'ADMIN' as const },
  { email: 'andres.berrios@seatview.test', password: 'Andres12345!', name: 'Andrés Berríos', role: 'USER' as const },
];

export async function seed(targetSeats = Number(process.env.SEATS ?? 8000)) {
  console.log('→ Limpiando datos anteriores…');
  await prisma.ticket.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.eventSeat.deleteMany();
  await prisma.order.deleteMany();
  await prisma.event.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();

  console.log('→ Usuarios de prueba');
  for (const u of TEST_USERS) {
    await prisma.user.create({ data: { email: u.email, name: u.name, role: u.role, passwordHash: await bcrypt.hash(u.password, 10) } });
  }

  console.log('→ Recintos reales');
  for (const [label, run] of [['Estadio Cuscatlán · Final Nacional', seedCuscatlan], ['Mágico González · Andrea Bocelli', seedBocelli], ['Cuscatlán concierto · Beéle', seedBeele]] as const) {
    const r = await run(prisma);
    console.log(`   ${label}: ${r.seats} lugares`);
  }

  console.log(`→ Recinto procedural (objetivo ≈ ${targetSeats})`);
  const layout = defaultLayout(targetSeats);
  const venue = await prisma.venue.create({
    data: { name: 'Estadio Cuscatlán Virtual', city: 'San Salvador', description: 'Recinto de demostración generado proceduralmente.', layout: layout as object },
  });
  const zones = zoneSpecs(layout);
  const zoneIds = new Map<string, string>();
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    const created = await prisma.zone.create({ data: { venueId: venue.id, name: z.name, color: z.color, price: z.price, sortIdx: i } });
    zoneIds.set(`${z.standIdx}-${z.levelIdx}`, created.id);
  }
  const seats = generateSeats(layout);
  const CHUNK = 2000;
  for (let i = 0; i < seats.length; i += CHUNK) {
    await prisma.seat.createMany({
      data: seats.slice(i, i + CHUNK).map((s) => ({
        venueId: venue.id, zoneId: zoneIds.get(`${s.standIdx}-${s.levelIdx}`)!,
        idx: s.idx, row: s.row, number: s.number, posX: s.x, posY: s.y, posZ: s.z, rotY: s.rotY,
      })),
    });
  }
  console.log(`   ${seats.length} asientos creados en ${zones.length} zonas`);

  // No destacado: queda fuera del cartel y al final de la agenda. coverImageUrl en null → cabecera SVG procedural.
  const now = new Date();
  const sinfonico = await prisma.event.create({ data: {
    venueId: venue.id, name: 'Concierto Sinfónico al Aire Libre', description: 'Orquesta y luces en el estadio. Mira el escenario desde tu lugar.',
    date: new Date(now.getFullYear(), now.getMonth() + 2, 3, 20, 30), category: 'CONCIERTO', featured: false,
  } });
  const seatIds = await prisma.seat.findMany({ where: { venueId: venue.id }, select: { id: true } });
  for (let i = 0; i < seatIds.length; i += CHUNK) {
    await prisma.eventSeat.createMany({ data: seatIds.slice(i, i + CHUNK).map((s) => ({ eventId: sinfonico.id, seatId: s.id })) });
  }

  // Algunas ventas previas en Platea de la Final para que el mapa muestre vendidos.
  const buyer = await prisma.user.findUniqueOrThrow({ where: { email: TEST_USERS[1].email } });
  const sample = await prisma.eventSeat.findMany({ where: { eventId: FINAL_EVENT_ID, seat: { row: { not: 'GA' } } }, take: 40, skip: 120, orderBy: { seat: { idx: 'asc' } } });
  const order = await prisma.order.create({ data: { userId: buyer.id, eventId: FINAL_EVENT_ID, total: 0, status: 'PAID', cardLast4: '4242' } });
  await prisma.eventSeat.updateMany({ where: { id: { in: sample.map((s) => s.id) } }, data: { status: 'SOLD', orderId: order.id } });

  console.log('✓ Seed completado');
  console.log('  Usuarios: ' + TEST_USERS.map((u) => `${u.email} / ${u.password}`).join(' | '));
}

seed().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
