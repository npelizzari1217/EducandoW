/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // El domain compila a CJS; rollup no reconoce sus named exports en build.
      // Resolvemos el subpath de utils al SOURCE .ts (ESM, zero-deps, bundleable),
      // evitando el barrel (ciclos) y el interop CJS. Aplica a build, dev y test.
      '@educandow/domain/asistencia/utils/calendar-utils': path.resolve(
        __dirname,
        '../packages/domain/src/asistencia/utils/calendar-utils.ts',
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    css: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
