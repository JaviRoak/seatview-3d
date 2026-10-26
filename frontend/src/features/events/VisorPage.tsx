/**
 * Visor 3D del evento (issues #5, #7, #8): carga el recinto y sus asientos desde
 * la API y los dibuja con SeatScene. Clic en un asiento = vista desde ese asiento
 * (POV); desde la tarjeta del asiento se aparta temporalmente en el servidor
 * (bloqueo en Redis con TTL). Todavía no se compra.
 * La disponibilidad se mantiene al día por Socket.io (seats:update).
 * ?debug=1 muestra FPS; ?quality=low|high fuerza la calidad gráfica.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { eventsApi, locksApi } from '../../api';
import { ApiError } from '../../api/client';
import type { EventDetail } from '../../api/types';
import { useAuthStore } from '../../store/auth';
import { seatLabel, useSeatsStore } from '../../store/seats';
import { useSeatSocket } from '../../sockets/useSeatSocket';
import { SeatScene } from '../../scene/SeatScene';
import { consumeDragFlag, type PovTarget } from '../../scene/CameraController';
import { FpsOverlay, type FpsSample } from '../../scene/FpsMeter';
import { detectQuality } from '../../scene/quality';
import { CATEGORY_LABEL } from '../../components/EventInfoCard';
import { HelpPopover } from '../../components/HelpPopover';
import { SeatCard } from './SeatCard';
import { ReservationCard } from './ReservationCard';

export function VisorPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [params] = useSearchParams();
  const debug = params.get('debug') === '1';
  const quality = detectQuality(params.toString() ? `?${params.toString()}` : '');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [pov, setPov] = useState<PovTarget | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fps, setFps] = useState<FpsSample | null>(null);
  const data = useSeatsStore((s) => s.data);
  const { connected } = useSeatSocket(eventId);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      try {
        const { event } = await eventsApi.get(eventId);
        if (cancelled) return;
        setEvent(event);
        const payload = await eventsApi.seats(eventId);
        if (cancelled) return;
        useSeatsStore.getState().load(eventId, payload);
        if (user) {
          // Recupera los bloqueos vivos del usuario (p. ej. tras recargar la página).
          const { locks } = await locksApi.mine(eventId);
          const st = useSeatsStore.getState();
          for (const l of locks) { const idx = st.data?.idToIdx.get(l.eventSeatId); if (idx !== undefined) st.select(idx, l.ttl); }
        }
      } catch (e) { setError((e as Error).message); }
    })();
    return () => { cancelled = true; useSeatsStore.getState().reset(); };
  }, [eventId, user]);

  const flash = useCallback((msg: string) => { setNotice(msg); window.setTimeout(() => setNotice((m) => (m === msg ? null : m)), 4000); }, []);

  /** Clic en un asiento: sienta la cámara en él. NO aparta ni llama a la API de bloqueo. */
  const sitAt = useCallback((idx: number) => {
    const d = useSeatsStore.getState().data;
    if (!d) return;
    if (consumeDragFlag()) return; // soltar tras arrastrar en POV no es un clic en un asiento
    setFocusIdx(idx);
    useSeatsStore.getState().setFocused(idx);
    setPov({ position: [d.positions[idx * 3], d.positions[idx * 3 + 1], d.positions[idx * 3 + 2]], rotY: d.rotations[idx] });
    setTooltip(null);
  }, []);

  const exitPov = useCallback(() => { setPov(null); setFocusIdx(null); setHint(false); useSeatsStore.getState().setFocused(null); }, []);
  const onPovReady = useCallback(() => { setHint(true); window.setTimeout(() => setHint(false), 3500); }, []);

  /** Único punto que aparta: botón "Apartar este asiento". */
  const reserve = useCallback(async (idx: number) => {
    const st = useSeatsStore.getState();
    if (!st.data || !eventId) return;
    if (!user) return navigate('/ingresar', { state: { from: `/eventos/${eventId}` } });
    setBusy(true);
    try {
      const r = await locksApi.acquire(eventId, st.data.ids[idx]);
      st.select(idx, r.ttl);
      flash(`Apartado: ${seatLabel(st.data, idx)}. Lo tienes reservado por ${Math.round(r.ttl / 60)} minutos.`);
    } catch (e) {
      if (!(e instanceof ApiError)) return;
      if (e.code === 'SEAT_TAKEN') flash('Alguien se adelantó: otra persona acaba de apartar este asiento.');
      else if (e.code === 'SEAT_SOLD') flash('Este asiento ya fue vendido.');
      else flash(e.message);
    } finally { setBusy(false); }
  }, [eventId, user, navigate, flash]);

  const release = useCallback(async (idx: number) => {
    const st = useSeatsStore.getState();
    if (!st.data || !eventId) return;
    await locksApi.release(eventId, st.data.ids[idx]).catch(() => undefined);
    st.deselect(idx);
  }, [eventId]);

  const onHover = useCallback((idx: number | null, screen: { x: number; y: number } | null) => {
    setTooltip(idx === null || !screen ? null : { idx, x: screen.x, y: screen.y });
  }, []);

  if (error) return <main className="page"><div className="error">{error}</div></main>;
  if (!event) return <main className="page"><p className="notice">Cargando recinto…</p></main>;

  const st = useSeatsStore.getState();

  return (
    <div className="event-layout">
      <SeatScene layout={event.venue.layout} pov={pov} debug={debug} quality={quality} onSelect={sitAt} onHover={onHover} onFps={setFps} onPovReady={onPovReady} />
      {hint && <div className="card card-tight look-hint" role="status">Arrastra para mirar alrededor · rueda para acercar la vista</div>}

      {tooltip && data && !pov && (
        <div className="tooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
          {seatLabel(data, tooltip.idx)} · ${data.zones[data.zoneIdx[tooltip.idx]]?.price.toFixed(2)}
          {st.status[tooltip.idx] === 2 && ' · vendido'}
          {st.status[tooltip.idx] === 1 && (st.lockedBy.get(tooltip.idx) === user?.id ? ' · tu reserva' : ' · en compra por otro')}
        </div>
      )}

      {notice && <div className="card card-tight toast" role="status">{notice}</div>}

      <div className="hud-tl">
        <section className="card card-tight" aria-label="Información del evento">
          <span className="eyebrow">{CATEGORY_LABEL[event.category]}</span>
          <h2>{event.name}</h2>
          <p className="faint">{event.venue.name} · {event.venue.city} · {(data?.count ?? 0).toLocaleString('es')} localidades</p>
          <p className="event-banner-live" title={connected ? 'Disponibilidad actualizada en tiempo real' : 'Conectando con el servidor'}><i className={connected ? 'online' : ''} />{connected ? 'En vivo' : 'Conectando'}</p>
          <Link to="/">← Todos los eventos</Link>
        </section>
        {debug && <FpsOverlay sample={fps} seats={data?.count ?? 0} quality={quality} />}
      </div>

      <div className="hud-bl">
        <HelpPopover />
      </div>

      <aside className="hud-tr">
        {pov && focusIdx !== null ? (
          <SeatCard event={event} idx={focusIdx} busy={busy} onReserve={reserve} onRelease={release} onMove={sitAt} onExit={exitPov} />
        ) : (
          <div className="card card-tight notice">Pasa el cursor sobre un asiento para ver sus datos y haz clic para sentarte en él. Desde ahí podrás apartarlo.</div>
        )}
        <ReservationCard busy={busy} onRelease={release} onGoTo={sitAt} />
      </aside>
    </div>
  );
}
