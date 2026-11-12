/**
 * Generación de robots.txt y sitemap.xml (Sprint 4). Lo usa el plugin de vite.config.ts al
 * compilar; aquí solo hay funciones puras para poder probarlas.
 */

/** Páginas públicas fijas que deben indexarse. */
export const STATIC_PAGES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/preguntas-frecuentes', changefreq: 'monthly', priority: '0.5' },
  { path: '/contacto', changefreq: 'yearly', priority: '0.3' },
];

/** Eventos que crea el seed: se usan si la API no responde durante el build. */
export const SEED_EVENT_IDS = ['final-nacional-2026', 'andrea-bocelli-magico-2026', 'beele-cuscatlan-2026'];

/** Rutas privadas: requieren sesión o no aportan nada en un buscador. */
export const PRIVATE_PATHS = ['/admin', '/boletos', '/ingresar', '/eventos/*/pago'];

export interface SitemapEvent { id: string; updatedAt?: string }

/**
 * URL pública del sitio. Orden: VITE_SITE_URL, dominio de producción de Vercel, dominio del
 * despliegue de Vercel. Devuelve '' si no hay ninguno (desarrollo local).
 */
export function resolveSiteUrl(env: Record<string, string | undefined>) {
  const raw = env.VITE_SITE_URL || env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL || '';
  if (!raw.trim()) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.trim().replace(/\/+$/, '');
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function buildSitemap(siteUrl: string, events: SitemapEvent[], today = new Date().toISOString().slice(0, 10)) {
  const urls = [
    ...STATIC_PAGES.map((p) => ({ loc: `${siteUrl}${p.path}`, lastmod: today, changefreq: p.changefreq, priority: p.priority })),
    ...events.map((e) => ({
      loc: `${siteUrl}/eventos/${encodeURIComponent(e.id)}`,
      lastmod: (e.updatedAt ?? today).slice(0, 10),
      changefreq: 'daily',
      priority: '0.8',
    })),
  ];
  const body = urls
    .map((u) => `  <url>\n    <loc>${xmlEscape(u.loc)}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function buildRobots(siteUrl: string) {
  const lines = ['User-agent: *', 'Allow: /', ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`)];
  if (siteUrl) lines.push('', `Sitemap: ${siteUrl}/sitemap.xml`);
  return `${lines.join('\n')}\n`;
}

/** Lista de eventos desde la API; si falla o tarda, los del seed. */
export async function fetchSitemapEvents(apiUrl: string, timeoutMs = 5000): Promise<{ events: SitemapEvent[]; source: 'api' | 'seed' }> {
  const fallback = { events: SEED_EVENT_IDS.map((id) => ({ id })), source: 'seed' as const };
  if (!apiUrl) return fallback;
  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/events`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { events?: Array<{ id?: unknown }> };
    const events = (data.events ?? []).filter((e): e is { id: string } => typeof e.id === 'string').map((e) => ({ id: e.id }));
    return events.length ? { events, source: 'api' } : fallback;
  } catch {
    return fallback;
  }
}
