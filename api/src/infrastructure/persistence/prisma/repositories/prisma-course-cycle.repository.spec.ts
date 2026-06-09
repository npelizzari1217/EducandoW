/**
 * PR3-T9 [RED] — PrismaCourseCycleRepository new method tests:
 *   findByHomeroomTeacher, findByCourseSectionIds
 * Mocks TenantContext; no real DB.
 * Specs: TIA-R5, TIA-R7, AD-6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaCourseCycleRepository } from './prisma-course-cycle.repository';
import { TenantContext } from '../../../auth/tenant.context';

vi.mock('../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Row factory ────────────────────────────────────────────────────────────────

function makeCCRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    uuid: 'cc-uuid-1',
    courseId: 'course-section-uuid-1',
    studyPlanId: 'plan-uuid-1',
    cycleId: 'cycle-uuid-1',
    courseName: 'MATEMÁTICA',
    level: 20,
    active: true,
    passingGrade: 6,
    promotionText: null,
    firstBimStart: null,
    firstBimEnd: null,
    secondBimStart: null,
    secondBimEnd: null,
    thirdBimStart: null,
    thirdBimEnd: null,
    fourthBimStart: null,
    fourthBimEnd: null,
    activeGradingPeriod: null,
    homeroomTeacherId: null,
    lastModifiedAt: new Date('2026-01-01'),
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ── Mock client factory ────────────────────────────────────────────────────────

function makeMockClient() {
  return {
    courseCycle: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      createMany: vi.fn(),
    },
    studyPlan: {
      findUnique: vi.fn(),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// findByHomeroomTeacher
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaCourseCycleRepository — findByHomeroomTeacher', () => {
  let repo: PrismaCourseCycleRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaCourseCycleRepository();
  });

  it('returns empty array when no CourseCycle has that homeroomTeacherId', async () => {
    mockClient.courseCycle.findMany.mockResolvedValue([]);

    const result = await repo.findByHomeroomTeacher('teacher-not-homeroom');

    expect(result).toHaveLength(0);
  });

  it('returns CourseCycle entities for the given teacher', async () => {
    mockClient.courseCycle.findMany.mockResolvedValue([
      makeCCRow({ uuid: 'cc-uuid-1', homeroomTeacherId: 'teacher-uuid-1' }),
      makeCCRow({ id: 2, uuid: 'cc-uuid-2', homeroomTeacherId: 'teacher-uuid-1' }),
    ]);

    const result = await repo.findByHomeroomTeacher('teacher-uuid-1');

    expect(result).toHaveLength(2);
    expect(result[0].uuid).toBe('cc-uuid-1');
    expect(result[1].uuid).toBe('cc-uuid-2');
  });

  it('queries by homeroomTeacherId and excludes soft-deleted rows', async () => {
    mockClient.courseCycle.findMany.mockResolvedValue([]);

    await repo.findByHomeroomTeacher('teacher-uuid-1');

    expect(mockClient.courseCycle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          homeroomTeacherId: 'teacher-uuid-1',
          deletedAt: null,
        }),
      }),
    );
  });

  it('returns empty array for a different tenant (different client returns empty)', async () => {
    const otherClient = makeMockClient();
    otherClient.courseCycle.findMany.mockResolvedValue([]);
    vi.mocked(TenantContext.getClient).mockReturnValue(otherClient as any);

    const result = await repo.findByHomeroomTeacher('teacher-uuid-1');

    expect(result).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// findByCourseSectionIds
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaCourseCycleRepository — findByCourseSectionIds', () => {
  let repo: PrismaCourseCycleRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaCourseCycleRepository();
  });

  it('returns empty array when ids list is empty', async () => {
    const result = await repo.findByCourseSectionIds([]);

    expect(result).toHaveLength(0);
    // No DB query should be issued for empty input
    expect(mockClient.courseCycle.findMany).not.toHaveBeenCalled();
  });

  it('returns CourseCycles whose courseId is in the provided set', async () => {
    mockClient.courseCycle.findMany.mockResolvedValue([
      makeCCRow({ courseId: 'section-uuid-1' }),
      makeCCRow({ id: 2, uuid: 'cc-uuid-2', courseId: 'section-uuid-2' }),
    ]);

    const result = await repo.findByCourseSectionIds(['section-uuid-1', 'section-uuid-2']);

    expect(result).toHaveLength(2);
  });

  it('queries with courseId IN (...) and excludes soft-deleted', async () => {
    mockClient.courseCycle.findMany.mockResolvedValue([]);

    await repo.findByCourseSectionIds(['section-uuid-1']);

    expect(mockClient.courseCycle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseId: { in: ['section-uuid-1'] },
          deletedAt: null,
        }),
      }),
    );
  });
});
