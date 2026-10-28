/** Carrito de reservas: asientos apartados uno a uno, cuenta regresiva y pago. */
import { Countdown } from '../../components/Countdown';
import { seatLabel, useSeatsStore } from '../../store/seats';

export function ReservationCard({ onRelease, onCheckout, onGoTo,busy=false }: { onRelease: (idx: number) => void; onCheckout: () => void; onGoTo: (idx: number) => void;busy?:boolean }) {
  const data = useSeatsStore((s) => s.data);
  const selected = useSeatsStore((s) => s.selected);
  const ttls = useSeatsStore((s) => s.ttls);
  useSeatsStore((s) => s.version);
  if (!data || selected.length === 0) return null;
  const price = (i: number) => data.zones[data.zoneIdx[i]]?.price ?? 0;
  const total = selected.reduce((a, i) => a + price(i), 0);
  const minTtl = Math.min(...selected.map((i) => ttls.get(i) ?? 0));
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><span className="eyebrow">Tu reserva</span><div className="muted" style={{ fontSize: '0.8rem' }}>{selected.length} {selected.length === 1 ? 'entrada apartada' : 'entradas apartadas'}</div></div>
        <Countdown seconds={minTtl} />
      </div>
      {selected.map((i) => (
        <div key={i} className="seat-row">
          <button className="btn-ghost" style={{ padding: 0, border: 0, textAlign: 'left' }} onClick={() => onGoTo(i)} title={data.rows[i]==='GA'?'Explorar esta zona':'Ver desde este asiento'}>
            <span className="zone-chip" style={{ background: data.zones[data.zoneIdx[i]]?.color }} />{seatLabel(data, i)}
          </button>
          <span>${price(i).toFixed(2)}</span>
          <button className="btn-ghost btn-icon" disabled={busy} onClick={() => onRelease(i)} title="Quitar de la reserva" aria-label="Quitar">×</button>
        </div>
      ))}
      <div className="total"><span>Total</span><span>${total.toFixed(2)}</span></div>
      <div className="row-actions"><button className="btn-primary" disabled={busy} onClick={onCheckout}>Pagar ahora</button></div>
    </div>
  );
}
