/** Panel lateral (issue #7): detalles del asiento enfocado, reservas propias con cuenta regresiva y acceso al pago. */
import { Countdown } from '../../components/Countdown';
import type { EventDetail } from '../../api/types';
import { seatLabel, useSeatsStore } from '../../store/seats';
import { useAuthStore } from '../../store/auth';

interface Props {
  event: EventDetail; connected: boolean; stress: number; notice: string | null; focusIdx: number | null;
  onPov: (idx: number) => void; onRelease: (idx: number) => void; onCheckout: () => void;
}

export function SeatPanel({ event, connected, stress, notice, focusIdx, onPov, onRelease, onCheckout }: Props) {
  const data = useSeatsStore((s) => s.data);
  const selected = useSeatsStore((s) => s.selected);
  const ttls = useSeatsStore((s) => s.ttls);
  const status = useSeatsStore((s) => s.status);
  const lockedBy = useSeatsStore((s) => s.lockedBy);
  useSeatsStore((s) => s.version);
  const user = useAuthStore((s) => s.user);
  const price = (i: number) => data?.zones[data.zoneIdx[i]]?.price ?? 0;
  const total = selected.reduce((acc, i) => acc + price(i), 0);
  const minTtl = selected.length ? Math.min(...selected.map((i) => ttls.get(i) ?? 0)) : 0;

  return (
    <>
      <div className="panel">
        <h2 style={{ marginBottom: 0 }}>{event.name}</h2>
        <p className="muted">{new Date(event.date).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })} · {event.venue.name}</p>
        <p className="notice">
          {stress ? `Modo estrés: ${data?.count.toLocaleString('es')} asientos sintéticos` : connected ? 'Disponibilidad en tiempo real activa' : 'Conectando al tiempo real…'}
          {data && !stress && ` · ${data.count.toLocaleString('es')} asientos`}
        </p>
        <p className="notice">Arrastra para girar, rueda para acercar. Pasa el cursor sobre un asiento y haz clic para reservarlo.</p>
      </div>

      {notice && <div className="error">{notice}</div>}

      {focusIdx !== null && data && (
        <div className="panel">
          <h3>{seatLabel(data, focusIdx)}</h3>
          <p className="muted">
            ${price(focusIdx).toFixed(2)} · {status[focusIdx] === 2 ? 'Vendido' : status[focusIdx] === 1 ? (lockedBy.get(focusIdx) === user?.id ? 'Reservado por ti' : 'En compra por otro usuario') : 'Disponible'}
          </p>
          <div className="row-actions"><button onClick={() => onPov(focusIdx)}>Ver desde este asiento</button></div>
        </div>
      )}

      {selected.length > 0 && data && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Tu reserva</h3>
            <Countdown seconds={minTtl} />
          </div>
          <p className="notice">Los asientos quedan apartados mientras completas el pago.</p>
          {selected.map((i) => (
            <div key={i} className="seat-row">
              <span><span className="zone-chip" style={{ background: data.zones[data.zoneIdx[i]]?.color }} />{seatLabel(data, i)}</span>
              <span>${price(i).toFixed(2)}</span>
              <button className="btn-ghost" onClick={() => onRelease(i)} title="Quitar de la reserva">×</button>
            </div>
          ))}
          <div className="total"><span>Total</span><span>${total.toFixed(2)}</span></div>
          <div className="row-actions"><button className="btn-primary" onClick={onCheckout}>Pagar {selected.length} {selected.length === 1 ? 'asiento' : 'asientos'}</button></div>
        </div>
      )}
    </>
  );
}
