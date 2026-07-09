/**
 * reporting-module-compartido (issue #101) — RPI-S10.
 *
 * `configureApp` lives in a file separate from `main.ts` on purpose:
 * `main.ts` calls `bootstrap()` at the top level without a guard, so
 * importing anything from `main.ts` in a test would boot the real Nest
 * application as a side effect of the import. This test exercises
 * `configureApp` with a double of `app` (spied methods), never touching
 * Nest/HTTP for real.
 */
import { describe, it, expect, vi } from 'vitest';
import { configureApp } from '../configure-app';
import type { EnvConfig } from '../env.config';

function makeFakeApp() {
  return {
    setGlobalPrefix: vi.fn(),
    useStaticAssets: vi.fn(),
    enableCors: vi.fn(),
    use: vi.fn(),
    enableShutdownHooks: vi.fn(),
  };
}

function makeFakeConfig(overrides: Partial<EnvConfig> = {}): EnvConfig {
  return {
    port: 3000,
    nodeEnv: 'test',
    databaseUrl: 'postgresql://localhost/db',
    masterDatabaseUrl: 'postgresql://localhost/db',
    encryptionKey: 'a'.repeat(32),
    jwtSecret: 'secret',
    jwtExpiresIn: '15m',
    jwtRefreshExpiresIn: '7d',
    corsOrigin: 'http://localhost:5173',
    bcryptRounds: 12,
    ...overrides,
  };
}

describe('configureApp', () => {
  it('registers the shutdown hook exactly once (RPI-S10)', () => {
    const app = makeFakeApp();

    configureApp(app as never, makeFakeConfig());

    expect(app.enableShutdownHooks).toHaveBeenCalledOnce();
  });

  it('sets the global API prefix to "v1"', () => {
    const app = makeFakeApp();

    configureApp(app as never, makeFakeConfig());

    expect(app.setGlobalPrefix).toHaveBeenCalledWith('v1');
  });

  it('serves uploaded static assets under /uploads/', () => {
    const app = makeFakeApp();

    configureApp(app as never, makeFakeConfig());

    expect(app.useStaticAssets).toHaveBeenCalledOnce();
    const [, options] = app.useStaticAssets.mock.calls[0] as [string, { prefix: string }];
    expect(options).toMatchObject({ prefix: '/uploads/' });
  });

  it('enables CORS with credentials allowed', () => {
    const app = makeFakeApp();

    configureApp(app as never, makeFakeConfig());

    expect(app.enableCors).toHaveBeenCalledOnce();
    const [options] = app.enableCors.mock.calls[0] as [{ credentials: boolean }];
    expect(options).toMatchObject({ credentials: true });
  });

  it('registers the cookie parser middleware', () => {
    const app = makeFakeApp();

    configureApp(app as never, makeFakeConfig());

    expect(app.use).toHaveBeenCalledOnce();
  });
});
