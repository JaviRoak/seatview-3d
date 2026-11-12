import { Link } from 'react-router-dom';
import { usePageMeta } from '../../seo/meta';

/** Página 404: rutas que no existen y eventos que la API no encuentra. */
export function NotFoundPage({ message = 'La página que buscas no existe o fue movida.' }: { message?: string }) {
  usePageMeta({ title: 'Página no encontrada', noindex: true });
  return (
    <main className="page">
      <div className="page-hero">
        <p className="notice">Error 404</p>
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
