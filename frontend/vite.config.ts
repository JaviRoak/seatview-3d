/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
    plugins: [react()],
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
    test: { environment: 'jsdom', globals: true, setupFiles: ['src/test/setup.ts'], include: ['src/**/*.test.{ts,tsx}'], passWithNoTests: true },
  };
});
