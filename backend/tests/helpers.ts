import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { redis } from '../src/lib/redis';

/** Escenario mínimo aislado: recinto, zona, N asientos, evento y 2 usuarios. */
export async function createFixture(seatCount = 5) {
  const tag = Math.random().toString(36).slice(2, 8);
  const venue = await prisma.venue.create({ data: { name: `V-${tag}`, city: 'Test', layout: {} } });
  const zone = await prisma.zone.create({ data: { venueId: venue.id, name: `Z-${tag}`, color: '#000000', price: 10 } });
  const event = await prisma.event.create({ data: { venueId: venue.id, name: `E-${tag}`, date: new Date(Date.now() + 864e5) } });
  const eventSeatIds: string[] = [];
  for (let i = 0; i < seatCount; i++) {
    const seat = await prisma.seat.create({ data: { venueId: venue.id, zoneId: zone.id, idx: i, row: 'A', number: i + 1, posX: i, posY: 0, posZ: 0, rotY: 0 } });
    eventSeatIds.push((await prisma.eventSeat.create({ data: { eventId: event.id, seatId: seat.id } })).id);
  }
  const mkUser = async (name: string) => prisma.user.create({ data: { email: `${name}-${tag}@test.local`, name, passwordHash: await bcrypt.hash('Secret123!', 4) } });
  return { tag, venue, zone, event, eventSeatIds, userA: await mkUser('alice'), userB: await mkUser('bob') };
}

export async function cleanupFixture(f: Awaited<ReturnType<typeof createFixture>>) {
  await prisma.ticket.deleteMany({ where: { order: { eventId: f.event.id } } });
  await prisma.eventSeat.deleteMany({ where: { eventId: f.event.id } });
  await prisma.order.deleteMany({ where: { eventId: f.event.id } });
  await prisma.venue.delete({ where: { id: f.venue.id } });
  await prisma.user.deleteMany({ where: { id: { in: [f.userA.id, f.userB.id] } } });
  const keys = await redis.keys(`*${f.event.id}*`);
  if (keys.length) await redis.del(...keys);
}

export const authUser = (u: { id: string; email: string; name: string; role: 'USER' | 'ADMIN' }) => ({ id: u.id, email: u.email, name: u.name, role: u.role });
export const okCard = { holder: 'Test User', number: '4242424242424242', expMonth: 12, expYear: 2030, cvc: '123' };
export const badCard = { ...okCard, number: '4000000000000002' };
