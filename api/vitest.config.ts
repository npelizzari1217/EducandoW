import { defineConfig } from 'vitest/config';
import path from 'path';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        keepClassNames: true,
      },
      module: { type: 'es6' },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts', 'test/**/*.test.ts', 'test/**/*.spec.ts', 'scripts/__tests__/**/*.test.ts', 'scripts/__tests__/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', '**/*.db.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', 'dist', '**/__tests__/**'],
    },
    server: {
      deps: {
        inline: ['@educandow/domain'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@educandow/domain': path.resolve(__dirname, '../packages/domain/src'),
    },
  },
});
