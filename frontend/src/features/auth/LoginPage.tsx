/**
 * Inicio de sesión y registro (rediseño v3): pestañas Ingresar / Crear cuenta,
 * errores bajo cada campo, mostrar u ocultar la contraseña, barra de seguridad
 * al registrarse y "Mantener la sesión iniciada". Si se llega desde el pago,
 * recuerda que los asientos siguen apartados y vuelve ahí al ingresar.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi, eventsApi } from '../../api';
import { resolveImageUrl } from '../../components/EventCover';
import { Icon } from '../../components/Icon';
import { useAuthStore } from '../../store/auth';

// Cuentas que crea el seed (backend/prisma/seed.ts).
const DEMO_USERS = [
  { name: 'Javier Polanco', role: 'Administrador', email: 'javier.polanco@seatview.test', password: 'Javier12345!' },
  { name: 'Andrés Berríos', role: 'Cliente', email: 'andres.berrios@seatview.test', password: 'Andres12345!' },
];
const STRENGTH = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'];

/** 0–4: largo, mayúsculas y minúsculas, números y símbolos. */
export function passwordScore(pw: string) {
  return Number(pw.length >= 8) + Number(/[A-Z]/.test(pw) && /[a-z]/.test(pw)) + Number(/\d/.test(pw)) + Number(/[^A-Za-z0-9]/.test(pw));
}
export function authErrors(mode: 'login' | 'register', f: { name: string; email: string; password: string }) {
  const e: Partial<Record<'name' | 'email' | 'password', string>> = {};
  if (mode === 'register' && f.name.trim().length < 2) e.name = 'Escribe tu nombre.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Revisa el correo: falta algo.';
  if (f.password.length < 8) e.password = 'Usa al menos 8 caracteres.';
  return e;
}

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [art, setArt] = useState<string | null>(null);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const fromCheckout = from.endsWith('/pago');
  const register = mode === 'register';
  const errors = tried ? authErrors(mode, form) : {};
  const score = passwordScore(form.password);

  useEffect(() => {
    eventsApi.list().then((r) => {
      const covers = r.events.filter((e) => e.featured && e.coverImageUrl).map((e) => resolveImageUrl(e.coverImageUrl)!);
      setArt(covers[Math.floor(Math.random() * covers.length)] ?? null);
    }).catch(() => undefined);
  }, []);

  const update = (k: keyof typeof form) => (e: { target: { value: string } }) => { setForm({ ...form, [k]: e.target.value }); setError(null); };
  const switchMode = (m: 'login' | 'register') => { setMode(m); setTried(false); setError(null); };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setTried(true); setError(null);
    if (Object.keys(authErrors(mode, form)).length) return;
    setBusy(true);
    try {
      const email = form.email.trim().toLowerCase();
      const r = register ? await authApi.register(email, form.password, form.name.trim()) : await authApi.login(email, form.password);
      setSession(r.user, r.token, register || remember);
      navigate(from, { replace: true });
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <main className="auth-page">
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-head">
            <div className="kicker">{fromCheckout ? 'Un paso antes de pagar' : 'Bienvenido'}</div>
            <h1>{register ? 'Crea tu cuenta' : 'Ingresa a SeatView'}</h1>
            <p>{fromCheckout ? 'Tus asientos siguen apartados. Ingresa para completar el pago.' : register ? 'Guarda tus boletos y aparta asientos en segundos.' : 'Mira el escenario desde tu asiento y compra en minutos.'}</p>
          </div>
          <div className="segmented" role="tablist">
            <button type="button" role="tab" aria-selected={!register} className={!register ? 'active' : ''} onClick={() => switchMode('login')}>Ingresar</button>
            <button type="button" role="tab" aria-selected={register} className={register ? 'active' : ''} onClick={() => switchMode('register')}>Crear cuenta</button>
          </div>
          <form onSubmit={submit} noValidate className="auth-form">
            {register && (
              <div className="field"><label htmlFor="name">Nombre completo</label><input id="name" value={form.name} onChange={update('name')} autoComplete="name" placeholder="Como aparecerá en tus boletos" />
                {errors.name && <div className="field-error">{errors.name}</div>}</div>
            )}
            <div className="field"><label htmlFor="email">Correo electrónico</label><input id="email" type="email" value={form.email} onChange={update('email')} autoComplete="email" placeholder="tu@correo.com" />
              {errors.email && <div className="field-error">{errors.email}</div>}</div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <div className="password-input">
                <input id="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={update('password')} autoComplete={register ? 'new-password' : 'current-password'} placeholder="Mínimo 8 caracteres" />
                <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPw ? 'Ocultar' : 'Mostrar'}</button>
              </div>
              {register && <>
                <div className="strength" aria-hidden>{[0, 1, 2, 3].map((k) => <span key={k} className={k < score ? (score >= 3 ? 'good' : 'weak') : ''} />)}</div>
                <div className="strength-text">{form.password ? STRENGTH[score] : 'Usa 8+ caracteres, mayúsculas, números y un símbolo.'}</div>
              </>}
              {errors.password && <div className="field-error">{errors.password}</div>}
            </div>
            {!register && <label className="check"><input type="checkbox" checked={remember} onChange={() => setRemember(!remember)} />Mantener la sesión iniciada</label>}
            {error && <div className="error" role="alert">{error}</div>}
            <button type="submit" className="btn-primary btn-lg" disabled={busy}>{busy ? 'Un momento…' : register ? 'Crear cuenta' : 'Ingresar'}<Icon name="arrow" /></button>
          </form>
          <div className="demo-users">
            <h6>Cuentas de prueba</h6>
            <div>
              {DEMO_USERS.map((u) => (
                <button key={u.email} type="button" aria-label={`Usar la cuenta de prueba de ${u.name}`} onClick={() => { setMode('login'); setTried(false); setError(null); setForm({ name: '', email: u.email, password: u.password }); }}>
                  <strong>{u.name}</strong><span>{u.role} · {u.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="auth-art">
        <img src={art ?? '/models/cuscatlan-event.png'} alt="" />
        <div className="auth-art-scrim" />
        <div className="auth-art-copy">
          <div className="eyebrow">Con tu cuenta</div>
          <div className="auth-perks">
            <div><strong>Aparta 5 min</strong><span>Tu asiento queda bloqueado mientras pagas.</span></div>
            <div><strong>Boletos con QR</strong><span>Siempre a mano en Mis boletos.</span></div>
            <div><strong>Pago seguro</strong><span>Solo guardamos los últimos 4 dígitos.</span></div>
          </div>
        </div>
      </div>
    </main>
  );
}
