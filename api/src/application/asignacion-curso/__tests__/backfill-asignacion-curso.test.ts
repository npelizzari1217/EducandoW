/**
 * F4-B2 / Backfill idempotency tests for backfill-asignacion-curso.ts
 * Tests the exported helper functions from the backfill script.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildTitularAsignaciones } from '../../../../scripts/backfill-asignacion-curso';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCourseCycle(uuid: string, teacherId: string, userId: string | null, cycleId = 'cycle-1') {
  return { uuid, homeroomTeacherId: teacherId, cycleId, teacher: userId ? { userId } : null };
}

function makeTenant(
  courseCycles: Array<{ uuid: string; homeroomTeacherId: string; teacher: { userId: string } | null }>,
  docenteXCiclos: Array<{ userId: string; id: string; cycleId: string }>,
) {
  return {
    courseCycle: {
      findMany: vi.fn().mockResolvedValue(courseCycles),
    },
    docenteXCiclo: {
      findFirst: vi.fn().mockImplementation(async (args: { where: { userId: string; cycleId: string } }) => {
        return docenteXCiclos.find(
          (d) => d.userId === args.where.userId && d.cycleId === args.where.cycleId,
        ) ?? null;
      }),
    },
    asignacionCursoXCiclo: {
      upsert: vi.fn().mockImplementation(async (args: { create: { id: string } }) => args.create),
    },
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('buildTitularAsignaciones', () => {
  it('returns one asignacion per CC with homeroomTeacherId + DocenteXCiclo', async () => {
    const cc = makeCourseCycle('cc-1', 't-1', 'user-1');
    const dxc = { userId: 'user-1', id: 'dxc-1', cycleId: 'cycle-1' };

    const tenant = makeTenant([cc], [dxc]) as unknown as import('@prisma/tenant-client').PrismaClient;
    // buildTitularAsignaciones returns array of {courseCycleId, docenteXCicloId}
    const result = await buildTitularAsignaciones(tenant, [cc as unknown as { uuid: string; homeroomTeacherId: string; teacher: { userId: string } | null; cycleId: string }]);

    expect(result).toHaveLength(1);
    expect(result[0].courseCycleId).toBe('cc-1');
  });

  it('skips CCs where teacher has no userId (edge case)', async () => {
    const cc = makeCourseCycle('cc-2', 't-2', null); // teacher has no userId
    const tenant = makeTenant([cc], []) as unknown as import('@prisma/tenant-client').PrismaClient;

    const result = await buildTitularAsignaciones(tenant, [cc as unknown as { uuid: string; homeroomTeacherId: string; teacher: { userId: string } | null; cycleId: string }]);

    expect(result).toHaveLength(0);
  });

  it('skips CCs where no matching DocenteXCiclo is found', async () => {
    const cc = makeCourseCycle('cc-3', 't-3', 'user-3');
    const tenant = makeTenant([cc], []) as unknown as import('@prisma/tenant-client').PrismaClient; // no dxc

    const result = await buildTitularAsignaciones(tenant, [cc as unknown as { uuid: string; homeroomTeacherId: string; teacher: { userId: string } | null; cycleId: string }]);

    expect(result).toHaveLength(0);
  });
});
