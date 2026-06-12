/**
 * F2-T9 / F2-B2 — Backfill idempotency and D4 unit tests.
 * Tests the exported helper `collectCycleIdsForTeacher` from backfill script.
 */
import { describe, it, expect, vi } from 'vitest';
import { collectCycleIdsForTeacher } from '../../../../scripts/backfill-docente-x-ciclo';

// ── mock TenantPrismaClient ──────────────────────────────────────────────────

function makeTenant(overrides: {
  homeroomCycles?: { cycleId: string }[];
  assignments?: { courseSectionId: string }[];
  assignmentCourseCycles?: { cycleId: string }[];
}) {
  return {
    courseCycle: {
      findMany: vi.fn().mockImplementation((args: { where?: { homeroomTeacherId?: string; courseId?: { in: string[] } } }) => {
        if (args.where?.homeroomTeacherId) {
          return Promise.resolve(overrides.homeroomCycles ?? []);
        }
        // assignment path
        return Promise.resolve(overrides.assignmentCourseCycles ?? []);
      }),
    },
    subjectAssignment: {
      findMany: vi.fn().mockResolvedValue(overrides.assignments ?? []),
    },
  } as unknown as import('@prisma/tenant-client').PrismaClient;
}

// ── tests ─────────────────────────────────────────────────────────────────

describe('collectCycleIdsForTeacher', () => {
  // Teacher with homeroom in cycle C1
  it('collects cycleId from homeroomTeacherId', async () => {
    const tenant = makeTenant({ homeroomCycles: [{ cycleId: 'c-1' }] });
    const result = await collectCycleIdsForTeacher(tenant, 'teacher-1');
    expect(result).toContain('c-1');
  });

  // Teacher with SubjectAssignment in cycle C2
  it('collects cycleId from SubjectAssignment → CourseCycle path', async () => {
    const tenant = makeTenant({
      homeroomCycles: [],
      assignments: [{ courseSectionId: 'cs-1' }],
      assignmentCourseCycles: [{ cycleId: 'c-2' }],
    });
    const result = await collectCycleIdsForTeacher(tenant, 'teacher-1');
    expect(result).toContain('c-2');
  });

  // Teacher in both paths → deduplication
  it('deduplicates cycle ids when same cycle appears in both paths', async () => {
    const tenant = makeTenant({
      homeroomCycles: [{ cycleId: 'c-1' }],
      assignments: [{ courseSectionId: 'cs-1' }],
      assignmentCourseCycles: [{ cycleId: 'c-1' }],
    });
    const result = await collectCycleIdsForTeacher(tenant, 'teacher-1');
    const uniqueC1 = result.filter((id) => id === 'c-1');
    expect(uniqueC1).toHaveLength(1);
  });

  // Teacher with no active assignments → empty
  it('returns empty array when teacher has no active assignments or homeroom', async () => {
    const tenant = makeTenant({ homeroomCycles: [], assignments: [], assignmentCourseCycles: [] });
    const result = await collectCycleIdsForTeacher(tenant, 'teacher-orphan');
    expect(result).toHaveLength(0);
  });

  // Multiple cycles
  it('collects multiple distinct cycleIds', async () => {
    const tenant = makeTenant({
      homeroomCycles: [{ cycleId: 'c-1' }],
      assignments: [{ courseSectionId: 'cs-1' }],
      assignmentCourseCycles: [{ cycleId: 'c-2' }],
    });
    const result = await collectCycleIdsForTeacher(tenant, 'teacher-1');
    expect(result).toContain('c-1');
    expect(result).toContain('c-2');
    expect(result).toHaveLength(2);
  });
});
