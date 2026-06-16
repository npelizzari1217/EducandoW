/**
 * DC-S9 — cross-tenant isolation for DocenteXCiclo.
 *
 * Scenario (docente-ciclo-grupos):
 *   GIVEN two institutions I1 and I2, each with its own tenant database,
 *   WHEN a DocenteXCiclo is created in I1,
 *   THEN I2 MUST NOT see it (and vice versa) — even when both records share
 *        the same teacher userId.
 *
 * Exercises the real PrismaDocenteXCicloRepository routed through TenantContext,
 * so isolation is proven against the production query path, not a test shortcut.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaDocenteXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import {
  tenantI1Client,
  tenantI2Client,
  runInTenant,
  resetAll,
  disconnectAll,
} from '../setup/clients';
import { createAcademicCycle } from '../setup/factories';

const repo = new PrismaDocenteXCicloRepository();

describe('DC-S9 — DocenteXCiclo cross-tenant isolation', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  it('I2 does not see a DocenteXCiclo created in I1, and vice versa', async () => {
    const i1 = tenantI1Client();
    const i2 = tenantI2Client();

    // Same teacher userId in both tenants — isolation must hold regardless.
    const sharedUserId = 'user-shared-1';

    // Each tenant gets its own cycle (uuid is per-DB).
    const cycleI1 = await createAcademicCycle(i1, { code: '2026', name: '2026' });
    const cycleI2 = await createAcademicCycle(i2, { code: '2026', name: '2026' });

    // Seed one DocenteXCiclo in each tenant via the production upsert path.
    const docI1 = await runInTenant(i1, () =>
      repo.upsert({ userId: sharedUserId, cycleId: cycleI1.uuid }),
    );
    const docI2 = await runInTenant(i2, () =>
      repo.upsert({ userId: sharedUserId, cycleId: cycleI2.uuid }),
    );
    expect(docI1.id).not.toBe(docI2.id);

    // findByCycleId: each tenant sees only its own cycle's record.
    const byCycleFromI1 = await runInTenant(i1, () => repo.findByCycleId(cycleI1.uuid));
    const byCycleFromI2OfI1 = await runInTenant(i2, () => repo.findByCycleId(cycleI1.uuid));
    expect(byCycleFromI1.map((d) => d.id)).toEqual([docI1.id]);
    expect(byCycleFromI2OfI1).toHaveLength(0); // I2 cannot see I1's cycle records

    // findByUserId: the SAME userId resolves to a different record per tenant.
    const byUserFromI1 = await runInTenant(i1, () => repo.findByUserId(sharedUserId));
    const byUserFromI2 = await runInTenant(i2, () => repo.findByUserId(sharedUserId));
    expect(byUserFromI1.map((d) => d.id)).toEqual([docI1.id]);
    expect(byUserFromI2.map((d) => d.id)).toEqual([docI2.id]);
    expect(byUserFromI1[0].cycleId).toBe(cycleI1.uuid);
    expect(byUserFromI2[0].cycleId).toBe(cycleI2.uuid);
  });
});
