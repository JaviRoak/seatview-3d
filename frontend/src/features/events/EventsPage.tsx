/**
 * Cartelera (rediseño v3): cartel giratorio con los eventos destacados, el
 * destacado actual con su line-up, filtros fijos y agenda por mes con boletos
 * horizontales. Los eventos no destacados no salen en el cartel y van al final.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { eventsApi } from '../../api';
import type { EventCategory, EventSummary } from '../../api/types';
import { EventCover } from '../../components/EventCover';
import { Icon } from '../../components/Icon';
import { Billboard } from './Billboard';

const AUTOPLAY_MS = 6000;
export const CATEGORY_PLURAL: Record<EventCategory, string> = { FUTBOL: 'Deportes', CONCIERTO: 'Conciertos', OTRO: 'Otros' };
const FILTERS: Array<{ label: string; category: EventCategory | null }> = [{ label: 'Todos', category: null }, { label: 'Deportes', category: 'FUTBOL' }, { label: 'Conciertos', category: 'CONCIERTO' }];

export const money = (v: number) => `$${v.toFixed(2).replace(/\.00$/, '')}`;
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('es')} ${n === 1 ? one : many}`;
export function eventDate(iso: string) {
  const d = new Date(iso);
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleDateString('es', { month: 'short' }).replace('.', ''),
    time: d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false }),
    monthLabel: d.toLocaleDateString('es', { month: 'long', year: 'numeric' }).replace(' de ', ' '),
  };
}
const available = (e: EventSummary) => e.totalSeats - e.soldSeats;
const soldPct = (e: EventSummary) => (e.totalSeats ? Math.round((e.soldSeats / e.totalSeats) * 100) : 0);
/** Subtítulo tras "·" en el nombre (p. ej. "Andrea Bocelli · Romanza World Tour"). */
export function splitName(name: string) { const [title, ...rest] = name.split(' · '); return { title, subtitle: rest.join(' · ') }; }

/** Destacados primero (por fecha) y después el resto: la agenda conserva ese orden al agrupar por mes. */
export function agendaOrder(events: EventSummary[]) {
  return [...events].sort((a, b) => Number(b.featured) - Number(a.featured) || +new Date(a.date) - +new Date(b.date));
}
export function groupByMonth(events: EventSummary[]) {
  const groups: Array<{ label: string; items: EventSummary[] }> = [];
  for (const e of events) {
    const label = eventDate(e.date).monthLabel;
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(e); else groups.push({ label, items: [e] });
  }
  return groups;
}

export function EventsPage() {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [turn, setTurn] = useState(0);
  const [hover, setHover] = useState(false);
  const lastTurn = useRef(Date.now());
  const navigate = useNavigate();
  useEffect(() => { eventsApi.list().then((r) => setEvents(r.events)).catch((e) => setError(e.message)); }, []);

  const featured = useMemo(() => (events ?? []).filter((e) => e.featured).sort((a, b) => +new Date(a.date) - +new Date(b.date)), [events]);
  const n = featured.length;
  const hi = n ? ((turn % n) + n) % n : 0;
  const goTo = (t: number) => { lastTurn.current = Date.now(); setTurn(t); };
  useEffect(() => {
    if (n < 2 || hover) return;
    const id = window.setInterval(() => { if (Date.now() - lastTurn.current >= AUTOPLAY_MS) goTo(turn + 1); }, 250);
    return () => window.clearInterval(id);
  }, [n, hover, turn]);

  const category = (params.get('categoria') as EventCategory | null) ?? null;
  const filtered = useMemo(() => agendaOrder(events ?? []).filter((e) => (!category || e.category === category) && `${e.name} ${e.venue.name} ${e.venue.city}`.toLowerCase().includes(query.trim().toLowerCase())), [events, category, query]);
  const groups = groupByMonth(filtered);
  const hero = featured[hi];

  return (
    <main className="events-page">
      {error && <div className="page"><div className="error">No se pudieron cargar los eventos: {error}</div></div>}
      {!events && !error && <div className="page"><p className="notice">Cargando eventos…</p></div>}

      {hero && (
        <section className="hero">
          <div className="hero-wall">
            <Billboard events={featured} index={turn} onTurn={goTo} onHover={(h) => { setHover(h); lastTurn.current = Date.now(); }} />
            <div className="hero-tag"><span />En cartelera · {String(hi + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</div>
            {n > 1 && (
              <div className="hero-arrows">
                <button title="Anterior" aria-label="Anterior" onClick={() => goTo(turn - 1)}><Icon name="left" /></button>
                <button title="Siguiente" aria-label="Siguiente" onClick={() => goTo(turn + 1)}><Icon name="right" /></button>
              </div>
            )}
          </div>
          <div className="hero-info">
            <div className="hero-main">
              <div className="kicker">{CATEGORY_PLURAL[hero.category]} · {eventDate(hero.date).day} {eventDate(hero.date).month} · {eventDate(hero.date).time}</div>
              <div>
                <h1 title={hero.name}>{splitName(hero.name).title}</h1>
                <div className="hero-sub">{splitName(hero.name).subtitle && `${splitName(hero.name).subtitle} · `}{hero.venue.name}, {hero.venue.city}</div>
              </div>
              <div className="hero-cta">
                <button className="btn-primary btn-xl" onClick={() => navigate(`/eventos/${hero.id}`)}><span><Icon name="ticket" />Elegir asientos en 3D</span><Icon name="arrow" /></button>
                <span className="hero-price">{hero.minPrice !== null && <>Desde <strong>{money(hero.minPrice)}</strong> · </>}{plural(available(hero), 'disponible', 'disponibles')}</span>
              </div>
            </div>
            <div className="lineup" style={{ gridTemplateColumns: `repeat(${Math.min(n, 3)}, minmax(0, 1fr))` }}>
              {featured.slice(0, 3).map((e, k) => {
                const d = eventDate(e.date), active = k === hi;
                return (
                  <button key={e.id} className={`lineup-cell${active ? ' active' : ''}`} onClick={() => goTo(turn + ((k - hi + n) % n))}>
                    <span className="lineup-progress">{active && <span key={`${turn}${hover}`} className={hover ? 'paused' : ''} style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />}</span>
                    <span className="lineup-num">0{k + 1}</span>
                    <span className="lineup-date"><b>{d.day}</b>{d.month}</span>
                    <span className="lineup-name">{splitName(e.name).title}</span>
                    <span className="lineup-sub">{splitName(e.name).subtitle || e.venue.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {events && (
        <section className="filter-bar">
          <div className="filter-inner">
            <div className="filter-tabs" role="tablist">
              {FILTERS.map((f) => (
                <button key={f.label} role="tab" aria-selected={category === f.category} className={category === f.category ? 'active' : ''}
                  onClick={() => setParams(f.category ? { categoria: f.category } : {}, { replace: true })}>{f.label}</button>
              ))}
            </div>
            <label className="filter-search"><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar artista, evento o recinto" aria-label="Buscar" /></label>
            <span className="filter-count">{plural(filtered.length, 'evento', 'eventos')}</span>
          </div>
        </section>
      )}

      {events && (
        <section className="agenda">
          {groups.map((g) => (
            <div key={g.label} className="agenda-month">
              <div className="agenda-label"><div><span /><strong>{g.label}</strong><small>{plural(g.items.length, 'evento', 'eventos')}</small></div></div>
              <div className="agenda-items">{g.items.map((e) => <EventTicket key={e.id} event={e} />)}</div>
            </div>
          ))}
          {!filtered.length && <p className="agenda-empty">Ningún evento coincide con tu búsqueda.</p>}
        </section>
      )}

      <section className="how">
        <div className="how-inner">
          {[['01', 'Explora', 'Elige una zona en el plano del recinto.'], ['02', 'Siéntate', 'Mira el escenario desde ese asiento.'], ['03', 'Aparta', 'Queda bloqueado para ti mientras pagas.'], ['04', 'Entra', 'Boleto con QR en tu correo y aquí.']].map(([num, title, text]) => (
            <div key={num}><span>{num}</span><strong>{title}</strong><p>{text}</p></div>
          ))}
        </div>
      </section>
    </main>
  );
}

/** Boleto horizontal de la agenda: portada, datos con % vendido y talón con el precio. */
function EventTicket({ event: e }: { event: EventSummary }) {
  const d = eventDate(e.date), pct = soldPct(e), { title, subtitle } = splitName(e.name);
  return (
    <article className="event-ticket">
      <div className="event-ticket-cover"><EventCover name={e.name} category={e.category} coverImageUrl={e.coverImageUrl} /></div>
      <Link to={`/eventos/${e.id}`} className="event-ticket-body">
        <span className="event-ticket-info">
          <span className="event-ticket-meta"><b>{CATEGORY_PLURAL[e.category]}</b>{d.day} {d.month} · {d.time}</span>
          <span className="event-ticket-name" title={e.name}>{title}</span>
          <span className="event-ticket-venue">{subtitle && `${subtitle} · `}{e.venue.name}, {e.venue.city}</span>
          <span className="event-ticket-sold"><span className="progress" aria-label={`${pct}% vendido`}><span style={{ width: `${pct}%` }} /></span>{pct}% vendido</span>
        </span>
        <span className="event-ticket-stub">
          <span><small>Desde</small><b>{e.minPrice !== null ? money(e.minPrice) : '—'}</b></span>
          <span className="event-ticket-cta">Boletos<Icon name="arrow" size={16} /></span>
        </span>
      </Link>
    </article>
  );
}
