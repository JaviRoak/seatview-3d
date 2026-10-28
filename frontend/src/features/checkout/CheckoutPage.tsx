/**
 * Checkout con pago simulado (issues #8, #9).
 * - Asientos reservados re-verificados contra el servidor; cuenta regresiva y botón para extender.
 * - Formulario de tarjeta con validación básica (Luhn, fecha, CVC).
 * - Tarjetas de prueba: 4242… aprueba, 4000 0000 0000 0002 siempre falla.
 * - El servidor valida el bloqueo, cobra y vende en una transacción; aquí se muestra la confirmación.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { eventsApi, locksApi, paymentsApi, type CardInput } from '../../api';
import { ApiError } from '../../api/client';
import type { EventDetail } from '../../api/types';
import { seatLabel, useSeatsStore } from '../../store/seats';
import { useAuthStore } from '../../store/auth';
import { Countdown } from '../../components/Countdown';
import { CATEGORY_LABEL } from '../../components/EventInfoCard';

export function luhn(num: string): boolean {
  const d = num.replace(/\D/g, '');
  if (d.length < 12) return false;
  let sum = 0, dbl = false;
  for (let i = d.length - 1; i >= 0; i--) { let n = Number(d[i]); if (dbl) { n *= 2; if (n > 9) n -= 9; } sum += n; dbl = !dbl; }
  return sum % 10 === 0;
}

type Result = { orderId: string; total: number; authCode?: string; seats: Array<{ eventSeatId: string; zone: string; row: string; number: number; price: number }> };

export function CheckoutPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const data = useSeatsStore((s) => s.data);
  const selected = useSeatsStore((s) => s.selected);
  const ttls = useSeatsStore((s) => s.ttls);
  useSeatsStore((s) => s.version);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [card, setCard] = useState({ holder: user?.name ?? '', number: '4242 4242 4242 4242', exp: '12/30', cvc: '123' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [expired, setExpired] = useState(false);

  // Si se entró directo a /pago: cargar evento y asientos y recuperar bloqueos del servidor.
  useEffect(() => {
    if (!eventId || !user) return;
    (async () => {
      const { event } = await eventsApi.get(eventId);
      setEvent(event);
      const st = useSeatsStore.getState();
      if (!st.data || st.eventId !== eventId) st.load(eventId, await eventsApi.seats(eventId));
      const { locks } = await locksApi.mine(eventId);
      const s2 = useSeatsStore.getState();
      const alive = new Set(locks.map((l) => l.eventSeatId));
      for (const i of [...s2.selected]) if (!alive.has(s2.data!.ids[i])) s2.deselect(i);
      for (const l of locks) { const idx = s2.data!.idToIdx.get(l.eventSeatId); if (idx !== undefined) s2.select(idx, l.ttl); }
    })().catch((e) => setError((e as Error).message));
  }, [eventId, user]);

  const total = useMemo(() => (data ? selected.reduce((a, i) => a + (data.zones[data.zoneIdx[i]]?.price ?? 0), 0) : 0), [data, selected]);
  const minTtl = selected.length ? Math.min(...selected.map((i) => ttls.get(i) ?? 0)) : 0;

  const extend = async () => {
    if (!eventId || !data) return;
    try {
      for (const i of selected) { const r = await locksApi.extend(eventId, data.ids[i]); useSeatsStore.getState().setTtl(i, r.ttl); }
      setExpired(false);
    } catch (e) { setError((e as Error).message); }
  };

  const pay = async (e: FormEvent) => {
    e.preventDefault();
    if (!eventId || !data) return;
    setError(null);
    const number = card.number.replace(/\s/g, '');
    const [mm, yy] = card.exp.split('/').map((s) => Number(s.trim()));
    if (!luhn(number)) return setError('El número de tarjeta no es válido.');
    if (!mm || !yy || mm < 1 || mm > 12) return setError('La fecha de vencimiento debe tener formato MM/AA.');
    if (!/^\d{3,4}$/.test(card.cvc)) return setError('El CVC debe tener 3 o 4 dígitos.');
    const input: CardInput = { holder: card.holder, number, expMonth: mm, expYear: 2000 + yy, cvc: card.cvc };
    setBusy(true);
    try {
      const r = await paymentsApi.checkout(eventId, selected.map((i) => data.ids[i]), input);
      setResult(r);
      useSeatsStore.getState().clearSelection();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LOCK_LOST') setError('El tiempo de reserva expiró antes de completar el pago. Vuelve al mapa y elige de nuevo.');
      else setError((err as Error).message);
    } finally { setBusy(false); }
  };

  if (!user) return <main className="page"><div className="card"><p>Debes ingresar para pagar.</p><Link to="/ingresar">Ingresar</Link></div></main>;

  if (result) {
    return (
      <main className="page" style={{ maxWidth: 760 }}>
        <div className="card">
          <span className="eyebrow">Orden confirmada</span>
          <h1>Compra confirmada</h1>
          <p>Orden <code>{result.orderId}</code> · Total ${result.total.toFixed(2)}{result.authCode && <> · Autorización <code>{result.authCode}</code></>}</p>
          {event && <p className="muted">{event.name} · {event.venue.name} · {new Date(event.date).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
          {result.seats.map((s) => (
            <div key={s.eventSeatId} className="seat-row">
              <span>{s.zone} · Fila {s.row} · Asiento {s.number}</span>
              <span>${s.price.toFixed(2)}</span>
            </div>
          ))}
          <div className="row-actions">
            <button className="btn-primary" onClick={() => navigate(`/eventos/${eventId}`)}>Volver al mapa</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page" style={{ maxWidth: 960 }}>
      <span className="eyebrow">Paso final</span>
      <h1>Pago</h1>
      {event && <p className="muted"><span className={`badge cat-${event.category}`}>{CATEGORY_LABEL[event.category]}</span> &nbsp;{event.name} · {new Date(event.date).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
      {error && <div className="error">{error}</div>}
      {!data || selected.length === 0 ? (
        <div className="card"><p>No tienes entradas reservadas para este evento.</p><Link to={`/eventos/${eventId}`}>Volver al mapa 3D</Link></div>
      ) : (
        <div className="checkout-grid">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Tiempo restante de tu reserva</h3>
              <Countdown seconds={minTtl} onExpire={() => setExpired(true)} />
            </div>
            {expired && <div className="error">La reserva expiró. Vuelve al mapa para elegir de nuevo.</div>}
            <div className="row-actions"><button onClick={extend} disabled={expired}>Extender el tiempo</button></div>
            {selected.map((i) => (
              <div key={i} className="seat-row">
                <span><span className="zone-chip" style={{ background: data.zones[data.zoneIdx[i]]?.color }} />{seatLabel(data, i)}</span>
                <span>${(data.zones[data.zoneIdx[i]]?.price ?? 0).toFixed(2)}</span>
              </div>
            ))}
            <div className="total"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>
          <form className="card" onSubmit={pay}>
            <h3>Tarjeta (pasarela simulada)</h3>
            <p className="notice">4242 4242 4242 4242 aprueba · 4000 0000 0000 0002 siempre es rechazada.</p>
            <div className="field"><label htmlFor="holder">Titular</label><input id="holder" value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value })} required minLength={3} /></div>
            <div className="field"><label htmlFor="number">Número</label><input id="number" inputMode="numeric" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} required /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="field"><label htmlFor="exp">Vence (MM/AA)</label><input id="exp" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} required /></div>
              <div className="field"><label htmlFor="cvc">CVC</label><input id="cvc" inputMode="numeric" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} required /></div>
            </div>
            <div className="row-actions">
              <button className="btn-primary" disabled={busy || expired}>{busy ? 'Procesando pago…' : `Pagar $${total.toFixed(2)}`}</button>
              <button type="button" className="btn-ghost" onClick={() => navigate(`/eventos/${eventId}`)}>Volver al mapa</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
