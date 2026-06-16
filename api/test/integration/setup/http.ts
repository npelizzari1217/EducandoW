/**
 * HTTP-level harness — boots the real NestJS app against the test databases and
 * mints JWTs so the production auth stack (AuthGuard, RolesGuard, TenantMiddleware,
 * the 3-door use-cases) runs end-to-end over supertest.
 *
 * Tenant routing comes for free: the JWT carries `dbName: 'educandow_test_i1'`,
 * TenantMiddleware looks up the Institution by that dbName in master and calls
 * PrismaService.getTenantClient(dbName) — which (sharing MASTER_DATABASE_URL's host)
 * resolves to the physical test tenant DB. So the request hits the same rows our
 * factories seed via clients.ts.
 */
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { AppModule } from '../../../src/app.module';

let app: INestApplication | undefined;

/** Boots (and caches) the Nest app, mirroring app.e2e.test.ts + main.ts prefix. */
export async function bootTestApp(): Promise<INestApplication> {
  if (app) return app;
  // Safety latch: never boot the real app against a non-test master DB.
  const masterUrl = process.env.MASTER_DATABASE_URL ?? '';
  if (!/_test_/.test(masterUrl)) {
    throw new Error(
      `Refusing to boot test app: MASTER_DATABASE_URL is not a test DB (${masterUrl}). ` +
        'env.setup.ts must run first.',
    );
  }
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('v1');
  await app.init();
  return app;
}

export async function closeTestApp(): Promise<void> {
  await app?.close();
  app = undefined;
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

export interface TokenClaims {
  sub: string; // master User.id (also the DocenteXCiclo.userId for Door 2)
  roles?: string[];
  modules?: { moduleCode: string; actions: string[] }[];
  institutionId?: string;
  dbName: string; // tenant DB name — drives TenantMiddleware routing
}

/** Mints a JWT signed with the same secret the app verifies with. */
export function signToken(claims: TokenClaims): string {
  return jwt.sign(
    {
      sub: claims.sub,
      roles: claims.roles ?? [],
      modules: claims.modules ?? [],
      institutionId: claims.institutionId,
      dbName: claims.dbName,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

/** Convenience: a `{ moduleCode: 'ATTENDANCE', actions: ['CREATE'] }` grant. */
export const ATTENDANCE_CREATE = { moduleCode: 'ATTENDANCE', actions: ['CREATE'] };
