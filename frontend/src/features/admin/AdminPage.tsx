/**
 * Panel de administración (issue #11): imágenes de cabecera y categoría por evento.
 * Solo rol ADMIN. Validación en el cliente (tipo y tamaño) antes de enviar; el servidor manda.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import type { AdminEvent, EventCategory } from '../../api/types';
import { useAuthStore } from '../../store/auth';
import { EventCover } from '../../components/EventCover';
import { CATEGORY_LABEL } from '../../components/EventInfoCard';
import { UploadDrop } from './UploadDrop';

export function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const [events, setEvents] = useState<AdminEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = () => adminApi.events().then((r) => setEvents(r.events)).catch((e) => setError(e.message));
  useEffect(() => { if (user?.role === 'ADMIN') reload(); }, [user]);

  if (!user) return <main className="page"><div className="card"><p>Ingresa con una cuenta de administrador.</p><Link to="/ingresar">Ingresar</Link></div></main>;
  if (user.role !== 'ADMIN') return <main className="page"><div className="card error">Tu cuenta no tiene permisos de administración.</div></main>;

  return (
    <main className="page" style={{ maxWidth: 900 }}>
      <span className="eyebrow">Administración</span>
      <h1>Imágenes y categorías de eventos</h1>
      <p className="muted">Sube una imagen de cabecera por evento (JPEG, PNG o WebP; recomendado 1600×900, máximo 2 MB). Mientras no haya imagen se muestra una ilustración generada.</p>
      {error && <div className="error">{error}</div>}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {events?.map((e) => <EventRow key={e.id} event={e} onChange={reload} />)}
      </div>
    </main>
  );
}

function EventRow({ event, onChange }: { event: AdminEvent; onChange: () => void }) {
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const setCategory = async (category: EventCategory) => {
    try { await adminApi.patchEvent(event.id, { category }); setMsg({ kind: 'ok', text: 'Categoría actualizada.' }); onChange(); }
    catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); }
  };
  const remove = async () => {
    setBusy(true);
    try {
      if (event.assetId) await adminApi.deleteUpload(event.assetId); else await adminApi.patchEvent(event.id, { coverImageUrl: null });
      setMsg({ kind: 'ok', text: 'Imagen quitada. Se mostrará la ilustración generada.' }); onChange();
    } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); } finally { setBusy(false); }
  };

  return (
    <div className="card admin-row">
      <div>
        <div className="thumb"><EventCover name={event.name} category={event.category} coverImageUrl={event.coverImageUrl} /></div>
        <div className="faint" style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>{event.coverImageUrl ? 'Imagen subida' : 'Sin imagen · ilustración generada'}</div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
          <h3 style={{ margin: 0 }}>{event.name}</h3>
          <span className="faint" style={{ fontSize: '0.8rem' }}>{new Date(event.date).toLocaleDateString('es')}</span>
        </div>
        <div className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.6rem' }}>{event.venue}</div>
        <div className="field">
          <label htmlFor={`cat-${event.id}`}>Categoría</label>
          <select id={`cat-${event.id}`} value={event.category} onChange={(e) => setCategory(e.target.value as EventCategory)}>
            {(['FUTBOL', 'CONCIERTO', 'OTRO'] as EventCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </div>
        <UploadDrop onUploaded={async (asset) => {
          try { await adminApi.patchEvent(event.id, { coverImageUrl: asset.url }); setMsg({ kind: 'ok', text: 'Imagen asignada al evento.' }); onChange(); }
          catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); }
        }} onError={(t) => setMsg({ kind: 'err', text: t })} />
        {event.coverImageUrl && <div className="row-actions"><button className="btn-ghost" disabled={busy} onClick={remove}>Quitar imagen</button></div>}
        {msg && <div className={msg.kind === 'ok' ? 'success' : 'error'}>{msg.text}</div>}
      </div>
    </div>
  );
}
