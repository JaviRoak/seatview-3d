import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Las pruebas comparten Redis/PostgreSQL reales: se ejecutan en serie.
    fileParallelism: false,
    setupFiles: ['tests/setup.ts'],
  },
});
