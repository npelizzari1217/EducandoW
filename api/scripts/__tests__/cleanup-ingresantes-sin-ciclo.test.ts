/**
 * Tests for cleanup-ingresantes-sin-ciclo.ts
 * Covers: countNullCycleIngresantes + cleanupTenantIngresantes helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { countNullCycleIngresantes, cleanupTenantIngresantes } from '../cleanup-ingresantes-sin-ciclo';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';

// ── Mock factory ────────────────────────────────────────────────────────────

type IngresanteMock = {
  count: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
};

function makeMockTenant(countResult = 0): { ingresante: IngresanteMock } {
  return {
    ingresante: {
      count: vi.fn().mockResolvedValue(countResult),
      deleteMany: vi.fn().mockResolvedValue({ count: countResult }),
    },
  };
}

// ── countNullCycleIngresantes ───────────────────────────────────────────────

describe('countNullCycleIngresantes', () => {
  it('devuelve 0 cuando no hay registros con cycleId null', async () => {
    const tenant = makeMockTenant(0);
    const result = await countNullCycleIngresantes(tenant as unknown as TenantPrismaClient);
    expect(result).toBe(0);
    expect(tenant.ingresante.count).toHaveBeenCalledWith({ where: { cycleId: null } });
  });

  it('devuelve el count correcto cuando hay registros con cycleId null', async () => {
    const tenant = makeMockTenant(7);
    const result = await countNullCycleIngresantes(tenant as unknown as TenantPrismaClient);
    expect(result).toBe(7);
    expect(tenant.ingresante.count).toHaveBeenCalledWith({ where: { cycleId: null } });
  });
});

// ── cleanupTenantIngresantes ────────────────────────────────────────────────

describe('cleanupTenantIngresantes', () => {
  it('llama deleteMany con { where: { cycleId: null } } (SC-CYC-06)', async () => {
    const tenant = makeMockTenant(3);
    await cleanupTenantIngresantes(tenant as unknown as TenantPrismaClient, 100);
    expect(tenant.ingresante.deleteMany).toHaveBeenCalledWith({ where: { cycleId: null } });
  });

  it('retorna deleted=3 cuando hay 3 registros null bajo el umbral', async () => {
    const tenant = makeMockTenant(3);
    const result = await cleanupTenantIngresantes(tenant as unknown as TenantPrismaClient, 100);
    expect(result.deleted).toBe(3);
    expect(result.skipped).toBe(false);
  });

  it('aborta (skipped=true) cuando count supera el umbral', async () => {
    const tenant = makeMockTenant(50);
    const result = await cleanupTenantIngresantes(tenant as unknown as TenantPrismaClient, 10);
    expect(result.skipped).toBe(true);
    expect(result.deleted).toBe(0);
    expect(tenant.ingresante.deleteMany).not.toHaveBeenCalled();
  });

  it('idempotencia: con 0 registros null no llama deleteMany y retorna deleted=0', async () => {
    const tenant = makeMockTenant(0);
    const r1 = await cleanupTenantIngresantes(tenant as unknown as TenantPrismaClient, 100);
    const r2 = await cleanupTenantIngresantes(tenant as unknown as TenantPrismaClient, 100);
    expect(r1.deleted).toBe(0);
    expect(r2.deleted).toBe(0);
    expect(tenant.ingresante.deleteMany).not.toHaveBeenCalled();
  });
});
