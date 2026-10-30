import { useEffect,useState } from 'react';
import { useParams } from 'react-router-dom';
import { eventsApi } from '../../api';
import type {EventDetail} from '../../api/types';
import { EventPage } from './EventPage';
import { ZoneEventPage } from './ZoneEventPage';
export function EventEntryPage(){
  const {eventId}=useParams();const [event,setEvent]=useState<EventDetail|null>(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;setEvent(null);setError('');eventsApi.get(eventId!).then(r=>{if(active)setEvent(r.event);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[eventId]);
  if(error)return <main className="page"><p role="alert">{error}</p></main>;
  if(!event)return <main className="page">Cargando evento…</main>;
  return event.venue.layout.admission ? <ZoneEventPage key={event.id} event={event}/> : <EventPage key={event.id}/>;
}
