/** Boleto con borde perforado y zona de QR diferenciada (Cambio 3). */
import type { ReactNode } from 'react';

interface Props {
  eventName: string; date: string; venue: string; city?: string; zone: string; zoneColor?: string;
  row: string; number: number; price?: number; qrData: string; code?: string; category?: string; actions?: ReactNode;
}

export function TicketCard(t: Props) {
  const d = new Date(t.date);
  return (
    <div className="card ticket">
      <div className="stub">
        <div className="ticket-head">
          <span className="eyebrow">Boleto electrónico</span>
          {t.zoneColor && <span className="zone-chip" style={{ background: t.zoneColor, width: 12, height: 12 }} />}
        </div>
        <div className="title">{t.eventName}</div>
        <div className="muted" style={{ fontSize: '0.88rem' }}>{d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })} · {d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</div>
        <div className="faint" style={{ fontSize: '0.82rem' }}>{t.venue}{t.city ? `, ${t.city}` : ''} · {t.zone}</div>
        <div className="stat-row">
          {t.row === 'GA' ? <div className="stat"><span className="eyebrow">Acceso por zona</span><span>Sin asiento asignado</span></div> : <>
            <div className="stat"><span className="eyebrow">Fila</span><span className="value">{t.row}</span></div>
            <div className="stat"><span className="eyebrow">Asiento</span><span className="value">{t.number}</span></div>
          </>}
          <div className="stat"><span className="eyebrow">Precio</span><span className="value">{t.price !== undefined ? `$${t.price.toFixed(0)}` : '—'}</span></div>
        </div>
        {t.actions}
      </div>
      <div className="qr">
        <img src={t.qrData} alt="Código QR del boleto" />
        <span className="eyebrow">Escanear en la entrada</span>
        {t.code && <span className="faint" style={{ fontSize: '0.68rem', fontFamily: 'ui-monospace, monospace' }}>{t.code.slice(-12)}</span>}
      </div>
    </div>
  );
}
