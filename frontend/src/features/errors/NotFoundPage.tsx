import { Link } from 'react-router-dom';
import { usePageMeta } from '../../seo/meta';

/** Página 404: rutas que no existen y eventos que la API no encuentra. */
export function NotFoundPage({ message = 'La página que buscas no existe o fue movida.' }: { message?: string }) {
  usePageMeta({ title: 'Página no encontrada', noindex: true });
  return (
    <main className="page">
      <div className="page-hero">
        <img src="/404.webp" alt="" width={380} height={165} style={{ maxWidth: '80%', height: 'auto', margin: '0 auto 8px', display: 'block' }} />
        <h1>Página no encontrada</h1>
        <p>{message}</p>
        <p style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
          <Link className="btn btn-primary" to="/">Ver la cartelera</Link>
          <Link className="btn" to="/preguntas-frecuentes">Preguntas frecuentes</Link>
        </p>
      </div>
    </main>
  );
}
