import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'path';

/**
 * Integration test config — REAL database, isolated from the default unit suite.
 *
 * Requires the docker-compose Postgres up (`docker compose up -d`).
 * Run with: `pnpm --filter api test:integration`.
 *
 * Single-fork / no file parallelism: tests share three physical test DBs and
 * reset them in beforeEach, so they must not run concurrently.
 */
export default defineConfig({
  // SWC mirrors the production build: it emits decorator metadata, which NestJS
  // needs for type-based constructor injection (e.g. TenantMiddleware → PrismaService).
  // esbuild (Vitest's default) does NOT emit it, so the booted app's middleware DI
  // would resolve to undefined without this.
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['test/**/*.db.test.ts'],
    exclude: ['node_modules', 'dist'],
    globalSetup: ['./test/integration/setup/global-setup.ts'],
    setupFiles: ['./test/integration/setup/env.setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 60_000,
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
