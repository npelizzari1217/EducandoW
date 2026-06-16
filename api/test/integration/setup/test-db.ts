/**
 * Integration test DB configuration.
 *
 * Reuses the project's Postgres (docker-compose `educandow-db`, port 5433) but
 * targets DEDICATED databases so it never touches real master/tenant data:
 *   - educandow_test_master  → master schema (Institution, User, RefreshToken)
 *   - educandow_test_i1      → tenant schema, institution I1
 *   - educandow_test_i2      → tenant schema, institution I2
 *
 * The base URL points at the `postgres` admin database; per-DB URLs are derived
 * by swapping the trailing database name — the same technique PrismaService uses
 * to build tenant URLs (api/src/.../prisma.service.ts).
 */

export const ADMIN_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/postgres';

export const MASTER_DB = 'educandow_test_master';
export const TENANT_I1_DB = 'educandow_test_i1';
export const TENANT_I2_DB = 'educandow_test_i2';

/** Swap the trailing database name in a Postgres URL, preserving any query string. */
export function urlForDb(dbName: string): string {
  return ADMIN_URL.replace(/\/[^/?]+(\?.*)?$/, `/${dbName}$1`);
}

export const MASTER_URL = urlForDb(MASTER_DB);
export const TENANT_I1_URL = urlForDb(TENANT_I1_DB);
export const TENANT_I2_URL = urlForDb(TENANT_I2_DB);
