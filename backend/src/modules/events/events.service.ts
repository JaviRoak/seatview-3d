/** Eventos y recintos (issue #11). Lectura pública. */
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';

export async function listEvents() {
  const events = await prisma.event.findMany({
    orderBy: { date: 'asc' },
    include: { venue: { select: { id: true, name: true, city: true } }, _count: { select: { eventSeats: true } } },
  });
  const sold = await prisma.eventSeat.groupBy({ by: ['eventId'], where: { status: 'SOLD' }, _count: { _all: true } });
  const soldByEvent = new Map(sold.map((s) => [s.eventId, s._count._all]));
  return events.map((e) => ({
    id: e.id, name: e.name, description: e.description, date: e.date, category: e.category, coverImageUrl: e.coverImageUrl, venue: e.venue,
    totalSeats: e._count.eventSeats, soldSeats: soldByEvent.get(e.id) ?? 0,
  }));
}

export async function getEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { venue: { include: { zones: { orderBy: { sortIdx: 'asc' } } } } } });
  if (!event) throw notFound('Evento no encontrado');
  const inventory = await prisma.seat.groupBy({ by: ['zoneId', 'row'], where: { venueId: event.venueId }, _count: { _all: true } });
  return {
    id: event.id, name: event.name, description: event.description, date: event.date, category: event.category, coverImageUrl: event.coverImageUrl,
    venue: {
      id: event.venue.id, name: event.venue.name, city: event.venue.city, imageUrl: event.venue.imageUrl, layout: event.venue.layout,
      zones: event.venue.zones.map((z) => ({ id: z.id, name: z.name, color: z.color, price: Number(z.price), generalAdmission: inventory.some(g => g.zoneId === z.id && g.row === 'GA'), capacity: inventory.filter(g => g.zoneId === z.id).reduce((n,g) => n+g._count._all,0) })),
    },
  };
}
