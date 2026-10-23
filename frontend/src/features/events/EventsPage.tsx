import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi } from '../../api';
import type { EventSummary } from '../../api/types';
import { EventCover } from '../../components/EventCover';
import { CATEGORY_LABEL } from '../../components/EventInfoCard';

export function EventsPage() {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { eventsApi.list().then((r) => setEvents(r.events)).catch((e) => setError(e.message)); }, []);
  return (
    <main className="page">
      <header className="page-hero">
        <span className="eyebrow">Boletaje con vista previa 3D</span>
        <h1>Elige tu zona y explora la vista</h1>
        <p>Recorre el estadio en 3D y consulta la disponibilidad. Compra entradas por zona o elige un asiento en los sectores numerados.</p>
      </header>
      {error && <div className="error">No se pudieron cargar los eventos: {error}. ¿Está corriendo el backend en el puerto 4000?</div>}
      {!events && !error && <p className="notice" style={{ textAlign: 'center' }}>Cargando eventos…</p>}
      <div className="card-grid">
        {events?.map((e) => {
          const pct = e.totalSeats ? Math.round((e.soldSeats / e.totalSeats) * 100) : 0;
          const d = new Date(e.date);
          return (
            <Link key={e.id} to={`/eventos/${e.id}`} className="card event-card">
              <div className="cover"><EventCover name={e.name} category={e.category} coverImageUrl={e.coverImageUrl} /></div>
              <div className="body">
                <div className="meta"><span className={`badge cat-${e.category}`}>{CATEGORY_LABEL[e.category]}</span><span>{d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })} · {d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span></div>
                <h2 style={{ margin: 0 }}>{e.name}</h2>
                <span className="muted">{e.venue.name} · {e.venue.city}</span>
                {e.description && <p className="notice" style={{ margin: 0 }}>{e.description}</p>}
                <div className="meta" style={{ marginTop: '0.35rem' }}>
                  <span>{(e.totalSeats - e.soldSeats).toLocaleString('es')} disponibles</span>
                  <span className="faint">{pct}% vendido</span>
                </div>
                <div className="progress" aria-label={`${pct}% de entradas vendidas`}><span style={{ width: `${pct}%` }} /></div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
