import { useEffect,useState } from 'react';
import { useParams } from 'react-router-dom';
import { eventsApi } from '../../api';
import { ApiError } from '../../api/client';
import type {EventDetail} from '../../api/types';
import { eventMeta, usePageMeta } from '../../seo/meta';
import { EventPage } from './EventPage';
import { ZoneEventPage } from './ZoneEventPage';
import { NotFoundPage } from '../errors/NotFoundPage';
export function EventEntryPage(){
  const {eventId}=useParams();const [event,setEvent]=useState<EventDetail|null>(null),[error,setError]=useState(''),[notFound,setNotFound]=useState(false);
  useEffect(()=>{let active=true;setEvent(null);setError('');setNotFound(false);eventsApi.get(eventId!).then(r=>{if(active)setEvent(r.event);}).catch(e=>{if(!active)return;if(e instanceof ApiError&&e.status===404)setNotFound(true);else setError(e.message);});return()=>{active=false;};},[eventId]);
  // Título, descripción, Open Graph y schema.org/Event del evento; mientras carga, los del sitio.
  usePageMeta(event ? eventMeta(event) : notFound ? { title: 'Página no encontrada', noindex: true } : error ? { title: 'Error al cargar el evento', noindex: true } : {});
  if(notFound)return <NotFoundPage message="El evento que buscas no existe o ya no está disponible."/>;
  if(error)return <main className="page"><p role="alert">{error}</p></main>;
  if(!event)return <main className="page">Cargando evento…</main>;
  return event.venue.layout.admission ? <ZoneEventPage key={event.id} event={event}/> : <EventPage key={event.id}/>;
}
