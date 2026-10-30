/**
 * Checkout con pago simulado (issues #8, #9, #10; rediseño v3).
 * - Asientos reservados re-verificados contra el servidor; cuenta regresiva y botón para extender.
 * - Tarjeta en grupos de 4, la fecha agrega la "/", errores bajo cada campo y botones de tarjeta de prueba.
 * - Tarjetas de prueba: 4242… aprueba, 4000 0000 0000 0002 siempre falla (la reserva se conserva).
 * - El servidor valida el bloqueo, cobra, vende en transacción y devuelve los boletos con QR.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { eventsApi, locksApi, paymentsApi, type CardInput } from '../../api';
import { ApiError } from '../../api/client';
import type { EventDetail } from '../../api/types';
import { seatLabel, useSeatsStore } from '../../store/seats';
import { useAuthStore } from '../../store/auth';
import { useReservationStore } from '../../store/reservation';
import { TicketCard } from '../../components/TicketCard';
import { Icon } from '../../components/Icon';
import { clock } from '../../components/TopBar';
import { eventDate, money } from '../events/EventsPage';

const LOCK_MS = 5 * 60_000;
const CARD_OK = '4242 4242 4242 4242', CARD_DECLINED = '4000 0000 0000 0002';

export function luhn(num: string): boolean {
  const d = num.replace(/\D/g, '');
  if (d.length < 12) return false;
  let sum = 0, dbl = false;
  for (let i = d.length - 1; i >= 0; i--) { let n = Number(d[i]); if (dbl) { n *= 2; if (n > 9) n -= 9; } sum += n; dbl = !dbl; }
  return sum % 10 === 0;
}
export const formatCardNumber = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
export const formatExpiry = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
export const cardBrand = (v: string) => { const d = v.replace(/\D/g, ''); return d.startsWith('4') ? 'VISA' : /^5[1-5]/.test(d) ? 'MASTERCARD' : ''; };

export interface CardForm { holder: string; number: string; exp: string; cvc: string }
export function cardErrors(c: CardForm, now = new Date()) {
  const e: Partial<Record<keyof CardForm, string>> = {};
  const [mm, yy] = c.exp.split('/').map(Number);
  const nowY = now.getFullYear() % 100, nowM = now.getMonth() + 1;
  if (c.holder.trim().length < 3) e.holder = 'Escribe el nombre como aparece en la tarjeta.';
  if (!luhn(c.number)) e.number = 'Revisa el número: no parece válido.';
  if (!mm || mm > 12 || Number.isNaN(yy) || yy === undefined || yy < nowY || (yy === nowY && mm < nowM)) e.exp = 'Usa una fecha futura en formato MM/AA.';
  if (!/^\d{3,4}$/.test(c.cvc)) e.cvc = '3 o 4 dígitos al reverso.';
  return e;
}

type Result = { orderId: string; total: number; tickets: Array<{ id: string; qrData: string; eventSeatId: string }> };

export function CheckoutPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const data = useSeatsStore((s) => s.data);
  const selected = useSeatsStore((s) => s.selected);
  useSeatsStore((s) => s.version);
  const reservation = useReservationStore((s) => s.current);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [card, setCard] = useState<CardForm>({ holder: user?.name ?? '', number: '', exp: '', cvc: '' });
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);

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
  const left = reservation && reservation.eventId === eventId ? Math.max(0, reservation.expiresAt - now) : 0;
  const expired = selected.length > 0 && reservation?.eventId === eventId && left === 0;
  const errors = tried ? cardErrors(card) : {};

  const extend = async () => {
    if (!eventId || !data) return;
    try {
      for (const i of selected) { const r = await locksApi.extend(eventId, data.ids[i]); useSeatsStore.getState().setTtl(i, r.ttl); }
      setNotice('Tu reserva vuelve a tener 5 minutos.');
    } catch (e) { setError((e as Error).message); }
  };

  const pay = async (e: FormEvent) => {
    e.preventDefault();
    if (!eventId || !data) return;
    setTried(true); setError(null);
    if (Object.keys(cardErrors(card)).length) return;
    const [mm, yy] = card.exp.split('/').map(Number);
    const input: CardInput = { holder: card.holder.trim(), number: card.number.replace(/\s/g, ''), expMonth: mm, expYear: 2000 + yy, cvc: card.cvc };
    setBusy(true);
    try {
      const r = await paymentsApi.checkout(eventId, selected.map((i) => data.ids[i]), input);
      setResult(r);
      useSeatsStore.getState().clearSelection();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LOCK_LOST') setError('El tiempo de reserva expiró antes de completar el pago. Vuelve al recinto y elige de nuevo.');
      else if (err instanceof ApiError && err.code === 'PAYMENT_DECLINED') setError('El banco rechazó la tarjeta. Tus asientos siguen apartados: prueba con otra.');
      else setError((err as Error).message);
    } finally { setBusy(false); }
  };

  if (!user) return <main className="page"><div className="card"><p>Debes ingresar para pagar.</p><Link to="/ingresar" state={{ from: `/eventos/${eventId}/pago` }}>Ingresar</Link></div></main>;

  if (result) {
    const last4 = card.number.replace(/\D/g, '').slice(-4);
    return (
      <main className="confirm-page">
        <section className="confirm-band">
          <div>
            <div className="confirm-order">Orden {result.orderId}</div>
            <h1>Nos vemos en el estadio.</h1>
            <p>{result.tickets.length} {result.tickets.length === 1 ? 'boleto' : 'boletos'} · Total {money(result.total)} · Tarjeta •••• {last4}. Te enviamos los boletos por correo.</p>
          </div>
        </section>
        <div className="confirm-body">
          {result.tickets.map((t) => {
            const i = data?.idToIdx.get(t.eventSeatId);
            const zone = data && i !== undefined ? data.zones[data.zoneIdx[i]] : undefined;
            return <TicketCard key={t.id} variant="full" eventName={event?.name ?? ''} date={event?.date ?? new Date().toISOString()} venue={event?.venue.name ?? ''} city={event?.venue.city}
              zone={zone?.name ?? ''} row={data && i !== undefined ? data.rows[i] : '—'} number={data && i !== undefined ? data.numbers[i] : 0} price={zone?.price} qrData={t.qrData} code={t.id} />;
          })}
          <div className="row-actions" style={{ flex: 'none' }}>
            <button className="btn-primary" onClick={() => navigate('/boletos')}>Ir a Mis boletos</button>
            <button className="btn-outline" onClick={() => navigate('/')}>Seguir explorando</button>
          </div>
        </div>
      </main>
    );
  }

  const d = event ? eventDate(event.date) : null;
  return (
    <main className="page checkout-page">
      <button className="btn-ghost back-link" onClick={() => navigate(`/eventos/${eventId}`)}><Icon name="back" size={14} />Volver al recinto</button>
      <h1 className="page-title">Pago</h1>
      {event?.venue.layout.concert?.kind==='bocelli'&&<p className="notice" role="note">Compra de demostración: importes y cupos de prueba. El plano provisional de Maná no representa la distribución oficial del concierto de Bocelli.</p>}
      {!data || selected.length === 0 ? (
        <div className="checkout-empty">
          {error && <div className="error">{error}</div>}
          <p>No tienes asientos apartados. Vuelve al recinto para elegir.</p>
          <button className="btn-primary" onClick={() => navigate(`/eventos/${eventId}`)}>Volver al recinto</button>
        </div>
      ) : (
        <div className="checkout-grid">
          <form className="checkout-form" onSubmit={pay} noValidate>
            <div className="checkout-form-head">
              <h3>Tarjeta</h3>
              <div className="test-cards">Prueba:
                <button type="button" className="tag-outline" onClick={() => { setCard({ ...card, number: CARD_OK, exp: '12/30', cvc: '123' }); setError(null); }}>Aprobada</button>
                <button type="button" className="tag-neutral" onClick={() => { setCard({ ...card, number: CARD_DECLINED, exp: '12/30', cvc: '123' }); setError(null); }}>Rechazada</button>
              </div>
            </div>
            <div className="field"><label htmlFor="holder">Titular</label><input id="holder" value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value })} autoComplete="cc-name" />
              {errors.holder && <div className="field-error">{errors.holder}</div>}</div>
            <div className="field"><label htmlFor="number">Número de tarjeta</label>
              <div className="card-number"><input id="number" inputMode="numeric" value={card.number} onChange={(e) => { setCard({ ...card, number: formatCardNumber(e.target.value) }); setError(null); }} placeholder="0000 0000 0000 0000" autoComplete="cc-number" /><span>{cardBrand(card.number)}</span></div>
              {errors.number && <div className="field-error">{errors.number}</div>}</div>
            <div className="checkout-row">
              <div className="field"><label htmlFor="exp">Vence (MM/AA)</label><input id="exp" inputMode="numeric" value={card.exp} onChange={(e) => setCard({ ...card, exp: formatExpiry(e.target.value) })} placeholder="MM/AA" autoComplete="cc-exp" />
                {errors.exp && <div className="field-error">{errors.exp}</div>}</div>
              <div className="field"><label htmlFor="cvc">CVC</label><input id="cvc" inputMode="numeric" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="123" autoComplete="cc-csc" />
                {errors.cvc && <div className="field-error">{errors.cvc}</div>}</div>
            </div>
            {error && <div className="error" role="alert">{error}</div>}
            {expired && <div className="error" role="alert">La reserva expiró. Vuelve al recinto para elegir de nuevo.</div>}
            <button className="btn-primary btn-lg" disabled={busy || expired}>{busy ? 'Procesando pago…' : `Pagar ${money(total)}`}<Icon name="arrow" /></button>
            <p className="faint" style={{ fontSize: 12, margin: 0 }}>Pasarela simulada. Solo guardamos los últimos 4 dígitos.</p>
          </form>
          <aside className="checkout-summary">
            <div className="hold-timer">
              <div><span>Tiempo de reserva</span><strong className={left < 60_000 ? 'urgent' : ''}>{clock(left)}</strong></div>
              <div className="progress"><span style={{ width: `${Math.min(100, (left / LOCK_MS) * 100)}%` }} /></div>
              <button type="button" onClick={extend} disabled={expired}>Necesito más tiempo · volver a 5 min</button>
              {notice && <p className="notice" role="status" style={{ margin: '8px 0 0' }}>{notice}</p>}
            </div>
            {event && d && <>
              <div className="eyebrow">{d.day} {d.month} · {d.time}</div>
              <div className="checkout-event">{event.name}</div>
              <div style={{ fontSize: 13 }}>{event.venue.name}</div>
            </>}
            <div className="checkout-lines">
              {selected.map((i) => (
                <div key={i}><span>{seatLabel(data, i)}</span><b>{money(data.zones[data.zoneIdx[i]]?.price ?? 0)}</b></div>
              ))}
            </div>
            <div className="checkout-total"><span>Total</span><strong>{money(total)}</strong></div>
          </aside>
        </div>
      )}
    </main>
  );
}
