/**
 * PR3-T9 — PrismaCourseCycleRepository method tests:
 *   findByCourseSectionIds, findGradingContextsByUuids
 * Mocks TenantContext; no real DB.
 * Specs: TIA-R7, AD-6
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
// findGradingContextsByUuids
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaCourseCycleRepository — findGradingContextsByUuids', () => {
  let repo: PrismaCourseCycleRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaCourseCycleRepository();
  });

  it('returns empty Map for empty uuids input (no DB query)', async () => {
    const result = await repo.findGradingContextsByUuids([]);

    expect(result.size).toBe(0);
    expect(mockClient.courseCycle.findMany).not.toHaveBeenCalled();
  });

  it('returns Map keyed by uuid with StudyPlan.{level, modality}', async () => {
    mockClient.courseCycle.findMany.mockResolvedValue([
      { uuid: 'cc-uuid-1', studyPlan: { level: 20, modality: 1 } },
      { uuid: 'cc-uuid-2', studyPlan: { level: 22, modality: 2 } },
    ]);

    const result = await repo.findGradingContextsByUuids(['cc-uuid-1', 'cc-uuid-2']);

    expect(result.size).toBe(2);
    expect(result.get('cc-uuid-1')).toEqual({ level: 20, modality: 1 });
    expect(result.get('cc-uuid-2')).toEqual({ level: 22, modality: 2 });
  });

  it('StudyPlan.modality is returned — diverges from CourseCycle.level composite when they differ', async () => {
    // cc.level = 20 → levelCode=2, modalityCode=0. But StudyPlan.modality = 1 (authoritative).
    mockClient.courseCycle.findMany.mockResolvedValue([
      { uuid: 'cc-diverge', studyPlan: { level: 20, modality: 1 } },
    ]);

    const result = await repo.findGradingContextsByUuids(['cc-diverge']);

    expect(result.get('cc-diverge')).toEqual({ level: 20, modality: 1 });
  });

  it('issues a single findMany query with uuid IN (...) and selects studyPlan', async () => {
    mockClient.courseCycle.findMany.mockResolvedValue([]);

    await repo.findGradingContextsByUuids(['cc-uuid-1', 'cc-uuid-2']);

    expect(mockClient.courseCycle.findMany).toHaveBeenCalledTimes(1);
    expect(mockClient.courseCycle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ uuid: { in: ['cc-uuid-1', 'cc-uuid-2'] } }),
        select: expect.objectContaining({ uuid: true, studyPlan: expect.anything() }),
      }),
    );
  });

  it('omits UUIDs whose record is missing (no entry in Map)', async () => {
    mockClient.courseCycle.findMany.mockResolvedValue([
      // only cc-uuid-1 returned — cc-uuid-2 not found
      { uuid: 'cc-uuid-1', studyPlan: { level: 20, modality: 0 } },
    ]);

    const result = await repo.findGradingContextsByUuids(['cc-uuid-1', 'cc-uuid-2']);

    expect(result.size).toBe(1);
    expect(result.has('cc-uuid-2')).toBe(false);
  });

  it('is tenant-scoped: uses the client from TenantContext', async () => {
    const otherClient = makeMockClient();
    otherClient.courseCycle.findMany.mockResolvedValue([
      { uuid: 'cc-other', studyPlan: { level: 30, modality: 0 } },
    ]);
    vi.mocked(TenantContext.getClient).mockReturnValue(otherClient as any);

    const result = await repo.findGradingContextsByUuids(['cc-other']);

    expect(result.get('cc-other')).toEqual({ level: 30, modality: 0 });
    expect(mockClient.courseCycle.findMany).not.toHaveBeenCalled();
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
