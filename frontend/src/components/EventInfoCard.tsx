import type { EventDetail } from '../api/types';
import { EventCover } from './EventCover';
import type {ReactNode} from 'react';

export const CATEGORY_LABEL: Record<string, string> = { FUTBOL: 'Fútbol', CONCIERTO: 'Concierto', OTRO: 'Evento' };

interface Props {
  event:EventDetail; seats:number; connected:boolean; stress?:number;
  available?:number;
  crowd?:{visible:boolean;onChange:(visible:boolean)=>void};
  children?:ReactNode;
}

/** Shared compact event banner; optional controls and details come from the event. */
export function EventInfoCard({ event, seats, connected, stress=0,available,crowd,children }:Props) {
  const d = new Date(event.date);
  return (
    <section className="card event-banner" aria-label="Información del evento">
      <div className="event-banner-main">
        <div className="event-banner-image"><EventCover key={event.coverImageUrl??event.id} name={event.name} category={event.category} coverImageUrl={event.coverImageUrl} compact /></div>
        <div className="event-banner-body">
          <div className="event-banner-meta"><span className="eyebrow">{CATEGORY_LABEL[event.category]}</span>{(event.venue.layout.concert?.demo||stress>0)&&<span className="event-banner-demo">{stress?'Prueba':'Demo'}</span>}</div>
          <h1>{event.name}</h1>
          <time dateTime={event.date}>{d.toLocaleDateString('es',{day:'numeric',month:'short'})} · {d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</time>
          <div className="event-banner-venue">{event.venue.name}</div>
        </div>
      </div>
      {event.venue.layout.concert?.kind==='bocelli'&&<p className="notice" style={{margin:'.5rem .8rem'}}>Plano provisional basado en Maná. Precios, numeración y cupos de prueba; no son la distribución ni las tarifas oficiales de Bocelli.</p>}
      <div className="event-banner-footer">
        <span><strong>{(available??seats).toLocaleString('es')}</strong> {stress?'sintéticos':available===undefined?'localidades':'disponibles'}</span>
        <span className="event-banner-live" title={connected?'Disponibilidad actualizada en tiempo real':'Conectando con el servidor'}><i className={connected?'online':''}/>{connected?'En vivo':'Conectando'}</span>
      </div>
      {(crowd||children)&&<div className="event-banner-options">
        {crowd&&<label className="event-banner-crowd"><input type="checkbox" checked={crowd.visible} onChange={e=>crowd.onChange(e.target.checked)}/> Público <span className="faint">ilustrativo</span></label>}
        {children&&<details className="event-banner-details"><summary>Detalles</summary><div className="event-banner-details-body">{children}</div></details>}
      </div>}
    </section>
  );
}
