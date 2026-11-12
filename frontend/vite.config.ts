/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { buildRobots, buildSitemap, fetchSitemapEvents, resolveSiteUrl } from './src/seo/sitemap';

/**
 * SEO (Sprint 4): al compilar emite robots.txt y sitemap.xml en dist/.
 * - URL del sitio: VITE_SITE_URL o, en Vercel, el dominio de producción.
 * - Eventos: se piden a VITE_API_URL/api/events; si no responde, se usan los del seed.
 */
function seoFiles(env: Record<string, string>): Plugin {
  return {
    name: 'seatview-seo-files',
    apply: 'build',
    async generateBundle() {
      const siteUrl = resolveSiteUrl({ ...process.env, ...env });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobots(siteUrl) });
      if (!siteUrl) {
        this.warn('VITE_SITE_URL no está definida: se omite sitemap.xml (necesita URLs absolutas).');
        return;
      }
      const { events, source } = await fetchSitemapEvents(env.VITE_API_URL ?? '');
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemap(siteUrl, events) });
      console.log(`[seo] sitemap.xml: ${events.length} eventos (${source}) en ${siteUrl}`);
    },
  };
}

/**
 * Configuración de Vite.
 * - server.host / allowedHosts: permite servir detrás de un túnel (Cloudflare Tunnel, ngrok).
 * - Proxy de /api y /socket.io (con WebSocket) hacia el backend: el navegador solo habla con
 *   el origen del frontend, así que las variables VITE_API_URL / VITE_SOCKET_URL pueden ir vacías.
 * - BACKEND_ORIGIN: destino del proxy. Por defecto 127.0.0.1 (no "localhost": en Windows puede
 *   resolver a ::1 y dar ECONNREFUSED si el backend solo escucha IPv4).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.BACKEND_ORIGIN || 'http://127.0.0.1:4000';
  return {
    plugins: [react(), seoFiles(env)],
    server: {
      port: 5173,
      host: true,
      allowedHosts: true,
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/uploads': { target: backend, changeOrigin: true },
        '/socket.io': { target: backend, changeOrigin: true, ws: true },
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: { output: { manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'] } } },
    },
    test: { environment: 'jsdom', globals: true, setupFiles: ['src/test/setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
  };
});
