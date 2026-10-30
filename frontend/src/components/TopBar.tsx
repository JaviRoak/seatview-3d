import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { ticketsApi } from '../api';
import { useAuthStore } from '../store/auth';
import { useReservationStore } from '../store/reservation';
import { Icon } from './Icon';

export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
export const clock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Chip con la reserva en curso: lleva al pago desde cualquier pantalla. Rojo/amarillo bajo 1 minuto. */
function ReservationChip() {
  const current = useReservationStore((s) => s.current);
  const set = useReservationStore((s) => s.set);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!current) return; const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, [current]);
  useEffect(() => { if (current && now >= current.expiresAt) set(null); }, [current, now, set]);
  if (!current || now >= current.expiresAt) return null;
  const left = current.expiresAt - now;
  const to = `/eventos/${current.eventId}/pago`;
  return (
    <button className={`reservation-chip${left < 60_000 ? ' urgent' : ''}`} onClick={() => navigate(user ? to : '/ingresar', user ? undefined : { state: { from: to } })} title="Ir al pago">
      <Icon name="clock" size={16} />
      <span>{current.count} {current.count === 1 ? 'apartado' : 'apartados'} · {clock(left)}</span>
      <Icon name="arrow" size={14} />
    </button>
  );
}

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const refresh = useReservationStore((s) => s.refresh);
  const clearReservation = useReservationStore((s) => s.set);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [tickets, setTickets] = useState(0);
  useEffect(() => { if (user) void refresh(); }, [user, refresh]);
  // Se recalcula al cambiar de pantalla: una compra nueva aparece al salir del pago.
  useEffect(() => { if (!user) { setTickets(0); return; } ticketsApi.mine().then((r) => setTickets(r.tickets.length)).catch(() => undefined); }, [user, pathname]);
  return (
    <header className="topbar">
      <Link to="/" className="brand">SEATVIEW<span>3D</span></Link>
      <nav>
        <NavLink to="/" end className={({ isActive }) => (isActive || pathname.startsWith('/eventos') ? 'active' : '')}>Eventos</NavLink>
        {user && <NavLink to="/boletos">Mis boletos{tickets > 0 && <span className="count">{tickets}</span>}</NavLink>}
        {user?.role === 'ADMIN' && <NavLink to="/admin">Administración</NavLink>}
      </nav>
      <ReservationChip />
      {user ? (
        <div className="topbar-user">
          <span className="avatar" aria-hidden>{initials(user.name)}</span>
          <span className="name">{user.name}</span>
          <button className="btn-square" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => { logout(); clearReservation(null); navigate('/'); }}><Icon name="logout" size={15} /></button>
        </div>
      ) : (
        <button className="btn-primary" onClick={() => navigate('/ingresar', { state: { from: pathname } })}><Icon name="user" size={16} />Ingresar</button>
      )}
    </header>
  );
}
