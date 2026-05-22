import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient as MasterPrismaClient } from '@prisma/client';
import { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { loadEnvConfig } from '../../config/env.config';

/**
 * PrismaService — Multi-tenant PrismaClient factory.
 *
 * Maintains:
 *   - `master`: always connected to MASTER_DATABASE_URL (Institution, User, RefreshToken)
 *   - `tenants`: Map<dbName, TenantPrismaClient> (lazy init, one per tenant DB)
 *
 * Tenant connection URLs are built by replacing the database name portion
 * of MASTER_DATABASE_URL with the tenant's dbName.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly master: MasterPrismaClient;
  private readonly tenants = new Map<string, TenantPrismaClient>();
  private readonly masterDbUrl: string;

  constructor() {
    const config = loadEnvConfig();
    this.masterDbUrl = config.masterDatabaseUrl;
    this.master = new MasterPrismaClient({
      datasources: { db: { url: this.masterDbUrl } },
    });
  }

  /**
   * Returns the master PrismaClient (Institution, User, RefreshToken tables).
   */
  getMasterClient(): MasterPrismaClient {
    return this.master;
  }

  /**
   * Returns (or creates and caches) a tenant PrismaClient for the given dbName.
   */
  getTenantClient(dbName: string): TenantPrismaClient {
    const cached = this.tenants.get(dbName);
    if (cached) return cached;

    const tenantUrl = this.buildTenantUrl(dbName);
    const client = new TenantPrismaClient({
      datasources: { db: { url: tenantUrl } },
    });
    this.tenants.set(dbName, client);
    return client;
  }

  /**
   * Disconnects the master client and all cached tenant clients.
   */
  async onModuleDestroy(): Promise<void> {
    await this.master.$disconnect();
    for (const client of this.tenants.values()) {
      await client.$disconnect();
    }
  }

  // ── Internal helpers ───────────────────────────────────────

  /**
   * Builds a tenant DATABASE_URL by replacing the database name in the
   * master URL with the provided dbName.
   *
   * Example:
   *   masterUrl = "postgresql://user:pass@localhost:5432/educandow_master"
   *   dbName    = "educandow_abc123"
   *   →         "postgresql://user:pass@localhost:5432/educandow_abc123"
   */
  private buildTenantUrl(dbName: string): string {
    return this.masterDbUrl.replace(/\/[^/]+$/, `/${dbName}`);
  }
}
