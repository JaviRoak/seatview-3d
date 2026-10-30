/** Boleto: talón con los datos y QR blanco tras una línea perforada (rediseño v3). */
import type { ReactNode } from 'react';

interface Props {
  eventName: string; date: string; venue: string; city?: string; zone: string;
  row: string; number: number; price?: number; qrData: string; code?: string; actions?: ReactNode;
  /** full: confirmación de compra (fila, asiento y precio grandes) · compact: Mis boletos */
  variant?: 'full' | 'compact';
}

const price = (v?: number) => (v === undefined ? '—' : `$${v.toFixed(2).replace(/\.00$/, '')}`);

export function TicketCard(t: Props) {
  const d = new Date(t.date);
  const when = `${d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')} · ${d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  const ga = t.row === 'GA';
  const place = ga ? 'Entrada general · sin asiento asignado' : `Fila ${t.row} · Asiento ${t.number}`;
  return (
    <div className={`ticket ticket-${t.variant ?? 'compact'}`}>
      <div className="stub">
        {t.variant === 'full' ? <>
          <div className="ticket-head"><span>Boleto electrónico</span><span className="eyebrow">{when}</span></div>
          <div className="title">{t.eventName}</div>
          <div style={{ fontSize: 13 }}>{t.venue}{t.city ? `, ${t.city}` : ''} · {t.zone}</div>
          <div className="stat-row" style={{ borderBottom: 0 }}>
            <div className="stat"><span className="eyebrow">Fila</span><span className="value">{ga ? '—' : t.row}</span></div>
            <div className="stat"><span className="eyebrow">Asiento</span><span className="value">{ga ? 'Gral.' : t.number}</span></div>
            <div className="stat"><span className="eyebrow">Precio</span><span className="value">{price(t.price)}</span></div>
          </div>
        </> : <>
          <div className="eyebrow">{when}</div>
          <div className="title">{t.eventName}</div>
          <div style={{ fontSize: 13 }}>{t.zone} · {place}</div>
          <div className="faint" style={{ fontSize: 12 }}>{t.venue}{t.city ? `, ${t.city}` : ''}</div>
          <div className="ticket-price">{price(t.price)}</div>
        </>}
        {t.actions}
      </div>
      <div className="qr">
        <img src={t.qrData} alt="Código QR del boleto" />
        {t.code && <code>{t.code.slice(-12).toUpperCase()}</code>}
      </div>
    </div>
  );
}
