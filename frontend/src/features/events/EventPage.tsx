/**
 * Pantalla del evento (issues #5–#8; Cambios 1–3).
 * Flujo: hover → tooltip · clic → POV (sin reservar) · "Apartar este asiento" → bloqueo en Redis.
 * ?debug=1 muestra FPS; ?seats=N carga asientos sintéticos (no comprables).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { eventsApi, locksApi } from '../../api';
import { ApiError } from '../../api/client';
import type { EventDetail } from '../../api/types';
import { useAuthStore } from '../../store/auth';
import { seatLabel, useSeatsStore } from '../../store/seats';
import { useSeatSocket } from '../../sockets/useSeatSocket';
import { SeatScene } from '../../scene/SeatScene';
import { consumeDragFlag, type PovTarget } from '../../scene/CameraController';
import { FpsOverlay, type FpsSample } from '../../scene/FpsMeter';
import { syntheticSeats } from '../../scene/stress';
import { detectQuality } from '../../scene/quality';
import { MiniMap } from '../../components/MiniMap';
import { HelpPopover } from '../../components/HelpPopover';
import { EventInfoCard } from '../../components/EventInfoCard';
import { SeatCard } from './SeatCard';
import { ReservationCard } from './ReservationCard';

export function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [params] = useSearchParams();
  const debug = params.get('debug') === '1';
  const stress = Number(params.get('seats') ?? 0) || 0;
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
  const [cam, setCam] = useState<{ x: number; z: number } | null>(null);
  const camRef = useRef<{ x: number; z: number } | null>(null);
  const data = useSeatsStore((s) => s.data);
  const { connected } = useSeatSocket(stress ? undefined : eventId);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      try {
        const { event } = await eventsApi.get(eventId);
        if (cancelled) return;
        setEvent(event);
        const payload = stress ? syntheticSeats(event.venue.layout, stress, event.venue.zones, eventId) : await eventsApi.seats(eventId);
        if (cancelled) return;
        useSeatsStore.getState().load(eventId, payload);
        if (user && !stress) {
          const { locks } = await locksApi.mine(eventId);
          const st = useSeatsStore.getState();
          for (const l of locks) { const idx = st.data?.idToIdx.get(l.eventSeatId); if (idx !== undefined) st.select(idx, l.ttl); }
        }
      } catch (e) { setError((e as Error).message); }
    })();
    return () => { cancelled = true; };
  }, [eventId, stress, user]);

  const flash = useCallback((msg: string) => { setNotice(msg); window.setTimeout(() => setNotice((m) => (m === msg ? null : m)), 4000); }, []);

  /** Clic o navegación: sienta la cámara en el asiento. NO reserva ni llama a la API de bloqueo. */
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
    if (stress) return flash('Modo estrés: los asientos sintéticos no se pueden apartar.');
    if (!user) return navigate('/ingresar', { state: { from: `/eventos/${eventId}` } });
    setBusy(true);
    try {
      const r = await locksApi.acquire(eventId, st.data.ids[idx]);
      st.select(idx, r.ttl);
      flash(`Apartado: ${seatLabel(st.data, idx)}. Tienes ${Math.round(r.ttl / 60)} minutos para pagar.`);
    } catch (e) {
      if (!(e instanceof ApiError)) return;
      if (e.code === 'SEAT_TAKEN') flash('Alguien se adelantó: otra persona acaba de apartar este asiento.');
      else if (e.code === 'SEAT_SOLD') flash('Este asiento ya fue vendido.');
      else flash(e.message);
    } finally { setBusy(false); }
  }, [eventId, user, stress, navigate, flash]);

  const release = useCallback(async (idx: number) => {
    const st = useSeatsStore.getState();
    if (!st.data || !eventId) return;
    await locksApi.release(eventId, st.data.ids[idx]).catch(() => undefined);
    st.deselect(idx);
  }, [eventId]);

  const onHover = useCallback((idx: number | null, screen: { x: number; y: number } | null) => {
    setTooltip(idx === null || !screen ? null : { idx, x: screen.x, y: screen.y });
  }, []);
  const onCameraMove = useCallback((x: number, z: number) => {
    const prev = camRef.current;
    if (prev && Math.abs(prev.x - x) < 0.5 && Math.abs(prev.z - z) < 0.5) return;
    camRef.current = { x, z };
    setCam(camRef.current);
  }, []);

  if (error) return <main className="page"><div className="error">{error}</div></main>;
  if (!event) return <main className="page"><p className="notice">Cargando recinto…</p></main>;

  const st = useSeatsStore.getState();
  const focusPos = focusIdx !== null && data ? { x: data.positions[focusIdx * 3], z: data.positions[focusIdx * 3 + 2] } : null;

  return (
    <div className="event-layout">
      <SeatScene layout={event.venue.layout} pov={pov} debug={debug} quality={quality} onSelect={sitAt} onHover={onHover} onFps={setFps} onCameraMove={onCameraMove} onPovReady={onPovReady} />
      {hint && <div className="card card-tight look-hint" role="status">Arrastra para mirar alrededor · usa las flechas de la tarjeta para moverte</div>}

      {tooltip && data && !pov && (
        <div className="tooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
          {seatLabel(data, tooltip.idx)} · ${data.zones[data.zoneIdx[tooltip.idx]]?.price.toFixed(2)}
          {st.status[tooltip.idx] === 2 && ' · vendido'}
          {st.status[tooltip.idx] === 1 && (st.lockedBy.get(tooltip.idx) === user?.id ? ' · tu reserva' : ' · en compra por otro')}
          <div className="faint" style={{ fontSize: '0.75rem' }}>Clic para sentarte aquí</div>
        </div>
      )}

      {notice && <div className="card card-tight toast" role="status">{notice}</div>}

      <div className="hud-tl">
        <EventInfoCard event={event} seats={data?.count ?? 0} connected={connected} stress={stress} />
        {debug && <FpsOverlay sample={fps} seats={data?.count ?? 0} quality={quality} />}
      </div>

      <div className="hud-bl">
        <MiniMap layout={event.venue.layout} zones={event.venue.zones} camera={cam} focus={focusPos} />
        <HelpPopover />
      </div>

      <aside className="hud-tr">
        {pov && focusIdx !== null ? (
          <SeatCard event={event} idx={focusIdx} busy={busy} onReserve={reserve} onRelease={release} onMove={sitAt} onExit={exitPov} />
        ) : (
          <div className="card card-tight"><h3 style={{ margin: '0 0 4px' }}>Elige tu asiento</h3><p className="notice" style={{ margin: 0 }}>Toca un asiento en el estadio para ver la cancha desde ahí. Mirar no lo aparta.</p></div>
        )}
        <ReservationCard onRelease={release} onGoTo={sitAt} onCheckout={() => navigate(`/eventos/${event.id}/pago`)} />
      </aside>
    </div>
  );
}
