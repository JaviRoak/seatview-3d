/**
 * Metadatos SEO por página (Sprint 4): <title>, meta descripción, canonical, Open Graph,
 * Twitter Card, robots y datos estructurados (JSON-LD).
 *
 * La app es una SPA, así que cada página actualiza el <head> al montarse. index.html trae
 * valores por defecto para los clientes que no ejecutan JavaScript.
 */
import { useEffect } from 'react';
import type { EventDetail } from '../api/types';

export const SITE_NAME = 'SeatView 3D';
export const DEFAULT_DESCRIPTION =
  'Compra boletos para conciertos y partidos en El Salvador y mira en 3D cómo se verá el evento desde tu asiento antes de pagar.';
export const DEFAULT_IMAGE = '/og-image.jpg';

export interface PageMeta {
  /** Título propio de la página; se le agrega " | SeatView 3D". Sin título se usa el del sitio. */
  title?: string;
  description?: string;
  /** Ruta (o URL absoluta) de la imagen para redes sociales. */
  image?: string | null;
  /** Ruta canónica; por defecto la ruta actual sin query ni hash. */
  path?: string;
  /** Páginas privadas o de error: no se indexan. */
  noindex?: boolean;
  /** Objeto schema.org que se inserta como JSON-LD. */
  jsonLd?: Record<string, unknown> | null;
}

export function pageTitle(title?: string) {
  return title ? `${title} | ${SITE_NAME}` : `${SITE_NAME}: boletos con vista 3D desde tu asiento`;
}

/** Recorta en el último espacio para no pasar de `max` caracteres. */
export function truncate(text: string, max = 160) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

export function absoluteUrl(pathOrUrl: string, origin: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${origin.replace(/\/+$/, '')}/${pathOrUrl.replace(/^\/+/, '')}`;
}

const dateFormat = new Intl.DateTimeFormat('es-SV', { day: 'numeric', month: 'long', year: 'numeric' });

/** Título y descripción de la página de un evento. */
export function eventMeta(event: EventDetail): PageMeta {
  const [name] = event.name.split(' · ');
  const when = dateFormat.format(new Date(event.date));
  const venue = `${event.venue.name}, ${event.venue.city}`;
  const base = `${name} en ${venue}, ${when}. Elige tu asiento y mira en 3D cómo se verá el evento antes de comprar tu boleto.`;
  return {
    title: `${name} · ${event.venue.name}`,
    description: truncate(event.description ? `${event.description} ${base}` : base),
    image: event.coverImageUrl,
    jsonLd: eventJsonLd(event),
  };
}

/** schema.org/Event: permite a Google mostrar fecha y lugar en los resultados. */
export function eventJsonLd(event: EventDetail, origin = typeof location !== 'undefined' ? location.origin : '') {
  const prices = event.venue.zones.map((z) => z.price).filter((p) => p > 0);
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    startDate: event.date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(event.description ? { description: event.description } : {}),
    ...(event.coverImageUrl ? { image: [absoluteUrl(event.coverImageUrl, origin)] } : {}),
    location: {
      '@type': 'Place',
      name: event.venue.name,
      address: { '@type': 'PostalAddress', addressLocality: event.venue.city, addressCountry: 'SV' },
    },
    ...(prices.length
      ? {
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'USD',
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            availability: 'https://schema.org/InStock',
            url: absoluteUrl(`/eventos/${event.id}`, origin),
          },
        }
      : {}),
  };
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

const JSON_LD_ID = 'seo-jsonld';

/** Aplica los metadatos al <head> del documento. */
export function applyPageMeta(meta: PageMeta, loc: Pick<Location, 'origin' | 'pathname'> = location) {
  const title = pageTitle(meta.title);
  const description = truncate(meta.description ?? DEFAULT_DESCRIPTION);
  const url = absoluteUrl(meta.path ?? loc.pathname, loc.origin);
  const image = absoluteUrl(meta.image || DEFAULT_IMAGE, loc.origin);

  document.title = title;
  setMeta('name', 'description', description);
  setMeta('name', 'robots', meta.noindex ? 'noindex, nofollow' : 'index, follow');
  setCanonical(url);

  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:locale', 'es_SV');
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:image', image);
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', image);

  document.getElementById(JSON_LD_ID)?.remove();
  if (meta.jsonLd) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = JSON_LD_ID;
    script.textContent = JSON.stringify(meta.jsonLd);
    document.head.appendChild(script);
  }
}

/** Hook para usar en cada página: `usePageMeta({ title: 'Contacto', description: '…' })`. */
export function usePageMeta(meta: PageMeta) {
  const key = JSON.stringify(meta);
  useEffect(() => {
    applyPageMeta(meta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
