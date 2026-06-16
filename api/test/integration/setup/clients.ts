/**
 * Real Prisma clients + isolation helpers for integration tests.
 *
 * Unlike the unit tests (which mock TenantContext), these connect to the live
 * test databases created by global-setup. Each tenant client points at its own
 * dedicated DB, so routing a repository through the right client IS the tenant
 * isolation boundary under test.
 */
import { PrismaClient as MasterPrismaClient } from '@prisma/client';
import { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../src/infrastructure/auth/tenant.context';
import { MASTER_URL, TENANT_I1_URL, TENANT_I2_URL } from './test-db';

let master: MasterPrismaClient | undefined;
const tenants = new Map<string, TenantPrismaClient>();

export function masterClient(): MasterPrismaClient {
  if (!master) {
    master = new MasterPrismaClient({ datasources: { db: { url: MASTER_URL } } });
  }
  return master;
}

function tenantClient(url: string): TenantPrismaClient {
  let client = tenants.get(url);
  if (!client) {
    client = new TenantPrismaClient({ datasources: { db: { url } } });
    tenants.set(url, client);
  }
  return client;
}

export const tenantI1Client = (): TenantPrismaClient => tenantClient(TENANT_I1_URL);
export const tenantI2Client = (): TenantPrismaClient => tenantClient(TENANT_I2_URL);

/**
 * Runs `fn` with the given tenant client installed in TenantContext — exactly
 * how TenantMiddleware wires a real request. Tenant-scoped repositories will
 * resolve this client via TenantContext.getClient().
 */
export function runInTenant<T>(client: TenantPrismaClient, fn: () => Promise<T>): Promise<T> {
  return TenantContext.run({ prismaClient: client, dbName: null, institutionId: null }, fn);
}

/** TRUNCATE every public table (except Prisma's migration bookkeeping). */
async function truncateAll(
  client: MasterPrismaClient | TenantPrismaClient,
): Promise<void> {
  const rows = await client.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'`,
  );
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(', ');
  await client.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

/** Resets master + both tenant DBs to empty. Call in beforeEach for isolation. */
export async function resetAll(): Promise<void> {
  await truncateAll(masterClient());
  await truncateAll(tenantI1Client());
  await truncateAll(tenantI2Client());
}

/** Disconnects all clients. Call in afterAll. */
export async function disconnectAll(): Promise<void> {
  await master?.$disconnect();
  for (const client of tenants.values()) await client.$disconnect();
  tenants.clear();
  master = undefined;
}
