/**
 * Detección de expiración de bloqueos (issue #8).
 *
 * Principal: keyspace notifications de Redis (`notify-keyspace-events Ex`).
 * Al expirar `seat:{eventId}:{eventSeatId}` Redis publica la clave en
 * `__keyevent@0__:expired`; el backend emite `seats:update` (→ AVAILABLE).
 *
 * Respaldo: barrido periódico (`sweep`) que compara la foto de bloqueos vivos
 * con la anterior y emite los que desaparecieron. Latencia = intervalo, pero
 * no depende de la configuración de Redis ni de que la notificación llegue
 * (Redis las entrega "fire and forget", sin reintentos).
 *
 * Con LOCK_EXPIRY_STRATEGY=keyspace se activan AMBAS: las notificaciones dan
 * latencia < 1 s y el barrido actúa como red de seguridad. Ver docs/concurrencia.md.
 */
import { createSubscriber } from '../../lib/redis';
import { env } from '../../config/env';
import { lockService, parseSeatKey } from './locks.service';
import { emitSeatUpdate } from '../../sockets';
import { prisma } from '../../lib/prisma';

const seen = new Map<string, Map<string, string>>();
let sweepTimer: NodeJS.Timeout | null = null;
let subscriber: ReturnType<typeof createSubscriber> | null = null;

async function onExpired(eventId: string, eventSeatId: string) {
  // Nunca "liberamos" un asiento vendido: la venta borra la clave explícitamente y la BD manda.
  const row = await prisma.eventSeat.findUnique({ where: { id: eventSeatId }, select: { status: true } });
  if (!row || row.status === 'SOLD') return;
  emitSeatUpdate(eventId, [{ eventSeatId, status: 0 }]);
}

export function startKeyspaceListener() {
  subscriber = createSubscriber();
  subscriber.subscribe('__keyevent@0__:expired', (err) => {
    if (err) console.error('[locks] no se pudo suscribir a keyspace notifications', err.message);
    else console.log('[locks] escuchando expiraciones por keyspace notifications');
  });
  subscriber.on('message', (_ch, key) => {
    const parsed = parseSeatKey(key);
    if (parsed) void onExpired(parsed.eventId, parsed.eventSeatId);
  });
}

/** Un ciclo de barrido: emite como AVAILABLE los bloqueos que ya no existen. */
export async function sweepOnce(eventIds: string[]) {
  for (const eventId of eventIds) {
    const current = await lockService.listForEvent(eventId);
    const prev = seen.get(eventId) ?? new Map<string, string>();
    const gone: string[] = [];
    for (const id of prev.keys()) if (!current.has(id)) gone.push(id);
    seen.set(eventId, current);
    if (gone.length) {
      const sold = await prisma.eventSeat.findMany({ where: { id: { in: gone }, status: 'SOLD' }, select: { id: true } });
      const soldSet = new Set(sold.map((s) => s.id));
      emitSeatUpdate(eventId, gone.filter((id) => !soldSet.has(id)).map((id) => ({ eventSeatId: id, status: 0 as const })));
    }
  }
}

export function startSweep() {
  sweepTimer = setInterval(async () => {
    try {
      const events = await prisma.event.findMany({ select: { id: true } });
      await sweepOnce(events.map((e) => e.id));
    } catch (e) { console.error('[locks] error en barrido', e); }
  }, env.LOCK_SWEEP_INTERVAL_MS);
}

export function startExpiryWatchers() {
  if (env.LOCK_EXPIRY_STRATEGY === 'keyspace') startKeyspaceListener();
  startSweep();
}

export function stopExpiryWatchers() {
  if (sweepTimer) clearInterval(sweepTimer);
  subscriber?.disconnect();
}
