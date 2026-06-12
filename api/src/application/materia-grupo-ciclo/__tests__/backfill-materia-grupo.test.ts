/**
 * backfill-materia-grupo — unit tests (TDD, Fase 3c, F3-T11)
 * Tests the exported helper functions for idempotency and correctness.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  collectSubjectsForCourseCycle,
  collectEnrolledStudentIds,
} from '../../../../scripts/backfill-materia-grupo';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeTenantMock(overrides: Record<string, unknown> = {}) {
  return {
    courseCycle: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    studyPlanCourse: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    studyPlanSubject: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    enrollment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    courseSection: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  };
}

// ── collectSubjectsForCourseCycle ─────────────────────────────────────────────

describe('collectSubjectsForCourseCycle', () => {
  it('returns empty array when no study plan course found', async () => {
    const tenant = makeTenantMock({
      studyPlanCourse: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    const result = await collectSubjectsForCourseCycle(
      tenant as never,
      { uuid: 'cc-1', studyPlanId: 'plan-1', courseId: 'cs-1' },
    );

    expect(result).toEqual([]);
  });

  it('returns subjects from study plan course', async () => {
    const tenant = makeTenantMock({
      studyPlanCourse: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'spc-1',
          subjects: [
            { id: 'sps-1', subjectId: 'subj-1' },
            { id: 'sps-2', subjectId: 'subj-2' },
          ],
        }),
      },
    });

    const result = await collectSubjectsForCourseCycle(
      tenant as never,
      { uuid: 'cc-1', studyPlanId: 'plan-1', courseId: 'cs-1' },
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ subjectId: 'subj-1', studyPlanSubjectId: 'sps-1' });
    expect(result[1]).toEqual({ subjectId: 'subj-2', studyPlanSubjectId: 'sps-2' });
  });
});

// ── collectEnrolledStudentIds ─────────────────────────────────────────────────

describe('collectEnrolledStudentIds', () => {
  it('returns empty array when courseSection not found', async () => {
    const tenant = makeTenantMock({
      // CC exists, but its CourseSection does not
      courseCycle: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ courseId: 'cs-1' }),
      },
      courseSection: { findUnique: vi.fn().mockResolvedValue(null) },
    });

    const result = await collectEnrolledStudentIds(tenant as never, 'cc-1');
    expect(result).toEqual([]);
  });

  it('returns student IDs from active enrollments', async () => {
    const tenant = makeTenantMock({
      courseCycle: {
        findMany: vi.fn().mockResolvedValue([{ courseId: 'cs-1' }]),
        findUnique: vi.fn().mockResolvedValue({ courseId: 'cs-1' }),
      },
      courseSection: {
        findUnique: vi.fn().mockResolvedValue({
          level: 20, grade: '1', division: 'A', academicYear: '2026',
        }),
      },
      enrollment: {
        findMany: vi.fn().mockResolvedValue([
          { studentId: 's-1' },
          { studentId: 's-2' },
        ]),
      },
    });

    const result = await collectEnrolledStudentIds(tenant as never, 'cc-uuid-1');
    expect(result).toHaveLength(2);
    expect(result).toContain('s-1');
    expect(result).toContain('s-2');
  });
});
