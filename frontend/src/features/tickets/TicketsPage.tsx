/** Mis boletos (issue #10): lista de boletos con QR y descarga en PNG. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ticketsApi } from '../../api';
import type { Ticket } from '../../api/types';
import { useAuthStore } from '../../store/auth';
import { TicketCard } from '../../components/TicketCard';

/** Compone un PNG del boleto (datos + QR) en un canvas y lo descarga. */
export async function downloadTicketPng(t: Ticket) {
  const canvas = document.createElement('canvas');
  canvas.width = 720; canvas.height = 400;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 720, 400);
  ctx.fillStyle = '#0f1a2b'; ctx.fillRect(0, 0, 720, 64);
  ctx.fillStyle = '#ffffff'; ctx.font = '600 26px Sora, sans-serif'; ctx.fillText('SeatView 3D · Boleto electrónico', 24, 42);
  ctx.fillStyle = '#0f1a2b'; ctx.font = '600 24px Sora, sans-serif'; ctx.fillText(t.event.name, 24, 110);
  ctx.font = '16px IBM Plex Sans, sans-serif';
  [`${t.event.venue}, ${t.event.city}`, new Date(t.event.date).toLocaleString('es', { dateStyle: 'full', timeStyle: 'short' }), t.seat.zone,
    `Fila ${t.seat.row} · Asiento ${t.seat.number}`, `Orden ${t.order.id}`, `Boleto ${t.id}`].forEach((l, i) => ctx.fillText(l, 24, 150 + i * 30));
  await new Promise<void>((resolve) => { const img = new Image(); img.onload = () => { ctx.drawImage(img, 420, 90, 270, 270); resolve(); }; img.src = t.qrData; });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `boleto-${t.seat.row}${t.seat.number}-${t.id.slice(-6)}.png`;
  a.click();
}

export function TicketsPage() {
  const user = useAuthStore((s) => s.user);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (user) ticketsApi.mine().then((r) => setTickets(r.tickets)).catch((e) => setError(e.message)); }, [user]);

  if (!user) return <main className="page"><div className="card"><p>Ingresa para ver tus boletos.</p><Link to="/ingresar">Ingresar</Link></div></main>;
  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <h1>Mis boletos</h1>
      {error && <div className="error">{error}</div>}
      {tickets && tickets.length === 0 && <div className="card"><p>Aún no tienes boletos.</p><Link to="/">Explorar eventos</Link></div>}
      <div style={{ display: 'grid', gap: '1.25rem' }}>
        {tickets?.map((t) => (
          <TicketCard key={t.id} eventName={t.event.name} date={t.event.date} venue={t.event.venue} city={t.event.city} zone={t.seat.zone} zoneColor={t.seat.zoneColor}
            row={t.seat.row} number={t.seat.number} price={t.seat.price} qrData={t.qrData} code={t.id}
            actions={<div className="row-actions"><button onClick={() => downloadTicketPng(t)}>Descargar PNG</button></div>} />
        ))}
      </div>
    </main>
  );
}
