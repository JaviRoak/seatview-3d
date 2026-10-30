/**
 * Tarjeta del asiento en POV (Cambio 1 y 3): insignia "Vista previa", sección,
 * FILA/ASIENTO/PRECIO, atributos derivados, calidad de vista, navegación entre
 * vecinos y el ÚNICO botón que aparta el asiento.
 */
import type { EventDetail } from '../../api/types';
import { useSeatsStore } from '../../store/seats';
import { useAuthStore } from '../../store/auth';
import { seatAttributes, viewQuality } from '../../scene/seatInsights';
import { neighborSeat, type Direction } from '../../scene/seatNavigation';
import {PreviewCard,PreviewNavigation} from './PreviewCard';
import {nearestInDirection} from '../../scene/previewNavigation';
import {eventTargetXZ} from '../../scene/eventTarget';
import { Icon } from '../../components/Icon';

interface Props {
  event: EventDetail; idx: number; busy: boolean;
  onReserve: (idx: number) => void; onRelease: (idx: number) => void; onMove: (idx: number) => void; onExit: () => void;
}

const ICONS = {
  center: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></svg>,
  exit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 4h6v16h-6M10 8l-4 4 4 4M6 12h12" /></svg>,
  front: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="9" width="16" height="10" rx="2" /><path d="M8 9V6h8v3" /></svg>,
  high: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 18l6-8 4 5 3-3 3 6z" /></svg>,
  aisle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 20V8l7-4 7 4v12" /><path d="M9 20v-6h6v6" /></svg>,
};
const CHECK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 'auto', width: 16, height: 16 }}><path d="M5 12l5 5 9-10" /></svg>;

export function SeatCard({ event, idx, busy, onReserve, onRelease, onMove, onExit }: Props) {
  const data = useSeatsStore((s) => s.data);
  const status = useSeatsStore((s) => s.status);
  const lockedBy = useSeatsStore((s) => s.lockedBy);
  const selected = useSeatsStore((s) => s.selected);
  useSeatsStore((s) => s.version);
  const user = useAuthStore((s) => s.user);
  if (!data) return null;

  const zone = data.zones[data.zoneIdx[idx]];
  const [section, level] = (zone?.name ?? 'Zona · Nivel').split(' · ');
  const q = viewQuality(data, idx, event.venue.layout);
  const mixed=!!event.venue.layout.admission,concert=!!event.venue.layout.concert;
  const attrs = mixed ? [{icon:'front' as const,text:concert?'Vista hacia el escenario':'Vista hacia la cancha'},{icon:'center' as const,text:'Lugar numerado'}] : seatAttributes(data, idx, event.venue.layout, q);
  const mine = selected.includes(idx) || (status[idx] === 1 && lockedBy.get(idx) === user?.id);
  const reason = status[idx] === 2 ? 'Vendido. Prueba el de al lado con las flechas.' : status[idx] === 1 && !mine ? 'Otra persona lo está pagando ahora. Si no completa, se libera en minutos.' : null;
  const can = (d: Direction) => concert ? nearestInDirection(
    [data.positions[idx*3],data.positions[idx*3+2]],
    Array.from({length:data.count},(_,i)=>({id:i,x:data.positions[i*3],z:data.positions[i*3+2]})).filter(p=>p.id!==idx&&data.zoneIdx[p.id]===data.zoneIdx[idx]&&data.rows[p.id]!=='GA'),d,eventTargetXZ(event.venue.layout)
  ) : neighborSeat(data, idx, d);
  const neighbors={left:can('left'),right:can('right'),front:can('front'),back:can('back')};
  const ringColor = q.percentile >= 75 ? '#ffd60a' : q.percentile >= 55 ? '#ffe98a' : '#a5a499';
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const breakdown = `Cercanía al campo ${pct(q.D)} (${Math.round(q.distance)} m al centro) · Alineación con el eje ${pct(q.A)} (θ ${Math.round(q.angleDeg)}°) · Ángulo de visión ${pct(q.E)} (${q.elevationDeg.toFixed(1)}° de elevación)`;

  return (
    <PreviewCard title={section} subtitle={<>{level?`${level} · `:''}<span className="zone-chip" style={{background:zone?.color}}/>{event.venue.name}</>}
      quality={!mixed&&<span className="quality" title={breakdown}>
          <span className="ring" style={{ background: ringColor }}>{q.percentile}</span>{q.label}
        </span>}
      description={mixed?'Explora la vista desde este lugar antes de apartarlo.':<span title={breakdown}>
        Mejor que el {q.percentile}% de los asientos del recinto
        <span className="faint"> · cercanía {pct(q.D)} · alineación {pct(q.A)} · ángulo {pct(q.E)}</span>
      </span>}
      stats={[{label:concert&&data.rows[idx].startsWith('M')?'Mesa':'Fila',value:concert&&data.rows[idx].startsWith('M')?Number(data.rows[idx].slice(1)):data.rows[idx]},{label:'Asiento',value:data.numbers[idx]},{label:event.venue.layout.concert?.kind==='bocelli'?'Precio prueba':'Precio',value:`$${zone?.price.toFixed(2).replace(/\.00$/,'')}`}]}>
      {attrs.length > 0 && (
        <ul className="attr-list">
          {attrs.map((a) => <li key={a.text}>{ICONS[a.icon]}<span>{a.text}</span>{CHECK}</li>)}
        </ul>
      )}
      {mine ? (
        <button className="btn-lg" disabled={busy} onClick={() => onRelease(idx)}>Quitar de mi reserva</button>
      ) : (
        <button className="btn-primary btn-lg" disabled={busy || !!reason} title={reason ?? undefined} onClick={() => onReserve(idx)}>
          <span>{busy ? 'Apartando…' : 'Apartar este asiento'}</span><Icon name="arrow" />
        </button>
      )}
      {reason && <p className="seat-blocked" role="status">{reason}</p>}
      <PreviewNavigation canMove={d=>neighbors[d]!==null} onMove={d=>{const n=neighbors[d];if(n!==null)onMove(n);}} onExit={onExit}/>
    </PreviewCard>
  );
}
