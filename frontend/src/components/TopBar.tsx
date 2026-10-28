import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <Link to="/" className="brand">Seat<span>View</span> 3D</Link>
      <nav>
        <NavLink to="/">Eventos</NavLink>
        {user && <NavLink to="/boletos">Mis boletos</NavLink>}
        {user ? (
          <>
            <span className="muted" style={{ fontSize: '0.85rem' }}>{user.name}</span>
            <button className="btn-ghost" onClick={() => { logout(); navigate('/'); }}>Salir</button>
          </>
        ) : <NavLink to="/ingresar">Ingresar</NavLink>}
      </nav>
    </header>
  );
}
