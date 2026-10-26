/**
 * Visor 3D del evento (issue #5): carga el recinto y sus asientos desde la API
 * y los dibuja con SeatScene. Clic en un asiento = vista desde ese asiento (POV).
 * Desde la vista POV el asiento se puede marcar como seleccionado (solo en el
 * cliente); todavía no se aparta en el servidor ni se compra.
 * La disponibilidad se mantiene al día por Socket.io (seats:update).
 * ?debug=1 muestra FPS; ?quality=low|high fuerza la calidad gráfica.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { eventsApi } from '../../api';
import type { EventDetail } from '../../api/types';
import { seatLabel, useSeatsStore } from '../../store/seats';
import { useSeatSocket } from '../../sockets/useSeatSocket';
import { SeatScene } from '../../scene/SeatScene';
import { consumeDragFlag, type PovTarget } from '../../scene/CameraController';
import { FpsOverlay, type FpsSample } from '../../scene/FpsMeter';
import { detectQuality } from '../../scene/quality';
import { CATEGORY_LABEL } from '../../components/EventInfoCard';
import { HelpPopover } from '../../components/HelpPopover';
import { SeatCard } from './SeatCard';

export function VisorPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [params] = useSearchParams();
  const debug = params.get('debug') === '1';
  const quality = detectQuality(params.toString() ? `?${params.toString()}` : '');

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [pov, setPov] = useState<PovTarget | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [hint, setHint] = useState(false);
  const [fps, setFps] = useState<FpsSample | null>(null);
  const data = useSeatsStore((s) => s.data);
  const selected = useSeatsStore((s) => s.selected);
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
      } catch (e) { setError((e as Error).message); }
    })();
    return () => { cancelled = true; useSeatsStore.getState().reset(); };
  }, [eventId]);

  /** Clic en un asiento: sienta la cámara en él. */
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
  const select = useCallback((idx: number) => useSeatsStore.getState().select(idx, 0), []);
  const deselect = useCallback((idx: number) => useSeatsStore.getState().deselect(idx), []);
  const onPovReady = useCallback(() => { setHint(true); window.setTimeout(() => setHint(false), 3500); }, []);
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
        </div>
      )}

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
          <SeatCard event={event} idx={focusIdx} onSelect={select} onDeselect={deselect} onMove={sitAt} onExit={exitPov} />
        ) : (
          <div className="card card-tight notice">Pasa el cursor sobre un asiento para ver sus datos y haz clic para sentarte en él. Desde ahí podrás seleccionarlo.</div>
        )}
        {data && selected.length > 0 && (
          <div className="card">
            <span className="eyebrow">Tu selección</span>
            {selected.map((i) => (
              <div key={i} className="seat-row">
                <button className="btn-ghost" style={{ padding: 0, border: 0, textAlign: 'left' }} onClick={() => sitAt(i)} title="Ver desde este asiento">
                  <span className="zone-chip" style={{ background: data.zones[data.zoneIdx[i]]?.color }} />{seatLabel(data, i)}
                </button>
                <span>${(data.zones[data.zoneIdx[i]]?.price ?? 0).toFixed(2)}</span>
                <button className="btn-ghost btn-icon" onClick={() => deselect(i)} title="Quitar de la selección" aria-label="Quitar">×</button>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
