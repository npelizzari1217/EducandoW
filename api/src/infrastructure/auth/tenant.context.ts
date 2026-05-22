import { AsyncLocalStorage } from 'async_hooks';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';

interface TenantStore {
  prismaClient: TenantPrismaClient | null;
  dbName: string | null;
  institutionId: string | null;
}

/**
 * TenantContext — per-request AsyncLocalStorage store.
 *
 * Set by TenantMiddleware on every HTTP request.
 * Tenant-scoped repositories read the tenant PrismaClient and institutionId from here.
 */
export const tenantAls = new AsyncLocalStorage<TenantStore>();

export const TenantContext = {
  /** Run a callback with a store for the current request. */
  run<T>(store: TenantStore, fn: () => T): T {
    return tenantAls.run(store, fn);
  },

  /** Returns the tenant PrismaClient for the current request, or null if master-only route. */
  getClient(): TenantPrismaClient | null {
    return tenantAls.getStore()?.prismaClient ?? null;
  },

  /** Returns the current request's dbName, or null. */
  getDbName(): string | null {
    return tenantAls.getStore()?.dbName ?? null;
  },

  /** Returns the current request's institutionId, or null. */
  getInstitutionId(): string | null {
    return tenantAls.getStore()?.institutionId ?? null;
  },
};
