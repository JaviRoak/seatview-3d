import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/auth';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('andres.berrios@seatview.test');
  const [password, setPassword] = useState('Andres12345!');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const r = mode === 'login' ? await authApi.login(email, password) : await authApi.register(email, password, name);
      setSession(r.user, r.token);
      navigate(from, { replace: true });
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <main className="page" style={{ maxWidth: 440 }}>
      <div className="card">
        <h1>{mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</h1>
        <p className="notice">Usuarios de prueba: andres.berrios@seatview.test / Andres12345! · javier.polanco@seatview.test / Javier12345! (administrador)</p>
        <form onSubmit={submit}>
          {mode === 'register' && <div className="field"><label htmlFor="name">Nombre</label><input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></div>}
          <div className="field"><label htmlFor="email">Correo</label><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="field"><label htmlFor="password">Contraseña</label><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></div>
          {error && <div className="error">{error}</div>}
          <div className="row-actions">
            <button className="btn-primary" disabled={busy}>{busy ? 'Un momento…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
            <button type="button" className="btn-ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'No tengo cuenta' : 'Ya tengo cuenta'}</button>
          </div>
        </form>
      </div>
    </main>
  );
}
