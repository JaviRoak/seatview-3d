import { applyPageMeta, eventMeta, pageTitle, truncate } from './meta';
import type { EventDetail } from '../api/types';

const loc = { origin: 'https://seatview.test', pathname: '/eventos/final-nacional-2026' };
const meta = (sel: string) => document.head.querySelector(sel)?.getAttribute('content');

const event = {
  id: 'final-nacional-2026',
  name: 'Final Nacional de Fútbol · Clásico',
  description: null,
  date: '2026-12-13T02:00:00.000Z',
  category: 'FUTBOL',
  coverImageUrl: '/models/cuscatlan-event.png',
  venue: { id: 'v1', name: 'Estadio Cuscatlán', city: 'San Salvador', imageUrl: null, layout: {} as never, zones: [{ id: 'z1', name: 'Sol', color: '#fff', price: 15 }, { id: 'z2', name: 'Platea', color: '#000', price: 60 }] },
} satisfies EventDetail;

describe('SEO: metadatos por página', () => {
  it('arma el título con el nombre del sitio', () => {
    expect(pageTitle('Contacto')).toBe('Contacto | SeatView 3D');
    expect(pageTitle()).toContain('SeatView 3D');
  });

  it('recorta descripciones largas sin cortar palabras', () => {
    const out = truncate('palabra '.repeat(40), 160);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('palabra…')).toBe(true);
    expect(truncate('corta')).toBe('corta');
  });

  it('aplica title, descripción, canonical y Open Graph al <head>', () => {
    applyPageMeta({ title: 'Contacto', description: 'Escríbenos.' }, loc);
    expect(document.title).toBe('Contacto | SeatView 3D');
    expect(meta('meta[name="description"]')).toBe('Escríbenos.');
    expect(meta('meta[name="robots"]')).toBe('index, follow');
    expect(meta('meta[property="og:url"]')).toBe('https://seatview.test/eventos/final-nacional-2026');
    expect(meta('meta[property="og:image"]')).toBe('https://seatview.test/og-image.jpg');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://seatview.test/eventos/final-nacional-2026');
  });

  it('no duplica etiquetas al cambiar de página y marca noindex las privadas', () => {
    applyPageMeta({ title: 'A' }, loc);
    applyPageMeta({ title: 'Mis boletos', noindex: true }, loc);
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(meta('meta[name="robots"]')).toBe('noindex, nofollow');
  });

  it('genera título, descripción y schema.org/Event de un evento', () => {
    const m = eventMeta(event);
    expect(m.title).toBe('Final Nacional de Fútbol · Estadio Cuscatlán');
    expect(m.description).toMatch(/^Final Nacional de Fútbol en Estadio Cuscatlán, San Salvador/);
    expect(m.description!.length).toBeLessThanOrEqual(160);
    applyPageMeta(m, loc);
    const ld = JSON.parse(document.getElementById('seo-jsonld')!.textContent!);
    expect(ld['@type']).toBe('Event');
    expect(ld.location.name).toBe('Estadio Cuscatlán');
    expect(ld.offers).toMatchObject({ lowPrice: 15, highPrice: 60, priceCurrency: 'USD' });
    applyPageMeta({ title: 'Contacto' }, loc);
    expect(document.getElementById('seo-jsonld')).toBeNull();
  });
});
