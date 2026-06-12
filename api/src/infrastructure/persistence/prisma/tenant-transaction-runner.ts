import { Injectable } from '@nestjs/common';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import type { TenantTransactionRunner } from '../../../application/shared/ports/tenant-transaction-runner';
import { tenantAls, TenantContext } from '../../auth/tenant.context';

/**
 * PrismaTenantTransactionRunner — wraps a unit of work in a Prisma interactive
 * transaction and rebinds the TenantContext so that all repository calls inside
 * the callback automatically use the transaction client.
 *
 * This relies on the fact that TenantPrismaClient repos read the client from
 * AsyncLocalStorage (TenantContext.getClient()) and do NOT call $transaction
 * themselves — so swapping the client in ALS is safe and transparent.
 */
@Injectable()
export class PrismaTenantTransactionRunner implements TenantTransactionRunner {
  async run<T>(work: () => Promise<T>): Promise<T> {
    const client = TenantContext.getClient();
    if (!client) {
      throw new Error('PrismaTenantTransactionRunner: no tenant client available for this request');
    }

    const store = tenantAls.getStore();
    if (!store) {
      throw new Error('PrismaTenantTransactionRunner: no tenant store available for this request');
    }

    return client.$transaction(async (tx) =>
      TenantContext.run(
        { ...store, prismaClient: tx as unknown as TenantPrismaClient },
        work,
      ),
    );
  }
}
