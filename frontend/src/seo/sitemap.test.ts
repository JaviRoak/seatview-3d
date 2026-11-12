import { buildRobots, buildSitemap, fetchSitemapEvents, resolveSiteUrl, SEED_EVENT_IDS } from './sitemap';

describe('SEO: robots.txt y sitemap.xml', () => {
  it('resuelve la URL del sitio desde VITE_SITE_URL o Vercel', () => {
    expect(resolveSiteUrl({ VITE_SITE_URL: 'https://seatview.app/' })).toBe('https://seatview.app');
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'seatview.vercel.app' })).toBe('https://seatview.vercel.app');
    expect(resolveSiteUrl({})).toBe('');
  });

  it('incluye páginas públicas y eventos, y deja fuera las privadas', () => {
    const xml = buildSitemap('https://seatview.app', [{ id: 'beele-cuscatlan-2026' }], '2026-11-12');
    expect(xml).toContain('<loc>https://seatview.app/</loc>');
    expect(xml).toContain('<loc>https://seatview.app/preguntas-frecuentes</loc>');
    expect(xml).toContain('<loc>https://seatview.app/eventos/beele-cuscatlan-2026</loc>');
    expect(xml).toContain('<lastmod>2026-11-12</lastmod>');
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('/ingresar');
  });

  it('robots.txt bloquea las rutas privadas y apunta al sitemap', () => {
    const txt = buildRobots('https://seatview.app');
    expect(txt).toContain('Disallow: /admin');
    expect(txt).toContain('Disallow: /eventos/*/pago');
    expect(txt).toContain('Sitemap: https://seatview.app/sitemap.xml');
    expect(buildRobots('')).not.toContain('Sitemap:');
  });

  it('usa los eventos de la API y, si falla, los del seed', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ events: [{ id: 'nuevo-evento' }] })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchSitemapEvents('https://api.test')).toEqual({ events: [{ id: 'nuevo-evento' }], source: 'api' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/events', expect.anything());

    fetchMock.mockRejectedValueOnce(new Error('sin red'));
    const fallback = await fetchSitemapEvents('https://api.test');
    expect(fallback.source).toBe('seed');
    expect(fallback.events.map((e) => e.id)).toEqual(SEED_EVENT_IDS);
    vi.unstubAllGlobals();
  });
});
